import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeMapCard } from '@/components/home-map-card';
import { getHomeScreenContentStyle } from '@/components/screen-layout';
import { authApi, favoritesApi, publicMapsApi, storesApi, tokenStore, userMapsApi, type MeResponse, type StoreLookupItemResponse } from '@/services/api';
import type { PublicMapListItemResponse } from '@/services/api/types';

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

type PeopleMapCardData = {
  mapId: number;
  publicMapUuid: string;
  nickname: string;
  title: string;
  likes: string;
  accent: string;
  profileImageUrl: string | null;
};

const ACCENT_COLORS = ['#e8f6f7', '#eef3ff', '#e7fbf7', '#ffe8e6', '#eef3ff', '#f6ecff'];
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

  const walkingSpeedMetersPerMinute = 80;
  return Math.max(1, Math.round(meters / walkingSpeedMetersPerMinute));
};

const formatLikes = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0';
  return value.toLocaleString('ko-KR');
};

const formatLocationLabel = (address: Location.LocationGeocodedAddress | null | undefined) => {
  if (!address) return '내 주변';

  const parts = [address.city, address.district, address.subregion].filter(
    (part): part is string => typeof part === 'string' && part.trim().length > 0
  );

  return parts.length > 0 ? parts.join(' ') : '내 주변';
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

function ShortcutCard({
  title,
  icon,
  count,
  countSuffix,
  accent,
  iconColor,
  countColor,
  countBgColor,
  countBorderColor,
  onPress,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
  countSuffix: '곳' | '개';
  accent: string;
  iconColor: string;
  countColor: string;
  countBgColor: string;
  countBorderColor: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.shortcutMetricCard} onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.shortcutMetricIconWrap, { backgroundColor: accent }]}>
        <View style={[styles.shortcutMetricDot, { backgroundColor: countColor }]} />
        <Ionicons name={icon} size={30} color={iconColor} />
      </View>
      <View style={styles.shortcutMetricTextWrap}>
        <Text style={styles.shortcutMetricTitle} numberOfLines={2}>
          {title}
        </Text>
        <View style={[styles.shortcutMetricCountPill, { backgroundColor: countBgColor, borderColor: countBorderColor }]}>
          <Text style={[styles.shortcutMetricCountText, { color: countColor }]}>
            {count.toLocaleString('ko-KR')}
            {countSuffix}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ActionCard({
  title,
  subtitle,
  icon,
  onPress,
  accentStyle,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accentStyle?: object;
}) {
  return (
    <TouchableOpacity style={[styles.actionCard, accentStyle]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.actionIconWrap}>
        <Ionicons name={icon} size={22} color="#18a5a5" />
      </View>
      <View style={styles.actionTextWrap}>
        <Text style={styles.actionTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.actionSubtitle} numberOfLines={2}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#18a5a5" />
    </TouchableOpacity>
  );
}

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
        {imageUrl ? (
          <Image
            source={{ uri: resolveAssetUrl(imageUrl) }}
            style={styles.placePhotoImage}
            resizeMode="cover"
          />
        ) : null}
        <View style={styles.placePhotoOverlay} />
        <View style={styles.placeStatusPill}>
          <Text style={styles.placeStatusText}>{status}</Text>
        </View>
      </View>
      <Text style={styles.placeTitle}>{title}</Text>
      <View style={styles.placeMetaRow}>
        <Text style={styles.placeMeta}>{category} · {distance}</Text>
        <View style={styles.placeLikesRow}>
          <Ionicons name="heart-outline" size={14} color="#6b7684" />
          <Text style={styles.placeMeta}>{likes}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function PeopleMapCard({
  nickname,
  title,
  likes,
  accent,
  profileImageUrl,
  onPress,
}: {
  nickname: string;
  title: string;
  likes: string;
  accent: string;
  profileImageUrl: string | null;
  onPress: () => void;
}) {
  const imageUri = profileImageUrl ? resolveAssetUrl(profileImageUrl) : null;

  return (
    <TouchableOpacity style={styles.peopleCard} onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.peoplePhoto, { backgroundColor: accent }]}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.peoplePhotoImage}
            resizeMode="cover"
          />
        ) : null}
        <View style={styles.peoplePhotoOverlay} />
        <View style={styles.peopleAvatar}>
          <Text style={styles.peopleAvatarText}>{nickname.slice(0, 1)}</Text>
        </View>
      </View>
      <View style={styles.peopleCardBody}>
        <View style={styles.peopleNameRow}>
          <Text style={styles.peopleName}>{nickname}</Text>
          <Text style={styles.peopleLikes}>좋아요 {likes}</Text>
        </View>
        <Text style={styles.peopleTitle} numberOfLines={1}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function MainHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [myMapCount, setMyMapCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [popularPlaces, setPopularPlaces] = useState<PopularPlaceCardData[]>([]);
  const [popularPlacesLoading, setPopularPlacesLoading] = useState(true);
  const [popularPlacesError, setPopularPlacesError] = useState<string | null>(null);
  const [nearbyOpenPlaces, setNearbyOpenPlaces] = useState<PopularPlaceCardData[]>([]);
  const [peopleMaps, setPeopleMaps] = useState<PeopleMapCardData[]>([]);
  const [peopleMapsTotalCount, setPeopleMapsTotalCount] = useState(0);
  const [peopleMapsLoading, setPeopleMapsLoading] = useState(true);
  const [peopleMapsError, setPeopleMapsError] = useState<string | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState('내 주변');

  const loadHomeData = useCallback(async () => {
    const token = await tokenStore.getAccessToken();
    if (!token) {
      setMe(null);
      setFavoriteCount(0);
      setMyMapCount(0);
      return;
    }

    try {
      const [meResponse, myMapsResponse, favoritesResponse] = await Promise.all([
        authApi.me(),
        userMapsApi.list(),
        favoritesApi.listStores(),
      ]);

      setMe(meResponse);
      setMyMapCount(myMapsResponse.length);
      setFavoriteCount(favoritesResponse.content.length);
    } catch {
      setMe(null);
      setFavoriteCount(0);
      setMyMapCount(0);
    }
  }, []);

  const loadPopularPlaces = useCallback(async () => {
      setPopularPlacesLoading(true);
      setPopularPlacesError(null);

      try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        throw new Error('위치 권한이 필요해요. 권한을 허용하면 주변 인기 장소를 보여드릴 수 있어요.');
      }

      const lastKnown = await Location.getLastKnownPositionAsync();
      const currentLocation =
        lastKnown ??
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }));

      const response = await storesApi.nearby(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
        5000,
        50
      );
      setCurrentCoords({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });

      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
        setLocationLabel(formatLocationLabel(addresses[0]));
      } catch {
        setLocationLabel('내 주변');
      }

      const nextPlaces = [...response.stores]
        .sort((left, right) => {
          const leftScore = (left.liveBusinessStatus === 'OPEN' ? 1 : 0) * 100000 + left.favoriteCount;
          const rightScore = (right.liveBusinessStatus === 'OPEN' ? 1 : 0) * 100000 + right.favoriteCount;
          return rightScore - leftScore;
        })
        .slice(0, 4)
        .map((store, index) => normalizePopularPlace(store, index, {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        }));

      setPopularPlaces(nextPlaces);

      const nextNearbyOpenPlaces = [...response.stores]
        .map((store, index) => normalizePopularPlace(store, index, {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        }))
        .filter((place) => place.status === '영업중' && (place.walkingMinutes ?? Number.POSITIVE_INFINITY) <= 10)
        .sort((left, right) => {
          const leftMinutes = left.walkingMinutes ?? Number.POSITIVE_INFINITY;
          const rightMinutes = right.walkingMinutes ?? Number.POSITIVE_INFINITY;

          if (leftMinutes !== rightMinutes) return leftMinutes - rightMinutes;
          const leftDistance = left.distanceMeters ?? Number.POSITIVE_INFINITY;
          const rightDistance = right.distanceMeters ?? Number.POSITIVE_INFINITY;
          if (leftDistance !== rightDistance) return leftDistance - rightDistance;
          return 0;
        });

      setNearbyOpenPlaces(nextNearbyOpenPlaces);
    } catch (error) {
      setPopularPlaces([]);
      setNearbyOpenPlaces([]);
      setCurrentCoords(null);
      setLocationLabel('내 주변');
      setPopularPlacesError(error instanceof Error ? error.message : '인기 장소를 불러오지 못했어요.');
    } finally {
      setPopularPlacesLoading(false);
    }
  }, []);

  const loadPeopleMaps = useCallback(async () => {
    setPeopleMapsLoading(true);
    setPeopleMapsError(null);

    try {
      const response = await publicMapsApi.list({
        sort: 'likes',
        page: 0,
        size: 6,
      });

      const nextPeopleMaps = response.content
        .slice(0, 3)
        .map((item: PublicMapListItemResponse, index) => ({
          mapId: item.mapId,
          publicMapUuid: item.publicMapUuid,
          nickname: item.nickname,
          title: item.title ?? '제목 없는 공개 지도',
          likes: item.likeCount.toLocaleString('ko-KR'),
          accent: ACCENT_COLORS[(index + 2) % ACCENT_COLORS.length],
          profileImageUrl: item.profileImageUrl,
        }));

      setPeopleMapsTotalCount(response.totalElements);
      setPeopleMaps(nextPeopleMaps);
    } catch (error) {
      setPeopleMaps([]);
      setPeopleMapsTotalCount(0);
      setPeopleMapsError(error instanceof Error ? error.message : '사람들 지도를 불러오지 못했어요.');
    } finally {
      setPeopleMapsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHomeData();
      void loadPopularPlaces();
      void loadPeopleMaps();
    }, [loadHomeData, loadPopularPlaces, loadPeopleMaps])
  );

  const displayName = me?.displayName ?? me?.nickname ?? null;
  const savedPlacesCount = me?.favorites.stores.length ?? favoriteCount;
  const nearbyOpenPlacesCount = nearbyOpenPlaces.length;
  const nearbyOpenPlacesPreview = nearbyOpenPlaces.slice(0, 12);
  const submitHomeSearch = () => {
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

  const openPeopleMap = useCallback(
    (map: PeopleMapCardData) => {
      router.push({
        pathname: '/views/public_map_detail',
        params: {
          mapId: String(map.mapId),
          uuid: map.publicMapUuid,
          title: map.title,
          nickname: map.nickname,
        },
      });
    },
    [router]
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        pointerEvents="none"
        colors={['#f7f8fa', '#f7f8fa', '#f7f8fa']}
        locations={[0, 0.5, 1]}
        style={styles.pageBackdrop}
      />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, getHomeScreenContentStyle(insets)]}
          stickyHeaderIndices={[0]}
        >
          <View style={[styles.heroStickyWrap, { paddingTop: insets.top + 4 }]}>
            <View style={styles.heroShell}>
              <View style={styles.topRow}>
                <View style={styles.brand}>
                  <Text style={styles.brandTitle}>Toggle</Text>
                </View>
                <View style={styles.topRight}>
                  <Text style={styles.locationLabel}>
                    <Text style={styles.locationPrefix}>지금, </Text>
                    <Text style={styles.locationValue}>{locationLabel}</Text>
                  </Text>
                  <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/my')} activeOpacity={0.85}>
                    <Ionicons name="person-outline" size={18} color="#18a5a5" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.greetingCard}>
                {displayName ? (
                  <>
                    <Text style={styles.greetingTitle}>👋 안녕하세요, {displayName}님!</Text>
                    <Text style={styles.greetingSubtitle}>오늘은 어디를 탐험해볼까요?</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.greetingTitle}>👋 안녕하세요!</Text>
                    <Text style={styles.greetingSubtitle}>오늘은 어디를 탐험해볼까요?</Text>
                  </>
                )}
              </View>

              <View style={styles.searchBar}>
                <Ionicons name="search" size={22} color="#18a5a5" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="카페, 음식점, 장소 검색"
                  placeholderTextColor="#8b95a1"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={submitHomeSearch}
                  returnKeyType="search"
                  blurOnSubmit={false}
                />
                <TouchableOpacity style={styles.searchSubmitButton} onPress={submitHomeSearch} activeOpacity={0.85}>
                  <Ionicons name="arrow-forward" size={18} color="#18a5a5" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.shortcutMetricGrid}>
            <ShortcutCard
              title="지금 열린 곳"
              icon="location-outline"
              count={nearbyOpenPlacesCount}
              countSuffix="곳"
              accent="#eaf8f7"
              iconColor="#19a5a7"
              countColor="#18a5a5"
              countBgColor="#f5fbfb"
              countBorderColor="#d9ecee"
              onPress={() => router.push('/map')}
            />
            <ShortcutCard
              title="저장한 장소"
              icon="heart-outline"
              count={savedPlacesCount}
              countSuffix="곳"
              accent="#fdecef"
              iconColor="#ec5e72"
              countColor="#ec5e72"
              countBgColor="#fff5f7"
              countBorderColor="#f4dde2"
              onPress={() => router.push('/saved')}
            />
            <ShortcutCard
              title="마이지도"
              icon="map-outline"
              count={myMapCount}
              countSuffix="개"
              accent="#eaf8f7"
              iconColor="#19a5a7"
              countColor="#18a5a5"
              countBgColor="#f5fbfb"
              countBorderColor="#d9ecee"
              onPress={() => router.push('/list')}
            />
            <ShortcutCard
              title="사람들 지도"
              icon="people-outline"
              count={peopleMapsTotalCount}
              countSuffix="개"
              accent="#f0ebfb"
              iconColor="#7f68db"
              countColor="#7f68db"
              countBgColor="#faf7ff"
              countBorderColor="#e5dcfb"
              onPress={() => router.push('/list')}
            />
          </View>

          {me?.role === 'OWNER' ? (
            <ActionCard
              title="점주 페이지"
              subtitle="매장 관리와 운영 상태를 바로 확인해요"
              icon="storefront-outline"
              onPress={() => router.push('/views/owner_dashboard')}
              accentStyle={styles.ownerAction}
            />
          ) : null}

          <HomeMapCard
            chipLabel="내 주변"
            title={`지금 열린 곳 ${nearbyOpenPlacesCount}개`}
            subtitle="내 위치 기준 도보 10분 이내"
            buttonLabel="지도 전체보기"
            onPress={() => router.push('/map')}
            center={currentCoords}
            places={nearbyOpenPlacesPreview
              .filter((place) => typeof place.latitude === 'number' && typeof place.longitude === 'number')
              .map((place) => ({
                id: String(place.storeId),
                name: place.title,
                latitude: place.latitude,
                longitude: place.longitude,
              }))}
            showCenterMarker={Boolean(currentCoords)}
            lockToCenter={Boolean(currentCoords)}
          />

          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionEmoji}>🔥</Text>
              <Text style={styles.sectionTitle}>지금 인기 장소</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/map')}>
              <Text style={styles.sectionMore}>더보기</Text>
            </TouchableOpacity>
          </View>

          {popularPlacesLoading ? (
            <View style={styles.popularLoadingCard}>
              <ActivityIndicator color="#18a5a5" />
              <Text style={styles.popularLoadingText}>주변 인기 장소를 불러오는 중이에요</Text>
            </View>
          ) : popularPlacesError ? (
            <View style={styles.popularErrorCard}>
              <Ionicons name="location-outline" size={20} color="#18a5a5" />
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

          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionEmoji}>👥</Text>
              <Text style={styles.sectionTitle}>사람들 지도</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/list')}>
              <Text style={styles.sectionMore}>더보기</Text>
            </TouchableOpacity>
          </View>

          {peopleMapsLoading ? (
            <View style={styles.peopleLoadingCard}>
              <ActivityIndicator color="#18a5a5" />
              <Text style={styles.peopleLoadingText}>사람들 지도를 불러오는 중이에요</Text>
            </View>
          ) : peopleMapsError ? (
            <View style={styles.peopleErrorCard}>
              <Ionicons name="people-outline" size={20} color="#18a5a5" />
              <Text style={styles.peopleErrorTitle}>사람들 지도를 불러오지 못했어요</Text>
              <Text style={styles.peopleErrorText}>{peopleMapsError}</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleCards}>
              {peopleMaps.map((map) => (
                <PeopleMapCard
                  key={map.publicMapUuid}
                  nickname={map.nickname}
                  title={map.title}
                  likes={map.likes}
                  accent={map.accent}
                  profileImageUrl={map.profileImageUrl}
                  onPress={() => openPeopleMap(map)}
                />
              ))}
            </ScrollView>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fa' },
  pageBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: { flex: 1 },
  scrollContent: { },
  heroStickyWrap: {
    backgroundColor: '#f7f8fa',
    paddingBottom: 10,
    marginBottom: 0,
    zIndex: 5,
    position: 'relative',
  },
  heroShell: {
    position: 'relative',
    backgroundColor: '#f7f8fa',
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
  topRow: {
    position: 'relative',
    zIndex: 2,
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
  brandTitle: {
    color: '#18a5a5',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  locationPrefix: {
    color: '#18a5a5',
  },
  locationValue: {
    color: '#191f28',
  },
  greetingCard: {
    alignSelf: 'stretch',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(24, 165, 165, 0.28)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    marginBottom: 10,
  },
  greetingTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
    color: '#191f28',
  },
  greetingSubtitle: {
    marginTop: 3,
    fontSize: 11,
    color: '#8b95a1',
    fontWeight: '600',
  },
  heroAccent: {
    color: '#18a5a5',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    position: 'relative',
    zIndex: 2,
    marginTop: 0,
    height: 58,
    borderRadius: 29,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  searchInput: { flex: 1, marginHorizontal: 12, color: '#8b95a1', fontSize: 15, fontWeight: '600', paddingVertical: 0 },
  searchSubmitButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutMetricGrid: {
    position: 'relative',
    zIndex: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
    marginTop: 14,
  },
  shortcutMetricCard: {
    width: '24%',
    alignItems: 'center',
  },
  shortcutMetricIconWrap: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  shortcutMetricDot: {
    position: 'absolute',
    right: -2,
    top: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  shortcutMetricTextWrap: {
    width: '100%',
    alignItems: 'center',
  },
  shortcutMetricTitle: {
    minHeight: 34,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
    color: '#191f28',
    marginBottom: 8,
  },
  shortcutMetricCountPill: {
    minWidth: 56,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  shortcutMetricCountText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
  },
  ownerAction: { marginTop: 4, marginBottom: 14 },
  actionCard: {
    position: 'relative',
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#ffffff',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#edf8f8',
  },
  actionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    color: '#191f28',
    fontSize: 14,
    fontWeight: '900',
  },
  actionSubtitle: {
    marginTop: 4,
    color: '#6b7684',
    fontSize: 12,
    lineHeight: 16,
  },
  mapCard: {
    position: 'relative',
    zIndex: 2,
    marginTop: 18,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    overflow: 'hidden',
  },
  mapChip: {
    position: 'absolute',
    left: 14,
    top: 14,
    zIndex: 2,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapChipText: {
    color: '#191f28',
    fontSize: 12,
    fontWeight: '800',
  },
  mapPreview: {
    height: 168,
    backgroundColor: '#f3f7fb',
    overflow: 'hidden',
  },
  mapPreviewImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.9,
  },
  mapBackdropGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(230,251,250,0.24)',
  },
  pin: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#191f28',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pinLeftTop: { left: 52, top: 36 },
  pinLeftBottom: { left: 30, bottom: 42 },
  pinCenter: { left: '50%', top: '50%', marginLeft: -18, marginTop: -18 },
  pinRightTop: { right: 58, top: 38 },
  pinRightBottom: { right: 26, bottom: 44 },
  pinUpperLeft: { left: 110, top: 20 },
  pinLowerRight: { right: 88, bottom: 18 },
  centerDotOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerDotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#18a5a5',
    borderWidth: 2,
    borderColor: '#f9fafb',
  },
  mapHalo: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 120,
    height: 120,
    marginLeft: -60,
    marginTop: -60,
    borderRadius: 60,
    backgroundColor: 'rgba(14,165,164,0.12)',
  },
  mapFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
  },
  mapFooterTitle: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '900',
  },
  mapFooterSub: {
    marginTop: 4,
    color: '#6b7684',
    fontSize: 12,
  },
  mapFooterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#edf8f8',
  },
  mapFooterButtonText: {
    color: '#18a5a5',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionHeader: {
    position: 'relative',
    zIndex: 2,
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
  sectionEmoji: {
    fontSize: 18,
  },
  sectionTitle: {
    color: '#191f28',
    fontSize: 18,
    fontWeight: '900',
  },
  sectionMore: {
    color: '#18a5a5',
    fontSize: 13,
    fontWeight: '800',
  },
  horizontalCards: {
    position: 'relative',
    zIndex: 2,
    gap: 12,
    paddingBottom: 6,
  },
  popularLoadingCard: {
    position: 'relative',
    zIndex: 2,
    minHeight: 160,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  popularLoadingText: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '700',
  },
  popularErrorCard: {
    position: 'relative',
    zIndex: 2,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  popularErrorTitle: {
    marginTop: 10,
    color: '#191f28',
    fontSize: 15,
    fontWeight: '900',
  },
  popularErrorText: {
    marginTop: 6,
    color: '#6b7684',
    fontSize: 12,
    lineHeight: 17,
  },
  popularRetryButton: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: '#edf8f8',
  },
  popularRetryText: {
    color: '#18a5a5',
    fontSize: 12,
    fontWeight: '800',
  },
  peopleLoadingCard: {
    position: 'relative',
    zIndex: 2,
    minHeight: 150,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  peopleLoadingText: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '700',
  },
  peopleErrorCard: {
    position: 'relative',
    zIndex: 2,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  peopleErrorTitle: {
    marginTop: 10,
    color: '#191f28',
    fontSize: 15,
    fontWeight: '900',
  },
  peopleErrorText: {
    marginTop: 6,
    color: '#6b7684',
    fontSize: 12,
    lineHeight: 17,
  },
  peopleCards: {
    position: 'relative',
    zIndex: 2,
    gap: 12,
    paddingBottom: 6,
  },
  placeCard: {
    width: 138,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  placePhoto: {
    height: 102,
    padding: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  placePhotoImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placePhotoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  placeStatusPill: {
    position: 'absolute',
    left: 8,
    top: 8,
    zIndex: 3,
    backgroundColor: 'rgba(249,250,251,0.88)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  placeStatusText: {
    color: '#18a5a5',
    fontSize: 11,
    fontWeight: '900',
  },
  placeTitle: {
    color: '#191f28',
    fontSize: 14,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  placeMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 10,
  },
  placeMeta: {
    color: '#6b7684',
    fontSize: 11,
    fontWeight: '600',
  },
  placeLikesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  peopleCard: {
    width: 138,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  peoplePhoto: {
    height: 102,
    padding: 0,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  peoplePhotoImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  peoplePhotoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(249,250,251,0.12)',
  },
  peopleAvatar: {
    position: 'absolute',
    left: 8,
    top: 8,
    zIndex: 3,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(249,250,251,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  peopleAvatarText: {
    color: '#18a5a5',
    fontSize: 12,
    fontWeight: '900',
  },
  peopleCardBody: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
  },
  peopleNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  peopleName: {
    color: '#191f28',
    fontSize: 12,
    fontWeight: '900',
  },
  peopleLikes: {
    color: '#6b7684',
    fontSize: 11,
    fontWeight: '700',
  },
  peopleTitle: {
    color: '#191f28',
    fontSize: 14,
    fontWeight: '800',
  },
});
