import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';

import { authApi, tokenStore } from '@/services/api';
import LandingScreen from '../views/landing';
import MainHomeScreen from '../views/main_home';

export default function TabIndexScreen() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isRedirectingAdmin, setIsRedirectingAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    const loadAuthState = async () => {
      const accessToken = await tokenStore.getAccessToken();
      if (!active) return;

      if (!accessToken) {
        setIsLoggedIn(false);
        setIsReady(true);
        return;
      }

      try {
        const me = await authApi.me();
        if (!active) return;

        if (me.role === 'ADMIN') {
          setIsRedirectingAdmin(true);
          setIsReady(true);
          router.replace('/views/admin_owner_applications');
          return;
        }
      } catch {
        // Fall back to the authenticated home if profile lookup fails.
      }

      setIsLoggedIn(Boolean(accessToken));
      setIsReady(true);
    };

    void loadAuthState();

    return () => {
      active = false;
    };
  }, [router]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7fbfc' }}>
        <ActivityIndicator color="#0ea5a4" />
      </View>
    );
  }

  if (isRedirectingAdmin) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7fbfc' }}>
        <ActivityIndicator color="#0ea5a4" />
      </View>
    );
  }

  return isLoggedIn ? <MainHomeScreen /> : <LandingScreen />;
}
