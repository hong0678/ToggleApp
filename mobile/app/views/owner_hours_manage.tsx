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
import { useLocalSearchParams, useRouter } from 'expo-router';

import { OwnerStorePicker } from '@/components/owner-store-picker';
import { useSafeBack } from '@/components/use-safe-back';
import { ownerApi, tokenStore } from '@/services/api';
import type { OwnerLinkedStoreResponse } from '@/services/api/owner';

type FormState = {
  ownerNotice: string;
  openTime: string;
  closeTime: string;
  breakStart: string;
  breakEnd: string;
};

const EMPTY_FORM: FormState = {
  ownerNotice: '',
  openTime: '',
  closeTime: '',
  breakStart: '',
  breakEnd: '',
};

function GatePanel({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  return (
    <View style={styles.gateCard}>
      <View style={styles.gateIconWrap}>
        <Ionicons name="lock-closed-outline" size={24} color="#18a5a5" />
      </View>
      <Text style={styles.gateTitle}>운영시간 관리는 로그인 후 가능해요</Text>
      <Text style={styles.gateSubtitle}>점주 계정으로 로그인하면 내 매장의 운영 시간을 바로 바꿀 수 있어요.</Text>
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

function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8b95a1"
      />
    </View>
  );
}

export default function OwnerHoursManageScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/views/owner_dashboard');
  const params = useLocalSearchParams<{ storeId?: string | string[] }>();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stores, setStores] = useState<OwnerLinkedStoreResponse[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const requestedStoreId = Array.isArray(params.storeId) ? params.storeId[0] : params.storeId;

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
        setForm({
          ownerNotice: first?.ownerNotice ?? '',
          openTime: first?.openTime ?? '',
          closeTime: first?.closeTime ?? '',
          breakStart: first?.breakStart ?? '',
          breakEnd: first?.breakEnd ?? '',
        });
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

  const updateField = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSelectStore = (storeId: number) => {
    const store = stores.find((item) => item.storeId === storeId);
    if (!store) return;

    setSelectedStoreId(storeId);
    setForm({
      ownerNotice: store.ownerNotice ?? '',
      openTime: store.openTime ?? '',
      closeTime: store.closeTime ?? '',
      breakStart: store.breakStart ?? '',
      breakEnd: store.breakEnd ?? '',
    });
  };

  const handleSave = async () => {
    if (!selectedStore) {
      Alert.alert('매장 선택', '먼저 매장을 선택해주세요.');
      return;
    }

    try {
      setIsSaving(true);
      await ownerApi.updateStoreProfile(selectedStore.storeId, {
        ownerNotice: form.ownerNotice.trim(),
        openTime: form.openTime.trim(),
        closeTime: form.closeTime.trim(),
        breakStart: form.breakStart.trim(),
        breakEnd: form.breakEnd.trim(),
        imageUrls: selectedStore.imageUrls,
      });
      const refreshed = await ownerApi.listStores();
      setStores(refreshed);
      Alert.alert('저장 완료', '운영시간 정보가 저장되었어요.');
    } catch (error) {
      Alert.alert('저장 실패', error instanceof Error ? error.message : '운영시간 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={goBack} style={styles.backButton} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={24} color="#18a5a5" />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>운영시간 관리</Text>
            <Text style={styles.headerSubtitle}>내 매장의 안내 문구와 운영 시간을 수정해요.</Text>
          </View>
        </View>

        {!isLoggedIn ? (
          <GatePanel onLogin={() => router.replace('/views/owner_login')} onSignup={() => router.replace('/views/owner_signup')} />
        ) : isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#18a5a5" />
            <Text style={styles.loadingText}>매장 정보를 불러오는 중...</Text>
          </View>
        ) : stores.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="time-outline" size={28} color="#8b95a1" />
            <Text style={styles.emptyTitle}>연결된 매장이 없어요</Text>
            <Text style={styles.emptySubtitle}>매장 등록 신청이 승인되면 운영시간을 관리할 수 있어요.</Text>
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
              <Text style={styles.sectionTitle}>선택된 매장</Text>
              <Text style={styles.selectedStoreName} numberOfLines={1}>
                {selectedStore?.storeName ?? '매장을 선택해주세요'}
              </Text>

              <Field label="안내 문구" value={form.ownerNotice} onChangeText={(value) => updateField('ownerNotice', value)} placeholder="예: 재료 소진 시 조기 마감합니다." />
              <Field label="오픈 시간" value={form.openTime} onChangeText={(value) => updateField('openTime', value)} placeholder="예: 09:00" />
              <Field label="마감 시간" value={form.closeTime} onChangeText={(value) => updateField('closeTime', value)} placeholder="예: 21:00" />
              <Field label="휴게 시작" value={form.breakStart} onChangeText={(value) => updateField('breakStart', value)} placeholder="예: 14:00" />
              <Field label="휴게 종료" value={form.breakEnd} onChangeText={(value) => updateField('breakEnd', value)} placeholder="예: 15:00" />

              <TouchableOpacity style={styles.primaryButton} onPress={handleSave} activeOpacity={0.9} disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator color="#f9fafb" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>수정하기</Text>
                    <Ionicons name="chevron-forward" size={18} color="#f9fafb" />
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
  container: { flex: 1, backgroundColor: '#f7f8fa' },
  scrollContent: { padding: 20, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  backButton: { paddingTop: 4, paddingRight: 4 },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#191f28' },
  headerSubtitle: { marginTop: 6, color: '#6b7684', fontSize: 13, lineHeight: 18 },
  gateCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e8eb',
  },
  gateIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eef1f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  gateTitle: { fontSize: 18, fontWeight: '900', color: '#191f28', marginBottom: 8 },
  gateSubtitle: { fontSize: 13, color: '#6b7684', lineHeight: 18 },
  gateButtons: { flexDirection: 'row', gap: 10, marginTop: 18 },
  gateSecondaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  gateSecondaryButtonText: { color: '#18a5a5', fontSize: 15, fontWeight: '800' },
  gatePrimaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18a5a5',
  },
  gatePrimaryButtonText: { color: '#f9fafb', fontSize: 15, fontWeight: '800' },
  loadingCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: '#6b7684', fontSize: 13, fontWeight: '600' },
  emptyCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e8eb',
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#191f28', marginTop: 10 },
  emptySubtitle: { fontSize: 13, color: '#6b7684', textAlign: 'center', marginTop: 8, lineHeight: 18 },
  pickerCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#191f28', marginBottom: 12 },
  pickerList: { gap: 10 },
  pickerItem: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    padding: 14,
  },
  pickerItemActive: {
    borderColor: '#18a5a5',
    backgroundColor: '#eef1f5',
  },
  pickerItemTitle: { fontSize: 15, fontWeight: '800', color: '#191f28' },
  pickerItemTitleActive: { color: '#18a5a5' },
  pickerItemSub: { marginTop: 4, fontSize: 12, color: '#6b7684' },
  pickerItemSubActive: { color: '#18a5a5' },
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e8eb',
  },
  selectedStoreName: { fontSize: 18, fontWeight: '900', color: '#191f28', marginBottom: 12 },
  fieldBlock: { marginBottom: 14 },
  fieldLabel: { color: '#191f28', fontSize: 13, fontWeight: '800', marginBottom: 8 },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 14,
    color: '#191f28',
  },
  primaryButton: {
    marginTop: 8,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#18a5a5',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  primaryButtonText: { color: '#f9fafb', fontSize: 16, fontWeight: '800' },
});
