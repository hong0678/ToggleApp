import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import * as Location from 'expo-location';

const { height: windowHeight } = Dimensions.get('window');
const MIN_SHEET_HEIGHT = 92;
const DEFAULT_SHEET_HEIGHT = 280;
const MAX_SHEET_HEIGHT = Math.min(windowHeight - 150, 620);

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
  const webViewRef = useRef<React.ElementRef<typeof WebView>>(null);
  const sheetHeight = useRef(new Animated.Value(DEFAULT_SHEET_HEIGHT)).current;
  const sheetHeightValue = useRef(DEFAULT_SHEET_HEIGHT);
  const dragStartHeight = useRef(DEFAULT_SHEET_HEIGHT);
  const currentCoordsRef = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [activeFilter, setActiveFilter] = useState('전체');
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [isSheetExpanded, setIsSheetExpanded] = useState(true);
  const [isMapSortOpen, setIsMapSortOpen] = useState(false);
  const [activeMapSort, setActiveMapSort] = useState('기본순');
  const [nearbyPlaces, setNearbyPlaces] = useState<KakaoPlacePreview[]>([]);
  const [isPlacesLoading, setIsPlacesLoading] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const categories = CATEGORY_OPTIONS;
  const mapSortOptions = [
    { title: '영업중만', subtitle: '영업 중인 매장만 보기' },
    { title: '별점 높은 순', subtitle: '별점이 높은 순' },
    { title: '리뷰 많은 순', subtitle: '리뷰가 많은 순' },
    { title: '찜 많은 순', subtitle: '찜이 많은 순' },
  ];

  const searchPlacesByCategory = useCallback((category: CategoryOption) => {
    setIsPlacesLoading(true);
    webViewRef.current?.injectJavaScript(`
      window.searchPlacesByCategory(${JSON.stringify(category.label)}, ${JSON.stringify(category.code)});
      true;
    `);
  }, []);

  const selectCategory = useCallback((category: CategoryOption) => {
    setActiveFilter(category.label);
    setIsCategoryMenuOpen(false);
    searchPlacesByCategory(category);
  }, [searchPlacesByCategory]);

  const setSheetHeight = useCallback((nextHeight: number, animated = true) => {
    const clampedHeight = clamp(nextHeight, MIN_SHEET_HEIGHT, MAX_SHEET_HEIGHT);

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
  }, [sheetHeight]);

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

  const handleWebViewMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      if (message.type === 'places') {
        setNearbyPlaces(Array.isArray(message.places) ? message.places : []);
        setIsPlacesLoading(false);
      }

      if (message.type === 'places-loading') {
        setIsPlacesLoading(true);
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
          var activeCategoryLabel = '전체';
          var activeCategoryCode = null;
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

          function renderPlaces(places) {
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

            if (limitedPlaces.length > 0) {
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

          window.searchPlacesByCategory = function(label, categoryCode) {
            activeCategoryLabel = label || '전체';
            activeCategoryCode = categoryCode || null;

            if (!map || !placesService || !window.kakao) return;

            postToApp({ type: 'places-loading' });

            var center = map.getCenter();
            var searchOptions = {
              location: new kakao.maps.LatLng(center.getLat(), center.getLng()),
              sort: kakao.maps.services.SortBy.DISTANCE,
              radius: 2000,
              size: 15
            };

            if (activeCategoryCode) {
              runCategorySearch(activeCategoryCode, searchOptions).then(renderPlaces);
              return;
            }

            if (activeCategoryLabel === '전체') {
              Promise.all(defaultCategoryCodes.map(function(code) {
                return runCategorySearch(code, searchOptions);
              })).then(function(results) {
                renderPlaces([].concat.apply([], results));
              });
              return;
            }

            runKeywordSearch(activeCategoryLabel, searchOptions).then(renderPlaces);
          };

          window.searchPlacesInCurrentMap = function() {
            window.searchPlacesByCategory(activeCategoryLabel, activeCategoryCode);
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
                } else {
                  window.searchPlacesByCategory(activeCategoryLabel, activeCategoryCode);
                }
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
          <TouchableOpacity style={styles.searchInputBox} onPress={() => router.push('/views/map_search')}>
            <Ionicons name="search" size={20} color="rgba(255,255,255,0.7)" />
            <Text style={styles.searchTextPlaceholder}>장소, 버스, 지하철, 주소 검색</Text>
          </TouchableOpacity>
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
      <Animated.View pointerEvents="auto" style={[styles.bottomSheet, { height: sheetHeight }]}>
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
              setSheetHeight(isSheetExpanded ? MIN_SHEET_HEIGHT : DEFAULT_SHEET_HEIGHT);
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
              <Text style={styles.mapSortButtonText}>
                정렬 기준 : <Text style={styles.mapSortValue}>{activeMapSort}</Text>
              </Text>
              <Ionicons name={isMapSortOpen ? 'chevron-up' : 'chevron-down'} size={22} color="#fff" />
            </TouchableOpacity>

            {isMapSortOpen ? (
              <View style={styles.mapSortPanel}>
                {mapSortOptions.map((option) => {
                  const isActive = activeMapSort === option.title;

                  return (
                    <TouchableOpacity
                      key={option.title}
                      style={styles.mapSortOption}
                      activeOpacity={0.85}
                      onPress={() => {
                        setActiveMapSort(option.title);
                        setIsMapSortOpen(false);
                      }}
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

            <ScrollView showsVerticalScrollIndicator={false} style={styles.cardScroll}>
            {isPlacesLoading ? (
              <Text style={styles.emptyText}>장소를 불러오는 중...</Text>
            ) : nearbyPlaces.length === 0 ? (
              <Text style={styles.emptyText}>주변 장소가 없어요.</Text>
            ) : (
              nearbyPlaces.map((place) => (
                <View style={styles.storeCard} key={place.id}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.storeName}>{place.name}</Text>
                    <TouchableOpacity>
                      <Ionicons name="heart-outline" size={24} color="#fff" />
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

      {/* 4-Item Bottom Navigation Bar */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="location" size={24} color="#fff" />
          <Text style={[styles.tabText, styles.tabTextActive]}>주변</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/views/list_all')}>
          <Ionicons name="list" size={24} color="#8f9bb3" />
          <Text style={styles.tabText}>리스트</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/views/saved_places')}>
          <Ionicons name="heart-outline" size={24} color="#8f9bb3" />
          <Text style={styles.tabText}>저장</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/views/my_map')}>
          <Ionicons name="person-outline" size={24} color="#8f9bb3" />
          <Text style={styles.tabText}>마이</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#e6e4e0',
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

  topOverlay: { position: 'absolute', top: 0, width: '100%', zIndex: 10 },
  searchContainer: { flexDirection: 'row', paddingHorizontal: 16, marginTop: Platform.OS === 'android' ? 20 : 0, alignItems: 'center' },
  menuButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  searchInputBox: { flex: 1, height: 44, backgroundColor: '#333', borderRadius: 22, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  searchTextPlaceholder: { color: 'rgba(255,255,255,0.7)', fontSize: 15, marginLeft: 10 },
  
  filterWrapper: { marginTop: 12 },
  filterScrollView: { width: '100%' },
  filterScroll: { paddingHorizontal: 16, paddingRight: 28 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#555', marginRight: 8 },
  filterPillActive: { backgroundColor: '#86a0ff' },
  filterText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#fff' },

  searchThisAreaContainer: { alignItems: 'center', marginTop: 16 },
  searchThisAreaButton: { flexDirection: 'row', backgroundColor: '#222', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  searchThisAreaText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  gpsButton: { position: 'absolute', right: 16, top: 160, width: 44, height: 44, borderRadius: 22, backgroundColor: '#555', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },

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
    backgroundColor: '#171c2a',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
  },
  categoryTitle: {
    color: '#dfe5f3',
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
  },
  categoryItemActive: {
    backgroundColor: '#3f86f7',
  },
  categoryItemText: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 18,
    fontWeight: '700',
  },
  categoryItemTextActive: {
    color: '#fff',
  },

  bottomSheet: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 10,
    width: '100%',
    backgroundColor: '#1e2336',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  sheetToggle: { alignItems: 'center', paddingTop: 12, paddingBottom: 14 },
  handleBar: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 },
  bottomSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  bottomSheetTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginRight: 12 },
  openOnlyBadge: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  openOnlyText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  viewAllText: { color: '#86a0ff', fontSize: 14 },
  mapSortButton: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 18,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapSortButtonText: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 17,
    fontWeight: '800',
  },
  mapSortValue: {
    color: '#fff',
  },
  mapSortPanel: {
    position: 'absolute',
    top: 70,
    left: 20,
    right: 20,
    zIndex: 3,
    elevation: 3,
    borderRadius: 22,
    backgroundColor: 'rgba(12,18,31,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  mapSortOption: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapSortOptionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  mapSortOptionSubtitle: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 14,
    fontWeight: '700',
  },
  mapSortRadio: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapSortRadioActive: {
    borderColor: '#8cb4ff',
    backgroundColor: 'rgba(140,180,255,0.12)',
  },
  
  cardScroll: { flex: 1 },
  emptyText: { color: 'rgba(255,255,255,0.62)', fontSize: 14, fontWeight: '600', paddingVertical: 20, textAlign: 'center' },
  storeCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  storeName: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  categoryBadge: { backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 16 },
  categoryText: { color: '#8cb4ff', fontSize: 12 },
  
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  statusBadge: { backgroundColor: '#00e676', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  unknownStatusBadge: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8 },
  unknownStatusText: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: 'bold' },
  statusUpdateText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  infoText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginLeft: 8 },

  bottomTabBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 85,
    backgroundColor: '#232634',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#34384b',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 25 : 10,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { color: '#8f9bb3', fontSize: 11, marginTop: 4 },
  tabTextActive: { color: '#fff', fontWeight: 'bold' },
});
