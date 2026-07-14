import { useEffect, useState } from 'react';
import { delay } from '@/shared/utils';

/**
 * App bootstrap sequence run behind the splash screen.
 * Later sprints extend this with session restore, remote config,
 * and localization loading.
 */
export const useAppBootstrap = (): { isReady: boolean } => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async (): Promise<void> => {
      await delay(1200); // minimum brand splash duration
      if (!cancelled) setIsReady(true);
    };
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  return { isReady };
};
