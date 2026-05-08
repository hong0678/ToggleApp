import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ownerApi, tokenStore } from '@/services/api';

type FieldKey =
  | 'storeName'
  | 'businessNumber'
  | 'representativeName'
  | 'businessOpenDate'
  | 'businessAddress'
  | 'businessPhone'
  | 'licenseUri'
  | 'licenseName'
  | 'licenseType';

type FormState = Record<FieldKey, string>;

const INITIAL_FORM: FormState = {
  storeName: '',
  businessNumber: '',
  representativeName: '',
  businessOpenDate: '',
  businessAddress: '',
  businessPhone: '',
  licenseUri: '',
  licenseName: 'business-license.jpg',
  licenseType: 'image/jpeg',
};

function GatePanel({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  return (
    <View style={styles.gateCard}>
      <View style={styles.gateIconWrap}>
        <Ionicons name="lock-closed-outline" size={24} color="#0ea5a4" />
      </View>
      <Text style={styles.gateTitle}>매장 등록은 로그인 후 진행할 수 있어요</Text>
      <Text style={styles.gateSubtitle}>점주 계정으로 로그인하면 신청서를 작성하고 제출할 수 있습니다.</Text>
      <View style={styles.gateButtons}>
        <TouchableOpacity style={styles.gateSecondaryButton} onPress={onLogin} activeOpacity={0.9}>
          <Text style={styles.gateSecondaryButtonText}>로그인</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.gatePrimaryButton} onPress={onSignup} activeOpacity={0.9}>
          <Text style={styles.gatePrimaryButtonText}>회원가입</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function InputRow({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad' | 'number-pad';
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputContainer}>
        <Ionicons name={icon} size={18} color="#0ea5a4" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          keyboardType={keyboardType}
          autoCapitalize="none"
        />
      </View>
    </View>
  );
}

export default function OwnerStoreRegisterScreen() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const token = await tokenStore.getAccessToken();
      if (!active) return;
      setIsLoggedIn(Boolean(token));
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const isFormValid = useMemo(() => {
    return (
      form.storeName.trim().length >= 2 &&
      form.businessNumber.trim().length >= 6 &&
      form.representativeName.trim().length >= 2 &&
      form.businessOpenDate.trim().length >= 8 &&
      form.businessAddress.trim().length >= 5 &&
      form.businessPhone.trim().length >= 8 &&
      form.licenseUri.trim().length > 0
    );
  }, [form]);

  const updateField = (key: FieldKey, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!isFormValid) {
      Alert.alert('입력 확인', '필수 항목을 모두 채워주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      await ownerApi.createApplication(
        {
          storeName: form.storeName.trim(),
          businessNumber: form.businessNumber.trim(),
          representativeName: form.representativeName.trim(),
          businessOpenDate: form.businessOpenDate.trim(),
          businessAddress: form.businessAddress.trim(),
          businessPhone: form.businessPhone.trim(),
        },
        {
          uri: form.licenseUri.trim(),
          name: form.licenseName.trim() || 'business-license.jpg',
          type: form.licenseType.trim() || 'image/jpeg',
        }
      );
      Alert.alert('신청 완료', '매장 등록 신청이 접수되었습니다.');
      router.push('/views/owner_register_status');
    } catch (error) {
      Alert.alert('신청 실패', error instanceof Error ? error.message : '매장 등록 신청 중 문제가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.8}>
              <Ionicons name="chevron-back" size={24} color="#0ea5a4" />
            </TouchableOpacity>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>매장 등록 신청</Text>
              <Text style={styles.headerSubtitle}>사업자 정보와 등록 서류를 입력해 신청하세요.</Text>
            </View>
          </View>

          {!isLoggedIn ? (
            <GatePanel onLogin={() => router.push('/views/owner_login')} onSignup={() => router.push('/views/owner_signup')} />
          ) : (
            <View style={styles.card}>
              <InputRow
                label="매장명"
                value={form.storeName}
                onChangeText={(value) => updateField('storeName', value)}
                placeholder="예: Toggle 카페"
                icon="storefront-outline"
              />
              <InputRow
                label="사업자등록번호"
                value={form.businessNumber}
                onChangeText={(value) => updateField('businessNumber', value)}
                placeholder="예: 123-45-67890"
                icon="card-outline"
                keyboardType="numeric"
              />
              <InputRow
                label="대표자명"
                value={form.representativeName}
                onChangeText={(value) => updateField('representativeName', value)}
                placeholder="예: 홍길동"
                icon="person-outline"
              />
              <InputRow
                label="개업일"
                value={form.businessOpenDate}
                onChangeText={(value) => updateField('businessOpenDate', value)}
                placeholder="예: 2026-05-01"
                icon="calendar-outline"
              />
              <InputRow
                label="사업장 주소"
                value={form.businessAddress}
                onChangeText={(value) => updateField('businessAddress', value)}
                placeholder="예: 경기 안양시 만안구 ..."
                icon="location-outline"
              />
              <InputRow
                label="대표 전화번호"
                value={form.businessPhone}
                onChangeText={(value) => updateField('businessPhone', value)}
                placeholder="예: 031-123-4567"
                icon="call-outline"
                keyboardType="phone-pad"
              />

              <Text style={styles.sectionTitle}>사업자등록증 파일</Text>
              <View style={styles.uploadBox}>
                <MaterialCommunityIcons name="file-image-plus-outline" size={22} color="#0ea5a4" />
                <Text style={styles.uploadText}>파일 URI를 입력해서 먼저 연결할 수 있어요.</Text>
              </View>
              <InputRow
                label="파일 URI"
                value={form.licenseUri}
                onChangeText={(value) => updateField('licenseUri', value)}
                placeholder="file:///..."
                icon="link-outline"
              />
              <InputRow
                label="파일 이름"
                value={form.licenseName}
                onChangeText={(value) => updateField('licenseName', value)}
                placeholder="business-license.jpg"
                icon="create-outline"
              />
              <InputRow
                label="파일 타입"
                value={form.licenseType}
                onChangeText={(value) => updateField('licenseType', value)}
                placeholder="image/jpeg"
                icon="pricetag-outline"
              />

              <TouchableOpacity
                style={[styles.submitButton, !isFormValid || isSubmitting ? styles.submitButtonDisabled : null]}
                onPress={handleSubmit}
                activeOpacity={0.9}
                disabled={!isFormValid || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.submitText}>신청서 제출</Text>
                    <Ionicons name="chevron-forward" size={18} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fbff' },
  keyboardView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  backButton: { paddingTop: 4, paddingRight: 4 },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  headerSubtitle: { marginTop: 6, color: '#64748b', fontSize: 13, lineHeight: 18 },
  gateCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#dbeff0',
  },
  gateIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eefafa',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  gateTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginBottom: 8 },
  gateSubtitle: { fontSize: 13, color: '#64748b', lineHeight: 18 },
  gateButtons: { flexDirection: 'row', gap: 10, marginTop: 18 },
  gateSecondaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bfeceb',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  gateSecondaryButtonText: { color: '#0ea5a4', fontSize: 15, fontWeight: '800' },
  gatePrimaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0ea5a4',
  },
  gatePrimaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  fieldBlock: { marginBottom: 14 },
  fieldLabel: { color: '#0f172a', fontSize: 13, fontWeight: '800', marginBottom: 8 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#0f172a', fontSize: 15 },
  sectionTitle: { marginTop: 4, marginBottom: 10, color: '#0f172a', fontSize: 14, fontWeight: '800' },
  uploadBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbeff0',
    backgroundColor: '#eefafa',
    marginBottom: 14,
  },
  uploadText: { color: '#0f172a', fontSize: 13, flex: 1, lineHeight: 18 },
  submitButton: {
    marginTop: 6,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#0ea5a4',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
