import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter, Stack, useSegments } from 'expo-router';
import * as Location from 'expo-location';
import { mobileSearchApi, type StoreLookupItemResponse } from '@/services/api';
import { AppBottomNav } from '@/components/app-bottom-nav';

const CATEGORY_OPTIONS = ['전체', '음식점', '카페', '편의점', '대형마트', '약국'] as const;
const CATEGORY_CODES: Record<(typeof CATEGORY_OPTIONS)[number], string | null> = {
  전체: null,
  음식점: 'FD6',
  카페: 'CE7',
  편의점: 'CS2',
  대형마트: 'MT1',
  약국: 'PM9',
};
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  음식점: ['음식점', '식당', '맛집', '분식', '한식', '중식', '일식', '양식', '패스트푸드', '치킨', '피자', '햄버거'],
  카페: ['카페', '커피', '디저트', '베이커리'],
  편의점: ['편의점'],
  대형마트: ['대형마트', '마트', '슈퍼'],
  약국: ['약국'],
};
const DEFAULT_RADIUS_METERS = 2000;
type CategoryLabel = (typeof CATEGORY_OPTIONS)[number];

type ListStoreItem = StoreLookupItemResponse & {
  distance?: string;
  sourceLabel?: string;
};

export default function ListAllScreen() {
  const router = useRouter();
  const segments = useSegments();
  const showInternalTabBar = segments[0] !== '(tabs)';
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [selectedSorts, setSelectedSorts] = useState<string[]>(['가까운 순']);
  const [isSortPanelOpen, setIsSortPanelOpen] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [stores, setStores] = useState<ListStoreItem[]>([]);
  const [isStoresLoading, setIsStoresLoading] = useState(false);
  const [storesError, setStoresError] = useState<string | null>(null);

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
      const selectedCategoryLabels = (selectedFilters.length === 0
        ? CATEGORY_OPTIONS.filter((label) => label !== '전체')
        : selectedFilters.filter((label) => label !== '전체')) as CategoryLabel[];

      const requestedCategories: CategoryLabel[] = selectedCategoryLabels.length > 0
        ? selectedCategoryLabels
        : CATEGORY_OPTIONS.filter((label) => label !== '전체') as CategoryLabel[];

      const categoryResults = await Promise.all(
        requestedCategories
          .map((label) => CATEGORY_CODES[label])
          .filter((code): code is string => Boolean(code))
          .map(async (categoryGroupCode) => {
            const response = await mobileSearchApi.category({
              categoryGroupCode,
              latitude: coords.latitude,
              longitude: coords.longitude,
              radiusMeters: DEFAULT_RADIUS_METERS,
              page: 1,
              size: 20,
              sort: 'distance',
            });

            return response.documents.map((document) => ({
              document,
              sourceLabel: requestedCategories.find((label) => CATEGORY_CODES[label] === categoryGroupCode) ?? '전체',
            }));
          })
      );

      const documents = categoryResults.flat().filter((item) => item.document.id);
      const uniqueDocuments = Array.from(
        new Map(documents.map((item) => [item.document.id, item])).values()
      );

      if (uniqueDocuments.length === 0) {
        setStores([]);
        return;
      }

      const lookupResponse = await mobileSearchApi.lookup({
        items: uniqueDocuments.map((item) => ({
          externalPlaceId: item.document.id,
          name: item.document.place_name,
          address: item.document.road_address_name ?? item.document.address_name ?? '',
          latitude: Number(item.document.y),
          longitude: Number(item.document.x),
          categoryName: item.document.category_name,
        })),
      });

      const mergedStores = uniqueDocuments.map((item) => {
        const resolvedStore = lookupResponse.stores.find((store) => store.externalPlaceId === item.document.id);

        return {
          ...(resolvedStore ?? {}),
          storeId: (resolvedStore?.storeId ?? Number(item.document.id.replace(/\D/g, ''))) || 0,
          externalSource: resolvedStore?.externalSource ?? 'kakao',
          externalPlaceId: item.document.id,
          name: resolvedStore?.name ?? item.document.place_name,
          categoryName: resolvedStore?.categoryName ?? item.document.category_name ?? null,
          address: resolvedStore?.address ?? item.document.address_name ?? null,
          roadAddress: resolvedStore?.roadAddress ?? item.document.road_address_name ?? null,
          jibunAddress: resolvedStore?.jibunAddress ?? null,
          phone: resolvedStore?.phone ?? item.document.phone ?? null,
          latitude: resolvedStore?.latitude ?? Number(item.document.y),
          longitude: resolvedStore?.longitude ?? Number(item.document.x),
          businessStatus: resolvedStore?.businessStatus ?? null,
          liveBusinessStatus: resolvedStore?.liveBusinessStatus ?? null,
          liveStatusSource: resolvedStore?.liveStatusSource ?? null,
          verified: resolvedStore?.verified ?? false,
          verifiedAt: resolvedStore?.verifiedAt ?? null,
          ownerNotice: resolvedStore?.ownerNotice ?? null,
          openTime: resolvedStore?.openTime ?? null,
          closeTime: resolvedStore?.closeTime ?? null,
          breakStart: resolvedStore?.breakStart ?? null,
          breakEnd: resolvedStore?.breakEnd ?? null,
          rating: resolvedStore?.rating ?? null,
          reviewAverageRating: resolvedStore?.reviewAverageRating ?? null,
          reviewCount: resolvedStore?.reviewCount ?? 0,
          favoriteCount: resolvedStore?.favoriteCount ?? 0,
          imageUrls: resolvedStore?.imageUrls ?? [],
          operationalState: resolvedStore?.operationalState ?? null,
          closureRequestStatus: resolvedStore?.closureRequestStatus ?? null,
          menuEligible: resolvedStore?.menuEligible ?? false,
          menuEditable: resolvedStore?.menuEditable ?? false,
          menuEligibilityReason: resolvedStore?.menuEligibilityReason ?? null,
          distance: item.document.distance,
          sourceLabel: item.sourceLabel,
        } as ListStoreItem;
      });

      setStores(mergedStores);
    } catch (error) {
      setStores([]);
      setStoresError(error instanceof Error ? error.message : '매장 정보를 불러오지 못했어요.');
      if (error instanceof Error) {
        Alert.alert('리스트 불러오기 실패', error.message);
      }
    } finally {
      setIsStoresLoading(false);
    }
  }, [selectedFilters]);

  useEffect(() => {
    let active = true;

    const initializeLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (!active) return;

        if (status !== 'granted') {
          setStoresError('위치 권한이 필요해요.');
          setIsStoresLoading(false);
          return;
        }

        const hasServices = await Location.hasServicesEnabledAsync();

        if (!active) return;

        if (!hasServices) {
          setStoresError('위치 서비스를 켜야 주변 매장을 볼 수 있어요.');
          setIsStoresLoading(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!active) return;

        const coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        setCurrentCoords(coords);
      } catch {
        if (!active) return;
        setStoresError('현재 위치를 가져오지 못했어요.');
        setIsStoresLoading(false);
      }
    };

    initializeLocation();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!currentCoords) return;

    void fetchStores(currentCoords);
  }, [currentCoords, fetchStores]);

  const displayedStores = useMemo(() => {
    const filtered = stores.filter((store) => {
      if (selectedFilters.length === 0) return true;
      return selectedFilters.some((filter) => matchesFilter(store, filter));
    });

    const comparators: Record<string, (a: ListStoreItem, b: ListStoreItem) => number> = {
      '가까운 순': () => 0,
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

    return '상태정보 없음';
  }, []);

  const getStatusSourceLabel = useCallback((store: ListStoreItem) => {
    if (store.liveStatusSource === 'OWNER_POS') return '사장님 반영 업데이트';
    if (store.liveStatusSource === 'SYSTEM') return '시스템 반영 업데이트';
    if (store.liveStatusSource === 'ADMIN') return '관리자 반영 업데이트';
    return '서버 반영 업데이트';
  }, []);

  const getRatingLabel = useCallback((store: ListStoreItem) => {
    const rating = store.reviewAverageRating ?? store.rating;
    if (rating === null || rating === undefined) return '—';
    return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>통합 리스트</Text>
          <View style={{width: 26}} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#8f9bb3" style={styles.searchIcon} />
            <TextInput 
              style={styles.searchInput}
              placeholder="이름, 카테고리 검색"
              placeholderTextColor="#8f9bb3"
            />
          </View>
          <TouchableOpacity style={styles.filterIconButton} onPress={() => setIsFilterPanelOpen((previous) => !previous)}>
            <Ionicons name="options-outline" size={24} color="#333" />
          </TouchableOpacity>
        </View>

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
          <Text style={styles.totalCountText}>총 <Text style={{color: '#00e676', fontWeight: 'bold'}}>10</Text>건</Text>
          <View style={styles.listInfoRight}>
            <TouchableOpacity style={styles.locationSearchBtn}>
              <MaterialIcons name="my-location" size={14} color="#fff" style={{marginRight: 4}} />
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
          {isStoresLoading ? (
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
                  <TouchableOpacity>
                    <Ionicons name="heart-outline" size={24} color="#fff" />
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
                    <Text style={styles.footerText}>{store.favoriteCount}</Text>
                  </View>
                </View>
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
    backgroundColor: '#2a2e3d',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
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
    color: '#333',
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
    color: '#8f9bb3',
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
    backgroundColor: 'rgba(12,18,31,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  filterPanelTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  filterPanelActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterResetText: {
    color: '#8cb4ff',
    fontSize: 13,
    fontWeight: '700',
  },
  filterDoneText: {
    color: '#fff',
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
    color: '#8f9bb3',
    fontSize: 14,
  },
  listInfoRight: {
    flexDirection: 'row',
    gap: 8,
  },
  locationSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4a5b82',
    backgroundColor: 'rgba(74, 91, 130, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  locationSearchText: {
    color: '#fff',
    fontSize: 12,
  },
  sortDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b3f51',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  sortText: {
    color: '#d1d5db',
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#3b3f51',
    width: '100%',
  },
  sortPanel: {
    marginTop: 10,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(12,18,31,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sortPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sortPanelTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  sortPanelActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sortResetText: {
    color: '#8cb4ff',
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
    color: '#fff',
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
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  sortOptionSubtitle: {
    color: 'rgba(255,255,255,0.56)',
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
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    color: '#8f9bb3',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  sortRadio: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortRadioActive: {
    borderColor: '#8cb4ff',
    backgroundColor: 'rgba(140,180,255,0.12)',
  },
  listContainer: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#34384b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
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
    color: '#fff',
  },
  categoryBadge: {
    backgroundColor: 'rgba(66, 107, 255, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 16,
  },
  categoryText: {
    color: '#8cb4ff',
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
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusUpdateText: {
    color: '#8f9bb3',
    fontSize: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    color: '#c5c9d6',
    fontSize: 13,
    marginLeft: 6,
  },
  cardFooterDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 14,
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
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 85,
    backgroundColor: '#232634',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#34384b',
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
    color: '#fff',
    fontWeight: 'bold',
  },
});
