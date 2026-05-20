import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  InteractionManager,
  PanResponder,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { AppBottomNav } from '@/components/app-bottom-nav';
import { ApiClientError, favoritesApi, myMapApi, publicInstitutionsApi, storesApi, tokenStore, userMapsApi } from '@/services/api';
import { mapCache } from '@/services/mapCache';
import { CATEGORY_KEYWORDS, CATEGORY_OPTIONS, type CategoryOption } from '@/services/placeCategories';
import type { PublicInstitutionLookupItemResponse, StoreLookupItemResponse } from '@/services/api/types';

const { height: windowHeight } = Dimensions.get('window');
const MIN_SHEET_HEIGHT = 92;
const BOTTOM_NAV_HEIGHT = 78;
const NEARBY_PLACES_CACHE_KEY = 'toggle.nearbyPlaces';
const DEFAULT_MAP_SEARCH_RADIUS_METERS = 1000;
const NEARBY_PLACE_LIMIT_OPTIONS = [10, 20, 30, 40, 50];

type KakaoPlacePreview = {
  id: string;
  name: string;
  category: string;
  address: string;
  distance?: string;
  phone?: string;
  latitude: number;
  longitude: number;
};

const getStorePlaceId = (store: StoreLookupItemResponse) => {
  return store.externalPlaceId || `STORE_${store.storeId}`;
};

const normalizeRegisteredStoreAsPlace = (store: StoreLookupItemResponse): KakaoPlacePreview => ({
  id: getStorePlaceId(store),
  name: store.name,
  category: store.categoryName ?? '등록 매장',
  address: store.roadAddress || store.address || store.jibunAddress || '',
  phone: store.phone ?? '',
  latitude: store.latitude,
  longitude: store.longitude,
});

const normalizePublicInstitutionAsPlace = (publicInstitution: PublicInstitutionLookupItemResponse): KakaoPlacePreview | null => {
  if (typeof publicInstitution.latitude !== 'number' || typeof publicInstitution.longitude !== 'number') {
    return null;
  }

  return {
    id: `PUBLIC_${publicInstitution.id}`,
    name: publicInstitution.name ?? '공공 장소',
    category: '공공기관',
    address: publicInstitution.address ?? '',
    latitude: publicInstitution.latitude,
    longitude: publicInstitution.longitude,
  };
};

const toKakaoRenderablePlace = (place: KakaoPlacePreview) => ({
  id: place.id,
  place_name: place.name,
  category_name: place.category,
  category_group_name: place.category,
  road_address_name: place.address,
  address_name: place.address,
  phone: place.phone ?? '',
  distance: place.distance ?? '',
  y: String(place.latitude),
  x: String(place.longitude),
});

const mergePlacePreviews = (places: KakaoPlacePreview[], registeredPlaces: KakaoPlacePreview[]) => {
  const seen = new Set<string>();
  const merged: KakaoPlacePreview[] = [];

  [...places, ...registeredPlaces].forEach((place) => {
    const key = place.id || `${place.name}-${place.latitude}-${place.longitude}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(place);
  });

  return merged;
};

const normalizeSearchText = (value: string | null | undefined) => {
  return (value ?? '').toLowerCase().replace(/\s+/g, '');
};

const formatSearchRadiusLabel = (radiusMeters: number) => {
  if (radiusMeters < 1000) {
    return `${radiusMeters}m`;
  }

  const kilometers = radiusMeters / 1000;
  return Number.isInteger(kilometers) ? `${kilometers}km` : `${kilometers.toFixed(1)}km`;
};

const storeMatchesKeyword = (store: StoreLookupItemResponse, query: string | null) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  return [
    store.name,
    store.categoryName,
    store.address,
    store.roadAddress,
    store.jibunAddress,
    store.phone,
  ].some((value) => normalizeSearchText(value).includes(normalizedQuery));
};

const storeMatchesCategory = (store: StoreLookupItemResponse, categoryLabel: string | null) => {
  if (!categoryLabel || categoryLabel === '전체') return true;

  const haystack = normalizeSearchText([
    store.categoryName,
    store.name,
    store.address,
    store.roadAddress,
    store.jibunAddress,
  ].filter(Boolean).join(' '));
  const keywords = CATEGORY_KEYWORDS[categoryLabel] ?? [categoryLabel];
  const excludedKeywords = categoryLabel === '음식점'
    ? ['카페', '커피', '디저트', '베이커리', 'cafe', 'coffee']
    : [];

  if (excludedKeywords.some((keyword) => haystack.includes(normalizeSearchText(keyword)))) {
    return false;
  }

  return keywords.some((keyword) => {
    const normalizedKeyword = normalizeSearchText(keyword);
    return normalizedKeyword.length > 0 && haystack.includes(normalizedKeyword);
  });
};

const filterRegisteredStoresForSearchContext = (
  stores: StoreLookupItemResponse[],
  context: {
    query: string | null;
    categoryLabel: string | null;
  }
) => {
  return stores.filter((store) => {
    if (context.query) {
      return storeMatchesKeyword(store, context.query);
    }

    return storeMatchesCategory(store, context.categoryLabel);
  });
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const isConflictError = (error: unknown) => error instanceof ApiClientError && error.status === 409;
const isNotFoundError = (error: unknown) => error instanceof ApiClientError && error.status === 404;

export default function MapAroundScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ query?: string | string[]; mapId?: string | string[]; mapTitle?: string | string[] }>();
  const searchParam = Array.isArray(params.query) ? params.query[0] : params.query;
  const mapIdParam = Array.isArray(params.mapId) ? params.mapId[0] : params.mapId;
  const scopedMapTitleParam = Array.isArray(params.mapTitle) ? params.mapTitle[0] : params.mapTitle;
  const initialSearchQuery = (searchParam ?? '').trim();
  const scopedMapId = mapIdParam ? Number(mapIdParam) : null;
  const isScopedMapMode = Boolean(scopedMapId);
  const showInternalTabBar = pathname !== '/map';
  const sheetBottomOffset = showInternalTabBar ? BOTTOM_NAV_HEIGHT : 0;
  const defaultSheetHeight = Math.min(windowHeight * 0.54, windowHeight - sheetBottomOffset - 12);
  const maxSheetHeight = windowHeight - sheetBottomOffset - 12;
  const webViewRef = useRef<React.ElementRef<typeof WebView>>(null);
  const cardScrollRef = useRef<ScrollView>(null);
  const sheetHeight = useRef(new Animated.Value(defaultSheetHeight)).current;
  const sheetHeightValue = useRef(defaultSheetHeight);
  const dragStartHeight = useRef(defaultSheetHeight);
  const currentCoordsRef = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const searchRadiusMetersRef = useRef(DEFAULT_MAP_SEARCH_RADIUS_METERS);
  const [activeFilter, setActiveFilter] = useState('전체');
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState('전체');
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [isSheetExpanded, setIsSheetExpanded] = useState(true);
  const [isMapSortOpen, setIsMapSortOpen] = useState(false);
  const [selectedMapSorts, setSelectedMapSorts] = useState<string[]>([]);
  const [nearbyPlaces, setNearbyPlaces] = useState<KakaoPlacePreview[]>([]);
  const [isPlacesLoading, setIsPlacesLoading] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState(initialSearchQuery);
  const [isMapReady, setIsMapReady] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [searchRadiusMeters, setSearchRadiusMeters] = useState(DEFAULT_MAP_SEARCH_RADIUS_METERS);
  const [nearbyPlaceLimit, setNearbyPlaceLimit] = useState(10);
  const [favoritedPlaceIds, setFavoritedPlaceIds] = useState<string[]>([]);
  const [favoriteStoreIdByExternalPlaceId, setFavoriteStoreIdByExternalPlaceId] = useState<Record<string, number>>({});
  const [registeredStoreIdsByExternalPlaceId, setRegisteredStoreIdsByExternalPlaceId] = useState<Record<string, number>>({});
  const [registeredStoreDetailsByExternalPlaceId, setRegisteredStoreDetailsByExternalPlaceId] = useState<Record<string, StoreLookupItemResponse>>({});
  const [scopedMapTitle, setScopedMapTitle] = useState(scopedMapTitleParam ?? '내 지도');

  const categories = CATEGORY_OPTIONS;
  const mapSortOptions = [
    { title: '영업중만', subtitle: '영업 중인 매장만 보기' },
    { title: '별점 높은 순', subtitle: '별점이 높은 순' },
    { title: '리뷰 많은 순', subtitle: '리뷰가 많은 순' },
    { title: '찜 많은 순', subtitle: '찜이 많은 순' },
  ];

  const mapSortButtonLabel = selectedMapSorts.length === 0
    ? '기본순'
    : selectedMapSorts.length === 1
      ? selectedMapSorts[0]
      : `${selectedMapSorts[0]} 외 ${selectedMapSorts.length - 1}개`;
  const searchRadiusLabel = formatSearchRadiusLabel(searchRadiusMeters);
  const visibleNearbyPlaces = nearbyPlaces.slice(0, nearbyPlaceLimit);
  const visibleNearbyPlaceCount = visibleNearbyPlaces.length;
  const totalNearbyPlaceCount = nearbyPlaces.length;
  const screenTitle = isScopedMapMode ? scopedMapTitle : '내 주변 장소';

  const toggleMapSort = useCallback((title: string) => {
    setSelectedMapSorts((current) => (
      current.includes(title)
        ? current.filter((item) => item !== title)
        : [...current, title]
    ));
  }, []);

  const resetAndCloseMapSorts = useCallback(() => {
    setSelectedMapSorts([]);
    setIsMapSortOpen(false);
  }, []);

  const closeMapSortPanel = useCallback(() => {
    setIsMapSortOpen(false);
  }, []);

  const scrollCardListToTop = useCallback(() => {
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        cardScrollRef.current?.scrollTo({ y: 0, animated: false });
      });
    });
  }, []);

  const refreshRegisteredStoreState = useCallback(async (
    places: KakaoPlacePreview[],
    knownStores: StoreLookupItemResponse[] = []
  ) => {
    if (places.length === 0 && knownStores.length === 0) {
      setRegisteredStoreIdsByExternalPlaceId({});
      setRegisteredStoreDetailsByExternalPlaceId({});
      webViewRef.current?.injectJavaScript(`
        window.setRegisteredStoreIds({});
        true;
      `);
      return;
    }

    try {
      const lookupPlaceIds = places
        .map((place) => place.id)
        .filter((placeId) => placeId && !placeId.startsWith('STORE_') && !placeId.startsWith('PUBLIC_'));
      const lookup = lookupPlaceIds.length > 0
        ? await storesApi.lookup({
            externalSource: 'KAKAO',
            externalPlaceIds: lookupPlaceIds,
          })
        : { stores: [] };
      const storesById = [...lookup.stores, ...knownStores].reduce<Record<number, StoreLookupItemResponse>>((acc, store) => {
        acc[store.storeId] = store;
        return acc;
      }, {});
      const registeredStores = Object.values(storesById);

      const nextRegisteredStoreIds = registeredStores.reduce<Record<string, number>>((acc, store) => {
        acc[getStorePlaceId(store)] = store.storeId;
        return acc;
      }, {});

      setRegisteredStoreIdsByExternalPlaceId(nextRegisteredStoreIds);
      webViewRef.current?.injectJavaScript(`
        window.setRegisteredStoreIds(${JSON.stringify(nextRegisteredStoreIds)});
        true;
      `);

      const detailsByExternalPlaceId = registeredStores.reduce<Record<string, StoreLookupItemResponse>>((acc, store) => {
        acc[getStorePlaceId(store)] = store;
        return acc;
      }, {});
      setRegisteredStoreDetailsByExternalPlaceId(detailsByExternalPlaceId);
    } catch {
      setRegisteredStoreIdsByExternalPlaceId({});
      setRegisteredStoreDetailsByExternalPlaceId({});
    }
  }, []);

  const renderScopedMapPlaces = useCallback((places: KakaoPlacePreview[], knownStores: StoreLookupItemResponse[]) => {
    setNearbyPlaces(places);
    setNearbyPlaceLimit(Math.max(places.length, 10));
    setIsPlacesLoading(false);
    void refreshRegisteredStoreState(places, knownStores);

    webViewRef.current?.injectJavaScript(`
      if (window.renderPlacesFromApp) {
        window.renderPlacesFromApp(
          ${JSON.stringify(places.map(toKakaoRenderablePlace))},
          ${JSON.stringify(scopedMapTitle || '내 지도')},
          null,
          true
        );
      }
      true;
    `);
  }, [refreshRegisteredStoreState, scopedMapTitle]);

  const loadScopedMapPlaces = useCallback(async () => {
    if (!scopedMapId || !isMapReady) return;

    try {
      setIsPlacesLoading(true);
      const mapDetail = await userMapsApi.get(scopedMapId);
      setScopedMapTitle(mapDetail.map.title || scopedMapTitleParam || '내 지도');

      const [storeResponse, publicResponse] = await Promise.all([
        mapDetail.stores.length > 0
          ? storesApi.listByIds(mapDetail.stores)
          : Promise.resolve({ stores: [] } as { stores: StoreLookupItemResponse[] }),
        mapDetail.publicInstitutions.length > 0
          ? publicInstitutionsApi.getByIds(mapDetail.publicInstitutions)
          : Promise.resolve({ institutions: [] } as { institutions: PublicInstitutionLookupItemResponse[] }),
      ]);

      const storePlaces = (storeResponse.stores ?? []).map(normalizeRegisteredStoreAsPlace);
      const publicPlaces = (publicResponse.institutions ?? [])
        .map(normalizePublicInstitutionAsPlace)
        .filter((place): place is KakaoPlacePreview => Boolean(place));

      renderScopedMapPlaces([...storePlaces, ...publicPlaces], storeResponse.stores ?? []);
    } catch (error) {
      setNearbyPlaces([]);
      setIsPlacesLoading(false);
      Alert.alert('내 지도', error instanceof Error ? error.message : '지도에 담긴 장소를 불러오지 못했어요.');
    }
  }, [isMapReady, renderScopedMapPlaces, scopedMapId, scopedMapTitleParam]);

  const applyNearbyPlaces = useCallback((
    places: KakaoPlacePreview[],
    context: {
      query: string | null;
      categoryLabel: string | null;
      categoryCode: string | null;
      latitude: number | null;
      longitude: number | null;
    }
  ) => {
    const enrichAndApplyPlaces = async () => {
      let mergedPlaces = places;
      let nearbyRegisteredStores: StoreLookupItemResponse[] = [];
      const latitude = context.latitude;
      const longitude = context.longitude;

      if (typeof latitude === 'number' && typeof longitude === 'number') {
        try {
          const nearbyStoreResponse = await storesApi.nearby(latitude, longitude, searchRadiusMetersRef.current, 50);
          nearbyRegisteredStores = filterRegisteredStoresForSearchContext(nearbyStoreResponse.stores, {
            query: context.query,
            categoryLabel: context.categoryLabel,
          });
          mergedPlaces = mergePlacePreviews(
            places,
            nearbyRegisteredStores.map(normalizeRegisteredStoreAsPlace)
          );
        } catch {
          nearbyRegisteredStores = [];
        }
      }

      setNearbyPlaces(mergedPlaces);
      mapCache.setNearbyPlaces(mergedPlaces);
      mapCache.setNearbySearchContext(context);
      setIsPlacesLoading(false);

      try {
        globalThis.localStorage?.setItem(NEARBY_PLACES_CACHE_KEY, JSON.stringify(mergedPlaces));
      } catch {
        // Ignore storage failures; the map result itself is still shown.
      }

      webViewRef.current?.injectJavaScript(`
        if (window.renderPlacesFromApp) {
          window.renderPlacesFromApp(
            ${JSON.stringify(mergedPlaces.map(toKakaoRenderablePlace))},
            ${JSON.stringify(context.categoryLabel ?? '전체')},
            ${JSON.stringify(context.categoryCode)}
          );
        }
        true;
      `);

      void refreshRegisteredStoreState(mergedPlaces, nearbyRegisteredStores);
    };

    void enrichAndApplyPlaces();
  }, [refreshRegisteredStoreState]);

  const searchPlacesByCategory = useCallback((category: CategoryOption) => {
    setIsPlacesLoading(true);
    webViewRef.current?.injectJavaScript(`
      window.searchPlacesByCategory(${JSON.stringify(category.label)}, ${JSON.stringify(category.code)});
      true;
    `);
  }, []);

  const searchPlacesByKeyword = useCallback((query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    setIsPlacesLoading(true);
    webViewRef.current?.injectJavaScript(`
      window.__togglePendingKeywordQuery = ${JSON.stringify(trimmedQuery)};
      if (window.searchPlacesByKeyword) {
        window.searchPlacesByKeyword(${JSON.stringify(trimmedQuery)});
      }
      true;
    `);
  }, []);

  const selectNearbyPlaceLimit = useCallback((limit: number) => {
    setNearbyPlaceLimit(limit);
    webViewRef.current?.injectJavaScript(`
      if (window.setVisiblePlacesLimit) {
        window.setVisiblePlacesLimit(${limit});
      }
      true;
    `);
  }, []);

  useEffect(() => {
    if (!isMapReady) return;

    webViewRef.current?.injectJavaScript(`
      if (window.setVisiblePlacesLimit) {
        window.setVisiblePlacesLimit(${nearbyPlaceLimit});
      }
      true;
    `);
  }, [isMapReady, nearbyPlaceLimit]);

  useEffect(() => {
    scrollCardListToTop();
  }, [nearbyPlaces, nearbyPlaceLimit, isSheetExpanded, scrollCardListToTop]);

  const submitMapSearch = useCallback(() => {
    const trimmedQuery = mapSearchQuery.trim();
    const currentCategoryLabel = selectedCategoryLabel === '전체' ? null : selectedCategoryLabel;

    if (!trimmedQuery) {
      setActiveFilter('전체');
      mapCache.setNearbySearchContext({
        query: null,
        categoryLabel: currentCategoryLabel,
        categoryCode: null,
        latitude: currentCoordsRef.current?.latitude ?? currentCoords?.latitude ?? null,
        longitude: currentCoordsRef.current?.longitude ?? currentCoords?.longitude ?? null,
      });
      searchPlacesByCategory({ label: '전체', code: null });
      return;
    }

    setActiveFilter(trimmedQuery);
    mapCache.setNearbySearchContext({
      query: trimmedQuery,
      categoryLabel: currentCategoryLabel,
      categoryCode: null,
      latitude: currentCoordsRef.current?.latitude ?? currentCoords?.latitude ?? null,
      longitude: currentCoordsRef.current?.longitude ?? currentCoords?.longitude ?? null,
    });
    searchPlacesByKeyword(trimmedQuery);
  }, [
    currentCoords?.latitude,
    currentCoords?.longitude,
    mapSearchQuery,
    searchPlacesByCategory,
    searchPlacesByKeyword,
    selectedCategoryLabel,
  ]);

  const selectCategory = useCallback((category: CategoryOption) => {
    setActiveFilter(category.label);
    setSelectedCategoryLabel(category.label);
    mapCache.setNearbySearchContext({
      query: null,
      categoryLabel: category.label === '전체' ? null : category.label,
      categoryCode: category.code,
      latitude: currentCoordsRef.current?.latitude ?? currentCoords?.latitude ?? null,
      longitude: currentCoordsRef.current?.longitude ?? currentCoords?.longitude ?? null,
    });
    setIsCategoryMenuOpen(false);
    searchPlacesByCategory(category);
  }, [currentCoords?.latitude, currentCoords?.longitude, searchPlacesByCategory]);

  const setSheetHeight = useCallback((nextHeight: number, animated = true) => {
    const clampedHeight = clamp(nextHeight, MIN_SHEET_HEIGHT, maxSheetHeight);

    sheetHeightValue.current = clampedHeight;
    setIsSheetExpanded(clampedHeight > MIN_SHEET_HEIGHT + 24);

    if (clampedHeight <= MIN_SHEET_HEIGHT + 24) {
      setIsMapSortOpen(false);
    }

    if (animated) {
      Animated.spring(sheetHeight, {
        toValue: clampedHeight,
        useNativeDriver: false,
        damping: 22,
        stiffness: 180,
        mass: 0.8,
      }).start(() => {
        scrollCardListToTop();
      });
      return;
    }

    sheetHeight.setValue(clampedHeight);
    scrollCardListToTop();
  }, [maxSheetHeight, scrollCardListToTop, sheetHeight]);

  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 4,
      onPanResponderGrant: () => {
        dragStartHeight.current = sheetHeightValue.current;
      },
      onPanResponderMove: (_, gestureState) => {
        setSheetHeight(dragStartHeight.current - gestureState.dy, false);
      },
      onPanResponderRelease: () => {
        setSheetHeight(sheetHeightValue.current, true);
      },
      onPanResponderTerminate: () => {
        setSheetHeight(sheetHeightValue.current, true);
      },
    })
  ).current;

  const moveMapToLocation = useCallback((latitude: number, longitude: number) => {
    webViewRef.current?.injectJavaScript(`
      window.moveToCurrentLocation(${latitude}, ${longitude});
      true;
    `);
  }, []);

  const moveToCurrentLocation = useCallback(async (showErrorAlert = true, forceFreshLocation = false) => {
    try {
      if (forceFreshLocation && currentCoordsRef.current) {
        moveMapToLocation(currentCoordsRef.current.latitude, currentCoordsRef.current.longitude);
      }

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        if (showErrorAlert) {
          Alert.alert('위치 권한 필요', '현재 위치를 기준으로 보려면 위치 권한을 허용해주세요.');
        }
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();

      if (!servicesEnabled) {
        if (showErrorAlert) {
          Alert.alert('위치 서비스 꺼짐', '에뮬레이터 설정에서 위치 서비스를 켜주세요.');
        }
        return;
      }

      const currentLocation = forceFreshLocation
        ? await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }).catch(() => Location.getLastKnownPositionAsync())
        : await Location.getLastKnownPositionAsync() ??
          await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

      if (!currentLocation) {
        if (showErrorAlert) {
          Alert.alert('위치 확인 실패', '현재 위치를 가져오지 못했어요. 에뮬레이터 위치 설정을 확인해주세요.');
        }
        return;
      }

      const nextCoords = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };

      // Store the latest location in a ref so map drags do not retrigger the initial location effect.
      currentCoordsRef.current = nextCoords;
      setCurrentCoords(nextCoords);
      moveMapToLocation(nextCoords.latitude, nextCoords.longitude);
    } catch {
      if (showErrorAlert) {
        Alert.alert('위치 확인 실패', '현재 위치를 가져오지 못했어요. 에뮬레이터 위치 설정을 확인해주세요.');
      }
    }
  }, [moveMapToLocation]);

  useEffect(() => {
    if (isScopedMapMode) return;
    moveToCurrentLocation(false);
  }, [isScopedMapMode, moveToCurrentLocation]);

  useEffect(() => {
    if (!isScopedMapMode) return;
    void loadScopedMapPlaces();
  }, [isScopedMapMode, loadScopedMapPlaces]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadAuthAndFavoritesState = async () => {
        const accessToken = await tokenStore.getAccessToken();
        if (!active) return;
        const loggedIn = Boolean(accessToken);
        setIsLoggedIn(loggedIn);

        if (!loggedIn) {
          setFavoritedPlaceIds([]);
          setFavoriteStoreIdByExternalPlaceId({});
          return;
        }

        try {
          const favorites = await favoritesApi.listStores();
          if (!active) return;

          setFavoritedPlaceIds(favorites.content.map((item) => item.externalPlaceId));
          setFavoriteStoreIdByExternalPlaceId(
            favorites.content.reduce<Record<string, number>>((acc, item) => {
              acc[item.externalPlaceId] = item.storeId;
              return acc;
            }, {})
          );
        } catch {
          if (!active) return;
          setFavoritedPlaceIds([]);
          setFavoriteStoreIdByExternalPlaceId({});
        }
      };

      void loadAuthAndFavoritesState();

      return () => {
        active = false;
      };
    }, [])
  );

  useEffect(() => {
    if (isScopedMapMode) return;
    if (!initialSearchQuery || !isMapReady) return;

    setMapSearchQuery(initialSearchQuery);
    setSelectedCategoryLabel('전체');
    mapCache.setNearbySearchContext({
      query: initialSearchQuery,
      categoryLabel: null,
      categoryCode: null,
      latitude: currentCoordsRef.current?.latitude ?? currentCoords?.latitude ?? null,
      longitude: currentCoordsRef.current?.longitude ?? currentCoords?.longitude ?? null,
    });
    searchPlacesByKeyword(initialSearchQuery);
  }, [
    currentCoords?.latitude,
    currentCoords?.longitude,
    initialSearchQuery,
    isScopedMapMode,
    isMapReady,
    searchPlacesByKeyword,
  ]);

  useFocusEffect(
    useCallback(() => {
      setIsCategoryMenuOpen(false);
      setIsMapSortOpen(false);
      setSelectedMapSorts([]);
      setActiveFilter(isScopedMapMode ? '내 지도' : initialSearchQuery || '전체');
      if (!initialSearchQuery && !isScopedMapMode) {
        const context = mapCache.getNearbySearchContext();
        if (context.categoryLabel) {
          setSelectedCategoryLabel(context.categoryLabel);
          setActiveFilter(context.categoryLabel);
        } else {
          setSelectedCategoryLabel('전체');
        }
      }
      setIsSheetExpanded(true);
      setSheetHeight(defaultSheetHeight, false);
      requestAnimationFrame(() => {
        cardScrollRef.current?.scrollTo({ y: 0, animated: false });
      });
    }, [defaultSheetHeight, initialSearchQuery, isScopedMapMode, setSheetHeight])
  );

  const handleWebViewMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      if (message.type === 'places') {
        const places = Array.isArray(message.places) ? message.places : [];
        const context = mapCache.getNearbySearchContext();
        const nextSearchRadiusMeters = typeof message.searchRadiusMeters === 'number'
          ? message.searchRadiusMeters
          : null;
        const searchCenter = message.searchCenter && typeof message.searchCenter === 'object'
          ? message.searchCenter
          : null;
        const latitude = typeof searchCenter?.latitude === 'number'
          ? searchCenter.latitude
          : currentCoordsRef.current?.latitude ?? currentCoords?.latitude ?? null;
        const longitude = typeof searchCenter?.longitude === 'number'
          ? searchCenter.longitude
          : currentCoordsRef.current?.longitude ?? currentCoords?.longitude ?? null;
        if (nextSearchRadiusMeters) {
          searchRadiusMetersRef.current = nextSearchRadiusMeters;
          setSearchRadiusMeters(nextSearchRadiusMeters);
        }
        applyNearbyPlaces(places, {
          query: typeof message.query === 'string' && message.query.trim()
            ? message.query.trim()
            : null,
          categoryLabel: typeof message.categoryLabel === 'string' && message.categoryLabel !== '전체'
            ? message.categoryLabel
            : null,
          categoryCode: typeof message.categoryCode === 'string' && message.categoryCode
            ? message.categoryCode
            : context.categoryCode,
          latitude,
          longitude,
        });
      }

      if (message.type === 'places-loading') {
        setIsPlacesLoading(true);
      }

      if (message.type === 'viewport-changed') {
        const nextSearchRadiusMeters = typeof message.searchRadiusMeters === 'number'
          ? message.searchRadiusMeters
          : null;
        if (nextSearchRadiusMeters) {
          searchRadiusMetersRef.current = nextSearchRadiusMeters;
          setSearchRadiusMeters(nextSearchRadiusMeters);
        }
      }

      if (message.type === 'map-ready') {
        setIsMapReady(true);
      }

      if (message.type === 'place-click') {
        const placeId = String(message.placeId ?? '');
        const storeId = Number(message.storeId ?? registeredStoreIdsByExternalPlaceId[placeId] ?? 0);

        if (storeId) {
          router.push({
            pathname: '/views/store_detail',
            params: {
              storeId: String(storeId),
              storeName: String(message.placeName ?? ''),
            },
          });
          return;
        }

        Alert.alert('매장 상세', '아직 우리 서비스에 등록되지 않은 장소예요.');
      }
    } catch {
      // Ignore non-JSON messages from the map WebView.
    }
  }, [
    applyNearbyPlaces,
    currentCoords?.latitude,
    currentCoords?.longitude,
    registeredStoreIdsByExternalPlaceId,
    router,
  ]);

  const searchCurrentMapArea = useCallback(() => {
    setIsPlacesLoading(true);
    webViewRef.current?.injectJavaScript(`
      window.searchPlacesInCurrentMap();
      true;
    `);
  }, []);

  const handleFavoritePress = useCallback(async (place: KakaoPlacePreview) => {
    if (!isLoggedIn) {
      Alert.alert(
        '로그인이 필요해요',
        '찜은 로그인 후 사용할 수 있어요.',
        [
          { text: '취소', style: 'cancel' },
          { text: '로그인 페이지로 이동', onPress: () => router.replace('/views/user_login') },
        ]
      );
      return;
    }

    const isFavorited = favoritedPlaceIds.includes(place.id);

    try {
      if (isFavorited) {
        const storeId = favoriteStoreIdByExternalPlaceId[place.id];

        if (!storeId) {
          Alert.alert('찜 취소 실패', '저장된 매장 정보를 찾지 못했어요.');
          return;
        }

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

        setFavoritedPlaceIds((current) => current.filter((id) => id !== place.id));
        setFavoriteStoreIdByExternalPlaceId((current) => {
          const next = { ...current };
          delete next[place.id];
          return next;
        });
        return;
      }

      const resolvedStoreId =
        favoriteStoreIdByExternalPlaceId[place.id] ??
        registeredStoreIdsByExternalPlaceId[place.id];

      if (!resolvedStoreId) {
        Alert.alert(
          '찜할 수 없어요',
          '아직 백엔드에 등록되지 않은 장소예요. 등록된 매장만 찜할 수 있어요.'
        );
        return;
      }

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

      setFavoritedPlaceIds((current) => (current.includes(place.id) ? current : [...current, place.id]));
      setFavoriteStoreIdByExternalPlaceId((current) => ({
        ...current,
        [place.id]: resolvedStoreId,
      }));
    } catch {
      Alert.alert('찜 실패', '장소를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  }, [favoriteStoreIdByExternalPlaceId, favoritedPlaceIds, isLoggedIn, registeredStoreIdsByExternalPlaceId, router]);

  const kakaoMapHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background-color: #f0f0f5;
          }
          #map {
            width: 100%;
            height: 100%;
          }
        </style>
      </head>
      <body>
        <div id="map">
          <div id="log" style="padding: 20px; font-size: 16px; color: #333;">지도 로딩 시작...</div>
        </div>
        <script>
          function log(msg) {
            var el = document.getElementById('log');
            if(el) el.innerHTML += '<br/>' + msg;
          }
          log('스크립트 요청 중...');

          var map = null;
          var currentMarker = null;
          var searchRadiusCircle = null;
          var placeMarkers = [];
          var placesService = null;
          var pendingCurrentLocation = null;
          var isScopedMapMode = ${JSON.stringify(isScopedMapMode)};
          var pendingKeywordQuery = isScopedMapMode ? '' : window.__togglePendingKeywordQuery || ${JSON.stringify(initialSearchQuery)};
          var activeCategoryLabel = '전체';
          var activeCategoryCode = null;
          var activeKeywordQuery = pendingKeywordQuery;
          var registeredStoreIds = {};
          var lastRenderedPlaces = [];
          var searchRadiusMeters = ${DEFAULT_MAP_SEARCH_RADIUS_METERS};
          var visiblePlacesLimit = 10;
          var defaultCategoryCodes = ['FD6', 'CE7', 'CS2', 'MT1', 'PM9', 'HP8', 'PO3', 'CT1', 'SC4', 'SW8', 'PK6'];

          function postToApp(payload) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify(payload));
            }
          }

          function clearPlaceMarkers() {
            for (var i = 0; i < placeMarkers.length; i += 1) {
              placeMarkers[i].setMap(null);
            }
            placeMarkers = [];
          }

          function createMarkerImage(isRegistered) {
            var color = isRegistered ? '#ff4d74' : '#0ea5a4';
            var svg = [
              '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="46" viewBox="0 0 34 46">',
              '<path d="M17 44s12-14.2 12-24.1C29 11.7 23.6 6 17 6S5 11.7 5 19.9C5 29.8 17 44 17 44Z" fill="',
              color,
              '"/>',
              '<circle cx="17" cy="19" r="6.6" fill="#ffffff"/>',
              '<circle cx="17" cy="19" r="3.4" fill="',
              color,
              '"/>',
              '</svg>',
            ].join('');

            return new kakao.maps.MarkerImage(
              'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
              new kakao.maps.Size(34, 46),
              { offset: new kakao.maps.Point(17, 42) }
            );
          }

          function drawSearchRadiusCircle(center) {
            if (!map || !window.kakao || !center) return;

            if (searchRadiusCircle) {
              searchRadiusCircle.setMap(null);
            }

            searchRadiusCircle = new kakao.maps.Circle({
              center: center,
              radius: searchRadiusMeters,
              strokeWeight: 2,
              strokeColor: '#0ea5a4',
              strokeOpacity: 0.7,
              strokeStyle: 'solid',
              fillColor: '#0ea5a4',
              fillOpacity: 0.11
            });

            searchRadiusCircle.setMap(map);
          }

          function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
            var earthRadiusMeters = 6371000;
            var toRadians = Math.PI / 180;
            var dLat = (lat2 - lat1) * toRadians;
            var dLng = (lng2 - lng1) * toRadians;
            var sinLat = Math.sin(dLat / 2);
            var sinLng = Math.sin(dLng / 2);
            var a = sinLat * sinLat +
              Math.cos(lat1 * toRadians) * Math.cos(lat2 * toRadians) *
              sinLng * sinLng;
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return earthRadiusMeters * c;
          }

          function clampRadiusMeters(value) {
            return Math.max(100, Math.min(1000, Math.round(value)));
          }

          function syncSearchRadiusFromMap() {
            if (!map || !window.kakao) return searchRadiusMeters;

            var bounds = map.getBounds();
            if (!bounds) return searchRadiusMeters;

            var center = map.getCenter();
            var southWest = bounds.getSouthWest();
            var northEast = bounds.getNorthEast();
            var northEdge = new kakao.maps.LatLng(northEast.getLat(), center.getLng());
            var southEdge = new kakao.maps.LatLng(southWest.getLat(), center.getLng());
            var eastEdge = new kakao.maps.LatLng(center.getLat(), northEast.getLng());
            var westEdge = new kakao.maps.LatLng(center.getLat(), southWest.getLng());
            var maxDistance = Math.min(
              calculateDistanceMeters(center.getLat(), center.getLng(), northEdge.getLat(), northEdge.getLng()),
              calculateDistanceMeters(center.getLat(), center.getLng(), southEdge.getLat(), southEdge.getLng()),
              calculateDistanceMeters(center.getLat(), center.getLng(), eastEdge.getLat(), eastEdge.getLng()),
              calculateDistanceMeters(center.getLat(), center.getLng(), westEdge.getLat(), westEdge.getLng())
            );
            searchRadiusMeters = clampRadiusMeters(maxDistance);
            drawSearchRadiusCircle(center);
            postToApp({
              type: 'viewport-changed',
              searchRadiusMeters: searchRadiusMeters,
              searchCenter: {
                latitude: center.getLat(),
                longitude: center.getLng()
              }
            });
            return searchRadiusMeters;
          }

          function normalizePlace(place) {
            return {
              id: place.id,
              name: place.place_name,
              category: place.category_group_name || place.category_name || activeCategoryLabel,
              address: place.road_address_name || place.address_name || '',
              distance: place.distance || '',
              phone: place.phone || '',
              latitude: Number(place.y),
              longitude: Number(place.x)
            };
          }

          function dedupePlaces(items) {
            var seen = {};
            var result = [];

            for (var i = 0; i < items.length; i += 1) {
              var item = items[i];
              var key = item.id || item.place_name + '-' + item.x + '-' + item.y;

              if (!seen[key]) {
                seen[key] = true;
                result.push(item);
              }
            }

            return result;
          }

          function sortPlacesByDistance(items) {
            return items.sort(function(a, b) {
              return Number(a.distance || 9007199254740991) - Number(b.distance || 9007199254740991);
            });
          }

          function renderPlaces(places, shouldFitMap, shouldPostPlaces) {
            clearPlaceMarkers();
            lastRenderedPlaces = Array.isArray(places) ? places.slice() : [];

            var bounds = new kakao.maps.LatLngBounds();
            var limitedPlaces = sortPlacesByDistance(dedupePlaces(places)).slice(0, visiblePlacesLimit);

            for (var i = 0; i < limitedPlaces.length; i += 1) {
              let place = limitedPlaces[i];
              var position = new kakao.maps.LatLng(Number(place.y), Number(place.x));
              let marker = new kakao.maps.Marker({
                map: map,
                position: position,
                title: place.place_name,
                image: createMarkerImage(Boolean(registeredStoreIds[place.id]))
              });

              kakao.maps.event.addListener(marker, 'click', function() {
                postToApp({
                  type: 'place-click',
                  placeId: place.id,
                  placeName: place.place_name,
                  storeId: registeredStoreIds[place.id] || null
                });
              });

              placeMarkers.push(marker);
              bounds.extend(position);
            }

            if (shouldFitMap !== false && limitedPlaces.length > 0) {
              map.setBounds(bounds);
            }

            if (shouldPostPlaces !== false) {
              var searchCenter = map.getCenter();
              postToApp({
                type: 'places',
                places: limitedPlaces.map(normalizePlace),
                query: activeKeywordQuery || null,
                categoryLabel: activeKeywordQuery ? null : activeCategoryLabel,
                categoryCode: activeKeywordQuery ? null : activeCategoryCode,
                searchCenter: {
                  latitude: searchCenter.getLat(),
                  longitude: searchCenter.getLng()
                }
              });
            }
          }

          window.renderPlacesFromApp = function(places, label, categoryCode, shouldFitMap) {
            activeCategoryLabel = label || activeCategoryLabel || '전체';
            activeCategoryCode = categoryCode || null;
            activeKeywordQuery = '';
            pendingKeywordQuery = '';

            if (!map || !window.kakao || !Array.isArray(places)) return;

            renderPlaces(places, shouldFitMap === true, false);
          };

          window.setVisiblePlacesLimit = function(nextLimit) {
            var normalizedLimit = Number(nextLimit);
            if (!Number.isFinite(normalizedLimit) || normalizedLimit <= 0) return;

            visiblePlacesLimit = normalizedLimit;
            if (lastRenderedPlaces.length > 0) {
              renderPlaces(lastRenderedPlaces, false, false);
            }
          };

          window.setRegisteredStoreIds = function(nextRegisteredStoreIds) {
            registeredStoreIds = nextRegisteredStoreIds || {};

            if (lastRenderedPlaces.length > 0) {
              renderPlaces(lastRenderedPlaces, false, false);
            }
          };

          function runCategorySearch(categoryCode, options) {
            return new Promise(function(resolve) {
              placesService.categorySearch(categoryCode, function(data, status) {
                if (status === kakao.maps.services.Status.OK && data) {
                  resolve(data);
                  return;
                }

                resolve([]);
              }, options);
            });
          }

          function runKeywordSearch(query, options) {
            return new Promise(function(resolve) {
              placesService.keywordSearch(query, function(data, status) {
                if (status === kakao.maps.services.Status.OK && data) {
                  resolve(data);
                  return;
                }

                resolve([]);
              }, options);
            });
          }

          function createSearchOptions() {
            var center = map.getCenter();
            syncSearchRadiusFromMap();
            return {
              location: new kakao.maps.LatLng(center.getLat(), center.getLng()),
              sort: kakao.maps.services.SortBy.DISTANCE,
              radius: searchRadiusMeters,
              size: 15
            };
          }

          window.searchPlacesByKeyword = function(query) {
            activeKeywordQuery = (query || '').trim();
            pendingKeywordQuery = activeKeywordQuery;
            activeCategoryLabel = activeKeywordQuery || '전체';
            activeCategoryCode = null;

            if (!map || !placesService || !window.kakao) return;

            if (!activeKeywordQuery) {
              window.searchPlacesByCategory('전체', null);
              return;
            }

            pendingKeywordQuery = '';
            postToApp({ type: 'places-loading' });
            runKeywordSearch(activeKeywordQuery, createSearchOptions()).then(function(places) {
              renderPlaces(places, false);
            });
          };

          window.searchPlacesByCategory = function(label, categoryCode) {
            activeKeywordQuery = '';
            pendingKeywordQuery = '';
            activeCategoryLabel = label || '전체';
            activeCategoryCode = categoryCode || null;

            if (!map || !placesService || !window.kakao) return;

            postToApp({ type: 'places-loading' });

            var searchOptions = createSearchOptions();

            if (activeCategoryCode) {
              runCategorySearch(activeCategoryCode, searchOptions).then(function(places) {
                renderPlaces(places, false);
              });
              return;
            }

            if (activeCategoryLabel === '전체') {
              Promise.all(defaultCategoryCodes.map(function(code) {
                return runCategorySearch(code, searchOptions);
              })).then(function(results) {
                renderPlaces([].concat.apply([], results), false);
              });
              return;
            }

            runKeywordSearch(activeCategoryLabel, searchOptions).then(function(places) {
              renderPlaces(places, false);
            });
          };

          window.searchPlacesInCurrentMap = function() {
            if (!map || !placesService || !window.kakao) return;

            postToApp({ type: 'places-loading' });

            var searchOptions = createSearchOptions();

            if (activeKeywordQuery) {
              runKeywordSearch(activeKeywordQuery, searchOptions).then(function(places) {
                renderPlaces(places, false);
              });
              return;
            }

            if (activeCategoryCode) {
              runCategorySearch(activeCategoryCode, searchOptions).then(function(places) {
                renderPlaces(places, false);
              });
              return;
            }

            if (activeCategoryLabel === '전체') {
              Promise.all(defaultCategoryCodes.map(function(code) {
                return runCategorySearch(code, searchOptions);
              })).then(function(results) {
                renderPlaces([].concat.apply([], results), false);
              });
              return;
            }

            runKeywordSearch(activeCategoryLabel, searchOptions).then(function(places) {
              renderPlaces(places, false);
            });
          };

          window.moveToCurrentLocation = function(lat, lng) {
            pendingCurrentLocation = { lat: lat, lng: lng };

            if (!map || !window.kakao) return;

            var currentPosition = new kakao.maps.LatLng(lat, lng);
            map.setLevel(4);
            map.setCenter(currentPosition);
            syncSearchRadiusFromMap();

            if (currentMarker) {
              currentMarker.setMap(null);
            }

            currentMarker = new kakao.maps.Marker({
              map: map,
              position: currentPosition,
              title: '현재 위치'
            });

            if (placesService) {
              if (pendingKeywordQuery || activeKeywordQuery) {
                window.searchPlacesByKeyword(pendingKeywordQuery || activeKeywordQuery);
                return;
              }

              window.searchPlacesByCategory(activeCategoryLabel, activeCategoryCode);
            }
          };

          var script = document.createElement('script');
          script.src = "https://dapi.kakao.com/v2/maps/sdk.js?appkey=2d21c1757f136b1ff4079ef80c900b15&autoload=false&libraries=services";
          script.onload = function() {
            log('스크립트 로드 완료! 지도 객체 생성 중...');
            try {
              kakao.maps.load(function() {
                var mapContainer = document.getElementById('map');
                mapContainer.innerHTML = '';
                var mapOption = { 
                    center: new kakao.maps.LatLng(37.380482, 126.929841),
                    level: 4,
                    draggable: true,
                    scrollwheel: true,
                    disableDoubleClickZoom: false
                };
                map = new kakao.maps.Map(mapContainer, mapOption);
                // Keep Kakao's native JS gestures enabled; React Native overlays above use box-none.
                map.setDraggable(true);
                map.setZoomable(true);
                placesService = new kakao.maps.services.Places();
                kakao.maps.event.addListener(map, 'idle', function() {
                  syncSearchRadiusFromMap();
                });
                syncSearchRadiusFromMap();

                if (isScopedMapMode) {
                  clearPlaceMarkers();
                } else if (pendingCurrentLocation) {
                  window.moveToCurrentLocation(pendingCurrentLocation.lat, pendingCurrentLocation.lng);
                } else if (pendingKeywordQuery) {
                  window.searchPlacesByKeyword(pendingKeywordQuery);
                } else {
                  window.searchPlacesByCategory(activeCategoryLabel, activeCategoryCode);
                }

                postToApp({ type: 'map-ready' });
              });
            } catch(e) {
              log('오류 발생: ' + e.message);
            }
          };
          script.onerror = function() {
            log('❌ 에러: 카카오 서버에서 스크립트를 거부했습니다! (도메인 등록 필요)');
          };
          document.head.appendChild(script);
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* 1. Kakao Map WebView: uncovered map space must receive drag and pinch touches directly. */}
      <View style={styles.mapPlaceholder} pointerEvents="auto">
          <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: kakaoMapHtml, baseUrl: 'https://localhost' }}
          style={{ flex: 1 }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
          scrollEnabled={false}
          bounces={false}
          onMessage={handleWebViewMessage}
          onLoadEnd={() => {
            webViewRef.current?.injectJavaScript(`
              if (window.setVisiblePlacesLimit) {
                window.setVisiblePlacesLimit(${nearbyPlaceLimit});
              }
              true;
            `);
            if (!isScopedMapMode && currentCoords) {
              moveMapToLocation(currentCoords.latitude, currentCoords.longitude);
            }
          }}
        />
      </View>

      {/* 2. Top UI Overlays: parent containers pass empty-area touches down to the WebView map. */}
      <SafeAreaView style={styles.topOverlay} pointerEvents="box-none">
        {isScopedMapMode ? (
          <View style={styles.scopedHeader} pointerEvents="auto">
            <TouchableOpacity style={styles.scopedBackButton} onPress={() => router.back()} activeOpacity={0.9}>
              <Ionicons name="chevron-back" size={24} color="#0f172a" />
            </TouchableOpacity>
            <View style={styles.scopedHeaderTextWrap}>
              <Text style={styles.scopedHeaderTitle} numberOfLines={1}>{screenTitle}</Text>
              <Text style={styles.scopedHeaderSubtitle}>이 지도에 저장한 장소만 표시 중</Text>
            </View>
            <TouchableOpacity style={styles.scopedRefreshButton} onPress={() => void loadScopedMapPlaces()} activeOpacity={0.9}>
              <Ionicons name="refresh" size={20} color="#0ea5a4" />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Search Bar */}
            <View style={styles.searchContainer} pointerEvents="box-none">
              <TouchableOpacity onPress={() => setIsCategoryMenuOpen(true)} style={styles.menuButton}>
                <Ionicons name="menu" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.searchInputBox}>
                <Ionicons name="search" size={20} color="rgba(255,255,255,0.7)" />
                <TextInput
                  style={styles.searchTextInput}
                  value={mapSearchQuery}
                  onChangeText={setMapSearchQuery}
                  onSubmitEditing={submitMapSearch}
                  placeholder="장소, 버스, 지하철, 주소 검색"
                  placeholderTextColor="#94a3b8"
                  returnKeyType="search"
                />
              </View>
            </View>

            {/* Filter Pills */}
            <View style={styles.filterWrapper} pointerEvents="box-none">
              <ScrollView
                pointerEvents="auto"
                horizontal
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled={true}
                directionalLockEnabled={true}
                alwaysBounceHorizontal={false}
                scrollEventThrottle={16}
                style={styles.filterScrollView}
                contentContainerStyle={styles.filterScroll}
              >
                {categories.map((filter, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.filterPill,
                      activeFilter === filter.label ? styles.filterPillActive : null
                    ]}
                    onPress={() => selectCategory(filter)}
                  >
                    <Text style={[
                      styles.filterText,
                      activeFilter === filter.label ? styles.filterTextActive : null
                    ]}>{filter.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Search This Area Button */}
            <View style={styles.searchThisAreaContainer} pointerEvents="box-none">
              <TouchableOpacity style={styles.searchThisAreaButton} onPress={searchCurrentMapArea}>
                <Ionicons name="reload" size={16} color="#0ea5a4" style={{marginRight: 6}} />
                <Text style={styles.searchThisAreaText}>현 지도 범위 · 반경 {searchRadiusLabel}</Text>
              </TouchableOpacity>
            </View>

            {/* GPS Button */}
            <TouchableOpacity style={styles.gpsButton} onPress={() => moveToCurrentLocation(true, true)}>
              <MaterialIcons name="my-location" size={24} color="#fff" />
            </TouchableOpacity>
          </>
        )}
      </SafeAreaView>

      {isCategoryMenuOpen && !isScopedMapMode ? (
        <View style={styles.categoryOverlay}>
          <TouchableOpacity
            style={styles.categoryBackdrop}
            activeOpacity={1}
            onPress={() => setIsCategoryMenuOpen(false)}
          />
          <SafeAreaView style={styles.categoryPanel}>
            <Text style={styles.categoryTitle}>카테고리</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
              {categories.map((category) => {
                const isActive = activeFilter === category.label;

                return (
                  <TouchableOpacity
                    key={category.label}
                    style={[styles.categoryItem, isActive ? styles.categoryItemActive : null]}
                    onPress={() => selectCategory(category)}
                  >
                    <Text style={[styles.categoryItemText, isActive ? styles.categoryItemTextActive : null]}>
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </View>
      ) : null}

      {/* 3. Bottom Sheet UI: keep only the visible sheet as the touch target so the WebView can receive map gestures. */}
      <Animated.View pointerEvents="auto" style={[styles.bottomSheet, { bottom: sheetBottomOffset, height: sheetHeight }]}>
          <View
            style={styles.sheetToggle}
            {...sheetPanResponder.panHandlers}
          >
            <View style={styles.handleBar} />
          </View>
          
          <TouchableOpacity
            style={styles.bottomSheetHeader}
            activeOpacity={0.85}
            onPress={() => {
              setIsMapSortOpen(false);
              setSheetHeight(isSheetExpanded ? MIN_SHEET_HEIGHT : defaultSheetHeight);
            }}
          >
            <View style={styles.headerLeft}>
              <Text style={styles.bottomSheetTitle}>{isScopedMapMode ? '지도에 저장한 장소' : '주변 추천 장소'}</Text>
            </View>
            <View style={styles.bottomSheetHeaderRight}>
              <TouchableOpacity style={styles.listViewButton} onPress={() => router.push(isScopedMapMode ? '/list' : '/list')} activeOpacity={0.85}>
                <Ionicons name="map-outline" size={14} color="#0ea5a4" />
                <Text style={styles.listViewButtonText}>마이지도</Text>
              </TouchableOpacity>
              <Text style={styles.viewAllText}>{isSheetExpanded ? '접기' : '펼치기'}</Text>
            </View>
          </TouchableOpacity>

	          {isSheetExpanded ? (
	            <ScrollView
	              ref={cardScrollRef}
	              showsVerticalScrollIndicator={false}
	              bounces={false}
	              alwaysBounceVertical={false}
	              overScrollMode="never"
	              style={styles.sheetBodyScroll}
	              contentContainerStyle={styles.sheetBodyScrollContent}
	              onContentSizeChange={scrollCardListToTop}
	            >
	              {!isScopedMapMode ? (
	              <TouchableOpacity
	                style={styles.mapSortButton}
	                activeOpacity={0.85}
	                onPress={() => setIsMapSortOpen((previous) => !previous)}
	              >
	                <View style={styles.mapSortButtonTextWrap}>
	                  <Text style={styles.mapSortButtonText}>정렬 기준</Text>
	                  <Text style={styles.mapSortValue}>{mapSortButtonLabel}</Text>
	                </View>
	                <Ionicons name={isMapSortOpen ? 'chevron-up' : 'chevron-down'} size={22} color="#fff" />
	              </TouchableOpacity>
	              ) : null}

	              {isMapSortOpen && !isScopedMapMode ? (
	                <View style={styles.mapSortPanel}>
	                  <View style={styles.mapSortPanelHeader}>
	                    <Text style={styles.mapSortPanelTitle}>필터 선택</Text>
	                    <View style={styles.mapSortPanelActions}>
	                      <TouchableOpacity onPress={resetAndCloseMapSorts} activeOpacity={0.8}>
	                        <Text style={styles.mapSortClearText}>기본정렬</Text>
	                      </TouchableOpacity>
	                      <TouchableOpacity onPress={closeMapSortPanel} activeOpacity={0.85} style={styles.mapSortDoneButton}>
	                        <Text style={styles.mapSortDoneText}>완료</Text>
	                      </TouchableOpacity>
	                    </View>
	                  </View>
	                  {mapSortOptions.map((option) => {
	                    const isActive = selectedMapSorts.includes(option.title);

	                    return (
	                      <TouchableOpacity
	                        key={option.title}
	                        style={styles.mapSortOption}
	                        activeOpacity={0.85}
	                        onPress={() => toggleMapSort(option.title)}
	                      >
	                        <View>
	                          <Text style={styles.mapSortOptionTitle}>{option.title}</Text>
	                          <Text style={styles.mapSortOptionSubtitle}>{option.subtitle}</Text>
	                        </View>
	                        <View style={[styles.mapSortRadio, isActive ? styles.mapSortRadioActive : null]}>
	                          {isActive ? <Ionicons name="checkmark" size={18} color="#8cb4ff" /> : null}
	                        </View>
	                      </TouchableOpacity>
	                    );
	                  })}
	                </View>
	              ) : null}

	              <View style={styles.nearbyPlaceMetaRow}>
	                <Text style={styles.nearbyPlaceMetaText}>
	                  {isScopedMapMode ? `저장된 장소 ${totalNearbyPlaceCount}개` : `장소 ${visibleNearbyPlaceCount}개 / 전체 ${totalNearbyPlaceCount}개`}
	                </Text>
	                {!isScopedMapMode ? <Text style={styles.nearbyPlaceMetaHint}>표시 개수</Text> : null}
	              </View>

	              {!isScopedMapMode ? (
	              <ScrollView
	                horizontal
	                showsHorizontalScrollIndicator={false}
	                contentContainerStyle={styles.nearbyPlaceLimitScroll}
	              >
	                {NEARBY_PLACE_LIMIT_OPTIONS.map((limit) => {
	                  const isActive = nearbyPlaceLimit === limit;

	                  return (
	                    <TouchableOpacity
	                      key={limit}
	                      style={[styles.nearbyPlaceLimitChip, isActive ? styles.nearbyPlaceLimitChipActive : null]}
	                      activeOpacity={0.85}
	                      onPress={() => selectNearbyPlaceLimit(limit)}
	                    >
	                      <Text style={[styles.nearbyPlaceLimitText, isActive ? styles.nearbyPlaceLimitTextActive : null]}>
	                        {limit}
	                      </Text>
	                    </TouchableOpacity>
	                  );
	                })}
	              </ScrollView>
	              ) : null}

	              <View style={styles.placeListWrap}>
	                {isPlacesLoading ? (
	                  <Text style={styles.emptyText}>장소를 불러오는 중...</Text>
	                ) : nearbyPlaces.length === 0 ? (
	                  <Text style={styles.emptyText}>{isScopedMapMode ? '이 지도에 저장된 장소가 없어요.' : '주변 장소가 없어요.'}</Text>
	                ) : (
	                  visibleNearbyPlaces.map((place) => (
	                    <View style={styles.storeCard} key={place.id}>
	                      <View style={styles.cardHeader}>
	                        <Text style={styles.storeName}>{place.name}</Text>
	                        {!isScopedMapMode ? (
	                        <TouchableOpacity onPress={() => handleFavoritePress(place)} activeOpacity={0.8}>
	                          <Ionicons
	                            name={favoritedPlaceIds.includes(place.id) ? 'heart' : 'heart-outline'}
	                            size={24}
	                            color={favoritedPlaceIds.includes(place.id) ? '#ff4d74' : '#0ea5a4'}
	                          />
	                        </TouchableOpacity>
	                        ) : null}
	                      </View>

	                      {registeredStoreDetailsByExternalPlaceId[place.id] ? (
	                        <Text style={styles.favoriteCountText}>
	                          찜 {registeredStoreDetailsByExternalPlaceId[place.id]?.favoriteCount ?? 0}
	                          {' · 저장된 매장'}
	                        </Text>
	                      ) : (
	                        <Text style={styles.favoriteCountText}>미등록 장소</Text>
	                      )}

	                      <View style={styles.categoryBadge}>
	                        <Text style={styles.categoryText}>{place.category || activeFilter}</Text>
	                      </View>

	                      {registeredStoreDetailsByExternalPlaceId[place.id] ? (
	                        <View style={styles.statusRow}>
	                          <View style={styles.statusBadge}>
	                            <Text style={styles.statusText}>
	                              {registeredStoreDetailsByExternalPlaceId[place.id].liveBusinessStatus
	                                ?? registeredStoreDetailsByExternalPlaceId[place.id].businessStatus
	                                ?? registeredStoreDetailsByExternalPlaceId[place.id].operationalState
	                                ?? '우리 서비스 매장'}
	                            </Text>
	                          </View>
	                          <Text style={styles.statusUpdateText}>
	                            {registeredStoreDetailsByExternalPlaceId[place.id].operationalState ?? '우리 서비스 매장'}
	                          </Text>
	                        </View>
	                      ) : (
	                        <View style={styles.statusRow}>
	                          <View style={styles.unknownStatusBadge}>
	                            <Text style={styles.unknownStatusText}>상태정보 없음</Text>
	                          </View>
	                          <Text style={styles.statusUpdateText}>
	                            {place.distance ? `${place.distance}m · 미등록 장소` : '미등록 장소'}
	                          </Text>
	                        </View>
	                      )}

	                      <View style={styles.infoRow}>
	                        <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.6)" />
	                        <Text style={styles.infoText}>{place.address || '주소 정보 없음'}</Text>
	                      </View>
	                      <View style={styles.infoRow}>
	                        <Ionicons name="call-outline" size={16} color="rgba(255,255,255,0.6)" />
	                        <Text style={styles.infoText}>
	                          {registeredStoreDetailsByExternalPlaceId[place.id]?.phone || place.phone || '전화번호 정보 없음'}
	                        </Text>
	                      </View>

	                      {registeredStoreIdsByExternalPlaceId[place.id] ? (
	                        <>
	                          <View style={styles.cardFooterDivider} />

	                          <View style={styles.cardFooter}>
	                            <View style={styles.footerItem}>
	                              <Ionicons name="star" size={14} color="#ffb300" />
	                              <Text style={styles.footerText}>
	                                {registeredStoreDetailsByExternalPlaceId[place.id]?.reviewAverageRating
	                                  ?? registeredStoreDetailsByExternalPlaceId[place.id]?.rating
	                                  ?? '—'}
	                              </Text>
	                            </View>
	                            <View style={styles.footerItem}>
	                              <Ionicons name="chatbubble-outline" size={14} color="#8f9bb3" />
	                              <Text style={styles.footerText}>
	                                리뷰 {registeredStoreDetailsByExternalPlaceId[place.id]?.reviewCount ?? 0}개
	                              </Text>
	                            </View>
	                            <View style={styles.footerItem}>
	                              <Ionicons name="heart" size={14} color="#f44336" />
	                              <Text style={styles.footerText}>
	                                찜 {registeredStoreDetailsByExternalPlaceId[place.id]?.favoriteCount ?? 0}
	                              </Text>
	                            </View>
	                          </View>
	                        </>
	                      ) : null}

	                      {registeredStoreIdsByExternalPlaceId[place.id] ? (
	                        <TouchableOpacity
	                          style={styles.detailButton}
	                          onPress={() =>
	                            router.push({
	                              pathname: '/views/store_detail',
	                              params: {
	                                storeId: String(registeredStoreIdsByExternalPlaceId[place.id]),
	                                storeName: place.name,
	                                storePhone: registeredStoreDetailsByExternalPlaceId[place.id]?.phone || place.phone || '',
	                              },
	                            })
	                          }
	                          activeOpacity={0.9}
	                        >
	                          <Text style={styles.detailButtonText}>상세 보기</Text>
	                          <Ionicons name="chevron-forward" size={16} color="#0ea5a4" />
	                        </TouchableOpacity>
	                      ) : null}

	                      {registeredStoreIdsByExternalPlaceId[place.id] ? (
	                        <TouchableOpacity
	                          style={styles.reviewButton}
	                          onPress={() =>
	                            router.push({
	                              pathname: '/views/store_reviews',
	                              params: {
	                                storeId: String(registeredStoreIdsByExternalPlaceId[place.id]),
	                                storeName: place.name,
	                                storePhone: registeredStoreDetailsByExternalPlaceId[place.id]?.phone || place.phone || '',
	                              },
	                            })
	                          }
	                          activeOpacity={0.9}
	                        >
	                          <Text style={styles.reviewButtonText}>리뷰 보기</Text>
	                          <Ionicons name="chevron-forward" size={16} color="#0ea5a4" />
	                        </TouchableOpacity>
	                      ) : null}
	                    </View>
	                  ))
	                )}
	              </View>
	            </ScrollView>
	          ) : null}
      </Animated.View>

      {showInternalTabBar ? <AppBottomNav activeTab="map" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fbfc',
  },
  mapPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#eef7f7',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.1,
    borderWidth: 1,
    borderColor: '#000',
    borderStyle: 'dashed',
  },
  marker: {
    position: 'absolute',
    alignItems: 'center',
    flexDirection: 'row',
  },
  markerDot: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: '#00e676',
    borderWidth: 2, borderColor: '#fff', zIndex: 2,
  },
  markerLabel: {
    backgroundColor: '#00e676',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 12,
    marginLeft: -6,
    zIndex: 1,
  },
  markerText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  topOverlay: {
    position: 'absolute',
    top: 0,
    width: '100%',
    zIndex: 10,
    paddingTop: Platform.OS === 'android' ? 12 : 0,
  },
  scopedHeader: {
    marginHorizontal: 16,
    minHeight: 58,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: '#dbeff0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 3,
  },
  scopedBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopedHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  scopedHeaderTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  scopedHeaderSubtitle: {
    marginTop: 3,
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  scopedRefreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e6fbfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 0, alignItems: 'center' },
  menuButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0ea5a4', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  searchInputBox: { flex: 1, height: 44, backgroundColor: '#fff', borderRadius: 22, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: '#dbeff0' },
  searchTextInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 10,
    paddingVertical: 0,
  },
  
  filterWrapper: { marginTop: 12 },
  filterScrollView: { width: '100%' },
  filterScroll: { paddingHorizontal: 16, paddingRight: 28 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', marginRight: 8, borderWidth: 1, borderColor: '#d8eceb' },
  filterPillActive: { backgroundColor: '#e4fbf9', borderColor: '#8bd8d6' },
  filterText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#0ea5a4' },

  searchThisAreaContainer: { alignItems: 'center', marginTop: 16 },
  searchThisAreaButton: { flexDirection: 'row', backgroundColor: '#e6fbfa', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, alignItems: 'center', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  searchThisAreaText: { color: '#0ea5a4', fontSize: 14, fontWeight: '700' },

  nearbyPlaceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 8,
  },
  nearbyPlaceMetaText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  nearbyPlaceMetaHint: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  nearbyPlaceLimitScroll: {
    paddingHorizontal: 0,
    gap: 8,
    paddingBottom: 12,
  },
  nearbyPlaceLimitChip: {
    minWidth: 48,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d8eceb',
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  nearbyPlaceLimitChipActive: {
    borderColor: '#0ea5a4',
    backgroundColor: '#e6fbfa',
  },
  nearbyPlaceLimitText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '900',
  },
  nearbyPlaceLimitTextActive: {
    color: '#0ea5a4',
  },

  gpsButton: { position: 'absolute', right: 16, top: 200, width: 44, height: 44, borderRadius: 22, backgroundColor: '#0ea5a4', alignItems: 'center', justifyContent: 'center', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3 },

  categoryOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    flexDirection: 'row',
  },
  categoryBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  categoryPanel: {
    width: 284,
    backgroundColor: '#f2fbfa',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
  },
  categoryTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  categoryList: {
    paddingBottom: 24,
  },
  categoryItem: {
    height: 52,
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#f8fbfc',
  },
  categoryItemActive: {
    backgroundColor: '#e6fbfa',
  },
  categoryItemText: {
    color: '#64748b',
    fontSize: 18,
    fontWeight: '700',
  },
  categoryItemTextActive: {
    color: '#0ea5a4',
  },

  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 10,
    width: '100%',
    backgroundColor: '#f2fbfa',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20,
    shadowColor: '#0f172a', 
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    paddingBottom: 12,
    overflow: 'hidden',
  },
  sheetToggle: { alignItems: 'center', paddingTop: 10, paddingBottom: 10 },
  handleBar: { width: 40, height: 4, backgroundColor: '#d7e8ea', borderRadius: 2 },
  bottomSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  bottomSheetHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bottomSheetTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginRight: 12 },
  listViewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#e6fbfa',
    borderWidth: 1,
    borderColor: '#bfeceb',
  },
  listViewButtonText: { color: '#0ea5a4', fontSize: 12, fontWeight: '800' },
  openOnlyBadge: { borderWidth: 1, borderColor: '#d8eceb', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  openOnlyText: { color: '#64748b', fontSize: 12 },
  viewAllText: { color: '#0ea5a4', fontSize: 14 },
  mapSortButton: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d8eceb',
    backgroundColor: '#f7fbfc',
    paddingHorizontal: 18,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapSortButtonText: {
    color: '#64748b',
    fontSize: 17,
    fontWeight: '800',
  },
  mapSortButtonTextWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: 12,
    minWidth: 0,
  },
  mapSortValue: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
    flexShrink: 1,
  },
  mapSortPanel: {
    position: 'absolute',
    top: 70,
    left: 20,
    right: 20,
    zIndex: 3,
    elevation: 3,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d8eceb',
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  mapSortPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  mapSortPanelActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mapSortPanelTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  mapSortClearText: {
    color: '#0ea5a4',
    fontSize: 13,
    fontWeight: '700',
  },
  mapSortDoneButton: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: '#e6fbfa',
    borderWidth: 1,
    borderColor: '#bfeceb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapSortDoneText: {
    color: '#0ea5a4',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  mapSortOption: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  mapSortOptionTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  mapSortOptionSubtitle: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
  mapSortRadio: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#d8eceb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapSortRadioActive: {
    borderColor: '#0ea5a4',
    backgroundColor: '#e6fbfa',
  },
  sheetBodyScroll: {
    flex: 1,
    marginTop: 8,
  },
  sheetBodyScrollContent: {
    paddingBottom: 28,
  },
  placeListWrap: {
    marginTop: 8,
  },
  emptyText: { color: '#64748b', fontSize: 14, fontWeight: '600', paddingVertical: 20, textAlign: 'center' },
  storeCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e6eef1', marginBottom: 10, shadowColor: '#0f172a', shadowOpacity: 0.05, shadowRadius: 10, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  storeName: { fontSize: 17, fontWeight: 'bold', color: '#0f172a' },
  favoriteCountText: { color: '#0ea5a4', fontSize: 12, fontWeight: '700', marginBottom: 10 },
  categoryBadge: { backgroundColor: '#eefbfb', alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, marginBottom: 12 },
  categoryText: { color: '#0ea5a4', fontSize: 12 },
  
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statusBadge: { backgroundColor: '#00e676', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  unknownStatusBadge: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8 },
  unknownStatusText: { color: '#334155', fontSize: 12, fontWeight: 'bold' },
  statusUpdateText: { color: '#64748b', fontSize: 12 },
  
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  infoText: { color: '#64748b', fontSize: 14, marginLeft: 8 },
  cardFooterDivider: { height: 1, backgroundColor: '#e6eef1', marginVertical: 14 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { color: '#0f172a', fontSize: 13, fontWeight: '500' },
  reviewButton: {
    marginTop: 10,
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
    marginTop: 10,
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

  bottomTabBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 85,
    backgroundColor: '#fff',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#eceef3',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 25 : 10,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { color: '#8f9bb3', fontSize: 11, marginTop: 4 },
  tabTextActive: { color: '#0ea5a4', fontWeight: 'bold' },
});
