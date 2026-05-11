import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import type { OwnerApplicationSummaryResponse } from '@/services/api/owner';

function LoginGatePanel({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  return (
    <View style={styles.gateCard}>
      <View style={styles.gateIconWrap}>
        <Ionicons name="lock-closed-outline" size={24} color="#0ea5a4" />
      </View>
      <Text style={styles.gateTitle}>신청 현황을 보려면 로그인하세요</Text>
      <Text style={styles.gateSubtitle}>점주 계정으로 로그인하면 신청 상태와 심사 결과를 확인할 수 있어요.</Text>
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

function ApplicationCard({ item }: { item: OwnerApplicationSummaryResponse }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <View>
          <Text style={styles.storeName} numberOfLines={1}>{item.storeName}</Text>
          <Text style={styles.metaText}>{item.businessNumber}</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{item.requestStatus}</Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <Ionicons name="person-outline" size={16} color="#94a3b8" />
        <Text style={styles.infoText} numberOfLines={1}>{item.ownerNickname || item.ownerEmail}</Text>
      </View>
      <View style={styles.infoRow}>
        <Ionicons name="location-outline" size={16} color="#94a3b8" />
        <Text style={styles.infoText} numberOfLines={2}>{item.businessAddressRaw}</Text>
      </View>
      <View style={styles.infoRow}>
        <Ionicons name="calendar-outline" size={16} color="#94a3b8" />
        <Text style={styles.infoText}>신청: {item.submittedAt}</Text>
      </View>
      <View style={styles.infoRow}>
        <Ionicons name="checkmark-circle-outline" size={16} color="#94a3b8" />
        <Text style={styles.infoText}>
          사업자 {item.businessVerificationStatus} · 지도 {item.mapVerificationStatus}
        </Text>
      </View>

      {item.rejectReason ? (
        <View style={styles.rejectBox}>
          <Text style={styles.rejectLabel}>반려 사유</Text>
          <Text style={styles.rejectText}>{item.rejectReason}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function OwnerRegisterStatusScreen() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<OwnerApplicationSummaryResponse[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const token = await tokenStore.getAccessToken();
      if (!active) return;

      setIsLoggedIn(Boolean(token));
      if (!token) {
        setItems([]);
        setIsLoading(false);
        return;
      }

      try {
        const response = await ownerApi.listApplications();
        if (!active) return;
        setItems(response);
      } catch {
        if (!active) return;
        setItems([]);
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

  return (
    <LinearGradient colors={['#f7fbff', '#eefafa', '#ffffff']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/views/owner_dashboard')} style={styles.backButton} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={24} color="#0ea5a4" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>신청 현황</Text>
          <TouchableOpacity onPress={() => router.replace('/views/owner_login')} style={styles.headerAction} activeOpacity={0.8}>
            <Ionicons name="person-outline" size={20} color="#0ea5a4" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.heroCard}>
            <View style={styles.heroBadge}>
              <Ionicons name="list-outline" size={14} color="#0ea5a4" />
              <Text style={styles.heroBadgeText}>Owner</Text>
            </View>
            <Text style={styles.heroTitle}>등록 신청을 한눈에 확인해요</Text>
            <Text style={styles.heroSubtitle}>진행중, 반려, 승인된 신청 상태를 순서대로 볼 수 있습니다.</Text>
          </View>

          {!isLoggedIn ? (
            <LoginGatePanel
              onLogin={() => router.push('/views/owner_login')}
              onSignup={() => router.push('/views/owner_signup')}
            />
          ) : isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#0ea5a4" />
              <Text style={styles.loadingText}>신청 현황을 불러오는 중...</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="document-text-outline" size={28} color="#94a3b8" />
              <Text style={styles.emptyTitle}>신청 내역이 없어요</Text>
              <Text style={styles.emptySubtitle}>매장 등록 신청을 먼저 진행하면 여기서 확인할 수 있어요.</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/views/owner_store_register')} activeOpacity={0.9}>
                <Text style={styles.primaryButtonText}>매장 등록 신청</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.list}>
              {items.map((item) => (
                <ApplicationCard key={item.applicationId} item={item} />
              ))}
            </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  headerAction: { padding: 6 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eefafa',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  heroBadgeText: { color: '#0ea5a4', fontSize: 12, fontWeight: '800' },
  heroTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a', marginBottom: 8 },
  heroSubtitle: { fontSize: 13, color: '#64748b', lineHeight: 18 },
  gateCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#dbeff0',
    marginTop: 8,
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
  primaryButton: {
    marginTop: 16,
    height: 48,
    borderRadius: 16,
    paddingHorizontal: 18,
    backgroundColor: '#0ea5a4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  list: { gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  storeName: { fontSize: 17, fontWeight: '900', color: '#0f172a', flex: 1 },
  metaText: { marginTop: 4, color: '#64748b', fontSize: 12 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#eefafa',
  },
  statusPillText: { color: '#0ea5a4', fontSize: 12, fontWeight: '800' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 },
  infoText: { flex: 1, color: '#475569', fontSize: 13, lineHeight: 18 },
  rejectBox: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: '#fff7f7',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 12,
  },
  rejectLabel: { color: '#dc2626', fontSize: 12, fontWeight: '800', marginBottom: 6 },
  rejectText: { color: '#7f1d1d', fontSize: 13, lineHeight: 18 },
});
