import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
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
import { Stack, useLocalSearchParams, usePathname } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { AppBottomNav } from '@/components/app-bottom-nav';
import { tokenStore } from '@/services/api';
import { mapCache } from '@/services/mapCache';

const { height: windowHeight } = Dimensions.get('window');
const MIN_SHEET_HEIGHT = 92;
const BOTTOM_NAV_HEIGHT = 78;
const NEARBY_PLACES_CACHE_KEY = 'toggle.nearbyPlaces';

type CategoryOption = {
  label: string;
  code: string | null;
};

type KakaoPlacePreview = {
  id: string;
  name: string;
  category: string;
  address: string;
  distance?: string;
  phone?: string;
};

const CATEGORY_OPTIONS: CategoryOption[] = [
  { label: '전체', code: null },
  { label: '음식점', code: 'FD6' },
  { label: '카페', code: 'CE7' },
  { label: '편의점', code: 'CS2' },
  { label: '대형마트', code: 'MT1' },
  { label: '약국', code: 'PM9' },
  { label: '병원', code: 'HP8' },
  { label: '기타', code: null },
  { label: '공공기관', code: 'PO3' },
  { label: '문화시설', code: 'CT1' },
  { label: '학교', code: 'SC4' },
  { label: '지하철역', code: 'SW8' },
  { label: '주차장', code: 'PK6' },
];

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

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
  const [activeFilter, setActiveFilter] = useState('전체');
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
  const [favoritedPlaceIds, setFavoritedPlaceIds] = useState<string[]>([]);

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

  const submitMapSearch = useCallback(() => {
    const trimmedQuery = mapSearchQuery.trim();

    if (!trimmedQuery) {
      setActiveFilter('전체');
      searchPlacesByCategory({ label: '전체', code: null });
      return;
    }

    setActiveFilter(trimmedQuery);
    searchPlacesByKeyword(trimmedQuery);
  }, [mapSearchQuery, searchPlacesByCategory, searchPlacesByKeyword]);

  const selectCategory = useCallback((category: CategoryOption) => {
    setActiveFilter(category.label);
    setIsCategoryMenuOpen(false);
    searchPlacesByCategory(category);
  }, [searchPlacesByCategory]);

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
      }).start();
      return;
    }

    sheetHeight.setValue(clampedHeight);
  }, [maxSheetHeight, sheetHeight]);

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

      const loadAuthState = async () => {
        const accessToken = await tokenStore.getAccessToken();
        if (!active) return;
        setIsLoggedIn(Boolean(accessToken));
      };

      void loadAuthState();

      return () => {
        active = false;
      };
    }, [])
  );

  useEffect(() => {
    if (!initialSearchQuery || !isMapReady) return;

    setMapSearchQuery(initialSearchQuery);
    searchPlacesByKeyword(initialSearchQuery);
  }, [initialSearchQuery, isMapReady, searchPlacesByKeyword]);

  useFocusEffect(
    useCallback(() => {
      setIsCategoryMenuOpen(false);
      setIsMapSortOpen(false);
      setSelectedMapSorts([]);
      setActiveFilter(initialSearchQuery || '전체');
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
        setNearbyPlaces(places);
        mapCache.setNearbyPlaces(places);
        setIsPlacesLoading(false);

        try {
          globalThis.localStorage?.setItem(NEARBY_PLACES_CACHE_KEY, JSON.stringify(places));
        } catch {
          // Ignore storage failures; the map result itself is still shown.
        }
      }

      if (message.type === 'places-loading') {
        setIsPlacesLoading(true);
      }

      if (message.type === 'map-ready') {
        setIsMapReady(true);
      }
    } catch {
      // Ignore non-JSON messages from the map WebView.
    }
  }, []);

  const searchCurrentMapArea = useCallback(() => {
    setIsPlacesLoading(true);
    webViewRef.current?.injectJavaScript(`
      window.searchPlacesInCurrentMap();
      true;
    `);
  }, []);

  const handleFavoritePress = useCallback(async (placeId: string) => {
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

    setFavoritedPlaceIds((current) => (
      current.includes(placeId)
        ? current.filter((id) => id !== placeId)
        : [...current, placeId]
    ));
  }, [isLoggedIn, router]);

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
          var placeMarkers = [];
          var placesService = null;
          var pendingCurrentLocation = null;
          var pendingKeywordQuery = window.__togglePendingKeywordQuery || ${JSON.stringify(initialSearchQuery)};
          var activeCategoryLabel = '전체';
          var activeCategoryCode = null;
          var activeKeywordQuery = pendingKeywordQuery;
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

          function normalizePlace(place) {
            return {
              id: place.id,
              name: place.place_name,
              category: place.category_group_name || place.category_name || activeCategoryLabel,
              address: place.road_address_name || place.address_name || '',
              distance: place.distance || '',
              phone: place.phone || ''
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

          function renderPlaces(places, shouldFitMap) {
            clearPlaceMarkers();

            var bounds = new kakao.maps.LatLngBounds();
            var limitedPlaces = sortPlacesByDistance(dedupePlaces(places)).slice(0, 15);

            for (var i = 0; i < limitedPlaces.length; i += 1) {
              var place = limitedPlaces[i];
              var position = new kakao.maps.LatLng(Number(place.y), Number(place.x));
              var marker = new kakao.maps.Marker({
                map: map,
                position: position,
                title: place.place_name
              });

              placeMarkers.push(marker);
              bounds.extend(position);
            }

            if (shouldFitMap !== false && limitedPlaces.length > 0) {
              map.setBounds(bounds);
            }

            postToApp({
              type: 'places',
              places: limitedPlaces.map(normalizePlace)
            });
          }

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
            return {
              location: new kakao.maps.LatLng(center.getLat(), center.getLng()),
              sort: kakao.maps.services.SortBy.DISTANCE,
              radius: 2000,
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
            <Ionicons name="reload" size={16} color="#fff" style={{marginRight: 6}} />
            <Text style={styles.searchThisAreaText}>현 지도에서 검색</Text>
          </TouchableOpacity>
        </View>

        {/* GPS Button */}
        <TouchableOpacity style={styles.gpsButton} onPress={() => moveToCurrentLocation(true, true)}>
          <MaterialIcons name="my-location" size={24} color="#fff" />
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
            <Text style={styles.viewAllText}>{isSheetExpanded ? '접기' : '펼치기'}</Text>
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
              <Ionicons name={isMapSortOpen ? 'chevron-up' : 'chevron-down'} size={22} color="#fff" />
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
                        {isActive ? <Ionicons name="checkmark" size={18} color="#8cb4ff" /> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            <ScrollView
              ref={cardScrollRef}
              showsVerticalScrollIndicator={false}
              style={styles.cardScroll}
              contentContainerStyle={styles.cardScrollContent}
            >
            {isPlacesLoading ? (
              <Text style={styles.emptyText}>장소를 불러오는 중...</Text>
            ) : nearbyPlaces.length === 0 ? (
              <Text style={styles.emptyText}>주변 장소가 없어요.</Text>
            ) : (
              nearbyPlaces.map((place) => (
                <View style={styles.storeCard} key={place.id}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.storeName}>{place.name}</Text>
                    <TouchableOpacity onPress={() => handleFavoritePress(place.id)} activeOpacity={0.8}>
                      <Ionicons
                        name={favoritedPlaceIds.includes(place.id) ? 'heart' : 'heart-outline'}
                        size={24}
                        color={favoritedPlaceIds.includes(place.id) ? '#ff4d74' : '#0ea5a4'}
                      />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{place.category || activeFilter}</Text>
                  </View>

                  <View style={styles.statusRow}>
                    <View style={styles.unknownStatusBadge}>
                      <Text style={styles.unknownStatusText}>상태정보 없음</Text>
                    </View>
                    <Text style={styles.statusUpdateText}>
                      {place.distance ? `${place.distance}m · 미등록 장소` : '미등록 장소'}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.6)" />
                    <Text style={styles.infoText}>{place.address || '주소 정보 없음'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="call-outline" size={16} color="rgba(255,255,255,0.6)" />
                    <Text style={styles.infoText}>{place.phone || '전화번호 정보 없음'}</Text>
                  </View>
                </View>
              ))
            )}
            </ScrollView>
            </>
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

  gpsButton: { position: 'absolute', right: 16, top: 160, width: 44, height: 44, borderRadius: 22, backgroundColor: '#0ea5a4', alignItems: 'center', justifyContent: 'center', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3 },

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
  bottomSheetTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginRight: 12 },
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
  cardScroll: { flex: 1 },
  cardScrollContent: {
    paddingBottom: 28,
    flexGrow: 1,
  },
  emptyText: { color: '#64748b', fontSize: 14, fontWeight: '600', paddingVertical: 20, textAlign: 'center' },
  storeCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e6eef1', marginBottom: 10, shadowColor: '#0f172a', shadowOpacity: 0.05, shadowRadius: 10, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  storeName: { fontSize: 17, fontWeight: 'bold', color: '#0f172a' },
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
