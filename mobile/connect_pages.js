const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, 'app', 'views');

// Helper to replace content
function updateFile(filename, replacements) {
  const filePath = path.join(viewsDir, filename);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  for (const { search, replace } from replacements) {
    content = content.replace(search, replace);
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

// 1. user_signup.tsx -> Route to user_login on submit
updateFile('user_signup.tsx', [
  {
    search: /<TouchableOpacity style=\{styles\.primaryButton\}>/g,
    replace: "<TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/views/user_login')}>"
  }
]);

// 2. owner_login.tsx -> Route to owner_dashboard, and add role tabs & signup link
const ownerLoginContent = `import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Dimensions, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function OwnerLoginScreen() {
  const router = useRouter();
  const [role, setRole] = useState('owner'); 

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    if (newRole === 'user') router.replace('/views/user_login');
  };

  return (
    <LinearGradient colors={['#5c7aff', '#86a0ff', '#b3c4ff']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
          <View style={styles.card}>
            <Text style={styles.title}>Toggle</Text>
            <Text style={styles.subtitle}>실시간으로 연결되는 우리 동네 (점주용)</Text>

            <View style={styles.roleContainer}>
              <TouchableOpacity style={[styles.roleButton]} onPress={() => handleRoleChange('user')} activeOpacity={0.8}>
                <Ionicons name="person-outline" size={18} color="rgba(255, 255, 255, 0.7)" style={styles.roleIcon} />
                <Text style={styles.roleText}>일반 사용자</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.roleButton, styles.roleButtonActive]} onPress={() => handleRoleChange('owner')} activeOpacity={0.8}>
                <MaterialCommunityIcons name="storefront-outline" size={18} color="#333" style={styles.roleIcon} />
                <Text style={[styles.roleText, styles.roleTextActive]}>점주</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="rgba(255, 255, 255, 0.7)" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="이메일을 입력하세요" placeholderTextColor="rgba(255, 255, 255, 0.6)" keyboardType="email-address" autoCapitalize="none" />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="rgba(255, 255, 255, 0.7)" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="비밀번호" placeholderTextColor="rgba(255, 255, 255, 0.6)" secureTextEntry />
            </View>

            <View style={styles.linksRow}>
              <TouchableOpacity><Text style={styles.optionsText}>아이디/비밀번호 찾기</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/views/owner_signup')}><Text style={styles.optionsText}>회원가입</Text></TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={() => router.replace('/views/owner_dashboard')} activeOpacity={0.8}>
              <Text style={styles.submitText}>점주 로그인</Text>
              <Ionicons name="chevron-forward" size={20} color="#1E3A8A" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, safeArea: { flex: 1 }, backBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, left: 20, zIndex: 10, padding: 8 },
  keyboardView: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { width: width * 0.88, backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 5 },
  title: { fontSize: 38, fontWeight: '900', color: '#FFF', marginBottom: 6 }, subtitle: { fontSize: 14, color: '#FFF', marginBottom: 28, opacity: 0.85, fontWeight: '500' },
  roleContainer: { flexDirection: 'row', backgroundColor: 'rgba(0, 0, 0, 0.15)', borderRadius: 14, padding: 5, width: '100%', marginBottom: 20 },
  roleButton: { flex: 1, flexDirection: 'row', paddingVertical: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
  roleButtonActive: { backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  roleIcon: { marginRight: 6 }, roleText: { color: 'rgba(255, 255, 255, 0.8)', fontSize: 15, fontWeight: '600' }, roleTextActive: { color: '#333' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.12)', borderRadius: 14, width: '100%', paddingHorizontal: 16, height: 52, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
  inputIcon: { marginRight: 12 }, input: { flex: 1, color: '#FFF', fontSize: 15 },
  linksRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 24, paddingHorizontal: 4 },
  optionsText: { color: 'rgba(255, 255, 255, 0.8)', fontSize: 13 },
  submitButton: { flexDirection: 'row', backgroundColor: '#FFF', width: '100%', height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  submitText: { color: '#1a3b8b', fontSize: 17, fontWeight: 'bold', marginRight: 6 },
});
`;
fs.writeFileSync(path.join(viewsDir, 'owner_login.tsx'), ownerLoginContent, 'utf8');

// 3. owner_signup.tsx -> Route to owner_login on submit
updateFile('owner_signup.tsx', [
  {
    search: /<TouchableOpacity style=\{styles\.primaryButton\}>/g,
    replace: "<TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/views/owner_login')}>"
  }
]);

// 4. owner_dashboard.tsx -> Route to other owner pages
const ownerDashboardContent = `import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
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
          <Text style={styles.headerTitle}>점주 대시보드</Text>
          <TouchableOpacity onPress={() => router.replace('/views/owner_login')} style={styles.backButton}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.gridContainer}>
            {menuItems.map((item, index) => (
              <TouchableOpacity key={index} style={styles.gridItem} onPress={() => router.push(item.route)}>
                <View style={styles.iconContainer}>
                  <Ionicons name={item.icon} size={32} color="#fff" />
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
`;
fs.writeFileSync(path.join(viewsDir, 'owner_dashboard.tsx'), ownerDashboardContent, 'utf8');

console.log('Pages connected successfully');
