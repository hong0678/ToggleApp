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
        <Ionicons name="lock-closed-outline" size={24} color="#0ea5a4" />
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

function StorePicker({
  stores,
  selectedStoreId,
  onSelect,
}: {
  stores: OwnerLinkedStoreResponse[];
  selectedStoreId: number | null;
  onSelect: (storeId: number) => void;
}) {
  return (
    <View style={styles.pickerCard}>
      <Text style={styles.sectionTitle}>연결된 매장</Text>
      <View style={styles.pickerList}>
        {stores.map((store) => {
          const active = selectedStoreId === store.storeId;

          return (
            <TouchableOpacity
              key={store.storeId}
              style={[styles.pickerItem, active ? styles.pickerItemActive : null]}
              onPress={() => onSelect(store.storeId)}
              activeOpacity={0.9}
            >
              <Text style={[styles.pickerItemTitle, active ? styles.pickerItemTitleActive : null]} numberOfLines={1}>
                {store.storeName}
              </Text>
              <Text style={[styles.pickerItemSub, active ? styles.pickerItemSubActive : null]}>
                {store.categoryName ?? '카테고리 없음'}
              </Text>
            </TouchableOpacity>
          );
        })}
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
        placeholderTextColor="#94a3b8"
      />
    </View>
  );
}

export default function OwnerHoursManageScreen() {
  const router = useRouter();
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
          <TouchableOpacity onPress={() => router.replace('/views/owner_dashboard')} style={styles.backButton} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={24} color="#0ea5a4" />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>운영시간 관리</Text>
            <Text style={styles.headerSubtitle}>내 매장의 안내 문구와 운영 시간을 수정해요.</Text>
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
            <Ionicons name="time-outline" size={28} color="#94a3b8" />
            <Text style={styles.emptyTitle}>연결된 매장이 없어요</Text>
            <Text style={styles.emptySubtitle}>매장 등록 신청이 승인되면 운영시간을 관리할 수 있어요.</Text>
          </View>
        ) : (
          <>
            <StorePicker stores={stores} selectedStoreId={selectedStoreId} onSelect={handleSelectStore} />

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
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>수정하기</Text>
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
  pickerCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a', marginBottom: 12 },
  pickerList: { gap: 10 },
  pickerItem: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbeff0',
    backgroundColor: '#f8fafc',
    padding: 14,
  },
  pickerItemActive: {
    borderColor: '#0ea5a4',
    backgroundColor: '#eefafa',
  },
  pickerItemTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  pickerItemTitleActive: { color: '#0ea5a4' },
  pickerItemSub: { marginTop: 4, fontSize: 12, color: '#64748b' },
  pickerItemSubActive: { color: '#0ea5a4' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  selectedStoreName: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginBottom: 12 },
  fieldBlock: { marginBottom: 14 },
  fieldLabel: { color: '#0f172a', fontSize: 13, fontWeight: '800', marginBottom: 8 },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    color: '#0f172a',
  },
  primaryButton: {
    marginTop: 8,
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
