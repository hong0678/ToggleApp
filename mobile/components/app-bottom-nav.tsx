import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomTabBarStyle } from './screen-layout';

type TabKey = 'home' | 'map' | 'list' | 'saved' | 'my';

type AppBottomNavProps = {
  activeTab: TabKey;
};

const NAV_ITEMS: {
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: Href;
}[] = [
    { key: 'home', label: '홈', icon: 'home', route: '/' },
    { key: 'map', label: '지도', icon: 'location-outline', route: '/map' },
    { key: 'list', label: '마이지도', icon: 'map-outline', route: '/list' },
    { key: 'saved', label: '저장', icon: 'heart-outline', route: '/saved' },
    { key: 'my', label: '마이', icon: 'person-outline', route: '/my' },
  ];

export function AppBottomNav({ activeTab }: AppBottomNavProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bottomTabBar,
        getBottomTabBarStyle(insets),
      ]}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.key === activeTab;

        return (
          <TouchableOpacity
            key={item.key}
            style={styles.tabItem}
            onPress={() => {
              if (isActive) {
                return;
              }

              router.navigate(item.route);
            }}
            activeOpacity={0.85}
          >
            <Ionicons name={item.icon} size={24} color={isActive ? '#18a5a5' : '#8b95a1'} />
            <Text style={[styles.tabText, isActive ? styles.tabTextActive : null]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f7f8fa',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eceef3',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    color: '#8b95a1',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  tabTextActive: {
    color: '#18a5a5',
    fontWeight: '700',
  },
});
