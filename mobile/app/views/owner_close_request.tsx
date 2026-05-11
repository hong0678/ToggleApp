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
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ownerApi, tokenStore } from '@/services/api';
import type { OwnerLinkedStoreResponse } from '@/services/api/owner';

function GatePanel({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  return (
    <View style={styles.gateCard}>
      <View style={styles.gateIconWrap}>
        <Ionicons name="lock-closed-outline" size={24} color="#0ea5a4" />
      </View>
      <Text style={styles.gateTitle}>운영 종료 요청은 로그인 후 가능해요</Text>
      <Text style={styles.gateSubtitle}>점주 계정으로 로그인하면 매장별 종료 요청을 남길 수 있어요.</Text>
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

export default function OwnerCloseRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ storeId?: string | string[] }>();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stores, setStores] = useState<OwnerLinkedStoreResponse[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [effectiveAt, setEffectiveAt] = useState('');
  const [latestText, setLatestText] = useState('최근 요청을 아직 불러오지 못했어요.');
  const [isSubmitting, setIsSubmitting] = useState(false);
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

        if (first) {
          try {
            const latest = await ownerApi.getLatestClosureRequest(first.storeId);
            if (!active) return;
            setLatestText(latest
              ? `${latest.storeName} · ${latest.status}${latest.reason ? `\n${latest.reason}` : ''}`
              : '최근 요청이 없습니다.'
            );
          } catch {
            if (!active) return;
            setLatestText('최근 요청을 불러오지 못했어요.');
          }
        }
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

  const handleSubmit = async () => {
    if (!selectedStoreId) {
      Alert.alert('매장 선택', '먼저 매장을 선택해주세요.');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('사유 입력', '운영 종료 사유를 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      await ownerApi.createClosureRequest(selectedStoreId, {
        reason: reason.trim(),
        effectiveAt: effectiveAt.trim() || undefined,
      });
      const latest = await ownerApi.getLatestClosureRequest(selectedStoreId);
      setLatestText(latest ? `${latest.storeName} · ${latest.status}${latest.reason ? `\n${latest.reason}` : ''}` : '최근 요청이 없습니다.');
      Alert.alert('요청 완료', '운영 종료 요청이 접수되었어요.');
    } catch (error) {
      Alert.alert('실패', error instanceof Error ? error.message : '운영 종료 요청에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
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
            <Text style={styles.headerTitle}>운영 종료 요청</Text>
            <Text style={styles.headerSubtitle}>영업을 잠시 또는 완전히 종료해야 할 때 요청할 수 있어요.</Text>
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
            <Ionicons name="close-circle-outline" size={28} color="#94a3b8" />
            <Text style={styles.emptyTitle}>연결된 매장이 없어요</Text>
            <Text style={styles.emptySubtitle}>매장 등록이 승인되면 운영 종료 요청을 보낼 수 있어요.</Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>대상 매장</Text>
              <View style={styles.storeChips}>
                {stores.map((store) => {
                  const active = selectedStoreId === store.storeId;
                  return (
                    <TouchableOpacity
                      key={store.storeId}
                      style={[styles.storeChip, active ? styles.storeChipActive : null]}
                      activeOpacity={0.9}
                      onPress={() => setSelectedStoreId(store.storeId)}
                    >
                      <Text style={[styles.storeChipText, active ? styles.storeChipTextActive : null]} numberOfLines={1}>
                        {store.storeName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.inputBlock}>
                <Text style={styles.fieldLabel}>종료 사유</Text>
                <TextInput
                  style={styles.textArea}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="예: 재정비를 위해 잠시 문을 닫습니다."
                  placeholderTextColor="#94a3b8"
                  multiline
                />
              </View>

              <View style={styles.inputBlock}>
                <Text style={styles.fieldLabel}>희망 종료 시각</Text>
                <TextInput
                  style={styles.input}
                  value={effectiveAt}
                  onChangeText={setEffectiveAt}
                  placeholder="예: 2026-05-10 18:00"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit} activeOpacity={0.9} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>종료 요청하기</Text>
                    <Ionicons name="chevron-forward" size={18} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>최근 요청</Text>
              <Text style={styles.latestText}>{latestText}</Text>
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
  storeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
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
  inputBlock: { marginBottom: 14 },
  fieldLabel: { color: '#0f172a', fontSize: 13, fontWeight: '800', marginBottom: 8 },
  input: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    color: '#0f172a',
  },
  textArea: {
    minHeight: 90,
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
    marginTop: 4,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#0ea5a4',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  latestText: { color: '#334155', fontSize: 13, lineHeight: 20 },
});
