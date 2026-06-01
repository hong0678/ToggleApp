import React, { useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  SafeAreaView,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, Link } from 'expo-router';
import { useSafeBack } from '@/components/use-safe-back';
import { ApiClientError, authApi } from '@/services/api';

const { width } = Dimensions.get('window');

export default function UserLoginScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/');
  const [role, setRole] = useState<'user' | 'owner'>('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRoleChange = (newRole: 'user' | 'owner') => {
    setRole(newRole);
    if (newRole === 'owner') {
      router.replace('/views/owner_login');
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('로그인 정보 확인', '이메일과 비밀번호를 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await authApi.login(email.trim(), password);
      if (response.user.role === 'ADMIN') {
        router.replace('/views/admin_owner_applications');
        return;
      }

      if (response.user.role === 'OWNER') {
        router.replace('/views/owner_dashboard');
        return;
      }

      router.replace('/(tabs)');
    } catch (error) {
      if (error instanceof ApiClientError) {
        Alert.alert(
          '로그인 실패',
          `상태 ${error.status}${error.code ? ` · ${error.code}` : ''}\n${error.message}`
        );
        return;
      }

      Alert.alert('로그인 실패', error instanceof Error ? error.message : '로그인 중 문제가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={['#f2f4f6', '#eef1f5', '#f9fafb']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={28} color="#18a5a5" />
        </TouchableOpacity>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
          <View style={styles.card}>
            <Image source={require('@/assets/images/mainLogo.png')} style={styles.logo} />
            <Text style={styles.title}>Toggle</Text>
            <Text style={styles.subtitle}>실시간으로 연결되는 우리 동네</Text>

            <View style={styles.roleContainer}>
              <TouchableOpacity
                style={[styles.roleButton, role === 'user' && styles.roleButtonActive]}
                onPress={() => handleRoleChange('user')}
                activeOpacity={0.8}
              >
                <Ionicons name="person-outline" size={18} color={role === 'user' ? '#18a5a5' : '#8b95a1'} style={styles.roleIcon} />
                <Text style={[styles.roleText, role === 'user' && styles.roleTextActive]}>일반 사용자</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleButton, role === 'owner' && styles.roleButtonActive]}
                onPress={() => handleRoleChange('owner')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="storefront-outline" size={18} color={role === 'owner' ? '#18a5a5' : '#8b95a1'} style={styles.roleIcon} />
                <Text style={[styles.roleText, role === 'owner' && styles.roleTextActive]}>점주</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#18a5a5" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="이메일을 입력하세요"
                placeholderTextColor="#8b95a1"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#18a5a5" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="비밀번호"
                placeholderTextColor="#8b95a1"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <View style={styles.optionsRow}>
              <TouchableOpacity style={styles.checkboxContainer} onPress={() => setKeepLoggedIn(!keepLoggedIn)}>
                <View style={[styles.checkbox, keepLoggedIn && styles.checkboxChecked]}>
                  {keepLoggedIn && <Ionicons name="checkmark" size={14} color="#18a5a5" />}
                </View>
                <Text style={styles.optionsText}>로그인 상태 유지</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.linksRow}>
              <TouchableOpacity>
                <Text style={styles.optionsText}>아이디/비밀번호 찾기</Text>
              </TouchableOpacity>
              <Link href="/views/user_signup" asChild>
                <TouchableOpacity>
                  <Text style={styles.optionsText}>회원가입</Text>
                </TouchableOpacity>
              </Link>
            </View>

            <TouchableOpacity style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} activeOpacity={0.85} disabled={isSubmitting} onPress={handleLogin}>
              {isSubmitting ? (
                <ActivityIndicator color="#f9fafb" />
              ) : (
                <>
                  <Text style={styles.submitText}>로그인</Text>
                  <Ionicons name="chevron-forward" size={20} color="#f9fafb" />
                </>
              )}
            </TouchableOpacity>

            <Link href="/" asChild>
              <TouchableOpacity style={styles.guestLink}>
                <Text style={styles.guestLinkText}>로그인 없이 지도 둘러보기</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  backBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, left: 20, zIndex: 10, padding: 8 },
  keyboardView: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    width: width * 0.88,
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    alignItems: 'center',
    shadowColor: '#191f28',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  logo: { width: 52, height: 52, resizeMode: 'contain', marginBottom: 6 },
  title: { fontSize: 32, fontWeight: '900', color: '#191f28', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#6b7684', marginBottom: 24, fontWeight: '600' },
  roleContainer: { flexDirection: 'row', backgroundColor: '#eef1f5', borderRadius: 14, padding: 5, width: '100%', marginBottom: 18 },
  roleButton: { flex: 1, flexDirection: 'row', paddingVertical: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
  roleButtonActive: { backgroundColor: '#f9fafb', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  roleIcon: { marginRight: 6 },
  roleText: { color: '#8b95a1', fontSize: 15, fontWeight: '600' },
  roleTextActive: { color: '#18a5a5' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 14, width: '100%', paddingHorizontal: 16, height: 52, marginBottom: 14, borderWidth: 1, borderColor: '#e5e8eb' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, color: '#191f28', fontSize: 15 },
  optionsRow: { flexDirection: 'row', justifyContent: 'flex-start', width: '100%', marginBottom: 12, paddingHorizontal: 4 },
  linksRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 24, paddingHorizontal: 4 },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 18, height: 18, borderRadius: 4, backgroundColor: '#f9fafb', marginRight: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#cbd5e1' },
  checkboxChecked: { backgroundColor: '#edf8f8', borderColor: '#18a5a5' },
  optionsText: { color: '#6b7684', fontSize: 13 },
  submitButton: { flexDirection: 'row', backgroundColor: '#18a5a5', width: '100%', height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  submitButtonDisabled: { opacity: 0.72 },
  submitText: { color: '#f9fafb', fontSize: 17, fontWeight: 'bold', marginRight: 6 },
  guestLink: { marginTop: 24, marginBottom: 8 },
  guestLinkText: { color: '#6b7684', fontSize: 13, textDecorationLine: 'underline' },
});
