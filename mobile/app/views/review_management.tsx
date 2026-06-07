import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBottomNav } from '@/components/app-bottom-nav';
import { PageHero } from '@/components/page-hero';
import { getTabScreenContentStyle } from '@/components/screen-layout';
import { storeReviewsApi, tokenStore } from '@/services/api';
import type { StoreReviewItem, StoreReviewMinePageResponse } from '@/services/api/storeReviews';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

const resolveAssetUrl = (value?: string | null) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_BASE_URL}${value.startsWith('/') ? value : `/${value}`}`;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatRating = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0.0';
  return value.toFixed(1);
};

function LoginGatePanel({
  onLogin,
  onSignup,
}: {
  onLogin: () => void;
  onSignup: () => void;
}) {
  return (
    <View style={styles.gateCard}>
      <View style={styles.gateIconWrap}>
        <Ionicons name="lock-closed-outline" size={24} color="#18a5a5" />
      </View>
      <Text style={styles.gateTitle}>로그인이 필요해요</Text>
      <Text style={styles.gateSubtitle}>내가 작성한 리뷰를 확인하고 수정하려면 먼저 로그인해주세요.</Text>
      <View style={styles.gateButtons}>
        <TouchableOpacity style={styles.gateSecondaryButton} onPress={onLogin} activeOpacity={0.9}>
          <Text style={styles.gateSecondaryButtonText}>로그인</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.gatePrimaryButton} onPress={onSignup} activeOpacity={0.9}>
          <Text style={styles.gatePrimaryButtonText}>회원가입</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Ionicons key={value} name={value <= rating ? 'star' : 'star-outline'} size={14} color="#f59e0b" />
      ))}
    </View>
  );
}

type ReviewDraft = {
  rating: number;
  content: string;
  imageUrls: string[];
};

const EMPTY_DRAFT: ReviewDraft = {
  rating: 5,
  content: '',
  imageUrls: [],
};

type ReviewedStore = {
  storeId: number;
  storeName: string;
  reviews: StoreReviewItem[];
};

function StoreChip({
  store,
  selected,
  reviewCount,
  onPress,
}: {
  store: ReviewedStore;
  selected: boolean;
  reviewCount: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.storeChip, selected ? styles.storeChipActive : null]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.storeChipTop}>
        <View style={styles.storeThumb}>
          <Ionicons name="storefront-outline" size={18} color="#18a5a5" />
        </View>
        <View style={styles.storeChipTextWrap}>
          <Text style={styles.storeName} numberOfLines={1}>
            {store.storeName}
          </Text>
          <Text style={styles.storeMeta} numberOfLines={1}>
            리뷰 {reviewCount}개
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ReviewCard({
  item,
  storeName,
  onEdit,
  onDelete,
  onPressImage,
}: {
  item: StoreReviewItem;
  storeName: string;
  onEdit: () => void;
  onDelete: () => void;
  onPressImage: (url: string) => void;
}) {
  const authorName = item.displayName ?? item.authorNickname ?? '나';

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View>
          <Text style={styles.authorLabel}>작성자</Text>
          <Text style={styles.authorName}>{authorName}</Text>
        </View>
        <StarRating rating={item.rating} />
      </View>

      <Text style={styles.storeLabel} numberOfLines={1}>
        {storeName}
      </Text>

      <Text style={styles.reviewContent}>{item.content}</Text>

      {item.imageUrls.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageRow}>
          {item.imageUrls.map((url, index) => {
            const imageUri = resolveAssetUrl(url);
            return imageUri ? (
              <TouchableOpacity key={`${url}-${index}`} style={styles.reviewImageWrap} onPress={() => onPressImage(imageUri)} activeOpacity={0.9}>
                <Image source={{ uri: imageUri }} style={styles.reviewImage} />
              </TouchableOpacity>
            ) : null;
          })}
        </ScrollView>
      ) : null}

      <Text style={styles.reviewDate}>{formatDate(item.createdAt)}</Text>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={onEdit} activeOpacity={0.9}>
          <Ionicons name="pencil-outline" size={16} color="#18a5a5" />
          <Text style={styles.secondaryButtonText}>수정</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dangerButton} onPress={onDelete} activeOpacity={0.9}>
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
          <Text style={styles.dangerButtonText}>삭제</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ReviewManagementScreen() {
  const router = useRouter();
  const segments = useSegments();
  const showInternalTabBar = segments[0] !== '(tabs)';
  const returnTo = '/views/review_management';
  const insets = useSafeAreaInsets();

  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [reviewResponse, setReviewResponse] = useState<StoreReviewMinePageResponse | null>(null);
  const [reviewedStores, setReviewedStores] = useState<ReviewedStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [storeLoading, setStoreLoading] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [editingReview, setEditingReview] = useState<StoreReviewItem | null>(null);
  const [draft, setDraft] = useState<ReviewDraft>(EMPTY_DRAFT);
  const [savingReview, setSavingReview] = useState(false);

  const selectedStore = useMemo(
    () => reviewedStores.find((item) => item.storeId === selectedStoreId) ?? null,
    [reviewedStores, selectedStoreId]
  );
  const allReviews = reviewResponse?.content ?? [];
  const visibleReviews = selectedStore?.reviews ?? allReviews;
  const storeNameById = useMemo(
    () => new Map(reviewedStores.map((item) => [item.storeId, item.storeName])),
    [reviewedStores]
  );

  const summaryCount = allReviews.length;
  const averageRating = allReviews.length
    ? allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length
    : null;

  const closePreview = useCallback(() => setPreviewImageUrl(null), []);

  const loadReviewedStores = useCallback(async () => {
    setIsLoading(true);

    const token = await tokenStore.getAccessToken();
    if (!token) {
      setIsLoggedIn(false);
      setReviewResponse(null);
      setReviewedStores([]);
      setSelectedStoreId(null);
      setIsLoading(false);
      return;
    }

    setIsLoggedIn(true);

    try {
      const response = await storeReviewsApi.mine(0, 200);
      setReviewResponse(response);

      const storeIds = Array.from(new Set(response.content.map((review) => review.storeId)));
      if (storeIds.length === 0) {
        setReviewedStores([]);
        setSelectedStoreId(null);
        return;
      }

      const grouped = Array.from(
        response.content.reduce((map, review) => {
          const current = map.get(review.storeId) ?? {
            storeId: review.storeId,
            storeName: review.storeName ?? `장소 #${review.storeId}`,
            reviews: [],
          };

          current.reviews.push(review);
          map.set(review.storeId, current);
          return map;
        }, new Map<number, ReviewedStore>()).values()
      );

      setReviewedStores(grouped);
      setSelectedStoreId((current) => current ?? grouped[0]?.storeId ?? null);
    } catch (error) {
      setReviewResponse(null);
      setReviewedStores([]);
      setSelectedStoreId(null);
      Alert.alert('리뷰 불러오기 실패', error instanceof Error ? error.message : '내 리뷰를 불러오지 못했어요.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshSelectedStore = useCallback(async () => {
    if (!selectedStoreId) return;

    setStoreLoading(true);
    try {
      const response = await storeReviewsApi.mine(0, 200);
      setReviewResponse(response);

      const grouped = Array.from(
        response.content.reduce((map, review) => {
          const current = map.get(review.storeId) ?? {
            storeId: review.storeId,
            storeName: review.storeName ?? `장소 #${review.storeId}`,
            reviews: [],
          };

          current.reviews.push(review);
          map.set(review.storeId, current);
          return map;
        }, new Map<number, ReviewedStore>()).values()
      );

      if (grouped.length === 0) {
        setReviewedStores([]);
        return;
      }

      setReviewedStores(grouped);
    } catch (error) {
      Alert.alert('새로고침 실패', error instanceof Error ? error.message : '리뷰를 다시 불러오지 못했어요.');
    } finally {
      setStoreLoading(false);
    }
  }, [selectedStoreId]);

  useFocusEffect(
    useCallback(() => {
      void loadReviewedStores();
    }, [loadReviewedStores])
  );

  const beginEdit = useCallback((review: StoreReviewItem) => {
    setEditingReview(review);
    setDraft({
      rating: review.rating,
      content: review.content,
      imageUrls: review.imageUrls,
    });
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingReview) return;
    if (!draft.content.trim()) {
      Alert.alert('리뷰 확인', '리뷰 내용을 입력해주세요.');
      return;
    }

    setSavingReview(true);
    try {
      await storeReviewsApi.update(editingReview.reviewId, {
        rating: draft.rating,
        content: draft.content.trim(),
        imageUrls: draft.imageUrls,
      });
      setEditingReview(null);
      setDraft(EMPTY_DRAFT);
      await loadReviewedStores();
      Alert.alert('저장 완료', '리뷰를 수정했어요.');
    } catch (error) {
      Alert.alert('수정 실패', error instanceof Error ? error.message : '리뷰를 수정하지 못했어요.');
    } finally {
      setSavingReview(false);
    }
  }, [draft, editingReview, loadReviewedStores]);

  const deleteReview = useCallback(
    (review: StoreReviewItem) => {
      Alert.alert('리뷰 삭제', '정말 이 리뷰를 삭제할까요?', [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await storeReviewsApi.remove(review.reviewId);
              await loadReviewedStores();
              Alert.alert('삭제 완료', '리뷰를 삭제했어요.');
            } catch (error) {
              Alert.alert('삭제 실패', error instanceof Error ? error.message : '리뷰를 삭제하지 못했어요.');
            }
          },
        },
      ]);
    },
    [loadReviewedStores]
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, getTabScreenContentStyle(insets)]}
          >
            {isLoading ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator color="#18a5a5" />
                <Text style={styles.loadingText}>리뷰 관리 화면을 불러오는 중이에요</Text>
              </View>
            ) : !isLoggedIn ? (
              <LoginGatePanel
                onLogin={() => router.replace({ pathname: '/views/user_login', params: { returnTo } })}
                onSignup={() => router.replace({ pathname: '/views/user_signup', params: { returnTo } })}
              />
            ) : (
              <>
                <PageHero
                  title="리뷰 관리"
                  subtitle="저장 여부와 상관없이 내가 리뷰를 남긴 장소를 확인해요"
                  rightIcon="refresh-outline"
                  rightIconColor="#18a5a5"
                  rightIconBackground="#edf8f8"
                  onRightPress={() => void refreshSelectedStore()}
                />

                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{summaryCount}</Text>
                  <Text style={styles.summaryLabel}>내가 남긴 리뷰 수</Text>
                  <Text style={styles.summarySub}>평균 평점 {formatRating(averageRating)}</Text>
                </View>

                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>내가 리뷰한 장소</Text>
                  {reviewedStores.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Ionicons name="chatbubble-ellipses-outline" size={24} color="#18a5a5" />
                      <Text style={styles.emptyTitle}>아직 리뷰를 남긴 장소가 없어요</Text>
                      <Text style={styles.emptyText}>장소 상세나 리뷰 화면에서 리뷰를 작성하면 여기서 모아볼 수 있어요.</Text>
                    </View>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storeRow}>
                      {reviewedStores.map((item) => (
                        <StoreChip
                          key={item.storeId}
                          store={item}
                          reviewCount={item.reviews.length}
                          selected={selectedStoreId === item.storeId}
                          onPress={() => setSelectedStoreId(item.storeId)}
                        />
                      ))}
                    </ScrollView>
                  )}
                </View>

                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{selectedStore ? '선택한 장소의 내 리뷰' : '내 리뷰 목록'}</Text>
                  {selectedStore ? (
                    <TouchableOpacity onPress={() => void refreshSelectedStore()} activeOpacity={0.85}>
                      <Text style={styles.sectionMore}>새로고침</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                  {storeLoading ? (
                    <View style={styles.loadingCard}>
                      <ActivityIndicator color="#18a5a5" />
                      <Text style={styles.loadingText}>내 리뷰를 불러오는 중이에요</Text>
                    </View>
                  ) : visibleReviews.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Ionicons name="create-outline" size={24} color="#18a5a5" />
                      <Text style={styles.emptyTitle}>작성한 리뷰가 없어요</Text>
                      <Text style={styles.emptyText}>이 장소에 남긴 내 리뷰가 있으면 여기서 확인할 수 있어요.</Text>
                    </View>
                  ) : (
                    <View style={styles.reviewList}>
                      {visibleReviews.map((review) => (
                        <ReviewCard
                          key={review.reviewId}
                          item={review}
                          storeName={storeNameById.get(review.storeId) ?? `장소 #${review.storeId}`}
                          onEdit={() => beginEdit(review)}
                          onDelete={() => deleteReview(review)}
                          onPressImage={(url) => setPreviewImageUrl(url)}
                        />
                      ))}
                    </View>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>

        {showInternalTabBar ? <AppBottomNav activeTab="my" /> : null}

        <Modal visible={Boolean(editingReview)} transparent animationType="fade" onRequestClose={() => setEditingReview(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>리뷰 수정</Text>
                <TouchableOpacity onPress={() => setEditingReview(null)} activeOpacity={0.85}>
                  <Ionicons name="close" size={20} color="#6b7684" />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>평점</Text>
              <View style={styles.starEditRow}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <TouchableOpacity key={value} onPress={() => setDraft((current) => ({ ...current, rating: value }))} activeOpacity={0.85}>
                    <Ionicons name={value <= draft.rating ? 'star' : 'star-outline'} size={24} color="#f59e0b" />
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>내용</Text>
              <TextInput
                style={styles.textArea}
                value={draft.content}
                onChangeText={(text) => setDraft((current) => ({ ...current, content: text }))}
                placeholder="리뷰 내용을 입력하세요"
                placeholderTextColor="#8b95a1"
                multiline
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalSecondaryButton} onPress={() => setEditingReview(null)} activeOpacity={0.9}>
                  <Text style={styles.modalSecondaryButtonText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalPrimaryButton, savingReview ? styles.modalPrimaryButtonDisabled : null]}
                  onPress={() => void saveEdit()}
                  activeOpacity={0.9}
                  disabled={savingReview}
                >
                  <Text style={styles.modalPrimaryButtonText}>{savingReview ? '저장 중' : '저장'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={Boolean(previewImageUrl)} transparent animationType="fade" onRequestClose={closePreview}>
          <View style={styles.previewBackdrop}>
            <TouchableOpacity style={styles.previewCloseArea} onPress={closePreview} activeOpacity={1} />
            <View style={styles.previewCard}>
              <TouchableOpacity style={styles.previewCloseButton} onPress={closePreview} activeOpacity={0.85}>
                <Ionicons name="close" size={20} color="#6b7684" />
              </TouchableOpacity>
              {previewImageUrl ? <Image source={{ uri: previewImageUrl }} style={styles.previewImage} resizeMode="contain" /> : null}
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fa' },
  safeArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 18,
  },
  loadingCard: {
    marginTop: 24,
    minHeight: 180,
    borderRadius: 22,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: '#6b7684', fontSize: 13, fontWeight: '700' },
  gateCard: {
    marginTop: 12,
    borderRadius: 22,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 18,
  },
  gateIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateTitle: { marginTop: 12, color: '#191f28', fontSize: 18, fontWeight: '900' },
  gateSubtitle: { marginTop: 6, color: '#6b7684', fontSize: 13, fontWeight: '700', lineHeight: 18 },
  gateButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  gateSecondaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bfeceb',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateSecondaryButtonText: { color: '#18a5a5', fontSize: 13, fontWeight: '800' },
  gatePrimaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#18a5a5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gatePrimaryButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  summaryCard: {
    marginTop: 16,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 16,
  },
  summaryValue: { color: '#191f28', fontSize: 26, fontWeight: '900' },
  summaryLabel: { marginTop: 4, color: '#6b7684', fontSize: 12, fontWeight: '700' },
  summarySub: { marginTop: 6, color: '#18a5a5', fontSize: 12, fontWeight: '800' },
  sectionBlock: { marginTop: 18 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: { color: '#191f28', fontSize: 17, fontWeight: '900' },
  sectionMore: { color: '#18a5a5', fontSize: 13, fontWeight: '800' },
  storeRow: {
    gap: 10,
    paddingRight: 8,
  },
  storeChip: {
    width: 220,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 12,
  },
  storeChipActive: {
    borderColor: '#18a5a5',
    backgroundColor: '#edf8f8',
  },
  storeChipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  storeThumb: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  storeThumbImage: {
    width: '100%',
    height: '100%',
  },
  storeChipTextWrap: { flex: 1, minWidth: 0 },
  storeName: { color: '#191f28', fontSize: 14, fontWeight: '900' },
  storeMeta: { marginTop: 3, color: '#6b7684', fontSize: 11, fontWeight: '700' },
  reviewList: {
    gap: 12,
  },
  reviewCard: {
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 14,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  authorLabel: { color: '#6b7684', fontSize: 11, fontWeight: '700' },
  authorName: { marginTop: 2, color: '#191f28', fontSize: 14, fontWeight: '900' },
  storeLabel: { marginTop: 8, color: '#18a5a5', fontSize: 12, fontWeight: '800' },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reviewContent: {
    marginTop: 12,
    color: '#191f28',
    fontSize: 13,
    lineHeight: 19,
  },
  imageRow: {
    gap: 8,
    paddingTop: 12,
  },
  reviewImageWrap: {
    width: 84,
    height: 84,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#eef1f5',
  },
  reviewImage: {
    width: '100%',
    height: '100%',
  },
  reviewDate: {
    marginTop: 10,
    color: '#8b95a1',
    fontSize: 11,
    fontWeight: '700',
  },
  actionRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#edf8f8',
  },
  secondaryButtonText: { color: '#18a5a5', fontSize: 12, fontWeight: '800' },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff7f7',
  },
  dangerButtonText: { color: '#ef4444', fontSize: 12, fontWeight: '800' },
  emptyCard: {
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 20,
    alignItems: 'center',
  },
  emptyTitle: { marginTop: 12, color: '#191f28', fontSize: 16, fontWeight: '900' },
  emptyText: {
    marginTop: 6,
    color: '#6b7684',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    borderRadius: 22,
    backgroundColor: '#ffffff',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: { color: '#191f28', fontSize: 18, fontWeight: '900' },
  fieldLabel: { color: '#6b7684', fontSize: 12, fontWeight: '800', marginBottom: 8 },
  starEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#191f28',
    fontSize: 14,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalSecondaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bfeceb',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryButtonText: { color: '#18a5a5', fontSize: 13, fontWeight: '800' },
  modalPrimaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#18a5a5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryButtonDisabled: {
    opacity: 0.7,
  },
  modalPrimaryButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.75)',
    justifyContent: 'center',
    padding: 18,
  },
  previewCloseArea: {
    ...StyleSheet.absoluteFillObject,
  },
  previewCard: {
    borderRadius: 22,
    backgroundColor: '#f9fafb',
    padding: 14,
    overflow: 'hidden',
  },
  previewCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eef1f5',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#eef1f5',
    borderRadius: 18,
  },
});
