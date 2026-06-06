import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBottomNav } from '@/components/app-bottom-nav';
import { FullscreenImageViewer } from '@/components/fullscreen-image-viewer';
import { LoginGatePanel } from '@/components/login-gate-panel';
import { PageHero } from '@/components/page-hero';
import { getTabScreenContentStyle } from '@/components/screen-layout';
import { ApiClientError, authApi, tokenStore, userMapsApi } from '@/services/api';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

const resolveAssetUrl = (value?: string | null) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_BASE_URL}${value.startsWith('/') ? value : `/${value}`}`;
};

function StatCard({
  icon,
  value,
  label,
  tone = 'teal',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  tone?: 'teal' | 'pink' | 'violet';
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIconWrap}>
        <Ionicons name={icon} size={22} color="#18a5a5" />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  tone = 'teal',
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  tone?: 'teal' | 'pink' | 'violet' | 'red';
  onPress: () => void;
}) {
  const iconColor = tone === 'red' ? '#ef4444' : '#18a5a5';

  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.86}>
      <View style={[styles.menuIconWrap, tone === 'red' && styles.menuIconRed]}>
        <Ionicons name={icon} size={21} color={iconColor} />
      </View>
      <View style={styles.menuTextWrap}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#6b7684" />
    </TouchableOpacity>
  );
}

type EditMode = 'nickname' | 'password' | 'profileImage' | null;

export default function MyMapScreen() {
  const router = useRouter();
  const segments = useSegments();
  const showInternalTabBar = segments[0] !== '(tabs)';
  const insets = useSafeAreaInsets();

  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accountRole, setAccountRole] = useState<'USER' | 'OWNER' | 'ADMIN' | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [savedPlaceCount, setSavedPlaceCount] = useState(0);
  const [myMapCount, setMyMapCount] = useState(0);
  const [receivedLikeCount, setReceivedLikeCount] = useState(0);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [savingKey, setSavingKey] = useState<'nickname' | 'password' | 'image' | 'delete' | null>(null);
  const [isInfoMenuVisible, setIsInfoMenuVisible] = useState(false);
  const [activeEditMode, setActiveEditMode] = useState<EditMode>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const profileImageSource = resolveAssetUrl(profileImageUrl);

  const loadProfileState = useCallback(async () => {
    setIsLoading(true);
    const token = await tokenStore.getAccessToken();
    const loggedIn = Boolean(token);
    setIsLoggedIn(loggedIn);

    if (!loggedIn) {
      setAccountRole(null);
      setDisplayName(null);
      setNicknameDraft('');
      setProfileImageUrl(null);
      setSavedPlaceCount(0);
      setMyMapCount(0);
      setReceivedLikeCount(0);
      setIsLoading(false);
      return;
    }

    try {
      const [meResponse, mapsResponse] = await Promise.all([
        authApi.me(),
        userMapsApi.list().catch(() => []),
      ]);

      if (meResponse.role === 'ADMIN') {
        router.replace('/views/admin_owner_applications');
        return;
      }

      setAccountRole(meResponse.role ?? null);
      setDisplayName(meResponse.displayName ?? meResponse.nickname ?? null);
      setNicknameDraft(meResponse.nickname ?? '');
      setProfileImageUrl(meResponse.profileImageUrl ?? null);
      setSavedPlaceCount((meResponse.favorites?.stores ?? []).length);
      setMyMapCount(mapsResponse.length);
      setReceivedLikeCount(mapsResponse.reduce((sum, map) => sum + (map.likeCount ?? 0), 0));
    } catch (error) {
      setIsLoggedIn(false);
      setAccountRole(null);
      setDisplayName(null);
      setNicknameDraft('');
      setProfileImageUrl(null);
      Alert.alert('내 정보 불러오기 실패', error instanceof Error ? error.message : '내 정보를 불러오지 못했어요.');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const handleLogout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      await tokenStore.clear();
    } finally {
      setIsLoggedIn(false);
      setAccountRole(null);
      router.replace('/views/user_login');
    }
  }, [router]);

  const getErrorMessage = useCallback((error: unknown, fallback: string) => {
    if (error instanceof ApiClientError) return error.message;
    if (error instanceof Error) return error.message;
    return fallback;
  }, []);

  const handleSaveNickname = useCallback(async () => {
    const nickname = nicknameDraft.trim();
    if (nickname.length < 2 || nickname.length > 30) {
      Alert.alert('닉네임 확인', '닉네임은 2글자 이상 30글자 이하로 입력해주세요.');
      return;
    }

    setSavingKey('nickname');
    try {
      const response = await authApi.updateNickname(nickname);
      setDisplayName(response.nickname ?? nickname);
      setNicknameDraft(response.nickname ?? nickname);
      setProfileImageUrl(response.profileImageUrl ?? profileImageUrl);
      setActiveEditMode(null);
      Alert.alert('저장 완료', '닉네임을 수정했어요.');
    } catch (error) {
      Alert.alert('닉네임 수정 실패', getErrorMessage(error, '닉네임을 수정하지 못했어요.'));
    } finally {
      setSavingKey(null);
    }
  }, [getErrorMessage, nicknameDraft, profileImageUrl]);

  const handleChangePassword = useCallback(async () => {
    if (!currentPassword) {
      Alert.alert('비밀번호 확인', '현재 비밀번호를 입력해주세요.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('비밀번호 확인', '새 비밀번호는 8자 이상으로 입력해주세요.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      Alert.alert('비밀번호 확인', '새 비밀번호가 서로 일치하지 않습니다.');
      return;
    }

    setSavingKey('password');
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
      setActiveEditMode(null);
      Alert.alert('변경 완료', '비밀번호를 변경했어요.');
    } catch (error) {
      Alert.alert('비밀번호 변경 실패', getErrorMessage(error, '비밀번호를 변경하지 못했어요.'));
    } finally {
      setSavingKey(null);
    }
  }, [currentPassword, getErrorMessage, newPassword, newPasswordConfirm]);

  const handleUpdateProfileImage = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (!file?.uri) {
        Alert.alert('파일 선택 실패', '이미지 파일을 읽지 못했어요.');
        return;
      }

      setSavingKey('image');
      const response = await authApi.updateProfileImage({
        uri: file.uri,
        name: file.name ?? 'profile-image.jpg',
        type: file.mimeType ?? 'image/jpeg',
      });

      setProfileImageUrl(response.profileImageUrl ?? null);
      setDisplayName(response.nickname ?? displayName);
      setActiveEditMode(null);
      Alert.alert('저장 완료', '프로필 이미지를 수정했어요.');
    } catch (error) {
      Alert.alert('프로필 이미지 수정 실패', getErrorMessage(error, '프로필 이미지를 수정하지 못했어요.'));
    } finally {
      setSavingKey(null);
    }
  }, [displayName, getErrorMessage]);

  const handleDeleteAccount = useCallback(() => {
    setIsInfoMenuVisible(false);
    Alert.alert('회원탈퇴', '정말 회원탈퇴를 진행하시겠습니까? 이 작업은 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '탈퇴하기',
        style: 'destructive',
        onPress: async () => {
          setSavingKey('delete');
          try {
            await authApi.deleteMe();
            Alert.alert('탈퇴 완료', '계정이 삭제되었습니다.');
            router.replace('/views/user_login');
          } catch (error) {
            Alert.alert('회원탈퇴 실패', getErrorMessage(error, '회원탈퇴를 처리하지 못했어요.'));
          } finally {
            setSavingKey(null);
          }
        },
      },
    ]);
  }, [getErrorMessage, router]);

  useFocusEffect(
    useCallback(() => {
      void loadProfileState();
    }, [loadProfileState])
  );

  const openEditMode = useCallback((mode: Exclude<EditMode, null>) => {
    setIsInfoMenuVisible(false);
    setActiveEditMode(mode);
  }, []);

  const closeEditMode = useCallback(() => {
    setActiveEditMode(null);
  }, []);
  const closePreview = useCallback(() => setPreviewImageUrl(null), []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, getTabScreenContentStyle(insets)]}
          >
            {isLoading ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator color="#18a5a5" />
                <Text style={styles.loadingText}>내 정보를 불러오는 중이에요</Text>
              </View>
            ) : !isLoggedIn ? (
              <LoginGatePanel
                title="마이페이지를 보려면 로그인하세요"
                subtitle="나의 활동과 설정을 이어서 확인할 수 있어요."
                onLogin={() => router.replace('/views/user_login')}
                onSignup={() => router.replace('/views/user_signup')}
              />
            ) : (
              <>
                <PageHero
                  title="마이페이지"
                  subtitle="나의 활동과 설정을 한눈에 확인해요"
                  rightIcon="log-out-outline"
                  rightIconColor="#18a5a5"
                  rightIconBackground="#edf8f8"
                  onRightPress={() => void handleLogout()}
                />

                <View style={styles.profileHero}>
                  <View style={styles.heroContent}>
                    <TouchableOpacity
                      style={styles.avatarCircle}
                      activeOpacity={0.9}
                      onPress={() => {
                        if (profileImageSource) {
                          setPreviewImageUrl(profileImageSource);
                        }
                      }}
                      disabled={!profileImageSource}
                    >
                      {profileImageSource ? (
                        <Image source={{ uri: profileImageSource }} style={styles.avatarImage} />
                      ) : (
                        <Text style={styles.avatarLetter}>{(displayName || nicknameDraft || 'T').trim().charAt(0).toUpperCase()}</Text>
                      )}
                      <View style={styles.avatarEditBadge}>
                        <Ionicons name="pencil" size={11} color="#18a5a5" />
                      </View>
                    </TouchableOpacity>
                    <View style={styles.heroTextWrap}>
                      <Text style={styles.heroName}>{displayName || nicknameDraft || 'Toggle'}님</Text>
                      <Text style={styles.heroSubtitle}>나만의 장소를 기록하고 공유해보세요</Text>
                    </View>
                  </View>
                  <View style={styles.heroButtonRow}>
                    <TouchableOpacity style={styles.heroPrimaryButton} onPress={() => router.push('/list')} activeOpacity={0.9}>
                      <Ionicons name="map-outline" size={18} color="#f9fafb" />
                      <Text style={styles.heroPrimaryButtonText}>내 지도 보기</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.heroSecondaryButton} onPress={() => setIsInfoMenuVisible(true)} activeOpacity={0.9}>
                      <Ionicons name="person-outline" size={18} color="#18a5a5" />
                      <Text style={styles.heroSecondaryButtonText}>프로필 수정</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.sectionTitle}>내 활동 요약</Text>
                <View style={styles.statsRow}>
                  <StatCard icon="bookmark-outline" value={savedPlaceCount} label="저장한 장소" />
                  <StatCard icon="map-outline" value={myMapCount} label="내 지도" />
                  <StatCard icon="thumbs-up-outline" value={receivedLikeCount} label="좋아요 받은 수" tone="pink" />
                </View>

                <Text style={styles.sectionTitle}>주요 메뉴</Text>
                <View style={styles.menuCard}>
                  <MenuRow
                    icon="map-outline"
                    title="나만의 지도"
                    subtitle="내가 만든 지도를 확인하고 관리해요"
                    onPress={() => router.push('/list')}
                  />
                  <View style={styles.menuDivider} />
                  <MenuRow
                    icon="bookmark-outline"
                    title="저장한 장소"
                    subtitle="저장해둔 장소 목록을 확인해요"
                    onPress={() => router.push('/saved')}
                  />
                  <View style={styles.menuDivider} />
                  <MenuRow
                    icon="thumbs-up-outline"
                    title="내가 좋아요한 지도"
                    subtitle="좋아요한 지도를 모아봤어요"
                    tone="pink"
                    onPress={() => router.push('/views/liked_maps')}
                  />
                  <View style={styles.menuDivider} />
                  <MenuRow
                    icon="chatbubble-ellipses-outline"
                    title="리뷰 관리"
                    subtitle="내가 작성한 리뷰를 확인하고 수정해요"
                    tone="violet"
                    onPress={() => router.push('/views/review_management')}
                  />
                </View>

                {accountRole === 'OWNER' ? (
                  <TouchableOpacity style={styles.ownerCard} onPress={() => router.push('/views/owner_dashboard')} activeOpacity={0.9}>
                    <View style={styles.ownerIconWrap}>
                      <Ionicons name="storefront-outline" size={24} color="#18a5a5" />
                    </View>
                    <View style={styles.ownerTextWrap}>
                      <Text style={styles.ownerTitle}>점주 페이지</Text>
                      <Text style={styles.ownerSubtitle}>매장 알림과 운영 상태를 바로 확인해요</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={19} color="#6b7684" />
                  </TouchableOpacity>
                ) : null}

                <Text style={styles.sectionTitle}>설정</Text>
                <View style={styles.menuCard}>
                  <MenuRow
                    icon="person-circle-outline"
                    title="내정보 수정"
                    subtitle="닉네임, 비밀번호, 프로필 이미지를 관리해요"
                    onPress={() => setIsInfoMenuVisible(true)}
                  />
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>

        <FullscreenImageViewer visible={Boolean(previewImageUrl)} uri={previewImageUrl} onClose={closePreview} title="프로필 사진" />

        <Modal
          visible={isInfoMenuVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setIsInfoMenuVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.bottomSheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>내정보 수정</Text>
                  <Text style={styles.modalSubtitle}>수정할 항목을 선택해주세요.</Text>
                </View>
                <TouchableOpacity style={styles.modalCloseButton} onPress={() => setIsInfoMenuVisible(false)} activeOpacity={0.85}>
                  <Ionicons name="close" size={20} color="#6b7684" />
                </TouchableOpacity>
              </View>
              <View style={styles.menuCard}>
                <MenuRow
                  icon="person-outline"
                  title="닉네임 수정"
                  subtitle="앱에서 보이는 이름을 바꿔요"
                  onPress={() => openEditMode('nickname')}
                />
                <View style={styles.menuDivider} />
                <MenuRow
                  icon="key-outline"
                  title="비밀번호 변경"
                  subtitle="현재 비밀번호 확인 후 변경해요"
                  onPress={() => openEditMode('password')}
                />
                <View style={styles.menuDivider} />
                <MenuRow
                  icon="image-outline"
                  title="프로필 이미지 수정"
                  subtitle="이미지 파일을 선택해서 바꿔요"
                  onPress={() => openEditMode('profileImage')}
                />
                <View style={styles.menuDivider} />
                <MenuRow
                  icon="trash-outline"
                  title="회원탈퇴"
                  subtitle="계정 삭제 전 한 번 더 확인해요"
                  tone="red"
                  onPress={handleDeleteAccount}
                />
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={activeEditMode !== null}
          animationType="fade"
          transparent
          onRequestClose={closeEditMode}
        >
          <View style={styles.centerModalBackdrop}>
            <View style={styles.centerModalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>
                    {activeEditMode === 'nickname'
                      ? '닉네임 수정'
                      : activeEditMode === 'password'
                        ? '비밀번호 변경'
                        : '프로필 이미지 수정'}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {activeEditMode === 'nickname'
                      ? '새 닉네임을 입력해주세요.'
                      : activeEditMode === 'password'
                        ? '현재 비밀번호와 새 비밀번호를 입력해주세요.'
                        : '프로필에 사용할 이미지를 선택해주세요.'}
                  </Text>
                </View>
                <TouchableOpacity style={styles.modalCloseButton} onPress={closeEditMode} activeOpacity={0.85}>
                  <Ionicons name="close" size={20} color="#6b7684" />
                </TouchableOpacity>
              </View>

              {activeEditMode === 'nickname' ? (
                <>
                  <TextInput
                    value={nicknameDraft}
                    onChangeText={setNicknameDraft}
                    placeholder="닉네임"
                    placeholderTextColor="#8b95a1"
                    style={styles.input}
                  />
                  <TouchableOpacity
                    style={[styles.primaryButton, savingKey === 'nickname' && styles.disabledButton]}
                    onPress={() => void handleSaveNickname()}
                    disabled={savingKey === 'nickname'}
                    activeOpacity={0.9}
                  >
                    {savingKey === 'nickname' ? <ActivityIndicator color="#f9fafb" /> : <Ionicons name="checkmark" size={18} color="#f9fafb" />}
                    <Text style={styles.primaryButtonText}>닉네임 저장</Text>
                  </TouchableOpacity>
                </>
              ) : null}

              {activeEditMode === 'password' ? (
                <>
                  <TextInput
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="현재 비밀번호"
                    placeholderTextColor="#8b95a1"
                    secureTextEntry
                    style={styles.input}
                  />
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="새 비밀번호"
                    placeholderTextColor="#8b95a1"
                    secureTextEntry
                    style={styles.input}
                  />
                  <TextInput
                    value={newPasswordConfirm}
                    onChangeText={setNewPasswordConfirm}
                    placeholder="새 비밀번호 확인"
                    placeholderTextColor="#8b95a1"
                    secureTextEntry
                    style={styles.input}
                  />
                  <TouchableOpacity
                    style={[styles.primaryButton, savingKey === 'password' && styles.disabledButton]}
                    onPress={() => void handleChangePassword()}
                    disabled={savingKey === 'password'}
                    activeOpacity={0.9}
                  >
                    {savingKey === 'password' ? <ActivityIndicator color="#f9fafb" /> : <Ionicons name="lock-closed-outline" size={18} color="#f9fafb" />}
                    <Text style={styles.primaryButtonText}>비밀번호 변경</Text>
                  </TouchableOpacity>
                </>
              ) : null}

              {activeEditMode === 'profileImage' ? (
                <View style={styles.imageEditRow}>
                  <View style={styles.imagePreview}>
                    {profileImageSource ? (
                      <Image source={{ uri: profileImageSource }} style={styles.imagePreviewPhoto} />
                    ) : (
                      <Ionicons name="person-outline" size={22} color="#18a5a5" />
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.outlineButton, savingKey === 'image' && styles.disabledOutlineButton]}
                    onPress={() => void handleUpdateProfileImage()}
                    disabled={savingKey === 'image'}
                    activeOpacity={0.9}
                  >
                    {savingKey === 'image' ? <ActivityIndicator color="#18a5a5" /> : <Ionicons name="cloud-upload-outline" size={18} color="#18a5a5" />}
                    <Text style={styles.outlineButtonText}>이미지 선택</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </View>
        </Modal>

        {showInternalTabBar ? <AppBottomNav activeTab="my" /> : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8fa',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
  },
  pageHeroCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    shadowColor: '#191f28',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  pageHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pageHeroBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  pageHeroLogo: {
    width: 36,
    height: 36,
    resizeMode: 'contain',
  },
  pageHeroBrandText: {
    flex: 1,
    minWidth: 0,
  },
  pageHeroBrandTitle: {
    color: '#18a5a5',
    fontSize: 20,
    fontWeight: '900',
  },
  pageHeroBrandSubtitle: {
    color: '#6b7684',
    fontSize: 10,
    fontWeight: '700',
  },
  pageHeroAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageHeroTitle: {
    marginTop: 10,
    color: '#18a5a5',
    fontSize: 26,
    fontWeight: '900',
  },
  pageHeroDescription: {
    marginTop: 4,
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '700',
  },
  loadingCard: {
    minHeight: 180,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '800',
  },
  profileHero: {
    minHeight: 172,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 15,
    shadowColor: '#191f28',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    overflow: 'hidden',
  },
  heroArtwork: {
    position: 'absolute',
    right: -10,
    top: -4,
    width: 160,
    height: 120,
    opacity: 0.9,
  },
  artworkDotA: {
    position: 'absolute',
    right: 22,
    top: 28,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#edf8f8',
  },
  artworkDotB: {
    position: 'absolute',
    right: 52,
    top: 48,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#edf8f8',
  },
  artworkLineA: {
    position: 'absolute',
    right: 10,
    top: 28,
    width: 94,
    height: 1.5,
    backgroundColor: '#eef1f5',
    transform: [{ rotate: '18deg' }],
  },
  artworkLineB: {
    position: 'absolute',
    right: 20,
    top: 44,
    width: 110,
    height: 1.5,
    backgroundColor: '#eef1f5',
    transform: [{ rotate: '35deg' }],
  },
  artworkPin: {
    position: 'absolute',
    right: 18,
    top: 28,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eef1f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingRight: 86,
  },
  avatarCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#18a5a5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarLetter: {
    color: '#f9fafb',
    fontSize: 28,
    fontWeight: '900',
  },
  avatarEditBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  heroName: {
    color: '#191f28',
    fontSize: 17,
    fontWeight: '900',
  },
  heroSubtitle: {
    marginTop: 6,
    color: '#6b7684',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  heroButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
    paddingRight: 96,
  },
  heroPrimaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#18a5a5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroPrimaryButtonText: {
    color: '#f9fafb',
    fontSize: 12,
    fontWeight: '900',
  },
  heroSecondaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroSecondaryButtonText: {
    color: '#18a5a5',
    fontSize: 12,
    fontWeight: '900',
  },
  heroLogoutButton: {
    position: 'absolute',
    right: 14,
    top: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    marginTop: 18,
    marginBottom: 9,
    color: '#191f28',
    fontSize: 15,
    fontWeight: '900',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minHeight: 104,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e3edf2',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  statIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    marginTop: 7,
    color: '#191f28',
    fontSize: 20,
    fontWeight: '900',
  },
  statLabel: {
    marginTop: 3,
    color: '#6b7684',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  menuCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e3edf2',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  menuRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconRed: {
    backgroundColor: '#fee2e2',
  },
  menuTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  menuTitle: {
    color: '#191f28',
    fontSize: 14,
    fontWeight: '900',
  },
  menuSubtitle: {
    marginTop: 2,
    color: '#6b7684',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#edf3f6',
    marginLeft: 54,
  },
  ownerCard: {
    marginTop: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ownerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  ownerTitle: {
    color: '#191f28',
    fontSize: 16,
    fontWeight: '900',
  },
  ownerSubtitle: {
    marginTop: 4,
    color: '#6b7684',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  editSection: {
    gap: 12,
  },
  editCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e3edf2',
    backgroundColor: '#f9fafb',
    padding: 14,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 12,
  },
  editIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  editTitle: {
    color: '#191f28',
    fontSize: 15,
    fontWeight: '900',
  },
  dangerTitle: {
    color: '#991b1b',
    fontSize: 15,
    fontWeight: '900',
  },
  editDescription: {
    marginTop: 3,
    color: '#6b7684',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    color: '#191f28',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: '#18a5a5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#f9fafb',
    fontSize: 14,
    fontWeight: '900',
  },
  outlineButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  outlineButtonText: {
    color: '#18a5a5',
    fontSize: 14,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.7,
  },
  disabledOutlineButton: {
    opacity: 0.6,
  },
  imageEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  imagePreview: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imagePreviewPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  dangerCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#f9fafb',
    padding: 14,
  },
  dangerButton: {
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dangerButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '900',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#f7f8fa',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 22,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 54,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#d1d6db',
    marginBottom: 18,
  },
  centerModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  centerModalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 22,
    backgroundColor: '#f9fafb',
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 14,
  },
  modalTitle: {
    color: '#191f28',
    fontSize: 21,
    fontWeight: '900',
  },
  modalSubtitle: {
    marginTop: 6,
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eef1f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
