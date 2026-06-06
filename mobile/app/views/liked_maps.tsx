import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBottomNav } from '@/components/app-bottom-nav';
import { PageHero } from '@/components/page-hero';
import { getTabScreenContentStyle } from '@/components/screen-layout';
import { publicMapsApi, tokenStore, type MapLikeResponse, type PublicMapListItemResponse } from '@/services/api';

type LikedMapItem = PublicMapListItemResponse & {
  likeState: MapLikeResponse;
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

const resolveAssetUrl = (value?: string | null) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_BASE_URL}${value.startsWith('/') ? value : `/${value}`}`;
};

const formatCount = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0';
  return value.toLocaleString('ko-KR');
};

function LoginGatePanel({
  onLogin,
  onSignup,
}: {
  onLogin: () => void;
  onSignup: () => void;
}) {
  return (
    <View style={styles.gateCard}>
      <View style={styles.gateIconWrap}>
        <Ionicons name="lock-closed-outline" size={24} color="#18a5a5" />
      </View>
      <Text style={styles.gateTitle}>로그인이 필요해요</Text>
      <Text style={styles.gateSubtitle}>내가 좋아요한 지도를 보려면 먼저 로그인해주세요.</Text>
      <View style={styles.gateButtons}>
        <TouchableOpacity style={styles.gateSecondaryButton} onPress={onLogin} activeOpacity={0.9}>
          <Text style={styles.gateSecondaryButtonText}>로그인</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.gatePrimaryButton} onPress={onSignup} activeOpacity={0.9}>
          <Text style={styles.gatePrimaryButtonText}>회원가입</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function LikedMapCard({
  item,
  onPress,
  onUnlike,
}: {
  item: LikedMapItem;
  onPress: () => void;
  onUnlike: () => void;
}) {
  const imageUri = resolveAssetUrl(item.profileImageUrl);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
      <View style={styles.cardHeader}>
        <View style={styles.avatarWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="map-outline" size={20} color="#18a5a5" />
          )}
        </View>
        <View style={styles.cardTextWrap}>
          <Text style={styles.nickname}>{item.nickname}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {item.title ?? '제목 없는 지도'}
          </Text>
          <Text style={styles.description} numberOfLines={2}>
            {item.description ?? '설명이 없는 공개 지도예요.'}
          </Text>
        </View>
        <View style={styles.likeBadge}>
          <Ionicons name="heart" size={12} color="#ef4444" />
          <Text style={styles.likeBadgeText}>{formatCount(item.likeCount)}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.footerText}>좋아요한 지도</Text>
        <TouchableOpacity style={styles.unlikeButton} onPress={onUnlike} activeOpacity={0.9}>
          <Ionicons name="heart-dislike-outline" size={16} color="#ef4444" />
          <Text style={styles.unlikeButtonText}>좋아요 취소</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function LikedMapsScreen() {
  const router = useRouter();
  const segments = useSegments();
  const showInternalTabBar = segments[0] !== '(tabs)';
  const insets = useSafeAreaInsets();

  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [likedMaps, setLikedMaps] = useState<LikedMapItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadLikedMaps = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const token = await tokenStore.getAccessToken();
    if (!token) {
      setIsLoggedIn(false);
      setLikedMaps([]);
      setIsLoading(false);
      return;
    }

    setIsLoggedIn(true);

    try {
      const pages = await Promise.all(
        Array.from({ length: 4 }, (_, page) => publicMapsApi.list({ sort: 'likes', page, size: 20 }))
      );

      const candidates = pages.flatMap((page) => page.content);
      const withLikeState = await Promise.all(
        candidates.map(async (item) => {
          const likeState = await publicMapsApi.getLikes(item.mapId).catch(() => ({
            mapId: item.mapId,
            likeCount: item.likeCount,
            likedByMe: false,
          }));

          return {
            ...item,
            likeState,
          };
        })
      );

      const nextLikedMaps = withLikeState
        .filter((item) => item.likeState.likedByMe)
        .sort((left, right) => right.likeState.likeCount - left.likeState.likeCount)
        .slice(0, 20);

      setLikedMaps(nextLikedMaps);
    } catch (loadError) {
      setLikedMaps([]);
      setError(loadError instanceof Error ? loadError.message : '좋아요한 지도를 불러오지 못했어요.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadLikedMaps();
    }, [loadLikedMaps])
  );

  const openMap = useCallback(
    (item: LikedMapItem) => {
      router.push({
        pathname: '/views/public_map_detail',
        params: {
          mapId: String(item.mapId),
          uuid: item.publicMapUuid,
          title: item.title ?? '',
          nickname: item.nickname,
        },
      });
    },
    [router]
  );

  const unlikeMap = useCallback(
    async (item: LikedMapItem) => {
      try {
        await publicMapsApi.unlike(item.mapId);
        setLikedMaps((current) => current.filter((map) => map.mapId !== item.mapId));
      } catch (unlikeError) {
        Alert.alert('좋아요 취소 실패', unlikeError instanceof Error ? unlikeError.message : '좋아요를 취소하지 못했어요.');
      }
    },
    []
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, getTabScreenContentStyle(insets)]}
          >
            {isLoading ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator color="#18a5a5" />
                <Text style={styles.loadingText}>좋아요한 지도를 불러오는 중이에요</Text>
              </View>
            ) : !isLoggedIn ? (
              <LoginGatePanel
                onLogin={() => router.replace('/views/user_login')}
                onSignup={() => router.replace('/views/user_signup')}
              />
            ) : (
              <>
                <PageHero
                  title="내가 좋아요한 지도"
                  subtitle="내가 눌러둔 공개 지도를 한곳에서 확인해요"
                  rightIcon="refresh-outline"
                  rightIconColor="#18a5a5"
                  rightIconBackground="#edf8f8"
                  onRightPress={() => void loadLikedMaps()}
                />

                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{likedMaps.length}</Text>
                  <Text style={styles.summaryLabel}>좋아요한 지도</Text>
                </View>

                {error ? (
                  <View style={styles.errorCard}>
                    <Ionicons name="alert-circle-outline" size={20} color="#ef4444" />
                    <Text style={styles.errorTitle}>목록을 불러오지 못했어요</Text>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                {likedMaps.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="heart-dislike-outline" size={24} color="#18a5a5" />
                    <Text style={styles.emptyTitle}>아직 좋아요한 지도가 없어요</Text>
                    <Text style={styles.emptyText}>공개 지도에서 마음에 드는 지도를 눌러 좋아요해보세요.</Text>
                    <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/list')} activeOpacity={0.9}>
                      <Text style={styles.emptyButtonText}>지도로 이동</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.cardList}>
                    {likedMaps.map((item) => (
                      <LikedMapCard
                        key={item.mapId}
                        item={item}
                        onPress={() => openMap(item)}
                        onUnlike={() => void unlikeMap(item)}
                      />
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>

        {showInternalTabBar ? <AppBottomNav activeTab="my" /> : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f8fb' },
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 18 },
  loadingCard: {
    marginTop: 28,
    minHeight: 180,
    borderRadius: 22,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: '#6b7684', fontSize: 13, fontWeight: '700' },
  gateCard: {
    marginTop: 12,
    borderRadius: 22,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 18,
  },
  gateIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateTitle: { marginTop: 12, color: '#191f28', fontSize: 18, fontWeight: '900' },
  gateSubtitle: { marginTop: 6, color: '#6b7684', fontSize: 13, fontWeight: '700', lineHeight: 18 },
  gateButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  gateSecondaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bfeceb',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateSecondaryButtonText: { color: '#18a5a5', fontSize: 13, fontWeight: '800' },
  gatePrimaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#18a5a5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gatePrimaryButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  summaryCard: {
    marginTop: 16,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 16,
  },
  summaryValue: { color: '#191f28', fontSize: 26, fontWeight: '900' },
  summaryLabel: { marginTop: 4, color: '#6b7684', fontSize: 12, fontWeight: '700' },
  errorCard: {
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: '#fff7f7',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 14,
  },
  errorTitle: { marginTop: 8, color: '#991b1b', fontSize: 14, fontWeight: '900' },
  errorText: { marginTop: 6, color: '#b91c1c', fontSize: 12, fontWeight: '600', lineHeight: 17 },
  emptyCard: {
    marginTop: 16,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 20,
    alignItems: 'center',
  },
  emptyTitle: { marginTop: 12, color: '#191f28', fontSize: 16, fontWeight: '900' },
  emptyText: {
    marginTop: 6,
    color: '#6b7684',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#edf8f8',
  },
  emptyButtonText: { color: '#18a5a5', fontSize: 12, fontWeight: '800' },
  cardList: {
    marginTop: 16,
    gap: 12,
  },
  card: {
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  cardTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  nickname: { color: '#18a5a5', fontSize: 12, fontWeight: '800' },
  title: { marginTop: 2, color: '#191f28', fontSize: 16, fontWeight: '900' },
  description: { marginTop: 6, color: '#6b7684', fontSize: 12, lineHeight: 17 },
  likeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fff1f2',
  },
  likeBadgeText: { color: '#ef4444', fontSize: 12, fontWeight: '800' },
  cardFooter: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerText: { color: '#6b7684', fontSize: 12, fontWeight: '700' },
  unlikeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff7f7',
  },
  unlikeButtonText: { color: '#ef4444', fontSize: 12, fontWeight: '800' },
});
