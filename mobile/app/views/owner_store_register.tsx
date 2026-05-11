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
import * as DocumentPicker from 'expo-document-picker';
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
;

type FormState = Record<FieldKey, string>;

const INITIAL_FORM: FormState = {
  storeName: '',
  businessNumber: '',
  representativeName: '',
  businessOpenDate: '',
  businessAddress: '',
  businessPhone: '',
};

type BusinessLicenseFile = {
  uri: string;
  name: string;
  type: string;
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
  required = false,
  helperText,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad' | 'number-pad';
  required?: boolean;
  helperText?: string;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.requiredMark}> *필수</Text> : null}
      </Text>
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
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}

export default function OwnerStoreRegisterScreen() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [licenseFile, setLicenseFile] = useState<BusinessLicenseFile | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  const businessNumberDigits = useMemo(() => form.businessNumber.replace(/[^0-9]/g, ''), [form.businessNumber]);
  const businessPhoneDigits = useMemo(() => form.businessPhone.replace(/[^0-9]/g, ''), [form.businessPhone]);
  const isBusinessOpenDateValid = useMemo(() => /^\d{4}-\d{2}-\d{2}$/.test(form.businessOpenDate.trim()), [form.businessOpenDate]);

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
      businessNumberDigits.length === 10 &&
      form.representativeName.trim().length >= 2 &&
      isBusinessOpenDateValid &&
      form.businessAddress.trim().length >= 5 &&
      businessPhoneDigits.length >= 9 &&
      licenseFile !== null
    );
  }, [businessNumberDigits.length, businessPhoneDigits.length, form, isBusinessOpenDateValid, licenseFile]);

  const updateField = (key: FieldKey, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const pickBusinessLicenseFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        multiple: false,
        copyToCacheDirectory: true,
        base64: false,
      });

      if (result.canceled || !result.assets?.length) {
        console.log('[owner_store_register] business license picker canceled');
        return;
      }

      const asset = result.assets[0];
      const inferredType = asset.mimeType ?? (asset.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

      const nextFile: BusinessLicenseFile = {
        uri: asset.uri,
        name: asset.name || 'business-license.jpg',
        type: inferredType,
      };

      console.log('[owner_store_register] business license file selected', {
        uri: nextFile.uri,
        name: nextFile.name,
        type: nextFile.type,
      });

      setLicenseFile(nextFile);
    } catch (error) {
      console.log('[owner_store_register] business license picker error', error);
      Alert.alert('파일 선택 실패', error instanceof Error ? error.message : '사업자등록증 파일을 선택하지 못했어요.');
    }
  };

  const handleSubmit = async () => {
    if (!isFormValid) {
      if (businessNumberDigits.length !== 10) {
        Alert.alert('입력 확인', '사업자등록번호는 숫자 10자리여야 해요. 하이픈은 있어도 됩니다.');
        return;
      }

      if (!isBusinessOpenDateValid) {
        Alert.alert('입력 확인', '개업일은 YYYY-MM-DD 형식으로 입력해 주세요.');
        return;
      }

      if (businessPhoneDigits.length < 9) {
        Alert.alert('입력 확인', '대표 전화번호를 다시 확인해 주세요.');
        return;
      }

      Alert.alert('입력 확인', '필수 항목을 모두 채워주세요.');
      return;
    }

    if (!licenseFile) {
      Alert.alert('입력 확인', '사업자등록증 파일을 선택해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      const requestPayload = {
        storeName: form.storeName.trim(),
        businessNumber: form.businessNumber.trim(),
        representativeName: form.representativeName.trim(),
        businessOpenDate: form.businessOpenDate.trim(),
        businessAddress: form.businessAddress.trim(),
        businessPhone: form.businessPhone.trim(),
      };

      console.log('store application submit');
      console.log('request payload', requestPayload);
      console.log('selected file', {
        uri: licenseFile.uri,
        name: licenseFile.name,
        type: licenseFile.type,
      });

      const applicationResponse = await ownerApi.createApplicationDetailed(
        requestPayload,
        licenseFile
      );

      console.log('[owner_store_register] application submit response', {
        status: applicationResponse.status,
        success: applicationResponse.success,
        data: applicationResponse.data,
        errorMessage: applicationResponse.error?.message ?? null,
      });

      if (!applicationResponse.success) {
        Alert.alert(
          '매장 등록 신청 실패',
          applicationResponse.error?.message ?? '매장 등록 신청이 처리되지 않았어요.'
        );
        return;
      }

      Alert.alert('신청 완료', '매장 등록 신청이 접수되었습니다.');
      router.push('/views/owner_register_status');
    } catch (error) {
      console.log('[owner_store_register] submit failed', error);

      if (error instanceof Error) {
        const message = error.message || '매장 등록 신청 중 문제가 발생했습니다.';

        if (message.includes('연결할 수 없습니다') || message.includes('같은 와이파이')) {
          Alert.alert('네트워크 오류', message);
          return;
        }

        Alert.alert('신청 실패', message);
        return;
      }

      Alert.alert('신청 실패', '매장 등록 신청 중 문제가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.replace('/views/owner_dashboard')} style={styles.backButton} activeOpacity={0.8}>
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
                required
              />
              <InputRow
                label="사업자등록번호"
                value={form.businessNumber}
                onChangeText={(value) => updateField('businessNumber', value)}
                placeholder="예: 123-45-67890"
                icon="card-outline"
                keyboardType="numeric"
                required
                helperText="숫자 10자리로 입력해 주세요. 하이픈은 있어도 됩니다."
              />
              <InputRow
                label="대표자명"
                value={form.representativeName}
                onChangeText={(value) => updateField('representativeName', value)}
                placeholder="예: 홍길동"
                icon="person-outline"
                required
              />
              <InputRow
                label="개업일"
                value={form.businessOpenDate}
                onChangeText={(value) => updateField('businessOpenDate', value)}
                placeholder="예: 2026-05-01"
                icon="calendar-outline"
                required
                helperText="YYYY-MM-DD 형식으로 입력해 주세요."
              />
              <InputRow
                label="사업장 주소"
                value={form.businessAddress}
                onChangeText={(value) => updateField('businessAddress', value)}
                placeholder="예: 경기 안양시 만안구 ..."
                icon="location-outline"
                required
              />
              <InputRow
                label="대표 전화번호"
                value={form.businessPhone}
                onChangeText={(value) => updateField('businessPhone', value)}
                placeholder="예: 031-123-4567"
                icon="call-outline"
                keyboardType="phone-pad"
                required
                helperText="하이픈이 있어도 되고 없어도 돼요."
              />

              <Text style={styles.sectionTitle}>사업자등록증 파일 <Text style={styles.requiredMark}>*필수</Text></Text>
              <TouchableOpacity style={styles.uploadBox} onPress={pickBusinessLicenseFile} activeOpacity={0.88}>
                <MaterialCommunityIcons name="file-image-plus-outline" size={22} color="#0ea5a4" />
                <View style={styles.uploadCopy}>
                  <Text style={styles.uploadTitle}>
                    {licenseFile ? '사업자등록증 파일이 선택됐어요' : '사업자등록증 파일 1개 선택'}
                  </Text>
                  <Text style={styles.uploadText}>
                    {licenseFile
                      ? `${licenseFile.name} · ${licenseFile.type}`
                      : '이미지 또는 PDF 파일 하나만 고를 수 있어요.'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#0ea5a4" />
              </TouchableOpacity>
              {licenseFile ? (
                <View style={styles.selectedFileCard}>
                  <Ionicons name="document-text-outline" size={18} color="#0ea5a4" />
                  <View style={styles.selectedFileTextWrap}>
                    <Text style={styles.selectedFileName}>{licenseFile.name}</Text>
                    <Text style={styles.selectedFileMeta}>{licenseFile.type}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setLicenseFile(null)}
                    activeOpacity={0.8}
                    style={styles.removeFileButton}
                  >
                    <Ionicons name="close" size={16} color="#64748b" />
                  </TouchableOpacity>
                </View>
              ) : null}

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
  requiredMark: { color: '#dc2626', fontSize: 12, fontWeight: '800' },
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
  helperText: { marginTop: 6, color: '#64748b', fontSize: 12, lineHeight: 16 },
  sectionTitle: { marginTop: 4, marginBottom: 10, color: '#0f172a', fontSize: 14, fontWeight: '800' },
  uploadBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbeff0',
    backgroundColor: '#eefafa',
    marginBottom: 14,
  },
  uploadCopy: { flex: 1 },
  uploadTitle: { color: '#0f172a', fontSize: 14, fontWeight: '800', marginBottom: 4 },
  uploadText: { color: '#0f172a', fontSize: 13, flex: 1, lineHeight: 18 },
  selectedFileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    marginTop: -2,
    marginBottom: 14,
  },
  selectedFileTextWrap: { flex: 1 },
  selectedFileName: { color: '#0f172a', fontSize: 14, fontWeight: '800', marginBottom: 2 },
  selectedFileMeta: { color: '#64748b', fontSize: 12 },
  removeFileButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2f7',
  },
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
