import React, { useEffect, useState } from 'react';
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

type StatusOption = 'OPEN' | 'CLOSED' | 'TEMP_CLOSED' | 'EARLY_CLOSED';

const STATUS_OPTIONS: { label: string; value: StatusOption; description: string }[] = [
  { label: '영업중', value: 'OPEN', description: '현재 영업 중으로 표시' },
  { label: '영업종료', value: 'CLOSED', description: '현재 영업 종료로 표시' },
  { label: '임시휴무', value: 'TEMP_CLOSED', description: '잠시 운영을 멈춘 상태로 표시' },
  { label: '조기마감', value: 'EARLY_CLOSED', description: '조기 종료 상태로 표시' },
];

function GatePanel({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  return (
    <View style={styles.gateCard}>
      <View style={styles.gateIconWrap}>
        <Ionicons name="lock-closed-outline" size={24} color="#0ea5a4" />
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
}: {
  store: OwnerLinkedStoreResponse;
  onChangeStatus: (storeId: number, status: StatusOption) => Promise<void>;
}) {
  const [comment, setComment] = useState(store.ownerNotice ?? '');

  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <View style={styles.storeBadge}>
          <Ionicons name="storefront-outline" size={16} color="#0ea5a4" />
          <Text style={styles.storeBadgeText}>{store.categoryName ?? '카테고리 없음'}</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{store.liveBusinessStatus ?? '상태 없음'}</Text>
        </View>
      </View>

      <Text style={styles.storeName}>{store.storeName}</Text>
      <Text style={styles.storeAddress} numberOfLines={2}>{store.storeAddress}</Text>

      <View style={styles.statusButtons}>
        {STATUS_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={styles.statusButton}
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
            <Text style={styles.statusButtonLabel}>{option.label}</Text>
            <Text style={styles.statusButtonSub}>{option.description}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.noticeBox}>
        <View style={styles.noticeBoxHeader}>
          <Ionicons name="chatbubble-outline" size={16} color="#0ea5a4" />
          <Text style={styles.noticeLabel}>안내 문구</Text>
        </View>
        <TextInput
          style={styles.noticeInput}
          value={comment}
          onChangeText={setComment}
          placeholder="예: 재료 소진으로 잠시 닫아요"
          placeholderTextColor="#94a3b8"
          multiline
        />
        <TouchableOpacity
          style={styles.noticeButton}
          activeOpacity={0.9}
          onPress={async () => {
            try {
              await ownerApi.updateStoreProfile(store.storeId, { ownerNotice: comment.trim() });
              Alert.alert('저장 완료', '안내 문구를 저장했어요.');
            } catch (error) {
              Alert.alert('실패', error instanceof Error ? error.message : '안내 문구 저장에 실패했습니다.');
            }
          }}
        >
          <Text style={styles.noticeButtonText}>안내 문구 저장</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function OwnerStatusManageScreen() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stores, setStores] = useState<OwnerLinkedStoreResponse[]>([]);

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
        setStores(response);
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

  const changeStatus = async (storeId: number, status: StatusOption) => {
    await ownerApi.updateStoreStatus(storeId, { status });
    const response = await ownerApi.listStores();
    setStores(response);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={24} color="#0ea5a4" />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>실시간 상태 관리</Text>
            <Text style={styles.headerSubtitle}>연결된 매장의 영업 상태와 안내 문구를 바꿀 수 있어요.</Text>
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
            <Ionicons name="storefront-outline" size={28} color="#94a3b8" />
            <Text style={styles.emptyTitle}>연결된 매장이 없어요</Text>
            <Text style={styles.emptySubtitle}>매장 등록 신청 후 점주 매장이 연결되면 상태를 관리할 수 있어요.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {stores.map((store) => (
              <StoreCard key={store.storeId} store={store} onChangeStatus={changeStatus} />
            ))}
          </View>
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
  list: { gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  storeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eefafa',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  storeBadgeText: { color: '#0ea5a4', fontSize: 12, fontWeight: '800' },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
  },
  statusPillText: { color: '#334155', fontSize: 12, fontWeight: '800' },
  storeName: { fontSize: 19, fontWeight: '900', color: '#0f172a', marginTop: 12 },
  storeAddress: { marginTop: 8, color: '#64748b', fontSize: 13, lineHeight: 18 },
  statusButtons: { gap: 10, marginTop: 14 },
  statusButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbeff0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statusButtonLabel: { color: '#0f172a', fontSize: 15, fontWeight: '800', marginBottom: 4 },
  statusButtonSub: { color: '#64748b', fontSize: 12 },
  noticeBox: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbeff0',
    backgroundColor: '#eefafa',
    padding: 14,
  },
  noticeBoxHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  noticeLabel: { color: '#0f172a', fontSize: 13, fontWeight: '800' },
  noticeInput: {
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbeff0',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
    textAlignVertical: 'top',
  },
  noticeButton: {
    marginTop: 10,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#0ea5a4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
