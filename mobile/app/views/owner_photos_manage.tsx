import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ownerApi, tokenStore } from '@/services/api';
import type { OwnerLinkedStoreResponse } from '@/services/api/owner';

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

function PhotoPreview({ uri }: { uri: string }) {
  return (
    <View style={styles.previewItem}>
      <Text style={styles.previewText} numberOfLines={1}>
        {uri}
      </Text>
    </View>
  );
}

export default function OwnerPhotosManageScreen() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stores, setStores] = useState<OwnerLinkedStoreResponse[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [imageUrls, setImageUrls] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
        const first = response[0] ?? null;
        setSelectedStoreId(first?.storeId ?? null);
        setImageUrls((first?.imageUrls ?? []).join('\n'));
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
  }, []);

  const selectedStore = useMemo(
    () => stores.find((store) => store.storeId === selectedStoreId) ?? null,
    [selectedStoreId, stores]
  );

  const handleSelectStore = (storeId: number) => {
    const store = stores.find((item) => item.storeId === storeId);
    if (!store) return;

    setSelectedStoreId(storeId);
    setImageUrls(store.imageUrls.join('\n'));
  };

  const handleSave = async () => {
    if (!selectedStore) {
      Alert.alert('매장 선택', '먼저 매장을 선택해주세요.');
      return;
    }

    const urls = imageUrls
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      setIsSaving(true);
      await ownerApi.updateStoreProfile(selectedStore.storeId, { imageUrls: urls });
      const response = await ownerApi.listStores();
      setStores(response);
      Alert.alert('저장 완료', '매장 사진 정보가 저장되었어요.');
    } catch (error) {
      Alert.alert('저장 실패', error instanceof Error ? error.message : '매장 사진 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={24} color="#0ea5a4" />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>매장 사진 관리</Text>
            <Text style={styles.headerSubtitle}>대표 이미지를 바꾸고 저장된 사진을 관리해요.</Text>
          </View>
        </View>

        {!isLoggedIn ? (
          <GatePanel onLogin={() => router.push('/views/owner_login')} onSignup={() => router.push('/views/owner_signup')} />
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
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>연결된 매장</Text>
              <View style={styles.storeChips}>
                {stores.map((store) => {
                  const active = selectedStoreId === store.storeId;
                  return (
                    <TouchableOpacity
                      key={store.storeId}
                      style={[styles.storeChip, active ? styles.storeChipActive : null]}
                      activeOpacity={0.9}
                      onPress={() => handleSelectStore(store.storeId)}
                    >
                      <Text style={[styles.storeChipText, active ? styles.storeChipTextActive : null]} numberOfLines={1}>
                        {store.storeName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionSubTitle}>현재 등록된 사진 URL</Text>
              <View style={styles.previewList}>
                {(selectedStore?.imageUrls.length ? selectedStore.imageUrls : ['등록된 사진이 없습니다.']).map((uri: string) => (
                  <PhotoPreview key={uri} uri={uri} />
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>새 사진 URL 입력</Text>
              <Text style={styles.helperText}>이미지 업로드 연결 전에는 URL 목록을 줄바꿈으로 입력할 수 있어요.</Text>
              <TextInput
                style={styles.textArea}
                value={imageUrls}
                onChangeText={setImageUrls}
                multiline
                placeholder="https://..."
                placeholderTextColor="#94a3b8"
              />
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
  previewList: { gap: 8 },
  previewItem: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbeff0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  previewText: { color: '#334155', fontSize: 12 },
  textArea: {
    minHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#0f172a',
    textAlignVertical: 'top',
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
