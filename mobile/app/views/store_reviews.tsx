import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSafeBack } from '@/components/use-safe-back';
import { FullscreenImageViewer } from '@/components/fullscreen-image-viewer';
import { getScreenContentStyle } from '@/components/screen-layout';
import { filesApi, storeReviewsApi, storesApi, tokenStore } from '@/services/api';
import type { StoreLookupItemResponse } from '@/services/api/types';
import type { StoreReviewItem } from '@/services/api/storeReviews';

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

const resolveAssetUrl = (url: string) => {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
  return `${baseUrl}${url}`;
};

function StarSelector({
  rating,
  onChange,
}: {
  rating: number;
  onChange: (next: number) => void;
}) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((value) => {
        const active = value <= rating;
        return (
          <TouchableOpacity key={value} style={styles.starButton} onPress={() => onChange(value)} activeOpacity={0.85}>
            <Ionicons name={active ? 'star' : 'star-outline'} size={22} color={active ? '#f59e0b' : '#8b95a1'} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ReviewImageChips({
  urls,
  onRemove,
}: {
  urls: string[];
  onRemove: (index: number) => void;
}) {
  if (urls.length === 0) return null;

  return (
    <View style={styles.imageChipRow}>
      {urls.map((url, index) => (
        <View key={`${url}-${index}`} style={styles.imageChip}>
          <Text style={styles.imageChipText} numberOfLines={1}>
            {url}
          </Text>
          <TouchableOpacity onPress={() => onRemove(index)} activeOpacity={0.85}>
            <Ionicons name="close-circle" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

function ReviewCard({
  item,
  isMine,
  onEdit,
  onDelete,
  onPressImage,
}: {
  item: StoreReviewItem;
  isMine: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onPressImage: (url: string) => void;
}) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewCardTop}>
        <View style={styles.authorWrap}>
          <Text style={styles.authorLabel}>작성자</Text>
          <Text style={styles.authorName}>{item.displayName ?? item.authorNickname ?? '작성자'}</Text>
          <View style={styles.ratingWrap}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Ionicons key={value} name={value <= item.rating ? 'star' : 'star-outline'} size={14} color="#f59e0b" />
            ))}
          </View>
        </View>
        {isMine ? <Text style={styles.mineBadge}>내 리뷰</Text> : null}
      </View>
      <Text style={styles.reviewContent}>{item.content}</Text>
      {item.imageUrls.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewImageRow}>
          {item.imageUrls.map((url) => (
            <TouchableOpacity key={url} style={styles.reviewImageCard} activeOpacity={0.9} onPress={() => onPressImage(resolveAssetUrl(url))}>
              <Image source={{ uri: resolveAssetUrl(url) }} style={styles.reviewImage} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.reviewFooter}>
        <Text style={styles.reviewMeta}>{item.createdAt.slice(0, 10)}</Text>
        {isMine ? (
          <View style={styles.reviewActions}>
            {onEdit ? (
              <TouchableOpacity style={styles.actionPill} onPress={onEdit} activeOpacity={0.85}>
                <Text style={styles.actionPillText}>수정</Text>
              </TouchableOpacity>
            ) : null}
            {onDelete ? (
              <TouchableOpacity style={[styles.actionPill, styles.deletePill]} onPress={onDelete} activeOpacity={0.85}>
                <Text style={[styles.actionPillText, styles.deletePillText]}>삭제</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function StoreReviewsScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/views/my_map');
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ storeId?: string | string[]; storeName?: string | string[] }>();
  const storeIdParam = Array.isArray(params.storeId) ? params.storeId[0] : params.storeId;
  const storeNameParam = Array.isArray(params.storeName) ? params.storeName[0] : params.storeName;
  const storeId = storeIdParam ? Number(storeIdParam) : null;

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedReviewId, setSelectedReviewId] = useState<number | null>(null);
  const [store, setStore] = useState<StoreLookupItemResponse | null>(null);
  const [publicReviews, setPublicReviews] = useState<StoreReviewItem[]>([]);
  const [myReviews, setMyReviews] = useState<StoreReviewItem[]>([]);
  const [draft, setDraft] = useState<ReviewDraft>(EMPTY_DRAFT);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageTitle, setPreviewImageTitle] = useState('사진 보기');

  const load = useCallback(async () => {
    if (!storeId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const token = await tokenStore.getAccessToken();
      setIsLoggedIn(Boolean(token));

      const [storeResponse, publicResponse, mineResponse] = await Promise.all([
        storesApi.listByIds([storeId]),
        storeReviewsApi.list(storeId),
        token ? storeReviewsApi.mineByStore(storeId) : Promise.resolve(null),
      ]);

      setStore(storeResponse.stores[0] ?? null);
      setPublicReviews(publicResponse.content);
      setMyReviews(mineResponse?.content ?? []);
    } catch (error) {
      Alert.alert('리뷰 불러오기 실패', error instanceof Error ? error.message : '리뷰를 불러오지 못했어요.');
      setStore(null);
      setPublicReviews([]);
      setMyReviews([]);
    } finally {
      setIsLoading(false);
    }
  }, [storeId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    if (!storeId) {
      Alert.alert('매장 정보', '리뷰를 볼 매장 정보가 없어요.');
      goBack();
    }
  }, [goBack, storeId]);

  const storeTitle = store?.name ?? storeNameParam ?? '매장 리뷰';
  const storeAddress = store?.roadAddress ?? store?.address ?? store?.jibunAddress ?? '주소 정보 없음';
  const averageRating = useMemo(() => {
    const rating = store?.reviewAverageRating ?? store?.rating;
    if (rating === null || rating === undefined) return '—';
    return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
  }, [store]);
  const openPreview = useCallback((url: string, title: string) => {
    setPreviewImageUrl(url);
    setPreviewImageTitle(title);
  }, []);
  const closePreview = useCallback(() => setPreviewImageUrl(null), []);

  const handlePickImage = async () => {
    if (!isLoggedIn) {
      Alert.alert('로그인이 필요해요', '리뷰 사진을 올리려면 먼저 로그인해주세요.');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (!file?.uri) {
        Alert.alert('파일 선택 실패', '선택한 파일을 읽지 못했어요.');
        return;
      }

      setIsUploading(true);
      const response = await filesApi.uploadReview({
        uri: file.uri,
        name: file.name ?? 'review-image.jpg',
        type: file.mimeType ?? 'image/jpeg',
      });

      setDraft((current) => ({
        ...current,
        imageUrls: [...current.imageUrls, response.url],
      }));
    } catch (error) {
      Alert.alert('리뷰 사진 업로드 실패', error instanceof Error ? error.message : '파일 업로드에 실패했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!storeId) return;
    if (!isLoggedIn) {
      Alert.alert('로그인이 필요해요', '리뷰를 작성하려면 로그인해주세요.');
      return;
    }

    const content = draft.content.trim();
    if (!content) {
      Alert.alert('내용 입력', '리뷰 내용을 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);

      if (selectedReviewId) {
        await storeReviewsApi.update(selectedReviewId, {
          rating: draft.rating,
          content,
          imageUrls: draft.imageUrls,
        });
      } else {
        await storeReviewsApi.create(storeId, {
          rating: draft.rating,
          content,
          imageUrls: draft.imageUrls,
        });
      }

      setDraft(EMPTY_DRAFT);
      setSelectedReviewId(null);
      await load();
      Alert.alert('저장 완료', selectedReviewId ? '리뷰를 수정했어요.' : '리뷰를 작성했어요.');
    } catch (error) {
      Alert.alert('리뷰 저장 실패', error instanceof Error ? error.message : '리뷰 저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (item: StoreReviewItem) => {
    setSelectedReviewId(item.reviewId);
    setDraft({
      rating: item.rating,
      content: item.content,
      imageUrls: item.imageUrls,
    });
  };

  const handleDelete = async (reviewId: number) => {
    Alert.alert('리뷰 삭제', '이 리뷰를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await storeReviewsApi.remove(reviewId);
            if (selectedReviewId === reviewId) {
              setSelectedReviewId(null);
              setDraft(EMPTY_DRAFT);
            }
            await load();
          } catch (error) {
            Alert.alert('리뷰 삭제 실패', error instanceof Error ? error.message : '리뷰 삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, getScreenContentStyle(insets)]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={goBack} style={styles.backButton} activeOpacity={0.85}>
              <Ionicons name="chevron-back" size={24} color="#18a5a5" />
            </TouchableOpacity>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>리뷰 보기</Text>
              <Text style={styles.headerSubtitle}>매장 리뷰를 보고 내 리뷰를 작성할 수 있어요.</Text>
            </View>
          </View>

          <View style={styles.heroCard}>
            <Text style={styles.storeName}>{storeTitle}</Text>
            <Text style={styles.storeAddress}>{storeAddress}</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaPill}>
                <Ionicons name="star" size={14} color="#f59e0b" />
                <Text style={styles.metaText}>{averageRating}</Text>
              </View>
              <View style={styles.metaPill}>
                <Ionicons name="chatbubble-outline" size={14} color="#18a5a5" />
                <Text style={styles.metaText}>{publicReviews.length}개 리뷰</Text>
              </View>
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#18a5a5" />
              <Text style={styles.loadingText}>리뷰를 불러오는 중...</Text>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>{selectedReviewId ? '리뷰 수정' : '리뷰 작성'}</Text>
                  {selectedReviewId ? (
                    <TouchableOpacity
                      style={styles.cancelEditButton}
                      onPress={() => {
                        setSelectedReviewId(null);
                        setDraft(EMPTY_DRAFT);
                      }}
                    >
                      <Text style={styles.cancelEditText}>수정 취소</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {!isLoggedIn ? (
                  <View style={styles.loginCard}>
                    <Text style={styles.loginTitle}>로그인이 필요해요</Text>
                    <Text style={styles.loginSubtitle}>리뷰 작성, 수정, 삭제는 로그인 후 사용할 수 있어요.</Text>
                    <View style={styles.loginButtons}>
                      <TouchableOpacity style={styles.loginSecondaryButton} onPress={() => router.replace('/views/user_login')}>
                        <Text style={styles.loginSecondaryButtonText}>로그인</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.loginPrimaryButton} onPress={() => router.replace('/views/user_signup')}>
                        <Text style={styles.loginPrimaryButtonText}>회원가입</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <>
                    <Text style={styles.fieldLabel}>별점</Text>
                    <StarSelector rating={draft.rating} onChange={(next) => setDraft((current) => ({ ...current, rating: next }))} />

                    <Text style={styles.fieldLabel}>내용</Text>
                    <TextInput
                      style={styles.contentInput}
                      value={draft.content}
                      onChangeText={(content) => setDraft((current) => ({ ...current, content }))}
                      placeholder="이 매장에 대한 리뷰를 적어주세요."
                      placeholderTextColor="#8b95a1"
                      multiline
                    />

                    <View style={styles.uploadRow}>
                      <TouchableOpacity style={styles.uploadButton} onPress={() => void handlePickImage()} activeOpacity={0.9}>
                        {isUploading ? (
                          <ActivityIndicator color="#18a5a5" />
                        ) : (
                          <>
                            <Ionicons name="image-outline" size={16} color="#18a5a5" />
                            <Text style={styles.uploadButtonText}>사진 추가</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <Text style={styles.uploadHint}>리뷰 사진은 파일 업로드 API로 바로 올려요.</Text>
                    </View>

                    <ReviewImageChips
                      urls={draft.imageUrls}
                      onRemove={(index) =>
                        setDraft((current) => ({
                          ...current,
                          imageUrls: current.imageUrls.filter((_, itemIndex) => itemIndex !== index),
                        }))
                      }
                    />

                    <TouchableOpacity style={styles.primaryButton} onPress={() => void handleSubmit()} activeOpacity={0.9} disabled={isSubmitting}>
                      {isSubmitting ? <ActivityIndicator color="#f9fafb" /> : <Text style={styles.primaryButtonText}>{selectedReviewId ? '리뷰 수정' : '리뷰 등록'}</Text>}
                    </TouchableOpacity>
                  </>
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>모든 리뷰</Text>
                {publicReviews.length === 0 ? (
                  <Text style={styles.emptyText}>아직 리뷰가 없어요.</Text>
                ) : (
                  <View style={styles.reviewList}>
                    {publicReviews.map((item) => (
                      <ReviewCard
                        key={item.reviewId}
                        item={item}
                        isMine={myReviews.some((review) => review.reviewId === item.reviewId)}
                        onEdit={myReviews.some((review) => review.reviewId === item.reviewId) ? () => handleEdit(item) : undefined}
                        onDelete={myReviews.some((review) => review.reviewId === item.reviewId) ? () => void handleDelete(item.reviewId) : undefined}
                        onPressImage={(url) => openPreview(url, '리뷰 사진')}
                      />
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>내 리뷰</Text>
                {!isLoggedIn ? (
                  <Text style={styles.emptyText}>로그인 후 내 리뷰를 확인할 수 있어요.</Text>
                ) : myReviews.length === 0 ? (
                  <Text style={styles.emptyText}>작성한 리뷰가 없어요.</Text>
                ) : (
                  <View style={styles.reviewList}>
                    {myReviews.map((item) => (
                      <ReviewCard
                        key={item.reviewId}
                        item={item}
                        isMine
                        onEdit={() => handleEdit(item)}
                        onDelete={() => void handleDelete(item.reviewId)}
                        onPressImage={(url) => openPreview(url, '리뷰 사진')}
                      />
                    ))}
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <FullscreenImageViewer visible={Boolean(previewImageUrl)} uri={previewImageUrl} onClose={closePreview} title={previewImageTitle} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fa' },
  scrollContent: { paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 18 },
  backButton: { paddingTop: 10, paddingRight: 10, paddingBottom: 10 },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#191f28' },
  headerSubtitle: { marginTop: 6, color: '#6b7684', fontSize: 13, lineHeight: 18 },
  heroCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 18,
    marginBottom: 12,
  },
  storeName: { fontSize: 22, fontWeight: '900', color: '#191f28' },
  storeAddress: { marginTop: 8, color: '#6b7684', fontSize: 13, lineHeight: 18 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eef1f5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metaText: { color: '#191f28', fontSize: 12, fontWeight: '800' },
  loadingCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: '#6b7684', fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 18,
    marginBottom: 12,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#191f28', marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '800', color: '#4e5968', marginTop: 8, marginBottom: 8 },
  starRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  starButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e8eb',
  },
  contentInput: {
    minHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#191f28',
    textAlignVertical: 'top',
  },
  uploadRow: { marginTop: 12, gap: 8 },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#edf8f8',
    backgroundColor: '#eef1f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  uploadButtonText: { color: '#18a5a5', fontSize: 12, fontWeight: '800' },
  uploadHint: { color: '#6b7684', fontSize: 12, lineHeight: 16 },
  imageChipRow: { gap: 8, marginTop: 10 },
  imageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  imageChipText: { flex: 1, color: '#4e5968', fontSize: 12 },
  primaryButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#18a5a5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  primaryButtonText: { color: '#f9fafb', fontSize: 15, fontWeight: '800' },
  cancelEditButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#f9fafb',
  },
  cancelEditText: { color: '#ef4444', fontSize: 12, fontWeight: '800' },
  loginCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    padding: 16,
  },
  loginTitle: { fontSize: 15, fontWeight: '900', color: '#191f28' },
  loginSubtitle: { marginTop: 6, fontSize: 13, color: '#6b7684', lineHeight: 18 },
  loginButtons: { flexDirection: 'row', gap: 10, marginTop: 14 },
  loginSecondaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#edf8f8',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginSecondaryButtonText: { color: '#18a5a5', fontSize: 13, fontWeight: '800' },
  loginPrimaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#18a5a5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginPrimaryButtonText: { color: '#f9fafb', fontSize: 13, fontWeight: '800' },
  reviewList: { gap: 12 },
  reviewCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    padding: 14,
  },
  reviewCardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  authorWrap: { flex: 1, gap: 6 },
  authorLabel: { color: '#6b7684', fontSize: 10, fontWeight: '800' },
  authorName: { color: '#191f28', fontSize: 14, fontWeight: '900' },
  ratingWrap: { flexDirection: 'row', gap: 2 },
  mineBadge: {
    color: '#18a5a5',
    fontSize: 11,
    fontWeight: '900',
    backgroundColor: '#edf8f8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  reviewContent: { marginTop: 10, color: '#4e5968', fontSize: 13, lineHeight: 19 },
  reviewImageRow: { gap: 8, marginTop: 12 },
  reviewImageCard: {
    width: 92,
    height: 92,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#e5e8eb',
  },
  reviewImage: { width: '100%', height: '100%' },
  reviewFooter: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  reviewMeta: { color: '#6b7684', fontSize: 12 },
  reviewActions: { flexDirection: 'row', gap: 8 },
  actionPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#edf8f8',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionPillText: { color: '#18a5a5', fontSize: 12, fontWeight: '800' },
  deletePill: {
    borderColor: '#fca5a5',
    backgroundColor: '#f9fafb',
  },
  deletePillText: { color: '#ef4444' },
  emptyText: { color: '#6b7684', fontSize: 13, lineHeight: 18 },
});
