import { useCallback } from 'react';
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { type Href, useRouter } from 'expo-router';

export function useSafeBack(fallbackRoute?: Href) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const router = useRouter();

  return useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    if (fallbackRoute) {
      router.replace(fallbackRoute);
    }
  }, [fallbackRoute, navigation, router]);
}
