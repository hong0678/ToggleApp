import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ownerApi, tokenStore } from '@/services/api';
import type {
  OwnerApplicationSummaryResponse,
  OwnerLinkedStoreResponse,
  StoreClosureRequestResponse,
} from '@/services/api/owner';

function GatePanel({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  return (
    <View style={styles.gateCard}>
      <View style={styles.gateIconWrap}>
        <Ionicons name="lock-closed-outline" size={24} color="#18a5a5" />
      </View>
      <Text style={styles.gateTitle}>당일 로그는 로그인 후 확인할 수 있어요</Text>
      <Text style={styles.gateSubtitle}>점주 계정으로 로그인하면 신청, 매장 상태, 종료 요청을 한 화면에서 확인할 수 있어요.</Text>
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

function SectionHeader({ title, count, onRefresh }: { title: string; count: string; onRefresh?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionCount}>{count}</Text>
      </View>
      {onRefresh ? (
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} activeOpacity={0.85}>
          <Ionicons name="refresh" size={16} color="#18a5a5" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statusPill}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue}>{value}</Text>
    </View>
  );
}

function ApplicationRow({ item }: { item: OwnerApplicationSummaryResponse }) {
  return (
    <View style={styles.rowCard}>
      <View style={styles.rowHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.storeName}
          </Text>
          <Text style={styles.rowSub}>{item.businessAddressRaw}</Text>
        </View>
        <View style={styles.rowBadge}>
          <Text style={styles.rowBadgeText}>{item.requestStatus}</Text>
        </View>
      </View>

      <Text style={styles.rowMeta}>
        사업자 {item.businessVerificationStatus} · 지도 {item.mapVerificationStatus}
      </Text>
      <Text style={styles.rowMeta}>신청일 {item.submittedAt}</Text>
      {item.reviewedAt ? <Text style={styles.rowMeta}>처리일 {item.reviewedAt}</Text> : null}
      {item.rejectReason ? <Text style={styles.rejectReason}>반려 사유: {item.rejectReason}</Text> : null}
    </View>
  );
}

function StoreRow({ store, active, onPress }: { store: OwnerLinkedStoreResponse; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.storeChip, active ? styles.storeChipActive : null]} onPress={onPress} activeOpacity={0.9}>
      <Text style={[styles.storeChipName, active ? styles.storeChipNameActive : null]} numberOfLines={1}>
        {store.storeName}
      </Text>
      <Text style={[styles.storeChipStatus, active ? styles.storeChipStatusActive : null]} numberOfLines={1}>
        {store.liveBusinessStatus ?? '상태 없음'}
      </Text>
    </TouchableOpacity>
  );
}

export default function OwnerDailyLogScreen() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [applications, setApplications] = useState<OwnerApplicationSummaryResponse[]>([]);
  const [stores, setStores] = useState<OwnerLinkedStoreResponse[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [latestClosure, setLatestClosure] = useState<StoreClosureRequestResponse | null>(null);

  const selectedStore = useMemo(
    () => stores.find((item) => item.storeId === selectedStoreId) ?? null,
    [selectedStoreId, stores]
  );

  const loadLatestClosure = useCallback(async (storeId: number | null) => {
    if (!storeId) {
      setLatestClosure(null);
      return;
    }

    try {
      const response = await ownerApi.getLatestClosureRequest(storeId);
      setLatestClosure(response);
    } catch {
      setLatestClosure(null);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const token = await tokenStore.getAccessToken();
      setIsLoggedIn(Boolean(token));

      if (!token) {
        setApplications([]);
        setStores([]);
        setSelectedStoreId(null);
        setLatestClosure(null);
        return;
      }

      const [applicationsResponse, storesResponse] = await Promise.all([
        ownerApi.listApplications(),
        ownerApi.listStores(),
      ]);

      setApplications(applicationsResponse);
      setStores(storesResponse);

      const nextSelectedStoreId = storesResponse[0]?.storeId ?? null;
      setSelectedStoreId((current) => {
        if (current && storesResponse.some((store) => store.storeId === current)) {
          return current;
        }
        return nextSelectedStoreId;
      });

      await loadLatestClosure(
        selectedStoreId && storesResponse.some((store) => store.storeId === selectedStoreId)
          ? selectedStoreId
          : nextSelectedStoreId
      );
    } catch (error) {
      Alert.alert('불러오기 실패', error instanceof Error ? error.message : '당일 로그를 불러오지 못했어요.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [loadLatestClosure, selectedStoreId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSelectStore = async (storeId: number) => {
    setSelectedStoreId(storeId);
    await loadLatestClosure(storeId);
  };

  const todayLabel = new Date().toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  return (
    <LinearGradient colors={['#f2f4f6', '#eef1f5', '#f9fafb']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.replace(isLoggedIn ? '/views/owner_dashboard' : '/views/owner_login')}
            style={styles.backButton}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={28} color="#f9fafb" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>당일 로그</Text>
            <Text style={styles.headerSubTitle}>오늘의 신청과 연결된 매장 상태를 한 번에 봐요</Text>
          </View>
          <TouchableOpacity onPress={() => void load()} style={styles.headerAction} activeOpacity={0.8} disabled={isRefreshing}>
            {isRefreshing ? <ActivityIndicator color="#18a5a5" /> : <Ionicons name="refresh" size={22} color="#18a5a5" />}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {!isLoggedIn ? (
            <GatePanel onLogin={() => router.replace('/views/owner_login')} onSignup={() => router.replace('/views/owner_signup')} />
          ) : isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#18a5a5" />
              <Text style={styles.loadingText}>당일 로그를 불러오는 중...</Text>
            </View>
          ) : (
            <>
              <View style={styles.heroCard}>
                <View style={styles.heroBadge}>
                  <Ionicons name="today-outline" size={14} color="#18a5a5" />
                  <Text style={styles.heroBadgeText}>{todayLabel}</Text>
                </View>
                <Text style={styles.heroTitle}>오늘 점주 활동을 모아봤어요</Text>
                <Text style={styles.heroSubtitle}>
                  전용 로그 API는 없어서, 신청 현황과 연결 매장, 종료 요청 정보를 묶어서 보여줘요.
                </Text>
              </View>

              <View style={styles.summaryGrid}>
                <StatusPill label="신청" value={`${applications.length}건`} />
                <StatusPill label="승인" value={`${applications.filter((item) => item.requestStatus === 'APPROVED').length}건`} />
                <StatusPill label="매장" value={`${stores.length}곳`} />
                <StatusPill label="종료" value={latestClosure?.status ?? '없음'} />
              </View>

              <View style={styles.sectionCard}>
                <SectionHeader title="오늘 신청" count={`${applications.length}건`} onRefresh={() => void load()} />
                {applications.length === 0 ? (
                  <Text style={styles.emptyText}>오늘 확인할 신청이 없어요.</Text>
                ) : (
                  <View style={styles.listGap}>
                    {applications.slice(0, 6).map((item) => (
                      <ApplicationRow key={item.applicationId} item={item} />
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.sectionCard}>
                <SectionHeader title="연결된 매장" count={`${stores.length}곳`} />
                {stores.length === 0 ? (
                  <Text style={styles.emptyText}>연결된 매장이 없어요.</Text>
                ) : (
                  <>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storeChipRow}>
                      {stores.map((store) => (
                        <StoreRow
                          key={store.storeId}
                          store={store}
                          active={selectedStoreId === store.storeId}
                          onPress={() => void handleSelectStore(store.storeId)}
                        />
                      ))}
                    </ScrollView>
                    {selectedStore ? (
                      <View style={styles.detailBox}>
                        <Text style={styles.detailTitle}>{selectedStore.storeName}</Text>
                        <Text style={styles.detailText}>{selectedStore.storeAddress}</Text>
                        <Text style={styles.detailText}>영업 상태 {selectedStore.liveBusinessStatus ?? '상태 없음'}</Text>
                        <Text style={styles.detailText}>운영 상태 {selectedStore.operationalState ?? '상태 없음'}</Text>
                        <Text style={styles.detailText}>메뉴 가능 {selectedStore.menuEditable ? '가능' : '불가'}</Text>
                      </View>
                    ) : null}
                  </>
                )}
              </View>

              <View style={styles.sectionCard}>
                <SectionHeader title="최근 종료 요청" count={selectedStore ? selectedStore.storeName : '매장 선택 필요'} />
                {latestClosure ? (
                  <View style={styles.detailBox}>
                    <Text style={styles.detailTitle}>{latestClosure.storeName}</Text>
                    <Text style={styles.detailText}>상태 {latestClosure.status}</Text>
                    {latestClosure.reason ? <Text style={styles.detailText}>사유 {latestClosure.reason}</Text> : null}
                    {latestClosure.reviewedReason ? <Text style={styles.detailText}>검토 사유 {latestClosure.reviewedReason}</Text> : null}
                    <Text style={styles.detailText}>요청일 {latestClosure.createdAt}</Text>
                  </View>
                ) : (
                  <Text style={styles.emptyText}>최근 종료 요청이 없어요.</Text>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  backButton: { padding: 8 },
  headerAction: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#191f28' },
  headerSubTitle: { marginTop: 3, color: '#6b7684', fontSize: 12, lineHeight: 16 },
  scrollContent: { padding: 20, paddingBottom: 34, gap: 14 },
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
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e8eb',
  },
  loadingText: { color: '#6b7684', fontSize: 13, marginTop: 10 },
  heroCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e8eb',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f9fafb',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  heroBadgeText: { color: '#18a5a5', fontSize: 12, fontWeight: '800' },
  heroTitle: { fontSize: 20, fontWeight: '900', color: '#191f28', marginBottom: 8 },
  heroSubtitle: { fontSize: 13, color: '#6b7684', lineHeight: 18 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statusPill: {
    flexBasis: '48%',
    backgroundColor: '#f9fafb',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e8eb',
  },
  statusLabel: { color: '#6b7684', fontSize: 12, fontWeight: '800' },
  statusValue: { color: '#191f28', fontSize: 18, fontWeight: '900', marginTop: 6 },
  sectionCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e8eb',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: '#191f28', fontSize: 16, fontWeight: '900' },
  sectionCount: { color: '#6b7684', fontSize: 12, marginTop: 3, fontWeight: '700' },
  refreshButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#eef1f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listGap: { gap: 10 },
  rowCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e8eb',
  },
  rowHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  rowTitle: { color: '#191f28', fontSize: 15, fontWeight: '900' },
  rowSub: { color: '#6b7684', fontSize: 12, marginTop: 4 },
  rowBadge: {
    borderRadius: 999,
    backgroundColor: '#eef1f5',
    borderWidth: 1,
    borderColor: '#edf8f8',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rowBadgeText: { color: '#18a5a5', fontSize: 11, fontWeight: '800' },
  rowMeta: { marginTop: 6, color: '#4e5968', fontSize: 12, lineHeight: 18 },
  rejectReason: { marginTop: 8, color: '#dc2626', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  storeChipRow: { gap: 10, paddingBottom: 4 },
  storeChip: {
    minWidth: 120,
    borderRadius: 16,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  storeChipActive: {
    borderColor: '#18a5a5',
    backgroundColor: '#eef1f5',
  },
  storeChipName: { color: '#191f28', fontSize: 13, fontWeight: '800' },
  storeChipNameActive: { color: '#18a5a5' },
  storeChipStatus: { color: '#6b7684', fontSize: 11, marginTop: 4, fontWeight: '700' },
  storeChipStatusActive: { color: '#18a5a5' },
  detailBox: {
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 14,
  },
  detailTitle: { color: '#191f28', fontSize: 15, fontWeight: '900' },
  detailText: { marginTop: 4, color: '#4e5968', fontSize: 12, lineHeight: 18 },
  emptyText: { color: '#6b7684', fontSize: 13, lineHeight: 18 },
});
