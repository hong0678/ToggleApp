import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type PageHeroProps = {
  title: string;
  subtitle: string;
  titleAccent?: string;
  rightIcon: keyof typeof Ionicons.glyphMap;
  rightIconColor?: string;
  rightIconBackground?: string;
  onRightPress?: () => void;
};

export function PageHero({
  title,
  subtitle,
  titleAccent,
  rightIcon,
  rightIconColor = '#18a5a5',
  rightIconBackground = '#edf8f8',
  onRightPress,
}: PageHeroProps) {
  const titleNode = titleAccent ? (
    <Text style={styles.title}>
      <Text style={styles.titleAccent}>{titleAccent}</Text>
      {title.replace(titleAccent, '')}
    </Text>
  ) : (
    <Text style={styles.title}>{title}</Text>
  );

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.brand}>
          <Image source={require('@/assets/images/mainLogo.png')} style={styles.logo} />
          <View style={styles.brandText}>
            <Text style={styles.brandTitle}>Toggle</Text>
            <Text style={styles.brandSubtitle}>좋아한 장소를 한곳에 모아봐요</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.actionCircle, { backgroundColor: rightIconBackground }]}
          onPress={onRightPress}
          activeOpacity={0.85}
        >
          <Ionicons name={rightIcon} size={20} color={rightIconColor} />
        </TouchableOpacity>
      </View>

      {titleNode}
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    shadowColor: '#191f28',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  logo: {
    width: 34,
    height: 34,
    resizeMode: 'contain',
  },
  brandText: {
    flex: 1,
    minWidth: 0,
  },
  brandTitle: {
    color: '#18a5a5',
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 22,
  },
  brandSubtitle: {
    color: '#6b7684',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  actionCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 14,
    color: '#191f28',
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 30,
  },
  titleAccent: {
    color: '#18a5a5',
  },
  subtitle: {
    marginTop: 7,
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
});
