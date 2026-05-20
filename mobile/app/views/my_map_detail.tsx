import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';

import { MiniKakaoMapPreview, type MiniKakaoMapPlace } from '@/components/mini-kakao-map-preview';
import {
  myMapApi,
  publicInstitutionsApi,
  storesApi,
  userMapsApi,
  type PublicInstitutionLookupItemResponse,
  type StoreLookupItemResponse,
  type UserMapDetailResponse,
} from '@/services/api';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

const resolveAssetUrl = (value?: string | null) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_BASE_URL}${value.startsWith('/') ? value : `/${value}`}`;
};

function IncludedStoreCard({ store }: { store: StoreLookupItemResponse }) {
  return (
    <View style={styles.placeCard}>
      <View style={styles.placeThumb}>
        {store.imageUrls[0] ? (
          <Image source={{ uri: resolveAssetUrl(store.imageUrls[0]) ?? undefined }} style={styles.placeThumbImage} />
        ) : (
          <Ionicons name="storefront-outline" size={20} color="#0ea5a4" />
        )}
      </View>
      <View style={styles.placeBody}>
        <Text style={styles.placeName}>{store.name}</Text>
        <Text style={styles.placeAddress} numberOfLines={2}>
          {store.roadAddress ?? store.address ?? store.jibunAddress ?? '주소 정보 없음'}
        </Text>
      </View>
    </View>
  );
}

function IncludedPublicCard({ item }: { item: PublicInstitutionLookupItemResponse }) {
  return (
    <View style={styles.placeCard}>
      <View style={[styles.placeThumb, styles.publicThumb]}>
        <Ionicons name="information-circle-outline" size={20} color="#8b5cf6" />
      </View>
      <View style={styles.placeBody}>
        <Text style={styles.placeName}>{item.name ?? '공공 장소'}</Text>
        <Text style={styles.placeAddress} numberOfLines={2}>
          {item.address ?? '주소 정보 없음'}
        </Text>
      </View>
    </View>
  );
}

export default function MyMapDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mapId?: string | string[]; title?: string | string[] }>();
  const mapIdParam = Array.isArray(params.mapId) ? params.mapId[0] : params.mapId;
  const titleParam = Array.isArray(params.title) ? params.title[0] : params.title;
  const mapId = mapIdParam ? Number(mapIdParam) : null;

  const [isLoading, setIsLoading] = useState(true);
  const [detail, setDetail] = useState<UserMapDetailResponse | null>(null);
  const [stores, setStores] = useState<StoreLookupItemResponse[]>([]);
  const [publics, setPublics] = useState<PublicInstitutionLookupItemResponse[]>([]);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [isPublicDraft, setIsPublicDraft] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);

  const load = useCallback(async () => {
    if (!mapId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const mapDetail = await userMapsApi.get(mapId);
      setDetail(mapDetail);
      setTitleDraft(mapDetail.map.title ?? '');
      setDescriptionDraft(mapDetail.map.description ?? '');
      setIsPublicDraft(Boolean(mapDetail.map.isPublic));

      const [storeResponse, publicResponse] = await Promise.all([
        mapDetail.stores.length > 0 ? storesApi.listByIds(mapDetail.stores) : Promise.resolve({ stores: [] } as { stores: StoreLookupItemResponse[] }),
        mapDetail.publicInstitutions.length > 0 ? publicInstitutionsApi.getByIds(mapDetail.publicInstitutions) : Promise.resolve({ institutions: [] } as { institutions: PublicInstitutionLookupItemResponse[] }),
      ]);

      setStores(storeResponse.stores ?? []);
      setPublics(publicResponse.institutions ?? []);
    } catch (error) {
      Alert.alert('내 지도', error instanceof Error ? error.message : '지도를 불러오지 못했어요.');
      router.back();
    } finally {
      setIsLoading(false);
    }
  }, [mapId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const map = detail?.map;
  const coverImage = resolveAssetUrl(map?.profileImageUrl ?? null);
  const placeCount = stores.length + publics.length;
  const previewPlaces: MiniKakaoMapPlace[] = [
    ...stores.map((store) => ({
      id: `store-${store.storeId}`,
      name: store.name,
      latitude: store.latitude,
      longitude: store.longitude,
    })),
    ...publics.map((item) => ({
      id: `public-${item.id}`,
      name: item.name ?? '공공 장소',
      latitude: item.latitude,
      longitude: item.longitude,
    })),
  ];

  const openEditModal = useCallback(() => {
    setTitleDraft(map?.title ?? '');
    setDescriptionDraft(map?.description ?? '');
    setIsPublicDraft(Boolean(map?.isPublic));
    setIsEditModalVisible(true);
  }, [map?.description, map?.isPublic, map?.title]);

  const saveMetadata = useCallback(async () => {
    if (!mapId || !map) return;

    const nextTitle = titleDraft.trim();
    const nextDescription = descriptionDraft.trim();

    if (nextTitle.length < 1) {
      Alert.alert('지도 이름', '지도 이름을 입력해주세요.');
      return;
    }

    try {
      setIsSavingMetadata(true);
      const response = await userMapsApi.update(mapId, {
        title: nextTitle,
        description: nextDescription || null,
        isPublic: isPublicDraft,
        profileImageUrl: map.profileImageUrl,
      });
      setDetail((prev) => (prev ? { ...prev, map: response } : prev));
      setIsEditModalVisible(false);
      Alert.alert('저장 완료', '지도 정보를 수정했어요.');
    } catch (error) {
      Alert.alert('저장 실패', error instanceof Error ? error.message : '지도 정보를 저장하지 못했어요.');
    } finally {
      setIsSavingMetadata(false);
    }
  }, [descriptionDraft, isPublicDraft, map, mapId, titleDraft]);

  const setRepresentativeImage = useCallback(async () => {
    if (!mapId) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (!file?.uri) {
        Alert.alert('대표 이미지', '이미지 파일을 읽지 못했어요.');
        return;
      }

      setIsSavingImage(true);
      const response = await myMapApi.updateProfileImage(mapId, {
        uri: file.uri,
        name: file.name ?? 'map-cover.jpg',
        type: file.mimeType ?? 'image/jpeg',
      });
      setDetail((prev) => (prev ? { ...prev, map: { ...prev.map, profileImageUrl: response.profileImageUrl ?? null } } : prev));
      Alert.alert('저장 완료', response.profileImageUrl ? '대표 이미지를 설정했어요.' : '대표 이미지가 삭제되었어요.');
    } catch (error) {
      Alert.alert('대표 이미지', error instanceof Error ? error.message : '대표 이미지를 설정하지 못했어요.');
    } finally {
      setIsSavingImage(false);
    }
  }, [mapId]);

  const shareMap = useCallback(async () => {
    if (!map) return;
    try {
      await Share.share({
        message: `${map.title} - ${map.isPublic ? '공개' : '비공개'} 마이지도`,
      });
    } catch {
      // ignore
    }
  }, [map]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#0ea5a4" />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.9}>
                <Ionicons name="chevron-back" size={24} color="#0f172a" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareButton} onPress={shareMap} activeOpacity={0.9}>
                <Ionicons name="share-social-outline" size={18} color="#0ea5a4" />
              </TouchableOpacity>
            </View>

            <View style={styles.heroCard}>
              {coverImage ? <Image source={{ uri: coverImage }} style={styles.heroImage} /> : <View style={styles.heroImageFallback} />}
              <View style={styles.heroOverlay} />
              {!coverImage ? (
                <View style={styles.heroEmptyTag}>
                  <Text style={styles.heroEmptyTagText}>대표 이미지 없음</Text>
                </View>
              ) : null}
              <View style={styles.heroBody}>
                <Text style={styles.heroTitle}>{map?.title ?? titleParam ?? '내 지도'}</Text>
                <Text style={styles.heroSubtitle}>{map?.description ?? '저장한 장소를 한눈에 정리해보세요'}</Text>
                <View style={styles.heroMetaRow}>
                  <View style={styles.heroMetaPill}>
                    <Ionicons name="bookmark-outline" size={13} color="#0ea5a4" />
                    <Text style={styles.heroMetaText}>장소 {placeCount}개</Text>
                  </View>
                  <View style={styles.heroMetaPill}>
                    <Ionicons name="thumbs-up" size={13} color="#0ea5a4" />
                    <Text style={styles.heroMetaText}>좋아요 {map?.likeCount ?? 0}</Text>
                  </View>
                  <View style={styles.heroMetaPill}>
                    <Ionicons name={map?.isPublic ? 'lock-open-outline' : 'lock-closed-outline'} size={13} color="#0ea5a4" />
                    <Text style={styles.heroMetaText}>{map?.isPublic ? '공개' : '비공개'}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.mapTitleRow}>
              <Text style={styles.mapTitle}>{map?.title ?? titleParam ?? '내 지도'}</Text>
              <TouchableOpacity style={styles.smallIconButton} onPress={openEditModal} activeOpacity={0.88}>
                <Ionicons name="create-outline" size={17} color="#0ea5a4" />
              </TouchableOpacity>
            </View>
            <Text style={styles.mapAuthorText}>by 나</Text>
            <View style={styles.inlineMetaRow}>
              <View style={styles.inlineMetaItem}>
                <Ionicons name="thumbs-up" size={15} color="#0ea5a4" />
                <Text style={styles.inlineMetaText}>{map?.likeCount ?? 0}</Text>
              </View>
              <Text style={styles.inlineMetaText}>{placeCount}개 장소</Text>
              <Text style={styles.inlineMetaText}>{map?.isPublic ? '공개' : '비공개'}</Text>
            </View>

            <View style={styles.previewMapSection}>
              <MiniKakaoMapPreview places={previewPlaces} />
            </View>

            <TouchableOpacity style={styles.representativeAction} onPress={setRepresentativeImage} activeOpacity={0.9} disabled={isSavingImage}>
              <View style={styles.representativeActionLeft}>
                <Ionicons name="image-outline" size={18} color="#0ea5a4" />
                <View>
                  <Text style={styles.representativeActionTitle}>{coverImage ? '대표 이미지 변경' : '대표 이미지 설정'}</Text>
                  <Text style={styles.representativeActionText}>
                    {coverImage ? '현재 이미지를 교체할 수 있어요' : '이미지가 없으면 여기서 바로 추가할 수 있어요'}
                  </Text>
                </View>
              </View>
              {isSavingImage ? <ActivityIndicator size="small" color="#0ea5a4" /> : <Ionicons name="chevron-forward" size={18} color="#0ea5a4" />}
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>포함된 장소</Text>
            <View style={styles.placeList}>
              {stores.map((store) => (
                <IncludedStoreCard key={store.storeId} store={store} />
              ))}
              {publics.map((item) => (
                <IncludedPublicCard key={item.id} item={item} />
              ))}
            </View>

            {placeCount === 0 ? (
              <View style={styles.emptyPlacesCard}>
                <Ionicons name="map-outline" size={28} color="#94a3b8" />
                <Text style={styles.emptyPlacesTitle}>아직 담긴 장소가 없어요</Text>
                <Text style={styles.emptyPlacesText}>저장한 장소에서 이 지도에 넣을 장소를 선택해보세요.</Text>
              </View>
            ) : null}

            <View style={styles.bottomActionRow}>
              <TouchableOpacity style={styles.bottomActionButton} onPress={openEditModal} activeOpacity={0.9}>
                <Ionicons name="create-outline" size={17} color="#0ea5a4" />
                <Text style={styles.bottomActionText}>수정</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bottomActionButton} onPress={() => router.push('/saved')} activeOpacity={0.9}>
                <Ionicons name="bookmark-outline" size={17} color="#0ea5a4" />
                <Text style={styles.bottomActionText}>장소 추가</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bottomActionButton} onPress={shareMap} activeOpacity={0.9}>
                <Ionicons name="share-social-outline" size={17} color="#0ea5a4" />
                <Text style={styles.bottomActionText}>공유하기</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={styles.fullMapButton}
                onPress={() => {
                  if (!mapId) return;
                  router.push({
                    pathname: '/map',
                    params: {
                      mapId: String(mapId),
                      mapTitle: map?.title ?? titleParam ?? '내 지도',
                    },
                  });
                }}
                activeOpacity={0.9}
              >
                <Ionicons name="map-outline" size={17} color="#0ea5a4" />
                <Text style={styles.fullMapButtonText}>큰 지도에서 보기</Text>
              </TouchableOpacity>
          </ScrollView>
        )}

        <Modal
          visible={isEditModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setIsEditModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.bottomSheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>지도 정보 수정</Text>
                  <Text style={styles.modalSubtitle}>공개 지도에는 이름과 설명이 함께 보여요.</Text>
                </View>
                <TouchableOpacity style={styles.modalCloseButton} onPress={() => setIsEditModalVisible(false)} activeOpacity={0.85}>
                  <Ionicons name="close" size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>지도 이름</Text>
              <TextInput
                value={titleDraft}
                onChangeText={setTitleDraft}
                placeholder="지도 이름"
                placeholderTextColor="#94a3b8"
                style={styles.input}
                maxLength={120}
              />

              <Text style={styles.inputLabel}>설명</Text>
              <TextInput
                value={descriptionDraft}
                onChangeText={setDescriptionDraft}
                placeholder="지도 설명"
                placeholderTextColor="#94a3b8"
                style={[styles.input, styles.textArea]}
                multiline
                maxLength={1000}
                textAlignVertical="top"
              />

              <View style={styles.visibilityRow}>
                <View style={styles.visibilityIcon}>
                  <Ionicons name={isPublicDraft ? 'lock-open-outline' : 'lock-closed-outline'} size={19} color="#0ea5a4" />
                </View>
                <View style={styles.visibilityTextWrap}>
                  <Text style={styles.visibilityTitle}>{isPublicDraft ? '공개 지도' : '비공개 지도'}</Text>
                  <Text style={styles.visibilityText}>
                    {isPublicDraft ? '다른 사용자가 공개 지도에서 볼 수 있어요.' : '나만 볼 수 있는 지도로 유지돼요.'}
                  </Text>
                </View>
                <Switch
                  value={isPublicDraft}
                  onValueChange={setIsPublicDraft}
                  trackColor={{ false: '#cbd5e1', true: '#99f6e4' }}
                  thumbColor={isPublicDraft ? '#0ea5a4' : '#fff'}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveMetadataButton, isSavingMetadata && styles.disabledButton]}
                onPress={() => void saveMetadata()}
                disabled={isSavingMetadata}
                activeOpacity={0.9}
              >
                {isSavingMetadata ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark" size={18} color="#fff" />}
                <Text style={styles.saveMetadataButtonText}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 18,
    paddingBottom: 34,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e6fbfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    minHeight: 260,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroImageFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#e6fbfa',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  heroBody: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(15,23,42,0.38)',
  },
  heroEmptyTag: {
    position: 'absolute',
    left: 14,
    top: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.58)',
  },
  heroEmptyTagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },
  heroSubtitle: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  heroMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  heroMetaText: {
    color: '#0f172a',
    fontSize: 10,
    fontWeight: '900',
  },
  mapTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  mapTitle: {
    flex: 1,
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '900',
  },
  smallIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e6fbfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapAuthorText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '800',
  },
  inlineMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    marginTop: 10,
    marginBottom: 14,
  },
  inlineMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  inlineMetaText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '900',
  },
  previewMapSection: {
    marginBottom: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  primaryAction: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#0ea5a4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryAction: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryActionText: {
    color: '#0ea5a4',
    fontSize: 13,
    fontWeight: '900',
  },
  representativeAction: {
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  representativeActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  representativeActionTitle: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '900',
  },
  representativeActionText: {
    marginTop: 3,
    color: '#64748b',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 10,
  },
  placeList: {
    gap: 10,
    marginBottom: 18,
  },
  placeCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    alignItems: 'center',
  },
  placeThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#e6fbfa',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  publicThumb: {
    backgroundColor: '#efe8ff',
  },
  placeThumbImage: {
    width: '100%',
    height: '100%',
  },
  placeBody: {
    flex: 1,
    minWidth: 0,
  },
  placeName: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
  },
  placeAddress: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  emptyPlacesCard: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#fff',
    padding: 18,
    marginBottom: 18,
  },
  emptyPlacesTitle: {
    marginTop: 8,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
  },
  emptyPlacesText: {
    marginTop: 5,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  bottomActionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  bottomActionText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '900',
  },
  fullMapButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#e6fbfa',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  fullMapButtonText: {
    color: '#0ea5a4',
    fontSize: 14,
    fontWeight: '900',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,23,42,0.38)',
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 26,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#cbd5e1',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 18,
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900',
  },
  modalSubtitle: {
    marginTop: 5,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 7,
  },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 14,
  },
  textArea: {
    height: 96,
    paddingTop: 13,
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#f8fafc',
    padding: 13,
    marginBottom: 16,
  },
  visibilityIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#e6fbfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  visibilityTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  visibilityTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
  },
  visibilityText: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  saveMetadataButton: {
    height: 50,
    borderRadius: 15,
    backgroundColor: '#0ea5a4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabledButton: {
    opacity: 0.62,
  },
  saveMetadataButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
});
