import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { MiniKakaoMapPreview, type MiniKakaoMapPlace } from '@/components/mini-kakao-map-preview';

type HomeMapCardProps = {
  chipLabel: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
  onPress: () => void;
  center?: {
    latitude: number;
    longitude: number;
  } | null;
  places: MiniKakaoMapPlace[];
  showCenterMarker?: boolean;
  lockToCenter?: boolean;
  height?: number;
};

export function HomeMapCard({
  chipLabel,
  title,
  subtitle,
  buttonLabel,
  onPress,
  center = null,
  places,
  showCenterMarker = false,
  lockToCenter = false,
  height = 250,
}: HomeMapCardProps) {
  return (
    <View style={styles.mapCard}>
      <View style={styles.mapCardAccent} pointerEvents="none" />
      <View style={styles.mapChip}>
        <Ionicons name="radio-button-on-outline" size={14} color="#18a5a5" />
        <Text style={styles.mapChipText}>{chipLabel}</Text>
      </View>
      <View style={styles.mapPreview}>
        <MiniKakaoMapPreview
          height={height}
          center={center}
          places={places}
          showCenterMarker={showCenterMarker}
          lockToCenter={lockToCenter}
        />
      </View>
      <View style={styles.mapFooter}>
        <View>
          <Text style={styles.mapFooterTitle}>{title}</Text>
          <Text style={styles.mapFooterSub}>{subtitle}</Text>
        </View>
        <TouchableOpacity style={styles.mapFooterButton} onPress={onPress} activeOpacity={0.9}>
          <Text style={styles.mapFooterButtonText}>{buttonLabel}</Text>
          <Ionicons name="chevron-forward" size={16} color="#18a5a5" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapCard: {
    marginTop: 18,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 0,
    borderColor: 'transparent',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  mapCardAccent: {
    position: 'absolute',
    right: -60,
    top: -48,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'transparent',
  },
  mapChip: {
    position: 'absolute',
    left: 14,
    top: 14,
    zIndex: 2,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#8b95a1',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 1,
  },
  mapChipText: {
    fontSize: 12,
    color: '#191f28',
    fontWeight: '800',
  },
  mapPreview: {
    backgroundColor: '#eef3f8',
    position: 'relative',
    overflow: 'hidden',
  },
  mapFooter: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    backgroundColor: '#ffffff',
  },
  mapFooterTitle: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '900',
  },
  mapFooterSub: {
    marginTop: 4,
    color: '#8b95a1',
    fontSize: 11,
    lineHeight: 14,
  },
  mapFooterButton: {
    backgroundColor: '#edf8f8',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  mapFooterButtonText: {
    color: '#18a5a5',
    fontSize: 13,
    fontWeight: '900',
  },
});
