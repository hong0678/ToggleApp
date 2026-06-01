import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Share,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

import { MiniKakaoMapPreview, type MiniKakaoMapPlace } from '@/components/mini-kakao-map-preview';
import { myMapApi, publicInstitutionsApi, publicMapsApi, storesApi, tokenStore, type MapLikeResponse, type PublicInstitutionLookupItemResponse, type StoreLookupItemResponse, type UserPublicMapResponse } from '@/services/api';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

const resolveAssetUrl = (value?: string | null) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_BASE_URL}${value.startsWith('/') ? value : `/${value}`}`;
};

function formatCount(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0';
  return value.toLocaleString('ko-KR');
}

function IncludedStoreCard({
  store,
  onAdd,
}: {
  store: StoreLookupItemResponse;
  onAdd: () => void;
}) {
  const status = store.liveBusinessStatus ?? store.businessStatus ?? store.operationalState ?? '상태 없음';

  return (
    <View style={styles.placeCard}>
      <View style={styles.placeHeader}>
        <View style={styles.placeThumb}>
          {store.imageUrls[0] ? (
            <Image source={{ uri: resolveAssetUrl(store.imageUrls[0]) ?? undefined }} style={styles.placeThumbImage} />
          ) : (
            <Ionicons name="storefront-outline" size={20} color="#18a5a5" />
          )}
        </View>
        <View style={styles.placeTextWrap}>
          <Text style={styles.placeName}>{store.name}</Text>
          <Text style={styles.placeAddress} numberOfLines={2}>
            {store.roadAddress ?? store.address ?? store.jibunAddress ?? '주소 정보 없음'}
          </Text>
          <Text style={styles.placeMeta}>{status}</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={onAdd} activeOpacity={0.9}>
          <Text style={styles.addButtonText}>저장</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function IncludedPublicCard({
  publicInstitution,
  onAdd,
}: {
  publicInstitution: PublicInstitutionLookupItemResponse;
  onAdd: () => void;
}) {
  return (
    <View style={styles.placeCard}>
      <View style={styles.placeHeader}>
        <View style={[styles.placeThumb, styles.publicThumb]}>
          <Ionicons name="information-circle-outline" size={20} color="#18a5a5" />
        </View>
        <View style={styles.placeTextWrap}>
          <Text style={styles.placeName}>{publicInstitution.name ?? '공공 장소'}</Text>
          <Text style={styles.placeAddress} numberOfLines={2}>
            {publicInstitution.address ?? '주소 정보 없음'}
          </Text>
          <Text style={styles.placeMeta}>
            {publicInstitution.congestionLevel ?? '혼잡도 정보 없음'}
            {publicInstitution.operatingHours ? ` · ${publicInstitution.operatingHours}` : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={onAdd} activeOpacity={0.9}>
          <Text style={styles.addButtonText}>저장</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function PublicMapDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mapId?: string | string[];
    uuid?: string | string[];
    title?: string | string[];
    nickname?: string | string[];
  }>();

  const mapIdParam = Array.isArray(params.mapId) ? params.mapId[0] : params.mapId;
  const uuidParam = Array.isArray(params.uuid) ? params.uuid[0] : params.uuid;
  const titleParam = Array.isArray(params.title) ? params.title[0] : params.title;
  const nicknameParam = Array.isArray(params.nickname) ? params.nickname[0] : params.nickname;

  const mapId = mapIdParam ? Number(mapIdParam) : null;
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [detail, setDetail] = useState<UserPublicMapResponse | null>(null);
  const [stores, setStores] = useState<StoreLookupItemResponse[]>([]);
  const [publics, setPublics] = useState<PublicInstitutionLookupItemResponse[]>([]);
  const [likeState, setLikeState] = useState<MapLikeResponse | null>(null);
  const [isTogglingLike, setIsTogglingLike] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);

  const title = titleParam?.trim() || detail?.title || '공개 지도';
  const nickname = nicknameParam?.trim() || detail?.nickname || '작성자';
  const coverImage = resolveAssetUrl(detail?.profileImageUrl ?? null);
  const publicMapUuid = detail?.publicMapUuid || uuidParam || '';

  const load = useCallback(async () => {
    if (!uuidParam) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const token = await tokenStore.getAccessToken();
      setIsLoggedIn(Boolean(token));

      const mapDetail = await publicMapsApi.get(uuidParam);
      setDetail(mapDetail);

      const [storeResponse, publicResponse, likesResponse] = await Promise.all([
        mapDetail.stores.length > 0 ? storesApi.listByIds(mapDetail.stores) : Promise.resolve({ stores: [] } as { stores: StoreLookupItemResponse[] }),
        mapDetail.publics.length > 0 ? publicInstitutionsApi.getByIds(mapDetail.publics) : Promise.resolve({ institutions: [] } as { institutions: PublicInstitutionLookupItemResponse[] }),
        mapId ? publicMapsApi.getLikes(mapId) : Promise.resolve(null),
      ]);

      setStores(storeResponse.stores ?? []);
      setPublics(publicResponse.institutions ?? []);
      setLikeState(likesResponse);
    } catch (error) {
      Alert.alert('공개 지도', error instanceof Error ? error.message : '공개 지도를 불러오지 못했어요.');
      router.back();
    } finally {
      setIsLoading(false);
    }
  }, [mapId, router, uuidParam]);

  useEffect(() => {
    void load();
  }, [load]);

  const likeCount = likeState?.likeCount ?? 0;
  const likedByMe = likeState?.likedByMe ?? false;
  const placeCount = stores.length + publics.length;
  const previewPlaces: MiniKakaoMapPlace[] = [
    ...stores.map((store) => ({
      id: `store-${store.storeId}`,
      name: store.name,
      latitude: store.latitude,
      longitude: store.longitude,
    })),
    ...publics.map((item) => ({
      id: `public-${item.id}`,
      name: item.name ?? '공공 장소',
      latitude: item.latitude,
      longitude: item.longitude,
    })),
  ];

  const toggleLike = useCallback(async () => {
    if (!mapId) return;
    const token = await tokenStore.getAccessToken();
    if (!token) {
      Alert.alert('로그인 필요', '공개 지도 좋아요는 로그인 후 사용할 수 있어요.');
      router.replace('/views/user_login');
      return;
    }

    try {
      setIsTogglingLike(true);
      const nextLikeState = likedByMe ? await publicMapsApi.unlike(mapId) : await publicMapsApi.like(mapId);
      setLikeState(nextLikeState);
    } catch (error) {
      Alert.alert('좋아요', error instanceof Error ? error.message : '좋아요 처리에 실패했어요.');
    } finally {
      setIsTogglingLike(false);
    }
  }, [likedByMe, mapId, router]);

  const saveAllPlaces = useCallback(async () => {
    const token = await tokenStore.getAccessToken();
    if (!token) {
      Alert.alert('로그인 필요', '내 지도에 저장하려면 먼저 로그인해주세요.');
      router.replace('/views/user_login');
      return;
    }

    try {
      setIsSavingAll(true);
      const storeResults = await Promise.allSettled(stores.map((store) => myMapApi.addStore(store.storeId)));
      const publicResults = await Promise.allSettled(publics.map((publicInstitution) => myMapApi.addPublicInstitution(publicInstitution.id)));
      const successCount = [...storeResults, ...publicResults].filter((result) => result.status === 'fulfilled').length;
      Alert.alert('저장 완료', `총 ${successCount}개의 장소를 내 지도에 담았어요.`);
    } catch (error) {
      Alert.alert('저장 실패', error instanceof Error ? error.message : '장소를 내 지도에 저장하지 못했어요.');
    } finally {
      setIsSavingAll(false);
    }
  }, [publics, router, stores]);

  const shareMap = useCallback(async () => {
    if (!publicMapUuid) {
      Alert.alert('공유 실패', '공유할 공개 지도 링크를 만들지 못했어요.');
      return;
    }

    const shareUrl = Linking.createURL('/views/public_map_detail', {
      queryParams: {
        uuid: publicMapUuid,
        title,
        nickname,
      },
    });

    try {
      await Share.share(
        Platform.OS === 'ios'
          ? {
              title: `${title} - ${nickname}님의 공개 지도`,
              message: `${title} - ${nickname}님의 공개 지도`,
              url: shareUrl,
            }
          : {
              title: `${title} - ${nickname}님의 공개 지도`,
              message: `${title} - ${nickname}님의 공개 지도\n${shareUrl}`,
            }
      );
    } catch {
      // ignore
    }
  }, [nickname, publicMapUuid, title]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#18a5a5" />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.9}>
                <Ionicons name="chevron-back" size={24} color="#f9fafb" />
              </TouchableOpacity>
              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.headerActionButton} onPress={toggleLike} activeOpacity={0.9}>
                  <Ionicons name={likedByMe ? 'thumbs-up' : 'thumbs-up-outline'} size={18} color="#18a5a5" />
                  <Text style={styles.headerActionText}>{formatCount(likeCount)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerActionButton} onPress={shareMap} activeOpacity={0.9}>
                  <Ionicons name="share-social-outline" size={18} color="#18a5a5" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.heroCard}>
              {coverImage ? <Image source={{ uri: coverImage }} style={styles.heroImage} /> : <View style={styles.heroImageFallback} />}
              <View style={styles.heroOverlay} />
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>공개 지도</Text>
              </View>
              <View style={styles.heroBody}>
                <Text style={styles.heroTitle}>{title}</Text>
                <Text style={styles.heroNickname}>by {nickname}</Text>
                {detail?.description ? <Text style={styles.heroDescription}>{detail.description}</Text> : null}
                <View style={styles.heroMetaRow}>
                  <View style={styles.heroMetaPill}>
                    <Ionicons name="map-outline" size={14} color="#18a5a5" />
                    <Text style={styles.heroMetaText}>장소 {placeCount}개</Text>
                  </View>
                  <View style={styles.heroMetaPill}>
                    <Ionicons name="thumbs-up" size={14} color="#18a5a5" />
                    <Text style={styles.heroMetaText}>따봉 {formatCount(likeCount)}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.mapPreviewSection}>
              <MiniKakaoMapPreview places={previewPlaces} />
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.primaryAction} onPress={toggleLike} activeOpacity={0.9} disabled={isTogglingLike}>
                {isTogglingLike ? <ActivityIndicator color="#f9fafb" /> : <Ionicons name={likedByMe ? 'thumbs-up' : 'thumbs-up-outline'} size={16} color="#f9fafb" />}
                <Text style={styles.primaryActionText}>{likedByMe ? '따봉 취소' : '따봉'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryAction} onPress={saveAllPlaces} activeOpacity={0.9} disabled={isSavingAll}>
                {isSavingAll ? <ActivityIndicator color="#18a5a5" /> : <Ionicons name="bookmark-outline" size={16} color="#18a5a5" />}
                <Text style={styles.secondaryActionText}>내 지도에 저장</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>포함된 장소</Text>
              <Text style={styles.sectionCount}>{placeCount}개</Text>
            </View>

            {stores.length > 0 ? (
              <View style={styles.sectionList}>
                {stores.map((store) => (
                  <IncludedStoreCard key={store.storeId} store={store} onAdd={async () => myMapApi.addStore(store.storeId)} />
                ))}
              </View>
            ) : null}

            {publics.length > 0 ? (
              <View style={styles.sectionList}>
                {publics.map((publicInstitution) => (
                  <IncludedPublicCard
                    key={publicInstitution.id}
                    publicInstitution={publicInstitution}
                    onAdd={async () => myMapApi.addPublicInstitution(publicInstitution.id)}
                  />
                ))}
              </View>
            ) : null}

            {!stores.length && !publics.length ? (
              <View style={styles.emptyState}>
                <Ionicons name="map-outline" size={40} color="#cbd5e1" />
                <Text style={styles.emptyTitle}>포함된 장소가 없어요</Text>
                <Text style={styles.emptyText}>이 공개 지도에는 아직 저장된 장소가 없습니다.</Text>
              </View>
            ) : null}

            {!isLoggedIn ? (
              <View style={styles.loginHintCard}>
                <Ionicons name="lock-closed-outline" size={18} color="#18a5a5" />
                <Text style={styles.loginHintText}>로그인하면 좋아요와 내 지도 저장을 사용할 수 있어요.</Text>
              </View>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 18,
    paddingBottom: 34,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionButton: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerActionText: {
    color: '#191f28',
    fontSize: 12,
    fontWeight: '900',
  },
  heroCard: {
    minHeight: 360,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    marginBottom: 16,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroImageFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#dff6f5',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  heroBadge: {
    position: 'absolute',
    left: 14,
    top: 14,
    backgroundColor: '#18a5a5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroBadgeText: {
    color: '#f9fafb',
    fontSize: 11,
    fontWeight: '900',
  },
  heroBody: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 20,
    padding: 14,
    backgroundColor: 'rgba(15,23,42,0.42)',
  },
  heroTitle: {
    color: '#f9fafb',
    fontSize: 24,
    fontWeight: '900',
  },
  heroNickname: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    fontWeight: '800',
  },
  heroDescription: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    lineHeight: 18,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  heroMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroMetaText: {
    color: '#191f28',
    fontSize: 11,
    fontWeight: '900',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  mapPreviewSection: {
    marginBottom: 16,
  },
  primaryAction: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#18a5a5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionText: {
    color: '#f9fafb',
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryAction: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryActionText: {
    color: '#18a5a5',
    fontSize: 13,
    fontWeight: '900',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#191f28',
    fontSize: 18,
    fontWeight: '900',
  },
  sectionCount: {
    color: '#6b7684',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionList: {
    gap: 10,
    marginBottom: 16,
  },
  placeCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 12,
  },
  placeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  placeThumb: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  publicThumb: {
    backgroundColor: '#efe8ff',
  },
  placeThumbImage: {
    width: '100%',
    height: '100%',
  },
  placeTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  placeName: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '900',
  },
  placeAddress: {
    marginTop: 4,
    color: '#6b7684',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  placeMeta: {
    marginTop: 6,
    color: '#18a5a5',
    fontSize: 11,
    fontWeight: '800',
  },
  addButton: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#18a5a5',
    fontSize: 11,
    fontWeight: '900',
  },
  loginHintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#edf8f8',
    borderWidth: 1,
    borderColor: '#c6f0ee',
  },
  loginHintText: {
    flex: 1,
    color: '#191f28',
    fontSize: 12,
    fontWeight: '700',
  },
  publicSortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  publicSortChip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  publicSortChipActive: {
    backgroundColor: '#18a5a5',
    borderColor: '#18a5a5',
  },
  publicSortText: {
    color: '#6b7684',
    fontSize: 12,
    fontWeight: '900',
  },
  publicSortTextActive: {
    color: '#f9fafb',
  },
  publicTotalText: {
    marginLeft: 'auto',
    color: '#6b7684',
    fontSize: 12,
    fontWeight: '700',
  },
  publicErrorText: {
    marginBottom: 10,
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  publicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  publicGridCard: {
    width: '48.5%',
    borderRadius: 14,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    overflow: 'hidden',
    paddingBottom: 10,
  },
  publicGridImageWrap: {
    height: 136,
    backgroundColor: '#edf8f8',
    position: 'relative',
  },
  publicGridImage: {
    width: '100%',
    height: '100%',
  },
  publicGridFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#edf8f8',
  },
  publicGridBadge: {
    position: 'absolute',
    left: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.48)',
  },
  publicGridBadgeText: {
    color: '#f9fafb',
    fontSize: 11,
    fontWeight: '900',
  },
  publicGridTitle: {
    marginTop: 10,
    paddingHorizontal: 10,
    color: '#191f28',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
  },
  publicGridAuthor: {
    marginTop: 4,
    paddingHorizontal: 10,
    color: '#18a5a5',
    fontSize: 11,
    fontWeight: '800',
  },
  publicGridDescription: {
    marginTop: 6,
    paddingHorizontal: 10,
    color: '#6b7684',
    fontSize: 11,
    lineHeight: 15,
  },
  emptyState: {
    minHeight: 190,
    borderRadius: 16,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  emptyTitle: {
    marginTop: 10,
    color: '#191f28',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 8,
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
  },
});
