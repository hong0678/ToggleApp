import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { AppBottomNav } from '@/components/app-bottom-nav';
import { PageHero } from '@/components/page-hero';
import {
  ApiClientError,
  favoritesApi,
  myMapApi,
  tokenStore,
  userMapsApi,
  type FavoriteStoreListItemResponse,
  type UserMapSummaryResponse,
} from '@/services/api';

const isConflictError = (error: unknown) => error instanceof ApiClientError && error.status === 409;
const isServerError = (error: unknown) => error instanceof ApiClientError && error.status >= 500;

type SavedPlace = {
  id: string;
  title: string;
  category: string;
  address: string;
  phone: string | null;
  note: string;
  accent: string;
  favoriteCount: number;
};

const PLACE_ACCENTS = ['#e8f6f7', '#fff3d8', '#eaf7ff', '#f2fbfa'];

const mapFavoriteToSavedPlace = (place: FavoriteStoreListItemResponse, index: number): SavedPlace => ({
  id: String(place.storeId),
  title: place.name,
  category: place.categoryName ?? '카테고리 정보 없음',
  address: place.roadAddress ?? place.address ?? place.jibunAddress ?? '주소 정보 없음',
  phone: place.phone ?? null,
  note: place.ownerNotice ?? '찜한 장소예요.',
  accent: PLACE_ACCENTS[index % PLACE_ACCENTS.length],
  favoriteCount: place.favoriteCount,
});

function SavedSuggestionCard({
  title,
  subtitle,
  icon,
  accent,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.suggestionCard} onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.suggestionIcon, { backgroundColor: accent }]}>
        <Ionicons name={icon} size={22} color="#0ea5a4" />
      </View>
      <View style={styles.suggestionTextWrap}>
        <Text style={styles.suggestionTitle}>{title}</Text>
        <Text style={styles.suggestionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#0ea5a4" />
    </TouchableOpacity>
  );
}

function SavedPlaceCard({
  place,
  onAddToMap,
  onRemove,
  onPressDetail,
  onPressReviews,
}: {
  place: SavedPlace;
  onAddToMap: () => void;
  onRemove: () => void;
  onPressDetail: () => void;
  onPressReviews: () => void;
}) {
  return (
    <View style={styles.placeCard}>
      <View style={styles.placeCardTop}>
        <View style={[styles.placeThumb, { backgroundColor: place.accent }]}>
          <Ionicons name="bookmark-outline" size={20} color="#0ea5a4" />
        </View>
        <TouchableOpacity activeOpacity={0.85} style={styles.heartButton} onPress={onRemove}>
          <Ionicons name="heart" size={18} color="#ff4d74" />
        </TouchableOpacity>
      </View>

      <Text style={styles.placeTitle}>{place.title}</Text>
      <View style={styles.placeCategoryBadge}>
        <Text style={styles.placeCategoryText}>{place.category}</Text>
      </View>
      <Text style={styles.placeNote}>{place.note}</Text>

      <View style={styles.placeMetaRow}>
        <View style={styles.placeMetaItem}>
          <Ionicons name="location-outline" size={14} color="#94a3b8" />
          <Text style={styles.placeMetaText}>{place.address}</Text>
        </View>
      </View>

      <View style={styles.placeActions}>
        <TouchableOpacity style={styles.detailButton} onPress={onPressDetail} activeOpacity={0.9}>
          <Text style={styles.detailButtonText}>상세 보기</Text>
          <Ionicons name="chevron-forward" size={15} color="#2563eb" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.reviewButton} onPress={onPressReviews} activeOpacity={0.9}>
          <Text style={styles.reviewButtonText}>리뷰 보기</Text>
          <Ionicons name="chevron-forward" size={15} color="#0ea5a4" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.mapAddButton} onPress={onAddToMap} activeOpacity={0.9}>
          <Ionicons name="map-outline" size={16} color="#0ea5a4" />
          <Text style={styles.mapAddButtonText}>내 지도에 추가</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

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
        <Ionicons name="lock-closed-outline" size={24} color="#0ea5a4" />
      </View>
      <Text style={styles.gateTitle}>저장한 장소를 보려면 로그인하세요</Text>
      <Text style={styles.gateSubtitle}>찜한 장소, 내 지도 추가, 지도 선택까지 이어서 사용할 수 있어요.</Text>
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

export default function SavedPlacesScreen() {
  const router = useRouter();
  const segments = useSegments();
  const showInternalTabBar = segments[0] !== '(tabs)';

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);
  const [assignedMapByPlaceId, setAssignedMapByPlaceId] = useState<Record<string, string>>({});
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [mapCollections, setMapCollections] = useState<UserMapSummaryResponse[]>([]);
  const [mapPlaceCounts, setMapPlaceCounts] = useState<Record<number, number>>({});
  const [isLoadingMaps, setIsLoadingMaps] = useState(false);
  const [isCreatingMap, setIsCreatingMap] = useState(false);
  const [isCreateMapOpen, setIsCreateMapOpen] = useState(false);
  const [newMapTitle, setNewMapTitle] = useState('');
  const [newMapDescription, setNewMapDescription] = useState('');

  const activePlace = useMemo(
    () => savedPlaces.find((item) => item.id === activePlaceId) ?? null,
    [activePlaceId, savedPlaces]
  );

  const loadSavedPlaces = useCallback(async () => {
    const token = await tokenStore.getAccessToken();
    const loggedIn = Boolean(token);
    setIsLoggedIn(loggedIn);

    if (!loggedIn) {
      setSavedPlaces([]);
      setMapCollections([]);
      setMapPlaceCounts({});
      return;
    }

    try {
      const [favorites, maps] = await Promise.all([
        favoritesApi.listStores(),
        userMapsApi.list(),
      ]);
      setSavedPlaces(favorites.content.map(mapFavoriteToSavedPlace));
      setMapCollections(maps);

      const countEntries = await Promise.all(
        maps.map(async (map) => {
          try {
            const detail = await userMapsApi.get(map.mapId);
            return [map.mapId, detail.stores.length + detail.publicInstitutions.length] as const;
          } catch {
            return [map.mapId, 0] as const;
          }
        })
      );
      setMapPlaceCounts(Object.fromEntries(countEntries));
    } catch {
      setSavedPlaces([]);
      setMapCollections([]);
      setMapPlaceCounts({});
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSavedPlaces();
    }, [loadSavedPlaces])
  );

  const openMapPicker = async (placeId: string) => {
    setActivePlaceId(placeId);
    setNewMapTitle('');
    setNewMapDescription('');
    setIsCreateMapOpen(mapCollections.length === 0);
    setIsMapPickerOpen(true);

    if (!isLoggedIn) return;

    try {
      setIsLoadingMaps(true);
      const maps = await userMapsApi.list();
      setMapCollections(maps);
      setIsCreateMapOpen(maps.length === 0);
    } catch {
      Alert.alert('지도 목록 실패', '내 지도 목록을 불러오지 못했어요.');
    } finally {
      setIsLoadingMaps(false);
    }
  };

  const removeSavedPlace = useCallback((place: SavedPlace) => {
    Alert.alert(
      '저장 취소',
      `${place.title} 저장을 정말 취소하시겠습니까?`,
      [
        { text: '아니요', style: 'cancel' },
        {
          text: '취소하기',
          style: 'destructive',
          onPress: () => {
            const placeId = Number(place.id);
            if (Number.isNaN(placeId)) return;

            void (async () => {
              try {
                await favoritesApi.removeStore(placeId);
                await myMapApi.removeStore(placeId).catch((error) => {
                  if (error instanceof ApiClientError && error.status === 404) {
                    return;
                  }
                  throw error;
                });

                setSavedPlaces((current) => current.filter((item) => item.id !== place.id));
                setAssignedMapByPlaceId((current) => {
                  const next = { ...current };
                  delete next[place.id];
                  return next;
                });
              } catch (error) {
                Alert.alert('저장 취소 실패', error instanceof Error ? error.message : '저장을 취소하지 못했어요.');
              }
            })();
          },
        },
      ]
    );
  }, []);

  const addActivePlaceToMap = useCallback(async (mapId: number) => {
    if (!activePlaceId) return;

    const placeId = Number(activePlaceId);
    if (Number.isNaN(placeId)) return;

    if (__DEV__) {
      console.log('[SavedPlaces.addActivePlaceToMap:request]', {
        mapId,
        storeId: placeId,
        activePlaceTitle: activePlace?.title ?? null,
      });
    }

    try {
      await userMapsApi.addStore(mapId, placeId);
    } catch (error) {
      if (__DEV__) {
        console.warn('[SavedPlaces.addActivePlaceToMap:error]', {
          mapId,
          storeId: placeId,
          activePlaceTitle: activePlace?.title ?? null,
          status: error instanceof ApiClientError ? error.status : null,
          code: error instanceof ApiClientError ? error.code : null,
          message: error instanceof Error ? error.message : String(error),
        });
      }

      if (!isConflictError(error)) {
        if (!isServerError(error)) {
          Alert.alert('추가 실패', error instanceof Error ? error.message : '지도에 장소를 추가하지 못했어요.');
          return;
        }

        try {
          await myMapApi.removeStore(placeId);
          await userMapsApi.addStore(mapId, placeId);
        } catch (retryError) {
          if (__DEV__) {
            console.warn('[SavedPlaces.addActivePlaceToMap:retryError]', {
              mapId,
              storeId: placeId,
              activePlaceTitle: activePlace?.title ?? null,
              status: retryError instanceof ApiClientError ? retryError.status : null,
              code: retryError instanceof ApiClientError ? retryError.code : null,
              message: retryError instanceof Error ? retryError.message : String(retryError),
            });
          }

          Alert.alert(
            '추가 실패',
            retryError instanceof Error ? retryError.message : '지도에 장소를 추가하지 못했어요.'
          );
          return;
        }
      }
    }

    setAssignedMapByPlaceId((current) => ({
      ...current,
      [activePlaceId]: String(mapId),
    }));
    setMapPlaceCounts((current) => ({
      ...current,
      [mapId]: (current[mapId] ?? 0) + 1,
    }));
    setIsMapPickerOpen(false);
    Alert.alert('추가 완료', '선택한 지도에 장소를 담았어요.');
  }, [activePlace?.title, activePlaceId]);

  const createMapAndAddPlace = useCallback(async () => {
    const title = newMapTitle.trim();
    if (!title) {
      Alert.alert('지도 이름 확인', '새 지도 이름을 입력해주세요.');
      return;
    }

    try {
      setIsCreatingMap(true);
      const createdMap = await userMapsApi.create({
        title,
        description: newMapDescription.trim() || null,
        isPublic: false,
      });
      setMapCollections((current) => [...current, createdMap]);
      setMapPlaceCounts((current) => ({
        ...current,
        [createdMap.mapId]: 0,
      }));
      await addActivePlaceToMap(createdMap.mapId);
      setNewMapTitle('');
      setNewMapDescription('');
      setIsCreateMapOpen(false);
    } catch (error) {
      Alert.alert('지도 만들기 실패', error instanceof Error ? error.message : '새 지도를 만들지 못했어요.');
    } finally {
      setIsCreatingMap(false);
    }
  }, [addActivePlaceToMap, newMapDescription, newMapTitle]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <PageHero
              title="저장, 지도에 담기"
              titleAccent="저장, "
              subtitle="저장한 장소를 내 지도에 옮겨서 코스로 정리해보세요"
              rightIcon="heart-outline"
              rightIconColor="#0ea5a4"
              rightIconBackground="#e6fbfa"
              onRightPress={() => router.push('/my')}
            />

            {!isLoggedIn ? (
              <LoginGatePanel
                onLogin={() => router.replace('/views/user_login')}
                onSignup={() => router.replace('/views/user_signup')}
              />
            ) : (
              <>
                <View style={styles.quickRow}>
                  <SavedSuggestionCard
                    title="내 주변 보기"
                    subtitle="지금 바로 가까운 장소를 살펴봐요"
                    icon="location-outline"
                    accent="#e8f8f7"
                    onPress={() => router.push('/map')}
                  />
                  <SavedSuggestionCard
                    title="마이지도로 보기"
                    subtitle="카드로 한 번에 비교해요"
                    icon="list"
                    accent="#fff3e4"
                    onPress={() => router.push('/list')}
                  />
                </View>

                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderLeft}>
                    <Ionicons name="heart" size={18} color="#0ea5a4" />
                    <Text style={styles.sectionTitle}>저장한 장소</Text>
                  </View>
                  <Text style={styles.sectionMore}>{savedPlaces.length}개</Text>
                </View>

                {savedPlaces.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateTitle}>저장한 장소가 없어요</Text>
                    <Text style={styles.emptyStateText}>지도에서 찜한 장소가 여기에 쌓여요.</Text>
                  </View>
                ) : (
                  <View style={styles.savedList}>
                    {savedPlaces.map((place) => (
                      <SavedPlaceCard
                        key={place.id}
                        place={place}
                        onAddToMap={() => void openMapPicker(place.id)}
                        onRemove={() => removeSavedPlace(place)}
                        onPressDetail={() =>
                          router.push({
                            pathname: '/views/store_detail',
                            params: {
                              storeId: place.id,
                              storeName: place.title,
                              storePhone: place.phone ?? '',
                            },
                          })
                        }
                        onPressReviews={() =>
                          router.push({
                            pathname: '/views/store_reviews',
                            params: {
                              storeId: place.id,
                              storeName: place.title,
                              storePhone: place.phone ?? '',
                            },
                          })
                        }
                      />
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>

        {showInternalTabBar ? <AppBottomNav activeTab="saved" /> : null}
      </View>

      <Modal visible={isMapPickerOpen} transparent animationType="fade" onRequestClose={() => setIsMapPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.modalDimmer} activeOpacity={1} onPress={() => setIsMapPickerOpen(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>어느 지도에 추가할까요?</Text>
            <Text style={styles.modalSubtitle}>{activePlace?.title ?? '선택한 장소'}를 넣을 지도를 골라주세요.</Text>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {isLoadingMaps ? (
                <View style={styles.mapPickerEmpty}>
                  <ActivityIndicator color="#0ea5a4" />
                  <Text style={styles.mapPickerEmptyText}>지도 목록을 불러오는 중이에요</Text>
                </View>
              ) : mapCollections.length > 0 ? (
                <View style={styles.mapList}>
                  {mapCollections.map((map) => {
                    const isSelected = assignedMapByPlaceId[activePlaceId ?? ''] === String(map.mapId);

                    return (
                      <TouchableOpacity
                        key={map.mapId}
                        style={[styles.mapOption, isSelected ? styles.mapOptionActive : null]}
                        activeOpacity={0.9}
                        onPress={() => void addActivePlaceToMap(map.mapId)}
                      >
                        <View style={styles.mapOptionLeft}>
                          <View style={styles.mapOptionIcon}>
                            <Ionicons name="bookmark-outline" size={18} color="#0ea5a4" />
                          </View>
                          <View style={styles.mapOptionTextWrap}>
                            <Text style={styles.mapOptionTitle}>{map.title}</Text>
                            <Text style={styles.mapOptionSubtitle}>{mapPlaceCounts[map.mapId] ?? 0}개 저장됨</Text>
                          </View>
                        </View>
                        <View style={[styles.mapOptionCheck, isSelected ? styles.mapOptionCheckActive : null]}>
                          {isSelected ? <Ionicons name="checkmark" size={16} color="#0ea5a4" /> : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.mapPickerEmpty}>
                  <Ionicons name="map-outline" size={36} color="#b8d9dc" />
                  <Text style={styles.mapPickerEmptyTitle}>아직 만든 지도가 없어요</Text>
                  <Text style={styles.mapPickerEmptyText}>새 지도를 만들고 바로 이 장소를 담아보세요.</Text>
                </View>
              )}

              {isCreateMapOpen ? (
                <View style={styles.newMapForm}>
                  <Text style={styles.newMapFormTitle}>새 지도 만들기</Text>
                  <TextInput
                    style={styles.newMapInput}
                    value={newMapTitle}
                    onChangeText={setNewMapTitle}
                    placeholder="지도 이름"
                    placeholderTextColor="#94a3b8"
                    returnKeyType="next"
                  />
                  <TextInput
                    style={[styles.newMapInput, styles.newMapDescriptionInput]}
                    value={newMapDescription}
                    onChangeText={setNewMapDescription}
                    placeholder="설명은 선택이에요"
                    placeholderTextColor="#94a3b8"
                    multiline
                  />
                  <TouchableOpacity
                    style={[styles.createMapButton, isCreatingMap ? styles.createMapButtonDisabled : null]}
                    activeOpacity={0.9}
                    disabled={isCreatingMap}
                    onPress={() => void createMapAndAddPlace()}
                  >
                    {isCreatingMap ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark" size={18} color="#fff" />}
                    <Text style={styles.createMapButtonText}>만들고 추가하기</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.newMapButton}
                activeOpacity={0.9}
                onPress={() => setIsCreateMapOpen((current) => !current)}
              >
                <Ionicons name="add" size={18} color="#0ea5a4" />
                <Text style={styles.newMapButtonText}>{isCreateMapOpen ? '새 지도 접기' : '새 지도 만들기'}</Text>
              </TouchableOpacity>
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
    backgroundColor: '#f7fbfc',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 8 : 18,
    paddingBottom: 26,
  },
  heroShell: {
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#dbeff0',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  logo: {
    width: 50,
    height: 50,
    resizeMode: 'contain',
    marginRight: 12,
  },
  brandCopy: {
    justifyContent: 'center',
  },
  brandTitle: {
    color: '#0ea5a4',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
  },
  brandSubtitle: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e6fbfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    alignItems: 'flex-start',
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    color: '#0f172a',
  },
  heroAccent: {
    color: '#0ea5a4',
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  suggestionCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dbeff0',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 100,
  },
  suggestionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  suggestionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  suggestionTitle: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 2,
  },
  suggestionSubtitle: {
    color: '#64748b',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
  },
  sectionMore: {
    color: '#0ea5a4',
    fontSize: 13,
    fontWeight: '800',
  },
  gateCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#dbeff0',
    paddingHorizontal: 18,
    paddingVertical: 20,
    marginTop: 14,
  },
  gateIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e6fbfa',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  gateTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
  },
  gateSubtitle: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 13,
    lineHeight: 19,
  },
  gateButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  gateSecondaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#bfeceb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateSecondaryButtonText: {
    color: '#0ea5a4',
    fontSize: 14,
    fontWeight: '800',
  },
  gatePrimaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0ea5a4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gatePrimaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  savedList: {
    gap: 12,
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e6eef1',
    paddingHorizontal: 18,
    paddingVertical: 22,
    alignItems: 'center',
  },
  emptyStateTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  emptyStateText: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  placeCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e6eef1',
    padding: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  placeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  placeThumb: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
  },
  placeCategoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#eefbfb',
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 10,
  },
  placeCategoryText: {
    color: '#0ea5a4',
    fontSize: 12,
    fontWeight: '800',
  },
  placeNote: {
    marginTop: 10,
    color: '#64748b',
    fontSize: 13,
    lineHeight: 19,
  },
  placeMetaRow: {
    marginTop: 12,
  },
  placeMetaItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  placeMetaText: {
    flex: 1,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
  },
  placeActions: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  detailButton: {
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailButtonText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '800',
  },
  reviewButton: {
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#8dd9d7',
    backgroundColor: '#f0fdfa',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewButtonText: {
    color: '#0ea5a4',
    fontSize: 13,
    fontWeight: '800',
  },
  mapAddButton: {
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#8dd9d7',
    backgroundColor: '#e6fbfa',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapAddButtonText: {
    color: '#0ea5a4',
    fontSize: 13,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  modalDimmer: {
    ...StyleSheet.absoluteFillObject,
  },
  modalSheet: {
    backgroundColor: '#f7fbfc',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 18,
    borderTopWidth: 1,
    borderColor: '#dbeff0',
    maxHeight: '82%',
  },
  modalHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d7e8ea',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
  },
  modalSubtitle: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
  },
  modalScroll: {
    marginTop: 14,
    flexGrow: 0,
  },
  modalScrollContent: {
    paddingBottom: 6,
  },
  mapList: {
    gap: 10,
  },
  mapPickerEmpty: {
    minHeight: 128,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e6eef1',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  mapPickerEmptyTitle: {
    marginTop: 10,
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  mapPickerEmptyText: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  mapOption: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e6eef1',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  mapOptionActive: {
    borderColor: '#8dd9d7',
    backgroundColor: '#eaf9f8',
  },
  mapOptionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  mapOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e6fbfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapOptionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  mapOptionTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
  },
  mapOptionSubtitle: {
    marginTop: 3,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
  },
  mapOptionCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbeff0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapOptionCheckActive: {
    borderColor: '#8dd9d7',
    backgroundColor: '#fff',
  },
  newMapForm: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dbeff0',
    backgroundColor: '#fff',
    padding: 14,
  },
  newMapFormTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 10,
  },
  newMapInput: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeff0',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  newMapDescriptionInput: {
    minHeight: 72,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  createMapButton: {
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0ea5a4',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  createMapButtonDisabled: {
    opacity: 0.7,
  },
  createMapButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  newMapButton: {
    marginTop: 14,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#8dd9d7',
    backgroundColor: '#e6fbfa',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  newMapButtonText: {
    color: '#0ea5a4',
    fontSize: 14,
    fontWeight: '800',
  },
});
