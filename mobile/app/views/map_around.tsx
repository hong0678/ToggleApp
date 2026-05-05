import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  ScrollView,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');

export default function MapAroundScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('전체');

  const filters = ['전체', '음식점', '카페', '편의점', '대형마트', '약국'];

  const kakaoMapHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>
          html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #f0f0f5; }
          #map { width: 100%; height: 100%; }
        </style>
      </head>
      <body>
        <div id="map">
          <div id="log" style="padding: 20px; font-size: 16px; color: #333;">지도 로딩 시작...</div>
        </div>
        <script>
          function log(msg) {
            var el = document.getElementById('log');
            if(el) el.innerHTML += '<br/>' + msg;
          }
          log('스크립트 요청 중...');
          
          var script = document.createElement('script');
          script.src = "https://dapi.kakao.com/v2/maps/sdk.js?appkey=2d21c1757f136b1ff4079ef80c900b15&autoload=false";
          script.onload = function() {
            log('스크립트 로드 완료! 지도 객체 생성 중...');
            try {
              kakao.maps.load(function() {
                var mapContainer = document.getElementById('map');
                mapContainer.innerHTML = '';
                var mapOption = { 
                    center: new kakao.maps.LatLng(37.380482, 126.929841),
                    level: 4
                };
                var map = new kakao.maps.Map(mapContainer, mapOption);
                
                var positions = [
                  { title: '맘스터치 성결대점', latlng: new kakao.maps.LatLng(37.380482, 126.929841) },
                  { title: '더카페 성결대점', latlng: new kakao.maps.LatLng(37.382000, 126.928000) },
                  { title: '와플캠퍼스', latlng: new kakao.maps.LatLng(37.379000, 126.931000) }
                ];

                for (var i = 0; i < positions.length; i ++) {
                    var marker = new kakao.maps.Marker({
                        map: map, 
                        position: positions[i].latlng,
                        title: positions[i].title
                    });
                }
              });
            } catch(e) {
              log('오류 발생: ' + e.message);
            }
          };
          script.onerror = function() {
            log('❌ 에러: 카카오 서버에서 스크립트를 거부했습니다! (도메인 등록 필요)');
          };
          document.head.appendChild(script);
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      {/* 1. Kakao Map WebView */}
      <View style={styles.mapPlaceholder}>
        <WebView 
          originWhitelist={['*']}
          source={{ html: kakaoMapHtml, baseUrl: 'https://localhost' }}
          style={{ flex: 1 }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
          scrollEnabled={false}
          bounces={false}
        />
      </View>

      {/* 2. Top UI Overlays */}
      <SafeAreaView style={styles.topOverlay} pointerEvents="box-none">
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TouchableOpacity onPress={() => router.back()} style={styles.menuButton}>
            <Ionicons name="menu" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.searchInputBox} onPress={() => router.push('/views/map_search')}>
            <Ionicons name="search" size={20} color="rgba(255,255,255,0.7)" />
            <Text style={styles.searchTextPlaceholder}>장소, 버스, 지하철, 주소 검색</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Pills */}
        <View style={styles.filterWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {filters.map((filter, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.filterPill,
                  activeFilter === filter ? styles.filterPillActive : null
                ]}
                onPress={() => setActiveFilter(filter)}
              >
                <Text style={[
                  styles.filterText,
                  activeFilter === filter ? styles.filterTextActive : null
                ]}>{filter}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Search This Area Button */}
        <View style={styles.searchThisAreaContainer}>
          <TouchableOpacity style={styles.searchThisAreaButton}>
            <Ionicons name="reload" size={16} color="#fff" style={{marginRight: 6}} />
            <Text style={styles.searchThisAreaText}>현 지도에서 검색</Text>
          </TouchableOpacity>
        </View>

        {/* GPS Button */}
        <TouchableOpacity style={styles.gpsButton}>
          <MaterialIcons name="my-location" size={24} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* 3. Bottom Sheet UI */}
      <View style={styles.bottomSheet}>
        <View style={styles.handleBar} />
        
        <View style={styles.bottomSheetHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.bottomSheetTitle}>주변 추천 장소</Text>
            <TouchableOpacity style={styles.openOnlyBadge}>
              <Text style={styles.openOnlyText}>영업중만</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity>
            <Text style={styles.viewAllText}>전체보기</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.cardScroll}>
          {/* Store Card */}
          <View style={styles.storeCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.storeName}>맘스터치 성결대점</Text>
              <TouchableOpacity>
                <Ionicons name="heart-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>맘스터치</Text>
            </View>

            <View style={styles.statusRow}>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>영업중</Text>
              </View>
              <Text style={styles.statusUpdateText}>서버 반영 업데이트</Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.6)" />
              <Text style={styles.infoText}>경기 안양시 만안구 성결대학로 38</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.6)" />
              <Text style={styles.infoText}>영업시간 정보 없음</Text>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* 4-Item Bottom Navigation Bar */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="location" size={24} color="#fff" />
          <Text style={[styles.tabText, styles.tabTextActive]}>주변</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/views/list_all')}>
          <Ionicons name="list" size={24} color="#8f9bb3" />
          <Text style={styles.tabText}>리스트</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/views/saved_places')}>
          <Ionicons name="heart-outline" size={24} color="#8f9bb3" />
          <Text style={styles.tabText}>저장</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/views/my_map')}>
          <Ionicons name="person-outline" size={24} color="#8f9bb3" />
          <Text style={styles.tabText}>마이</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    bottom: 80, // Leave space for bottom nav
    backgroundColor: '#e6e4e0',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.1,
    borderWidth: 1,
    borderColor: '#000',
    borderStyle: 'dashed',
  },
  marker: {
    position: 'absolute',
    alignItems: 'center',
    flexDirection: 'row',
  },
  markerDot: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: '#00e676',
    borderWidth: 2, borderColor: '#fff', zIndex: 2,
  },
  markerLabel: {
    backgroundColor: '#00e676',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 12,
    marginLeft: -6,
    zIndex: 1,
  },
  markerText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  topOverlay: { position: 'absolute', top: 0, width: '100%', zIndex: 10 },
  searchContainer: { flexDirection: 'row', paddingHorizontal: 16, marginTop: Platform.OS === 'android' ? 20 : 0, alignItems: 'center' },
  menuButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  searchInputBox: { flex: 1, height: 44, backgroundColor: '#333', borderRadius: 22, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  searchTextPlaceholder: { color: 'rgba(255,255,255,0.7)', fontSize: 15, marginLeft: 10 },
  
  filterWrapper: { marginTop: 12 },
  filterScroll: { paddingHorizontal: 16, gap: 8 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#555' },
  filterPillActive: { backgroundColor: '#86a0ff' },
  filterText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#fff' },

  searchThisAreaContainer: { alignItems: 'center', marginTop: 16 },
  searchThisAreaButton: { flexDirection: 'row', backgroundColor: '#222', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  searchThisAreaText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  gpsButton: { position: 'absolute', right: 16, top: 160, width: 44, height: 44, borderRadius: 22, backgroundColor: '#555', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },

  bottomSheet: {
    position: 'absolute',
    bottom: 80, // Above tab bar
    left: 0, right: 0,
    backgroundColor: '#1e2336',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    height: 340,
    paddingHorizontal: 20,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
    paddingBottom: 20,
  },
  handleBar: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 20 },
  bottomSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  bottomSheetTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginRight: 12 },
  openOnlyBadge: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  openOnlyText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  viewAllText: { color: '#86a0ff', fontSize: 14 },
  
  cardScroll: { flex: 1 },
  storeCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  storeName: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  categoryBadge: { backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 16 },
  categoryText: { color: '#8cb4ff', fontSize: 12 },
  
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  statusBadge: { backgroundColor: '#00e676', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  statusUpdateText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  infoText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginLeft: 8 },

  bottomTabBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 85,
    backgroundColor: '#232634',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#34384b',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 25 : 10,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { color: '#8f9bb3', fontSize: 11, marginTop: 4 },
  tabTextActive: { color: '#fff', fontWeight: 'bold' },
});
