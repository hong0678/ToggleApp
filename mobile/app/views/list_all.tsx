import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBottomNav } from '@/components/app-bottom-nav';
import { LoginGatePanel } from '@/components/login-gate-panel';
import { PageHero } from '@/components/page-hero';
import { getTabScreenContentStyle } from '@/components/screen-layout';
import {
  authApi,
  publicMapsApi,
  myMapApi,
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

function MyMapCard({
  item,
  onPress,
  onMorePress,
}: {
  item: MyMapCardItem;
  onPress: () => void;
  onMorePress: () => void;
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
            <Ionicons name="image-outline" size={18} color="#8b95a1" />
            <Text style={styles.mapListThumbEmptyText}>대표 이미지 없음</Text>
          </View>
        )}
        <View style={styles.mapListThumbBadge}>
          <Ionicons name={summary.isPublic ? 'lock-open-outline' : 'lock-closed-outline'} size={12} color="#f9fafb" />
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
          <TouchableOpacity style={styles.mapListMoreButton} onPress={onMorePress} activeOpacity={0.85}>
            <Ionicons name="ellipsis-vertical" size={14} color="#6b7684" />
          </TouchableOpacity>
        </View>

        <View style={styles.mapListInfoRow}>
          <Text style={styles.mapListDate}>{formatDate(summary.updatedAt)}</Text>
          <View style={styles.mapListLikeRow}>
            <Ionicons name="thumbs-up" size={12} color="#18a5a5" />
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
        <Ionicons name="add" size={18} color="#18a5a5" />
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
            <Ionicons name="map-outline" size={22} color="#18a5a5" />
          </View>
        )}
        <View style={styles.publicGridBadge}>
          <Ionicons name="thumbs-up" size={11} color="#f9fafb" />
          <Text style={styles.publicGridBadgeText}>{item.likeCount}</Text>
        </View>
      </View>
      <Text style={styles.publicGridTitle} numberOfLines={2}>{item.title || '공개 마이지도'}</Text>
      <Text style={styles.publicGridAuthor} numberOfLines={1}>by {item.nickname}</Text>
      <View style={styles.publicGridMetaRow}>
        <View style={styles.publicGridMetaPill}>
          <Ionicons name="bookmark-outline" size={11} color="#18a5a5" />
          <Text style={styles.publicGridMetaText}>{item.placeCount}개 장소</Text>
        </View>
        <View style={styles.publicGridMetaPill}>
          <Ionicons name="thumbs-up" size={11} color="#18a5a5" />
          <Text style={styles.publicGridMetaText}>{item.likeCount}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ListAllScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const showInternalTabBar = pathname !== '/list';
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<ViewMode>('mine');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [myMapCards, setMyMapCards] = useState<MyMapCardItem[]>([]);
  const [myMapStats, setMyMapStats] = useState({ mapCount: 0, totalPlaces: 0, likes: 0 });
  const [isLoadingMine, setIsLoadingMine] = useState(false);
  const [mineError, setMineError] = useState<string | null>(null);
  const [mapMenuTarget, setMapMenuTarget] = useState<MyMapCardItem | null>(null);
  const [isDeletingMap, setIsDeletingMap] = useState(false);
  const [isCreateMapModalOpen, setIsCreateMapModalOpen] = useState(false);
  const [isCreatingMap, setIsCreatingMap] = useState(false);
  const [newMapTitle, setNewMapTitle] = useState('');
  const [newMapDescription, setNewMapDescription] = useState('');
  const [newMapImage, setNewMapImage] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [publicKeyword, setPublicKeyword] = useState('');
  const [publicSort, setPublicSort] = useState<PublicSort>('latest');
  const [publicResults, setPublicResults] = useState<PublicMapCardItem[]>([]);
  const [publicTotal, setPublicTotal] = useState(0);
  const [isSearchingPublic, setIsSearchingPublic] = useState(false);
  const [publicError, setPublicError] = useState<string | null>(null);

  useEffect(() => {
    if (modeParam === 'public') {
      setMode('public');
      return;
    }

    if (modeParam === 'mine') {
      setMode('mine');
    }
  }, [modeParam]);

  const greeting = useMemo(() => {
    if (displayName) return `${displayName}님의 공간`;
    return '마이지도';
  }, [displayName]);

  const featuredMap = useMemo(() => {
    return myMapCards[0] ?? null;
  }, [myMapCards]);

  const openCreateMapModal = useCallback(() => {
    setNewMapTitle('');
    setNewMapDescription('');
    setNewMapImage(null);
    setIsCreateMapModalOpen(true);
  }, []);

  const openMapMenu = useCallback((item: MyMapCardItem) => {
    setMapMenuTarget(item);
  }, []);

  const closeMapMenu = useCallback(() => {
    setMapMenuTarget(null);
  }, []);

  const openMapEditor = useCallback(
    (item: MyMapCardItem) => {
      closeMapMenu();
      router.push({
        pathname: '/views/my_map_detail',
        params: {
          mapId: String(item.summary.mapId),
          title: item.summary.title,
          edit: '1',
        },
      });
    },
    [closeMapMenu, router]
  );

  const deleteMap = useCallback(
    async (item: MyMapCardItem) => {
      try {
        setIsDeletingMap(true);
        await userMapsApi.delete(item.summary.mapId);
        await loadMyMap();
        Alert.alert('삭제 완료', '지도를 삭제했어요.');
      } catch (error) {
        Alert.alert('삭제 실패', error instanceof Error ? error.message : '지도를 삭제하지 못했어요.');
      } finally {
        setIsDeletingMap(false);
      }
    },
    [loadMyMap]
  );

  const confirmDeleteMap = useCallback(
    (item: MyMapCardItem) => {
      closeMapMenu();
      Alert.alert('지도 삭제', `'${item.summary.title}' 지도를 삭제할까요?`, [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            void deleteMap(item);
          },
        },
      ]);
    },
    [closeMapMenu, deleteMap]
  );

  const pickNewMapImage = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      multiple: false,
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;

    const file = result.assets[0];
    if (!file?.uri) {
      Alert.alert('사진 선택 실패', '이미지 파일을 읽지 못했어요.');
      return;
    }

    setNewMapImage({
      uri: file.uri,
      name: file.name ?? 'map-cover.jpg',
      type: file.mimeType ?? 'image/jpeg',
    });
  }, []);

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

  const createNewMap = useCallback(async () => {
    const title = newMapTitle.trim();
    if (!title) {
      Alert.alert('지도 이름 확인', '새 지도 이름을 입력해주세요.');
      return;
    }

    try {
      setIsCreatingMap(true);
      const createdMap = await userMapsApi.create({
        title,
        description: newMapDescription.trim() || null,
        isPublic: false,
      });

      if (newMapImage) {
        try {
          await myMapApi.updateProfileImage(createdMap.mapId, newMapImage);
        } catch (error) {
          Alert.alert('사진 업로드 실패', error instanceof Error ? error.message : '대표 사진을 저장하지 못했어요.');
        }
      }

      setIsCreateMapModalOpen(false);
      setNewMapTitle('');
      setNewMapDescription('');
      setNewMapImage(null);
      await loadMyMap();
      Alert.alert('저장 완료', '새 지도를 만들었어요.');
    } catch (error) {
      Alert.alert('지도 만들기 실패', error instanceof Error ? error.message : '새 지도를 만들지 못했어요.');
    } finally {
      setIsCreatingMap(false);
    }
  }, [loadMyMap, newMapDescription, newMapImage, newMapTitle]);


  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, getTabScreenContentStyle(insets)]}
        >
          <PageHero
            title={heroTitle}
            subtitle={heroSubtitle}
            rightIcon={mode === 'public' ? 'people-outline' : 'map-outline'}
            rightIconColor="#18a5a5"
            rightIconBackground="#edf8f8"
            onRightPress={() => (mode === 'public' ? router.push('/views/search_nickname') : router.push('/map'))}
          />

          <View style={styles.segment}>
            <TouchableOpacity
              style={[styles.segmentButton, mode === 'mine' ? styles.segmentButtonActive : null]}
              onPress={() => setMode('mine')}
              activeOpacity={0.9}
            >
              <Ionicons name="bookmark-outline" size={16} color={mode === 'mine' ? '#f9fafb' : '#6b7684'} />
              <Text style={[styles.segmentText, mode === 'mine' ? styles.segmentTextActive : null]}>내 장소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentButton, mode === 'public' ? styles.segmentButtonActive : null]}
              onPress={() => setMode('public')}
              activeOpacity={0.9}
            >
              <Ionicons name="people-outline" size={16} color={mode === 'public' ? '#f9fafb' : '#6b7684'} />
              <Text style={[styles.segmentText, mode === 'public' ? styles.segmentTextActive : null]}>공개 지도</Text>
            </TouchableOpacity>
          </View>

          {!isLoggedIn && mode === 'mine' ? (
            <View style={styles.loginGateWrap}>
              <LoginGatePanel
                title="마이지도를 보려면 로그인하세요"
                subtitle="저장한 장소를 관리하고 다른 사람의 공개 지도를 찾아볼 수 있어요."
                onLogin={() => router.replace('/views/user_login')}
                onSignup={() => router.replace('/views/user_signup')}
              />
            </View>
          ) : mode === 'mine' ? (
              <>
                <View style={styles.mapCard}>
                  <View style={styles.mapPreview}>
                    {featuredMap?.summary.profileImageUrl ? (
                      <Image
                        source={{ uri: resolveAssetUrl(featuredMap.summary.profileImageUrl) ?? undefined }}
                        style={styles.mapPreviewImage}
                      />
                    ) : (
                      <View style={styles.mapPreviewEmpty}>
                        <Ionicons name="image-outline" size={24} color="#8b95a1" />
                        <Text style={styles.mapPreviewEmptyText}>대표 이미지 없음</Text>
                      </View>
                    )}
                    <View style={styles.featuredMapOverlay}>
                      <Text style={styles.featuredMapTitle} numberOfLines={1}>
                        {featuredMap?.summary.title ?? '나의 대표 지도'}
                      </Text>
                      <Text style={styles.featuredMapSubtitle} numberOfLines={2}>
                        {featuredMap
                          ? `${featuredMap.storeCount + featuredMap.publicCount}개 장소 · ${featuredMap.summary.isPublic ? '공개' : '비공개'}`
                          : '나만의 지도를 만들고 관리해보세요'}
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
                          : openCreateMapModal()
                      }
                      activeOpacity={0.9}
                    >
                      <Text style={styles.mapFooterButtonText}>지도 보기</Text>
                      <Ionicons name="chevron-forward" size={16} color="#18a5a5" />
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
                  <Ionicons name="chevron-down" size={12} color="#6b7684" />
                </View>
              </View>

              {isLoadingMine ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator color="#18a5a5" />
                  <Text style={styles.emptyText}>마이지도를 불러오는 중이에요</Text>
                </View>
              ) : myMapCards.length > 0 ? (
                <View style={styles.cardList}>
                  {myMapCards.map((item) => (
                    <MyMapCard
                      key={item.summary.mapId}
                      item={item}
                      onMorePress={() => openMapMenu(item)}
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
                    <Text style={styles.emptyTitle}>내 지도가 아직 없어요</Text>
                    <Text style={styles.emptyText}>{mineError ?? '지도를 만들고 장소를 추가하면 여기에 보여요.'}</Text>
                  </View>
                )}

              <CreateMapCard onPress={openCreateMapModal} />

              <TouchableOpacity style={styles.saveCallout} activeOpacity={0.9} onPress={() => router.push('/saved')}>
                <View style={styles.saveCalloutIcon}>
                  <Ionicons name="map-outline" size={18} color="#18a5a5" />
                </View>
                <View style={styles.saveCalloutBody}>
                  <Text style={styles.saveCalloutTitle}>원하는 장소를 내 지도에 추가해보세요</Text>
                  <Text style={styles.saveCalloutText}>저장 탭이나 검색에서 원하는 장소를 선택해 내 지도에 추가할 수 있어요</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#18a5a5" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.searchCard}>
                <View style={styles.searchInputRow}>
                  <Ionicons name="search-outline" size={18} color="#8b95a1" />
                  <TextInput
                    style={styles.searchInput}
                    value={publicKeyword}
                    onChangeText={setPublicKeyword}
                    placeholder="지도명, 닉네임 검색"
                    placeholderTextColor="#8b95a1"
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
                      <ActivityIndicator size="small" color="#f9fafb" />
                    ) : (
                      <Ionicons name="search" size={18} color="#f9fafb" />
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

      <Modal
        visible={isCreateMapModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCreateMapModalOpen(false)}
      >
        <View style={styles.createMapModalBackdrop}>
          <TouchableOpacity
            style={styles.createMapModalDimmer}
            activeOpacity={1}
            onPress={() => setIsCreateMapModalOpen(false)}
          />
          <View style={styles.createMapModalSheet}>
            <View style={styles.createMapModalHandle} />
            <Text style={styles.createMapModalTitle}>새 지도 만들기</Text>
            <Text style={styles.createMapModalSubtitle}>이름, 설명, 대표 사진을 넣어서 나만의 지도를 만들어보세요.</Text>

            <TouchableOpacity style={styles.createMapPhotoBox} onPress={() => void pickNewMapImage()} activeOpacity={0.9}>
              {newMapImage ? (
                <Image source={{ uri: newMapImage.uri }} style={styles.createMapPhotoImage} />
              ) : (
                <View style={styles.createMapPhotoPlaceholder}>
                  <Ionicons name="image-outline" size={24} color="#8b95a1" />
                  <Text style={styles.createMapPhotoPlaceholderText}>대표 사진 선택</Text>
                </View>
              )}
              <View style={styles.createMapPhotoBadge}>
                <Ionicons name="camera-outline" size={12} color="#18a5a5" />
                <Text style={styles.createMapPhotoBadgeText}>{newMapImage ? '사진 변경' : '사진 추가'}</Text>
              </View>
            </TouchableOpacity>

            <TextInput
              style={styles.createMapInput}
              value={newMapTitle}
              onChangeText={setNewMapTitle}
              placeholder="지도 이름"
              placeholderTextColor="#8b95a1"
              returnKeyType="next"
            />
            <TextInput
              style={[styles.createMapInput, styles.createMapDescriptionInput]}
              value={newMapDescription}
              onChangeText={setNewMapDescription}
              placeholder="설명은 선택이에요"
              placeholderTextColor="#8b95a1"
              multiline
            />

            <View style={styles.createMapActions}>
              <TouchableOpacity
                style={styles.createMapGhostButton}
                onPress={() => setIsCreateMapModalOpen(false)}
                activeOpacity={0.9}
              >
                <Text style={styles.createMapGhostButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createMapPrimaryButton, isCreatingMap ? styles.createMapPrimaryButtonDisabled : null]}
                onPress={() => void createNewMap()}
                activeOpacity={0.9}
                disabled={isCreatingMap}
              >
                {isCreatingMap ? (
                  <ActivityIndicator color="#f9fafb" />
                ) : (
                  <Ionicons name="checkmark" size={16} color="#f9fafb" />
                )}
                <Text style={styles.createMapPrimaryButtonText}>만들기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={mapMenuTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeMapMenu}
      >
        <View style={styles.mapMenuBackdrop}>
          <TouchableOpacity style={styles.createMapModalDimmer} activeOpacity={1} onPress={closeMapMenu} />
          <View style={styles.mapMenuSheet}>
            <View style={styles.createMapModalHandle} />
            <Text style={styles.mapMenuTitle} numberOfLines={1}>
              {mapMenuTarget?.summary.title ?? '내 지도'}
            </Text>
            <Text style={styles.mapMenuSubtitle}>원하는 작업을 선택하세요.</Text>

            <TouchableOpacity
              style={styles.mapMenuAction}
              activeOpacity={0.9}
              onPress={() => {
                if (mapMenuTarget) {
                  openMapEditor(mapMenuTarget);
                }
              }}
              disabled={!mapMenuTarget || isDeletingMap}
            >
              <Ionicons name="create-outline" size={18} color="#18a5a5" />
              <Text style={styles.mapMenuActionText}>수정</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mapMenuAction, styles.mapMenuDeleteAction]}
              activeOpacity={0.9}
              onPress={() => {
                if (mapMenuTarget) {
                  confirmDeleteMap(mapMenuTarget);
                }
              }}
              disabled={!mapMenuTarget || isDeletingMap}
            >
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
              <Text style={[styles.mapMenuActionText, styles.mapMenuDeleteText]}>삭제</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.mapMenuCancelButton} onPress={closeMapMenu} activeOpacity={0.9}>
              <Text style={styles.mapMenuCancelText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    paddingHorizontal: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  eyebrow: {
    color: '#18a5a5',
    fontSize: 12,
    fontWeight: '900',
  },
  title: {
    marginTop: 4,
    color: '#191f28',
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 6,
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '600',
  },
  mapButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#b7eeeb',
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#e5e8eb',
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
    backgroundColor: '#18a5a5',
  },
  segmentText: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: '#f9fafb',
  },
  loginGateWrap: {
    marginTop: 0,
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
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    paddingHorizontal: 12,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  statValue: {
    color: '#191f28',
    fontSize: 24,
    fontWeight: '900',
  },
  statLabel: {
    marginTop: 4,
    color: '#6b7684',
    fontSize: 12,
    fontWeight: '800',
  },
  mapCard: {
    marginBottom: 14,
    borderRadius: 14,
    backgroundColor: '#f7f8fa',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    overflow: 'hidden',
  },
  mapChip: {
    position: 'absolute',
    left: 14,
    top: 14,
    zIndex: 2,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapChipText: {
    color: '#191f28',
    fontSize: 12,
    fontWeight: '800',
  },
  mapPreview: {
    height: 178,
    backgroundColor: '#eef1f5',
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
    backgroundColor: '#eef1f5',
    gap: 6,
  },
  mapPreviewEmptyText: {
    color: '#6b7684',
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
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#191f28',
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
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerDotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#18a5a5',
    borderWidth: 2,
    borderColor: '#f9fafb',
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
    color: '#f9fafb',
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
    backgroundColor: '#f9fafb',
  },
  mapFooterTitle: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '900',
  },
  mapFooterSub: {
    marginTop: 4,
    color: '#6b7684',
    fontSize: 12,
  },
  mapFooterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#edf8f8',
  },
  mapFooterButtonText: {
    color: '#18a5a5',
    fontSize: 12,
    fontWeight: '800',
  },
  mapQuickAction: {
    marginBottom: 14,
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e8eb',
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
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapQuickActionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  mapQuickActionTitle: {
    color: '#191f28',
    fontSize: 14,
    fontWeight: '900',
  },
  mapQuickActionSubtitle: {
    marginTop: 3,
    color: '#6b7684',
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
    color: '#191f28',
    fontSize: 16,
    fontWeight: '900',
  },
  sectionSort: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionAction: {
    color: '#18a5a5',
    fontSize: 12,
    fontWeight: '900',
  },
  sectionCount: {
    color: '#6b7684',
    fontSize: 12,
    fontWeight: '800',
  },
  cardList: {
    gap: 10,
  },
  mapListCard: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    overflow: 'hidden',
  },
  mapListThumb: {
    width: 110,
    height: 94,
    position: 'relative',
    backgroundColor: '#edf8f8',
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
    backgroundColor: '#f9fafb',
  },
  mapListThumbEmptyText: {
    color: '#8b95a1',
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
    color: '#191f28',
    fontSize: 15,
    fontWeight: '900',
  },
  mapListMetaLine: {
    marginTop: 4,
    color: '#6b7684',
    fontSize: 11,
    fontWeight: '700',
  },
  mapListMoreButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eef1f5',
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
    color: '#8b95a1',
    fontSize: 11,
    fontWeight: '700',
  },
  mapListLikeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mapListLikeText: {
    color: '#18a5a5',
    fontSize: 11,
    fontWeight: '900',
  },
  createMapCard: {
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
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
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createMapCardBody: {
    flex: 1,
    minWidth: 0,
  },
  createMapCardTitle: {
    color: '#191f28',
    fontSize: 14,
    fontWeight: '900',
  },
  createMapCardText: {
    marginTop: 3,
    color: '#6b7684',
    fontSize: 12,
    fontWeight: '600',
  },
  createMapModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
  },
  createMapModalDimmer: {
    ...StyleSheet.absoluteFillObject,
  },
  createMapModalSheet: {
    backgroundColor: '#f9fafb',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    borderTopWidth: 1,
    borderColor: '#e5e8eb',
    maxHeight: '86%',
  },
  createMapModalHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d7e8ea',
    alignSelf: 'center',
    marginBottom: 14,
  },
  createMapModalTitle: {
    color: '#191f28',
    fontSize: 18,
    fontWeight: '900',
  },
  createMapModalSubtitle: {
    marginTop: 6,
    marginBottom: 14,
    color: '#6b7684',
    fontSize: 13,
    lineHeight: 19,
  },
  mapMenuBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,23,42,0.38)',
  },
  mapMenuSheet: {
    backgroundColor: '#f9fafb',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    borderTopWidth: 1,
    borderColor: '#e5e8eb',
  },
  mapMenuTitle: {
    marginTop: 6,
    color: '#191f28',
    fontSize: 18,
    fontWeight: '900',
  },
  mapMenuSubtitle: {
    marginTop: 4,
    color: '#6b7684',
    fontSize: 12,
    fontWeight: '600',
  },
  mapMenuAction: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#edf8f8',
    borderWidth: 1,
    borderColor: '#d7f0ef',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapMenuDeleteAction: {
    backgroundColor: '#fff1f1',
    borderColor: '#ffd6d6',
  },
  mapMenuActionText: {
    color: '#191f28',
    fontSize: 14,
    fontWeight: '900',
  },
  mapMenuDeleteText: {
    color: '#ef4444',
  },
  mapMenuCancelButton: {
    marginTop: 12,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapMenuCancelText: {
    color: '#191f28',
    fontSize: 14,
    fontWeight: '900',
  },
  createMapPhotoBox: {
    height: 164,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#eef8f8',
    overflow: 'hidden',
    marginBottom: 12,
  },
  createMapPhotoImage: {
    width: '100%',
    height: '100%',
  },
  createMapPhotoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  createMapPhotoPlaceholderText: {
    color: '#6b7684',
    fontSize: 12,
    fontWeight: '800',
  },
  createMapPhotoBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(249,250,251,0.95)',
    borderWidth: 1,
    borderColor: '#dbeeee',
  },
  createMapPhotoBadgeText: {
    color: '#18a5a5',
    fontSize: 11,
    fontWeight: '800',
  },
  createMapInput: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    color: '#191f28',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  createMapDescriptionInput: {
    minHeight: 84,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  createMapActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  createMapGhostButton: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createMapGhostButtonText: {
    color: '#4e5968',
    fontSize: 14,
    fontWeight: '800',
  },
  createMapPrimaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#18a5a5',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  createMapPrimaryButtonDisabled: {
    opacity: 0.7,
  },
  createMapPrimaryButtonText: {
    color: '#f9fafb',
    fontSize: 14,
    fontWeight: '900',
  },
  saveCallout: {
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#edf8f8',
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
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveCalloutBody: {
    flex: 1,
    minWidth: 0,
  },
  saveCalloutTitle: {
    color: '#191f28',
    fontSize: 13,
    fontWeight: '900',
  },
  saveCalloutText: {
    marginTop: 3,
    color: '#191f28',
    fontSize: 11,
    lineHeight: 15,
    opacity: 0.7,
  },
  searchCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    marginBottom: 16,
  },
  searchTitle: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '900',
  },
  searchText: {
    marginTop: 6,
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '600',
  },
  searchInputRow: {
    height: 48,
    marginTop: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 10,
    color: '#191f28',
    fontSize: 14,
    fontWeight: '700',
  },
  searchButton: {
    width: 42,
    height: 42,
    borderRadius: 7,
    backgroundColor: '#18a5a5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 3,
  },
  publicCard: {
    minHeight: 112,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  publicAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  publicBody: {
    flex: 1,
  },
  publicNickname: {
    color: '#18a5a5',
    fontSize: 12,
    fontWeight: '900',
  },
  publicTitle: {
    marginTop: 3,
    color: '#191f28',
    fontSize: 16,
    fontWeight: '900',
  },
  publicDescription: {
    marginTop: 4,
    color: '#6b7684',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  publicMeta: {
    marginTop: 6,
    color: '#6b7684',
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
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  publicSortChipActive: {
    backgroundColor: '#18a5a5',
    borderColor: '#18a5a5',
  },
  publicSortText: {
    color: '#6b7684',
    fontSize: 12,
    fontWeight: '900',
  },
  publicSortTextActive: {
    color: '#f9fafb',
  },
  publicTotalText: {
    width: '100%',
    color: '#6b7684',
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
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    overflow: 'hidden',
    paddingBottom: 10,
  },
  publicGridImageWrap: {
    height: 136,
    backgroundColor: '#edf8f8',
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
    backgroundColor: '#edf8f8',
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
    color: '#f9fafb',
    fontSize: 11,
    fontWeight: '900',
  },
  publicGridTitle: {
    marginTop: 10,
    paddingHorizontal: 10,
    color: '#191f28',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
  },
  publicGridAuthor: {
    marginTop: 4,
    paddingHorizontal: 10,
    color: '#18a5a5',
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
    color: '#6b7684',
    fontSize: 11,
    fontWeight: '800',
  },
  publicGridDescription: {
    marginTop: 6,
    paddingHorizontal: 10,
    color: '#6b7684',
    fontSize: 11,
    lineHeight: 15,
  },
  emptyState: {
    minHeight: 190,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  emptyTitle: {
    marginTop: 10,
    color: '#191f28',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 8,
    color: '#6b7684',
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
    backgroundColor: '#18a5a5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
