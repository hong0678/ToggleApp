import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { ApiClientError, favoritesApi, myMapApi, storesApi, tokenStore, type StoreLookupItemResponse } from '@/services/api';
import { AppBottomNav } from '@/components/app-bottom-nav';
import { mapCache } from '@/services/mapCache';

const CATEGORY_OPTIONS = [
  '전체',
  '음식점',
  '카페',
  '편의점',
  '대형마트',
  '약국',
  '병원',
  '기타',
  '공공기관',
  '문화시설',
  '학교',
  '지하철역',
  '주차장',
] as const;
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  음식점: ['음식점', '식당', '맛집', '분식', '한식', '중식', '일식', '양식', '패스트푸드', '치킨', '피자', '햄버거'],
  카페: ['카페', '커피', '디저트', '베이커리'],
  편의점: ['편의점'],
  대형마트: ['대형마트', '마트', '슈퍼'],
  약국: ['약국'],
  병원: ['병원', '의원', '클리닉'],
  공공기관: ['공공기관', '관공서', '행정복지센터', '주민센터', '구청', '시청', '동사무소'],
  문화시설: ['문화시설', '도서관', '미술관', '박물관', '극장', '공연장'],
  학교: ['학교', '초등학교', '중학교', '고등학교', '대학교'],
  지하철역: ['지하철역', '역'],
  주차장: ['주차장', '주차타워', '주차빌딩', '파킹'],
  기타: ['기타'],
};
const DEFAULT_RADIUS_METERS = 2000;

const isConflictError = (error: unknown) => error instanceof ApiClientError && error.status === 409;
const isNotFoundError = (error: unknown) => error instanceof ApiClientError && error.status === 404;

type ListStoreItem = StoreLookupItemResponse & {
  distance?: string;
  sourceLabel?: string;
};

export default function ListAllScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const showInternalTabBar = pathname !== '/list';
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [selectedSorts, setSelectedSorts] = useState<string[]>(['가까운 순']);
  const [isSortPanelOpen, setIsSortPanelOpen] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [stores, setStores] = useState<ListStoreItem[]>([]);
  const [isStoresLoading, setIsStoresLoading] = useState(false);
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [favoritedExternalPlaceIds, setFavoritedExternalPlaceIds] = useState<string[]>([]);
  const [favoriteStoreIdByExternalPlaceId, setFavoriteStoreIdByExternalPlaceId] = useState<Record<string, number>>({});
  const hasCachedMapResultsRef = React.useRef(false);

  const filters = CATEGORY_OPTIONS;
  const sortOptions = [
    { title: '가까운 순', subtitle: '거리 가까운 순' },
    { title: '리뷰 많은 순', subtitle: '리뷰가 많은 순' },
    { title: '찜 많은 순', subtitle: '찜이 많은 순' },
    { title: '별점 순', subtitle: '별점이 높은 순' },
  ];

  const filterSummary = selectedFilters.length === 0
    ? '전체'
    : selectedFilters.length === 1
      ? selectedFilters[0]
      : `${selectedFilters[0]} 외 ${selectedFilters.length - 1}개`;

  const sortSummary = selectedSorts.length === 0
    ? '정렬 기준'
    : selectedSorts.length === 1
      ? selectedSorts[0]
      : `${selectedSorts[0]} 외 ${selectedSorts.length - 1}개`;

  const toggleFilter = (filter: string) => {
    if (filter === '전체') {
      setSelectedFilters([]);
      return;
    }

    setSelectedFilters((current) => (
      current.includes(filter)
        ? current.filter((item) => item !== filter)
        : current.filter((item) => item !== '전체').concat(filter)
    ));
  };

  const resetFilters = () => {
    setSelectedFilters([]);
    setIsFilterPanelOpen(false);
  };

  const toggleSort = (sort: string) => {
    setSelectedSorts((current) => (
      current.includes(sort)
        ? current.filter((item) => item !== sort)
        : [...current, sort]
    ));
  };

  const resetSorts = () => {
    setSelectedSorts(['가까운 순']);
    setIsSortPanelOpen(false);
  };

  const loadCachedMapAroundStores = useCallback(() => {
    try {
      const places = mapCache.getNearbyPlaces();
      if (!Array.isArray(places) || places.length === 0) {
        hasCachedMapResultsRef.current = false;
        return;
      }

      hasCachedMapResultsRef.current = true;
      const searchContext = mapCache.getNearbySearchContext();

      const baseStores = places.map((place, index) => ({
        storeId: Number(place.id.replace(/\D/g, '')) || index + 1,
        externalSource: 'kakao',
        externalPlaceId: place.id,
        name: place.name ?? '이름 정보 없음',
        categoryName: place.category ?? null,
        address: place.address ?? null,
        roadAddress: place.address ?? null,
        jibunAddress: null,
        phone: place.phone ?? null,
        latitude: place.latitude ?? 0,
        longitude: place.longitude ?? 0,
        businessStatus: null,
        liveBusinessStatus: null,
        liveStatusSource: null,
        verified: false,
        verifiedAt: null,
        ownerNotice: null,
        openTime: null,
        closeTime: null,
        breakStart: null,
        breakEnd: null,
        rating: null,
        reviewAverageRating: null,
        reviewCount: 0,
        favoriteCount: 0,
        imageUrls: [],
        operationalState: null,
        closureRequestStatus: null,
        menuEligible: false,
        menuEditable: false,
        menuEligibilityReason: null,
        distance: place.distance ?? '',
        sourceLabel: place.category ?? '지도',
      })) as ListStoreItem[];

      setStores(baseStores);
      if (searchContext.categoryLabel && searchContext.categoryLabel !== '전체') {
        setSelectedFilters([searchContext.categoryLabel]);
      }

      void (async () => {
        try {
          const lookup = await storesApi.lookup({
            externalSource: 'KAKAO',
            externalPlaceIds: places.map((place) => place.id),
          });

          if (lookup.stores.length === 0) {
            return;
          }

          const detailsByExternalPlaceId = lookup.stores.reduce<Record<string, ListStoreItem>>((acc, store) => {
            acc[store.externalPlaceId] = {
              ...store,
              distance: places.find((place) => place.id === store.externalPlaceId)?.distance ?? '',
              sourceLabel: '우리 서비스 매장',
            } as ListStoreItem;
            return acc;
          }, {});

          setStores((current) => current.map((store) => detailsByExternalPlaceId[store.externalPlaceId] ?? store));
        } catch {
          // Best-effort enrichment for cached map results.
        }
      })();
    } catch {
      // Cached map results are best-effort only.
    }
  }, []);

  const getCategoryLabel = useCallback((store: ListStoreItem) => {
    const raw = store.categoryName ?? '';
    if (!raw) return '카테고리 정보 없음';

    const parts = raw.split('>').map((part) => part.trim()).filter(Boolean);
    return parts[parts.length - 1] ?? raw;
  }, []);

  const matchesFilter = useCallback((store: ListStoreItem, filter: string) => {
    if (filter === '전체') return true;

    const categoryLabel = getCategoryLabel(store);
    const targetKeywords = CATEGORY_KEYWORDS[filter] ?? [filter];
    const haystack = `${store.name} ${store.categoryName ?? ''} ${categoryLabel}`.toLowerCase();

    return targetKeywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
  }, [getCategoryLabel]);

  const fetchStores = useCallback(async (coords: { latitude: number; longitude: number }) => {
    setIsStoresLoading(true);
    setStoresError(null);

    try {
      const nearbyResponse = await storesApi.nearby(coords.latitude, coords.longitude, DEFAULT_RADIUS_METERS, 30);

      setStores(nearbyResponse.stores.map((store) => ({
        ...store,
        sourceLabel: store.externalSource === 'kakao' ? '주변 장소' : '주변 매장',
      } as ListStoreItem)));
    } catch (error) {
      setStores((current) => (current.length > 0 ? current : []));
      setStoresError(error instanceof Error ? error.message : '매장 정보를 불러오지 못했어요.');
      if (error instanceof Error) {
        Alert.alert('리스트 불러오기 실패', error.message);
      }
    } finally {
      setIsStoresLoading(false);
    }
  }, []);

  const loadCurrentLocation = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      hasCachedMapResultsRef.current = false;
      mapCache.clearNearbyPlaces();
      setIsRefreshingLocation(true);
    }

    setStoresError(null);

    try {
      if (currentCoords) {
        void fetchStores(currentCoords);
      }

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        if (!currentCoords) {
          setStores([]);
        }
        setStoresError('위치 권한이 필요해요.');
        return;
      }

      const hasServices = await Location.hasServicesEnabledAsync();

      if (!hasServices) {
        if (!currentCoords) {
          setStores([]);
        }
        setStoresError('위치 서비스를 켜야 주변 매장을 볼 수 있어요.');
        return;
      }

      const lastKnownLocation = currentCoords ? null : await Location.getLastKnownPositionAsync();

      if (lastKnownLocation) {
        const quickCoords = {
          latitude: lastKnownLocation.coords.latitude,
          longitude: lastKnownLocation.coords.longitude,
        };
        setCurrentCoords(quickCoords);
        void fetchStores(quickCoords);
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }).catch(() => null);

      if (!location) {
        if (!currentCoords && !lastKnownLocation) {
          setStores([]);
          setStoresError('현재 위치를 가져오지 못했어요.');
        }
        return;
      }

      const freshCoords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setCurrentCoords(freshCoords);
      if (!currentCoords || freshCoords.latitude !== currentCoords.latitude || freshCoords.longitude !== currentCoords.longitude) {
        void fetchStores(freshCoords);
      }
    } catch {
      if (!currentCoords) {
        setStores([]);
      }
      setStoresError('현재 위치를 가져오지 못했어요.');
    } finally {
      setIsRefreshingLocation(false);
    }
  }, [currentCoords, fetchStores]);

  const loadFavoriteState = useCallback(async () => {
    const token = await tokenStore.getAccessToken();
    const loggedIn = Boolean(token);

    setIsLoggedIn(loggedIn);

    if (!loggedIn) {
      setFavoritedExternalPlaceIds([]);
      setFavoriteStoreIdByExternalPlaceId({});
      return;
    }

    try {
      const favorites = await favoritesApi.listStores();
      setFavoritedExternalPlaceIds(favorites.content.map((item) => item.externalPlaceId));
      setFavoriteStoreIdByExternalPlaceId(
        favorites.content.reduce<Record<string, number>>((acc, item) => {
          acc[item.externalPlaceId] = item.storeId;
          return acc;
        }, {})
      );
    } catch {
      setFavoritedExternalPlaceIds([]);
      setFavoriteStoreIdByExternalPlaceId({});
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFavoriteState();
      loadCachedMapAroundStores();
      void loadCurrentLocation();
    }, [loadCachedMapAroundStores, loadCurrentLocation, loadFavoriteState])
  );

  const displayedStores = useMemo(() => {
    const filtered = stores.filter((store) => {
      if (selectedFilters.length === 0) return true;
      return selectedFilters.some((filter) => matchesFilter(store, filter));
    });

    const comparators: Record<string, (a: ListStoreItem, b: ListStoreItem) => number> = {
      '가까운 순': (a, b) => Number(a.distance || 9007199254740991) - Number(b.distance || 9007199254740991),
      '리뷰 많은 순': (a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0),
      '찜 많은 순': (a, b) => (b.favoriteCount ?? 0) - (a.favoriteCount ?? 0),
      '별점 순': (a, b) => (b.reviewAverageRating ?? b.rating ?? 0) - (a.reviewAverageRating ?? a.rating ?? 0),
    };

    const sorted = [...filtered].sort((a, b) => {
      for (const sort of selectedSorts.length > 0 ? selectedSorts : ['가까운 순']) {
        const comparator = comparators[sort];
        if (!comparator) continue;

        const result = comparator(a, b);
        if (result !== 0) return result;
      }

      return 0;
    });

    return sorted;
  }, [matchesFilter, selectedFilters, selectedSorts, stores]);

  const getStatusLabel = useCallback((store: ListStoreItem) => {
    const liveStatus = store.liveBusinessStatus ?? store.businessStatus;

    if (liveStatus === 'OPEN') return '영업중';
    if (liveStatus === 'BREAK_TIME') return '브레이크타임';
    if (liveStatus === 'CLOSED') return '영업종료';
    if (liveStatus === 'TEMP_CLOSED') return '임시휴무';
    if (liveStatus === 'EARLY_CLOSED') return '조기마감';
    if (store.verified) return store.operationalState ?? '우리 서비스 매장';

    return '상태정보 없음';
  }, []);

  const getStatusSourceLabel = useCallback((store: ListStoreItem) => {
    if (store.verified) return '우리 서비스 매장';
    if (store.liveStatusSource === 'OWNER_POS') return '사장님 반영 업데이트';
    if (store.liveStatusSource === 'SYSTEM') return '시스템 반영 업데이트';
    if (store.liveStatusSource === 'ADMIN') return '관리자 반영 업데이트';
    return '서버 반영 업데이트';
  }, []);

  const isServiceStore = useCallback((store: ListStoreItem) => {
    return Boolean(
      store.verified
      || store.liveBusinessStatus
      || store.businessStatus
      || store.operationalState
      || store.ownerNotice
      || store.openTime
      || store.closeTime
      || store.breakStart
      || store.breakEnd
      || store.menuEligible
      || store.menuEditable
      || (store.imageUrls?.length ?? 0) > 0
    );
  }, []);

  const getRatingLabel = useCallback((store: ListStoreItem) => {
    const rating = store.reviewAverageRating ?? store.rating;
    if (rating === null || rating === undefined) return '—';
    return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
  }, []);

  const handleFavoritePress = useCallback(async (store: ListStoreItem) => {
    if (!isLoggedIn) {
      Alert.alert(
        '로그인이 필요해요',
        '찜은 로그인 후 사용할 수 있어요.',
        [
          { text: '취소', style: 'cancel' },
          { text: '로그인 페이지로 이동', onPress: () => router.push('/views/user_login') },
        ]
      );
      return;
    }

    const externalPlaceId = store.externalPlaceId;
    const isFavorited = favoritedExternalPlaceIds.includes(externalPlaceId);

    try {
      if (isFavorited) {
        const storeId = favoriteStoreIdByExternalPlaceId[externalPlaceId] ?? store.storeId;

        try {
          await favoritesApi.removeStore(storeId);
        } catch (error) {
          if (!isNotFoundError(error)) {
            throw error;
          }
        }

        try {
          await myMapApi.removeStore(storeId);
        } catch (error) {
          if (!isNotFoundError(error)) {
            throw error;
          }
        }

        setFavoritedExternalPlaceIds((current) => current.filter((id) => id !== externalPlaceId));
        setFavoriteStoreIdByExternalPlaceId((current) => {
          const next = { ...current };
          delete next[externalPlaceId];
          return next;
        });
        return;
      }

      const resolvedStoreId = store.externalSource === 'kakao'
        ? (await storesApi.resolve({
            externalSource: 'KAKAO',
            externalPlaceId: store.externalPlaceId,
            name: store.name,
            address: store.roadAddress ?? store.address ?? null,
            latitude: store.latitude ?? 0,
            longitude: store.longitude ?? 0,
            categoryName: store.categoryName,
          })).storeId
        : store.storeId;

      try {
        await favoritesApi.addStore(resolvedStoreId);
      } catch (error) {
        if (!isConflictError(error)) {
          throw error;
        }
      }

      try {
        await myMapApi.addStore(resolvedStoreId);
      } catch (error) {
        if (!isConflictError(error)) {
          throw error;
        }
      }

      setFavoritedExternalPlaceIds((current) => (current.includes(externalPlaceId) ? current : [...current, externalPlaceId]));
      setFavoriteStoreIdByExternalPlaceId((current) => ({
        ...current,
        [externalPlaceId]: resolvedStoreId,
      }));
    } catch {
      Alert.alert('찜 실패', '장소를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  }, [favoriteStoreIdByExternalPlaceId, favoritedExternalPlaceIds, isLoggedIn, router]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        {/* Filter Pills */}
        <View style={styles.filterWrapper}>
          <TouchableOpacity
            style={styles.filterSummaryButton}
            activeOpacity={0.85}
            onPress={() => setIsFilterPanelOpen((previous) => !previous)}
          >
            <View style={styles.filterSummaryLeft}>
              <Text style={styles.filterSummaryLabel}>카테고리</Text>
              <Text style={styles.filterSummaryValue}>{filterSummary}</Text>
            </View>
            <Ionicons name={isFilterPanelOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#fff" />
          </TouchableOpacity>

          {isFilterPanelOpen ? (
            <View style={styles.filterPanel}>
              <View style={styles.filterPanelHeader}>
                <Text style={styles.filterPanelTitle}>필터 선택</Text>
                <View style={styles.filterPanelActions}>
                  <TouchableOpacity onPress={resetFilters} activeOpacity={0.85}>
                    <Text style={styles.filterResetText}>기본정렬</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setIsFilterPanelOpen(false)} activeOpacity={0.85}>
                    <Text style={styles.filterDoneText}>완료</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                {filters.map((filter) => {
                  const isActive = selectedFilters.includes(filter);

                  return (
                    <TouchableOpacity
                      key={filter}
                      style={[
                        styles.filterPill,
                        isActive ? styles.filterPillActive : null
                      ]}
                      onPress={() => toggleFilter(filter)}
                    >
                      <Text style={[
                        styles.filterText,
                        isActive ? styles.filterTextActive : null
                      ]}>{filter}</Text>
                      {isActive ? <Ionicons name="checkmark" size={14} color="#2a2e3d" style={styles.filterCheck} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </View>

        {/* List Info Bar */}
        <View style={styles.listInfoBar}>
          <Text style={styles.totalCountText}>총 <Text style={{color: '#0ea5a4', fontWeight: 'bold'}}>{displayedStores.length}</Text>건</Text>
          <View style={styles.listInfoRight}>
            {isRefreshingLocation ? <Text style={styles.refreshingText}>갱신 중</Text> : null}
            <TouchableOpacity style={styles.locationSearchBtn} onPress={() => void loadCurrentLocation(true)} activeOpacity={0.85}>
              <MaterialIcons name="my-location" size={14} color="#0ea5a4" style={{marginRight: 4}} />
              <Text style={styles.locationSearchText}>현위치 검색</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sortDropdown} onPress={() => setIsSortPanelOpen((previous) => !previous)}>
              <Text style={styles.sortText}>{sortSummary}</Text>
              <Ionicons name={isSortPanelOpen ? 'chevron-up' : 'chevron-down'} size={14} color="#8f9bb3" style={{marginLeft: 4}} />
            </TouchableOpacity>
          </View>
        </View>

        {isSortPanelOpen ? (
          <View style={styles.sortPanel}>
            <View style={styles.sortPanelHeader}>
              <Text style={styles.sortPanelTitle}>정렬 기준</Text>
              <View style={styles.sortPanelActions}>
                <TouchableOpacity
                  onPress={resetSorts}
                  activeOpacity={0.85}
                >
                  <Text style={styles.sortResetText}>기본정렬</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsSortPanelOpen(false)} activeOpacity={0.85} style={styles.sortDoneButton}>
                  <Text style={styles.sortDoneText}>완료</Text>
                </TouchableOpacity>
              </View>
            </View>

            {sortOptions.map((option) => {
              const isActive = selectedSorts.includes(option.title);

              return (
                <TouchableOpacity
                  key={option.title}
                  style={styles.sortOption}
                  activeOpacity={0.85}
                  onPress={() => toggleSort(option.title)}
                >
                  <View>
                    <Text style={styles.sortOptionTitle}>{option.title}</Text>
                    <Text style={styles.sortOptionSubtitle}>{option.subtitle}</Text>
                  </View>
                  <View style={[styles.sortRadio, isActive ? styles.sortRadioActive : null]}>
                    {isActive ? <Ionicons name="checkmark" size={18} color="#8cb4ff" /> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {/* Divider */}
        <View style={styles.divider} />

        {/* List Content */}
        <ScrollView style={styles.listContainer} contentContainerStyle={{paddingBottom: 100}} showsVerticalScrollIndicator={false}>
          {isStoresLoading && stores.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>주변 매장 불러오는 중</Text>
              <Text style={styles.emptyStateText}>현재 위치 기준으로 카테고리별 매장을 모으고 있어요.</Text>
            </View>
          ) : displayedStores.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>조건에 맞는 매장이 없어요</Text>
              <Text style={styles.emptyStateText}>{storesError ?? '필터를 조금 풀어보면 더 많이 보여요.'}</Text>
            </View>
          ) : (
            displayedStores.map((store) => (
                <View key={`${store.externalSource}-${store.externalPlaceId}`} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.storeName}>{store.name}</Text>
                    <TouchableOpacity onPress={() => handleFavoritePress(store)} activeOpacity={0.8}>
                      <Ionicons
                        name={favoritedExternalPlaceIds.includes(store.externalPlaceId) ? 'heart' : 'heart-outline'}
                        size={24}
                        color={favoritedExternalPlaceIds.includes(store.externalPlaceId) ? '#ff4d74' : '#fff'}
                      />
                    </TouchableOpacity>
                  </View>

                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{getCategoryLabel(store)}</Text>
                </View>

                <View style={styles.statusRow}>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{getStatusLabel(store)}</Text>
                  </View>
                  <Text style={styles.statusUpdateText}>{getStatusSourceLabel(store)}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={16} color="#8f9bb3" />
                  <Text style={styles.infoText}>{store.roadAddress ?? store.address ?? '주소 정보 없음'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="time-outline" size={16} color="#8f9bb3" />
                  <Text style={styles.infoText}>{store.phone ?? '전화번호 정보 없음'}</Text>
                </View>

                <View style={styles.cardFooterDivider} />

                <View style={styles.cardFooter}>
                  <View style={styles.footerItem}>
                    <Ionicons name="star" size={14} color="#ffb300" />
                    <Text style={styles.footerText}>{getRatingLabel(store)}</Text>
                  </View>
                  <View style={styles.footerItem}>
                    <Ionicons name="chatbubble-outline" size={14} color="#8f9bb3" />
                    <Text style={styles.footerText}>리뷰 {store.reviewCount}개</Text>
                  </View>
                  <View style={styles.footerItem}>
                    <Ionicons name="heart" size={14} color="#f44336" />
                    <Text style={styles.footerText}>찜 {store.favoriteCount}</Text>
                  </View>
                </View>
                {isServiceStore(store) ? (
                  <>
                    <TouchableOpacity
                      style={styles.detailButton}
                      onPress={() =>
                        router.push({
                          pathname: '/views/store_detail',
                          params: {
                            storeId: String(store.storeId),
                            storeName: store.name,
                            storePhone: store.phone ?? '',
                          },
                        })
                      }
                      activeOpacity={0.9}
                    >
                      <Text style={styles.detailButtonText}>상세 보기</Text>
                      <Ionicons name="chevron-forward" size={16} color="#2563eb" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.reviewButton}
                      onPress={() =>
                        router.push({
                          pathname: '/views/store_reviews',
                          params: {
                            storeId: String(store.storeId),
                            storeName: store.name,
                            storePhone: store.phone ?? '',
                          },
                        })
                      }
                      activeOpacity={0.9}
                    >
                      <Text style={styles.reviewButtonText}>리뷰 보기</Text>
                      <Ionicons name="chevron-forward" size={16} color="#0ea5a4" />
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>

        {showInternalTabBar ? <AppBottomNav activeTab="list" /> : null}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fbfc',
  },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbeff0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  heroBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  logo: {
    width: 46,
    height: 46,
    resizeMode: 'contain',
    marginRight: 10,
  },
  heroBrandTextWrap: {
    flex: 1,
  },
  brandName: {
    color: '#0ea5a4',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0,
  },
  brandSubText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  heroTitle: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  heroSubtitle: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 14,
  },
  searchSection: {
    flexDirection: 'row',
    gap: 12,
  },
  searchSectionCompact: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
  },
  filterIconButton: {
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterWrapper: {
    paddingTop: Platform.OS === 'ios' ? 44 : 28,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  filterScroll: {
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#43485c',
  },
  filterPillActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  filterText: {
    color: '#8f9bb3',
    fontSize: 14,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#2a2e3d',
    fontWeight: 'bold',
  },
  filterCheck: {
    marginLeft: 6,
  },
  filterSummaryButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#0ea5a4',
    borderWidth: 1,
    borderColor: '#0ea5a4',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  filterSummaryLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '700',
  },
  filterSummaryValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
  },
  filterPanel: {
    marginTop: 10,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbeff0',
  },
  filterPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  filterPanelTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  filterPanelActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterResetText: {
    color: '#0ea5a4',
    fontSize: 13,
    fontWeight: '700',
  },
  filterDoneText: {
    color: '#0ea5a4',
    fontSize: 13,
    fontWeight: '800',
  },
  listInfoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  totalCountText: {
    color: '#64748b',
    fontSize: 14,
  },
  listInfoRight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  refreshingText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  locationSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bfeceb',
    backgroundColor: '#e6fbfa',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  locationSearchText: {
    color: '#0ea5a4',
    fontSize: 12,
    fontWeight: '700',
  },
  sortDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2eef0',
  },
  sortText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#dbeff0',
    width: '100%',
  },
  sortPanel: {
    marginTop: 10,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbeff0',
  },
  sortPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sortPanelTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  sortPanelActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sortResetText: {
    color: '#0ea5a4',
    fontSize: 13,
    fontWeight: '700',
  },
  sortDoneButton: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: 'rgba(140,180,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(140,180,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortDoneText: {
    color: '#0ea5a4',
    fontSize: 13,
    fontWeight: '800',
  },
  sortOption: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sortOptionTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  sortOptionSubtitle: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    paddingVertical: 56,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  sortRadio: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#d8eceb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortRadioActive: {
    borderColor: '#0ea5a4',
    backgroundColor: '#e6fbfa',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e6eef1',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  storeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  categoryBadge: {
    backgroundColor: '#eefbfb',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 16,
  },
  categoryText: {
    color: '#0ea5a4',
    fontSize: 12,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: '#00e676',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  statusText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusUpdateText: {
    color: '#64748b',
    fontSize: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    color: '#64748b',
    fontSize: 14,
    marginLeft: 6,
  },
  cardFooterDivider: {
    height: 1,
    backgroundColor: '#e6eef1',
    marginVertical: 14,
  },
  reviewButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#bfeceb',
    backgroundColor: '#eefafa',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reviewButtonText: {
    color: '#0ea5a4',
    fontSize: 12,
    fontWeight: '800',
  },
  detailButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cfe0ff',
    backgroundColor: '#f4f8ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailButtonText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '800',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '500',
  },
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 78,
    backgroundColor: '#fff',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#eceef3',
    paddingBottom: Platform.OS === 'ios' ? 25 : 10,
    paddingTop: 10,
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
