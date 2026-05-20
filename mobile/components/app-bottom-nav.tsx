import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';

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

  return (
    <View style={styles.bottomTabBar}>
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
            <Ionicons name={item.icon} size={24} color={isActive ? '#0ea5a4' : '#8f9bb3'} />
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
    height: 78,
    backgroundColor: '#fff',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#eceef3',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 12 : 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    color: '#8f9bb3',
    fontSize: 11,
    marginTop: 4,
  },
  tabTextActive: {
    color: '#0ea5a4',
    fontWeight: 'bold',
  },
});
