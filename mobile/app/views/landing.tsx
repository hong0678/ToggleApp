import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function LandingScreen() {
  const router = useRouter();

  return (
    <LinearGradient colors={['#101524', '#151b32', '#1a2245']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        {/* Top Bar */}
        <View style={styles.topBar}>
          <View style={styles.logoContainer}>
            <View style={styles.logoIconPlaceholder}>
              <Ionicons name="location" size={24} color="#00e5ff" />
            </View>
            <Text style={styles.logoText}>Toggle</Text>
          </View>
          <TouchableOpacity 
            style={styles.loginBtn}
            onPress={() => router.push('/views/user_login')}
          >
            <Text style={styles.loginBtnText}>로그인 / 회원가입</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          
          {/* Badge */}
          <View style={styles.badgeContainer}>
            <View style={styles.greenDot} />
            <Text style={styles.badgeText}>실시간 동기화 지도 서비스</Text>
          </View>

          {/* Main Title */}
          <Text style={styles.mainTitle}>지금 방문 가능한</Text>
          <Text style={[styles.mainTitle, styles.gradientText]}>장소를 찾아보세요</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>포털 지도에서 헛걸음하셨나요?</Text>
          <Text style={styles.subtitle}>Toggle은 점포의 실제 영업 상태를 실시간으로 반영합니다.</Text>

          {/* Action Buttons */}
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/views/map_around')}>
            <Ionicons name="navigate" size={20} color="#000" style={{marginRight: 8}} />
            <Text style={styles.primaryButtonText}>내 주변 보기</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/views/map_search')}>
            <Ionicons name="search" size={20} color="#fff" style={{marginRight: 8}} />
            <Text style={styles.secondaryButtonText}>장소 검색하기</Text>
          </TouchableOpacity>

          {/* Bottom Icons */}
          <View style={styles.bottomFeatures}>
            <View style={styles.featureItem}>
              <View style={styles.featureIconCircle}>
                <Ionicons name="storefront-outline" size={24} color="#8cb4ff" />
              </View>
              <Text style={styles.featureText}>실시간 영업 상태</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureIconCircle}>
                <Ionicons name="location-outline" size={24} color="#8cb4ff" />
              </View>
              <Text style={styles.featureText}>나만의 지도 저장</Text>
            </View>
          </View>
          
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  logoIconPlaceholder: { marginRight: 8 },
  logoText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  loginBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  loginBtnText: { color: '#fff', fontSize: 13 },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -40,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(100, 150, 255, 0.3)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 30,
  },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00e676', marginRight: 8 },
  badgeText: { color: '#8cb4ff', fontSize: 14 },
  mainTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
  },
  gradientText: {
    color: '#a3bdf0',
    marginBottom: 24,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    width: '100%',
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    marginBottom: 16,
  },
  primaryButtonText: { color: '#000', fontSize: 17, fontWeight: 'bold' },
  secondaryButton: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    width: '100%',
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 50,
  },
  secondaryButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  bottomFeatures: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    gap: 40,
  },
  featureItem: { alignItems: 'center' },
  featureIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  featureText: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
});
