import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { useSafeBack } from '@/components/use-safe-back';
import { adminApi } from '@/services/api';
import type { OwnerApplicationDetailResponse, OwnerApplicationSummaryResponse } from '@/services/api/owner';

type StatusTone = {
  backgroundColor: string;
  color: string;
  borderColor: string;
};

const STATUS_TONES: Record<string, StatusTone> = {
  SUCCESS: { backgroundColor: '#edf8f8', color: '#18a5a5', borderColor: '#edf8f8' },
  FAILED: { backgroundColor: '#fee2e2', color: '#dc2626', borderColor: '#fecaca' },
  PENDING: { backgroundColor: '#fef3c7', color: '#b45309', borderColor: '#fde68a' },
  UNDER_REVIEW: { backgroundColor: '#e0f2fe', color: '#0284c7', borderColor: '#bae6fd' },
  APPROVED: { backgroundColor: '#edf8f8', color: '#18a5a5', borderColor: '#edf8f8' },
  REJECTED: { backgroundColor: '#fee2e2', color: '#dc2626', borderColor: '#fecaca' },
  AUTO_VERIFICATION_FAILED: { backgroundColor: '#fee2e2', color: '#dc2626', borderColor: '#fecaca' },
  AUTO_VERIFICATION_UNAVAILABLE: { backgroundColor: '#f3f4f6', color: '#6b7684', borderColor: '#e5e8eb' },
};

function statusTone(status: string | null | undefined): StatusTone {
  if (!status) {
    return STATUS_TONES.PENDING;
  }

  return STATUS_TONES[status] ?? STATUS_TONES.PENDING;
}

function StatusPill({ label, status }: { label: string; status: string | null | undefined }) {
  const tone = statusTone(status);
  return (
    <View style={[styles.statusPill, { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor }]}>
      <Text style={[styles.statusLabel, { color: tone.color }]}>{label}</Text>
      <Text style={[styles.statusValue, { color: tone.color }]}>{status ?? 'PENDING'}</Text>
    </View>
  );
}

function HistoryCard({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: Record<string, unknown>[];
  emptyText: string;
}) {
  const latest = items[0] ?? null;
  const latestStatus = latest ? String(latest.status ?? latest.verificationStatus ?? '') : '';
  const latestMessage = latest ? String(latest.failureMessage ?? latest.reason ?? '') : '';

  return (
    <View style={styles.historyCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionMore}>{items.length}개</Text>
      </View>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>{emptyText}</Text>
      ) : (
        <View style={styles.historyBody}>
          <Text style={styles.historyStatus}>최근 결과: {latestStatus || '확인 필요'}</Text>
          {latestMessage ? <Text style={styles.historyMessage}>{latestMessage}</Text> : null}
        </View>
      )}
    </View>
  );
}

type ApplicationCardMode = 'review' | 'registered';
type ApplicationSection = 'review' | 'registered' | 'rejected';

function ApplicationCard({
  item,
  mode,
  isSelected,
  onSelect,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
  showActions = true,
}: {
  item: OwnerApplicationSummaryResponse;
  mode: ApplicationCardMode;
  isSelected: boolean;
  onSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
  isApproving?: boolean;
  isRejecting?: boolean;
  showActions?: boolean;
}) {
  const isRegistered = mode === 'registered';
  const tagLabel = isRegistered ? '등록 완료' : item.requestStatus;

  return (
    <TouchableOpacity
      style={[styles.applicationCard, isRegistered ? styles.applicationCardRegistered : null, isSelected ? styles.applicationCardSelected : null]}
      activeOpacity={0.88}
      onPress={onSelect}
    >
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.storeName} numberOfLines={1}>
            {item.storeName}
          </Text>
          <Text style={styles.ownerName}>{item.ownerNickname ?? item.ownerEmail}</Text>
        </View>
        <View style={[styles.cardTag, isRegistered ? styles.cardTagRegistered : null]}>
          <Text style={[styles.cardTagText, isRegistered ? styles.cardTagRegisteredText : null]}>{tagLabel}</Text>
        </View>
      </View>

      <Text style={styles.metaText} numberOfLines={2}>
        {item.businessAddressRaw}
      </Text>

      <View style={styles.statusRow}>
        <StatusPill label="사업자" status={item.businessVerificationStatus} />
        <StatusPill label="지도" status={item.mapVerificationStatus} />
      </View>

      <View style={styles.cardFooterRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={onSelect} activeOpacity={0.85}>
          <Text style={styles.secondaryButtonText}>상세 보기</Text>
        </TouchableOpacity>
        {showActions ? (
          isRegistered ? (
            <View style={styles.registeredButton}>
              <Text style={styles.registeredButtonText}>매장 등록 된 곳</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, isApproving ? styles.primaryButtonDisabled : null]}
              onPress={onApprove}
              activeOpacity={0.85}
              disabled={Boolean(isApproving)}
            >
              {isApproving ? (
                <ActivityIndicator color="#f9fafb" />
              ) : (
                <Text style={styles.primaryButtonText}>매장 등록</Text>
              )}
            </TouchableOpacity>
          )
        ) : (
          <View style={styles.registeredButton}>
            <Text style={styles.registeredButtonText}>처리 내역</Text>
          </View>
        )}
      </View>

      {showActions ? (
        <TouchableOpacity
          style={[styles.dangerButton, isRejecting ? styles.primaryButtonDisabled : null]}
          onPress={onReject}
          activeOpacity={0.85}
          disabled={Boolean(isRejecting)}
        >
          {isRejecting ? (
            <ActivityIndicator color="#dc2626" />
          ) : (
            <Text style={styles.dangerButtonText}>삭제</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

export default function AdminOwnerApplicationsScreen() {
  const goBack = useSafeBack('/views/user_login');
  const [applications, setApplications] = useState<OwnerApplicationSummaryResponse[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<OwnerApplicationDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isApproving, setIsApproving] = useState<number | null>(null);
  const [isRejecting, setIsRejecting] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<ApplicationSection>('review');

  const selectedApplication = useMemo(
    () => applications.find((item) => item.applicationId === selectedApplicationId) ?? null,
    [applications, selectedApplicationId]
  );
  const registeredApplications = useMemo(
    () => applications.filter((item) => item.requestStatus === 'APPROVED'),
    [applications]
  );
  const rejectedApplications = useMemo(
    () => applications.filter((item) => item.requestStatus === 'REJECTED'),
    [applications]
  );
  const reviewApplications = useMemo(
    () => applications.filter((item) => item.requestStatus === 'PENDING' || item.requestStatus === 'UNDER_REVIEW'),
    [applications]
  );
  const visibleApplications = useMemo(() => {
    if (activeSection === 'registered') return registeredApplications;
    if (activeSection === 'rejected') return rejectedApplications;
    return reviewApplications;
  }, [activeSection, registeredApplications, rejectedApplications, reviewApplications]);
  const visibleSectionTitle = activeSection === 'registered'
    ? '등록 완료'
    : activeSection === 'rejected'
      ? '반려/삭제'
      : '검토 중';
  const visibleSectionCount = visibleApplications.length;

  const loadApplications = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await adminApi.listApplications();
      setApplications(response);
      setSelectedApplicationId((current) => {
        if (current && response.some((item) => item.applicationId === current)) {
          return current;
        }
        return response[0]?.applicationId ?? null;
      });
    } catch (error) {
      Alert.alert('불러오기 실패', error instanceof Error ? error.message : '신청 목록을 불러오지 못했어요.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (applicationId: number) => {
    try {
      setIsDetailLoading(true);
      const response = await adminApi.getApplication(applicationId);
      setSelectedDetail(response);
    } catch (error) {
      setSelectedDetail(null);
      Alert.alert('상세 조회 실패', error instanceof Error ? error.message : '신청 상세를 불러오지 못했어요.');
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadApplications();
    }, [loadApplications])
  );

  useEffect(() => {
    if (selectedApplicationId == null) {
      setSelectedDetail(null);
      return;
    }

    void loadDetail(selectedApplicationId);
  }, [loadDetail, selectedApplicationId]);

  const handleApprove = async (applicationId: number) => {
    const target = applications.find((item) => item.applicationId === applicationId);
    if (!target) {
      return;
    }

    try {
      setIsApproving(applicationId);
      await adminApi.approve(applicationId, { adminConfirmed: true });
      Alert.alert('등록 완료', '매장 등록이 처리되었어요.');
      await loadApplications();
      await loadDetail(applicationId);
    } catch (error) {
      Alert.alert('등록 실패', error instanceof Error ? error.message : '매장 등록 처리 중 문제가 발생했어요.');
    } finally {
      setIsApproving(null);
    }
  };

  const handleReject = async (applicationId: number) => {
    try {
      setIsRejecting(applicationId);
      await adminApi.reject(applicationId, { reason: '관리자 검토에 따른 삭제' });
      Alert.alert('삭제 완료', '신청이 반려되었어요.');
      await loadApplications();
      await loadDetail(applicationId);
    } catch (error) {
      Alert.alert('삭제 실패', error instanceof Error ? error.message : '신청 반려 중 문제가 발생했어요.');
    } finally {
      setIsRejecting(null);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.hero}>
            <View style={styles.heroTopRow}>
              <TouchableOpacity onPress={goBack} style={styles.backButton} activeOpacity={0.8}>
                <Ionicons name="chevron-back" size={24} color="#18a5a5" />
              </TouchableOpacity>
              <TouchableOpacity onPress={loadApplications} style={styles.refreshButton} activeOpacity={0.85}>
                <Ionicons name="refresh" size={18} color="#18a5a5" />
              </TouchableOpacity>
            </View>
            <Text style={styles.title}>관리자 신청 검토</Text>
            <Text style={styles.subtitle}>점주 신청 목록과 사업자 검증, 지도 검증 상태를 확인하고 매장 등록을 처리해요.</Text>

            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{applications.length}</Text>
                <Text style={styles.summaryLabel}>전체 신청</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>
                  {applications.filter((item) => item.requestStatus === 'PENDING' || item.requestStatus === 'UNDER_REVIEW').length}
                </Text>
                <Text style={styles.summaryLabel}>검토 중</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>
                  {registeredApplications.length}
                </Text>
                <Text style={styles.summaryLabel}>등록 완료</Text>
              </View>
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#18a5a5" />
            </View>
          ) : applications.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>신청 들어온 내역이 없어요</Text>
              <Text style={styles.emptyText}>점주가 매장 등록을 신청하면 여기에 목록이 보여요.</Text>
            </View>
          ) : (
            <View style={styles.sectionBlocks}>
              <View style={styles.sectionTabs}>
                <TouchableOpacity
                  style={[styles.sectionTab, activeSection === 'review' ? styles.sectionTabActive : null]}
                  onPress={() => setActiveSection('review')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.sectionTabText, activeSection === 'review' ? styles.sectionTabTextActive : null]}>
                    검토 중
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sectionTab, activeSection === 'registered' ? styles.sectionTabActive : null]}
                  onPress={() => setActiveSection('registered')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.sectionTabText, activeSection === 'registered' ? styles.sectionTabTextActive : null]}>
                    등록 완료
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sectionTab, activeSection === 'rejected' ? styles.sectionTabActive : null]}
                  onPress={() => setActiveSection('rejected')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.sectionTabText, activeSection === 'rejected' ? styles.sectionTabTextActive : null]}>
                    반려/삭제
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.listSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>{visibleSectionTitle}</Text>
                  <Text style={styles.sectionMore}>{visibleSectionCount}개</Text>
                </View>
                {visibleApplications.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>
                      {activeSection === 'review'
                        ? '검토 중인 신청이 없어요.'
                        : activeSection === 'registered'
                          ? '등록 완료된 신청이 없어요.'
                          : '반려/삭제된 신청이 없어요.'}
                    </Text>
                  </View>
                ) : (
                  visibleApplications.map((application) => (
                    <ApplicationCard
                      key={application.applicationId}
                      item={application}
                      mode={activeSection === 'registered' ? 'registered' : 'review'}
                      isSelected={application.applicationId === selectedApplicationId}
                      onSelect={() => setSelectedApplicationId(application.applicationId)}
                      onApprove={() => void handleApprove(application.applicationId)}
                      onReject={() => void handleReject(application.applicationId)}
                      isApproving={isApproving === application.applicationId}
                      isRejecting={isRejecting === application.applicationId}
                      showActions={activeSection !== 'rejected'}
                    />
                  ))
                )}
              </View>
            </View>
          )}

          {selectedApplication ? (
            <View style={styles.detailCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>선택한 신청</Text>
                <Text style={styles.sectionMore}>#{selectedApplication.applicationId}</Text>
              </View>

              <Text style={styles.detailTitle}>{selectedApplication.storeName}</Text>
              <Text style={styles.detailText}>{selectedApplication.ownerEmail}</Text>
              <Text style={styles.detailText}>{selectedApplication.businessNumber}</Text>
              <Text style={styles.detailText}>{selectedApplication.businessPhone}</Text>

              {isDetailLoading ? (
                <View style={styles.loadingDetailBox}>
                  <ActivityIndicator color="#18a5a5" />
                </View>
              ) : selectedDetail ? (
                <>
                  <View style={styles.urlBox}>
                    <Text style={styles.urlTitle}>사업자등록증 파일</Text>
                    <Text style={styles.urlText} numberOfLines={2}>
                      {selectedDetail.application.businessLicenseObjectKey ?? '첨부 없음'}
                    </Text>
                    {selectedDetail.businessLicensePresignedUrl ? (
                      <TouchableOpacity
                        style={styles.urlButton}
                        onPress={() => void Linking.openURL(selectedDetail.businessLicensePresignedUrl ?? '')}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.urlButtonText}>파일 보기</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <HistoryCard
                    title="사업자 검증 결과"
                    items={selectedDetail.businessVerificationHistories}
                    emptyText="사업자 검증 기록이 아직 없어요."
                  />
                  <HistoryCard
                    title="지도 검증 결과"
                    items={selectedDetail.mapVerificationHistories}
                    emptyText="지도 검증 기록이 아직 없어요."
                  />

                  <View style={styles.detailActionRow}>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => setSelectedApplicationId(selectedApplication.applicationId)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.secondaryButtonText}>선택 유지</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.primaryButton, isApproving === selectedApplication.applicationId ? styles.primaryButtonDisabled : null]}
                      onPress={() => void handleApprove(selectedApplication.applicationId)}
                      activeOpacity={0.85}
                      disabled={isApproving === selectedApplication.applicationId}
                    >
                      {isApproving === selectedApplication.applicationId ? (
                        <ActivityIndicator color="#f9fafb" />
                      ) : (
                        <Text style={styles.primaryButtonText}>매장 등록</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.dangerButton, isRejecting === selectedApplication.applicationId ? styles.primaryButtonDisabled : null]}
                    onPress={() => void handleReject(selectedApplication.applicationId)}
                    activeOpacity={0.85}
                    disabled={isRejecting === selectedApplication.applicationId}
                  >
                    {isRejecting === selectedApplication.applicationId ? (
                      <ActivityIndicator color="#dc2626" />
                    ) : (
                      <Text style={styles.dangerButtonText}>삭제</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.loadingDetailBox}>
                  <Text style={styles.emptyText}>상세 정보를 불러오지 못했어요.</Text>
                </View>
              )}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f6' },
  scrollContent: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 32 },
  hero: {
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 16,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButton: { padding: 4 },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eef1f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '900', color: '#191f28' },
  subtitle: { marginTop: 6, color: '#6b7684', fontSize: 13, lineHeight: 18 },
  summaryRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  summaryCard: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 12,
  },
  summaryValue: { fontSize: 20, fontWeight: '900', color: '#191f28' },
  summaryLabel: { marginTop: 4, fontSize: 12, fontWeight: '700', color: '#6b7684' },
  loadingCard: {
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    marginBottom: 16,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    marginBottom: 16,
  },
  emptyTitle: { color: '#191f28', fontSize: 16, fontWeight: '900', marginBottom: 6 },
  emptyText: { color: '#6b7684', fontSize: 13, lineHeight: 18 },
  sectionBlocks: { gap: 16, marginBottom: 16 },
  sectionTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  sectionTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTabActive: {
    borderColor: '#18a5a5',
    backgroundColor: '#edf8f8',
  },
  sectionTabText: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '800',
  },
  sectionTabTextActive: {
    color: '#18a5a5',
  },
  listSection: { gap: 12, marginBottom: 16 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  applicationCard: {
    borderRadius: 20,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 16,
  },
  applicationCardRegistered: {
    backgroundColor: '#f8fffe',
  },
  applicationCardSelected: {
    borderColor: '#18a5a5',
    backgroundColor: '#f8fffe',
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  cardTitleWrap: { flex: 1 },
  storeName: { color: '#191f28', fontSize: 18, fontWeight: '900' },
  ownerName: { marginTop: 4, color: '#6b7684', fontSize: 12, fontWeight: '700' },
  cardTag: {
    borderRadius: 999,
    backgroundColor: '#eef1f5',
    borderWidth: 1,
    borderColor: '#edf8f8',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cardTagRegistered: {
    backgroundColor: '#edf8f8',
    borderColor: '#9ee7e4',
  },
  cardTagText: { color: '#18a5a5', fontSize: 11, fontWeight: '800' },
  cardTagRegisteredText: { color: '#059669', fontSize: 11, fontWeight: '800' },
  metaText: { marginTop: 12, color: '#4e5968', fontSize: 13, lineHeight: 18 },
  statusRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  statusPill: {
    minWidth: 112,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statusPillApproved: { backgroundColor: '#edf8f8', borderColor: '#edf8f8' },
  statusLabel: { fontSize: 11, fontWeight: '800' },
  statusValue: { marginTop: 4, fontSize: 13, fontWeight: '900' },
  cardFooterRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  detailActionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  secondaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cfe8e8',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: '#18a5a5', fontSize: 14, fontWeight: '800' },
  primaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#18a5a5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: { opacity: 0.55 },
  primaryButtonText: { color: '#f9fafb', fontSize: 14, fontWeight: '800' },
  registeredButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#9ee7e4',
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  registeredButtonText: { color: '#059669', fontSize: 14, fontWeight: '800' },
  dangerButton: {
    marginTop: 10,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonText: { color: '#dc2626', fontSize: 14, fontWeight: '800' },
  detailCard: {
    borderRadius: 20,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 16,
    marginBottom: 20,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { color: '#191f28', fontSize: 16, fontWeight: '900' },
  sectionMore: { color: '#6b7684', fontSize: 12, fontWeight: '700' },
  detailTitle: { color: '#191f28', fontSize: 18, fontWeight: '900' },
  detailText: { marginTop: 4, color: '#6b7684', fontSize: 13 },
  urlBox: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 14,
  },
  urlTitle: { color: '#191f28', fontSize: 14, fontWeight: '900', marginBottom: 6 },
  urlText: { color: '#4e5968', fontSize: 13, lineHeight: 18 },
  urlButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: 12,
    backgroundColor: '#eef1f5',
    borderWidth: 1,
    borderColor: '#edf8f8',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  urlButtonText: { color: '#18a5a5', fontSize: 13, fontWeight: '800' },
  historyCard: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 14,
  },
  historyBody: { gap: 6 },
  historyStatus: { color: '#191f28', fontSize: 13, fontWeight: '800' },
  historyMessage: { color: '#6b7684', fontSize: 12, lineHeight: 17 },
  loadingDetailBox: {
    marginTop: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
