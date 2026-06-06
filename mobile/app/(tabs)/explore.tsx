import React from 'react';
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
import { useRouter } from 'expo-router';

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
        <Ionicons name={icon} size={22} color="#18a5a5" />
      </View>
      <View style={styles.actionTextWrap}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#18a5a5" />
    </TouchableOpacity>
  );
}

export default function ExploreScreen() {
  const router = useRouter();

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
                  <Text style={styles.brandSubtitle}>새로운 장소와 지도를 둘러봐요</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/my')} activeOpacity={0.85}>
                <Ionicons name="compass-outline" size={18} color="#18a5a5" />
              </TouchableOpacity>
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>
                <Text style={styles.heroAccent}>둘러보기, </Text>새로운 발견
              </Text>
              <Text style={styles.heroSubtitle}>다른 사람들의 추천과 지금 인기 있는 장소를 확인해보세요</Text>
            </View>
          </View>

          <View style={styles.quickRow}>
            <TouchableOpacity style={[styles.quickCard, styles.quickCardA]} onPress={() => router.push('/map')} activeOpacity={0.9}>
              <View style={styles.quickIconCircle}>
                <Ionicons name="location-outline" size={23} color="#18a5a5" />
              </View>
              <Text style={styles.quickTitle}>지금 열린 곳</Text>
              <Text style={styles.quickSubtitleSmall}>내 주변에서 바로 확인해요</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.quickCard, styles.quickCardB]} onPress={() => router.push('/views/search_nickname')} activeOpacity={0.9}>
              <View style={styles.quickIconCircle}>
                <Ionicons name="people-outline" size={23} color="#f59e0b" />
              </View>
              <Text style={styles.quickTitle}>사람들 지도</Text>
              <Text style={styles.quickSubtitleSmall}>다른 사람의 코스를 구경해요</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.mapCard}>
            <View style={styles.mapChip}>
              <Ionicons name="radio-button-on-outline" size={14} color="#18a5a5" />
              <Text style={styles.mapChipText}>지금 인기</Text>
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
                <Text style={styles.mapFooterTitle}>인기 장소와 지도 미리보기</Text>
                <Text style={styles.mapFooterSub}>홈과 같은 톤으로 둘러보기를 이어가요</Text>
              </View>
              <TouchableOpacity style={styles.mapFooterButton} onPress={() => router.push('/list')} activeOpacity={0.9}>
                <Text style={styles.mapFooterButtonText}>마이지도 보기</Text>
                <Ionicons name="chevron-forward" size={16} color="#18a5a5" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Ionicons name="flame-outline" size={18} color="#18a5a5" />
              <Text style={styles.sectionTitle}>지금 인기 장소</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/list')}>
              <Text style={styles.sectionMore}>더보기</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.listCard}>
            <View style={styles.listRow}>
              <View style={styles.listBadge}><Text style={styles.listBadgeText}>카페</Text></View>
              <View style={styles.listInfo}>
                <Text style={styles.listTitle}>라떼온스</Text>
                <Text style={styles.listSubtitle}>분위기 좋은 카페 · 160m</Text>
              </View>
              <Text style={styles.listLike}>♡ 124</Text>
            </View>
            <View style={styles.listDivider} />
            <View style={styles.listRow}>
              <View style={[styles.listBadge, styles.listBadgeWarm]}><Text style={styles.listBadgeText}>일식</Text></View>
              <View style={styles.listInfo}>
                <Text style={styles.listTitle}>이자카야 하루</Text>
                <Text style={styles.listSubtitle}>저녁에 가기 좋은 곳 · 240m</Text>
              </View>
              <Text style={styles.listLike}>♡ 98</Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Ionicons name="construct-outline" size={18} color="#18a5a5" />
              <Text style={styles.sectionTitle}>연결된 API</Text>
            </View>
            <Text style={styles.sectionMore}>테스트</Text>
          </View>

          <ActionCard
            title="API 실험실"
            subtitle="매장 resolve, 공공기관, 리뷰, 파일, 검색 API를 한 곳에서 확인해요"
            icon="flask-outline"
            onPress={() => router.push('/views/backend_api_hub' as never)}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8fa',
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
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    shadowColor: '#191f28',
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
    color: '#18a5a5',
    fontSize: 24,
    fontWeight: '900',
  },
  brandSubtitle: {
    marginTop: 2,
    color: '#6b7684',
    fontSize: 11,
    fontWeight: '600',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#edf8f8',
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
    color: '#191f28',
  },
  heroAccent: {
    color: '#18a5a5',
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#6b7684',
    lineHeight: 18,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  quickCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 112,
    backgroundColor: '#f9fafb',
  },
  quickCardA: {
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
  },
  quickCardB: {
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
  },
  quickIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickTitle: {
    color: '#191f28',
    fontSize: 13,
    fontWeight: '900',
  },
  quickSubtitleSmall: {
    marginTop: 4,
    color: '#6b7684',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  mapCard: {
    marginTop: 16,
    borderRadius: 24,
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
    height: 180,
    backgroundColor: '#eef1f5',
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
    color: '#191f28',
    fontSize: 18,
    fontWeight: '900',
  },
  sectionMore: {
    color: '#18a5a5',
    fontSize: 13,
    fontWeight: '800',
  },
  listCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  listBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listBadgeWarm: {
    backgroundColor: '#f9fafb',
  },
  listBadgeText: {
    color: '#18a5a5',
    fontSize: 12,
    fontWeight: '800',
  },
  listInfo: {
    flex: 1,
    minWidth: 0,
  },
  listTitle: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '900',
  },
  listSubtitle: {
    color: '#6b7684',
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  listLike: {
    color: '#18a5a5',
    fontSize: 12,
    fontWeight: '800',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#edf8f8',
  },
  actionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    color: '#191f28',
    fontSize: 14,
    fontWeight: '900',
  },
  actionSubtitle: {
    marginTop: 4,
    color: '#6b7684',
    fontSize: 12,
    lineHeight: 16,
  },
  listDivider: {
    height: 1,
    backgroundColor: '#e5e8eb',
    marginVertical: 12,
  },
});
