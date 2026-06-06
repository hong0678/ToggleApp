import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';

const AUTH_FALLBACKS: Record<string, Href> = {
  '/views/user_login': '/',
  '/views/owner_login': '/',
  '/views/user_signup': '/views/user_login',
  '/views/owner_signup': '/views/owner_login',
  '/views/search_nickname': '/',
  '/views/store_detail': '/saved',
  '/views/store_reviews': '/saved',
  '/views/my_map': '/my',
  '/views/owner_register_status': '/views/owner_dashboard',
  '/views/owner_store_register': '/views/owner_dashboard',
  '/views/owner_hours_manage': '/views/owner_dashboard',
  '/views/owner_status_manage': '/views/owner_dashboard',
  '/views/owner_menu_manage': '/views/owner_dashboard',
  '/views/owner_photos_manage': '/views/owner_dashboard',
  '/views/owner_close_request': '/views/owner_dashboard',
  '/views/admin_owner_applications': '/views/user_login',
};

const TAB_FALLBACKS: Record<string, Href> = {
  '/': '/',
  '/map': '/',
  '/list': '/',
  '/saved': '/',
  '/my': '/',
};

export function AndroidBackHandler() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const canGoBack = router.canGoBack();

      if (__DEV__) {
        console.log('[AndroidBackHandler]', pathname, {
          canGoBack,
        });
      }

      if (canGoBack) {
        router.back();
        return true;
      }

      const tabFallback = TAB_FALLBACKS[pathname];
      if (tabFallback) {
        router.replace(tabFallback);
        return true;
      }

      const fallback = AUTH_FALLBACKS[pathname];
      if (fallback) {
        router.replace(fallback);
        return true;
      }

      return false;
    });

    return () => subscription.remove();
  }, [pathname, router]);

  return null;
}
