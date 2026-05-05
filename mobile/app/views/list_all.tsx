import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions, Platform, ScrollView, TextInput } from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';

const { width } = Dimensions.get('window');

export default function ListAllScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('전체');

  const filters = ['전체', '음식점', '카페', '편의점', '대형마트', '약국'];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>통합 리스트</Text>
          <View style={{width: 26}} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#8f9bb3" style={styles.searchIcon} />
            <TextInput 
              style={styles.searchInput}
              placeholder="이름, 카테고리 검색"
              placeholderTextColor="#8f9bb3"
            />
          </View>
          <TouchableOpacity style={styles.filterIconButton}>
            <Ionicons name="options-outline" size={24} color="#333" />
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

        {/* List Info Bar */}
        <View style={styles.listInfoBar}>
          <Text style={styles.totalCountText}>총 <Text style={{color: '#00e676', fontWeight: 'bold'}}>10</Text>건</Text>
          <View style={styles.listInfoRight}>
            <TouchableOpacity style={styles.locationSearchBtn}>
              <MaterialIcons name="my-location" size={14} color="#fff" style={{marginRight: 4}} />
              <Text style={styles.locationSearchText}>현위치 검색</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sortDropdown}>
              <Text style={styles.sortText}>가까운 순</Text>
              <Ionicons name="chevron-down" size={14} color="#8f9bb3" style={{marginLeft: 4}} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* List Content */}
        <ScrollView style={styles.listContainer} contentContainerStyle={{paddingBottom: 100}} showsVerticalScrollIndicator={false}>
          
          {/* Card 1 */}
          <View style={styles.card}>
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
              <Ionicons name="location-outline" size={16} color="#8f9bb3" />
              <Text style={styles.infoText}>경기 안양시 만안구 성결대학로 38</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={16} color="#8f9bb3" />
              <Text style={styles.infoText}>영업시간 정보 없음</Text>
            </View>
            
            <View style={styles.cardFooterDivider} />
            
            <View style={styles.cardFooter}>
              <View style={styles.footerItem}>
                <Ionicons name="star" size={14} color="#ffb300" />
                <Text style={styles.footerText}>5</Text>
              </View>
              <View style={styles.footerItem}>
                <Ionicons name="chatbubble-outline" size={14} color="#8f9bb3" />
                <Text style={styles.footerText}>리뷰 1개</Text>
              </View>
              <View style={styles.footerItem}>
                <Ionicons name="heart" size={14} color="#f44336" />
                <Text style={styles.footerText}>2</Text>
              </View>
            </View>
          </View>

          {/* Card 2 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.storeName}>GS25 뉴성결대점</Text>
              <TouchableOpacity>
                <Ionicons name="heart-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>GS25</Text>
            </View>

            <View style={styles.statusRow}>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>영업중</Text>
              </View>
              <Text style={styles.statusUpdateText}>서버 반영 업데이트</Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color="#8f9bb3" />
              <Text style={styles.infoText}>경기 안양시 만안구 냉천로 2</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={16} color="#8f9bb3" />
              <Text style={styles.infoText}>영업시간 정보 없음</Text>
            </View>
            
            <View style={styles.cardFooterDivider} />
            
            <View style={styles.cardFooter}>
              <View style={styles.footerItem}>
                <Ionicons name="star" size={14} color="#ffb300" />
                <Text style={styles.footerText}>—</Text>
              </View>
              <View style={styles.footerItem}>
                <Ionicons name="chatbubble-outline" size={14} color="#8f9bb3" />
                <Text style={styles.footerText}>리뷰 0개</Text>
              </View>
              <View style={styles.footerItem}>
                <Ionicons name="heart" size={14} color="#f44336" />
                <Text style={styles.footerText}>1</Text>
              </View>
            </View>
          </View>

        </ScrollView>

        {/* 4-Item Bottom Navigation Bar */}
        <View style={styles.bottomTabBar}>
          <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/views/map_around')}>
            <Ionicons name="location-outline" size={24} color="#8f9bb3" />
            <Text style={styles.tabText}>주변</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem}>
            <Ionicons name="list" size={24} color="#fff" />
            <Text style={[styles.tabText, styles.tabTextActive]}>리스트</Text>
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
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2a2e3d',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  filterIconButton: {
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterWrapper: {
    marginBottom: 16,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#43485c',
  },
  filterPillActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  filterText: {
    color: '#8f9bb3',
    fontSize: 14,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#2a2e3d',
    fontWeight: 'bold',
  },
  listInfoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  totalCountText: {
    color: '#8f9bb3',
    fontSize: 14,
  },
  listInfoRight: {
    flexDirection: 'row',
    gap: 8,
  },
  locationSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4a5b82',
    backgroundColor: 'rgba(74, 91, 130, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  locationSearchText: {
    color: '#fff',
    fontSize: 12,
  },
  sortDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b3f51',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  sortText: {
    color: '#d1d5db',
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#3b3f51',
    width: '100%',
  },
  listContainer: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#34384b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  storeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  categoryBadge: {
    backgroundColor: 'rgba(66, 107, 255, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 16,
  },
  categoryText: {
    color: '#8cb4ff',
    fontSize: 12,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: '#00e676',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusUpdateText: {
    color: '#8f9bb3',
    fontSize: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    color: '#c5c9d6',
    fontSize: 13,
    marginLeft: 6,
  },
  cardFooterDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 14,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 85,
    backgroundColor: '#232634',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#34384b',
    paddingBottom: Platform.OS === 'ios' ? 25 : 10,
    paddingTop: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    color: '#8f9bb3',
    fontSize: 11,
    marginTop: 4,
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
