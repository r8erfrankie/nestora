'use client';

import { useState, useRef } from 'react';
import { Bell, Wrench, MessageSquare, Activity, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { type NotificationPrefs } from '@/lib/notification-types';
import { saveNotificationPreferences } from './notification-actions';
import { savePushSubscription, removePushSubscription } from '@/app/actions/push-actions';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type PrefKey = keyof NotificationPrefs;

const SUB_PREFS: { key: Exclude<PrefKey, 'push_enabled'>; label: string; description: string; icon: React.ReactNode }[] = [
  {
    key: 'work_updates',
    label: 'Work order updates',
    description: 'New assignments, photos, and notes on your work orders.',
    icon: <Wrench className="size-4" />,
  },
  {
    key: 'new_messages',
    label: 'New messages',
    description: 'Comments and messages added to your requests or orders.',
    icon: <MessageSquare className="size-4" />,
  },
  {
    key: 'status_changes',
    label: 'Status changes',
    description: 'When a request is marked complete, a quote is received, or an inspection is scheduled.',
    icon: <Activity className="size-4" />,
  },
  {
    key: 'due_date_reminders',
    label: 'Due date reminders',
    description: 'Upcoming due dates for open work orders and maintenance requests.',
    icon: <Clock className="size-4" />,
  },
];

interface Props {
  initialPrefs: NotificationPrefs;
}

export function NotificationPreferencesSection({ initialPrefs }: Props) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initialPrefs);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = async (key: PrefKey, value: boolean) => {
    // When the master push toggle is turned ON, trigger the browser permission + subscription flow.
    if (key === 'push_enabled' && value) {
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        toast.error('Push notifications are not supported on this browser.');
        return;
      }
      if (Notification.permission === 'denied') {
        toast.error('Notifications are blocked. Please enable them in your browser settings.');
        return;
      }
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          toast.error('Notification permission was not granted.');
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(
              process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
            ),
          });
        }
        const json = sub.toJSON();
        await savePushSubscription({ endpoint: sub.endpoint, p256dh: json.keys!.p256dh, auth: json.keys!.auth });
        toast.success('Push notifications enabled.');
      } catch (err) {
        console.error('[NotificationPrefs] subscribe failed:', err);
        toast.error('Failed to enable push notifications.');
        return;
      }
    }

    // When the master push toggle is turned OFF, remove the subscription.
    if (key === 'push_enabled' && !value) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await removePushSubscription(sub.endpoint);
        }
        toast.success('Push notifications disabled.');
      } catch (err) {
        console.error('[NotificationPrefs] unsubscribe failed:', err);
      }
    }

    const next = { ...prefs, [key]: value };
    setPrefs(next);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveNotificationPreferences(next);
        if (key !== 'push_enabled') toast.success('Notification preferences saved.');
      } catch {
        toast.error('Failed to save preferences. Please try again.');
        setPrefs((prev) => ({ ...prev, [key]: !value }));
      }
    }, 600);
  };

  const subDisabled = !prefs.push_enabled;

  return (
    <>
      {/* Section header */}
      <div className="py-3">
        <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-widest">
          Notifications
        </p>
      </div>

      {/* Master push toggle */}
      <div className="flex items-center justify-between gap-4 py-4">
        <div className="flex items-start gap-3">
          <Bell className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <div>
            <p className="text-sm font-medium">Push notifications</p>
            <p className="text-muted-foreground text-xs">
              Receive push alerts on this device.
            </p>
          </div>
        </div>
        <Switch
          checked={prefs.push_enabled}
          onCheckedChange={(v) => handleChange('push_enabled', v)}
        />
      </div>

      {/* Sub-toggles */}
      {SUB_PREFS.map(({ key, label, description, icon }) => (
        <div
          key={key}
          className={`flex items-center justify-between gap-4 py-4 pl-7 transition-opacity ${subDisabled ? 'opacity-40' : ''}`}
        >
          <div className="flex items-start gap-3">
            <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
            <div>
              <p className="text-sm">{label}</p>
              <p className="text-muted-foreground text-xs">{description}</p>
            </div>
          </div>
          <Switch
            checked={prefs[key]}
            onCheckedChange={(v) => handleChange(key, v)}
            disabled={subDisabled}
          />
        </div>
      ))}
    </>
  );
}
