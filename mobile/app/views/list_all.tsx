import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { AppBottomNav } from '@/components/app-bottom-nav';
import { PageHero } from '@/components/page-hero';
import {
  authApi,
  publicMapsApi,
  userMapsApi,
  tokenStore,
  type PublicMapListItemResponse,
  type UserMapSummaryResponse,
} from '@/services/api';

type ViewMode = 'mine' | 'public';
type PublicSort = 'latest' | 'likes';
type MyMapCardItem = {
  summary: UserMapSummaryResponse;
  storeCount: number;
  publicCount: number;
};
type PublicMapCardItem = PublicMapListItemResponse & {
  placeCount: number;
};

const resolveAssetUrl = (value?: string | null) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
  return `${baseUrl}${value.startsWith('/') ? value : `/${value}`}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}.${month}.${day}`;
};

function LoginGate({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  return (
    <View style={styles.gateCard}>
      <View style={styles.gateIcon}>
        <Ionicons name="lock-closed-outline" size={24} color="#0ea5a4" />
      </View>
      <Text style={styles.gateTitle}>마이지도를 보려면 로그인하세요</Text>
      <Text style={styles.gateText}>저장한 장소를 관리하고 다른 사람의 공개 지도를 찾아볼 수 있어요.</Text>
      <View style={styles.gateActions}>
        <TouchableOpacity style={styles.secondaryButton} onPress={onLogin} activeOpacity={0.9}>
          <Text style={styles.secondaryButtonText}>로그인</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={onSignup} activeOpacity={0.9}>
          <Text style={styles.primaryButtonText}>회원가입</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MyMapCard({
  item,
  onPress,
}: {
  item: MyMapCardItem;
  onPress: () => void;
}) {
  const summary = item.summary;
  const imageUri = resolveAssetUrl(summary.profileImageUrl);

  return (
    <TouchableOpacity style={styles.mapListCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.mapListThumb}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.mapListThumbImage} />
        ) : (
          <View style={styles.mapListThumbEmpty}>
            <Ionicons name="image-outline" size={18} color="#94a3b8" />
            <Text style={styles.mapListThumbEmptyText}>대표 이미지 없음</Text>
          </View>
        )}
        <View style={styles.mapListThumbBadge}>
          <Ionicons name={summary.isPublic ? 'lock-open-outline' : 'lock-closed-outline'} size={12} color="#fff" />
        </View>
      </View>

      <View style={styles.mapListBody}>
        <View style={styles.mapListHeaderRow}>
          <View style={styles.mapListHeaderTextWrap}>
            <Text style={styles.mapListTitle} numberOfLines={1}>
              {summary.title}
            </Text>
            <Text style={styles.mapListMetaLine} numberOfLines={1}>
              {item.storeCount + item.publicCount}개 장소 · {summary.isPublic ? '공개' : '비공개'}
            </Text>
          </View>
          <TouchableOpacity style={styles.mapListMoreButton} activeOpacity={0.85}>
            <Ionicons name="ellipsis-vertical" size={14} color="#64748b" />
          </TouchableOpacity>
        </View>

        <View style={styles.mapListInfoRow}>
          <Text style={styles.mapListDate}>{formatDate(summary.updatedAt)}</Text>
          <View style={styles.mapListLikeRow}>
            <Ionicons name="thumbs-up" size={12} color="#0ea5a4" />
            <Text style={styles.mapListLikeText}>{summary.likeCount}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function CreateMapCard({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.createMapCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.createMapCardIcon}>
        <Ionicons name="add" size={18} color="#0ea5a4" />
      </View>
      <View style={styles.createMapCardBody}>
        <Text style={styles.createMapCardTitle}>새 지도 만들기</Text>
        <Text style={styles.createMapCardText}>나만의 공간을 만들어보세요</Text>
      </View>
    </TouchableOpacity>
  );
}

function PublicMapCard({
  item,
  onPress,
}: {
  item: PublicMapCardItem;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.publicGridCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.publicGridImageWrap}>
        {resolveAssetUrl(item.profileImageUrl) ? (
          <Image source={{ uri: resolveAssetUrl(item.profileImageUrl) ?? undefined }} style={styles.publicGridImage} />
        ) : (
          <View style={styles.publicGridFallback}>
            <Ionicons name="map-outline" size={22} color="#0ea5a4" />
          </View>
        )}
        <View style={styles.publicGridBadge}>
          <Ionicons name="thumbs-up" size={11} color="#fff" />
          <Text style={styles.publicGridBadgeText}>{item.likeCount}</Text>
        </View>
      </View>
      <Text style={styles.publicGridTitle} numberOfLines={2}>{item.title || '공개 마이지도'}</Text>
      <Text style={styles.publicGridAuthor} numberOfLines={1}>by {item.nickname}</Text>
      <View style={styles.publicGridMetaRow}>
        <View style={styles.publicGridMetaPill}>
          <Ionicons name="bookmark-outline" size={11} color="#0ea5a4" />
          <Text style={styles.publicGridMetaText}>{item.placeCount}개 장소</Text>
        </View>
        <View style={styles.publicGridMetaPill}>
          <Ionicons name="thumbs-up" size={11} color="#0ea5a4" />
          <Text style={styles.publicGridMetaText}>{item.likeCount}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ListAllScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const showInternalTabBar = pathname !== '/list';
  const [mode, setMode] = useState<ViewMode>('mine');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [myMapCards, setMyMapCards] = useState<MyMapCardItem[]>([]);
  const [myMapStats, setMyMapStats] = useState({ mapCount: 0, totalPlaces: 0, likes: 0 });
  const [isLoadingMine, setIsLoadingMine] = useState(false);
  const [mineError, setMineError] = useState<string | null>(null);
  const [publicKeyword, setPublicKeyword] = useState('');
  const [publicSort, setPublicSort] = useState<PublicSort>('latest');
  const [publicResults, setPublicResults] = useState<PublicMapCardItem[]>([]);
  const [publicTotal, setPublicTotal] = useState(0);
  const [isSearchingPublic, setIsSearchingPublic] = useState(false);
  const [publicError, setPublicError] = useState<string | null>(null);

  const greeting = useMemo(() => {
    if (displayName) return `${displayName}님의 공간`;
    return '마이지도';
  }, [displayName]);

  const featuredMap = useMemo(() => {
    return myMapCards[0] ?? null;
  }, [myMapCards]);

  const heroTitle = mode === 'public' ? '공개 지도 탐색' : greeting;
  const heroSubtitle =
    mode === 'public'
      ? '다른 사람의 공간을 둘러보고 마음에 드는 지도를 찾아보세요'
      : '나만의 지도를 만들고 관리해보세요';
  const loadMyMap = useCallback(async () => {
    const token = await tokenStore.getAccessToken();
    const loggedIn = Boolean(token);
    setIsLoggedIn(loggedIn);

    if (!loggedIn) {
      setDisplayName(null);
      setMyMapCards([]);
      setMyMapStats({ mapCount: 0, totalPlaces: 0, likes: 0 });
      setMineError(null);
      return;
    }

    try {
      setIsLoadingMine(true);
      setMineError(null);

      const [me, mapsResponse] = await Promise.all([authApi.me(), userMapsApi.list()]);
      const sortedMaps = [...mapsResponse].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      const detailResults = await Promise.allSettled(sortedMaps.map((map) => userMapsApi.get(map.mapId)));

      setDisplayName(me.displayName ?? me.nickname ?? null);
      setMyMapCards(
        sortedMaps.map((summary, index) => {
          const detail = detailResults[index].status === 'fulfilled' ? detailResults[index].value : null;
          return {
            summary,
            storeCount: detail?.stores.length ?? 0,
            publicCount: detail?.publicInstitutions.length ?? 0,
          };
        })
      );
      setMyMapStats({
        mapCount: sortedMaps.length,
        totalPlaces: detailResults.reduce((sum, result) => {
          if (result.status !== 'fulfilled') return sum;
          return sum + result.value.stores.length + result.value.publicInstitutions.length;
        }, 0),
        likes: sortedMaps.reduce((sum, item) => sum + (item.likeCount ?? 0), 0),
      });
    } catch (error) {
      setMyMapCards([]);
      setMyMapStats({ mapCount: 0, totalPlaces: 0, likes: 0 });
      setMineError(error instanceof Error ? error.message : '마이지도를 불러오지 못했어요.');
    } finally {
      setIsLoadingMine(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadMyMap();
    }, [loadMyMap])
  );

  const loadPublicMaps = useCallback(async (options?: { keyword?: string; sort?: PublicSort }) => {
    const keyword = options?.keyword ?? publicKeyword;
    const sort = options?.sort ?? publicSort;
    try {
      setIsSearchingPublic(true);
      setPublicError(null);
      const response = await publicMapsApi.list({
        keyword: keyword.trim() || undefined,
        sort,
        page: 0,
        size: 12,
      });
      const detailResults = await Promise.allSettled(
        response.content.map((item) => publicMapsApi.get(item.publicMapUuid))
      );
      setPublicResults(
        response.content.map((item, index) => {
          const detail = detailResults[index].status === 'fulfilled' ? detailResults[index].value : null;
          return {
            ...item,
            placeCount: (detail?.stores.length ?? 0) + (detail?.publics.length ?? 0),
          };
        })
      );
      setPublicTotal(response.totalElements);
    } catch (error) {
      setPublicResults([]);
      setPublicTotal(0);
      setPublicError(error instanceof Error ? error.message : '공개 지도를 불러오지 못했어요.');
    } finally {
      setIsSearchingPublic(false);
    }
  }, [publicKeyword, publicSort]);

  useFocusEffect(
    useCallback(() => {
      if (mode === 'public') {
        void loadPublicMaps();
      }
    }, [loadPublicMaps, mode])
  );

  const openPublicMap = useCallback(
    (item: PublicMapListItemResponse) => {
      router.push({
        pathname: '/views/public_map_detail',
        params: {
          mapId: String(item.mapId),
          uuid: item.publicMapUuid,
          title: item.title ?? '',
          nickname: item.nickname,
        },
      });
    },
    [router]
  );


  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <PageHero
            title={heroTitle}
            subtitle={heroSubtitle}
            rightIcon={mode === 'public' ? 'people-outline' : 'map-outline'}
            rightIconColor="#0ea5a4"
            rightIconBackground="#e6fbfa"
            onRightPress={() => (mode === 'public' ? router.push('/views/search_nickname') : router.push('/map'))}
          />

          <View style={styles.segment}>
            <TouchableOpacity
              style={[styles.segmentButton, mode === 'mine' ? styles.segmentButtonActive : null]}
              onPress={() => setMode('mine')}
              activeOpacity={0.9}
            >
              <Ionicons name="bookmark-outline" size={16} color={mode === 'mine' ? '#fff' : '#64748b'} />
              <Text style={[styles.segmentText, mode === 'mine' ? styles.segmentTextActive : null]}>내 장소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentButton, mode === 'public' ? styles.segmentButtonActive : null]}
              onPress={() => setMode('public')}
              activeOpacity={0.9}
            >
              <Ionicons name="people-outline" size={16} color={mode === 'public' ? '#fff' : '#64748b'} />
              <Text style={[styles.segmentText, mode === 'public' ? styles.segmentTextActive : null]}>공개 지도</Text>
            </TouchableOpacity>
          </View>

          {!isLoggedIn && mode === 'mine' ? (
            <LoginGate
              onLogin={() => router.replace('/views/user_login')}
              onSignup={() => router.replace('/views/user_signup')}
            />
          ) : mode === 'mine' ? (
            <>
              <View style={styles.mapCard}>
                <View style={styles.mapChip}>
                  <Ionicons name="bookmark-outline" size={14} color="#0ea5a4" />
                  <Text style={styles.mapChipText}>대표</Text>
                </View>
                <View style={styles.mapPreview}>
                  {featuredMap?.summary.profileImageUrl ? (
                    <Image
                      source={{ uri: resolveAssetUrl(featuredMap.summary.profileImageUrl) ?? undefined }}
                      style={styles.mapPreviewImage}
                    />
                  ) : (
                    <View style={styles.mapPreviewEmpty}>
                      <Ionicons name="image-outline" size={24} color="#94a3b8" />
                      <Text style={styles.mapPreviewEmptyText}>대표 이미지 없음</Text>
                    </View>
                  )}
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
                  <View style={styles.featuredMapOverlay}>
                    <Text style={styles.featuredMapTitle} numberOfLines={1}>
                      {featuredMap?.summary.title ?? '나의 대표 지도'}
                    </Text>
                    <Text style={styles.featuredMapSubtitle} numberOfLines={2}>
                      {featuredMap ? `${featuredMap.storeCount + featuredMap.publicCount}개 장소 · ${featuredMap.summary.isPublic ? '공개' : '비공개'}` : '나만의 지도를 만들고 관리해보세요'}
                    </Text>
                  </View>
                </View>
                <View style={styles.mapFooter}>
                  <View>
                    <Text style={styles.mapFooterTitle}>내 지도 {myMapStats.mapCount}개</Text>
                    <Text style={styles.mapFooterSub}>저장한 장소와 코스를 한눈에 정리해요</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.mapFooterButton}
                    onPress={() =>
                      featuredMap
                        ? router.push({
                            pathname: '/views/my_map_detail',
                            params: {
                              mapId: String(featuredMap.summary.mapId),
                              title: featuredMap.summary.title,
                            },
                          })
                        : router.push('/saved')
                    }
                    activeOpacity={0.9}
                  >
                    <Text style={styles.mapFooterButtonText}>지도 보기</Text>
                    <Ionicons name="chevron-forward" size={16} color="#0ea5a4" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.statGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{myMapStats.mapCount}</Text>
                  <Text style={styles.statLabel}>내 장소</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{myMapStats.totalPlaces}</Text>
                  <Text style={styles.statLabel}>총 장소</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{myMapStats.likes}</Text>
                  <Text style={styles.statLabel}>받은 좋아요</Text>
                </View>
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>내 지도 목록</Text>
                <View style={styles.sectionSort}>
                  <Text style={styles.sectionAction}>최신순</Text>
                  <Ionicons name="chevron-down" size={12} color="#64748b" />
                </View>
              </View>

              {isLoadingMine ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator color="#0ea5a4" />
                  <Text style={styles.emptyText}>마이지도를 불러오는 중이에요</Text>
                </View>
              ) : myMapCards.length > 0 ? (
                <View style={styles.cardList}>
                  {myMapCards.map((item) => (
                    <MyMapCard
                      key={item.summary.mapId}
                      item={item}
                      onPress={() =>
                        router.push({
                          pathname: '/views/my_map_detail',
                          params: {
                            mapId: String(item.summary.mapId),
                            title: item.summary.title,
                          },
                        })
                      }
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="bookmark-outline" size={42} color="#cbd5e1" />
                  <Text style={styles.emptyTitle}>저장한 장소가 아직 없어요</Text>
                  <Text style={styles.emptyText}>{mineError ?? '내 지도를 만들고 저장한 장소를 추가하면 여기에 보여요.'}</Text>
                  <TouchableOpacity style={styles.primaryButtonWide} onPress={() => router.push('/saved')} activeOpacity={0.9}>
                    <Text style={styles.primaryButtonText}>새 지도 만들기</Text>
                    <Ionicons name="chevron-forward" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}

              <CreateMapCard onPress={() => router.push('/saved')} />

              <TouchableOpacity style={styles.saveCallout} activeOpacity={0.9} onPress={() => router.push('/saved')}>
                <View style={styles.saveCalloutIcon}>
                  <Ionicons name="map-outline" size={18} color="#0ea5a4" />
                </View>
                <View style={styles.saveCalloutBody}>
                  <Text style={styles.saveCalloutTitle}>저장한 장소를 내 지도에 추가해보세요</Text>
                  <Text style={styles.saveCalloutText}>저장 탭에서 원하는 장소를 선택해 내 지도에 추가할 수 있어요</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#0ea5a4" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.searchCard}>
                <View style={styles.searchInputRow}>
                  <Ionicons name="search-outline" size={18} color="#94a3b8" />
                  <TextInput
                    style={styles.searchInput}
                    value={publicKeyword}
                    onChangeText={setPublicKeyword}
                    placeholder="지도명, 닉네임 검색"
                    placeholderTextColor="#94a3b8"
                    returnKeyType="search"
                    autoCapitalize="none"
                    onSubmitEditing={() => void loadPublicMaps({ keyword: publicKeyword, sort: publicSort })}
                  />
                  <TouchableOpacity
                    style={styles.searchButton}
                    onPress={() => void loadPublicMaps({ keyword: publicKeyword, sort: publicSort })}
                    activeOpacity={0.9}
                  >
                    {isSearchingPublic ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="search" size={18} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.publicSortRow}>
                <View style={styles.publicSortGroup}>
                  <TouchableOpacity
                    style={[styles.publicSortChip, publicSort === 'latest' && styles.publicSortChipActive]}
                    onPress={() => {
                      setPublicSort('latest');
                      void loadPublicMaps({ keyword: publicKeyword, sort: 'latest' });
                    }}
                    activeOpacity={0.9}
                  >
                    <Text style={[styles.publicSortText, publicSort === 'latest' && styles.publicSortTextActive]}>최신순</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.publicSortChip, publicSort === 'likes' && styles.publicSortChipActive]}
                    onPress={() => {
                      setPublicSort('likes');
                      void loadPublicMaps({ keyword: publicKeyword, sort: 'likes' });
                    }}
                    activeOpacity={0.9}
                  >
                    <Text style={[styles.publicSortText, publicSort === 'likes' && styles.publicSortTextActive]}>좋아요순</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.publicTotalText}>총 {publicTotal.toLocaleString('ko-KR')}개의 공개 지도가 있어요</Text>
              </View>

              {publicError ? <Text style={styles.publicErrorText}>{publicError}</Text> : null}

              {publicResults.length > 0 ? (
                <View style={styles.publicGrid}>
                  {publicResults.map((item) => (
                    <PublicMapCard key={item.publicMapUuid} item={item} onPress={() => openPublicMap(item)} />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name={publicKeyword ? 'search-outline' : 'people-outline'} size={42} color="#cbd5e1" />
                  <Text style={styles.emptyTitle}>
                    {publicKeyword ? '검색 결과가 없어요' : '공개 지도를 둘러보세요'}
                  </Text>
                  <Text style={styles.emptyText}>공개 설정된 마이지도만 볼 수 있어요.</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {showInternalTabBar ? <AppBottomNav activeTab="list" /> : null}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 112,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  eyebrow: {
    color: '#0ea5a4',
    fontSize: 12,
    fontWeight: '900',
  },
  title: {
    marginTop: 4,
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  mapButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#e6fbfa',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#b7eeeb',
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  segmentButton: {
    flex: 1,
    height: 42,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmentButtonActive: {
    backgroundColor: '#0ea5a4',
  },
  segmentText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: '#fff',
  },
  gateCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  gateIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#e6fbfa',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  gateTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
  },
  gateText: {
    marginTop: 8,
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
  },
  gateActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  primaryButton: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#0ea5a4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryButton: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '900',
  },
  statGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    minHeight: 76,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  statValue: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '900',
  },
  statLabel: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
  },
  mapCard: {
    marginBottom: 14,
    borderRadius: 14,
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
    height: 178,
    backgroundColor: '#eef7f7',
    overflow: 'hidden',
  },
  mapPreviewImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.9,
  },
  mapPreviewEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef7f7',
    gap: 6,
  },
  mapPreviewEmptyText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
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
  featuredMapOverlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.34)',
  },
  featuredMapTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  featuredMapSubtitle: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.88)',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
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
  mapQuickAction: {
    marginBottom: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e6eef1',
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 2,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  sectionSort: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionAction: {
    color: '#0ea5a4',
    fontSize: 12,
    fontWeight: '900',
  },
  sectionCount: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
  },
  cardList: {
    gap: 10,
  },
  mapListCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  mapListThumb: {
    width: 110,
    height: 94,
    position: 'relative',
    backgroundColor: '#e6fbfa',
  },
  mapListThumbImage: {
    width: '100%',
    height: '100%',
  },
  mapListThumbEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#f8fafc',
  },
  mapListThumbEmptyText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
  },
  mapListThumbBadge: {
    position: 'absolute',
    left: 8,
    top: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.76)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapListBody: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  mapListHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  mapListHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  mapListTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  mapListMetaLine: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  mapListMoreButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapListInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  mapListDate: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  mapListLikeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mapListLikeText: {
    color: '#0ea5a4',
    fontSize: 11,
    fontWeight: '900',
  },
  createMapCard: {
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  createMapCardIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e6fbfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createMapCardBody: {
    flex: 1,
    minWidth: 0,
  },
  createMapCardTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
  },
  createMapCardText: {
    marginTop: 3,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  saveCallout: {
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#e6fbfa',
    borderWidth: 1,
    borderColor: '#c9f2ef',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  saveCalloutIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveCalloutBody: {
    flex: 1,
    minWidth: 0,
  },
  saveCalloutTitle: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '900',
  },
  saveCalloutText: {
    marginTop: 3,
    color: '#0f172a',
    fontSize: 11,
    lineHeight: 15,
    opacity: 0.7,
  },
  searchCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  searchTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  searchText: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  searchInputRow: {
    height: 48,
    marginTop: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 10,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  searchButton: {
    width: 42,
    height: 42,
    borderRadius: 7,
    backgroundColor: '#0ea5a4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 3,
  },
  publicCard: {
    minHeight: 112,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  publicAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e6fbfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  publicBody: {
    flex: 1,
  },
  publicNickname: {
    color: '#0ea5a4',
    fontSize: 12,
    fontWeight: '900',
  },
  publicTitle: {
    marginTop: 3,
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  publicDescription: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  publicMeta: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
  },
  publicSortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  publicSortGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  publicSortChip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  publicSortChipActive: {
    backgroundColor: '#0ea5a4',
    borderColor: '#0ea5a4',
  },
  publicSortText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '900',
  },
  publicSortTextActive: {
    color: '#fff',
  },
  publicTotalText: {
    width: '100%',
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  publicErrorText: {
    marginBottom: 10,
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  publicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  publicGridCard: {
    width: '48.5%',
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    paddingBottom: 10,
  },
  publicGridImageWrap: {
    height: 136,
    backgroundColor: '#e6fbfa',
    position: 'relative',
  },
  publicGridImage: {
    width: '100%',
    height: '100%',
  },
  publicGridFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e6fbfa',
  },
  publicGridBadge: {
    position: 'absolute',
    left: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.48)',
  },
  publicGridBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  publicGridTitle: {
    marginTop: 10,
    paddingHorizontal: 10,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
  },
  publicGridAuthor: {
    marginTop: 4,
    paddingHorizontal: 10,
    color: '#0ea5a4',
    fontSize: 11,
    fontWeight: '800',
  },
  publicGridMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
  },
  publicGridMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  publicGridMetaText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
  },
  publicGridDescription: {
    marginTop: 6,
    paddingHorizontal: 10,
    color: '#64748b',
    fontSize: 11,
    lineHeight: 15,
  },
  emptyState: {
    minHeight: 190,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  emptyTitle: {
    marginTop: 10,
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 8,
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
  },
  primaryButtonWide: {
    height: 44,
    marginTop: 16,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#0ea5a4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
