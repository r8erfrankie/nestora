'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn, timeAgo } from '@/lib/utils';
import { Bell } from 'lucide-react';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export function NotificationsBell({
  userId,
  initialNotifications,
}: {
  userId: string;
  initialNotifications: AppNotification[];
}) {
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifications);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  // Always-current refs so timer callbacks never see stale closures.
  const notificationsRef = useRef(notifications);
  useEffect(() => { notificationsRef.current = notifications; }, [notifications]);

  // Tracks IDs currently being persisted to prevent duplicate DB calls.
  const pendingReadIdsRef = useRef<Set<string>>(new Set());

  // Per-notification hover timers (desktop 400ms).
  const hoverTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Mobile panel-open timer (1.5s).
  const mobileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // ── Core mark-as-read (stable reference — safe to use inside timer callbacks) ──
  const markRead = useCallback(async (ids: string[]) => {
    const toMark = ids.filter((id) => {
      const n = notificationsRef.current.find((x) => x.id === id);
      return n && !n.read && !pendingReadIdsRef.current.has(id);
    });
    if (toMark.length === 0) return;

    toMark.forEach((id) => pendingReadIdsRef.current.add(id));

    // Optimistic: flip read immediately so the unread count and dot update at once.
    setNotifications((prev) =>
      prev.map((n) => (toMark.includes(n.id) ? { ...n, read: true } : n))
    );

    // Persist in background — fire-and-forget, failure is non-fatal.
    try {
      const supabase = createClient();
      await supabase.from('notifications').update({ read: true }).in('id', toMark);
    } catch (err) {
      console.error('[markRead] DB update failed:', err);
    } finally {
      toMark.forEach((id) => pendingReadIdsRef.current.delete(id));
    }
  }, []); // empty deps — reads from refs, setNotifications is stable

  // ── Subscribe to new notifications via Realtime ──
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications((prev) =>
            [payload.new as AppNotification, ...prev].slice(0, 30)
          );
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // ── Close on outside click ──
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // ── Mobile: mark all unread as read 1.5s after the panel opens ──
  useEffect(() => {
    if (!open) {
      // Panel closed — cancel any pending timer.
      if (mobileTimerRef.current !== null) {
        clearTimeout(mobileTimerRef.current);
        mobileTimerRef.current = null;
      }
      return;
    }

    // Only activate on narrow screens (phone/tablet in portrait).
    if (typeof window === 'undefined' || window.innerWidth >= 768) return;

    mobileTimerRef.current = setTimeout(() => {
      const unreadIds = notificationsRef.current
        .filter((n) => !n.read)
        .map((n) => n.id);
      if (unreadIds.length > 0) markRead(unreadIds);
      mobileTimerRef.current = null;
    }, 1500);

    return () => {
      if (mobileTimerRef.current !== null) {
        clearTimeout(mobileTimerRef.current);
        mobileTimerRef.current = null;
      }
    };
  }, [open, markRead]);

  // ── Cleanup all timers on unmount ──
  useEffect(() => {
    return () => {
      hoverTimersRef.current.forEach(clearTimeout);
      if (mobileTimerRef.current !== null) clearTimeout(mobileTimerRef.current);
    };
  }, []);

  // ── Hover handlers for desktop 400ms auto-read ──
  const handleMouseEnter = useCallback((n: AppNotification) => {
    if (n.read || pendingReadIdsRef.current.has(n.id)) return;
    const timer = setTimeout(() => {
      markRead([n.id]);
      hoverTimersRef.current.delete(n.id);
    }, 400);
    hoverTimersRef.current.set(n.id, timer);
  }, [markRead]);

  const handleMouseLeave = useCallback((id: string) => {
    const timer = hoverTimersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      hoverTimersRef.current.delete(id);
    }
  }, []);

  // ── Click: navigate + mark read ──
  const handleClick = (n: AppNotification) => {
    if (!n.read) markRead([n.id]);
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  // ── Mark all read (button) ──
  const markAllRead = () => {
    const ids = notifications.filter((n) => !n.read).map((n) => n.id);
    if (ids.length > 0) markRead(ids);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className={cn(
          'relative flex h-8 w-8 items-center justify-center rounded-md transition-colors',
          'text-muted-foreground hover:bg-accent hover:text-foreground',
          open && 'bg-accent text-foreground'
        )}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed top-14 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-background shadow-xl sm:absolute sm:top-[calc(100%+8px)] sm:right-0">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] divide-y divide-border overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Bell className="h-6 w-6 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  onMouseEnter={() => handleMouseEnter(n)}
                  onMouseLeave={() => handleMouseLeave(n.id)}
                  className={cn(
                    'w-full px-4 py-3.5 text-left transition-colors duration-300 hover:bg-muted/50',
                    !n.read && 'bg-blue-50/60 dark:bg-blue-950/20'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'mt-[7px] h-2 w-2 shrink-0 rounded-full transition-colors duration-300',
                        n.read ? 'bg-transparent' : 'bg-blue-500'
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-snug">{n.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {n.message}
                      </p>
                      <p className="mt-1.5 text-[10px] text-muted-foreground/50">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

        </div>
      )}
    </div>
  );
}
