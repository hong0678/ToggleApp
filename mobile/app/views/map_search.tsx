import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { AppBottomNav } from '@/components/app-bottom-nav';

const CATEGORY_OPTIONS = ['전체', '음식점', '카페', '편의점', '대형마트', '약국'] as const;
type CategoryLabel = (typeof CATEGORY_OPTIONS)[number];

const CATEGORY_CODES: Record<CategoryLabel, string | null> = {
  전체: null,
  음식점: 'FD6',
  카페: 'CE7',
  편의점: 'CS2',
  대형마트: 'MT1',
  약국: 'PM9',
};

type KakaoPlacePreview = {
  id: string;
  name: string;
  category: string;
  address: string;
  distance?: string;
  phone?: string;
};

export default function MapSearchScreen() {
  const router = useRouter();
  const webViewRef = useRef<React.ElementRef<typeof WebView>>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<CategoryLabel>('전체');
  const [places, setPlaces] = useState<KakaoPlacePreview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const performSearch = useCallback((options?: {
    query?: string;
    filter?: CategoryLabel;
    currentArea?: boolean;
  }) => {
    const nextQuery = (options?.query ?? searchQuery).trim();
    const nextFilter = options?.filter ?? activeFilter;
    const categoryCode = CATEGORY_CODES[nextFilter];
    const currentArea = options?.currentArea ?? false;

    if (!webViewRef.current) return;

    if (!nextQuery && !currentArea && nextFilter === '전체') {
      setIsLoading(true);
      webViewRef.current.injectJavaScript(`window.searchPlacesByCategory(${JSON.stringify('전체')}, ${JSON.stringify(null)}); true;`);
      return;
    }

    setIsLoading(true);

    if (currentArea) {
      webViewRef.current.injectJavaScript(`
        window.searchCurrentMapArea(${JSON.stringify(nextQuery)}, ${JSON.stringify(categoryCode)});
        true;
      `);
      return;
    }

    if (nextQuery) {
      webViewRef.current.injectJavaScript(`
        window.searchPlacesByKeyword(${JSON.stringify(nextQuery)}, ${JSON.stringify(categoryCode)});
        true;
      `);
      return;
    }

    webViewRef.current.injectJavaScript(`
      window.searchPlacesByCategory(${JSON.stringify(nextFilter)}, ${JSON.stringify(categoryCode)});
      true;
    `);
  }, [activeFilter, searchQuery]);

  useEffect(() => {
    let active = true;

    const initializeLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (!active) return;

        if (status !== 'granted') {
          return;
        }

        const hasServices = await Location.hasServicesEnabledAsync();
        if (!active || !hasServices) return;

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!active) return;

        setCurrentCoords({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch {
        if (!active) return;
        Alert.alert('위치 확인 실패', '현재 위치를 가져오지 못했어요.');
      }
    };

    initializeLocation();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isMapReady || !currentCoords) return;

    webViewRef.current?.injectJavaScript(`
      window.moveToCurrentLocation(${currentCoords.latitude}, ${currentCoords.longitude});
      true;
    `);

    performSearch({ currentArea: true, query: searchQuery, filter: activeFilter });
  }, [activeFilter, currentCoords, isMapReady, performSearch, searchQuery]);

  const handleWebViewMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      if (message.type === 'map-ready') {
        setIsMapReady(true);
        return;
      }

      if (message.type === 'places') {
        setPlaces(Array.isArray(message.places) ? message.places : []);
        setIsLoading(false);
        return;
      }

      if (message.type === 'places-loading') {
        setIsLoading(true);
      }
    } catch {
      // Ignore non-JSON messages from the map WebView.
    }
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
          function postToApp(payload) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify(payload));
            }
          }

          function log(msg) {
            var el = document.getElementById('log');
            if (el) el.innerHTML += '<br/>' + msg;
          }

          var map = null;
          var currentMarker = null;
          var placeMarkers = [];
          var placesService = null;
          var activeCategoryLabel = '전체';
          var activeCategoryCode = null;
          var activeKeywordQuery = '';
          var defaultCategoryCodes = ['FD6', 'CE7', 'CS2', 'MT1', 'PM9', 'HP8', 'PO3', 'CT1', 'SC4', 'SW8', 'PK6'];

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

          window.searchPlacesByKeyword = function(query, categoryCode) {
            activeKeywordQuery = query || '';
            activeCategoryCode = categoryCode || null;

            if (!map || !placesService || !window.kakao) return;

            var trimmed = (query || '').trim();
            if (!trimmed) {
              renderPlaces([], false);
              return;
            }

            postToApp({ type: 'places-loading' });
            var searchOptions = createSearchOptions();

            if (categoryCode) {
              searchOptions.categoryGroupCode = categoryCode;
            }

            runKeywordSearch(trimmed, searchOptions).then(function(places) {
              renderPlaces(places, false);
            });
          };

          window.searchPlacesByCategory = function(label, categoryCode) {
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

          window.searchCurrentMapArea = function(query, categoryCode) {
            var trimmed = (query || '').trim();
            if (trimmed) {
              window.searchPlacesByKeyword(trimmed, categoryCode || activeCategoryCode);
              return;
            }

            if (activeCategoryCode || activeCategoryLabel !== '전체') {
              window.searchPlacesByCategory(activeCategoryLabel, categoryCode || activeCategoryCode);
              return;
            }

            window.searchPlacesByCategory('전체', null);
          };

          window.moveToCurrentLocation = function(lat, lng) {
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
          };

          var script = document.createElement('script');
          script.src = "https://dapi.kakao.com/v2/maps/sdk.js?appkey=2d21c1757f136b1ff4079ef80c900b15&autoload=false&libraries=services";
          script.onload = function() {
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
                map.setDraggable(true);
                map.setZoomable(true);
                placesService = new kakao.maps.services.Places();

                postToApp({ type: 'map-ready' });
              });
            } catch (e) {
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
      <View style={styles.mapPlaceholder}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: kakaoMapHtml, baseUrl: 'https://localhost' }}
          style={{ flex: 1 }}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          scrollEnabled={false}
          bounces={false}
          onMessage={handleWebViewMessage}
        />
      </View>

      <SafeAreaView style={styles.topOverlay} pointerEvents="box-none">
        <View style={styles.searchContainer}>
          <TouchableOpacity onPress={() => router.back()} style={styles.menuButton}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.searchInputBox}>
            <Ionicons name="search" size={20} color="rgba(255,255,255,0.7)" />
            <TextInput
              style={styles.searchTextInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => performSearch()}
              placeholder="장소, 버스, 지하철, 주소 검색"
              placeholderTextColor="rgba(255,255,255,0.7)"
              returnKeyType="search"
            />
            <TouchableOpacity
              onPress={() => performSearch()}
              activeOpacity={0.8}
              style={styles.searchActionButton}
            >
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.filterWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {CATEGORY_OPTIONS.map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterPill,
                  activeFilter === filter ? styles.filterPillActive : null,
                ]}
                onPress={() => {
                  setActiveFilter(filter);
                  performSearch({ query: searchQuery, filter });
                }}
              >
                <Text style={[
                  styles.filterText,
                  activeFilter === filter ? styles.filterTextActive : null,
                ]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.searchThisAreaContainer}>
          <TouchableOpacity
            style={styles.searchThisAreaButton}
            onPress={() => performSearch({ currentArea: true })}
          >
            <Ionicons name="reload" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.searchThisAreaText}>현 지도에서 검색</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.gpsButton}
          onPress={() => {
            if (!currentCoords) {
              Alert.alert('위치 확인 중', '현재 위치를 아직 가져오지 못했어요.');
              return;
            }

            webViewRef.current?.injectJavaScript(`
              window.moveToCurrentLocation(${currentCoords.latitude}, ${currentCoords.longitude});
              true;
            `);
            performSearch({ currentArea: true });
          }}
        >
          <MaterialIcons name="my-location" size={24} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>

      <View style={styles.bottomSheet}>
        <View style={styles.handleBar} />

        <View style={styles.bottomSheetHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.bottomSheetTitle}>검색 결과</Text>
            <TouchableOpacity style={styles.openOnlyBadge}>
              <Text style={styles.openOnlyText}>{isLoading ? '불러오는 중' : `${places.length}개`}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => performSearch({ currentArea: true })}>
            <Text style={styles.viewAllText}>전체보기</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.cardScroll}>
          {places.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>
                {isLoading ? '검색 중이에요' : '검색어를 입력해보세요'}
              </Text>
              <Text style={styles.emptyStateText}>
                {isLoading
                  ? '지도 안에서 가까운 장소를 모으고 있어요.'
                  : '이름이나 카테고리를 입력하면 지도와 목록이 같이 바뀝니다.'}
              </Text>
            </View>
          ) : (
            places.map((place) => (
              <View key={place.id} style={styles.storeCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.storeName}>{place.name}</Text>
                  <TouchableOpacity>
                    <Ionicons name="heart-outline" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>

                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{place.category}</Text>
                </View>

                <View style={styles.statusRow}>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{place.distance ? `${place.distance}m` : '검색 결과'}</Text>
                  </View>
                  <Text style={styles.statusUpdateText}>{place.phone || '전화번호 정보 없음'}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.infoText}>{place.address || '주소 정보 없음'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.infoText}>지도에서 바로 확인 가능</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      <AppBottomNav activeTab="map" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f5' },
  mapPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#e6e4e0',
  },
  topOverlay: { position: 'absolute', top: 0, width: '100%', zIndex: 10 },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: Platform.OS === 'android' ? 20 : 0,
    alignItems: 'center',
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  searchInputBox: {
    flex: 1,
    height: 44,
    backgroundColor: '#333',
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
    gap: 10,
  },
  searchTextInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    paddingVertical: 0,
  },
  searchActionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#4d5bd1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterWrapper: { marginTop: 12 },
  filterScroll: { paddingHorizontal: 16, gap: 8 },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#555',
  },
  filterPillActive: { backgroundColor: '#86a0ff' },
  filterText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  searchThisAreaContainer: { alignItems: 'center', marginTop: 16 },
  searchThisAreaButton: {
    flexDirection: 'row',
    backgroundColor: '#222',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  searchThisAreaText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  gpsButton: {
    position: 'absolute',
    right: 16,
    top: 160,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    backgroundColor: '#1e2336',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: 340,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginRight: 12,
  },
  openOnlyBadge: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  openOnlyText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  viewAllText: { color: '#86a0ff', fontSize: 14 },
  cardScroll: { flex: 1 },
  emptyState: {
    paddingVertical: 48,
    paddingHorizontal: 12,
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
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  storeCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  storeName: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  categoryBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 16,
  },
  categoryText: { color: '#8cb4ff', fontSize: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  statusBadge: {
    backgroundColor: '#00e676',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  statusText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  statusUpdateText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  infoText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginLeft: 8 },
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
