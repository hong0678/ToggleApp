import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Redirect, Stack, useLocalSearchParams, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AndroidBackHandler } from '@/components/android-back-handler';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

function buildQueryString(params: Record<string, string | string[] | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === 'string') {
      searchParams.set(key, value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, item));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const params = useLocalSearchParams() as Record<string, string | string[] | undefined>;
  const lightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#f7f8fa',
    },
  };

  if (pathname?.startsWith('/--/')) {
    const normalizedPath = pathname.replace(/^\/--/, '');
    return <Redirect href={`${normalizedPath}${buildQueryString(params)}` as never} />;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : lightTheme}>
        <AndroidBackHandler />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="dark" backgroundColor="#f7f8fa" translucent={false} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
