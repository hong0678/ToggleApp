import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function OwnerDashboardScreen() {
  const router = useRouter();

  const menuItems = [
    { title: '실시간 상태 관리', route: '/views/owner_status_manage', icon: 'time-outline' },
    { title: '운영시간 관리', route: '/views/owner_hours_manage', icon: 'calendar-outline' },
    { title: '메뉴 관리', route: '/views/owner_menu_manage', icon: 'restaurant-outline' },
    { title: '매장 사진 관리', route: '/views/owner_photos_manage', icon: 'image-outline' },
    { title: '당일 로그', route: '/views/owner_daily_log', icon: 'document-text-outline' },
    { title: '매장 등록 신청', route: '/views/owner_store_register', icon: 'add-circle-outline' },
    { title: '신청 현황', route: '/views/owner_register_status', icon: 'list-circle-outline' },
    { title: '운영 종료 요청', route: '/views/owner_close_request', icon: 'close-circle-outline' },
  ];

  return (
    <LinearGradient colors={['#1e293b', '#312e81', '#4c1d95']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/')} style={styles.backButton}>
            <Ionicons name="home-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Image source={require('@/assets/images/mainLogo.png')} style={{ width: 100, height: 32, resizeMode: 'contain', marginRight: 8 }} />
            <Text style={{color: 'rgba(255,255,255,0.6)', fontSize: 13}}>Owner Dashboard</Text>
          </View>
          <TouchableOpacity onPress={() => router.replace('/views/owner_login')} style={styles.backButton}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.gridContainer}>
            {menuItems.map((item, index) => (
              <TouchableOpacity key={index} style={styles.gridItem} onPress={() => router.push(item.route)}>
                <View style={styles.iconContainer}>
                  <Ionicons name={item.icon as any} size={32} color="#fff" />
                </View>
                <Text style={styles.itemTitle}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backButton: { padding: 4 }, headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridItem: { width: '47%', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 20, padding: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)' },
  iconContainer: { marginBottom: 12 },
  itemTitle: { color: '#FFF', fontSize: 14, fontWeight: '600', textAlign: 'center' }
});
