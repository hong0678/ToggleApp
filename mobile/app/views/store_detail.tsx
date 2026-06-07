import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  PanResponder,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FullscreenImageViewer } from '@/components/fullscreen-image-viewer';
import { useSafeBack } from '@/components/use-safe-back';
import {
  ApiClientError,
  favoritesApi,
  myMapApi,
  storeMenusApi,
  storeReviewsApi,
  storesApi,
  tokenStore,
  userMapsApi,
  type StoreLookupItemResponse,
} from '@/services/api';
import type { StoreMenuItem } from '@/services/api/storeMenus';
import type { StoreReviewItem } from '@/services/api/storeReviews';

type DetailTab = 'home' | 'menu' | 'review' | 'photo';
type ReviewSort = 'latest' | 'rating_desc' | 'rating_asc';

const resolveAssetUrl = (url: string) => {
  if (/^https?:\/\//i.test(url)) return url;
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
  return `${baseUrl}${url}`;
};

const formatNumber = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '정보 없음';
  return value.toLocaleString('ko-KR');
};

const formatRating = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return value.toFixed(1);
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '정보 없음';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCompactDateTime = (value: string | null | undefined) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  return `${year}.${month}.${day} ${hours}:${minutes}`;
};

const formatStoreStatus = (store: StoreLookupItemResponse | null) => {
  const liveStatus = store?.liveBusinessStatus ?? store?.businessStatus;
  if (liveStatus === 'OPEN') return '영업중';
  if (liveStatus === 'BREAK_TIME') return '브레이크타임';
  if (liveStatus === 'CLOSED') return '영업종료';
  if (liveStatus === 'TEMP_CLOSED') return '임시휴무';
  if (liveStatus === 'EARLY_CLOSED') return '조기마감';
  return store?.operationalState ?? '상태 없음';
};

const formatClockTime = (value: string | null | undefined) => {
  if (!value) return null;
  return value.length >= 5 ? value.slice(0, 5) : value;
};

const isConflictError = (error: unknown) => error instanceof ApiClientError && error.status === 409;
const isNotFoundError = (error: unknown) => error instanceof ApiClientError && error.status === 404;

function Section({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

function InfoItem({
  icon,
  label,
  value,
  flex = 1,
  showDivider = true,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  flex?: number;
  showDivider?: boolean;
}) {
  return (
    <View style={[styles.infoItem, { flex }, !showDivider && styles.infoItemLast]}>
      <Ionicons name={icon} size={23} color="#18a5a5" />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.86}
      style={[styles.tabButton, active && styles.tabButtonActive]}
    >
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function MenuRow({ item, onPressImage }: { item: StoreMenuItem; onPressImage?: () => void }) {
  return (
    <View style={styles.menuRow}>
      {item.imageUrl ? (
        <TouchableOpacity onPress={onPressImage} activeOpacity={0.9} disabled={!onPressImage}>
          <Image source={{ uri: resolveAssetUrl(item.imageUrl) }} style={styles.menuThumb} />
        </TouchableOpacity>
      ) : (
        <View style={styles.menuThumbPlaceholder}>
          <Ionicons name="restaurant-outline" size={18} color="#18a5a5" />
        </View>
      )}
      <View style={styles.menuRowLeft}>
        <View style={styles.menuRowTop}>
          <Text style={styles.menuName} numberOfLines={1} ellipsizeMode="tail">
            {item.name}
          </Text>
          {item.representative ? (
            <View style={styles.representativeBadge}>
              <Text style={styles.representativeBadgeText}>대표</Text>
            </View>
          ) : null}
        </View>
        {item.description ? (
          <Text style={styles.menuDesc} numberOfLines={2} ellipsizeMode="tail">
            {item.description}
          </Text>
        ) : null}
        <Text style={styles.menuMeta}>{item.available ? '판매중' : '품절'}</Text>
      </View>
      <View style={styles.menuPriceWrap}>
        <Text style={styles.menuPrice}>{item.price.toLocaleString()}원</Text>
      </View>
    </View>
  );
}

function ReviewCard({ item, onPressImage }: { item: StoreReviewItem; onPressImage: (index: number) => void }) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewTopRow}>
        <View style={styles.reviewAuthorWrap}>
          <Text style={styles.reviewAuthorLabel}>작성자</Text>
          <Text style={styles.reviewAuthor}>{item.displayName ?? item.authorNickname ?? '작성자'}</Text>
        </View>
        <View style={styles.reviewRatingPill}>
          <Ionicons name="star" size={12} color="#f59e0b" />
          <Text style={styles.reviewRatingText}>{item.rating}</Text>
        </View>
      </View>
      <Text style={styles.reviewDate}>
        작성: {formatDateTime(item.createdAt)} {item.updatedAt ? `· 수정: ${formatDateTime(item.updatedAt)}` : ''}
      </Text>
      <Text style={styles.reviewContent}>{item.content}</Text>
      {item.imageUrls.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewPhotoRow}>
          {item.imageUrls.map((url, index) => (
            <TouchableOpacity key={`${url}-${index}`} activeOpacity={0.9} onPress={() => onPressImage(index)}>
              <Image source={{ uri: resolveAssetUrl(url) }} style={styles.reviewPhotoThumb} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

export default function StoreDetailScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/saved');
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    storeId?: string | string[];
    storeName?: string | string[];
    storePhone?: string | string[];
  }>();
  const storeIdParam = Array.isArray(params.storeId) ? params.storeId[0] : params.storeId;
  const storeNameParam = Array.isArray(params.storeName) ? params.storeName[0] : params.storeName;
  const storePhoneParam = Array.isArray(params.storePhone) ? params.storePhone[0] : params.storePhone;
  const storeId = storeIdParam ? Number(storeIdParam) : null;

  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [store, setStore] = useState<StoreLookupItemResponse | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [isFavoriteSaving, setIsFavoriteSaving] = useState(false);
  const [menus, setMenus] = useState<StoreMenuItem[]>([]);
  const [reviews, setReviews] = useState<StoreReviewItem[]>([]);
  const [reviewSort, setReviewSort] = useState<ReviewSort>('latest');
  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('home');
  const [isMenuExpanded, setIsMenuExpanded] = useState(false);
  const [heroPhotoIndex, setHeroPhotoIndex] = useState(0);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [isCreateMapOpen, setIsCreateMapOpen] = useState(false);
  const [isLoadingMaps, setIsLoadingMaps] = useState(false);
  const [isCreatingMap, setIsCreatingMap] = useState(false);
  const [mapCollections, setMapCollections] = useState<Array<{ mapId: number; title: string; storeCount: number }>>([]);
  const [activeStoreMapIds, setActiveStoreMapIds] = useState<number[]>([]);
  const [newMapTitle, setNewMapTitle] = useState('');
  const [newMapDescription, setNewMapDescription] = useState('');
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageUrls, setPreviewImageUrls] = useState<string[]>([]);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [previewImageTitle, setPreviewImageTitle] = useState('사진 보기');
  const mapPickerMaxHeight = Math.min(windowHeight * 0.88, windowHeight - insets.top - 28);
  const mapPickerMinHeight = Math.min(360, mapPickerMaxHeight);
  const mapPickerDefaultHeight = Math.max(mapPickerMinHeight, Math.min(560, mapPickerMaxHeight));
  const [mapPickerHeight, setMapPickerHeight] = useState(mapPickerDefaultHeight);
  const mapPickerHeightRef = useRef(mapPickerDefaultHeight);
  const dragStartHeightRef = useRef(mapPickerDefaultHeight);
  const mapPickerBoundsRef = useRef({ min: mapPickerMinHeight, max: mapPickerMaxHeight });

  mapPickerBoundsRef.current = { min: mapPickerMinHeight, max: mapPickerMaxHeight };

  useEffect(() => {
    const nextHeight = Math.max(mapPickerMinHeight, Math.min(mapPickerHeightRef.current, mapPickerMaxHeight));
    mapPickerHeightRef.current = nextHeight;
    setMapPickerHeight(nextHeight);
  }, [mapPickerMaxHeight, mapPickerMinHeight]);

  const resizeMapPickerHeight = useCallback((value: number) => {
    const nextHeight = Math.max(mapPickerMinHeight, Math.min(value, mapPickerMaxHeight));
    mapPickerHeightRef.current = nextHeight;
    setMapPickerHeight(nextHeight);
  }, [mapPickerMaxHeight, mapPickerMinHeight]);

  const mapPickerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_event, gestureState) =>
        Math.abs(gestureState.dy) > 4 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onMoveShouldSetPanResponderCapture: (_event, gestureState) =>
        Math.abs(gestureState.dy) > 2 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragStartHeightRef.current = mapPickerHeightRef.current;
      },
      onPanResponderMove: (_event, gestureState) => {
        const nextHeight = dragStartHeightRef.current - gestureState.dy;
        const { min, max } = mapPickerBoundsRef.current;
        const clampedHeight = Math.max(min, Math.min(nextHeight, max));
        mapPickerHeightRef.current = clampedHeight;
        setMapPickerHeight(clampedHeight);
      },
      onPanResponderRelease: () => {
        const { min, max } = mapPickerBoundsRef.current;
        const nextHeight = Math.max(min, Math.min(mapPickerHeightRef.current, max));
        mapPickerHeightRef.current = nextHeight;
        setMapPickerHeight(nextHeight);
      },
      onPanResponderTerminate: () => {
        const { min, max } = mapPickerBoundsRef.current;
        const nextHeight = Math.max(min, Math.min(mapPickerHeightRef.current, max));
        mapPickerHeightRef.current = nextHeight;
        setMapPickerHeight(nextHeight);
      },
    })
  ).current;

  const loadReviews = useCallback(
    async (sort: ReviewSort = reviewSort) => {
      if (!storeId) return;

      try {
        setIsReviewLoading(true);
        const reviewResponse = await storeReviewsApi.list(storeId, 0, 6, sort);
        setReviews(reviewResponse.content);
      } catch {
        setReviews([]);
      } finally {
        setIsReviewLoading(false);
      }
    },
    [reviewSort, storeId]
  );

  const load = useCallback(async () => {
    if (!storeId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const token = await tokenStore.getAccessToken();
      setIsLoggedIn(Boolean(token));

      const [storeResponse, menuResponse, reviewResponse] = await Promise.all([
        storesApi.listByIds([storeId]),
        storeMenusApi.getStoreMenus(storeId),
        storeReviewsApi.list(storeId, 0, 6, reviewSort),
      ]);

      const loadedStore = storeResponse.stores[0] ?? null;
      setStore(loadedStore);
      setFavoriteCount(loadedStore?.favoriteCount ?? 0);
      setMenus(menuResponse.items);
      setReviews(reviewResponse.content);
      setIsMenuExpanded(false);
      setHeroPhotoIndex(0);

      if (token && loadedStore) {
        try {
          const favorites = await favoritesApi.listStores();
          const matchedFavorite = favorites.content.some((item) => item.storeId === loadedStore.storeId);
          setIsFavorited(matchedFavorite);
        } catch {
          setIsFavorited(false);
        }
      } else {
        setIsFavorited(false);
      }
    } catch {
      setStore(null);
      setIsFavorited(false);
      setFavoriteCount(0);
      setMenus([]);
      setReviews([]);
      setHeroPhotoIndex(0);
    } finally {
      setIsLoading(false);
    }
  }, [reviewSort, storeId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const title = store?.name ?? storeNameParam ?? '매장 상세';
  const isServiceStore = Boolean(store?.verified);
  const heroPhotos = store?.imageUrls ?? [];
  const heroPhotoWidth = Math.max(0, windowWidth - 40);
  const heroPhotoCount = heroPhotos.length;
  const heroPhotoCounterIndex = heroPhotoCount > 0 ? Math.min(heroPhotoIndex + 1, heroPhotoCount) : 0;
  const reviewPhotos = reviews.flatMap((review) => review.imageUrls);
  const primaryAddress = store?.roadAddress ?? store?.address ?? store?.jibunAddress ?? '주소 정보 없음';
  const displayPhone = store?.phone ?? storePhoneParam ?? '전화번호 정보 없음';
  const statusLabel = formatStoreStatus(store);
  const ratingLabel = formatRating(store?.reviewAverageRating ?? store?.rating);
  const reviewCount = store?.reviewCount ?? 0;
  const operationTimeLabel = store?.openTime && store?.closeTime
    ? `${formatClockTime(store.openTime)} ~ ${formatClockTime(store.closeTime)}`
    : '정보 없음';
  const breakTimeLabel = store?.breakStart && store?.breakEnd
    ? `${formatClockTime(store.breakStart)} ~ ${formatClockTime(store.breakEnd)}`
    : '정보 없음';
  const isOpenNow = statusLabel === '영업중';
  const operationHelpLabel = isOpenNow ? '정상적으로 운영 중이에요' : '현재 영업 상태를 확인해 주세요';
  const visibleMenus = isMenuExpanded ? menus : menus.slice(0, 5);
  const hasMoreMenus = menus.length > 5;
  const operationalMissing = !store?.openTime && !store?.closeTime && !store?.breakStart && !store?.breakEnd;
  const latestReviews = reviews.slice(0, 3);
  const favoriteCountLabel = formatNumber(favoriteCount);
  const reviewSortLabels: Record<ReviewSort, string> = {
    latest: '최신순',
    rating_desc: '별점 높은순',
    rating_asc: '별점 낮은순',
  };
  const openPreview = useCallback((url: string, title: string) => {
    setPreviewImageUrl(url);
    setPreviewImageUrls([url]);
    setPreviewImageIndex(0);
    setPreviewImageTitle(title);
  }, []);
  const openPreviewGallery = useCallback((urls: string[], index: number, title: string) => {
    if (urls.length === 0) return;
    const nextIndex = Math.max(0, Math.min(index, urls.length - 1));
    setPreviewImageUrls(urls);
    setPreviewImageIndex(nextIndex);
    setPreviewImageUrl(urls[nextIndex] ?? null);
    setPreviewImageTitle(title);
  }, []);
  const closePreview = useCallback(() => {
    setPreviewImageUrl(null);
    setPreviewImageUrls([]);
    setPreviewImageIndex(0);
  }, []);
  const handleHeroPhotoScrollEnd = useCallback(
    (offsetX: number) => {
      if (heroPhotoWidth <= 0) return;
      const nextIndex = Math.round(offsetX / heroPhotoWidth);
      setHeroPhotoIndex(Math.max(0, Math.min(nextIndex, heroPhotoCount - 1)));
    },
    [heroPhotoCount, heroPhotoWidth]
  );

  const handleFavoritePress = useCallback(async () => {
    if (!store) return;

    if (!isServiceStore) {
      Alert.alert('안내', '우리 서비스 매장에서만 저장할 수 있어요.');
      return;
    }

    if (!isLoggedIn) {
      Alert.alert(
        '로그인이 필요해요',
        '저장은 로그인 후 사용할 수 있어요.',
        [
          { text: '취소', style: 'cancel' },
          { text: '로그인 페이지로 이동', onPress: () => router.replace('/views/user_login') },
        ]
      );
      return;
    }

    if (isFavoriteSaving) return;

    setIsFavoriteSaving(true);

    try {
      if (isFavorited) {
        try {
          await favoritesApi.removeStore(store.storeId);
        } catch (error) {
          if (!isNotFoundError(error)) {
            throw error;
          }
        }

        try {
          await myMapApi.removeStore(store.storeId);
        } catch (error) {
          if (!isNotFoundError(error)) {
            console.warn('[store_detail] myMap removeStore failed after favorites remove', error);
          }
        }

        setIsFavorited(false);
        setFavoriteCount((current) => Math.max(0, current - 1));
        return;
      }

      try {
        await favoritesApi.addStore(store.storeId);
      } catch (error) {
        if (!isConflictError(error)) {
          throw error;
        }
      }

      try {
        await myMapApi.addStore(store.storeId);
      } catch (error) {
        if (!isConflictError(error)) {
          console.warn('[store_detail] myMap addStore failed after favorites add', error);
        }
      }

      setIsFavorited(true);
      setFavoriteCount((current) => current + 1);
    } catch {
      Alert.alert('저장 실패', '장소를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsFavoriteSaving(false);
    }
  }, [isFavorited, isFavoriteSaving, isLoggedIn, isServiceStore, router, store]);

  const openMyMapPicker = useCallback(async () => {
    if (!store) return;

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

    if (!isServiceStore) {
      Alert.alert('내 지도에 추가할 수 없어요', '등록된 매장만 내 지도에 추가할 수 있어요.');
      return;
    }

    setNewMapTitle('');
    setNewMapDescription('');
    resizeMapPickerHeight(mapPickerDefaultHeight);
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
              hasStore: detail.stores.includes(store.storeId),
            };
          } catch {
            return {
              mapId: map.mapId,
              title: map.title,
              storeCount: 0,
              hasStore: false,
            };
          }
        })
      );

      setMapCollections(counts.map(({ mapId, title, storeCount }) => ({ mapId, title, storeCount })));
      setActiveStoreMapIds(counts.filter((item) => item.hasStore).map((item) => item.mapId));
    } catch {
      Alert.alert('지도 목록 실패', '내 지도 목록을 불러오지 못했어요.');
      setMapCollections([]);
      setActiveStoreMapIds([]);
    } finally {
      setIsLoadingMaps(false);
    }
  }, [isLoggedIn, isServiceStore, mapPickerDefaultHeight, resizeMapPickerHeight, router, store]);

  const addStoreToSelectedMap = useCallback(async (mapId: number) => {
    if (!store) return;

    try {
      await userMapsApi.addStore(mapId, store.storeId);
      setActiveStoreMapIds((current) => (current.includes(mapId) ? current : [...current, mapId]));
      setIsMapPickerOpen(false);
      Alert.alert('추가 완료', '선택한 지도에 장소를 담았어요.');
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        setActiveStoreMapIds((current) => (current.includes(mapId) ? current : [...current, mapId]));
        setIsMapPickerOpen(false);
        Alert.alert('추가 완료', '이미 추가된 지도예요.');
        return;
      }

      Alert.alert('내 지도 저장 실패', error instanceof Error ? error.message : '장소를 내 지도에 저장하지 못했어요.');
    }
  }, [store]);

  const createMapAndAddStore = useCallback(async () => {
    if (!store) return;

    const mapTitle = newMapTitle.trim();
    if (!mapTitle) {
      Alert.alert('지도 이름 확인', '새 지도 이름을 입력해주세요.');
      return;
    }

    try {
      setIsCreatingMap(true);
      const createdMap = await userMapsApi.create({
        title: mapTitle,
        description: newMapDescription.trim() || null,
        isPublic: false,
      });
      await userMapsApi.addStore(createdMap.mapId, store.storeId);
      setMapCollections((current) => [...current, { mapId: createdMap.mapId, title: createdMap.title, storeCount: 1 }]);
      setActiveStoreMapIds((current) => [...current, createdMap.mapId]);
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
  }, [newMapDescription, newMapTitle, store]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.detailHeader}>
            <TouchableOpacity style={styles.headerBackButton} onPress={goBack} activeOpacity={0.85}>
              <Ionicons name="chevron-back" size={34} color="#18a5a5" />
            </TouchableOpacity>
            <Text style={styles.detailHeaderTitle}>매장 상세</Text>
            <View style={styles.headerRightSpacer} />
          </View>

          {isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#18a5a5" />
              <Text style={styles.loadingText}>매장 정보를 불러오는 중...</Text>
            </View>
          ) : !store ? (
            <View style={styles.emptyCard}>
              <Ionicons name="storefront-outline" size={28} color="#8b95a1" />
              <Text style={styles.emptyTitle}>매장 정보를 찾지 못했어요</Text>
              <Text style={styles.emptySubtitle}>백엔드에 등록된 매장만 상세를 볼 수 있어요.</Text>
            </View>
          ) : (
            <>
              <View style={styles.heroCard}>
                <View style={styles.heroPhotoFrame}>
                  {heroPhotoCount > 0 ? (
                    <ScrollView
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      decelerationRate="fast"
                      style={styles.heroPhotoScroller}
                      onMomentumScrollEnd={(event) => handleHeroPhotoScrollEnd(event.nativeEvent.contentOffset.x)}
                    >
                      {heroPhotos.map((url, index) => {
                        const imageUrl = resolveAssetUrl(url);
                        return (
                          <TouchableOpacity
                            key={`${url}-${index}`}
                            style={[styles.heroPhotoCard, { width: heroPhotoWidth }]}
                            activeOpacity={0.9}
                            onPress={() => openPreviewGallery(heroPhotos.map((photoUrl) => resolveAssetUrl(photoUrl)), index, title)}
                          >
                            <Image source={{ uri: imageUrl }} style={styles.heroPhotoImage} resizeMode="cover" />
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <View style={styles.heroPhotoEmpty}>
                      <Ionicons name="image-outline" size={32} color="#8ea2aa" />
                      <Text style={styles.heroPhotoEmptyText}>등록된 사진이 없어요</Text>
                    </View>
                  )}
                  {heroPhotoCount > 0 ? (
                    <View style={styles.photoCountBadge}>
                      <Text style={styles.photoCountText}>{heroPhotoCounterIndex} / {heroPhotoCount}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.heroBody}>
                  <View style={styles.heroTitleRow}>
                    <View style={styles.titleCopy}>
                      <Text style={styles.storeName} numberOfLines={1} ellipsizeMode="tail">
                        {title}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.heroFavoritePill, isFavorited && styles.heroFavoritePillActive]}
                      onPress={() => void handleFavoritePress()}
                      activeOpacity={0.84}
                      disabled={isFavoriteSaving}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name={isFavorited ? 'heart' : 'heart-outline'}
                        size={20}
                        color={isFavorited ? '#ff4d74' : '#8b95a1'}
                      />
                      <Text style={[styles.heroFavoriteText, isFavorited && styles.heroFavoriteTextActive]}>저장 {favoriteCountLabel}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.subtitleRow}>
                    <Text style={styles.subtitleMuted} numberOfLines={1} ellipsizeMode="tail">
                      {store.categoryName ?? '카테고리 없음'}
                    </Text>
                    {isServiceStore ? (
                      <View style={styles.serviceChip}>
                        <Text style={styles.serviceChipText}>우리 서비스 매장</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.heroRatingRow}>
                    <View style={styles.heroRatingItem}>
                      <Ionicons name="star" size={16} color="#f59e0b" />
                      <Text style={styles.heroRatingText}>{ratingLabel}</Text>
                    </View>
                    <View style={styles.heroRatingItem}>
                      <Ionicons name="chatbubble-outline" size={16} color="#18a5a5" />
                      <Text style={styles.heroRatingText}>리뷰 {reviewCount}개</Text>
                    </View>
                  </View>

                  <View style={styles.addressRow}>
                    <View style={styles.addressCopy}>
                      <Ionicons name="location-outline" size={18} color="#7b8493" />
                      <Text style={styles.addressText} numberOfLines={1} ellipsizeMode="tail">
                        {primaryAddress}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#7b8493" />
                  </View>

                  {store.ownerNotice ? (
                    <View style={styles.ownerMessageCard}>
                      <View style={styles.ownerMessageHeader}>
                        <Ionicons name="megaphone-outline" size={18} color="#18a5a5" />
                        <Text style={styles.ownerMessageTitle}>사장님 한마디</Text>
                      </View>
                      <Text style={styles.ownerMessageText}>{store.ownerNotice}</Text>
                      <Text style={styles.ownerQuoteMark}>”</Text>
                    </View>
                  ) : null}

                  <View style={styles.operationCard}>
                    <View style={styles.operationColumn}>
                      <View style={styles.operationTitleRow}>
                        <View style={[styles.operationDot, !isOpenNow && styles.operationDotMuted]} />
                        <Text style={styles.operationTitle}>현재 {statusLabel}</Text>
                      </View>
                      <Text style={styles.operationSubtitle}>{operationHelpLabel}</Text>
                    </View>
                    <View style={styles.operationDivider} />
                    <View style={styles.operationColumnCompact}>
                      <View style={styles.operationTitleRowCompact}>
                        <Ionicons name="time-outline" size={16} color="#18a5a5" />
                        <Text style={styles.operationLabel}>운영 시간</Text>
                      </View>
                      <Text style={styles.operationTime}>{operationTimeLabel}</Text>
                    </View>
                    <View style={styles.operationDivider} />
                    <View style={styles.operationColumnCompact}>
                      <View style={styles.operationTitleRowCompact}>
                        <Ionicons name="cafe-outline" size={16} color="#18a5a5" />
                        <Text style={styles.operationLabel}>브레이크 타임</Text>
                      </View>
                      <Text style={styles.operationTime}>{breakTimeLabel}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.tabBar}>
                <TabButton label="홈" active={activeTab === 'home'} onPress={() => setActiveTab('home')} />
                <TabButton label="메뉴" active={activeTab === 'menu'} onPress={() => setActiveTab('menu')} />
                <TabButton label="리뷰" active={activeTab === 'review'} onPress={() => setActiveTab('review')} />
                <TabButton label="사진" active={activeTab === 'photo'} onPress={() => setActiveTab('photo')} />
              </View>

              {activeTab === 'home' ? (
                <>
                  <Section title="운영 정보">
                    {operationalMissing ? (
                      <View style={styles.warningCard}>
                        <Ionicons name="time-outline" size={16} color="#18a5a5" />
                        <Text style={styles.warningText}>운영 시간이 아직 등록되지 않았어요. 점주 페이지에서 입력하면 보여져요.</Text>
                      </View>
                    ) : null}
                    <View style={styles.infoGrid}>
                      <InfoItem icon="sunny-outline" label="오픈" value={formatClockTime(store.openTime) ?? '-'} />
                      <InfoItem icon="moon-outline" label="마감" value={formatClockTime(store.closeTime) ?? '-'} />
                      <InfoItem icon="cafe-outline" label="휴게 시작" value={formatClockTime(store.breakStart) ?? '-'} />
                      <InfoItem icon="cafe-outline" label="휴게 종료" value={formatClockTime(store.breakEnd) ?? '-'} showDivider={false} />
                    </View>
                  </Section>

                  <Section title="매장 정보">
                    <View style={styles.infoGrid}>
                      <InfoItem icon="location-outline" label="주소" value={primaryAddress} />
                      <InfoItem
                        icon="call-outline"
                        label="전화번호"
                        value={displayPhone === '전화번호 정보 없음' ? '-' : displayPhone}
                      />
                      <InfoItem icon="calendar-outline" label="검증일" value={formatCompactDateTime(store.verifiedAt)} showDivider={false} />
                    </View>
                  </Section>
                </>
              ) : null}

              {activeTab === 'menu' ? (
                <Section
                  title="메뉴"
                  subtitle="메뉴는 최대 5개까지 먼저 보이고, 더보기로 펼칠 수 있어요."
                  action={
                    hasMoreMenus ? (
                      <TouchableOpacity
                        onPress={() => setIsMenuExpanded((value) => !value)}
                        activeOpacity={0.8}
                        style={styles.sectionToggle}
                      >
                        <Text style={styles.sectionToggleText}>{isMenuExpanded ? '접기' : '더보기'}</Text>
                      </TouchableOpacity>
                    ) : null
                  }
                >
                  {menus.length === 0 ? (
                    <Text style={styles.emptyInline}>등록된 메뉴가 없어요.</Text>
                  ) : (
                    <View style={styles.menuList}>
                    {visibleMenus.map((item) => (
                        <MenuRow
                          key={String(item.menuId ?? `${item.name}-${item.displayOrder}`)}
                          item={item}
                          onPressImage={
                            item.imageUrl ? () => openPreview(resolveAssetUrl(item.imageUrl), item.name) : undefined
                          }
                        />
                      ))}
                      {hasMoreMenus && !isMenuExpanded ? (
                        <TouchableOpacity style={styles.moreButton} onPress={() => setIsMenuExpanded(true)} activeOpacity={0.85}>
                          <Text style={styles.moreButtonText}>더보기</Text>
                          <Ionicons name="chevron-down" size={16} color="#18a5a5" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  )}
                </Section>
              ) : null}

              {activeTab === 'review' ? (
                <>
                  <Section title="리뷰 작성/수정" subtitle="로그인 후 리뷰를 작성하거나 내가 쓴 리뷰를 수정할 수 있어요.">
                    <View style={styles.reviewSummaryRow}>
                      <View style={styles.reviewSummaryPill}>
                        <Ionicons name="star" size={16} color="#f59e0b" />
                        <Text style={styles.reviewSummaryText}>{ratingLabel}</Text>
                      </View>
                      <View style={styles.reviewSummaryPill}>
                        <Ionicons name="chatbubble-outline" size={16} color="#18a5a5" />
                        <Text style={styles.reviewSummaryText}>리뷰 {reviewCount}개</Text>
                      </View>
                    </View>
                    {isLoggedIn ? (
                      <TouchableOpacity
                        style={[styles.actionButton, !isServiceStore && styles.actionButtonDisabled]}
                        disabled={!isServiceStore}
                        onPress={() =>
                          router.push({
                            pathname: '/views/store_reviews',
                            params: { storeId: String(store.storeId), storeName: store.name, mode: 'write' },
                          })
                        }
                        activeOpacity={0.9}
                      >
                        <Text style={styles.actionButtonText}>리뷰 작성/수정</Text>
                        <Ionicons name="chevron-forward" size={16} color={isServiceStore ? '#18a5a5' : '#8b95a1'} />
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.loginCardLite}>
                        <Text style={styles.loginCardLiteTitle}>로그인 후 작성 가능</Text>
                        <Text style={styles.loginCardLiteText}>리뷰 작성과 수정은 로그인 후 사용할 수 있어요.</Text>
                        <View style={styles.loginCardLiteButtons}>
                          <TouchableOpacity style={styles.loginSecondaryButton} onPress={() => router.replace('/views/user_login')} activeOpacity={0.9}>
                            <Text style={styles.loginSecondaryButtonText}>로그인</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.loginPrimaryButton} onPress={() => router.replace('/views/user_signup')} activeOpacity={0.9}>
                            <Text style={styles.loginPrimaryButtonText}>회원가입</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                    {!isServiceStore ? <Text style={styles.footerHint}>리뷰는 우리 서비스 매장에서만 볼 수 있어요.</Text> : null}
                  </Section>

                  <Section
                    title="리뷰 목록"
                    subtitle={reviewCount > latestReviews.length ? `최신 리뷰 ${latestReviews.length}개만 먼저 보여드려요.` : '최신 리뷰를 바로 확인할 수 있어요.'}
                    action={
                      <View style={styles.sortRow}>
                        {(['latest', 'rating_desc', 'rating_asc'] as ReviewSort[]).map((sort) => (
                          <TouchableOpacity
                            key={sort}
                            style={[styles.sortChip, reviewSort === sort && styles.sortChipActive]}
                            onPress={() => {
                              setReviewSort(sort);
                              void loadReviews(sort);
                            }}
                            activeOpacity={0.85}
                          >
                            <Text style={[styles.sortChipText, reviewSort === sort && styles.sortChipTextActive]}>
                              {reviewSortLabels[sort]}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    }
                  >
                    {isReviewLoading ? (
                      <View style={styles.loadingInline}>
                        <ActivityIndicator color="#18a5a5" />
                        <Text style={styles.loadingText}>리뷰를 불러오는 중...</Text>
                      </View>
                    ) : null}
                    {latestReviews.length === 0 ? (
                      <Text style={styles.emptyInline}>아직 리뷰가 없어요.</Text>
                    ) : (
                      <>
                        <View style={styles.reviewList}>
                          {latestReviews.map((item) => (
                          <ReviewCard
                            key={String(item.reviewId)}
                            item={item}
                            onPressImage={(indexValue) =>
                              openPreviewGallery(
                                item.imageUrls.map((url) => resolveAssetUrl(url)),
                                Number(indexValue),
                                '리뷰 사진'
                              )
                            }
                          />
                        ))}
                        </View>
                        <TouchableOpacity
                          style={styles.reviewViewAllButton}
                          activeOpacity={0.88}
                          onPress={() =>
                            router.push({
                              pathname: '/views/store_reviews',
                              params: { storeId: String(store.storeId), storeName: store.name, mode: 'all' },
                            })
                          }
                        >
                          <Text style={styles.reviewViewAllButtonText}>리뷰 전체보기</Text>
                          <Ionicons name="chevron-forward" size={16} color="#18a5a5" />
                        </TouchableOpacity>
                      </>
                    )}
                  </Section>
                </>
              ) : null}

              {activeTab === 'photo' ? (
                <Section
                  title="사진"
                  subtitle="리뷰 사진을 한 번에 볼 수 있어요."
                  action={<Text style={styles.sectionMore}>{reviewPhotos.length}장</Text>}
                >
                  {reviewPhotos.length === 0 ? (
                    <Text style={styles.emptyInline}>등록된 리뷰 사진이 없어요.</Text>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewPhotoCarousel}>
                      {reviewPhotos.map((url, index) => (
                        <TouchableOpacity
                          key={`${url}-${index}`}
                          style={styles.reviewPhotoCardLarge}
                          activeOpacity={0.9}
                          onPress={() =>
                            openPreviewGallery(
                              reviewPhotos.map((photoUrl) => resolveAssetUrl(photoUrl)),
                              index,
                              '리뷰 사진'
                            )
                          }
                        >
                          <Image source={{ uri: resolveAssetUrl(url) }} style={styles.reviewPhotoImageLarge} />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </Section>
              ) : null}

              <FullscreenImageViewer
                visible={Boolean(previewImageUrl)}
                uri={previewImageUrl}
                uris={previewImageUrls}
                initialIndex={previewImageIndex}
                onClose={closePreview}
                title={previewImageTitle}
              />

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
                  <Animated.View
                    style={[
                      styles.mapPickerModalSheet,
                      {
                        height: mapPickerHeight,
                        paddingBottom: Math.max(insets.bottom, 14) + 8,
                      },
                    ]}
                  >
                    <View style={styles.mapPickerModalDragZone} {...mapPickerPanResponder.panHandlers}>
                      <View style={styles.mapPickerModalHandle} />
                      <Text style={styles.mapPickerModalTitle}>어느 지도에 추가할까요?</Text>
                      <Text style={styles.mapPickerModalSubtitle}>
                        {title}을 담을 지도를 골라주세요.
                      </Text>
                    </View>

                    <ScrollView
                      style={styles.mapPickerModalScroll}
                      contentContainerStyle={styles.mapPickerModalScrollContent}
                      showsVerticalScrollIndicator={false}
                      bounces={false}
                      keyboardShouldPersistTaps="handled"
                    >
                      {isLoadingMaps ? (
                        <View style={styles.mapPickerEmpty}>
                          <Text style={styles.mapPickerEmptyText}>지도 목록을 불러오는 중이에요</Text>
                        </View>
                      ) : mapCollections.length > 0 ? (
                        <View style={styles.mapPickerList}>
                          {mapCollections.map((map) => {
                            const isSelected = activeStoreMapIds.includes(map.mapId);

                            return (
                              <TouchableOpacity
                                key={map.mapId}
                                style={[styles.mapPickerOption, isSelected ? styles.mapPickerOptionActive : null]}
                                activeOpacity={0.9}
                                onPress={() => void addStoreToSelectedMap(map.mapId)}
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
                            onPress={() => void createMapAndAddStore()}
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
                  </Animated.View>
                </View>
              </Modal>

              <View style={[styles.bottomActionRow, { marginBottom: Math.max(insets.bottom, 14) + 10 }]}>
                <TouchableOpacity
                  style={styles.actionButtonSecondary}
                  onPress={() => void openMyMapPicker()}
                  activeOpacity={0.9}
                >
                  <Ionicons name="map-outline" size={19} color="#18a5a5" />
                  <Text style={styles.actionButtonSecondaryText}>마이지도 추가</Text>
                </TouchableOpacity>
              </View>

              {!isLoggedIn ? <Text style={styles.footerHint}>리뷰 작성은 로그인 후 사용할 수 있어요.</Text> : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scrollContent: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 12 : 18, paddingBottom: 12 },
  detailHeader: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    position: 'relative',
  },
  headerBackButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 2,
  },
  detailHeaderTitle: {
    position: 'absolute',
    left: 88,
    right: 88,
    color: '#191f28',
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
  },
  heroFavoritePill: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e8eb',
  },
  heroFavoritePillActive: {
    backgroundColor: '#fff1f5',
    borderColor: '#ffd6e1',
  },
  heroFavoriteText: { color: '#8b95a1', fontSize: 13, fontWeight: '900' },
  heroFavoriteTextActive: { color: '#ff4d74' },
  headerRightSpacer: { width: 88, height: 42 },
  loadingCard: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  loadingText: { color: '#6b7684', fontSize: 13, fontWeight: '700' },
  emptyCard: {
    paddingVertical: 56,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e8eb',
  },
  emptyTitle: { color: '#191f28', fontSize: 18, fontWeight: '900' },
  emptySubtitle: { color: '#6b7684', fontSize: 13, textAlign: 'center', lineHeight: 18, paddingHorizontal: 24 },
  heroCard: {
    backgroundColor: '#ffffff',
    marginBottom: 14,
    gap: 18,
  },
  heroPhotoFrame: {
    width: '100%',
    aspectRatio: 1.28,
    backgroundColor: '#f2f4f6',
    borderRadius: 18,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroPhotoScroller: { width: '100%', height: '100%' },
  heroPhotoCard: {
    height: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#edf8f8',
  },
  heroPhotoImage: { width: '100%', height: '100%' },
  heroPhotoEmpty: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f3f8f8',
  },
  heroPhotoEmptyText: { color: '#6b7684', fontSize: 13, fontWeight: '700' },
  photoCountBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(25, 31, 40, 0.72)',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  photoCountText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
  heroBody: { gap: 12 },
  heroTitleRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleCopy: { flex: 1, justifyContent: 'center' },
  storeName: { color: '#191f28', fontSize: 24, fontWeight: '900', lineHeight: 31 },
  subtitleRow: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  subtitleMuted: { flexShrink: 1, color: '#18a5a5', fontSize: 13, fontWeight: '900' },
  serviceChip: {
    backgroundColor: '#edf8f8',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#d8f6f4',
  },
  serviceChipText: { color: '#18a5a5', fontSize: 10, fontWeight: '800' },
  heroRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  heroRatingItem: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    paddingHorizontal: 14,
  },
  heroRatingText: { color: '#4e5968', fontSize: 13, fontWeight: '900' },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  addressCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  addressText: { flex: 1, color: '#4e5968', fontSize: 13, lineHeight: 18, fontWeight: '800' },
  ownerMessageCard: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#f7feff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d8f2f2',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  ownerMessageHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ownerMessageTitle: { color: '#18a5a5', fontSize: 14, fontWeight: '900' },
  ownerMessageText: { color: '#191f28', fontSize: 13, lineHeight: 22, fontWeight: '700', paddingRight: 20 },
  ownerQuoteMark: {
    position: 'absolute',
    right: 18,
    top: 8,
    color: '#d8f2f2',
    fontSize: 72,
    lineHeight: 72,
    fontWeight: '900',
  },
  operationCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#f7feff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d8f2f2',
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  operationColumn: { flex: 1.18, justifyContent: 'center', gap: 8 },
  operationColumnCompact: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  operationTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  operationTitleRowCompact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  operationDot: { width: 19, height: 19, borderRadius: 10, backgroundColor: '#35b94b' },
  operationDotMuted: { backgroundColor: '#8b95a1' },
  operationTitle: { color: '#18a5a5', fontSize: 16, fontWeight: '900' },
  operationSubtitle: { color: '#6b7684', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  operationLabel: { color: '#191f28', fontSize: 11, fontWeight: '800' },
  operationTime: { color: '#4e5968', fontSize: 14, fontWeight: '900' },
  operationDivider: {
    width: 1,
    backgroundColor: '#d8e8e8',
    marginHorizontal: 12,
    borderRadius: 16,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#edf6f6',
    borderRadius: 999,
    padding: 6,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#d8efef',
  },
  tabButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: { backgroundColor: '#18a5a5' },
  tabButtonText: { color: '#6b7684', fontSize: 13, fontWeight: '800' },
  tabButtonTextActive: { color: '#f9fafb' },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 20,
    marginBottom: 14,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 8 },
  sectionHeaderCopy: { flex: 1, gap: 3 },
  sectionTitle: { color: '#191f28', fontSize: 17, fontWeight: '900' },
  sectionSubtitle: { color: '#6b7684', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  sectionMore: { color: '#18a5a5', fontSize: 12, fontWeight: '800' },
  sectionToggle: {
    backgroundColor: '#eef1f5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#c7eff0',
  },
  sectionToggleText: { color: '#18a5a5', fontSize: 12, fontWeight: '900' },
  infoGrid: { flexDirection: 'row', alignItems: 'stretch' },
  infoItem: {
    minHeight: 92,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: '#e5e8eb',
  },
  infoItemLast: { borderRightWidth: 0 },
  infoLabel: { color: '#6b7684', fontSize: 11, fontWeight: '800', textAlign: 'center' },
  infoValue: { color: '#4e5968', fontSize: 13, fontWeight: '900', lineHeight: 18, textAlign: 'center' },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d8efef',
    padding: 12,
    marginBottom: 12,
  },
  warningText: { flex: 1, color: '#191f28', fontSize: 12, fontWeight: '700', lineHeight: 18 },
  emptyInline: { color: '#6b7684', fontSize: 13 },
  menuList: { gap: 10 },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 14,
    alignItems: 'center',
  },
  menuThumb: { width: 68, height: 68, borderRadius: 14, backgroundColor: '#edf8f8' },
  menuThumbPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef1f5',
    borderWidth: 1,
    borderColor: '#d8efef',
  },
  menuRowLeft: { flex: 1, gap: 4 },
  menuRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'nowrap' },
  menuName: { flex: 1, color: '#191f28', fontSize: 15, fontWeight: '900' },
  representativeBadge: {
    backgroundColor: '#edf8f8',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#c7eff0',
  },
  representativeBadgeText: { color: '#18a5a5', fontSize: 10, fontWeight: '900' },
  menuDesc: { color: '#6b7684', fontSize: 12, lineHeight: 17 },
  menuMeta: { color: '#8b95a1', fontSize: 11, fontWeight: '700' },
  menuPriceWrap: { justifyContent: 'center', alignItems: 'flex-end' },
  menuPrice: { color: '#18a5a5', fontSize: 13, fontWeight: '900' },
  moreButton: {
    marginTop: 2,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#c7eff0',
    backgroundColor: '#eef1f5',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  moreButtonText: { color: '#18a5a5', fontSize: 13, fontWeight: '900' },
  reviewSummaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  reviewSummaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f9fafb',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reviewSummaryText: { color: '#191f28', fontSize: 13, fontWeight: '900' },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sortChip: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: '#edf6f6',
    borderWidth: 1,
    borderColor: '#d8efef',
  },
  sortChipActive: { backgroundColor: '#18a5a5', borderColor: '#18a5a5' },
  sortChipText: { color: '#6b7684', fontSize: 11, fontWeight: '800' },
  sortChipTextActive: { color: '#f9fafb' },
  loadingInline: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  reviewList: { gap: 10 },
  reviewViewAllButton: {
    marginTop: 12,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#c7eff0',
    backgroundColor: '#eef9f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  reviewViewAllButtonText: { color: '#18a5a5', fontSize: 13, fontWeight: '900' },
  reviewCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 14,
    gap: 8,
  },
  reviewTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  reviewAuthorWrap: { flexShrink: 1, gap: 2 },
  reviewAuthorLabel: { color: '#6b7684', fontSize: 10, fontWeight: '800' },
  reviewAuthor: { color: '#191f28', fontSize: 14, fontWeight: '900' },
  reviewRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f9fafb',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reviewRatingText: { color: '#92400e', fontSize: 12, fontWeight: '900' },
  reviewDate: { color: '#8b95a1', fontSize: 11, fontWeight: '700' },
  reviewContent: { color: '#4e5968', fontSize: 13, lineHeight: 18 },
  reviewPhotoRow: { gap: 8 },
  reviewPhotoThumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#edf8f8' },
  reviewPhotoCarousel: { gap: 12, paddingTop: 2 },
  reviewPhotoCardLarge: {
    width: 240,
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#edf8f8',
    borderWidth: 1,
    borderColor: '#c7eff0',
  },
  reviewPhotoImageLarge: { width: '100%', height: '100%' },
  actionButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#edf8f8',
    backgroundColor: '#eef1f5',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionButtonDisabled: { opacity: 0.45 },
  actionButtonText: { color: '#18a5a5', fontSize: 14, fontWeight: '900' },
  loginCardLite: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 14,
    gap: 8,
  },
  loginCardLiteTitle: { color: '#191f28', fontSize: 14, fontWeight: '900' },
  loginCardLiteText: { color: '#6b7684', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  loginCardLiteButtons: { flexDirection: 'row', gap: 8, marginTop: 4 },
  loginSecondaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e8eb',
  },
  loginSecondaryButtonText: { color: '#18a5a5', fontSize: 13, fontWeight: '900' },
  loginPrimaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18a5a5',
  },
  loginPrimaryButtonText: { color: '#f9fafb', fontSize: 13, fontWeight: '900' },
  actionButtonSecondary: {
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bdeff0',
    backgroundColor: '#f7feff',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  actionButtonSecondaryText: { color: '#18a5a5', fontSize: 14, fontWeight: '900' },
  bottomActionRow: { marginTop: -8 },
  footerHint: { marginTop: 10, color: '#6b7684', fontSize: 12, textAlign: 'center' },
  mapPickerModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  mapPickerModalDimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.32)',
  },
  mapPickerModalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  mapPickerModalDragZone: {
    minHeight: 94,
    paddingTop: 2,
    paddingBottom: 12,
    justifyContent: 'flex-start',
  },
  mapPickerModalHandle: {
    alignSelf: 'center',
    width: 56,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#d8e8e8',
    marginBottom: 14,
  },
  mapPickerModalTitle: {
    color: '#191f28',
    fontSize: 20,
    fontWeight: '900',
  },
  mapPickerModalSubtitle: {
    marginTop: 6,
    color: '#6b7684',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  mapPickerModalScroll: {
    marginTop: 16,
  },
  mapPickerModalScrollContent: {
    paddingBottom: 8,
    gap: 12,
  },
  mapPickerList: {
    gap: 10,
  },
  mapPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  mapPickerOptionActive: {
    borderColor: '#bdeff0',
    backgroundColor: '#f7feff',
  },
  mapPickerOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 12,
  },
  mapPickerOptionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#edf8f8',
  },
  mapPickerOptionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  mapPickerOptionTitle: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '900',
  },
  mapPickerOptionSubtitle: {
    marginTop: 3,
    color: '#6b7684',
    fontSize: 12,
    fontWeight: '700',
  },
  mapPickerCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8e8e8',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  mapPickerCheckActive: {
    borderColor: '#bdeff0',
    backgroundColor: '#edf8f8',
  },
  mapPickerEmpty: {
    borderRadius: 18,
    backgroundColor: '#f9fafb',
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  mapPickerEmptyText: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  mapPickerCreateForm: {
    marginTop: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 10,
  },
  mapPickerCreateTitle: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '900',
  },
  mapPickerInput: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d8e8e8',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 14,
    color: '#191f28',
    fontSize: 14,
    fontWeight: '700',
  },
  mapPickerDescriptionInput: {
    minHeight: 92,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  mapPickerPrimaryButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#18a5a5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPickerPrimaryButtonDisabled: {
    opacity: 0.5,
  },
  mapPickerPrimaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  mapPickerNewButton: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bdeff0',
    backgroundColor: '#f7feff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  mapPickerNewButtonText: {
    color: '#18a5a5',
    fontSize: 14,
    fontWeight: '900',
  },
});
