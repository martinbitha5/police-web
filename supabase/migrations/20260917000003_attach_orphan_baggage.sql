-- Rattachement d'une étiquette orpheline à un passager, par le superviseur.
--
-- Cas terrain (KQ, 17/09/2026) : le boarding pass est imprimé avec 2 bagages,
-- puis le comptoir encaisse un excédent et imprime une 3e étiquette SANS
-- réimprimer le boarding pass. Au tapis, la 3e étiquette n'est sur aucun
-- boarding pass : règle 1, rejet, alerte sans nom ni PNR. Personne ne pouvait
-- rien faire d'autre que constater : ni l'agent (et c'est voulu), ni le
-- superviseur (aucun bouton), tant que le comptoir ne réimprimait pas le pass.
--
-- Ici le superviseur fait, à la main et à son nom, ce qu'un boarding pass
-- réimprimé aurait fait automatiquement : il crée la ligne bagage pour cette
-- étiquette, liée au passager, et l'alerte se ferme avec son motif. Le sac
-- repasse ensuite au tapis comme n'importe quel autre : aucune règle
-- anti-fraude n'est contournée, le quota du passager vaut simplement
-- « étiquettes du boarding pass + étiquettes rattachées ».
--
-- Le nombre déclaré par le boarding pass (passengers.declared_baggage_count)
-- n'est jamais modifié : la ligne bagage porte le rattachement (attached,
-- auteur, heure, motif) et c'est elle qui étend le quota. Si le comptoir
-- réimprime plus tard le pass avec cette étiquette, l'API repasse la ligne en
-- origine boarding pass (attached = false) : rien ne compte deux fois.

alter table public.baggage
  add column if not exists attached boolean not null default false,
  add column if not exists attached_by uuid references public.profiles(id) on delete set null,
  add column if not exists attached_at timestamptz,
  add column if not exists attach_reason text;

comment on column public.baggage.attached is
  'true = étiquette orpheline rattachée à ce passager par un superviseur (hors boarding pass). Étend le quota du passager d''un bagage.';

create index if not exists baggage_attached_idx
  on public.baggage (passenger_id)
  where attached and not cancelled;

-- ── Fonction de rattachement ────────────────────────────────────────────────
-- security invoker : la RLS des trois tables s'applique telle quelle (écriture
-- superviseur/admin, dans le périmètre de sa compagnie et de son aéroport).
-- Une seule transaction : ligne bagage + résolution de l'alerte, ou rien.
create or replace function public.attach_orphan_baggage(
  p_alert_id     uuid,
  p_passenger_id uuid,
  p_reason       text
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_alert      public.fraud_alerts%rowtype;
  v_pax        public.passengers%rowtype;
  v_status     text;
  v_tag        text;
  v_reason     text := btrim(coalesce(p_reason, ''));
  v_existing   public.baggage%rowtype;
  v_quota      int;
  v_ordinal    text;
  v_bag_id     uuid;
  v_actor      uuid := auth.uid();
  v_actor_name text;
begin
  if public.auth_role() not in ('admin', 'supervisor') then
    raise exception 'Réservé aux superviseurs et administrateurs.';
  end if;
  if v_reason = '' then
    raise exception 'Le motif est obligatoire.';
  end if;

  select * into v_alert from public.fraud_alerts where id = p_alert_id for update;
  if not found then
    raise exception 'Alerte introuvable.';
  end if;
  if v_alert.resolved then
    raise exception 'Cette alerte est déjà résolue.';
  end if;
  -- Règle 1 uniquement (libellé courant et ancien libellé historique). Les
  -- règles 2 et 3 nomment déjà un passager : elles restent le cœur anti-fraude.
  if v_alert.reason not in ('Étiquette non rattachée à un passager', 'Passager non enregistré') then
    raise exception 'Seule une étiquette orpheline (règle 1) peut être rattachée.';
  end if;

  select * into v_pax from public.passengers where id = p_passenger_id for update;
  if not found then
    raise exception 'Passager introuvable.';
  end if;
  if v_pax.flight_id <> v_alert.flight_id then
    raise exception 'Ce passager n''est pas sur le vol de l''alerte.';
  end if;
  if v_pax.offloaded then
    raise exception 'Ce passager a été débarqué : aucun bagage ne peut lui être rattaché.';
  end if;

  select status into v_status from public.flights where id = v_alert.flight_id;
  if v_status in ('departed', 'arrived', 'cancelled') then
    raise exception 'Ce vol est %, plus aucun bagage ne peut lui être rattaché.',
      case v_status when 'departed' then 'décollé' when 'arrived' then 'arrivé' else 'annulé' end;
  end if;

  v_tag := regexp_replace(coalesce(v_alert.tag_number, ''), '\D', '', 'g');
  if length(v_tag) <> 10 then
    raise exception 'Étiquette invalide sur l''alerte (% chiffres, 10 attendus).', length(v_tag);
  end if;

  select * into v_existing
  from public.baggage
  where flight_id = v_alert.flight_id and tag_number = v_tag;
  if found then
    if v_existing.cancelled then
      raise exception 'Cette étiquette a été annulée sur ce vol.';
    end if;
    raise exception 'Cette étiquette est déjà rattachée à un passager de ce vol.';
  end if;

  -- Quota actuel = boarding pass + déjà rattachés (hors annulés), pour dire
  -- dans la note « comme 3e bagage ».
  select v_pax.declared_baggage_count + count(*) into v_quota
  from public.baggage
  where passenger_id = v_pax.id and kind = 'passenger' and attached and not cancelled;
  v_ordinal := case when v_quota + 1 = 1 then '1er' else (v_quota + 1)::text || 'e' end;

  insert into public.baggage (
    passenger_id, flight_id, tag_number, issuer_code, airline_numeric_code, serial_number,
    is_confirmed, kind, attached, attached_by, attached_at, attach_reason
  ) values (
    v_pax.id, v_alert.flight_id, v_tag, substr(v_tag, 1, 1), substr(v_tag, 2, 3), substr(v_tag, 5, 6),
    false, 'passenger', true, v_actor, now(), v_reason
  )
  returning id into v_bag_id;

  select full_name into v_actor_name from public.profiles where id = v_actor;

  update public.fraud_alerts
  set resolved    = true,
      resolved_at = now(),
      resolved_by = v_actor,
      note        = format(
        'Rattachée par %s à %s (PNR %s) comme %s bagage. Motif : %s. Le bagage doit repasser au tapis.',
        coalesce(v_actor_name, 'un superviseur'), v_pax.full_name, v_pax.pnr, v_ordinal, v_reason
      )
  where id = v_alert.id;

  return v_bag_id;
end;
$$;

revoke execute on function public.attach_orphan_baggage(uuid, uuid, text) from public, anon;
grant  execute on function public.attach_orphan_baggage(uuid, uuid, text) to authenticated;

-- ── Journal d'audit : le rattachement change ce que le passager peut charger ──
drop trigger if exists audit_baggage_upd on public.baggage;
create trigger audit_baggage_upd
  after update on public.baggage
  for each row
  when (
    old.is_confirmed is distinct from new.is_confirmed
    or old.cancelled is distinct from new.cancelled
    or old.scanned_by is distinct from new.scanned_by
    or old.rush_status is distinct from new.rush_status
    or old.tag_number is distinct from new.tag_number
    or old.attached is distinct from new.attached
  )
  execute function public.audit_capture();

-- ── Journal d'activité : mouvement « bagage rattaché par le superviseur » ─────
-- Même corps que la migration 20260908000007, plus la branche `attached` : sans
-- elle, la ligne créée par le superviseur apparaissait comme « déclaré au
-- check-in » au nom de l'agent qui avait scanné le boarding pass.
create or replace function public.activity_baggage() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.kind = 'passenger' and new.attached then
      perform activity_add(coalesce(new.attached_at, new.scanned_at), 'baggage_attached', new.attached_by,
        new.flight_id, new.passenger_id, new.id, new.tag_number, new.attach_reason);
    elsif new.kind = 'passenger' and not new.is_confirmed and new.scanned_at is not null then
      perform activity_add(new.scanned_at, 'baggage_declared',
        (select scanned_by from public.passengers where id = new.passenger_id),
        new.flight_id, new.passenger_id, new.id, new.tag_number, null);
    end if;
    if new.kind = 'rush_forward' and new.announced_at is not null then
      perform activity_add(new.announced_at, 'rush_announced', new.announced_by, new.flight_id, new.passenger_id, new.id, new.tag_number, coalesce(new.rush_origin, 'Annonce superviseur'));
    end if;
    if new.kind = 'rush_forward' and new.rush_status <> 'expected' and new.scanned_by is not null and new.scanned_at is not null then
      perform activity_add(new.scanned_at, 'baggage_rush_in', new.scanned_by, new.flight_id, new.passenger_id, new.id, new.tag_number,
        case when new.announced_at is not null then 'Bagage annoncé, arrivé au scan'
             when new.passenger_id is not null then 'Restant connu réacheminé'
             else 'Bagage externe (validation superviseur)' end);
    end if;
    return null;
  end if;

  if new.kind = 'passenger' and new.is_confirmed and new.scanned_at is not null and (old.is_confirmed is distinct from new.is_confirmed) then
    perform activity_add(new.scanned_at, 'baggage_belt', new.scanned_by, new.flight_id, new.passenger_id, new.id, new.tag_number, null);
  end if;
  if new.kind = 'rush_forward' and new.announced_at is not null and (old.announced_at is distinct from new.announced_at) then
    perform activity_add(new.announced_at, 'rush_announced', new.announced_by, new.flight_id, new.passenger_id, new.id, new.tag_number, coalesce(new.rush_origin, 'Annonce superviseur'));
  end if;
  if new.kind = 'rush_forward' and new.rush_status <> 'expected' and new.scanned_by is not null and new.scanned_at is not null
     and (old.scanned_by is distinct from new.scanned_by or old.rush_status is distinct from new.rush_status) then
    perform activity_add(new.scanned_at, 'baggage_rush_in', new.scanned_by, new.flight_id, new.passenger_id, new.id, new.tag_number,
      case when new.announced_at is not null then 'Bagage annoncé, arrivé au scan'
           when new.passenger_id is not null then 'Restant connu réacheminé'
           else 'Bagage externe (validation superviseur)' end);
  end if;
  if new.kind = 'rush_forward' and new.rush_status in ('approved','denied') and new.rush_status_at is not null and new.rush_status_by is not null
     and (old.rush_status is distinct from new.rush_status) then
    perform activity_add(new.rush_status_at, case new.rush_status when 'approved' then 'rush_approved' else 'rush_denied' end,
      new.rush_status_by, new.flight_id, new.passenger_id, new.id, new.tag_number, null);
  end if;
  if new.cancelled and new.cancelled_at is not null and (old.cancelled is distinct from new.cancelled) then
    perform activity_add(new.cancelled_at, 'baggage_cancelled', new.cancelled_by, new.flight_id, new.passenger_id, new.id, new.tag_number, new.cancel_reason);
  end if;
  if new.pulled and new.pulled_at is not null and (old.pulled is distinct from new.pulled) then
    perform activity_add(new.pulled_at, 'baggage_pulled', new.pulled_by, new.flight_id, new.passenger_id, new.id, new.tag_number, null);
  end if;
  if new.on_dolly and new.on_dolly_at is not null and (old.on_dolly is distinct from new.on_dolly) then
    perform activity_add(new.on_dolly_at, 'baggage_dolly', new.on_dolly_by, new.flight_id, new.passenger_id, new.id, new.tag_number, null);
  end if;
  if new.soute is not null and new.soute_at is not null and (old.soute is distinct from new.soute) then
    perform activity_add(new.soute_at, 'baggage_soute', new.soute_by, new.flight_id, new.passenger_id, new.id, new.tag_number, new.soute);
  end if;
  if new.in_hold and new.in_hold_at is not null and (old.in_hold is distinct from new.in_hold) then
    perform activity_add(new.in_hold_at, 'baggage_hold', new.in_hold_by, new.flight_id, new.passenger_id, new.id, new.tag_number, null);
  end if;
  if new.rush and new.rush_at is not null and (old.rush is distinct from new.rush) then
    perform activity_add(new.rush_at, 'baggage_rush', new.rush_by, new.flight_id, new.passenger_id, new.id, new.tag_number, null);
  end if;
  if new.arrived and new.arrived_at is not null and (old.arrived is distinct from new.arrived) then
    perform activity_add(new.arrived_at, 'baggage_arrived', new.arrived_by, new.flight_id, new.passenger_id, new.id, new.tag_number, null);
  end if;
  return null;
end $$;
revoke execute on function public.activity_baggage() from public, anon, authenticated;
