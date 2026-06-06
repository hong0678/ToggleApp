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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OwnerStorePicker } from '@/components/owner-store-picker';
import { useSafeBack } from '@/components/use-safe-back';
import { getScreenContentStyle } from '@/components/screen-layout';
import { ownerApi, tokenStore } from '@/services/api';
import type { OwnerLinkedStoreResponse } from '@/services/api/owner';

type StatusOption = 'OPEN' | 'BREAK_TIME' | 'CLOSED' | 'TEMP_CLOSED' | 'EARLY_CLOSED';

const STATUS_OPTIONS: { label: string; value: StatusOption; description: string }[] = [
  { label: '영업중', value: 'OPEN', description: '현재 영업 중으로 표시' },
  { label: '브레이크타임', value: 'BREAK_TIME', description: '잠시 쉬는 시간으로 표시' },
  { label: '영업종료', value: 'CLOSED', description: '현재 영업 종료로 표시' },
  { label: '임시휴무', value: 'TEMP_CLOSED', description: '잠시 운영을 멈춘 상태로 표시' },
  { label: '조기마감', value: 'EARLY_CLOSED', description: '조기 종료 상태로 표시' },
];

function GatePanel({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  return (
    <View style={styles.gateCard}>
      <View style={styles.gateIconWrap}>
        <Ionicons name="lock-closed-outline" size={24} color="#18a5a5" />
      </View>
      <Text style={styles.gateTitle}>실시간 상태 관리는 로그인 후 가능해요</Text>
      <Text style={styles.gateSubtitle}>점주 계정으로 로그인하면 연결된 매장의 영업 상태를 바꿀 수 있어요.</Text>
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

function StoreCard({
  store,
  onChangeStatus,
  onSaveNotice,
  onUnlink,
}: {
  store: OwnerLinkedStoreResponse;
  onChangeStatus: (storeId: number, status: StatusOption) => Promise<void>;
  onSaveNotice: (storeId: number, ownerNotice: string) => void;
  onUnlink: (storeId: number) => Promise<void>;
}) {
  const [comment, setComment] = useState(store.ownerNotice ?? '');

  useEffect(() => {
    setComment(store.ownerNotice ?? '');
  }, [store.ownerNotice, store.storeId]);

  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <View style={styles.storeBadge}>
          <Ionicons name="storefront-outline" size={16} color="#18a5a5" />
          <Text style={styles.storeBadgeText}>{store.categoryName ?? '카테고리 없음'}</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{store.liveBusinessStatus ?? '상태 없음'}</Text>
        </View>
      </View>

      <Text style={styles.storeName}>{store.storeName}</Text>
      <Text style={styles.storeAddress} numberOfLines={2}>{store.storeAddress}</Text>

      <View style={styles.statusButtons}>
        {STATUS_OPTIONS.map((option) => {
          const active = store.liveBusinessStatus === option.value;

          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.statusButton, active ? styles.statusButtonActive : null]}
              activeOpacity={0.9}
              onPress={async () => {
                try {
                  await onChangeStatus(store.storeId, option.value);
                  Alert.alert('상태 변경', `${store.storeName} 상태를 ${option.label}로 바꿨어요.`);
                } catch (error) {
                  Alert.alert('실패', error instanceof Error ? error.message : '상태 변경에 실패했습니다.');
                }
              }}
            >
              <View style={styles.statusButtonHeader}>
                <Text style={[styles.statusButtonLabel, active ? styles.statusButtonLabelActive : null]}>{option.label}</Text>
                {active ? (
                  <View style={styles.savedBadge}>
                    <Ionicons name="checkmark" size={12} color="#18a5a5" />
                    <Text style={styles.savedBadgeText}>저장됨</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.statusButtonSub, active ? styles.statusButtonSubActive : null]}>{option.description}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.noticeBox}>
        <View style={styles.noticeBoxHeader}>
          <Ionicons name="chatbubble-outline" size={16} color="#18a5a5" />
          <Text style={styles.noticeLabel}>안내 문구</Text>
        </View>
        <TextInput
          style={styles.noticeInput}
          value={comment}
          onChangeText={setComment}
          placeholder="예: 재료 소진으로 잠시 닫아요"
          placeholderTextColor="#8b95a1"
          multiline
        />
        <TouchableOpacity
          style={styles.noticeButton}
          activeOpacity={0.9}
          onPress={async () => {
            try {
              await ownerApi.updateStoreProfile(store.storeId, {
                ownerNotice: comment.trim(),
                openTime: store.openTime ?? '',
                closeTime: store.closeTime ?? '',
                breakStart: store.breakStart ?? '',
                breakEnd: store.breakEnd ?? '',
                imageUrls: store.imageUrls,
              });
              onSaveNotice(store.storeId, comment.trim());
              Alert.alert('저장 완료', '안내 문구를 저장했어요.');
            } catch (error) {
              Alert.alert('실패', error instanceof Error ? error.message : '안내 문구 저장에 실패했습니다.');
            }
          }}
        >
          <Text style={styles.noticeButtonText}>안내 문구 저장</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.unlinkButton}
        activeOpacity={0.9}
        onPress={() => {
          Alert.alert('연결 해제', `${store.storeName}과의 점주 연결을 해제할까요?`, [
            { text: '취소', style: 'cancel' },
            {
              text: '해제',
              style: 'destructive',
              onPress: async () => {
                try {
                  await onUnlink(store.storeId);
                  Alert.alert('연결 해제', '점주 연결을 해제했어요.');
                } catch (error) {
                  Alert.alert('실패', error instanceof Error ? error.message : '연결 해제에 실패했습니다.');
                }
              },
            },
          ]);
        }}
      >
        <Ionicons name="unlink-outline" size={16} color="#ef4444" />
        <Text style={styles.unlinkButtonText}>연결 해제</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function OwnerStatusManageScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/views/owner_dashboard');
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ storeId?: string | string[] }>();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stores, setStores] = useState<OwnerLinkedStoreResponse[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const requestedStoreId = Array.isArray(params.storeId) ? params.storeId[0] : params.storeId;

  useEffect(() => {
    let active = true;

    const load = async () => {
      const token = await tokenStore.getAccessToken();
      if (!active) return;

      setIsLoggedIn(Boolean(token));
      if (!token) {
        setStores([]);
        setIsLoading(false);
        return;
      }

      try {
        const response = await ownerApi.listStores();
        if (!active) return;
        const requestedId = requestedStoreId ? Number(requestedStoreId) : null;
        const orderedStores =
          requestedId && response.some((store) => store.storeId === requestedId)
            ? [...response.filter((store) => store.storeId === requestedId), ...response.filter((store) => store.storeId !== requestedId)]
            : response;
        setStores(orderedStores);
        setSelectedStoreId(orderedStores[0]?.storeId ?? null);
      } catch {
        if (!active) return;
        setStores([]);
        setSelectedStoreId(null);
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

  const changeStatus = async (storeId: number, status: StatusOption) => {
    await ownerApi.updateStoreStatus(storeId, { status });
    const response = await ownerApi.listStores();
    setStores(response);
  };

  const unlinkStore = async (storeId: number) => {
    await ownerApi.unlinkStore(storeId);
    const response = await ownerApi.listStores();
    setStores(response);
    setSelectedStoreId((current) => {
      if (current && response.some((store) => store.storeId === current)) {
        return current;
      }
      return response[0]?.storeId ?? null;
    });
  };

  const updateStoreNotice = (storeId: number, ownerNotice: string) => {
    setStores((current) => current.map((store) => (
      store.storeId === storeId ? { ...store, ownerNotice } : store
    )));
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, getScreenContentStyle(insets)]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={goBack} style={styles.backButton} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={24} color="#18a5a5" />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>실시간 상태 관리</Text>
            <Text style={styles.headerSubtitle}>연결된 매장의 영업 상태와 안내 문구를 바꿀 수 있어요.</Text>
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
            <Ionicons name="storefront-outline" size={28} color="#8b95a1" />
            <Text style={styles.emptyTitle}>연결된 매장이 없어요</Text>
            <Text style={styles.emptySubtitle}>매장 등록 신청 후 점주 매장이 연결되면 상태를 관리할 수 있어요.</Text>
          </View>
        ) : (
          <>
            <OwnerStorePicker
              stores={stores}
              selectedStoreId={selectedStoreId}
              selectedStore={selectedStore}
              onSelect={setSelectedStoreId}
            />
            {selectedStore ? (
              <StoreCard
                key={selectedStore.storeId}
                store={selectedStore}
                onChangeStatus={changeStatus}
                onSaveNotice={updateStoreNotice}
                onUnlink={unlinkStore}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fa' },
  scrollContent: { paddingHorizontal: 18 },
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
  list: { gap: 12 },
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e8eb',
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  storeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eef1f5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  storeBadgeText: { color: '#18a5a5', fontSize: 12, fontWeight: '800' },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#eef1f5',
  },
  statusPillText: { color: '#4e5968', fontSize: 12, fontWeight: '800' },
  storeName: { fontSize: 19, fontWeight: '900', color: '#191f28', marginTop: 12 },
  storeAddress: { marginTop: 8, color: '#6b7684', fontSize: 13, lineHeight: 18 },
  statusButtons: { gap: 10, marginTop: 14 },
  statusButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statusButtonActive: {
    borderColor: '#18a5a5',
    backgroundColor: '#edf8f8',
  },
  statusButtonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  statusButtonLabel: { color: '#191f28', fontSize: 15, fontWeight: '800', marginBottom: 4 },
  statusButtonLabelActive: { color: '#18a5a5' },
  statusButtonSub: { color: '#6b7684', fontSize: 12 },
  statusButtonSubActive: { color: '#0f766e' },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#99f6e4',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  savedBadgeText: { color: '#18a5a5', fontSize: 11, fontWeight: '900' },
  noticeBox: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#eef1f5',
    padding: 14,
  },
  noticeBoxHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  noticeLabel: { color: '#191f28', fontSize: 13, fontWeight: '800' },
  noticeInput: {
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#191f28',
    textAlignVertical: 'top',
  },
  noticeButton: {
    marginTop: 10,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#18a5a5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeButtonText: { color: '#f9fafb', fontSize: 14, fontWeight: '800' },
  unlinkButton: {
    marginTop: 12,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  unlinkButtonText: { color: '#ef4444', fontSize: 14, fontWeight: '800' },
});
