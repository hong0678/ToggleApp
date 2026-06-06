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
import { useLocalSearchParams, useRouter, Link } from 'expo-router';
import { useSafeBack } from '@/components/use-safe-back';
import { authApi } from '@/services/api';

const { width } = Dimensions.get('window');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function UserSignupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnToParam = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const goBack = useSafeBack('/views/user_login');
  const [role, setRole] = useState<'user' | 'owner'>('user');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedNickname = nickname.trim();
  const normalizedEmail = email.trim();
  const normalizedPassword = password;
  const normalizedPasswordConfirm = passwordConfirm;
  const nicknameError =
    normalizedNickname.length > 0 && (normalizedNickname.length < 2 || normalizedNickname.length > 30)
      ? '닉네임은 2자 이상 30자 이하여야 합니다.'
      : '';
  const emailError =
    normalizedEmail.length > 0 && !EMAIL_REGEX.test(normalizedEmail)
      ? '올바른 이메일 형식을 입력해주세요.'
      : '';
  const passwordError =
    normalizedPassword.length > 0 && (normalizedPassword.length < 8 || normalizedPassword.length > 100)
      ? '비밀번호는 8자 이상 100자 이하여야 합니다.'
      : '';
  const passwordConfirmError =
    normalizedPasswordConfirm.length > 0 && normalizedPassword !== normalizedPasswordConfirm
      ? '비밀번호가 서로 일치하지 않습니다.'
      : '';
  const canSubmit = !isSubmitting && !nicknameError && !emailError && !passwordError && !passwordConfirmError;

  const handleRoleChange = (newRole: 'user' | 'owner') => {
    setRole(newRole);
    if (newRole === 'owner') {
      router.replace('/views/owner_signup');
    }
  };

  const handleSignup = async () => {
    if (!normalizedNickname || !normalizedEmail || !normalizedPassword) {
      Alert.alert('가입 정보 확인', '닉네임, 이메일, 비밀번호를 모두 입력해주세요.');
      return;
    }

    if (nicknameError || emailError || passwordError) {
      Alert.alert('가입 정보 확인', '입력 형식을 다시 확인해주세요.');
      return;
    }

    if (normalizedPassword !== normalizedPasswordConfirm) {
      Alert.alert('비밀번호 확인', '비밀번호가 서로 일치하지 않습니다.');
      return;
    }

    try {
      setIsSubmitting(true);
      await authApi.signup({
        email: email.trim(),
        password: normalizedPassword,
        nickname: normalizedNickname,
        role: 'USER',
      });
      Alert.alert('가입 완료', '로그인 화면에서 방금 만든 계정으로 로그인해주세요.');
      router.replace(
        returnToParam
          ? { pathname: '/views/user_login', params: { returnTo: returnToParam } }
          : '/views/user_login'
      );
    } catch (error) {
      Alert.alert('가입 실패', error instanceof Error ? error.message : '회원가입 중 문제가 발생했습니다.');
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
            <Text style={styles.subtitle}>새로운 시작, 우리 동네 연결하기</Text>

            <View style={styles.roleContainer}>
              <TouchableOpacity style={[styles.roleButton, role === 'user' && styles.roleButtonActive]} onPress={() => handleRoleChange('user')} activeOpacity={0.8}>
                <Ionicons name="person-outline" size={18} color={role === 'user' ? '#18a5a5' : '#8b95a1'} style={styles.roleIcon} />
                <Text style={[styles.roleText, role === 'user' && styles.roleTextActive]}>일반 사용자</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.roleButton, role === 'owner' && styles.roleButtonActive]} onPress={() => handleRoleChange('owner')} activeOpacity={0.8}>
                <MaterialCommunityIcons name="storefront-outline" size={18} color={role === 'owner' ? '#18a5a5' : '#8b95a1'} style={styles.roleIcon} />
                <Text style={[styles.roleText, role === 'owner' && styles.roleTextActive]}>점주</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.inputContainer, nicknameError ? styles.inputContainerError : null]}>
              <Ionicons name="happy-outline" size={20} color="#18a5a5" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="닉네임" placeholderTextColor="#8b95a1" value={nickname} onChangeText={setNickname} />
            </View>
            {nicknameError ? <Text style={styles.fieldError}>{nicknameError}</Text> : null}

            <View style={[styles.inputContainer, emailError ? styles.inputContainerError : null]}>
              <Ionicons name="person-outline" size={20} color="#18a5a5" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="이메일을 입력하세요" placeholderTextColor="#8b95a1" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>
            {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}

            <View style={[styles.inputContainer, passwordError ? styles.inputContainerError : null]}>
              <Ionicons name="lock-closed-outline" size={20} color="#18a5a5" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="비밀번호" placeholderTextColor="#8b95a1" value={password} onChangeText={setPassword} secureTextEntry />
            </View>
            {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}

            <View style={[styles.inputContainer, passwordConfirmError ? styles.inputContainerError : null]}>
              <Ionicons name="lock-closed-outline" size={20} color="#18a5a5" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="비밀번호 확인" placeholderTextColor="#8b95a1" value={passwordConfirm} onChangeText={setPasswordConfirm} secureTextEntry />
            </View>
            {passwordConfirmError ? <Text style={styles.fieldError}>{passwordConfirmError}</Text> : null}

            <TouchableOpacity
              style={[
                styles.submitButton,
                !canSubmit && styles.submitButtonDisabled,
              ]}
              activeOpacity={0.8}
              disabled={!canSubmit}
              onPress={handleSignup}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#f9fafb" />
              ) : (
                <>
                  <Text style={styles.submitText}>가입하기</Text>
                  <Ionicons name="chevron-forward" size={20} color="#f9fafb" />
                </>
              )}
            </TouchableOpacity>

            <Link
              href={
                returnToParam
                  ? { pathname: '/views/user_login', params: { returnTo: returnToParam } }
                  : '/views/user_login'
              }
              asChild
            >
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
  card: { width: width * 0.88, backgroundColor: '#f9fafb', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#e5e8eb', alignItems: 'center', shadowColor: '#191f28', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 3 },
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
  inputContainerError: { borderColor: '#ef4444', backgroundColor: '#f9fafb' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, color: '#191f28', fontSize: 15 },
  fieldError: { width: '100%', color: '#ef4444', fontSize: 12, fontWeight: '600', marginTop: -6, marginBottom: 10, paddingHorizontal: 6 },
  submitButton: { flexDirection: 'row', backgroundColor: '#18a5a5', width: '100%', height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4, marginTop: 12 },
  submitButtonDisabled: { opacity: 0.72 },
  submitText: { color: '#f9fafb', fontSize: 17, fontWeight: 'bold', marginRight: 6 },
  guestLink: { marginTop: 24, marginBottom: 8 },
  guestLinkText: { color: '#6b7684', fontSize: 13, textDecorationLine: 'underline' },
});
