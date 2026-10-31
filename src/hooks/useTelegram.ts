import { useEffect, useState, useCallback } from 'react';

export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

export function useTelegram() {
  const [isReady, setIsReady] = useState(false);
  const [initData, setInitData] = useState<string>('');
  const [tgUser, setTgUser] = useState<TelegramWebAppUser | null>(null);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      try {
        tg.ready();
        tg.expand();
        tg.enableClosingConfirmation?.();
      } catch (err) {
        console.warn('Telegram WebApp initialization error:', err);
      }

      if (tg.initData) {
        setInitData(tg.initData);
        if (tg.initDataUnsafe?.user) {
          setTgUser(tg.initDataUnsafe.user);
        }
      } else {
        // Fallback for desktop/web testing environment outside Telegram iframe
        const mockUser: TelegramWebAppUser = {
          id: 8522783212,
          first_name: 'Kobir',
          last_name: 'Bepari',
          username: 'kobir_xcoin',
          photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          language_code: 'en',
        };
        const mockInitData = new URLSearchParams({
          user: JSON.stringify(mockUser),
          auth_date: Math.floor(Date.now() / 1000).toString(),
          hash: 'dev_preview_hash',
        }).toString();

        setInitData(mockInitData);
        setTgUser(mockUser);
      }
    } else {
      // Browser preview mode
      const mockUser: TelegramWebAppUser = {
        id: 8522783212,
        first_name: 'Kobir',
        last_name: 'Bepari',
        username: 'kobir_xcoin',
        photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        language_code: 'en',
      };
      const mockInitData = new URLSearchParams({
        user: JSON.stringify(mockUser),
        auth_date: Math.floor(Date.now() / 1000).toString(),
        hash: 'dev_preview_hash',
      }).toString();

      setInitData(mockInitData);
      setTgUser(mockUser);
    }

    setIsReady(true);
  }, []);

  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' = 'light') => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (!tg?.HapticFeedback) return;

      if (type === 'light' || type === 'medium' || type === 'heavy') {
        tg.HapticFeedback.impactOccurred(type);
      } else if (type === 'success' || type === 'error' || type === 'warning') {
        tg.HapticFeedback.notificationOccurred(type);
      }
    } catch {
      // Haptics not supported in plain browser, safe to ignore
    }
  }, []);

  return {
    isReady,
    initData,
    tgUser,
    triggerHaptic,
  };
}
