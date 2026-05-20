import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Image, ScrollView, Platform, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { tokenStore } from '@/services/api';

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

export default function LandingScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const handlePeopleMapPress = async () => {
    const accessToken = await tokenStore.getAccessToken();
    if (!accessToken) {
      router.replace('/views/user_login');
      return;
    }

    router.push('/views/search_nickname');
  };

  const handleMyMapPress = async () => {
    const accessToken = await tokenStore.getAccessToken();
    if (!accessToken) {
      router.replace('/views/user_login');
      return;
    }

    router.push('/views/my_map');
  };

  const submitLandingSearch = () => {
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
                 </View>
               </View>
               <View style={styles.heroCopy}>
                 <Text style={styles.heroTitle}>
                   <Text style={styles.heroAccent}>지금, </Text>어디 갈까?
                 </Text>
                 <Text style={styles.heroSubtitle}>지금 <Text style={styles.heroSubtitleAccent}>열려있는</Text> 장소를 확인해보세요</Text>
               </View>
            </View>

            <View style={styles.searchBar}>
              <Ionicons name="search" size={22} color="#0ea5a4" />
              <TextInput
                style={styles.searchInput}
                placeholder="카페, 음식점, 장소 검색"
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={submitLandingSearch}
                returnKeyType="search"
                blurOnSubmit={false}
              />
              <TouchableOpacity onPress={submitLandingSearch} activeOpacity={0.85}>
                <Ionicons name="arrow-forward" size={18} color="#0ea5a4" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.quickRow}>
            <TouchableOpacity style={[styles.quickCard, styles.quickCardA]} onPress={() => router.push('/map')} activeOpacity={0.9}>
              <View style={styles.quickRowTop}>
                <View style={[styles.quickIconCircle, styles.quickIconCircleA]}>
                  <Ionicons name="location-outline" size={23} color="#0ea5a4" />
                </View>
                <View style={styles.quickTextBlock}>
                  <Text style={styles.quickTitle} numberOfLines={2}>지금 열린 곳</Text>
                  <Text style={styles.quickSubtitle} numberOfLines={2}>내 주변 영업 중인 장소</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#0ea5a4" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.quickCard, styles.quickCardB]} onPress={handlePeopleMapPress} activeOpacity={0.9}>
              <View style={styles.quickRowTop}>
                <View style={[styles.quickIconCircle, styles.quickIconCircleB]}>
                  <Ionicons name="people-outline" size={23} color="#f59e0b" />
                </View>
                <View style={styles.quickTextBlock}>
                  <Text style={styles.quickTitle} numberOfLines={2}>지도 둘러보기</Text>
                  <Text style={styles.quickSubtitle} numberOfLines={2}>다른 사람의 지도를 구경해요</Text>
                </View>
                <Ionicons name="lock-closed-outline" size={16} color="#f59e0b" />
              </View>
            </TouchableOpacity>
          </View>

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
            <Text style={styles.sectionMore}>더보기</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCards}>
            <PlaceCard title="라떼온스" category="카페" distance="160m" likes="124" accent="#e8f6f7" />
            <PlaceCard title="이자카야 하루" category="일식" distance="240m" likes="98" accent="#fff3d8" />
            <PlaceCard title="버거플랜트" category="양식" distance="310m" likes="76" accent="#e7fbf7" />
            <PlaceCard title="무드 바" category="술집" distance="420m" likes="63" accent="#ffe8e6" />
          </ScrollView>

          <View style={styles.authPanel}>
            <View style={styles.authPanelIcon}>
              <Ionicons name="lock-closed-outline" size={24} color="#0ea5a4" />
            </View>
            <Text style={styles.authPanelTitle}>사람들 지도를 보려면 로그인하세요</Text>
            <Text style={styles.authPanelSubtitle}>다른 사람들의 추천 코스와 장소를 확인해보세요</Text>
            <View style={styles.authButtons}>
              <TouchableOpacity style={styles.loginButton} onPress={() => router.replace('/views/user_login')} activeOpacity={0.9}>
                <Text style={styles.loginButtonText}>로그인</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.signupButton} onPress={() => router.replace('/views/user_signup')} activeOpacity={0.9}>
                <Text style={styles.signupButtonText}>회원가입</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.myMapCard}>
            <View style={styles.myMapLeft}>
              <View style={styles.myMapIconWrap}>
                <Ionicons name="bookmark-outline" size={24} color="#0ea5a4" />
              </View>
              <View style={styles.myMapCopy}>
                <Text style={styles.myMapTitle}>내 지도</Text>
                <Text style={styles.myMapSubtitle} numberOfLines={2}>
                  내가 저장한 장소와 지도를 확인해요
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.manageButton} onPress={handleMyMapPress} activeOpacity={0.9}>
              <Text style={styles.manageButtonText}>내 지도 보기</Text>
              <Ionicons name="chevron-forward" size={16} color="#0ea5a4" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  safeArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 8 : 18,
    paddingBottom: 26,
  },
  topRow: {
    position: 'relative',
    zIndex: 2,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroShell: {
    position: 'relative',
    backgroundColor: '#f8fbfc',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#edf2f7',
    minHeight: 168,
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 4,
    shadowColor: '#0f172a',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
    overflow: 'hidden',
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
  heroCopy: {
    position: 'relative',
    zIndex: 2,
    alignItems: 'flex-end',
    flexShrink: 1,
  },
  heroTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'right',
  },
  heroAccent: {
    color: '#0ea5a4',
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 11,
    color: '#6b7280',
    lineHeight: 15,
    textAlign: 'right',
  },
  heroSubtitleAccent: {
    color: '#0ea5a4',
    fontWeight: '700',
  },
  searchBar: {
    position: 'relative',
    zIndex: 2,
    marginTop: 2,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
    color: '#9ca3af',
    fontSize: 15,
    fontWeight: '600',
  },
  quickRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  quickCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 90,
    justifyContent: 'center',
  },
  quickCardA: {
    backgroundColor: '#e8f8f7',
    borderColor: '#8dd9d7',
  },
  quickCardB: {
    backgroundColor: '#fff3e4',
    borderColor: '#f8d5a6',
  },
  quickRowTop: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIconCircleA: {
    backgroundColor: '#d7f5f3',
  },
  quickIconCircleB: {
    backgroundColor: '#ffe8c8',
  },
  quickTextBlock: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  quickTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 2,
  },
  quickSubtitle: {
    fontSize: 10,
    lineHeight: 13,
    color: '#6b7280',
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
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  mapChipText: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '800',
  },
  mapPreview: {
    height: 250,
    backgroundColor: '#edf4f7',
    position: 'relative',
    overflow: 'hidden',
  },
  mapPreviewImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  mapBackdropGlow: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 200,
    height: 200,
    marginLeft: -100,
    marginTop: -100,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.45)',
    opacity: 0.9,
  },
  mapRiver: {
    position: 'absolute',
    right: -24,
    top: -20,
    width: 84,
    height: 310,
    backgroundColor: 'rgba(59,130,246,0.16)',
    transform: [{ rotate: '14deg' }],
    borderRadius: 42,
  },
  mapRiverSoft: {
    right: -12,
    top: 0,
    width: 52,
    height: 240,
    backgroundColor: 'rgba(96,165,250,0.12)',
  },
  mapRoad: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
  },
  mapRoadMajor1: {
    left: -20,
    top: 126,
    width: 360,
    height: 10,
    transform: [{ rotate: '14deg' }],
    opacity: 0.8,
  },
  mapRoadMajor2: {
    left: -8,
    top: 88,
    width: 340,
    height: 8,
    transform: [{ rotate: '-8deg' }],
    opacity: 0.72,
  },
  mapRoadMajor3: {
    left: 18,
    top: 170,
    width: 320,
    height: 9,
    transform: [{ rotate: '3deg' }],
    opacity: 0.64,
  },
  mapRoadDiagonal1: {
    left: -10,
    top: 88,
    width: 300,
    height: 8,
    transform: [{ rotate: '22deg' }],
  },
  mapRoadDiagonal2: {
    left: 28,
    top: 112,
    width: 250,
    height: 8,
    transform: [{ rotate: '-24deg' }],
  },
  mapRoadHorizontal1: {
    left: -10,
    top: 156,
    width: 330,
    height: 8,
    opacity: 0.85,
  },
  mapRoadHorizontal2: {
    left: 0,
    top: 54,
    width: 320,
    height: 6,
    opacity: 0.65,
  },
  mapRoadVertical1: {
    left: 116,
    top: -8,
    width: 7,
    height: 260,
    opacity: 0.6,
  },
  mapRoadVertical2: {
    left: 214,
    top: 18,
    width: 7,
    height: 210,
    opacity: 0.55,
  },
  mapPark: {
    position: 'absolute',
    backgroundColor: 'rgba(168, 235, 172, 0.22)',
    borderRadius: 8,
    transform: [{ rotate: '-12deg' }],
  },
  mapPark1: {
    left: 34,
    top: 24,
    width: 34,
    height: 18,
  },
  mapPark2: {
    left: 132,
    top: 34,
    width: 42,
    height: 20,
  },
  mapPark3: {
    left: 164,
    top: 182,
    width: 48,
    height: 22,
  },
  mapPark4: {
    left: 218,
    top: 94,
    width: 38,
    height: 18,
  },
  mapPark5: {
    left: 48,
    top: 186,
    width: 30,
    height: 16,
  },
  mapHalo: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(14,165,164,0.10)',
    left: '50%',
    top: '50%',
    marginLeft: -66,
    marginTop: -66,
  },
  pin: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pinCenter: { left: '50%', top: '50%', marginLeft: -15, marginTop: -15, backgroundColor: '#e0f4ff' },
  pinLeftTop: { left: 50, top: 40 },
  pinLeftBottom: { left: 86, top: 128 },
  pinRightTop: { right: 86, top: 44 },
  pinRightBottom: { right: 44, top: 126 },
  pinUpperLeft: { left: 130, top: 24 },
  pinLowerRight: { right: 138, bottom: 28 },
  centerDotOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1d9bf0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  centerDotInner: {
    width: 5,
    height: 5,
    borderRadius: 2,
    backgroundColor: '#1d9bf0',
  },
  mapFooter: {
    marginTop: -10,
    marginHorizontal: 10,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  mapFooterTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  mapFooterSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
  },
  mapFooterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fbfb',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mapFooterButtonText: {
    color: '#0ea5a4',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionHeader: {
    marginTop: 22,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionEmoji: {
    fontSize: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  sectionMore: {
    color: '#0ea5a4',
    fontSize: 12,
    fontWeight: '800',
  },
  horizontalCards: {
    paddingRight: 18,
    gap: 12,
  },
  placeCard: {
    width: 134,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#edf2f7',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  placePhoto: {
    height: 100,
    padding: 8,
    justifyContent: 'space-between',
  },
  placeStatusPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  placeStatusText: {
    color: '#0ea5a4',
    fontSize: 11,
    fontWeight: '900',
  },
  placeTitle: {
    paddingHorizontal: 10,
    paddingTop: 10,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
  },
  placeMetaRow: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 4,
  },
  placeMeta: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '600',
  },
  placeLikesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  myMapCard: {
    marginTop: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#d9f3f2',
    backgroundColor: '#f2fbfb',
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  myMapLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  myMapCopy: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  myMapIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#e1f8f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  myMapTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
  },
  myMapSubtitle: {
    color: '#6b7280',
    fontSize: 10,
    marginTop: 3,
    lineHeight: 14,
    flexShrink: 1,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#bbebe8',
  },
  manageButtonText: {
    color: '#0ea5a4',
    fontSize: 11,
    fontWeight: '800',
  },
  authPanel: {
    marginTop: 22,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#d7eff0',
    backgroundColor: '#eefafa',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    alignItems: 'center',
  },
  authPanelIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#d9f7f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  authPanelTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 20,
    width: '100%',
    paddingHorizontal: 8,
    flexShrink: 1,
  },
  authPanelSubtitle: {
    color: '#6b7280',
    fontSize: 11,
    marginTop: 6,
    lineHeight: 15,
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 8,
  },
  authButtons: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 16,
    width: '100%',
  },
  loginButton: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0ea5a4',
    borderWidth: 1,
    borderColor: '#0ea5a4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  signupButton: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#0ea5a4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signupButtonText: {
    color: '#0ea5a4',
    fontSize: 15,
    fontWeight: '900',
  },
});
