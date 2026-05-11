import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { AppBottomNav } from '@/components/app-bottom-nav';
import { ApiClientError, favoritesApi, myMapApi, tokenStore, type FavoriteStoreListItemResponse } from '@/services/api';

const isConflictError = (error: unknown) => error instanceof ApiClientError && error.status === 409;

type SavedPlace = {
  id: string;
  title: string;
  category: string;
  address: string;
  note: string;
  accent: string;
};

type MapCollection = {
  id: string;
  name: string;
  count: number;
};

const MAP_COLLECTIONS: MapCollection[] = [
  { id: 'map-1', name: '내 주변 지도', count: 12 },
  { id: 'map-2', name: '카페 코스 지도', count: 8 },
  { id: 'map-3', name: '데이트 코스 지도', count: 5 },
];

const PLACE_ACCENTS = ['#e8f6f7', '#fff3d8', '#eaf7ff', '#f2fbfa'];

const mapFavoriteToSavedPlace = (place: FavoriteStoreListItemResponse, index: number): SavedPlace => ({
  id: String(place.storeId),
  title: place.name,
  category: place.categoryName ?? '카테고리 정보 없음',
  address: place.roadAddress ?? place.address ?? place.jibunAddress ?? '주소 정보 없음',
  note: place.ownerNotice ?? '찜한 장소예요.',
  accent: PLACE_ACCENTS[index % PLACE_ACCENTS.length],
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
}: {
  place: SavedPlace;
  onAddToMap: () => void;
}) {
  return (
    <View style={styles.placeCard}>
      <View style={styles.placeCardTop}>
        <View style={[styles.placeThumb, { backgroundColor: place.accent }]}>
          <Ionicons name="bookmark-outline" size={20} color="#0ea5a4" />
        </View>
        <TouchableOpacity activeOpacity={0.85} style={styles.heartButton}>
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
      return;
    }

    try {
      const favorites = await favoritesApi.listStores();
      setSavedPlaces(favorites.content.map(mapFavoriteToSavedPlace));
    } catch {
      setSavedPlaces([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSavedPlaces();
    }, [loadSavedPlaces])
  );

  const openMapPicker = (placeId: string) => {
    setActivePlaceId(placeId);
    setIsMapPickerOpen(true);
  };

  const selectMap = (mapId: string) => {
    if (!activePlaceId) return;
    setAssignedMapByPlaceId((current) => ({
      ...current,
      [activePlaceId]: mapId,
    }));

    if (isLoggedIn) {
      const placeId = Number(activePlaceId);
      if (!Number.isNaN(placeId)) {
        void myMapApi.addStore(placeId).catch((error) => {
          if (!isConflictError(error)) {
            throw error;
          }
        });
      }
    }

    setIsMapPickerOpen(false);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.heroShell}>
              <View style={styles.topRow}>
                <View style={styles.brand}>
                  <Image source={require('@/assets/images/mainLogo.png')} style={styles.logo} />
                  <View style={styles.brandCopy}>
                    <Text style={styles.brandTitle}>Toggle</Text>
                    <Text style={styles.brandSubtitle}>좋아한 장소를 한곳에 모아봐요</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/my')} activeOpacity={0.85}>
                  <Ionicons name="heart-outline" size={18} color="#0ea5a4" />
                </TouchableOpacity>
              </View>

              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>
                  <Text style={styles.heroAccent}>저장, </Text>지도에 담기
                </Text>
                <Text style={styles.heroSubtitle}>저장한 장소를 내 지도에 옮겨서 코스로 정리해보세요</Text>
              </View>
            </View>

            {!isLoggedIn ? (
              <LoginGatePanel
                onLogin={() => router.push('/views/user_login')}
                onSignup={() => router.push('/views/user_signup')}
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
                    title="리스트로 보기"
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
                        onAddToMap={() => openMapPicker(place.id)}
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
              <View style={styles.mapList}>
                {MAP_COLLECTIONS.map((map) => {
                  const isSelected = assignedMapByPlaceId[activePlaceId ?? ''] === map.id;

                  return (
                    <TouchableOpacity
                      key={map.id}
                      style={[styles.mapOption, isSelected ? styles.mapOptionActive : null]}
                      activeOpacity={0.9}
                      onPress={() => selectMap(map.id)}
                    >
                      <View style={styles.mapOptionLeft}>
                        <View style={styles.mapOptionIcon}>
                          <Ionicons name="bookmark-outline" size={18} color="#0ea5a4" />
                        </View>
                        <View style={styles.mapOptionTextWrap}>
                          <Text style={styles.mapOptionTitle}>{map.name}</Text>
                          <Text style={styles.mapOptionSubtitle}>{map.count}개 저장됨</Text>
                        </View>
                      </View>
                      <View style={[styles.mapOptionCheck, isSelected ? styles.mapOptionCheckActive : null]}>
                        {isSelected ? <Ionicons name="checkmark" size={16} color="#0ea5a4" /> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity style={styles.newMapButton} activeOpacity={0.9}>
                <Ionicons name="add" size={18} color="#0ea5a4" />
                <Text style={styles.newMapButtonText}>새 지도 만들기</Text>
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
    alignItems: 'flex-end',
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
