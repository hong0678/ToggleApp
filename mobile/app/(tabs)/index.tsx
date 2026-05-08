import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { tokenStore } from '@/services/api';
import LandingScreen from '../views/landing';
import MainHomeScreen from '../views/main_home';

export default function TabIndexScreen() {
  const [isReady, setIsReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let active = true;

    const loadAuthState = async () => {
      const accessToken = await tokenStore.getAccessToken();
      if (!active) return;

      setIsLoggedIn(Boolean(accessToken));
      setIsReady(true);
    };

    void loadAuthState();

    return () => {
      active = false;
    };
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7fbfc' }}>
        <ActivityIndicator color="#0ea5a4" />
      </View>
    );
  }

  return isLoggedIn ? <MainHomeScreen /> : <LandingScreen />;
}
