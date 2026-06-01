import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Image, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MiniKakaoMapPreview } from '@/components/mini-kakao-map-preview';
import { storesApi, tokenStore, type StoreLookupItemResponse } from '@/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type PopularPlaceCardData = {
  storeId: number;
  title: string;
  category: string;
  distance: string;
  distanceMeters: number | null;
  walkingMinutes: number | null;
  likes: string;
  accent: string;
  status: string;
  phone: string | null;
  imageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
};

const ACCENT_COLORS = ['#eef3ff', '#f3f5f8', '#eef1f5', '#edf7ff', '#f4f6fa', '#eef5ff'];
const TOSS_BLUE = '#18a5a5';
const TOSS_SURFACE = '#f9fafb';
const TOSS_SURFACE_MUTED = '#eef1f5';
const TOSS_TEXT = '#191f28';
const TOSS_TEXT_SUBTLE = '#6b7684';
const TOSS_TEXT_MUTED = '#8b95a1';
const DEFAULT_PREVIEW_CENTER = {
  latitude: 37.5665,
  longitude: 126.978,
};
const resolveAssetUrl = (url: string) => {
  if (/^https?:\/\//i.test(url)) return url;
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
  return `${baseUrl}${url}`;
};

const formatCategory = (value: string | null | undefined) => {
  if (!value) return '장소';
  const segments = value
    .split('>')
    .map((segment) => segment.trim())
    .filter(Boolean);
  return segments[segments.length - 1] ?? value;
};

const formatDistance = (meters: number | null | undefined) => {
  if (typeof meters !== 'number' || Number.isNaN(meters)) return '거리 정보 없음';
  if (meters < 1000) return `${Math.max(1, Math.round(meters))}m`;
  if (meters < 10000) return `${(meters / 1000).toFixed(1)}km`;
  return `${Math.round(meters / 1000)}km`;
};

const estimateWalkingMinutes = (meters: number | null | undefined) => {
  if (typeof meters !== 'number' || Number.isNaN(meters)) return null;
  return Math.max(1, Math.round(meters / 80));
};

const formatLikes = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0';
  return value.toLocaleString('ko-KR');
};

const formatStoreStatus = (store: StoreLookupItemResponse) => {
  const liveStatus = store.liveBusinessStatus ?? store.businessStatus;
  if (liveStatus === 'OPEN') return '영업중';
  if (liveStatus === 'BREAK_TIME') return '브레이크타임';
  if (liveStatus === 'CLOSED') return '영업종료';
  if (liveStatus === 'TEMP_CLOSED') return '임시휴무';
  if (liveStatus === 'EARLY_CLOSED') return '조기마감';
  return store.operationalState ?? '상태 없음';
};

const calculateDistanceMeters = (
  from: { latitude: number; longitude: number },
  to: { latitude: number | null; longitude: number | null }
) => {
  if (typeof to.latitude !== 'number' || typeof to.longitude !== 'number') return null;

  const earthRadiusMeters = 6_371_000;
  const fromLat = (from.latitude * Math.PI) / 180;
  const toLat = (to.latitude * Math.PI) / 180;
  const deltaLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const deltaLng = ((to.longitude - from.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
};

const normalizePopularPlace = (
  store: StoreLookupItemResponse,
  index: number,
  currentCoords: { latitude: number; longitude: number } | null
): PopularPlaceCardData => {
  const distanceMeters = currentCoords ? calculateDistanceMeters(currentCoords, store) : null;
  const walkingMinutes = estimateWalkingMinutes(distanceMeters);

  return {
    storeId: store.storeId,
    title: store.name,
    category: formatCategory(store.categoryName),
    distance: formatDistance(distanceMeters),
    distanceMeters,
    walkingMinutes,
    likes: formatLikes(store.favoriteCount),
    accent: ACCENT_COLORS[index % ACCENT_COLORS.length],
    status: formatStoreStatus(store),
    phone: store.phone,
    imageUrl: store.imageUrls[0] ?? null,
    latitude: store.latitude,
    longitude: store.longitude,
  };
};

function PlaceCard({
  title,
  category,
  distance,
  likes,
  accent,
  status,
  imageUrl,
  onPress,
}: {
  title: string;
  category: string;
  distance: string;
  likes: string;
  accent: string;
  status: string;
  imageUrl: string | null;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.placeCard} onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.placePhoto, { backgroundColor: accent }]}>
        {imageUrl ? <Image source={{ uri: resolveAssetUrl(imageUrl) }} style={styles.placePhotoImage} /> : null}
        <View style={styles.placePhotoOverlay} />
        <View style={styles.placeStatusPill}>
          <Text style={styles.placeStatusText}>{status}</Text>
        </View>
      </View>
      <Text style={styles.placeTitle}>{title}</Text>
      <View style={styles.placeMetaRow}>
        <Text style={styles.placeMeta}>{category} · {distance}</Text>
        <View style={styles.placeLikesRow}>
          <Ionicons name="heart-outline" size={14} color={TOSS_TEXT_SUBTLE} />
          <Text style={styles.placeMeta}>{likes}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function LandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [popularPlaces, setPopularPlaces] = useState<PopularPlaceCardData[]>([]);
  const [popularPlacesLoading, setPopularPlacesLoading] = useState(true);
  const [popularPlacesError, setPopularPlacesError] = useState<string | null>(null);
  const [nearbyOpenPlaces, setNearbyOpenPlaces] = useState<PopularPlaceCardData[]>([]);
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [hasLiveLocation, setHasLiveLocation] = useState(false);

  const loadPopularPlaces = useCallback(async () => {
    setPopularPlacesLoading(true);
    setPopularPlacesError(null);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      let latitude = DEFAULT_PREVIEW_CENTER.latitude;
      let longitude = DEFAULT_PREVIEW_CENTER.longitude;

      if (permission.status === 'granted') {
        const lastKnown = await Location.getLastKnownPositionAsync();
        const currentLocation =
          lastKnown ??
          (await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }));

        latitude = currentLocation.coords.latitude;
        longitude = currentLocation.coords.longitude;
        setHasLiveLocation(true);
      } else {
        setHasLiveLocation(false);
      }

      const response = await storesApi.nearby(
        latitude,
        longitude,
        3000,
        20
      );
      setCurrentCoords({
        latitude,
        longitude,
      });

      const nextPlaces = [...response.stores]
        .sort((left, right) => {
          const leftScore = (left.liveBusinessStatus === 'OPEN' ? 1 : 0) * 100000 + left.favoriteCount;
          const rightScore = (right.liveBusinessStatus === 'OPEN' ? 1 : 0) * 100000 + right.favoriteCount;
          return rightScore - leftScore;
        })
        .slice(0, 4)
        .map((store, index) =>
          normalizePopularPlace(
            store,
            index,
            {
              latitude,
              longitude,
            }
          )
        );

      setPopularPlaces(nextPlaces);

      const nextNearbyOpenPlaces = [...response.stores]
        .map((store, index) =>
          normalizePopularPlace(store, index, {
            latitude,
            longitude,
          })
        )
        .filter((place) => place.status === '영업중' && (place.walkingMinutes ?? Number.POSITIVE_INFINITY) <= 10)
        .sort((left, right) => {
          const leftMinutes = left.walkingMinutes ?? Number.POSITIVE_INFINITY;
          const rightMinutes = right.walkingMinutes ?? Number.POSITIVE_INFINITY;
          if (leftMinutes !== rightMinutes) return leftMinutes - rightMinutes;

          const leftDistance = left.distanceMeters ?? Number.POSITIVE_INFINITY;
          const rightDistance = right.distanceMeters ?? Number.POSITIVE_INFINITY;
          return leftDistance - rightDistance;
        });

      setNearbyOpenPlaces(nextNearbyOpenPlaces);
    } catch (error) {
      setHasLiveLocation(false);
      setPopularPlaces([]);
      setNearbyOpenPlaces([]);
      setPopularPlacesError(error instanceof Error ? error.message : '인기 장소를 불러오지 못했어요.');
    } finally {
      setPopularPlacesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPopularPlaces();
  }, [loadPopularPlaces]);

  const handlePeopleMapPress = async () => {
    const accessToken = await tokenStore.getAccessToken();
    if (!accessToken) {
      router.replace('/views/user_login');
      return;
    }

    router.push('/views/search_nickname');
  };

  const handleMyMapPress = async () => {
    const accessToken = await tokenStore.getAccessToken();
    if (!accessToken) {
      router.replace('/views/user_login');
      return;
    }

    router.push('/views/my_map');
  };

  const submitLandingSearch = () => {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      router.push('/map');
      return;
    }

    router.push(`/map?query=${encodeURIComponent(trimmedQuery)}`);
  };

  const openPopularPlace = useCallback(
    (place: PopularPlaceCardData) => {
      router.push({
        pathname: '/views/store_detail',
        params: {
          storeId: String(place.storeId),
          storeName: place.title,
          storePhone: place.phone ?? '',
        },
      });
    },
    [router]
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        pointerEvents="none"
        colors={['#ffffff', '#f8fafc', '#f3f7fb', '#eef3f8']}
        locations={[0, 0.38, 0.74, 1]}
        style={styles.pageBackdrop}
      />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          stickyHeaderIndices={[0]}
        >
          <View style={[styles.heroStickyWrap, { paddingTop: insets.top + 6 }]}>
            <View style={styles.heroShell}>
              <View style={styles.heroShade} pointerEvents="none" />
              <View style={styles.topRow}>
                <View style={styles.brand}>
                  <View style={styles.brandCopy}>
                    <Text style={styles.brandTitle}>Toggle</Text>
                  </View>
                </View>
                <View style={styles.heroCopy}>
                  <Text style={styles.heroTitle}>
                    <Text style={styles.heroAccent}>지금, </Text>어디 갈까?
                  </Text>
                  <Text style={styles.heroSubtitle}>
                    지금 <Text style={styles.heroSubtitleAccent}>열려있는</Text> 장소를 확인해보세요
                  </Text>
                </View>
              </View>

              <View style={styles.searchBar}>
                <Ionicons name="search" size={22} color={TOSS_BLUE} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="카페, 음식점, 장소 검색"
                  placeholderTextColor={TOSS_TEXT_MUTED}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={submitLandingSearch}
                  returnKeyType="search"
                  blurOnSubmit={false}
                />
                <TouchableOpacity onPress={submitLandingSearch} activeOpacity={0.85}>
                  <Ionicons name="arrow-forward" size={18} color={TOSS_BLUE} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.quickRow}>
            <TouchableOpacity style={[styles.quickCard, styles.quickCardA]} onPress={() => router.push('/map')} activeOpacity={0.9}>
              <View style={styles.quickRowTop}>
                <View style={[styles.quickIconCircle, styles.quickIconCircleA]}>
                  <Ionicons name="location-outline" size={23} color={TOSS_BLUE} />
                </View>
                <View style={styles.quickTextBlock}>
                  <Text style={styles.quickTitle} numberOfLines={2}>지금 열린 곳</Text>
                  <Text style={styles.quickSubtitle} numberOfLines={2}>내 주변 영업 중인 장소</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={TOSS_BLUE} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.quickCard, styles.quickCardB]} onPress={handlePeopleMapPress} activeOpacity={0.9}>
              <View style={styles.quickRowTop}>
                <View style={[styles.quickIconCircle, styles.quickIconCircleB]}>
                  <Ionicons name="people-outline" size={23} color={TOSS_BLUE} />
                </View>
                <View style={styles.quickTextBlock}>
                  <Text style={styles.quickTitle} numberOfLines={2}>지도 둘러보기</Text>
                  <Text style={styles.quickSubtitle} numberOfLines={2}>다른 사람의 지도를 구경해요</Text>
                </View>
                <Ionicons name="lock-closed-outline" size={16} color={TOSS_BLUE} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.mapCard}>
            <View style={styles.mapCardAccent} pointerEvents="none" />
            <View style={styles.mapChip}>
              <Ionicons name="radio-button-on-outline" size={14} color={TOSS_BLUE} />
              <Text style={styles.mapChipText}>내 주변</Text>
            </View>
            <View style={styles.mapPreview}>
              <MiniKakaoMapPreview
                height={250}
                center={currentCoords}
                showCenterMarker={hasLiveLocation}
                lockToCenter={hasLiveLocation}
                places={nearbyOpenPlaces
                  .filter((place) => typeof place.latitude === 'number' && typeof place.longitude === 'number')
                  .map((place) => ({
                    id: String(place.storeId),
                    name: place.title,
                    latitude: place.latitude,
                    longitude: place.longitude,
                  }))}
              />
            </View>
            <View style={styles.mapFooter}>
              <View>
                <Text style={styles.mapFooterTitle}>지금 열린 곳 {nearbyOpenPlaces.length}개</Text>
                <Text style={styles.mapFooterSub}>내 위치 기준 도보 10분 이내</Text>
              </View>
              <TouchableOpacity style={styles.mapFooterButton} onPress={() => router.push('/map')} activeOpacity={0.9}>
                <Text style={styles.mapFooterButtonText}>지도 전체보기</Text>
                <Ionicons name="chevron-forward" size={16} color={TOSS_BLUE} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionEmoji}>🔥</Text>
              <Text style={styles.sectionTitle}>지금 인기 장소</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/map')} activeOpacity={0.85}>
              <Text style={styles.sectionMore}>더보기</Text>
            </TouchableOpacity>
          </View>

          {popularPlacesLoading ? (
            <View style={styles.popularLoadingCard}>
              <ActivityIndicator color={TOSS_BLUE} />
              <Text style={styles.popularLoadingText}>주변 인기 장소를 불러오는 중이에요</Text>
            </View>
          ) : popularPlacesError ? (
            <View style={styles.popularErrorCard}>
              <Ionicons name="location-outline" size={20} color={TOSS_BLUE} />
              <Text style={styles.popularErrorTitle}>인기 장소를 불러오지 못했어요</Text>
              <Text style={styles.popularErrorText}>{popularPlacesError}</Text>
              <TouchableOpacity style={styles.popularRetryButton} onPress={() => void loadPopularPlaces()} activeOpacity={0.9}>
                <Text style={styles.popularRetryText}>다시 시도</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCards}>
              {popularPlaces.map((place) => (
                <PlaceCard
                  key={place.storeId}
                  title={place.title}
                  category={place.category}
                  distance={place.distance}
                  likes={place.likes}
                  accent={place.accent}
                  status={place.status}
                  imageUrl={place.imageUrl}
                  onPress={() => openPopularPlace(place)}
                />
              ))}
            </ScrollView>
          )}

          <View style={styles.authPanel}>
            <View style={styles.authPanelIcon}>
              <Ionicons name="lock-closed-outline" size={24} color={TOSS_BLUE} />
            </View>
            <Text style={styles.authPanelTitle}>사람들 지도를 보려면 로그인하세요</Text>
            <Text style={styles.authPanelSubtitle}>다른 사람들의 추천 코스와 장소를 확인해보세요</Text>
            <View style={styles.authBenefitRow}>
              <View style={styles.authBenefitPill}>
                <Ionicons name="map-outline" size={12} color={TOSS_BLUE} />
                <Text style={styles.authBenefitText}>추천 코스</Text>
              </View>
              <View style={styles.authBenefitPill}>
                <Ionicons name="heart-outline" size={12} color={TOSS_BLUE} />
                <Text style={styles.authBenefitText}>좋아요 순</Text>
              </View>
              <View style={styles.authBenefitPill}>
                <Ionicons name="people-outline" size={12} color={TOSS_BLUE} />
                <Text style={styles.authBenefitText}>다른 사람 지도</Text>
              </View>
            </View>
            <View style={styles.authButtons}>
              <TouchableOpacity style={styles.loginButton} onPress={() => router.replace('/views/user_login')} activeOpacity={0.9}>
                <Text style={styles.loginButtonText}>로그인</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.signupButton} onPress={() => router.replace('/views/user_signup')} activeOpacity={0.9}>
                <Text style={styles.signupButtonText}>회원가입</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.myMapCard}>
            <View style={styles.myMapLeft}>
              <View style={styles.myMapIconWrap}>
                <Ionicons name="bookmark-outline" size={24} color={TOSS_BLUE} />
              </View>
              <View style={styles.myMapCopy}>
                <Text style={styles.myMapTitle}>내 지도</Text>
                <Text style={styles.myMapSubtitle} numberOfLines={2}>
                  내가 저장한 장소와 지도를 확인해요
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.manageButton} onPress={handleMyMapPress} activeOpacity={0.9}>
              <Text style={styles.manageButtonText}>내 지도 보기</Text>
              <Ionicons name="chevron-forward" size={16} color={TOSS_BLUE} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fc' },
  pageBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 0,
    paddingBottom: 26,
  },
  heroStickyWrap: {
    backgroundColor: '#f7f9fc',
    paddingBottom: 10,
    marginBottom: 0,
    zIndex: 5,
    position: 'relative',
  },
  topRow: {
    position: 'relative',
    zIndex: 2,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroShell: {
    position: 'relative',
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    minHeight: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    overflow: 'visible',
  },
  heroArtWrap: {
    display: 'none',
  },
  heroShade: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  brandCopy: {
    justifyContent: 'center',
  },
  brandTitle: {
    color: TOSS_TEXT,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
  },
  heroCopy: {
    position: 'relative',
    zIndex: 2,
    alignItems: 'flex-end',
    flexShrink: 1,
  },
  heroTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
    color: TOSS_TEXT,
    textAlign: 'right',
  },
  heroAccent: {
    color: TOSS_BLUE,
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 11,
    color: TOSS_TEXT_SUBTLE,
    lineHeight: 15,
    textAlign: 'right',
  },
  heroSubtitleAccent: {
    color: TOSS_BLUE,
    fontWeight: '700',
  },
  searchBar: {
    position: 'relative',
    zIndex: 2,
    marginTop: 8,
    height: 58,
    borderRadius: 29,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    shadowColor: '#cbd5e1',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginHorizontal: 12,
    color: TOSS_TEXT_MUTED,
    fontSize: 15,
    fontWeight: '600',
  },
  quickRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  quickCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 90,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#cbd5e1',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  quickCardA: {
    borderColor: 'transparent',
  },
  quickCardB: {
    borderColor: 'transparent',
  },
  quickRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIconCircleA: {
    backgroundColor: TOSS_SURFACE_MUTED,
  },
  quickIconCircleB: {
    backgroundColor: TOSS_SURFACE_MUTED,
  },
  quickTextBlock: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  quickTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: TOSS_TEXT,
    marginBottom: 2,
  },
  quickSubtitle: {
    fontSize: 11,
    lineHeight: 13,
    color: TOSS_TEXT_SUBTLE,
  },
  mapCard: {
    marginTop: 18,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 0,
    borderColor: 'transparent',
    overflow: 'hidden',
    shadowColor: '#cbd5e1',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  mapCardAccent: {
    position: 'absolute',
    right: -60,
    top: -48,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'transparent',
  },
  mapChip: {
    position: 'absolute',
    left: 14,
    top: 14,
    zIndex: 2,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: TOSS_TEXT_MUTED,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 1,
  },
  mapChipText: {
    fontSize: 12,
    color: TOSS_TEXT,
    fontWeight: '800',
  },
  mapPreview: {
    height: 250,
    backgroundColor: '#eef3f8',
    position: 'relative',
    overflow: 'hidden',
  },
  mapPreviewImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  mapBackdropGlow: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 200,
    height: 200,
    marginLeft: -100,
    marginTop: -100,
    borderRadius: 100,
    backgroundColor: 'rgba(249,250,251,0.58)',
    opacity: 0.9,
  },
  mapRiver: {
    position: 'absolute',
    right: -24,
    top: -20,
    width: 84,
    height: 310,
    backgroundColor: 'rgba(24,165,165,0.14)',
    transform: [{ rotate: '14deg' }],
    borderRadius: 42,
  },
  mapRiverSoft: {
    right: -12,
    top: 0,
    width: 52,
    height: 240,
    backgroundColor: 'rgba(24,165,165,0.08)',
  },
  mapRoad: {
    position: 'absolute',
    backgroundColor: 'rgba(249,250,251,0.92)',
    borderRadius: 999,
  },
  mapRoadMajor1: {
    left: -20,
    top: 126,
    width: 360,
    height: 10,
    transform: [{ rotate: '14deg' }],
    opacity: 0.8,
  },
  mapRoadMajor2: {
    left: -8,
    top: 88,
    width: 340,
    height: 8,
    transform: [{ rotate: '-8deg' }],
    opacity: 0.72,
  },
  mapRoadMajor3: {
    left: 18,
    top: 170,
    width: 320,
    height: 9,
    transform: [{ rotate: '3deg' }],
    opacity: 0.64,
  },
  mapRoadDiagonal1: {
    left: -10,
    top: 88,
    width: 300,
    height: 8,
    transform: [{ rotate: '22deg' }],
  },
  mapRoadDiagonal2: {
    left: 28,
    top: 112,
    width: 250,
    height: 8,
    transform: [{ rotate: '-24deg' }],
  },
  mapRoadHorizontal1: {
    left: -10,
    top: 156,
    width: 330,
    height: 8,
    opacity: 0.85,
  },
  mapRoadHorizontal2: {
    left: 0,
    top: 54,
    width: 320,
    height: 6,
    opacity: 0.65,
  },
  mapRoadVertical1: {
    left: 116,
    top: -8,
    width: 7,
    height: 260,
    opacity: 0.6,
  },
  mapRoadVertical2: {
    left: 214,
    top: 18,
    width: 7,
    height: 210,
    opacity: 0.55,
  },
  mapPark: {
    position: 'absolute',
    backgroundColor: 'rgba(107,118,132,0.10)',
    borderRadius: 8,
    transform: [{ rotate: '-12deg' }],
  },
  mapPark1: {
    left: 34,
    top: 24,
    width: 34,
    height: 18,
  },
  mapPark2: {
    left: 132,
    top: 34,
    width: 42,
    height: 20,
  },
  mapPark3: {
    left: 164,
    top: 182,
    width: 48,
    height: 22,
  },
  mapPark4: {
    left: 218,
    top: 94,
    width: 38,
    height: 18,
  },
  mapPark5: {
    left: 48,
    top: 186,
    width: 30,
    height: 16,
  },
  mapHalo: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(24,165,165,0.10)',
    left: '50%',
    top: '50%',
    marginLeft: -66,
    marginTop: -66,
  },
  pin: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: TOSS_SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TOSS_TEXT,
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pinCenter: { left: '50%', top: '50%', marginLeft: -15, marginTop: -15, backgroundColor: '#edf8f8' },
  pinLeftTop: { left: 50, top: 40 },
  pinLeftBottom: { left: 86, top: 128 },
  pinRightTop: { right: 86, top: 44 },
  pinRightBottom: { right: 44, top: 126 },
  pinUpperLeft: { left: 130, top: 24 },
  pinLowerRight: { right: 138, bottom: 28 },
  centerDotOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: TOSS_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: TOSS_SURFACE,
  },
  centerDotInner: {
    width: 5,
    height: 5,
    borderRadius: 2,
    backgroundColor: TOSS_BLUE,
  },
  mapFooter: {
    marginTop: -10,
    marginHorizontal: 10,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: TOSS_TEXT,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  mapFooterTitle: {
    color: TOSS_TEXT,
    fontSize: 15,
    fontWeight: '900',
  },
  mapFooterSub: {
    color: TOSS_TEXT_MUTED,
    fontSize: 12,
    marginTop: 4,
  },
  mapFooterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: TOSS_SURFACE_MUTED,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mapFooterButtonText: {
    color: TOSS_BLUE,
    fontSize: 12,
    fontWeight: '800',
  },
  sectionHeader: {
    marginTop: 22,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionEmoji: {
    fontSize: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: TOSS_TEXT,
  },
  sectionMore: {
    color: TOSS_BLUE,
    fontSize: 12,
    fontWeight: '800',
  },
  popularLoadingCard: {
    minHeight: 160,
    borderRadius: 18,
    backgroundColor: TOSS_SURFACE,
    borderWidth: 0,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  popularLoadingText: {
    color: TOSS_TEXT_SUBTLE,
    fontSize: 13,
    fontWeight: '700',
  },
  popularErrorCard: {
    borderRadius: 18,
    backgroundColor: TOSS_SURFACE,
    borderWidth: 0,
    borderColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  popularErrorTitle: {
    marginTop: 10,
    color: TOSS_TEXT,
    fontSize: 15,
    fontWeight: '900',
  },
  popularErrorText: {
    marginTop: 6,
    color: TOSS_TEXT_SUBTLE,
    fontSize: 12,
    lineHeight: 17,
  },
  popularRetryButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: '#edf8f8',
  },
  popularRetryText: {
    color: TOSS_BLUE,
    fontSize: 12,
    fontWeight: '800',
  },
  peopleLoadingCard: {
    marginTop: 4,
    minHeight: 156,
    borderRadius: 20,
    backgroundColor: TOSS_SURFACE,
    borderWidth: 0,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  peopleLoadingText: {
    color: TOSS_TEXT_SUBTLE,
    fontSize: 13,
    fontWeight: '700',
  },
  peopleErrorCard: {
    marginTop: 4,
    borderRadius: 20,
    backgroundColor: TOSS_SURFACE,
    borderWidth: 0,
    borderColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  peopleErrorTitle: {
    marginTop: 10,
    color: TOSS_TEXT,
    fontSize: 15,
    fontWeight: '900',
  },
  peopleErrorText: {
    marginTop: 6,
    color: TOSS_TEXT_SUBTLE,
    fontSize: 12,
    lineHeight: 17,
  },
  horizontalCards: {
    paddingRight: 18,
    gap: 12,
  },
  placeCard: {
    width: 138,
    borderRadius: 18,
    backgroundColor: TOSS_SURFACE,
    borderWidth: 0,
    borderColor: 'transparent',
    overflow: 'hidden',
    shadowColor: TOSS_TEXT_MUTED,
    shadowOpacity: 0.035,
    shadowRadius: 8,
    elevation: 1,
  },
  placePhoto: {
    height: 102,
    padding: 8,
    justifyContent: 'space-between',
  },
  placePhotoImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placePhotoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(249,250,251,0.18)',
  },
  placeStatusPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(249,250,251,0.88)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  placeStatusText: {
    color: TOSS_BLUE,
    fontSize: 11,
    fontWeight: '900',
  },
  placeTitle: {
    paddingHorizontal: 10,
    paddingTop: 10,
    color: TOSS_TEXT,
    fontSize: 14,
    fontWeight: '900',
  },
  placeMetaRow: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 4,
  },
  placeMeta: {
    color: TOSS_TEXT_SUBTLE,
    fontSize: 11,
    fontWeight: '600',
  },
  placeLikesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  myMapCard: {
    marginTop: 18,
    borderRadius: 20,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: TOSS_SURFACE,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  myMapLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  myMapCopy: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  myMapIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: TOSS_SURFACE_MUTED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myMapTitle: {
    color: TOSS_TEXT,
    fontSize: 14,
    fontWeight: '900',
  },
  myMapSubtitle: {
    color: TOSS_TEXT_SUBTLE,
    fontSize: 10,
    marginTop: 3,
    lineHeight: 14,
    flexShrink: 1,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: TOSS_SURFACE_MUTED,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  manageButtonText: {
    color: TOSS_BLUE,
    fontSize: 11,
    fontWeight: '800',
  },
  authPanel: {
    position: 'relative',
    marginTop: 22,
    borderRadius: 20,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: TOSS_SURFACE,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },
  authPanelIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: TOSS_SURFACE_MUTED,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  authPanelTitle: {
    color: TOSS_TEXT,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 20,
    width: '100%',
    paddingHorizontal: 8,
    flexShrink: 1,
  },
  authPanelSubtitle: {
    color: TOSS_TEXT_SUBTLE,
    fontSize: 11,
    marginTop: 6,
    lineHeight: 15,
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 8,
  },
  authBenefitRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  authBenefitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: TOSS_SURFACE,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  authBenefitText: {
    color: TOSS_TEXT,
    fontSize: 11,
    fontWeight: '800',
  },
  authButtons: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 16,
    width: '100%',
  },
  loginButton: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    backgroundColor: TOSS_BLUE,
    borderWidth: 1,
    borderColor: TOSS_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: TOSS_SURFACE,
    fontSize: 15,
    fontWeight: '900',
  },
  signupButton: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    backgroundColor: TOSS_SURFACE,
    borderWidth: 0,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signupButtonText: {
    color: TOSS_BLUE,
    fontSize: 15,
    fontWeight: '900',
  },
});
