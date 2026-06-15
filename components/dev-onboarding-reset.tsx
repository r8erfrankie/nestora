'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface DevOnboardingResetProps {
  isDevelopment: boolean;
}

export function DevOnboardingReset({ isDevelopment }: DevOnboardingResetProps) {
  const router = useRouter();

  if (!isDevelopment) {
    return null;
  }

  const resetOnboarding = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase
          .from('profiles')
          .update({ onboarded: false })
          .eq('id', user.id);
      }

      document.cookie = 'dev_force_onboarding=true; path=/; max-age=31536000; samesite=lax';

      // Refresh the page so the server component re-evaluates showOnboarding
      router.refresh();
    } catch (err) {
      window.location.reload();
    }
  };

  return (
    <button
      onClick={resetOnboarding}
      className="rounded border border-yellow-400 bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-800 hover:bg-yellow-200 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-300 dark:hover:bg-yellow-900"
      title="Development only: Force the onboarding flow to show again on reload (even if you already have properties)"
    >
      Replay Onboarding
    </button>
  );
}
