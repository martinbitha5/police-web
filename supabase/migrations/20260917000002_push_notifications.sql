-- Notifications push (Web Push) pour la supervision.
--
-- Un superviseur qui a activé les notifications sur son navigateur reçoit une
-- alerte système à chaque nouvelle alerte fraude de son périmètre (sa
-- compagnie, son escale), même si le portail n'est pas ouvert.
--
-- Chaîne : INSERT fraud_alerts → trigger → pg_net POST vers la fonction edge
-- `push-fraud-alert` → Web Push vers chaque abonnement du périmètre.
--
-- Secrets dans Vault (jamais en clair dans le dépôt) :
--   vapid_public_key     clé publique VAPID, lue par le navigateur (RPC)
--   vapid_private_key    clé privée VAPID, lue par la fonction edge (service_role)
--   push_webhook_secret  jeton partagé trigger → fonction edge
-- Provisionnés une fois avec : select vault.create_secret('<valeur>', '<nom>');

create extension if not exists pg_net with schema extensions;

-- ── Abonnements ──────────────────────────────────────────────
-- Un abonnement = un navigateur. Un utilisateur peut en avoir plusieurs
-- (poste de supervision, téléphone). Supprimé avec le compte.
create table if not exists public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Chacun gère ses propres abonnements. La fonction edge lit tout via service_role.
drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Lecture des secrets ──────────────────────────────────────
-- Clé publique VAPID : nécessaire au navigateur pour s'abonner, sans danger.
create or replace function public.push_vapid_public_key()
returns text language sql stable security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public_key' limit 1;
$$;
revoke execute on function public.push_vapid_public_key() from public, anon;
grant execute on function public.push_vapid_public_key() to authenticated, service_role;

-- Secrets serveur : réservés à service_role (fonction edge).
create or replace function public.push_secret(secret_name text)
returns text language sql stable security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name limit 1;
$$;
revoke execute on function public.push_secret(text) from public, anon, authenticated;
grant execute on function public.push_secret(text) to service_role;

-- ── Déclencheur ──────────────────────────────────────────────
-- Appel asynchrone (pg_net) : l'INSERT de l'alerte n'attend pas l'envoi et ne
-- peut pas échouer à cause de lui. Le jeton partagé authentifie l'appel.
create or replace function public.push_fraud_alert_notify()
returns trigger language plpgsql security definer set search_path = public, vault, extensions as $$
declare
  secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'push_webhook_secret' limit 1;
  if secret is null then
    return new;  -- pas encore provisionné : l'alerte vit sans push
  end if;
  perform net.http_post(
    url := 'https://zdnktpdtolyhdischulk.supabase.co/functions/v1/push-fraud-alert',
    body := jsonb_build_object('alert_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', secret),
    timeout_milliseconds := 8000
  );
  return new;
end;
$$;

drop trigger if exists push_fraud_alert_trg on public.fraud_alerts;
create trigger push_fraud_alert_trg
  after insert on public.fraud_alerts
  for each row execute function public.push_fraud_alert_notify();
