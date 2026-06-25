'use client';

import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { savePushSubscription } from '@/app/actions/push-actions';

const DISMISSED_KEY = 'nestora_push_dismissed_until';
const SNOOZE_DAYS = 7;
const SUBSCRIBE_TIMEOUT_MS = 20_000;

const COPY = {
  landlord: {
    heading: 'Stay on top of maintenance',
    body: "Get notified when tenants submit requests or contractors update a job — even when you're not in the app.",
  },
  contractor: {
    heading: 'Never miss a job update',
    body: "Get notified the moment you're assigned a new work order, even when the app is closed.",
  },
  tenant: {
    heading: 'Track your requests in real time',
    body: "We'll let you know when your landlord reviews your request or a contractor is on the way.",
  },
};

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// navigator.serviceWorker.ready requires the SW to *control* the current page,
// which iOS often delays after rapid SW updates. getRegistration() resolves
// immediately with whatever state the SW is in — no controller requirement.
async function swReady(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/');

  // Active SW already exists — use it directly.
  if (existing?.active) return existing;

  // SW is registered but still installing/waiting — wait for it to activate.
  // Do NOT call register() again here; that forces a script re-fetch which
  // fails on spotty connections and shows "sw.js load failed" to the user.
  if (existing) {
    return Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('App not ready. Try closing and reopening Nestora.')), 15_000)
      ),
    ]);
  }

  // No registration at all (truly first time) — register fresh.
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    throw new Error('Could not start background services. Try closing and reopening Nestora.');
  }
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('App not ready. Try closing and reopening Nestora.')), 15_000)
    ),
  ]);
}

function subscribeWithTimeout(reg: ServiceWorkerRegistration): Promise<PushSubscription> {
  return Promise.race([
    reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Push subscription timed out. Check iOS notification settings and try again.')), SUBSCRIBE_TIMEOUT_MS)
    ),
  ]);
}

export function PushPrompt({ role }: { role: 'landlord' | 'contractor' | 'tenant' }) {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    // If permission already granted, silently ensure a subscription exists in the DB.
    if (Notification.permission === 'granted') {
      swReady().then(async (reg) => {
        try {
          let sub = await reg.pushManager.getSubscription();
          if (!sub) {
            sub = await subscribeWithTimeout(reg);
          }
          const json = sub.toJSON();
          await savePushSubscription({
            endpoint: sub.endpoint,
            p256dh: json.keys!.p256dh,
            auth: json.keys!.auth,
          });
        } catch {
          // Non-fatal — user can re-enable via settings
        }
      }).catch(() => {});
      return;
    }

    if (Notification.permission === 'denied') return;

    const dismissedUntil = localStorage.getItem(DISMISSED_KEY);
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) return;

    const t = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    const until = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISSED_KEY, String(until));
    setShow(false);
  };

  const enable = async () => {
    setError('');
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setShow(false); return; }

      const reg = await swReady();

      // Clear any stale/broken subscription before creating a fresh one.
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const subscription = await subscribeWithTimeout(reg);
      const json = subscription.toJSON();
      await savePushSubscription({
        endpoint: subscription.endpoint,
        p256dh: json.keys!.p256dh,
        auth: json.keys!.auth,
      });

      setShow(false);
    } catch (err) {
      console.error('[PushPrompt] subscribe failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to enable notifications. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  const { heading, body } = COPY[role];

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-teal-100 bg-teal-50 p-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-700 text-white">
        <Bell className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">{heading}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{body}</p>
        {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={enable}
            disabled={loading}
            className="rounded-lg bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-60"
          >
            {loading ? 'Enabling…' : 'Enable notifications'}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-gray-700"
          >
            Not now
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 text-gray-400 transition-colors hover:text-gray-600"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
