import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Modal,
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
import { useSafeBack } from '@/components/use-safe-back';
import { myMapApi, publicInstitutionsApi, publicMapsApi, storesApi, tokenStore, userMapsApi, type MapLikeResponse, type PublicInstitutionLookupItemResponse, type StoreLookupItemResponse, type UserMapSummaryResponse, type UserPublicMapResponse } from '@/services/api';

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

const isConflictError = (error: unknown) => error instanceof Error && 'status' in error && (error as { status?: number }).status === 409;

const buildUniqueSaveCopyTitle = (maps: UserMapSummaryResponse[], baseTitle: string) => {
  const existingTitles = new Set(maps.map((map) => map.title.trim()));
  if (!existingTitles.has(baseTitle)) {
    return baseTitle;
  }

  let suffix = 1;
  while (existingTitles.has(`${baseTitle} ${suffix}`)) {
    suffix += 1;
  }

  return `${baseTitle} ${suffix}`;
};

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
  const goBack = useSafeBack('/saved');
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
  const [isSaveOptionsOpen, setIsSaveOptionsOpen] = useState(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [isLoadingMaps, setIsLoadingMaps] = useState(false);
  const [isCreatingSaveCopy, setIsCreatingSaveCopy] = useState(false);
  const [mapCollections, setMapCollections] = useState<UserMapSummaryResponse[]>([]);

  const title = titleParam?.trim() || detail?.title || '공개 지도';
  const nickname = nicknameParam?.trim() || detail?.nickname || '작성자';
  const coverImage = resolveAssetUrl(detail?.profileImageUrl ?? null);
  const publicMapUuid = detail?.publicMapUuid || uuidParam || '';
  const loginReturnPath = Linking.createURL('/views/public_map_detail', {
    isTripleSlashed: true,
    queryParams: {
    ...(mapId ? { mapId: String(mapId) } : {}),
    ...(uuidParam ? { uuid: uuidParam } : {}),
    ...(titleParam?.trim() ? { title: titleParam.trim() } : {}),
    ...(nicknameParam?.trim() ? { nickname: nicknameParam.trim() } : {}),
    },
  });

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await tokenStore.getAccessToken();
      setIsLoggedIn(Boolean(token));

      if (!token) {
        router.replace({
          pathname: '/views/user_login',
          params: {
            returnTo: loginReturnPath,
          },
        });
        return;
      }

      if (!uuidParam && !mapId) {
        setIsLoading(false);
        return;
      }

      const mapDetail = uuidParam
        ? await publicMapsApi.get(uuidParam)
        : await publicMapsApi.getByMapId(mapId as number);
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
      goBack();
    } finally {
      setIsLoading(false);
    }
  }, [goBack, loginReturnPath, mapId, router, uuidParam]);

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

  const ensureMyMapExists = useCallback(async () => {
    const maps = await userMapsApi.list();
    if (maps.length > 0) {
      return false;
    }

    await userMapsApi.create({
      title: `${title} 저장본`,
      description: `${nickname}님의 공개 지도에서 담은 장소예요.`,
      isPublic: false,
    });
    return true;
  }, [nickname, title]);

  const saveStoreToMyMap = useCallback(async (storeId: number) => {
    await ensureMyMapExists();
    return myMapApi.addStore(storeId);
  }, [ensureMyMapExists]);

  const savePublicInstitutionToMyMap = useCallback(async (publicInstitutionId: number) => {
    await ensureMyMapExists();
    return myMapApi.addPublicInstitution(publicInstitutionId);
  }, [ensureMyMapExists]);

  const createSaveCopy = useCallback(async () => {
    const maps = await userMapsApi.list();
    const nextTitle = buildUniqueSaveCopyTitle(maps, `${title} 저장본`);

    return userMapsApi.create({
      title: nextTitle,
      description: `${nickname}님의 공개 지도에서 복사한 지도예요.`,
      isPublic: false,
    });
  }, [nickname, title]);

  const savePlacesToMap = useCallback(async (mapIdToSave: number) => {
    const storeResults = await Promise.all(
      stores.map(async (store) => {
        try {
          await userMapsApi.addStore(mapIdToSave, store.storeId);
          return 'saved' as const;
        } catch (error) {
          if (isConflictError(error)) {
            return 'exists' as const;
          }
          throw error;
        }
      })
    );

    const publicResults = await Promise.all(
      publics.map(async (publicInstitution) => {
        try {
          await userMapsApi.addPublicInstitution(mapIdToSave, publicInstitution.id);
          return 'saved' as const;
        } catch (error) {
          if (isConflictError(error)) {
            return 'exists' as const;
          }
          throw error;
        }
      })
    );

    return storeResults.length + publicResults.length;
  }, [publics, stores]);

  const loadMyMapsForSave = useCallback(async () => {
    setIsLoadingMaps(true);
    try {
      const maps = await userMapsApi.list();
      setMapCollections(maps);
    } catch (error) {
      Alert.alert('내 지도 목록 실패', error instanceof Error ? error.message : '내 지도 목록을 불러오지 못했어요.');
      setMapCollections([]);
    } finally {
      setIsLoadingMaps(false);
    }
  }, []);

  const openExistingMapPicker = useCallback(() => {
    setIsSaveOptionsOpen(false);
    setIsMapPickerOpen(true);
    void loadMyMapsForSave();
  }, [loadMyMapsForSave]);

  const saveAllPlacesToExistingMap = useCallback(async (map: UserMapSummaryResponse) => {
    try {
      setIsSavingAll(true);
      const mapDetail = await userMapsApi.get(map.mapId);
      const hasAllStores = stores.every((store) => mapDetail.stores.includes(store.storeId));
      const hasAllPublics = publics.every((publicInstitution) => mapDetail.publicInstitutions.includes(publicInstitution.id));

      if (hasAllStores && hasAllPublics) {
        setIsMapPickerOpen(false);
        Alert.alert('이미 저장 완료', '선택한 지도에는 이 공개 지도의 장소가 이미 모두 저장되어 있어요.');
        return;
      }

      const savedCount = await savePlacesToMap(map.mapId);
      setIsMapPickerOpen(false);
      Alert.alert('저장 완료', `선택한 지도에 총 ${savedCount}개의 장소를 담았어요.`);
    } catch (error) {
      Alert.alert('저장 실패', error instanceof Error ? error.message : '장소를 내 지도에 저장하지 못했어요.');
    } finally {
      setIsSavingAll(false);
    }
  }, [savePlacesToMap]);

  const saveAsNewCopy = useCallback(async () => {
    try {
      setIsCreatingSaveCopy(true);
      setIsSaveOptionsOpen(false);
      const createdMap = await createSaveCopy();
      const savedCount = await savePlacesToMap(createdMap.mapId);
      Alert.alert('저장 완료', `새 저장본을 만들고 총 ${savedCount}개의 장소를 담았어요.`);
    } catch (error) {
      Alert.alert('저장 실패', error instanceof Error ? error.message : '새 저장본을 만들지 못했어요.');
    } finally {
      setIsCreatingSaveCopy(false);
    }
  }, [createSaveCopy, savePlacesToMap]);

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

    if (stores.length === 0 && publics.length === 0) {
      Alert.alert('저장할 장소 없음', '이 공개 지도에는 담을 장소가 없어요.');
      return;
    }

    setIsSaveOptionsOpen(true);
  }, [publics, router, stores]);

  const openLargeMap = useCallback(() => {
    router.push({
      pathname: '/views/public_map_large',
      params: {
        publicMapUuid,
        mapId: mapId ? String(mapId) : '',
        mapTitle: title,
        publicMapTitle: title,
        mapNickname: nickname,
        largeView: '1',
      },
    });
  }, [mapId, nickname, publicMapUuid, router, title]);

  const shareMap = useCallback(async () => {
    if (!publicMapUuid) {
      Alert.alert('공유 실패', '공유할 공개 지도 링크를 만들지 못했어요.');
      return;
    }

    const shareUrl = Linking.createURL('/views/public_map_detail', {
      isTripleSlashed: true,
      queryParams: {
        mapId: mapId ? String(mapId) : '',
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
  }, [mapId, nickname, publicMapUuid, title]);

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
              <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.9}>
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

            <TouchableOpacity style={styles.largeMapButton} onPress={openLargeMap} activeOpacity={0.9}>
              <Ionicons name="map-outline" size={18} color="#18a5a5" />
              <Text style={styles.largeMapButtonText}>큰 지도에서 보기</Text>
            </TouchableOpacity>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>포함된 장소</Text>
              <Text style={styles.sectionCount}>{placeCount}개</Text>
            </View>

            {stores.length > 0 ? (
              <View style={styles.sectionList}>
                {stores.map((store) => (
                  <IncludedStoreCard key={store.storeId} store={store} onAdd={() => void saveStoreToMyMap(store.storeId)} />
                ))}
              </View>
            ) : null}

            {publics.length > 0 ? (
              <View style={styles.sectionList}>
                {publics.map((publicInstitution) => (
                  <IncludedPublicCard
                    key={publicInstitution.id}
                    publicInstitution={publicInstitution}
                    onAdd={() => void savePublicInstitutionToMyMap(publicInstitution.id)}
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

      <Modal visible={isSaveOptionsOpen} transparent animationType="fade" onRequestClose={() => setIsSaveOptionsOpen(false)}>
        <View style={styles.optionModalBackdrop}>
          <TouchableOpacity style={styles.optionModalDimmer} activeOpacity={1} onPress={() => setIsSaveOptionsOpen(false)} />
          <View style={styles.optionModalSheet}>
            <View style={styles.optionModalHandle} />
            <Text style={styles.optionModalTitle}>내 지도에 저장</Text>
            <Text style={styles.optionModalSubtitle}>기존 마이 지도에 담거나, 공개 지도를 그대로 복사해 새 저장본으로 만들 수 있어요.</Text>

            <TouchableOpacity style={styles.optionCard} onPress={openExistingMapPicker} activeOpacity={0.9}>
              <View style={styles.optionIconWrap}>
                <Ionicons name="layers-outline" size={20} color="#18a5a5" />
              </View>
              <View style={styles.optionTextWrap}>
                <Text style={styles.optionTitle}>기존 내 지도에 담기</Text>
                <Text style={styles.optionText}>이미 만들어둔 내 지도 중 하나를 골라 넣어요.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#18a5a5" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionCard} onPress={() => void saveAsNewCopy()} activeOpacity={0.9} disabled={isCreatingSaveCopy}>
              <View style={styles.optionIconWrap}>
                {isCreatingSaveCopy ? <ActivityIndicator color="#18a5a5" /> : <Ionicons name="duplicate-outline" size={20} color="#18a5a5" />}
              </View>
              <View style={styles.optionTextWrap}>
                <Text style={styles.optionTitle}>저장본으로 새 마이 지도 만들기</Text>
                <Text style={styles.optionText}>이 공개 지도의 장소를 그대로 복사해 새 지도를 만들어요.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#18a5a5" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isMapPickerOpen} transparent animationType="fade" onRequestClose={() => setIsMapPickerOpen(false)}>
        <View style={styles.optionModalBackdrop}>
          <TouchableOpacity style={styles.optionModalDimmer} activeOpacity={1} onPress={() => setIsMapPickerOpen(false)} />
          <View style={styles.mapPickerSheet}>
            <View style={styles.optionModalHandle} />
            <Text style={styles.optionModalTitle}>어느 내 지도에 담을까요?</Text>
            <Text style={styles.optionModalSubtitle}>기존 내 지도를 선택하면 이 공개 지도의 장소를 그대로 더해요.</Text>

            <ScrollView style={styles.mapPickerScroll} contentContainerStyle={styles.mapPickerScrollContent} showsVerticalScrollIndicator={false}>
              {isLoadingMaps ? (
                <View style={styles.mapPickerEmpty}>
                  <ActivityIndicator color="#18a5a5" />
                  <Text style={styles.mapPickerEmptyText}>내 지도를 불러오는 중이에요</Text>
                </View>
              ) : mapCollections.length > 0 ? (
                mapCollections.map((map) => (
                  <TouchableOpacity key={map.mapId} style={styles.mapPickerRow} activeOpacity={0.9} onPress={() => void saveAllPlacesToExistingMap(map)}>
                    <View style={styles.mapPickerRowIcon}>
                      <Ionicons name="bookmark-outline" size={18} color="#18a5a5" />
                    </View>
                    <View style={styles.mapPickerRowText}>
                      <Text style={styles.mapPickerRowTitle}>{map.title}</Text>
                      <Text style={styles.mapPickerRowSubtitle}>{map.description ?? '설명 없음'}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#18a5a5" />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.mapPickerEmpty}>
                  <Text style={styles.mapPickerEmptyText}>아직 만든 내 지도가 없어요</Text>
                  <TouchableOpacity style={styles.mapPickerPrimaryButton} onPress={() => void saveAsNewCopy()} activeOpacity={0.9}>
                    <Text style={styles.mapPickerPrimaryButtonText}>저장본으로 새로 만들기</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  largeMapButton: {
    marginBottom: 16,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d8f0f0',
    backgroundColor: '#edf8f8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  largeMapButtonText: {
    color: '#18a5a5',
    fontSize: 15,
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
  optionModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,23,42,0.38)',
  },
  optionModalDimmer: {
    ...StyleSheet.absoluteFillObject,
  },
  optionModalSheet: {
    backgroundColor: '#f9fafb',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    borderTopWidth: 1,
    borderColor: '#e5e8eb',
  },
  mapPickerSheet: {
    backgroundColor: '#f9fafb',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    borderTopWidth: 1,
    borderColor: '#e5e8eb',
    maxHeight: '84%',
  },
  optionModalHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d7e8ea',
    alignSelf: 'center',
    marginBottom: 14,
  },
  optionModalTitle: {
    color: '#191f28',
    fontSize: 18,
    fontWeight: '900',
  },
  optionModalSubtitle: {
    marginTop: 6,
    marginBottom: 14,
    color: '#6b7684',
    fontSize: 13,
    lineHeight: 19,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#f7f8fa',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    marginBottom: 10,
  },
  optionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  optionTitle: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '900',
  },
  optionText: {
    marginTop: 4,
    color: '#6b7684',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  mapPickerScroll: {
    maxHeight: '100%',
  },
  mapPickerScrollContent: {
    paddingBottom: 8,
  },
  mapPickerEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#f7f8fa',
    borderWidth: 1,
    borderColor: '#e5e8eb',
  },
  mapPickerEmptyText: {
    marginTop: 10,
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  mapPickerPrimaryButton: {
    marginTop: 14,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: '#18a5a5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPickerPrimaryButtonText: {
    color: '#f9fafb',
    fontSize: 13,
    fontWeight: '900',
  },
  mapPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#f7f8fa',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    marginBottom: 10,
  },
  mapPickerRowIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPickerRowText: {
    flex: 1,
    minWidth: 0,
  },
  mapPickerRowTitle: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '900',
  },
  mapPickerRowSubtitle: {
    marginTop: 4,
    color: '#6b7684',
    fontSize: 12,
    fontWeight: '600',
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
