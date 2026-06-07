import React, { useEffect, useRef, useState } from 'react';
import { Modal, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type FullscreenImageViewerProps = {
  visible: boolean;
  uri: string | null;
  uris?: string[];
  initialIndex?: number;
  onClose: () => void;
  title?: string;
};

export function FullscreenImageViewer({ visible, uri, uris, initialIndex = 0, onClose, title }: FullscreenImageViewerProps) {
  const scrollRef = useRef<ScrollView | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const imageUris = uris && uris.length > 0 ? uris : uri ? [uri] : [];
  const clampedInitialIndex = Math.max(0, Math.min(initialIndex, Math.max(imageUris.length - 1, 0)));
  const imageFrameWidth = Math.max(windowWidth - 64, 0);

  useEffect(() => {
    if (!visible) return;

    setActiveIndex(clampedInitialIndex);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: imageFrameWidth * clampedInitialIndex, animated: false });
    });
  }, [clampedInitialIndex, imageFrameWidth, visible]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.closeArea} activeOpacity={1} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {title ?? '사진 보기'}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.85}>
              <Ionicons name="close" size={20} color="#6b7684" />
            </TouchableOpacity>
          </View>
          <View style={styles.imageFrame}>
            {imageUris.length > 0 ? (
              <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                onMomentumScrollEnd={(event) => {
                  const nextIndex = Math.round(event.nativeEvent.contentOffset.x / Math.max(imageFrameWidth, 1));
                  setActiveIndex(Math.max(0, Math.min(nextIndex, imageUris.length - 1)));
                }}
              >
                {imageUris.map((imageUri, index) => (
                  <View key={`${imageUri}-${index}`} style={[styles.imageSlide, { width: imageFrameWidth }]}>
                    <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
                  </View>
                ))}
              </ScrollView>
            ) : null}
            {imageUris.length > 1 ? (
              <View style={styles.counterBadge}>
                <Text style={styles.counterText}>
                  {activeIndex + 1} / {imageUris.length}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    padding: 18,
  },
  closeArea: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    borderRadius: 22,
    backgroundColor: '#f9fafb',
    padding: 14,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  title: {
    flex: 1,
    color: '#191f28',
    fontSize: 16,
    fontWeight: '900',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eef1f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFrame: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 18,
    overflow: 'hidden',
  },
  imageSlide: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  counterBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(25, 31, 40, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  counterText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});
