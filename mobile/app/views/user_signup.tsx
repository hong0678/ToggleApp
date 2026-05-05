import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, Link } from 'expo-router';

const { width } = Dimensions.get('window');

export default function UserSignupScreen() {
  const router = useRouter();
  const [role, setRole] = useState<'user' | 'owner'>('user');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const handleRoleChange = (newRole: 'user' | 'owner') => {
    setRole(newRole);
    if (newRole === 'owner') {
      router.replace('/views/owner_signup');
    }
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
            <Text style={styles.subtitle}>새로운 시작, 우리 동네 연결하기</Text>

            <View style={styles.roleContainer}>
              <TouchableOpacity
                style={[styles.roleButton, role === 'user' ? styles.roleButtonActive : null]}
                onPress={() => handleRoleChange('user')} activeOpacity={0.8}
              >
                <Ionicons name="person-outline" size={18} color={role === 'user' ? '#333' : 'rgba(255, 255, 255, 0.7)'} style={styles.roleIcon} />
                <Text style={[styles.roleText, role === 'user' ? styles.roleTextActive : null]}>일반 사용자</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.roleButton, role === 'owner' ? styles.roleButtonActive : null]}
                onPress={() => handleRoleChange('owner')} activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="storefront-outline" size={18} color={role === 'owner' ? '#333' : 'rgba(255, 255, 255, 0.7)'} style={styles.roleIcon} />
                <Text style={[styles.roleText, role === 'owner' ? styles.roleTextActive : null]}>점주</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="happy-outline" size={20} color="rgba(255, 255, 255, 0.7)" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="닉네임" placeholderTextColor="rgba(255, 255, 255, 0.6)" value={nickname} onChangeText={setNickname} />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="rgba(255, 255, 255, 0.7)" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="이메일을 입력하세요" placeholderTextColor="rgba(255, 255, 255, 0.6)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="rgba(255, 255, 255, 0.7)" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="비밀번호" placeholderTextColor="rgba(255, 255, 255, 0.6)" value={password} onChangeText={setPassword} secureTextEntry />
            </View>
            
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="rgba(255, 255, 255, 0.7)" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="비밀번호 확인" placeholderTextColor="rgba(255, 255, 255, 0.6)" value={passwordConfirm} onChangeText={setPasswordConfirm} secureTextEntry />
            </View>

            <Link href="/views/user_login" asChild>
              <TouchableOpacity style={styles.submitButton} activeOpacity={0.8}>
                <Text style={styles.submitText}>가입하기</Text>
                <Ionicons name="chevron-forward" size={20} color="#1E3A8A" />
              </TouchableOpacity>
            </Link>

            <Link href="/views/user_login" asChild>
              <TouchableOpacity style={styles.guestLink}>
                <Text style={styles.guestLinkText}>이미 계정이 있으신가요? 로그인하기</Text>
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
  card: { width: width * 0.88, backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 5 },
  title: { fontSize: 38, fontWeight: '900', color: '#FFF', marginBottom: 6, textShadowColor: 'rgba(0, 0, 0, 0.1)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  subtitle: { fontSize: 14, color: '#FFF', marginBottom: 28, opacity: 0.85, fontWeight: '500' },
  roleContainer: { flexDirection: 'row', backgroundColor: 'rgba(0, 0, 0, 0.15)', borderRadius: 14, padding: 5, width: '100%', marginBottom: 20 },
  roleButton: { flex: 1, flexDirection: 'row', paddingVertical: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
  roleButtonActive: { backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  roleIcon: { marginRight: 6 },
  roleText: { color: 'rgba(255, 255, 255, 0.8)', fontSize: 15, fontWeight: '600' },
  roleTextActive: { color: '#333' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.12)', borderRadius: 14, width: '100%', paddingHorizontal: 16, height: 52, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, color: '#FFF', fontSize: 15 },
  submitButton: { flexDirection: 'row', backgroundColor: '#FFF', width: '100%', height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4, marginTop: 12 },
  submitText: { color: '#1a3b8b', fontSize: 17, fontWeight: 'bold', marginRight: 6 },
  guestLink: { marginTop: 24, marginBottom: 8 },
  guestLinkText: { color: 'rgba(255, 255, 255, 0.7)', fontSize: 13, textDecorationLine: 'underline' },
});
