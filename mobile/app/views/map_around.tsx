import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  InteractionManager,
  Modal,
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
import { ApiClientError, favoritesApi, myMapApi, storesApi, tokenStore, userMapsApi } from '@/services/api';
import { mapCache } from '@/services/mapCache';
import { CATEGORY_KEYWORDS, CATEGORY_OPTIONS, type CategoryOption } from '@/services/placeCategories';
import type { StoreLookupItemResponse } from '@/services/api/types';

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
  const params = useLocalSearchParams<{ query?: string | string[] }>();
  const searchParam = Array.isArray(params.query) ? params.query[0] : params.query;
  const initialSearchQuery = (searchParam ?? '').trim();
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
  const [myMapStoreIds, setMyMapStoreIds] = useState<number[]>([]);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [activePlaceForMapPicker, setActivePlaceForMapPicker] = useState<KakaoPlacePreview | null>(null);
  const [mapCollections, setMapCollections] = useState<Array<{ mapId: number; title: string; storeCount: number }>>([]);
  const [activePlaceMapIds, setActivePlaceMapIds] = useState<number[]>([]);
  const [isLoadingMaps, setIsLoadingMaps] = useState(false);
  const [isCreatingMap, setIsCreatingMap] = useState(false);
  const [isCreateMapOpen, setIsCreateMapOpen] = useState(false);
  const [newMapTitle, setNewMapTitle] = useState('');
  const [newMapDescription, setNewMapDescription] = useState('');

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
        .filter((placeId) => placeId && !placeId.startsWith('STORE_'));
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
    moveToCurrentLocation(false);
  }, [moveToCurrentLocation]);

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
          setMyMapStoreIds([]);
          return;
        }

        try {
          const [favorites, myMap] = await Promise.all([
            favoritesApi.listStores(),
            myMapApi.get().catch(() => null),
          ]);
          if (!active) return;

          setFavoritedPlaceIds(favorites.content.map((item) => item.externalPlaceId));
          setFavoriteStoreIdByExternalPlaceId(
            favorites.content.reduce<Record<string, number>>((acc, item) => {
              acc[item.externalPlaceId] = item.storeId;
              return acc;
            }, {})
          );
          setMyMapStoreIds(myMap?.stores ?? []);
        } catch {
          if (!active) return;
          setFavoritedPlaceIds([]);
          setFavoriteStoreIdByExternalPlaceId({});
          setMyMapStoreIds([]);
        }
      };

      void loadAuthAndFavoritesState();

      return () => {
        active = false;
      };
    }, [])
  );

  useEffect(() => {
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
    isMapReady,
    searchPlacesByKeyword,
  ]);

  useFocusEffect(
    useCallback(() => {
      setIsCategoryMenuOpen(false);
      setIsMapSortOpen(false);
      setSelectedMapSorts([]);
      setActiveFilter(initialSearchQuery || '전체');
      if (!initialSearchQuery) {
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
    }, [defaultSheetHeight, initialSearchQuery, setSheetHeight])
  );

  const handleWebViewMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      if (message.type === 'places') {
        const places = Array.isArray(message.places) ? message.places : [];
        const context = mapCache.getNearbySearchContext();
        const searchCenter = message.searchCenter && typeof message.searchCenter === 'object'
          ? message.searchCenter
          : null;
        const latitude = typeof searchCenter?.latitude === 'number'
          ? searchCenter.latitude
          : currentCoordsRef.current?.latitude ?? currentCoords?.latitude ?? null;
        const longitude = typeof searchCenter?.longitude === 'number'
          ? searchCenter.longitude
          : currentCoordsRef.current?.longitude ?? currentCoords?.longitude ?? null;
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

      if (message.type === 'radius-change' && typeof message.radiusMeters === 'number') {
        const nextRadius = Math.max(100, Math.round(message.radiusMeters));
        searchRadiusMetersRef.current = nextRadius;
        setSearchRadiusMeters(nextRadius);
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

  const openMyMapPicker = useCallback(async (place: KakaoPlacePreview) => {
    if (!isLoggedIn) {
      Alert.alert(
        '로그인이 필요해요',
        '내 지도에 추가하려면 로그인 후 이용해주세요.',
        [
          { text: '취소', style: 'cancel' },
          { text: '로그인 페이지로 이동', onPress: () => router.replace('/views/user_login') },
        ]
      );
      return;
    }

    const resolvedStoreId =
      registeredStoreIdsByExternalPlaceId[place.id] ??
      favoriteStoreIdByExternalPlaceId[place.id];

    if (!resolvedStoreId) {
      Alert.alert(
        '내 지도에 추가할 수 없어요',
        '아직 백엔드에 등록되지 않은 장소예요. 등록된 매장만 내 지도에 추가할 수 있어요.'
      );
      return;
    }

    setActivePlaceForMapPicker(place);
    setNewMapTitle('');
    setNewMapDescription('');
    setIsCreateMapOpen(false);
    setIsMapPickerOpen(true);

    try {
      setIsLoadingMaps(true);
      const maps = await userMapsApi.list();
      const counts = await Promise.all(
        maps.map(async (map) => {
          try {
            const detail = await userMapsApi.get(map.mapId);
            return {
              mapId: map.mapId,
              title: map.title,
              storeCount: detail.stores.length + detail.publicInstitutions.length,
              hasPlace: detail.stores.includes(resolvedStoreId),
            };
          } catch {
            return {
              mapId: map.mapId,
              title: map.title,
              storeCount: 0,
              hasPlace: false,
            };
          }
        })
      );
      setMapCollections(counts.map(({ mapId, title, storeCount }) => ({ mapId, title, storeCount })));
      setActivePlaceMapIds(counts.filter((item) => item.hasPlace).map((item) => item.mapId));
    } catch {
      Alert.alert('지도 목록 실패', '내 지도 목록을 불러오지 못했어요.');
      setMapCollections([]);
      setActivePlaceMapIds([]);
    } finally {
      setIsLoadingMaps(false);
    }
  }, [favoriteStoreIdByExternalPlaceId, isLoggedIn, registeredStoreIdsByExternalPlaceId, router]);

  const addActivePlaceToMap = useCallback(async (mapId: number) => {
    if (!activePlaceForMapPicker) return;

    const resolvedStoreId =
      registeredStoreIdsByExternalPlaceId[activePlaceForMapPicker.id] ??
      favoriteStoreIdByExternalPlaceId[activePlaceForMapPicker.id];

    if (!resolvedStoreId) {
      Alert.alert('내 지도에 추가할 수 없어요', '등록된 매장만 내 지도에 추가할 수 있어요.');
      return;
    }

    try {
      await userMapsApi.addStore(mapId, resolvedStoreId);
      setActivePlaceMapIds((current) => (current.includes(mapId) ? current : [...current, mapId]));
      Alert.alert('추가 완료', '선택한 지도에 장소를 담았어요.');
      setIsMapPickerOpen(false);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        setActivePlaceMapIds((current) => (current.includes(mapId) ? current : [...current, mapId]));
        setIsMapPickerOpen(false);
        Alert.alert('추가 완료', '이미 추가된 지도예요.');
        return;
      }

      Alert.alert('내 지도 저장 실패', error instanceof Error ? error.message : '장소를 내 지도에 저장하지 못했어요.');
    }
  }, [activePlaceForMapPicker, favoriteStoreIdByExternalPlaceId, registeredStoreIdsByExternalPlaceId]);

  const createMapAndAddPlace = useCallback(async () => {
    if (!activePlaceForMapPicker) return;

    const title = newMapTitle.trim();
    if (!title) {
      Alert.alert('지도 이름 확인', '새 지도 이름을 입력해주세요.');
      return;
    }

    const resolvedStoreId =
      registeredStoreIdsByExternalPlaceId[activePlaceForMapPicker.id] ??
      favoriteStoreIdByExternalPlaceId[activePlaceForMapPicker.id];

    if (!resolvedStoreId) {
      Alert.alert('내 지도에 추가할 수 없어요', '등록된 매장만 내 지도에 추가할 수 있어요.');
      return;
    }

    try {
      setIsCreatingMap(true);
      const createdMap = await userMapsApi.create({
        title,
        description: newMapDescription.trim() || null,
        isPublic: false,
      });
      await userMapsApi.addStore(createdMap.mapId, resolvedStoreId);
      setMapCollections((current) => [...current, { mapId: createdMap.mapId, title: createdMap.title, storeCount: 1 }]);
      setActivePlaceMapIds((current) => [...current, createdMap.mapId]);
      setIsCreateMapOpen(false);
      setIsMapPickerOpen(false);
      setNewMapTitle('');
      setNewMapDescription('');
      Alert.alert('저장 완료', '새 지도를 만들고 장소를 추가했어요.');
    } catch (error) {
      Alert.alert('지도 만들기 실패', error instanceof Error ? error.message : '새 지도를 만들지 못했어요.');
    } finally {
      setIsCreatingMap(false);
    }
  }, [activePlaceForMapPicker, favoriteStoreIdByExternalPlaceId, newMapDescription, newMapTitle, registeredStoreIdsByExternalPlaceId]);

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
          var pendingKeywordQuery = window.__togglePendingKeywordQuery || ${JSON.stringify(initialSearchQuery)};
          var activeCategoryLabel = '전체';
          var activeCategoryCode = null;
          var activeKeywordQuery = pendingKeywordQuery;
          var registeredStoreIds = {};
          var lastRenderedPlaces = [];
          var searchRadiusMeters = ${DEFAULT_MAP_SEARCH_RADIUS_METERS};
          var visiblePlacesLimit = 10;
          var viewportRefreshTimer = null;
          var suppressViewportSyncUntil = 0;
          var defaultCategoryCodes = ['FD6', 'CE7', 'CS2', 'MT1', 'PM9', 'HP8', 'PO3', 'CT1', 'SC4', 'SW8', 'PK6'];

          function suppressViewportSync(durationMs) {
            suppressViewportSyncUntil = Date.now() + (durationMs || 250);
          }

          function isViewportSyncSuppressed() {
            return Date.now() < suppressViewportSyncUntil;
          }

          function updateSearchRadiusFromMap(shouldNotifyApp) {
            if (!map || !window.kakao) return searchRadiusMeters;

            var bounds = map.getBounds();
            var center = map.getCenter();

            if (!bounds || !center) return searchRadiusMeters;

            var northEast = bounds.getNorthEast();
            var centerLat = center.getLat();
            var centerLng = center.getLng();
            var verticalMeters = haversineDistanceMeters(centerLat, centerLng, northEast.getLat(), centerLng);
            var horizontalMeters = haversineDistanceMeters(centerLat, centerLng, centerLat, northEast.getLng());
            var nextRadius = clamp(Math.round(Math.min(verticalMeters, horizontalMeters) * 0.95), 100, 5000);

            if (nextRadius !== searchRadiusMeters) {
              searchRadiusMeters = nextRadius;
              drawSearchRadiusCircle(center);
              if (shouldNotifyApp !== false) {
                postToApp({ type: 'radius-change', radiusMeters: searchRadiusMeters });
              }
            } else if (shouldNotifyApp !== false) {
              postToApp({ type: 'radius-change', radiusMeters: searchRadiusMeters });
            }

            return searchRadiusMeters;
          }

          function scheduleViewportSearch() {
            if (!map || !placesService || isViewportSyncSuppressed()) return;

            if (viewportRefreshTimer) {
              clearTimeout(viewportRefreshTimer);
            }

            viewportRefreshTimer = setTimeout(function() {
              viewportRefreshTimer = null;
              if (isViewportSyncSuppressed()) return;
              updateSearchRadiusFromMap(false);
              window.searchPlacesInCurrentMap();
            }, 180);
          }

          function postToApp(payload) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify(payload));
            }
          }

          function clamp(value, min, max) {
            return Math.min(Math.max(value, min), max);
          }

          function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
            var earthRadius = 6371000;
            var toRadians = function(value) {
              return value * Math.PI / 180;
            };
            var dLat = toRadians(lat2 - lat1);
            var dLng = toRadians(lng2 - lng1);
            var startLat = toRadians(lat1);
            var endLat = toRadians(lat2);
            var a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(startLat) * Math.cos(endLat) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
            return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          }

          function clearPlaceMarkers() {
            for (var i = 0; i < placeMarkers.length; i += 1) {
              placeMarkers[i].setMap(null);
            }
            placeMarkers = [];
          }

          function createMarkerImage(isRegistered) {
            var color = isRegistered ? '#ff4d74' : '#18a5a5';
            var svg = [
              '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="46" viewBox="0 0 34 46">',
              '<path d="M17 44s12-14.2 12-24.1C29 11.7 23.6 6 17 6S5 11.7 5 19.9C5 29.8 17 44 17 44Z" fill="',
              color,
              '"/>',
              '<circle cx="17" cy="19" r="6.6" fill="#f9fafb"/>',
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
              strokeColor: '#18a5a5',
              strokeOpacity: 0.7,
              strokeStyle: 'solid',
              fillColor: '#18a5a5',
              fillOpacity: 0.11
            });

            searchRadiusCircle.setMap(map);
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
              suppressViewportSync(300);
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

          window.renderPlacesFromApp = function(places, label, categoryCode) {
            activeCategoryLabel = label || activeCategoryLabel || '전체';
            activeCategoryCode = categoryCode || null;
            activeKeywordQuery = '';
            pendingKeywordQuery = '';

            if (!map || !window.kakao || !Array.isArray(places)) return;

            renderPlaces(places, false, false);
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

          window.setSearchRadiusMeters = function(nextRadiusMeters) {
            var normalizedRadius = Number(nextRadiusMeters);
            if (!Number.isFinite(normalizedRadius) || normalizedRadius <= 0) return;

            searchRadiusMeters = normalizedRadius;
            if (map) {
              drawSearchRadiusCircle(map.getCenter());
              postToApp({ type: 'radius-change', radiusMeters: searchRadiusMeters });
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
            updateSearchRadiusFromMap(false);
            drawSearchRadiusCircle(center);
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
            updateSearchRadiusFromMap(true);
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

            updateSearchRadiusFromMap(true);
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

            updateSearchRadiusFromMap(true);
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
            suppressViewportSync(350);
            map.setLevel(4);
            map.setCenter(currentPosition);
            updateSearchRadiusFromMap(false);

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
                updateSearchRadiusFromMap();

                map.addListener('dragend', scheduleViewportSearch);
                map.addListener('zoom_changed', scheduleViewportSearch);
                map.addListener('idle', function() {
                  if (isViewportSyncSuppressed()) return;
                  updateSearchRadiusFromMap(true);
                });

                if (pendingCurrentLocation) {
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
            if (currentCoords) {
              moveMapToLocation(currentCoords.latitude, currentCoords.longitude);
            }
          }}
        />
      </View>

      {/* 2. Top UI Overlays: parent containers pass empty-area touches down to the WebView map. */}
      <SafeAreaView style={styles.topOverlay} pointerEvents="box-none">
        {/* Search Bar */}
        <View style={styles.searchContainer} pointerEvents="box-none">
          <TouchableOpacity onPress={() => setIsCategoryMenuOpen(true)} style={styles.menuButton}>
            <Ionicons name="menu" size={24} color="#f9fafb" />
          </TouchableOpacity>
          <View style={styles.searchInputBox}>
            <Ionicons name="search" size={20} color="rgba(255,255,255,0.7)" />
            <TextInput
              style={styles.searchTextInput}
              value={mapSearchQuery}
              onChangeText={setMapSearchQuery}
              onSubmitEditing={submitMapSearch}
              placeholder="장소, 버스, 지하철, 주소 검색"
              placeholderTextColor="#8b95a1"
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
            <Ionicons name="reload" size={16} color="#18a5a5" style={{ marginRight: 6 }} />
            <Text style={styles.searchThisAreaText}>현 지도에서 검색 · 반경 {searchRadiusLabel}</Text>
          </TouchableOpacity>
        </View>

        {/* GPS Button */}
        <TouchableOpacity style={styles.gpsButton} onPress={() => moveToCurrentLocation(true, true)}>
          <MaterialIcons name="my-location" size={24} color="#f9fafb" />
        </TouchableOpacity>
      </SafeAreaView>

      {isCategoryMenuOpen ? (
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
            <Text style={styles.bottomSheetTitle}>주변 추천 장소</Text>
          </View>
          <View style={styles.bottomSheetHeaderRight}>
            <TouchableOpacity style={styles.listViewButton} onPress={() => router.push('/list')} activeOpacity={0.85}>
              <Ionicons name="map-outline" size={14} color="#18a5a5" />
              <Text style={styles.listViewButtonText}>마이지도</Text>
            </TouchableOpacity>
            <Text style={styles.viewAllText}>{isSheetExpanded ? '접기' : '펼치기'}</Text>
          </View>
        </TouchableOpacity>

        {isSheetExpanded ? (
          <>
            <TouchableOpacity
              style={styles.mapSortButton}
              activeOpacity={0.85}
              onPress={() => setIsMapSortOpen((previous) => !previous)}
            >
              <View style={styles.mapSortButtonTextWrap}>
                <Text style={styles.mapSortButtonText}>정렬 기준</Text>
                <Text style={styles.mapSortValue}>{mapSortButtonLabel}</Text>
              </View>
              <Ionicons name={isMapSortOpen ? 'chevron-up' : 'chevron-down'} size={22} color="#f9fafb" />
            </TouchableOpacity>

            {isMapSortOpen ? (
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
                        {isActive ? <Ionicons name="checkmark" size={18} color="#18a5a5" /> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.nearbyPlaceMetaRow}>
              <Text style={styles.nearbyPlaceMetaText}>
                장소 {visibleNearbyPlaceCount}개 / 전체 {totalNearbyPlaceCount}개
              </Text>
              <Text style={styles.nearbyPlaceMetaHint}>표시 개수</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.nearbyPlaceLimitScrollView}
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

            <ScrollView
              ref={cardScrollRef}
              showsVerticalScrollIndicator={false}
              bounces={false}
              alwaysBounceVertical={false}
              overScrollMode="never"
              style={styles.cardScroll}
              contentContainerStyle={styles.cardScrollContent}
            >
              {isPlacesLoading ? (
                <Text style={styles.emptyText}>장소를 불러오는 중...</Text>
              ) : nearbyPlaces.length === 0 ? (
                <Text style={styles.emptyText}>주변 장소가 없어요.</Text>
              ) : (
                visibleNearbyPlaces.map((place) => {
                  const resolvedStoreId = registeredStoreIdsByExternalPlaceId[place.id] ?? favoriteStoreIdByExternalPlaceId[place.id] ?? null;
                  const isInMyMap = resolvedStoreId ? myMapStoreIds.includes(resolvedStoreId) : false;

                  return (
                    <View style={styles.storeCard} key={place.id}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.storeName}>{place.name}</Text>
                        <TouchableOpacity onPress={() => handleFavoritePress(place)} activeOpacity={0.8}>
                          <Ionicons
                            name={favoritedPlaceIds.includes(place.id) ? 'heart' : 'heart-outline'}
                            size={24}
                            color={favoritedPlaceIds.includes(place.id) ? '#ff4d74' : '#18a5a5'}
                          />
                        </TouchableOpacity>
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
                              <Ionicons name="chatbubble-outline" size={14} color="#8b95a1" />
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
                          style={styles.myMapButton}
                          onPress={() => void openMyMapPicker(place)}
                          activeOpacity={0.9}
                        >
                          <Ionicons name="bookmark-outline" size={16} color="#18a5a5" />
                          <Text style={styles.myMapButtonText}>{isInMyMap ? '내 지도 관리' : '내 지도에 추가'}</Text>
                        </TouchableOpacity>
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
                          <Ionicons name="chevron-forward" size={16} color="#18a5a5" />
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
                          <Ionicons name="chevron-forward" size={16} color="#18a5a5" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </>
        ) : null}
      </Animated.View>

      <Modal
        visible={isMapPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMapPickerOpen(false)}
      >
        <View style={styles.mapPickerModalBackdrop}>
          <TouchableOpacity
            style={styles.mapPickerModalDimmer}
            activeOpacity={1}
            onPress={() => setIsMapPickerOpen(false)}
          />
          <View style={styles.mapPickerModalSheet}>
            <View style={styles.mapPickerModalHandle} />
            <Text style={styles.mapPickerModalTitle}>어느 지도에 추가할까요?</Text>
            <Text style={styles.mapPickerModalSubtitle}>
              {activePlaceForMapPicker?.name ?? '선택한 장소'}를 담을 지도를 골라주세요.
            </Text>

            <ScrollView
              style={styles.mapPickerModalScroll}
              contentContainerStyle={styles.mapPickerModalScrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {isLoadingMaps ? (
                <View style={styles.mapPickerEmpty}>
                  <Text style={styles.mapPickerEmptyText}>지도 목록을 불러오는 중이에요</Text>
                </View>
              ) : mapCollections.length > 0 ? (
                <View style={styles.mapPickerList}>
                  {mapCollections.map((map) => {
                    const isSelected = activePlaceMapIds.includes(map.mapId);

                    return (
                      <TouchableOpacity
                        key={map.mapId}
                        style={[styles.mapPickerOption, isSelected ? styles.mapPickerOptionActive : null]}
                        activeOpacity={0.9}
                        onPress={() => void addActivePlaceToMap(map.mapId)}
                      >
                        <View style={styles.mapPickerOptionLeft}>
                          <View style={styles.mapPickerOptionIcon}>
                            <Ionicons name="bookmark-outline" size={18} color="#18a5a5" />
                          </View>
                          <View style={styles.mapPickerOptionTextWrap}>
                            <Text style={styles.mapPickerOptionTitle}>{map.title}</Text>
                            <Text style={styles.mapPickerOptionSubtitle}>{map.storeCount}개 저장됨</Text>
                          </View>
                        </View>
                        <View style={[styles.mapPickerCheck, isSelected ? styles.mapPickerCheckActive : null]}>
                          {isSelected ? <Ionicons name="checkmark" size={16} color="#18a5a5" /> : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.mapPickerEmpty}>
                  <Text style={styles.mapPickerEmptyText}>아직 만든 지도가 없어요</Text>
                </View>
              )}

              {isCreateMapOpen ? (
                <View style={styles.mapPickerCreateForm}>
                  <Text style={styles.mapPickerCreateTitle}>새 지도 만들기</Text>
                  <TextInput
                    style={styles.mapPickerInput}
                    value={newMapTitle}
                    onChangeText={setNewMapTitle}
                    placeholder="지도 이름"
                    placeholderTextColor="#8b95a1"
                  />
                  <TextInput
                    style={[styles.mapPickerInput, styles.mapPickerDescriptionInput]}
                    value={newMapDescription}
                    onChangeText={setNewMapDescription}
                    placeholder="설명은 선택이에요"
                    placeholderTextColor="#8b95a1"
                    multiline
                  />
                  <TouchableOpacity
                    style={[styles.mapPickerPrimaryButton, isCreatingMap ? styles.mapPickerPrimaryButtonDisabled : null]}
                    onPress={() => void createMapAndAddPlace()}
                    activeOpacity={0.9}
                    disabled={isCreatingMap}
                  >
                    <Text style={styles.mapPickerPrimaryButtonText}>만들고 추가하기</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.mapPickerNewButton}
                onPress={() => setIsCreateMapOpen((current) => !current)}
                activeOpacity={0.9}
              >
                <Ionicons name="add" size={18} color="#18a5a5" />
                <Text style={styles.mapPickerNewButtonText}>{isCreateMapOpen ? '새 지도 접기' : '새 지도 만들기'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {showInternalTabBar ? <AppBottomNav activeTab="map" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f4f6',
  },
  mapPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#eef1f5',
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
    borderWidth: 2, borderColor: '#f9fafb', zIndex: 2,
  },
  markerLabel: {
    backgroundColor: '#00e676',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 12,
    marginLeft: -6,
    zIndex: 1,
  },
  markerText: { color: '#f9fafb', fontSize: 12, fontWeight: 'bold' },

  topOverlay: {
    position: 'absolute',
    top: 0,
    width: '100%',
    zIndex: 10,
    paddingTop: Platform.OS === 'android' ? 12 : 0,
  },
  searchContainer: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 0, alignItems: 'center' },
  menuButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#18a5a5', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  searchInputBox: { flex: 1, height: 44, backgroundColor: '#f9fafb', borderRadius: 22, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e8eb' },
  searchTextInput: {
    flex: 1,
    color: '#191f28',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 10,
    paddingVertical: 0,
  },

  filterWrapper: { marginTop: 12 },
  filterScrollView: { width: '100%' },
  filterScroll: { paddingHorizontal: 16, paddingRight: 28 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f9fafb', marginRight: 8, borderWidth: 1, borderColor: '#e5e8eb' },
  filterPillActive: { backgroundColor: '#e4fbf9', borderColor: '#e5e8eb' },
  filterText: { color: '#6b7684', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#18a5a5' },

  searchThisAreaContainer: { alignItems: 'center', marginTop: 16 },
  searchThisAreaButton: { flexDirection: 'row', backgroundColor: '#edf8f8', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, alignItems: 'center', shadowColor: '#191f28', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  searchThisAreaText: { color: '#18a5a5', fontSize: 14, fontWeight: '700' },

  nearbyPlaceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
  },
  nearbyPlaceMetaText: {
    color: '#191f28',
    fontSize: 14,
    fontWeight: '800',
  },
  nearbyPlaceMetaHint: {
    color: '#6b7684',
    fontSize: 12,
    fontWeight: '700',
  },
  nearbyPlaceLimitScroll: {
    paddingHorizontal: 0,
    gap: 8,
    paddingBottom: 8,
    alignItems: 'center',
  },
  nearbyPlaceLimitScrollView: {
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
    height: 48,
    marginBottom: 4,
  },
  nearbyPlaceLimitChip: {
    minWidth: 48,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  nearbyPlaceLimitChipActive: {
    borderColor: '#18a5a5',
    backgroundColor: '#edf8f8',
  },
  nearbyPlaceLimitText: {
    color: '#6b7684',
    fontSize: 12,
    fontWeight: '900',
  },
  nearbyPlaceLimitTextActive: {
    color: '#18a5a5',
  },

  gpsButton: { position: 'absolute', right: 16, top: 200, width: 44, height: 44, borderRadius: 22, backgroundColor: '#18a5a5', alignItems: 'center', justifyContent: 'center', shadowColor: '#191f28', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3 },

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
    backgroundColor: '#f9fafb',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
  },
  categoryTitle: {
    color: '#191f28',
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
    backgroundColor: '#edf8f8',
  },
  categoryItemText: {
    color: '#6b7684',
    fontSize: 18,
    fontWeight: '700',
  },
  categoryItemTextActive: {
    color: '#18a5a5',
  },

  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 10,
    width: '100%',
    backgroundColor: '#f9fafb',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20,
    shadowColor: '#191f28',
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
  bottomSheetTitle: { fontSize: 18, fontWeight: 'bold', color: '#191f28', marginRight: 12 },
  listViewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#edf8f8',
    borderWidth: 1,
    borderColor: '#edf8f8',
  },
  listViewButtonText: { color: '#18a5a5', fontSize: 12, fontWeight: '800' },
  openOnlyBadge: { borderWidth: 1, borderColor: '#e5e8eb', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  openOnlyText: { color: '#6b7684', fontSize: 12 },
  viewAllText: { color: '#18a5a5', fontSize: 14 },
  mapSortButton: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f2f4f6',
    paddingHorizontal: 18,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapSortButtonText: {
    color: '#6b7684',
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
    color: '#191f28',
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
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e8eb',
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
    color: '#191f28',
    fontSize: 15,
    fontWeight: '800',
  },
  mapSortClearText: {
    color: '#18a5a5',
    fontSize: 13,
    fontWeight: '700',
  },
  mapSortDoneButton: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: '#edf8f8',
    borderWidth: 1,
    borderColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapSortDoneText: {
    color: '#18a5a5',
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
    color: '#191f28',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  mapSortOptionSubtitle: {
    color: '#6b7684',
    fontSize: 14,
    fontWeight: '700',
  },
  mapSortRadio: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#e5e8eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapSortRadioActive: {
    borderColor: '#18a5a5',
    backgroundColor: '#edf8f8',
  },
  cardScroll: {
    flex: 1,
    minHeight: 0,
    marginTop: 4,
    alignSelf: 'stretch',
  },
  cardScrollContent: {
    paddingTop: 0,
    paddingBottom: 16,
  },
  emptyText: { color: '#6b7684', fontSize: 14, fontWeight: '600', paddingVertical: 20, textAlign: 'center' },
  storeCard: { backgroundColor: '#f9fafb', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e5e8eb', marginBottom: 10, shadowColor: '#191f28', shadowOpacity: 0.05, shadowRadius: 10, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  storeName: { fontSize: 17, fontWeight: 'bold', color: '#191f28' },
  favoriteCountText: { color: '#18a5a5', fontSize: 12, fontWeight: '700', marginBottom: 10 },
  categoryBadge: { backgroundColor: '#eefbfb', alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, marginBottom: 12 },
  categoryText: { color: '#18a5a5', fontSize: 12 },

  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statusBadge: { backgroundColor: '#00e676', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8 },
  statusText: { color: '#f9fafb', fontSize: 12, fontWeight: 'bold' },
  unknownStatusBadge: { backgroundColor: '#eef1f5', borderWidth: 1, borderColor: '#e5e8eb', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8 },
  unknownStatusText: { color: '#4e5968', fontSize: 12, fontWeight: 'bold' },
  statusUpdateText: { color: '#6b7684', fontSize: 12 },

  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  infoText: { color: '#6b7684', fontSize: 14, marginLeft: 8 },
  cardFooterDivider: { height: 1, backgroundColor: '#e5e8eb', marginVertical: 14 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { color: '#191f28', fontSize: 13, fontWeight: '500' },
  reviewButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#edf8f8',
    backgroundColor: '#eef1f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reviewButtonText: {
    color: '#18a5a5',
    fontSize: 12,
    fontWeight: '800',
  },
  myMapButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#edf8f8',
    backgroundColor: '#edf8f8',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  myMapButtonActive: {
    borderColor: '#18a5a5',
    backgroundColor: '#18a5a5',
  },
  myMapButtonText: {
    color: '#18a5a5',
    fontSize: 12,
    fontWeight: '800',
  },
  myMapButtonTextActive: {
    color: '#f9fafb',
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
    color: '#18a5a5',
    fontSize: 12,
    fontWeight: '800',
  },
  mapPickerModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
  },
  mapPickerModalDimmer: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPickerModalSheet: {
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
  mapPickerModalHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d7e8ea',
    alignSelf: 'center',
    marginBottom: 14,
  },
  mapPickerModalTitle: {
    color: '#191f28',
    fontSize: 18,
    fontWeight: '900',
  },
  mapPickerModalSubtitle: {
    marginTop: 6,
    marginBottom: 14,
    color: '#6b7684',
    fontSize: 13,
    lineHeight: 19,
  },
  mapPickerModalScroll: {
    maxHeight: '100%',
  },
  mapPickerModalScrollContent: {
    paddingBottom: 8,
  },
  mapPickerList: {
    gap: 10,
  },
  mapPickerOption: {
    backgroundColor: '#f2f4f6',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  mapPickerOptionActive: {
    borderColor: '#18a5a5',
    backgroundColor: '#edf8f8',
  },
  mapPickerOptionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  mapPickerOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPickerOptionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  mapPickerOptionTitle: {
    color: '#191f28',
    fontSize: 14,
    fontWeight: '900',
  },
  mapPickerOptionSubtitle: {
    marginTop: 3,
    color: '#6b7684',
    fontSize: 12,
    fontWeight: '700',
  },
  mapPickerCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d7e8ea',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  mapPickerCheckActive: {
    borderColor: '#18a5a5',
    backgroundColor: '#f9fafb',
  },
  mapPickerEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  mapPickerEmptyText: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  mapPickerCreateForm: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    padding: 14,
  },
  mapPickerCreateTitle: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 10,
  },
  mapPickerInput: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    color: '#191f28',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  mapPickerDescriptionInput: {
    minHeight: 72,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  mapPickerPrimaryButton: {
    height: 44,
    borderRadius: 22,
    backgroundColor: '#18a5a5',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  mapPickerPrimaryButtonDisabled: {
    opacity: 0.7,
  },
  mapPickerPrimaryButtonText: {
    color: '#f9fafb',
    fontSize: 14,
    fontWeight: '900',
  },
  mapPickerNewButton: {
    marginTop: 14,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  mapPickerNewButtonText: {
    color: '#18a5a5',
    fontSize: 14,
    fontWeight: '800',
  },

  bottomTabBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 85,
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#eceef3',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 25 : 10,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { color: '#8b95a1', fontSize: 11, marginTop: 4 },
  tabTextActive: { color: '#18a5a5', fontWeight: 'bold' },
});
