import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { FullscreenImageViewer } from '@/components/fullscreen-image-viewer';
import { OwnerStorePicker } from '@/components/owner-store-picker';
import { useSafeBack } from '@/components/use-safe-back';
import { filesApi, ownerApi, tokenStore } from '@/services/api';
import type { OwnerLinkedStoreResponse } from '@/services/api/owner';

const resolveAssetUrl = (url: string) => {
  if (/^https?:\/\//i.test(url)) return url;
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
  return `${baseUrl}${url}`;
};

function GatePanel({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  return (
    <View style={styles.gateCard}>
      <View style={styles.gateIconWrap}>
        <Ionicons name="lock-closed-outline" size={24} color="#0ea5a4" />
      </View>
      <Text style={styles.gateTitle}>매장 사진 관리는 로그인 후 가능해요</Text>
      <Text style={styles.gateSubtitle}>점주 계정으로 로그인하면 매장 사진과 대표 이미지를 바꿀 수 있어요.</Text>
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

function PhotoPreview({ uri, onRemove, onPress }: { uri: string; onRemove: () => void; onPress: () => void }) {
  return (
    <View style={styles.photoCard}>
      <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
        <Image source={{ uri: resolveAssetUrl(uri) }} style={styles.photoImage} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.photoRemoveButton} onPress={onRemove} activeOpacity={0.9}>
        <Ionicons name="close" size={14} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

export default function OwnerPhotosManageScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/views/owner_dashboard');
  const { width: screenWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{ storeId?: string | string[] }>();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stores, setStores] = useState<OwnerLinkedStoreResponse[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageTitle, setPreviewImageTitle] = useState('매장 사진');
  const requestedStoreId = Array.isArray(params.storeId) ? params.storeId[0] : params.storeId;
  const photoCardWidth = Math.max(240, screenWidth - 76);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const token = await tokenStore.getAccessToken();
      if (!active) return;

      setIsLoggedIn(Boolean(token));
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await ownerApi.listStores();
        if (!active) return;

        setStores(response);
        const requestedId = requestedStoreId ? Number(requestedStoreId) : null;
        const first = response.find((store) => store.storeId === requestedId) ?? response[0] ?? null;
        setSelectedStoreId(first?.storeId ?? null);
        setPhotoUrls(first?.imageUrls ?? []);
      } catch {
        if (!active) return;
        setStores([]);
      } finally {
        if (!active) return;
        setIsLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [requestedStoreId]);

  const selectedStore = useMemo(
    () => stores.find((store) => store.storeId === selectedStoreId) ?? null,
    [selectedStoreId, stores]
  );

  const handleSelectStore = (storeId: number) => {
    const store = stores.find((item) => item.storeId === storeId);
    if (!store) return;

    setSelectedStoreId(storeId);
    setPhotoUrls(store.imageUrls);
  };

  const handleSave = async () => {
    if (!selectedStore) {
      Alert.alert('매장 선택', '먼저 매장을 선택해주세요.');
      return;
    }

    try {
      setIsSaving(true);
      await ownerApi.updateStoreProfile(selectedStore.storeId, {
        ownerNotice: selectedStore.ownerNotice ?? '',
        openTime: selectedStore.openTime ?? '',
        closeTime: selectedStore.closeTime ?? '',
        breakStart: selectedStore.breakStart ?? '',
        breakEnd: selectedStore.breakEnd ?? '',
        imageUrls: photoUrls,
      });
      const response = await ownerApi.listStores();
      setStores(response);
      Alert.alert('저장 완료', '매장 사진 정보가 저장되었어요.');
    } catch (error) {
      Alert.alert('저장 실패', error instanceof Error ? error.message : '매장 사진 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadStorePhoto = async () => {
    if (!selectedStore) {
      Alert.alert('매장 선택', '먼저 매장을 선택해주세요.');
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
        Alert.alert('파일 선택 실패', '이미지 파일을 읽지 못했어요.');
        return;
      }

      const response = await filesApi.uploadStore({
        uri: file.uri,
        name: file.name ?? 'store-photo.jpg',
        type: file.mimeType ?? 'image/jpeg',
      });

      setPhotoUrls((current) => (current.includes(response.url) ? current : [...current, response.url]));
      Alert.alert('업로드 완료', '매장 사진을 추가했어요. 저장 버튼을 눌러 반영해 주세요.');
    } catch (error) {
      Alert.alert('사진 업로드 실패', error instanceof Error ? error.message : '매장 사진 업로드에 실패했습니다.');
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotoUrls((current) => current.filter((_, photoIndex) => photoIndex !== index));
  };
  const openPreview = (url: string, title = '매장 사진') => {
    setPreviewImageUrl(url);
    setPreviewImageTitle(title);
  };
  const closePreview = () => setPreviewImageUrl(null);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={goBack} style={styles.backButton} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={24} color="#0ea5a4" />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>매장 사진 관리</Text>
            <Text style={styles.headerSubtitle}>대표 이미지를 바꾸고 저장된 사진을 관리해요.</Text>
          </View>
        </View>

        {!isLoggedIn ? (
          <GatePanel onLogin={() => router.replace('/views/owner_login')} onSignup={() => router.replace('/views/owner_signup')} />
        ) : isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#0ea5a4" />
            <Text style={styles.loadingText}>매장 정보를 불러오는 중...</Text>
          </View>
        ) : stores.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="image-outline" size={28} color="#94a3b8" />
            <Text style={styles.emptyTitle}>연결된 매장이 없어요</Text>
            <Text style={styles.emptySubtitle}>매장 등록 신청이 승인되면 사진을 관리할 수 있어요.</Text>
          </View>
        ) : (
          <>
            <OwnerStorePicker
              stores={stores}
              selectedStoreId={selectedStoreId}
              selectedStore={selectedStore}
              onSelect={handleSelectStore}
            />

            <View style={styles.card}>
              <Text style={styles.sectionSubTitle}>현재 등록된 사진</Text>
              <Text style={styles.helperText}>여러 장을 등록하고, 필요 없는 사진은 지운 뒤 저장할 수 있어요.</Text>
              <View style={styles.photoPagerWrap}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  decelerationRate="fast"
                  snapToInterval={photoCardWidth + 12}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.photoPager}
                >
                  {photoUrls.length === 0 ? (
                    <View style={[styles.emptyPhotoCard, { width: photoCardWidth }]}>
                      <Ionicons name="image-outline" size={20} color="#94a3b8" />
                      <Text style={styles.emptyPhotoText}>등록된 사진이 없습니다.</Text>
                    </View>
                  ) : (
                    photoUrls.map((uri, index) => (
                      <View key={`${uri}-${index}`} style={{ width: photoCardWidth, marginRight: 12 }}>
                        <PhotoPreview
                          uri={uri}
                          onRemove={() => handleRemovePhoto(index)}
                          onPress={() => openPreview(resolveAssetUrl(uri), selectedStore?.storeName ?? '매장 사진')}
                        />
                      </View>
                    ))
                  )}
                </ScrollView>
                {photoUrls.length > 1 ? (
                  <>
                    <View style={styles.photoNextHint}>
                      <Ionicons name="chevron-forward" size={22} color="#0ea5a4" />
                    </View>
                    <View style={styles.photoCountBadge}>
                      <Text style={styles.photoCountText}>{photoUrls.length}장</Text>
                    </View>
                  </>
                ) : null}
              </View>

              <TouchableOpacity style={styles.uploadButton} onPress={() => void handleUploadStorePhoto()} activeOpacity={0.9}>
                <Ionicons name="image-outline" size={16} color="#0ea5a4" />
                <Text style={styles.uploadButtonText}>사진 추가</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={handleSave} activeOpacity={0.9} disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>저장하기</Text>
                    <Ionicons name="chevron-forward" size={18} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
      <FullscreenImageViewer visible={Boolean(previewImageUrl)} uri={previewImageUrl} onClose={closePreview} title={previewImageTitle} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fbff' },
  scrollContent: { padding: 20, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  backButton: { paddingTop: 4, paddingRight: 4 },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  headerSubtitle: { marginTop: 6, color: '#64748b', fontSize: 13, lineHeight: 18 },
  gateCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#dbeff0',
  },
  gateIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eefafa',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  gateTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginBottom: 8 },
  gateSubtitle: { fontSize: 13, color: '#64748b', lineHeight: 18 },
  gateButtons: { flexDirection: 'row', gap: 10, marginTop: 18 },
  gateSecondaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bfeceb',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  gateSecondaryButtonText: { color: '#0ea5a4', fontSize: 15, fontWeight: '800' },
  gatePrimaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0ea5a4',
  },
  gatePrimaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  loadingCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginTop: 10 },
  emptySubtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 8, lineHeight: 18 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a', marginBottom: 12 },
  sectionSubTitle: { fontSize: 13, fontWeight: '700', color: '#475569', marginTop: 8, marginBottom: 10 },
  helperText: { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 12 },
  storeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  storeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dbeff0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  storeChipActive: {
    borderColor: '#0ea5a4',
    backgroundColor: '#eefafa',
  },
  storeChipText: { color: '#334155', fontSize: 13, fontWeight: '700' },
  storeChipTextActive: { color: '#0ea5a4' },
  photoPagerWrap: {
    position: 'relative',
  },
  photoPager: {
    paddingVertical: 4,
  },
  photoNextHint: {
    position: 'absolute',
    right: 10,
    top: '50%',
    width: 34,
    height: 34,
    borderRadius: 17,
    marginTop: -17,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: '#bfeceb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCountBadge: {
    position: 'absolute',
    left: 12,
    bottom: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  photoCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  photoCard: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#eefafa',
    borderWidth: 1,
    borderColor: '#c7eff0',
  },
  photoImage: { width: '100%', height: '100%' },
  photoRemoveButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPhotoCard: {
    minHeight: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyPhotoText: { color: '#64748b', fontSize: 13, fontWeight: '700' },
  uploadButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#bfeceb',
    backgroundColor: '#eefafa',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  uploadButtonText: {
    color: '#0ea5a4',
    fontSize: 12,
    fontWeight: '800',
  },
  primaryButton: {
    marginTop: 12,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#0ea5a4',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
