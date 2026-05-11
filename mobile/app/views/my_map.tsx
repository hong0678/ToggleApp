import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { AppBottomNav } from '@/components/app-bottom-nav';
import { authApi, myMapApi, storesApi, tokenStore, type StoreLookupItemResponse } from '@/services/api';

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIconWrap}>
        <Ionicons name={icon} size={18} color="#0ea5a4" />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionCard({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.actionIconWrap}>
        <Ionicons name={icon} size={22} color="#0ea5a4" />
      </View>
      <View style={styles.actionTextWrap}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#0ea5a4" />
    </TouchableOpacity>
  );
}

function SavedStoreCard({
  place,
  onPressDetail,
  onPressReviews,
}: {
  place: StoreLookupItemResponse;
  onPressDetail: () => void;
  onPressReviews: () => void;
}) {
  const isServiceStore = Boolean(
    place.verified
    || place.liveBusinessStatus
    || place.businessStatus
    || place.operationalState
    || place.ownerNotice
    || place.openTime
    || place.closeTime
    || place.breakStart
    || place.breakEnd
    || place.menuEligible
    || place.menuEditable
    || (place.imageUrls?.length ?? 0) > 0
  );

  return (
    <View style={styles.savedStoreCard}>
      <View style={styles.savedStoreTopRow}>
        <View style={styles.savedStoreBadge}>
          <Ionicons name="bookmark-outline" size={14} color="#0ea5a4" />
          <Text style={styles.savedStoreBadgeText}>{place.categoryName ?? '저장한 장소'}</Text>
        </View>
        <Text style={styles.savedStoreCountText}>찜 {place.favoriteCount}</Text>
      </View>
      <Text style={styles.savedStoreName}>{place.name}</Text>
      <Text style={styles.savedStoreAddress}>
        {place.roadAddress ?? place.address ?? place.jibunAddress ?? '주소 정보 없음'}
      </Text>
      <View style={styles.savedStoreMetaRow}>
        <View style={styles.savedStoreMetaItem}>
          <Ionicons name="heart" size={12} color="#ff4d74" />
          <Text style={styles.savedStoreMetaText}>{place.reviewCount}개 리뷰</Text>
        </View>
        <View style={styles.savedStoreMetaItem}>
          <Ionicons name="location-outline" size={12} color="#94a3b8" />
          <Text style={styles.savedStoreMetaText}>
            {place.liveBusinessStatus ?? place.businessStatus ?? (isServiceStore ? place.operationalState ?? '우리 서비스 매장' : '상태 정보 없음')}
          </Text>
        </View>
      </View>
      <View style={styles.savedStoreActionRow}>
        {isServiceStore ? (
          <TouchableOpacity style={styles.savedStoreDetailButton} onPress={onPressDetail} activeOpacity={0.9}>
            <Text style={styles.savedStoreDetailButtonText}>상세 보기</Text>
            <Ionicons name="chevron-forward" size={14} color="#2563eb" />
          </TouchableOpacity>
        ) : null}
        {isServiceStore ? (
          <TouchableOpacity style={styles.savedStoreActionButton} onPress={onPressReviews} activeOpacity={0.9}>
            <Text style={styles.savedStoreActionButtonText}>리뷰 보기</Text>
            <Ionicons name="chevron-forward" size={14} color="#0ea5a4" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function LoginGatePanel({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  return (
    <View style={styles.gateCard}>
      <View style={styles.gateIconWrap}>
        <Ionicons name="lock-closed-outline" size={24} color="#0ea5a4" />
      </View>
      <Text style={styles.gateTitle}>내 지도를 보려면 로그인하세요</Text>
      <Text style={styles.gateSubtitle}>저장한 장소와 공개 지도를 확인하고 관리할 수 있어요.</Text>
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

export default function MyMapScreen() {
  const router = useRouter();
  const segments = useSegments();
  const showInternalTabBar = segments[0] !== '(tabs)';
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accountRole, setAccountRole] = useState<'USER' | 'OWNER' | 'ADMIN' | null>(null);
  const [storeCount, setStoreCount] = useState(0);
  const [publicCount, setPublicCount] = useState(0);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [savedStores, setSavedStores] = useState<StoreLookupItemResponse[]>([]);

  const loadMyMapState = useCallback(async () => {
    const token = await tokenStore.getAccessToken();
    const loggedIn = Boolean(token);
    setIsLoggedIn(loggedIn);

    if (!loggedIn) {
      setStoreCount(0);
      setPublicCount(0);
      setDisplayName(null);
      setAccountRole(null);
      setSavedStores([]);
      return;
    }

    try {
      const [meResponse, myMapResponse] = await Promise.all([
        authApi.me(),
        myMapApi.get(),
      ]);

      if (meResponse.role === 'ADMIN') {
        router.replace('/views/admin_owner_applications');
        return;
      }

      setAccountRole(meResponse.role ?? null);
      setDisplayName(meResponse.displayName ?? meResponse.nickname ?? null);
      setStoreCount(myMapResponse.stores.length);
      setPublicCount(myMapResponse.publics.length);

      if (myMapResponse.stores.length > 0) {
        try {
          const storeResponse = await storesApi.listByIds(myMapResponse.stores);
          setSavedStores(storeResponse.stores);
        } catch {
          setSavedStores([]);
        }
      } else {
        setSavedStores([]);
      }
    } catch {
      setStoreCount(0);
      setPublicCount(0);
      setDisplayName(null);
      setAccountRole(null);
      setSavedStores([]);
    }
  }, [router]);

  const handleAccountButtonPress = useCallback(async () => {
    if (!isLoggedIn) {
      router.push('/views/user_login');
      return;
    }

    try {
      await authApi.logout();
    } catch {
      await tokenStore.clear();
    } finally {
      setIsLoggedIn(false);
      setAccountRole(null);
      setDisplayName(null);
      setStoreCount(0);
      setPublicCount(0);
      setSavedStores([]);
      router.replace('/views/user_login');
    }
  }, [isLoggedIn, router]);

  useFocusEffect(
    useCallback(() => {
      void loadMyMapState();
    }, [loadMyMapState])
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.heroShell}>
              <View style={styles.topRow}>
                <View style={styles.brand}>
                  <Image source={require('@/assets/images/mainLogo.png')} style={styles.logo} />
                  <View style={styles.brandCopy}>
                    <Text style={styles.brandTitle}>Toggle</Text>
                    <Text style={styles.brandSubtitle}>내 지도와 공개 정보를 한 번에 관리해요</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.profileButton} onPress={() => void handleAccountButtonPress()} activeOpacity={0.85}>
                  <Ionicons name={isLoggedIn ? 'log-out-outline' : 'log-in-outline'} size={16} color="#0ea5a4" />
                  <Text style={styles.profileButtonText}>{isLoggedIn ? '로그아웃' : '로그인'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>
                  <Text style={styles.heroAccent}>나만의 </Text>지도
                </Text>
                <Text style={styles.heroSubtitle}>
                  {displayName
                    ? `${displayName}님, 저장한 장소와 공개 지도를 손쉽게 정리해보세요`
                    : '저장한 장소와 공개 지도를 손쉽게 정리해보세요'}
                </Text>
              </View>
            </View>

            {!isLoggedIn ? (
              <LoginGatePanel
                onLogin={() => router.push('/views/user_login')}
                onSignup={() => router.push('/views/user_signup')}
              />
            ) : (
              <>
                <View style={styles.statRow}>
                  <StatCard label="저장한 장소" value={String(storeCount)} icon="bookmark-outline" />
                  <StatCard label="공개 지도" value={String(publicCount)} icon="globe-outline" />
                  <StatCard label="최근 저장" value="0" icon="time-outline" />
                </View>

                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderLeft}>
                    <Ionicons name="bookmark-outline" size={18} color="#0ea5a4" />
                    <Text style={styles.sectionTitle}>내 지도</Text>
                  </View>
                  <Text style={styles.sectionMore}>보기</Text>
                </View>

                <View style={styles.mapCard}>
                  <View style={styles.mapChip}>
                    <Ionicons name="bookmark-outline" size={14} color="#0ea5a4" />
                    <Text style={styles.mapChipText}>내 지도</Text>
                  </View>
                  <View style={styles.mapPreview}>
                    <Image source={require('@/assets/images/목지도.png')} style={styles.mapPreviewImage} />
                    <View style={styles.mapBackdropGlow} />
                    <View style={[styles.pin, styles.pinLeftTop]}>
                      <Ionicons name="heart" size={10} color="#ff4d74" />
                    </View>
                    <View style={[styles.pin, styles.pinCenter]}>
                      <View style={styles.centerDotOuter}>
                        <View style={styles.centerDotInner} />
                      </View>
                    </View>
                    <View style={[styles.pin, styles.pinRightTop]}>
                      <Ionicons name="heart" size={10} color="#ff4d74" />
                    </View>
                    <View style={styles.mapHalo} />
                  </View>
                  <View style={styles.mapFooter}>
                    <View>
                      <Text style={styles.mapFooterTitle}>나만의 지도 {storeCount}개</Text>
                      <Text style={styles.mapFooterSub}>좋아하는 장소를 모아보세요</Text>
                    </View>
                    <TouchableOpacity style={styles.mapFooterButton} onPress={() => router.push('/list')} activeOpacity={0.9}>
                      <Text style={styles.mapFooterButtonText}>지도 관리</Text>
                      <Ionicons name="chevron-forward" size={16} color="#0ea5a4" />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity style={styles.mapQuickAction} activeOpacity={0.9} onPress={() => router.push('/saved')}>
                  <View style={styles.mapQuickActionLeft}>
                    <View style={styles.mapQuickActionIcon}>
                      <Ionicons name="library-outline" size={18} color="#0ea5a4" />
                    </View>
                    <View style={styles.mapQuickActionTextWrap}>
                      <Text style={styles.mapQuickActionTitle}>내 지도 목록 보기</Text>
                      <Text style={styles.mapQuickActionSubtitle}>저장한 장소와 코스를 한눈에 확인해요</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#0ea5a4" />
                </TouchableOpacity>

                {accountRole === 'OWNER' ? (
                  <TouchableOpacity
                    style={styles.ownerQuickAction}
                    activeOpacity={0.9}
                    onPress={() => router.push('/views/owner_dashboard')}
                  >
                    <View style={styles.mapQuickActionLeft}>
                      <View style={styles.mapQuickActionIcon}>
                        <Ionicons name="storefront-outline" size={18} color="#0ea5a4" />
                      </View>
                      <View style={styles.mapQuickActionTextWrap}>
                        <Text style={styles.mapQuickActionTitle}>점주 페이지</Text>
                        <Text style={styles.mapQuickActionSubtitle}>매장 관리 화면으로 바로 이동해요</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#0ea5a4" />
                  </TouchableOpacity>
                ) : null}

                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderLeft}>
                    <Ionicons name="heart" size={18} color="#0ea5a4" />
                    <Text style={styles.sectionTitle}>저장한 장소</Text>
                  </View>
                  <Text style={styles.sectionMore}>{savedStores.length}개</Text>
                </View>

                {savedStores.length === 0 ? (
                  <View style={styles.emptySavedCard}>
                    <Text style={styles.emptySavedTitle}>저장한 장소가 아직 없어요</Text>
                    <Text style={styles.emptySavedText}>지도에서 찜한 장소가 여기에 차곡차곡 보여요.</Text>
                  </View>
                ) : (
                  <View style={styles.savedStoreList}>
                    {savedStores.map((place) => (
                      <SavedStoreCard
                        key={place.storeId}
                        place={place}
                        onPressDetail={() =>
                          router.push({
                            pathname: '/views/store_detail',
                            params: {
                              storeId: String(place.storeId),
                              storeName: place.name,
                              storePhone: place.phone ?? '',
                            },
                          })
                        }
                        onPressReviews={() =>
                          router.push({
                            pathname: '/views/store_reviews',
                            params: {
                              storeId: String(place.storeId),
                              storeName: place.name,
                              storePhone: place.phone ?? '',
                            },
                          })
                        }
                      />
                    ))}
                  </View>
                )}

                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderLeft}>
                    <Ionicons name="options-outline" size={18} color="#0ea5a4" />
                    <Text style={styles.sectionTitle}>빠른 관리</Text>
                  </View>
                  <Text style={styles.sectionMore}>설정</Text>
                </View>

                <ActionCard
                  title="공개 지도 설정"
                  subtitle="내 지도를 다른 사람에게 보여줄지 정해요"
                  icon="lock-closed-outline"
                  onPress={() => router.push('/views/user_login')}
                />
                <ActionCard
                  title="내 장소 추가"
                  subtitle="좋아하는 장소를 지도에 담아보세요"
                  icon="add-circle-outline"
                  onPress={() => router.push('/map')}
                />
              </>
            )}
          </ScrollView>
        </SafeAreaView>

        {showInternalTabBar ? <AppBottomNav activeTab="my" /> : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fbfc',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 8 : 18,
    paddingBottom: 26,
  },
  heroShell: {
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#dbeff0',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  logo: {
    width: 50,
    height: 50,
    resizeMode: 'contain',
    marginRight: 12,
  },
  brandCopy: {
    justifyContent: 'center',
  },
  brandTitle: {
    color: '#0ea5a4',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
  },
  brandSubtitle: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  profileButton: {
    minHeight: 40,
    borderRadius: 20,
    backgroundColor: '#e6fbfa',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 6,
  },
  profileButtonText: { color: '#0ea5a4', fontSize: 12, fontWeight: '800' },
  heroCopy: {
    alignItems: 'flex-start',
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    color: '#0f172a',
  },
  heroAccent: {
    color: '#0ea5a4',
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dbeff0',
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: 'flex-start',
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e6fbfa',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  mapCard: {
    marginTop: 16,
    borderRadius: 24,
    backgroundColor: '#f7fbff',
    borderWidth: 1,
    borderColor: '#eef2f7',
    overflow: 'hidden',
  },
  mapChip: {
    position: 'absolute',
    left: 14,
    top: 14,
    zIndex: 2,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapChipText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800',
  },
  mapPreview: {
    height: 180,
    backgroundColor: '#eef7f7',
    overflow: 'hidden',
  },
  mapPreviewImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.9,
  },
  mapBackdropGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(230,251,250,0.24)',
  },
  pin: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pinLeftTop: { left: 52, top: 36 },
  pinCenter: { left: '50%', top: '50%', marginLeft: -18, marginTop: -18 },
  pinRightTop: { right: 58, top: 38 },
  centerDotOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e6fbfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerDotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0ea5a4',
    borderWidth: 2,
    borderColor: '#fff',
  },
  mapHalo: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 120,
    height: 120,
    marginLeft: -60,
    marginTop: -60,
    borderRadius: 60,
    backgroundColor: 'rgba(14,165,164,0.12)',
  },
  mapFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  mapFooterTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  mapFooterSub: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 12,
  },
  mapFooterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#e6fbfa',
  },
  mapFooterButtonText: {
    color: '#0ea5a4',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
  },
  sectionMore: {
    color: '#0ea5a4',
    fontSize: 13,
    fontWeight: '800',
  },
  mapQuickAction: {
    marginTop: 14,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e6eef1',
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  ownerQuickAction: {
    marginTop: 12,
    backgroundColor: '#f3fdfd',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#bfeceb',
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  mapQuickActionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  mapQuickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e6fbfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapQuickActionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  mapQuickActionTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
  },
  mapQuickActionSubtitle: {
    marginTop: 3,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
  },
  savedStoreList: {
    gap: 10,
    marginBottom: 8,
  },
  savedStoreCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dbeff0',
    padding: 14,
  },
  savedStoreTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  savedStoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#e6fbfa',
  },
  savedStoreBadgeText: {
    color: '#0ea5a4',
    fontSize: 11,
    fontWeight: '800',
  },
  savedStoreCountText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  savedStoreName: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 6,
  },
  savedStoreAddress: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  savedStoreMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  savedStoreMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savedStoreMetaText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  savedStoreActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  savedStoreDetailButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cfe0ff',
    backgroundColor: '#f4f8ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  savedStoreDetailButtonText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '800',
  },
  savedStoreActionButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#bfeceb',
    backgroundColor: '#eefafa',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  savedStoreActionButtonText: {
    color: '#0ea5a4',
    fontSize: 12,
    fontWeight: '800',
  },
  emptySavedCard: {
    backgroundColor: '#f8fbfc',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dbeff0',
    padding: 16,
  },
  emptySavedTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptySavedText: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
  },
  actionCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e6eef1',
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e6fbfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
  },
  actionSubtitle: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  gateCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#dbeff0',
    paddingHorizontal: 18,
    paddingVertical: 20,
    marginTop: 14,
  },
  gateIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e6fbfa',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  gateTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
  },
  gateSubtitle: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 13,
    lineHeight: 19,
  },
  gateButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  gateSecondaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#bfeceb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateSecondaryButtonText: {
    color: '#0ea5a4',
    fontSize: 14,
    fontWeight: '800',
  },
  gatePrimaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0ea5a4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gatePrimaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
