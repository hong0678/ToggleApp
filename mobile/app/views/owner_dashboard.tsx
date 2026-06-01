import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';

import { ownerApi, tokenStore } from '@/services/api';
import type { OwnerApplicationSummaryResponse, OwnerLinkedStoreResponse } from '@/services/api/owner';

type DashboardStats = {
  applications: OwnerApplicationSummaryResponse[];
  stores: OwnerLinkedStoreResponse[];
};

function GatePanel({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  return (
    <View style={styles.gateCard}>
      <View style={styles.gateIconWrap}>
        <Ionicons name="lock-closed-outline" size={24} color="#18a5a5" />
      </View>
      <Text style={styles.gateTitle}>점주 대시보드는 로그인 후 볼 수 있어요</Text>
      <Text style={styles.gateSubtitle}>점주 계정으로 로그인하면 신청 현황, 연결된 매장, 상태 관리 메뉴를 볼 수 있어요.</Text>
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

function StoreChip({
  store,
  active,
  onPress,
}: {
  store: OwnerLinkedStoreResponse;
  active?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <View style={[styles.storeChip, active ? styles.storeChipActive : null]}>
      <View style={styles.storeChipTopRow}>
        <Text style={[styles.storeChipName, active ? styles.storeChipNameActive : null]} numberOfLines={1}>
          {store.storeName}
        </Text>
        {active ? (
          <View style={styles.storeChipSelected}>
            <Ionicons name="checkmark" size={12} color="#18a5a5" />
          </View>
        ) : null}
      </View>
      <Text style={[styles.storeChipStatus, active ? styles.storeChipStatusActive : null]} numberOfLines={1}>
        {store.liveBusinessStatus ?? '상태 없음'}
      </Text>
      <Text style={[styles.storeChipAddress, active ? styles.storeChipAddressActive : null]} numberOfLines={2}>
        {store.storeAddress ?? '주소 정보 없음'}
      </Text>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      {content}
    </TouchableOpacity>
  );
}

export default function OwnerDashboardScreen() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    applications: [],
    stores: [],
  });
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);

  const menuItems: { title: string; route: Href; icon: keyof typeof Ionicons.glyphMap }[] = [
    { title: '실시간 상태 관리', route: '/views/owner_status_manage', icon: 'time-outline' },
    { title: '운영시간 관리', route: '/views/owner_hours_manage', icon: 'calendar-outline' },
    { title: '메뉴 관리', route: '/views/owner_menu_manage', icon: 'restaurant-outline' },
    { title: '매장 사진 관리', route: '/views/owner_photos_manage', icon: 'image-outline' },
    { title: '당일 로그', route: '/views/owner_daily_log', icon: 'document-text-outline' },
    { title: '매장 등록 신청', route: '/views/owner_store_register', icon: 'add-circle-outline' },
    { title: '신청 현황', route: '/views/owner_register_status', icon: 'list-circle-outline' },
    { title: '매장 삭제 요청', route: '/views/owner_close_request', icon: 'close-circle-outline' },
  ];

  const storeManagementItems = menuItems.filter((item) =>
    ['실시간 상태 관리', '운영시간 관리', '메뉴 관리', '매장 사진 관리', '매장 삭제 요청'].includes(item.title)
  );
  const generalItems = menuItems.filter((item) => ['당일 로그', '매장 등록 신청', '신청 현황'].includes(item.title));

  useEffect(() => {
    let active = true;

    const load = async () => {
      const token = await tokenStore.getAccessToken();
      if (!active) return;

      setIsLoggedIn(Boolean(token));
      if (!token) {
        setStats({ applications: [], stores: [] });
        setIsLoading(false);
        return;
      }

      const [applicationsResult, storesResult] = await Promise.allSettled([
        ownerApi.listApplications(),
        ownerApi.listStores(),
      ]);

      if (!active) return;

      setStats({
        applications: applicationsResult.status === 'fulfilled' ? applicationsResult.value : [],
        stores: storesResult.status === 'fulfilled' ? storesResult.value : [],
      });
      setSelectedStoreId((current) => {
        const nextStores = storesResult.status === 'fulfilled' ? storesResult.value : [];
        if (current && nextStores.some((store) => store.storeId === current)) {
          return current;
        }
        return nextStores[0]?.storeId ?? null;
      });
      setIsLoading(false);
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const latestApplication = stats.applications[0] ?? null;
  const selectedStore = stats.stores.find((store) => store.storeId === selectedStoreId) ?? stats.stores[0] ?? null;

  const handleLogout = async () => {
    await tokenStore.clear();
    router.replace('/views/owner_login');
  };

  const managementRoute = (path: Href): Href =>
    (selectedStoreId ? (`${path}?storeId=${selectedStoreId}` as Href) : path);

  return (
    <LinearGradient colors={['#f2f4f6', '#eef1f5', '#f9fafb']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/')} style={styles.headerIconButton} activeOpacity={0.8}>
            <Ionicons name="home-outline" size={24} color="#18a5a5" />
          </TouchableOpacity>
          <View style={styles.headerBrand}>
            <Image source={require('@/assets/images/mainLogo.png')} style={styles.logo} />
            <Text style={styles.headerLabel}>Owner Dashboard</Text>
          </View>
          <TouchableOpacity onPress={() => void handleLogout()} style={styles.headerIconButton} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={24} color="#18a5a5" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#18a5a5" />
              <Text style={styles.loadingText}>점주 정보를 불러오는 중...</Text>
            </View>
          ) : !isLoggedIn ? (
            <GatePanel onLogin={() => router.replace('/views/owner_login')} onSignup={() => router.replace('/views/owner_signup')} />
          ) : (
            <>
              <View style={styles.heroCard}>
                <View style={styles.heroHeader}>
                  <View>
                    <Text style={styles.heroLabel}>현재 선택된 매장</Text>
                    <Text style={styles.heroTitle} numberOfLines={1}>
                      {selectedStore?.storeName ?? '매장을 선택해 주세요'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.heroBadge}
                    onPress={() => router.push('/views/owner_register_status')}
                    activeOpacity={0.9}
                  >
                    <Ionicons name="list-outline" size={14} color="#18a5a5" />
                    <Text style={styles.heroBadgeText}>{stats.applications.length}건 신청</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.heroSubtitle}>
                  {selectedStore
                    ? `${selectedStore.liveBusinessStatus ?? '상태 없음'} · ${selectedStore.storeAddress ?? '주소 정보 없음'}`
                    : '매장을 선택하면 상태, 운영시간, 메뉴, 사진, 삭제 요청을 바로 관리할 수 있어요.'}
                </Text>
              </View>

              {stats.stores.length > 0 ? (
                <View style={styles.storeSelectorCard}>
                  <View style={styles.featureHeader}>
                    <Text style={styles.featureTitle}>관리할 매장 선택</Text>
                    <Text style={styles.featureLink}>{selectedStore?.storeName ?? '선택 필요'}</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storeChipRow}>
                    {stats.stores.map((store) => {
                      const active = selectedStoreId === store.storeId;

                      return (
                        <StoreChip
                          key={store.storeId}
                          store={store}
                          active={active}
                          onPress={() => setSelectedStoreId(store.storeId)}
                        />
                      );
                    })}
                  </ScrollView>
                  <Text style={styles.managementHint}>매장을 바꾸면 아래 관리 버튼들이 선택한 매장 기준으로 동작해요.</Text>
                </View>
              ) : null}

              <View style={styles.featureCard}>
                <View style={styles.featureHeader}>
                  <Text style={styles.featureTitle}>매장 관리</Text>
                  <Text style={styles.featureLink}>{selectedStore ? selectedStore.storeName : '매장 선택 필요'}</Text>
                </View>
                <View style={styles.managementGrid}>
                  {storeManagementItems.map((item) => {
                    const storeDependent = true;

                    return (
                      <TouchableOpacity
                        key={item.title}
                        style={[styles.managementButton, !selectedStoreId && storeDependent ? styles.managementButtonDisabled : null]}
                        disabled={!selectedStoreId && storeDependent}
                        onPress={() => router.push(managementRoute(item.route))}
                        activeOpacity={0.9}
                      >
                        <Ionicons name={item.icon} size={20} color="#18a5a5" />
                        <Text style={styles.managementButtonText}>{item.title}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {!selectedStoreId ? (
                  <Text style={styles.managementHint}>먼저 매장을 선택하면 상태, 운영시간, 메뉴, 사진, 삭제 요청을 바로 관리할 수 있어요.</Text>
                ) : null}
              </View>

              <View style={styles.featureCard}>
                <View style={styles.featureHeader}>
                  <Text style={styles.featureTitle}>점주 기능</Text>
                  <Text style={styles.featureLink}>로그 / 신청</Text>
                </View>
                <View style={styles.managementGrid}>
                  {generalItems.map((item) => (
                    <TouchableOpacity
                      key={item.title}
                      style={styles.utilityButton}
                      onPress={() => router.push(item.route)}
                      activeOpacity={0.9}
                    >
                      <Ionicons name={item.icon} size={20} color="#18a5a5" />
                      <Text style={styles.managementButtonText}>{item.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {latestApplication ? (
                <View style={styles.featureCard}>
                  <View style={styles.featureHeader}>
                    <Text style={styles.featureTitle}>최근 신청</Text>
                    <TouchableOpacity onPress={() => router.push('/views/owner_register_status')} activeOpacity={0.8}>
                      <Text style={styles.featureLink}>전체보기</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.featureName} numberOfLines={1}>
                    {latestApplication.storeName}
                  </Text>
                  <Text style={styles.featureMeta}>
                    {latestApplication.requestStatus} · 사업자 {latestApplication.businessVerificationStatus} · 지도 {latestApplication.mapVerificationStatus}
                  </Text>
                  <Text style={styles.featureSub}>
                    신청일 {latestApplication.submittedAt}
                  </Text>
                </View>
              ) : null}

              {stats.stores.length > 0 ? (
                <View style={styles.featureCard}>
                <View style={styles.featureHeader}>
                  <Text style={styles.featureTitle}>내 매장</Text>
                  <TouchableOpacity onPress={() => router.push('/views/owner_status_manage')} activeOpacity={0.8}>
                    <Text style={styles.featureLink}>관리하기</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.storeList}>
                    {stats.stores.slice(0, 3).map((store) => (
                      <StoreChip key={store.storeId} store={store} />
                    ))}
                </View>
                </View>
              ) : null}
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerIconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 90, height: 28, resizeMode: 'contain' },
  headerLabel: { color: '#6b7684', fontSize: 12, fontWeight: '700' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  heroCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    marginBottom: 14,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroLabel: {
    color: '#6b7684',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  heroTitle: { color: '#191f28', fontSize: 22, fontWeight: '900' },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#edf8f8',
    backgroundColor: '#eef1f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroBadgeText: { color: '#18a5a5', fontSize: 12, fontWeight: '800' },
  heroSubtitle: { marginTop: 10, color: '#6b7684', fontSize: 13, lineHeight: 18 },
  loadingCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e8eb',
  },
  loadingText: { color: '#6b7684', fontSize: 13, fontWeight: '600' },
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
  storeSelectorCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    marginBottom: 14,
  },
  storeChipRow: { gap: 10, paddingTop: 10, paddingRight: 4 },
  storeChipActive: {
    borderColor: '#18a5a5',
    backgroundColor: '#e9fffd',
  },
  storeChipNameActive: { color: '#18a5a5' },
  storeChipStatusActive: { color: '#18a5a5' },
  storeChipAddressActive: { color: '#18a5a5' },
  featureCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    marginBottom: 12,
  },
  featureHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  featureTitle: { color: '#191f28', fontSize: 15, fontWeight: '900' },
  featureLink: { color: '#18a5a5', fontSize: 13, fontWeight: '800' },
  featureName: { color: '#191f28', fontSize: 19, fontWeight: '900' },
  featureMeta: { color: '#4e5968', fontSize: 13, marginTop: 8, lineHeight: 18 },
  featureSub: { color: '#6b7684', fontSize: 12, marginTop: 6 },
  managementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  managementButton: {
    width: '48%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#edf8f8',
    backgroundColor: '#eef1f5',
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  managementButtonDisabled: { opacity: 0.45 },
  managementButtonText: {
    color: '#191f28',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  utilityButton: {
    width: '31%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#edf8f8',
    backgroundColor: '#eef1f5',
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  managementHint: {
    marginTop: 10,
    color: '#6b7684',
    fontSize: 12,
    lineHeight: 17,
  },
  storeList: { gap: 10 },
  storeChip: {
    width: 200,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginRight: 2,
  },
  storeChipTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  storeChipSelected: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#edf8f8',
  },
  storeChipName: { color: '#191f28', fontSize: 14, fontWeight: '800', flex: 1 },
  storeChipStatus: { color: '#6b7684', fontSize: 12, marginTop: 4, fontWeight: '700' },
  storeChipAddress: { color: '#8b95a1', fontSize: 11, marginTop: 6, lineHeight: 15 },
});
