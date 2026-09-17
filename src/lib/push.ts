/**
 * Notifications push du portail (Web Push).
 *
 * Le navigateur s'abonne auprès de son service de push avec la clé publique
 * VAPID (lue en base via la RPC `push_vapid_public_key`, aucune variable
 * d'environnement à déployer), puis enregistre l'abonnement dans
 * `push_subscriptions`. La fonction edge `push-fraud-alert` s'en sert pour
 * prévenir les superviseurs du périmètre à chaque alerte fraude.
 *
 * Tout est côté client : ces fonctions ne s'appellent que dans un composant.
 */

import { createClient } from '@/supabase/client';

export type PushState =
  | 'unsupported' // navigateur sans Push API, ou page hors HTTPS
  | 'denied' // permission refusée dans le navigateur, à rétablir dans ses réglages
  | 'off' // possible mais pas activé sur cet appareil
  | 'on'; // abonnement actif sur cet appareil

const SW_PATH = '/sw.js';

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_PATH);
}

/** État courant sur cet appareil, sans rien demander à l'utilisateur. */
export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (!reg) return 'off';
  const sub = await reg.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

function base64UrlToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Active les notifications sur cet appareil : permission, abonnement,
 * enregistrement en base. Lève une erreur lisible en cas de refus.
 */
export async function enablePush(userId: string): Promise<void> {
  if (!pushSupported()) throw new Error('Ce navigateur ne prend pas en charge les notifications.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permission refusée. Autorisez les notifications pour ce site dans le navigateur.');
  }

  const supabase = createClient();
  const { data: publicKey, error: keyError } = await supabase.rpc('push_vapid_public_key');
  if (keyError || !publicKey) throw new Error('Clé de notification indisponible. Réessayez plus tard.');

  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(publicKey as string),
    }));

  const json = sub.toJSON();
  const keys = json.keys ?? {};
  if (!json.endpoint || !keys.p256dh || !keys.auth) throw new Error('Abonnement incomplet renvoyé par le navigateur.');

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: navigator.userAgent.slice(0, 200),
    },
    { onConflict: 'endpoint' },
  );
  if (error) throw new Error(error.message);
}

/** Désactive les notifications sur cet appareil et oublie l'abonnement en base. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await createClient().from('push_subscriptions').delete().eq('endpoint', endpoint);
}
