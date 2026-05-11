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
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { authApi, favoritesApi, myMapApi, tokenStore, type MeResponse } from '@/services/api';
import type { MyMapResponse } from '@/services/api/myMap';

function ShortcutCard({
  title,
  subtitle,
  icon,
  onPress,
  accentStyle,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accentStyle: object;
}) {
  return (
    <TouchableOpacity style={[styles.shortcutCard, accentStyle]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.shortcutIconWrap}>
        <Ionicons name={icon} size={22} color="#0ea5a4" />
      </View>
      <View style={styles.shortcutTextWrap}>
        <Text style={styles.shortcutTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.shortcutSubtitle} numberOfLines={2}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#0ea5a4" />
    </TouchableOpacity>
  );
}

function ActionCard({
  title,
  subtitle,
  icon,
  onPress,
  accentStyle,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accentStyle?: object;
}) {
  return (
    <TouchableOpacity style={[styles.actionCard, accentStyle]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.actionIconWrap}>
        <Ionicons name={icon} size={22} color="#0ea5a4" />
      </View>
      <View style={styles.actionTextWrap}>
        <Text style={styles.actionTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.actionSubtitle} numberOfLines={2}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#0ea5a4" />
    </TouchableOpacity>
  );
}

function PlaceCard({
  title,
  category,
  distance,
  likes,
  accent,
}: {
  title: string;
  category: string;
  distance: string;
  likes: string;
  accent: string;
}) {
  return (
    <View style={styles.placeCard}>
      <View style={[styles.placePhoto, { backgroundColor: accent }]}>
        <View style={styles.placeStatusPill}>
          <Text style={styles.placeStatusText}>영업중</Text>
        </View>
      </View>
      <Text style={styles.placeTitle}>{title}</Text>
      <View style={styles.placeMetaRow}>
        <Text style={styles.placeMeta}>{category} · {distance}</Text>
        <View style={styles.placeLikesRow}>
          <Ionicons name="heart-outline" size={14} color="#6b7280" />
          <Text style={styles.placeMeta}>{likes}</Text>
        </View>
      </View>
    </View>
  );
}

function PeopleMapCard({
  name,
  title,
  likes,
  accent,
}: {
  name: string;
  title: string;
  likes: string;
  accent: string;
}) {
  return (
    <View style={styles.peopleCard}>
      <View style={[styles.peoplePhoto, { backgroundColor: accent }]}>
        <View style={styles.peopleAvatar}>
          <Text style={styles.peopleAvatarText}>{name.slice(0, 1)}</Text>
        </View>
      </View>
      <View style={styles.peopleCardBody}>
        <View style={styles.peopleNameRow}>
          <Text style={styles.peopleName}>{name}</Text>
          <Text style={styles.peopleLikes}>좋아요 {likes}</Text>
        </View>
        <Text style={styles.peopleTitle} numberOfLines={1}>{title}</Text>
      </View>
    </View>
  );
}

export default function MainHomeScreen() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [myMap, setMyMap] = useState<MyMapResponse | null>(null);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const loadHomeData = useCallback(async () => {
    const token = await tokenStore.getAccessToken();
    if (!token) {
      setMe(null);
      setMyMap(null);
      setFavoriteCount(0);
      return;
    }

    try {
      const [meResponse, myMapResponse, favoritesResponse] = await Promise.all([
        authApi.me(),
        myMapApi.get(),
        favoritesApi.listStores(),
      ]);

      setMe(meResponse);
      setMyMap(myMapResponse);
      setFavoriteCount(favoritesResponse.content.length);
    } catch {
      setMe(null);
      setMyMap(null);
      setFavoriteCount(0);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHomeData();
    }, [loadHomeData])
  );

  const displayName = me?.displayName ?? me?.nickname ?? null;
  const savedPlacesCount = me?.favorites.stores.length ?? favoriteCount;
  const myMapCount = myMap?.stores.length ?? 0;
  const submitHomeSearch = () => {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      router.push('/map');
      return;
    }

    router.push(`/map?query=${encodeURIComponent(trimmedQuery)}`);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.heroShell}>
            <View style={styles.topRow}>
              <View style={styles.brand}>
                <Image source={require('@/assets/images/mainLogo.png')} style={styles.logo} />
                <View style={styles.brandCopy}>
                  <Text style={styles.brandTitle}>Toggle</Text>
                  <Text style={styles.brandSubtitle}>
                    {displayName ? `${displayName}님, 로그인한 상태로 더 빠르게 둘러봐요` : '로그인한 상태로 더 빠르게 둘러봐요'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/my')} activeOpacity={0.85}>
                <Ionicons name="person-outline" size={18} color="#0ea5a4" />
              </TouchableOpacity>
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>
                <Text style={styles.heroAccent}>지금, </Text>어디 갈까?
              </Text>
              <Text style={styles.heroSubtitle}>내 주변과 저장한 장소를 한 번에 확인해요</Text>
            </View>

            <View style={styles.searchBar}>
              <Ionicons name="search" size={22} color="#0ea5a4" />
              <TextInput
                style={styles.searchInput}
                placeholder="카페, 음식점, 장소 검색"
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={submitHomeSearch}
                returnKeyType="search"
                blurOnSubmit={false}
              />
              <TouchableOpacity style={styles.searchSubmitButton} onPress={submitHomeSearch} activeOpacity={0.85}>
                <Ionicons name="arrow-forward" size={18} color="#0ea5a4" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.shortcutGrid}>
            <ShortcutCard
              title="지금 열린 곳"
              subtitle="내 주변 영업 중인 장소"
              icon="location-outline"
              onPress={() => router.push('/map')}
              accentStyle={styles.shortcutA}
            />
            <ShortcutCard
              title="주변 리스트"
              subtitle="카드로 빠르게 비교해요"
              icon="list"
              onPress={() => router.push('/list')}
              accentStyle={styles.shortcutB}
            />
            <ShortcutCard
              title="저장한 장소"
              subtitle={`내가 찜한 곳 ${savedPlacesCount}개`}
              icon="heart-outline"
              onPress={() => router.push('/saved')}
              accentStyle={styles.shortcutC}
            />
            <ShortcutCard
              title="내 지도"
              subtitle={`나만의 지도 ${myMapCount}개`}
              icon="bookmark-outline"
              onPress={() => router.push('/my')}
              accentStyle={styles.shortcutD}
            />
          </View>

          {me?.role === 'OWNER' ? (
            <ActionCard
              title="점주 페이지"
              subtitle="매장 관리와 운영 상태를 바로 확인해요"
              icon="storefront-outline"
              onPress={() => router.push('/views/owner_dashboard')}
              accentStyle={styles.ownerAction}
            />
          ) : null}

          <View style={styles.mapCard}>
            <View style={styles.mapChip}>
              <Ionicons name="radio-button-on-outline" size={14} color="#0ea5a4" />
              <Text style={styles.mapChipText}>내 주변</Text>
            </View>
            <View style={styles.mapPreview}>
              <Image source={require('@/assets/images/목지도.png')} style={styles.mapPreviewImage} />
              <View style={styles.mapBackdropGlow} />
              <View style={[styles.pin, styles.pinLeftTop]}>
                <Ionicons name="heart" size={10} color="#ff4d74" />
              </View>
              <View style={[styles.pin, styles.pinLeftBottom]}>
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
              <View style={[styles.pin, styles.pinRightBottom]}>
                <Ionicons name="heart" size={10} color="#ff4d74" />
              </View>
              <View style={[styles.pin, styles.pinUpperLeft]}>
                <Ionicons name="heart" size={10} color="#ff4d74" />
              </View>
              <View style={[styles.pin, styles.pinLowerRight]}>
                <Ionicons name="heart" size={10} color="#ff4d74" />
              </View>
              <View style={styles.mapHalo} />
            </View>
            <View style={styles.mapFooter}>
              <View>
                <Text style={styles.mapFooterTitle}>지금 열린 곳 12개</Text>
                <Text style={styles.mapFooterSub}>내 위치 기준 도보 10분 이내</Text>
              </View>
              <TouchableOpacity style={styles.mapFooterButton} onPress={() => router.push('/map')} activeOpacity={0.9}>
                <Text style={styles.mapFooterButtonText}>지도 전체보기</Text>
                <Ionicons name="chevron-forward" size={16} color="#0ea5a4" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionEmoji}>🔥</Text>
              <Text style={styles.sectionTitle}>지금 인기 장소</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/list')}>
              <Text style={styles.sectionMore}>더보기</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCards}>
            <PlaceCard title="라떼온스" category="카페" distance="160m" likes="124" accent="#e8f6f7" />
            <PlaceCard title="이자카야 하루" category="일식" distance="240m" likes="98" accent="#fff3d8" />
            <PlaceCard title="버거플랜트" category="양식" distance="310m" likes="76" accent="#e7fbf7" />
            <PlaceCard title="무드 바" category="술집" distance="420m" likes="63" accent="#ffe8e6" />
          </ScrollView>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionEmoji}>👥</Text>
              <Text style={styles.sectionTitle}>사람들 지도</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/views/search_nickname')}>
              <Text style={styles.sectionMore}>더보기</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleCards}>
            <PeopleMapCard name="현지" title="안양 카페 투어 ☕" likes="142" accent="#e8f6f7" />
            <PeopleMapCard name="지민" title="데이트 코스 추천 💗" likes="98" accent="#eef3ff" />
            <PeopleMapCard name="민수" title="혼밥 맛집 리스트" likes="76" accent="#fff4e1" />
          </ScrollView>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fbfc' },
  safeArea: { flex: 1 },
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
    width: 54,
    height: 54,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e6fbfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  searchBar: {
    marginTop: 14,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: '#dbeff0',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    marginHorizontal: 12,
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 0,
  },
  searchSubmitButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e6fbfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  shortcutCard: {
    width: '48%',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 96,
    justifyContent: 'center',
  },
  shortcutA: { backgroundColor: '#e8f8f7', borderColor: '#8dd9d7' },
  shortcutB: { backgroundColor: '#fff3e4', borderColor: '#f8d5a6' },
  shortcutC: { backgroundColor: '#f2fbfa', borderColor: '#dbeff0' },
  shortcutD: { backgroundColor: '#f7fbff', borderColor: '#dbeff0' },
  ownerAction: { marginTop: 4, marginBottom: 14 },
  shortcutIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  shortcutTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  shortcutTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 2,
  },
  shortcutSubtitle: {
    fontSize: 11,
    lineHeight: 14,
    color: '#64748b',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dbeff0',
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e6fbfa',
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
    marginTop: 4,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
  },
  mapCard: {
    marginTop: 18,
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
  pinLeftBottom: { left: 30, bottom: 42 },
  pinCenter: { left: '50%', top: '50%', marginLeft: -18, marginTop: -18 },
  pinRightTop: { right: 58, top: 38 },
  pinRightBottom: { right: 26, bottom: 44 },
  pinUpperLeft: { left: 110, top: 20 },
  pinLowerRight: { right: 88, bottom: 18 },
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
  sectionEmoji: {
    fontSize: 18,
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
  horizontalCards: {
    gap: 12,
    paddingBottom: 6,
  },
  peopleCards: {
    gap: 12,
    paddingBottom: 6,
  },
  placeCard: {
    width: 150,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e6eef1',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  placePhoto: {
    height: 96,
    padding: 10,
  },
  placeStatusPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  placeStatusText: {
    color: '#0ea5a4',
    fontSize: 11,
    fontWeight: '800',
  },
  placeTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  placeMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  placeMeta: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  placeLikesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  peopleCard: {
    width: 176,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e6eef1',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  peoplePhoto: {
    height: 96,
    padding: 10,
  },
  peopleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  peopleAvatarText: {
    color: '#0ea5a4',
    fontSize: 12,
    fontWeight: '900',
  },
  peopleCardBody: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  peopleNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  peopleName: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '900',
  },
  peopleLikes: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  peopleTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
});
