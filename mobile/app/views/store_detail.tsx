import React, { useCallback, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { ApiClientError, favoritesApi, myMapApi, storeMenusApi, storeReviewsApi, storesApi, tokenStore, type StoreLookupItemResponse } from '@/services/api';
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

const formatStoreStatus = (store: StoreLookupItemResponse | null) => {
  const liveStatus = store?.liveBusinessStatus ?? store?.businessStatus;
  if (liveStatus === 'OPEN') return '영업중';
  if (liveStatus === 'BREAK_TIME') return '브레이크타임';
  if (liveStatus === 'CLOSED') return '영업종료';
  if (liveStatus === 'TEMP_CLOSED') return '임시휴무';
  if (liveStatus === 'EARLY_CLOSED') return '조기마감';
  return store?.operationalState ?? '상태 없음';
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

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoItem}>
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

function MenuRow({ item }: { item: StoreMenuItem }) {
  return (
    <View style={styles.menuRow}>
      {item.imageUrl ? (
        <Image source={{ uri: resolveAssetUrl(item.imageUrl) }} style={styles.menuThumb} />
      ) : (
        <View style={styles.menuThumbPlaceholder}>
          <Ionicons name="restaurant-outline" size={18} color="#0ea5a4" />
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

function ReviewCard({ item }: { item: StoreReviewItem }) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewTopRow}>
        <View style={styles.reviewAuthorWrap}>
          <Text style={styles.reviewAuthorLabel}>작성자</Text>
          <Text style={styles.reviewAuthor}>{item.authorNickname}</Text>
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
            <Image key={`${url}-${index}`} source={{ uri: resolveAssetUrl(url) }} style={styles.reviewPhotoThumb} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

export default function StoreDetailScreen() {
  const router = useRouter();
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
  const reviewPhotos = reviews.flatMap((review) => review.imageUrls);
  const primaryAddress = store?.roadAddress ?? store?.address ?? store?.jibunAddress ?? '주소 정보 없음';
  const displayPhone = store?.phone ?? storePhoneParam ?? '전화번호 정보 없음';
  const statusLabel = formatStoreStatus(store);
  const ratingLabel = formatRating(store?.reviewAverageRating ?? store?.rating);
  const reviewCount = store?.reviewCount ?? 0;
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

  const handleFavoritePress = useCallback(async () => {
    if (!store || !isServiceStore) return;

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
            throw error;
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
          throw error;
        }
      }

      setIsFavorited(true);
      setFavoriteCount((current) => current + 1);
    } catch {
      Alert.alert('찜 실패', '장소를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsFavoriteSaving(false);
    }
  }, [isFavorited, isFavoriteSaving, isLoggedIn, isServiceStore, router, store]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.85}>
              <Ionicons name="chevron-back" size={24} color="#0ea5a4" />
            </TouchableOpacity>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>매장 상세</Text>
              <Text style={styles.headerSubtitle}>홈, 메뉴, 리뷰, 사진을 나눠서 볼 수 있어요.</Text>
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#0ea5a4" />
              <Text style={styles.loadingText}>매장 정보를 불러오는 중...</Text>
            </View>
          ) : !store ? (
            <View style={styles.emptyCard}>
              <Ionicons name="storefront-outline" size={28} color="#94a3b8" />
              <Text style={styles.emptyTitle}>매장 정보를 찾지 못했어요</Text>
              <Text style={styles.emptySubtitle}>백엔드에 등록된 매장만 상세를 볼 수 있어요.</Text>
            </View>
          ) : (
            <>
              <View style={styles.heroCard}>
                <View style={styles.heroPhotoFrame}>
                  {heroPhotos.length === 0 ? (
                    <View style={styles.heroPhotoEmpty}>
                      <Ionicons name="image-outline" size={32} color="#8ea2aa" />
                      <Text style={styles.heroPhotoEmptyText}>등록된 사진이 없어요</Text>
                    </View>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.heroPhotoRow}>
                      {heroPhotos.map((url, index) => (
                        <View key={`${url}-${index}`} style={styles.heroPhotoCard}>
                          <Image source={{ uri: resolveAssetUrl(url) }} style={styles.heroPhotoImage} />
                        </View>
                      ))}
                    </ScrollView>
                  )}
                  <View style={styles.photoCountBadge}>
                    <Ionicons name="images-outline" size={13} color="#0ea5a4" />
                    <Text style={styles.photoCountText}>{heroPhotos.length}장</Text>
                  </View>
                </View>

                <View style={styles.heroBody}>
                  <View style={styles.heroTitleRow}>
                    <View style={styles.titleCopy}>
                      <Text style={styles.storeName}>{title}</Text>
                      <View style={styles.subtitleRow}>
                        <Text style={styles.subtitleMuted}>{store.categoryName ?? '카테고리 없음'}</Text>
                        <View style={styles.serviceChip}>
                          <Text style={styles.serviceChipText}>{isServiceStore ? '우리 서비스 매장' : '미등록 장소'}</Text>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.favoriteChip, isFavorited && styles.favoriteChipActive]}
                      onPress={() => void handleFavoritePress()}
                      activeOpacity={0.84}
                      disabled={!isServiceStore || isFavoriteSaving}
                    >
                      <Ionicons
                        name={isFavorited ? 'heart' : 'heart-outline'}
                        size={14}
                        color={isFavorited ? '#ff4d74' : '#0ea5a4'}
                      />
                      <Text style={[styles.favoriteChipText, isFavorited && styles.favoriteChipTextActive]}>
                        찜 {favoriteCountLabel}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.metaRow}>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>{statusLabel}</Text>
                    </View>
                    <View style={styles.metaPill}>
                      <Ionicons name="star" size={12} color="#f59e0b" />
                      <Text style={styles.metaPillText}>{ratingLabel}</Text>
                    </View>
                    <View style={styles.metaPill}>
                      <Ionicons name="chatbubble-outline" size={12} color="#0ea5a4" />
                      <Text style={styles.metaPillText}>{reviewCount}개 리뷰</Text>
                    </View>
                  </View>

                  <Text style={styles.address}>{primaryAddress}</Text>
                  <Text style={styles.phone}>{displayPhone}</Text>

                  {store.ownerNotice ? (
                    <View style={styles.noticeBox}>
                      <Ionicons name="information-circle-outline" size={16} color="#0ea5a4" />
                      <Text style={styles.noticeText}>{store.ownerNotice}</Text>
                    </View>
                  ) : null}
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
                  <Section title="매장 정보" subtitle="서비스에 등록된 매장 정보와 검증 상태를 확인해요.">
                    <View style={styles.infoGrid}>
                      <InfoItem label="영업 상태" value={statusLabel} />
                      <InfoItem label="실시간 출처" value={store.liveStatusSource ?? '정보 없음'} />
                      <InfoItem label="검증일" value={formatDateTime(store.verifiedAt)} />
                      <InfoItem label="주소" value={primaryAddress} />
                      <InfoItem label="전화번호" value={displayPhone} />
                      <InfoItem label="메뉴 상태" value={store.menuEligible ? '가능' : store.menuEligibilityReason ?? '불가'} />
                    </View>
                  </Section>

                  <Section title="운영 정보" subtitle="영업 시간과 휴게 시간을 확인할 수 있어요.">
                    {operationalMissing ? (
                      <View style={styles.warningCard}>
                        <Ionicons name="time-outline" size={16} color="#0ea5a4" />
                        <Text style={styles.warningText}>운영 시간이 아직 등록되지 않았어요. 점주 페이지에서 입력하면 보여져요.</Text>
                      </View>
                    ) : null}
                    <View style={styles.infoGrid}>
                      <InfoItem label="오픈" value={store.openTime ?? '정보 없음'} />
                      <InfoItem label="마감" value={store.closeTime ?? '정보 없음'} />
                      <InfoItem label="휴게 시작" value={store.breakStart ?? '정보 없음'} />
                      <InfoItem label="휴게 종료" value={store.breakEnd ?? '정보 없음'} />
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
                        <MenuRow key={String(item.menuId ?? `${item.name}-${item.displayOrder}`)} item={item} />
                      ))}
                      {hasMoreMenus && !isMenuExpanded ? (
                        <TouchableOpacity style={styles.moreButton} onPress={() => setIsMenuExpanded(true)} activeOpacity={0.85}>
                          <Text style={styles.moreButtonText}>더보기</Text>
                          <Ionicons name="chevron-down" size={16} color="#0ea5a4" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  )}
                </Section>
              ) : null}

              {activeTab === 'review' ? (
                <>
                  <Section title="리뷰 작성" subtitle="로그인 후 리뷰를 작성할 수 있어요.">
                    <View style={styles.reviewSummaryRow}>
                      <View style={styles.reviewSummaryPill}>
                        <Ionicons name="star" size={16} color="#f59e0b" />
                        <Text style={styles.reviewSummaryText}>{ratingLabel}</Text>
                      </View>
                      <View style={styles.reviewSummaryPill}>
                        <Ionicons name="chatbubble-outline" size={16} color="#0ea5a4" />
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
                            params: { storeId: String(store.storeId), storeName: store.name },
                          })
                        }
                        activeOpacity={0.9}
                      >
                        <Text style={styles.actionButtonText}>리뷰 작성</Text>
                        <Ionicons name="chevron-forward" size={16} color={isServiceStore ? '#0ea5a4' : '#94a3b8'} />
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.loginCardLite}>
                        <Text style={styles.loginCardLiteTitle}>로그인 후 작성 가능</Text>
                        <Text style={styles.loginCardLiteText}>리뷰 작성은 로그인 후 사용할 수 있어요.</Text>
                        <View style={styles.loginCardLiteButtons}>
                          <TouchableOpacity style={styles.loginSecondaryButton} onPress={() => router.push('/views/user_login')} activeOpacity={0.9}>
                            <Text style={styles.loginSecondaryButtonText}>로그인</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.loginPrimaryButton} onPress={() => router.push('/views/user_signup')} activeOpacity={0.9}>
                            <Text style={styles.loginPrimaryButtonText}>회원가입</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                    {!isServiceStore ? <Text style={styles.footerHint}>리뷰는 우리 서비스 매장에서만 볼 수 있어요.</Text> : null}
                  </Section>

                  <Section
                    title="리뷰 목록"
                    subtitle="최신 리뷰를 바로 확인할 수 있어요."
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
                        <ActivityIndicator color="#0ea5a4" />
                        <Text style={styles.loadingText}>리뷰를 불러오는 중...</Text>
                      </View>
                    ) : null}
                    {latestReviews.length === 0 ? (
                      <Text style={styles.emptyInline}>아직 리뷰가 없어요.</Text>
                    ) : (
                      <View style={styles.reviewList}>
                        {latestReviews.map((item) => (
                          <ReviewCard key={String(item.reviewId)} item={item} />
                        ))}
                      </View>
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
                        <View key={`${url}-${index}`} style={styles.reviewPhotoCardLarge}>
                          <Image source={{ uri: resolveAssetUrl(url) }} style={styles.reviewPhotoImageLarge} />
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </Section>
              ) : null}

              <View style={styles.bottomActionRow}>
                <TouchableOpacity
                  style={styles.actionButtonSecondary}
                  onPress={() => router.push('/list')}
                  activeOpacity={0.9}
                >
                  <Text style={styles.actionButtonSecondaryText}>리스트로</Text>
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
  container: { flex: 1, backgroundColor: '#f7fbfc' },
  scrollContent: { paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 14 : 20, paddingBottom: 28 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e6fbfa', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  headerTitle: { color: '#0f172a', fontSize: 22, fontWeight: '900' },
  headerSubtitle: { marginTop: 3, color: '#64748b', fontSize: 12, fontWeight: '600' },
  loadingCard: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  loadingText: { color: '#64748b', fontSize: 13, fontWeight: '700' },
  emptyCard: {
    paddingVertical: 56,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dbeff0',
  },
  emptyTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900' },
  emptySubtitle: { color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 18, paddingHorizontal: 24 },
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#dbeff0',
    padding: 16,
    marginBottom: 14,
    gap: 14,
  },
  heroPhotoFrame: {
    backgroundColor: '#f2fbfb',
    borderRadius: 22,
    padding: 12,
    minHeight: 180,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroPhotoRow: { gap: 12, paddingRight: 4 },
  heroPhotoCard: {
    width: 220,
    height: 140,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#e6fbfa',
    borderWidth: 1,
    borderColor: '#c7eff0',
  },
  heroPhotoImage: { width: '100%', height: '100%' },
  heroPhotoEmpty: {
    minHeight: 140,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f3f8f8',
  },
  heroPhotoEmptyText: { color: '#64748b', fontSize: 13, fontWeight: '700' },
  photoCountBadge: {
    position: 'absolute',
    right: 12,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#c7eff0',
  },
  photoCountText: { color: '#0ea5a4', fontSize: 11, fontWeight: '800' },
  heroBody: { gap: 12 },
  heroTitleRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between' },
  titleCopy: { flex: 1, gap: 8 },
  storeName: { color: '#0f172a', fontSize: 24, fontWeight: '900', lineHeight: 30 },
  subtitleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  subtitleMuted: { color: '#0ea5a4', fontSize: 13, fontWeight: '800' },
  serviceChip: {
    backgroundColor: '#ecfcfb',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#d8f6f4',
  },
  serviceChipText: { color: '#0ea5a4', fontSize: 11, fontWeight: '800' },
  favoriteChip: {
    minWidth: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff1f5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ffd4e1',
  },
  favoriteChipActive: {
    backgroundColor: '#fff0f5',
    borderColor: '#ffbfd2',
  },
  favoriteChipText: { color: '#e11d48', fontSize: 12, fontWeight: '900' },
  favoriteChipTextActive: { color: '#ff4d74' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  statusPill: {
    backgroundColor: '#e6fbfa',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#c7eff0',
  },
  statusPillText: { color: '#0ea5a4', fontSize: 12, fontWeight: '900' },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f8fcfc',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#e6eef1',
  },
  metaPillText: { color: '#334155', fontSize: 12, fontWeight: '800' },
  address: { color: '#334155', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  phone: { color: '#64748b', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f7fbfc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e6eef1',
    padding: 12,
  },
  noticeText: { flex: 1, color: '#475569', fontSize: 13, lineHeight: 18, fontWeight: '600' },
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
  tabButtonActive: { backgroundColor: '#0ea5a4' },
  tabButtonText: { color: '#64748b', fontSize: 13, fontWeight: '800' },
  tabButtonTextActive: { color: '#fff' },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dbeff0',
    padding: 16,
    marginBottom: 12,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 8 },
  sectionHeaderCopy: { flex: 1, gap: 3 },
  sectionTitle: { color: '#0f172a', fontSize: 16, fontWeight: '900' },
  sectionSubtitle: { color: '#64748b', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  sectionMore: { color: '#0ea5a4', fontSize: 12, fontWeight: '800' },
  sectionToggle: {
    backgroundColor: '#eefafa',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#c7eff0',
  },
  sectionToggleText: { color: '#0ea5a4', fontSize: 12, fontWeight: '900' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  infoItem: {
    width: '48%',
    backgroundColor: '#f8fcfc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e6eef1',
    padding: 12,
    gap: 4,
  },
  infoLabel: { color: '#64748b', fontSize: 11, fontWeight: '700' },
  infoValue: { color: '#0f172a', fontSize: 13, fontWeight: '800', lineHeight: 18 },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f4fbfb',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d8efef',
    padding: 12,
    marginBottom: 12,
  },
  warningText: { flex: 1, color: '#0f172a', fontSize: 12, fontWeight: '700', lineHeight: 18 },
  emptyInline: { color: '#64748b', fontSize: 13 },
  menuList: { gap: 10 },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#f8fcfc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e6eef1',
    padding: 14,
    alignItems: 'center',
  },
  menuThumb: { width: 68, height: 68, borderRadius: 14, backgroundColor: '#e6fbfa' },
  menuThumbPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eefafa',
    borderWidth: 1,
    borderColor: '#d8efef',
  },
  menuRowLeft: { flex: 1, gap: 4 },
  menuRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'nowrap' },
  menuName: { flex: 1, color: '#0f172a', fontSize: 15, fontWeight: '900' },
  representativeBadge: {
    backgroundColor: '#ecfcfb',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#c7eff0',
  },
  representativeBadgeText: { color: '#0ea5a4', fontSize: 10, fontWeight: '900' },
  menuDesc: { color: '#64748b', fontSize: 12, lineHeight: 17 },
  menuMeta: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  menuPriceWrap: { justifyContent: 'center', alignItems: 'flex-end' },
  menuPrice: { color: '#0ea5a4', fontSize: 13, fontWeight: '900' },
  moreButton: {
    marginTop: 2,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#c7eff0',
    backgroundColor: '#eefafa',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  moreButtonText: { color: '#0ea5a4', fontSize: 13, fontWeight: '900' },
  reviewSummaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  reviewSummaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fcfc',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e6eef1',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reviewSummaryText: { color: '#0f172a', fontSize: 13, fontWeight: '900' },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sortChip: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: '#edf6f6',
    borderWidth: 1,
    borderColor: '#d8efef',
  },
  sortChipActive: { backgroundColor: '#0ea5a4', borderColor: '#0ea5a4' },
  sortChipText: { color: '#64748b', fontSize: 11, fontWeight: '800' },
  sortChipTextActive: { color: '#fff' },
  loadingInline: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  reviewList: { gap: 10 },
  reviewCard: {
    backgroundColor: '#f8fcfc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e6eef1',
    padding: 14,
    gap: 8,
  },
  reviewTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  reviewAuthorWrap: { flexShrink: 1, gap: 2 },
  reviewAuthorLabel: { color: '#64748b', fontSize: 10, fontWeight: '800' },
  reviewAuthor: { color: '#0f172a', fontSize: 14, fontWeight: '900' },
  reviewRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff7e1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reviewRatingText: { color: '#92400e', fontSize: 12, fontWeight: '900' },
  reviewDate: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  reviewContent: { color: '#334155', fontSize: 13, lineHeight: 18 },
  reviewPhotoRow: { gap: 8 },
  reviewPhotoThumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#e6fbfa' },
  reviewPhotoCarousel: { gap: 12, paddingTop: 2 },
  reviewPhotoCardLarge: {
    width: 240,
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#e6fbfa',
    borderWidth: 1,
    borderColor: '#c7eff0',
  },
  reviewPhotoImageLarge: { width: '100%', height: '100%' },
  actionButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bfeceb',
    backgroundColor: '#eefafa',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionButtonDisabled: { opacity: 0.45 },
  actionButtonText: { color: '#0ea5a4', fontSize: 14, fontWeight: '900' },
  loginCardLite: {
    backgroundColor: '#f8fcfc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e6eef1',
    padding: 14,
    gap: 8,
  },
  loginCardLiteTitle: { color: '#0f172a', fontSize: 14, fontWeight: '900' },
  loginCardLiteText: { color: '#64748b', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  loginCardLiteButtons: { flexDirection: 'row', gap: 8, marginTop: 4 },
  loginSecondaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbeff0',
  },
  loginSecondaryButtonText: { color: '#0ea5a4', fontSize: 13, fontWeight: '900' },
  loginPrimaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0ea5a4',
  },
  loginPrimaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  actionButtonSecondary: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2eef0',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonSecondaryText: { color: '#0f172a', fontSize: 14, fontWeight: '800' },
  bottomActionRow: { marginTop: 4 },
  footerHint: { marginTop: 10, color: '#64748b', fontSize: 12, textAlign: 'center' },
});
