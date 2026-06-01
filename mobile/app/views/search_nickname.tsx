import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View, Text, StyleSheet, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { publicMapsApi, type PublicMapSearchItemResponse } from '@/services/api';
import { tokenStore } from '@/services/api';

function LoginGatePanel({
  onLogin,
  onSignup,
}: {
  onLogin: () => void;
  onSignup: () => void;
}) {
  return (
    <View style={styles.gateCard}>
      <View style={styles.gateIconWrap}>
        <Ionicons name="lock-closed-outline" size={24} color="#18a5a5" />
      </View>
      <Text style={styles.gateTitle}>사람들 지도를 보려면 로그인하세요</Text>
      <Text style={styles.gateSubtitle}>다른 사람들의 추천 장소와 코멘트를 확인해볼 수 있어요.</Text>
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

export default function SearchNicknameScreen() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [results, setResults] = useState<PublicMapSearchItemResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const loadAuth = useCallback(async () => {
    const token = await tokenStore.getAccessToken();
    setIsLoggedIn(Boolean(token));
  }, []);

  useEffect(() => {
    void loadAuth();
  }, [loadAuth]);

  useFocusEffect(
    useCallback(() => {
      void loadAuth();
    }, [loadAuth])
  );

  const searchPublicMaps = async () => {
    if (!nickname.trim()) {
      Alert.alert('검색어 확인', '검색할 닉네임을 입력해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      setHasSearched(true);
      const response = await publicMapsApi.search(nickname.trim());
      setResults(response.content);
    } catch (error) {
      Alert.alert(
        '검색 실패',
        error instanceof Error ? error.message : '마이지도를 검색하지 못했습니다.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#f2f4f6', '#eef1f5', '#f9fafb']} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#f9fafb" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>마이지도 검색</Text>
          <View style={{width: 28}} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {isLoggedIn ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>다른 유저의 공개 마이지도 찾기</Text>
                <Text style={styles.cardSubtitle}>닉네임으로 검색해서 저장한 장소 목록을 찾아볼 수 있어요.</Text>

                <View style={styles.inputContainer}>
                  <Ionicons name="search-outline" size={20} color="#8b95a1" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="닉네임을 입력해주세요"
                    placeholderTextColor="#8b95a1"
                    value={nickname}
                    onChangeText={setNickname}
                    autoCapitalize="none"
                    returnKeyType="search"
                    onSubmitEditing={searchPublicMaps}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, isLoading ? styles.primaryButtonDisabled : null]}
                  disabled={isLoading}
                  onPress={searchPublicMaps}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#18a5a5" />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>검색하기</Text>
                      <Ionicons name="chevron-forward" size={20} color="#18a5a5" />
                    </>
                  )}
                </TouchableOpacity>

                {isLoading ? null : results.length > 0 ? (
                  <View style={styles.resultList}>
                    {results.map((item) => (
                      <TouchableOpacity
                        key={item.publicMapUuid}
                        style={styles.resultCard}
                        activeOpacity={0.85}
                        onPress={() =>
                          router.push({
                            pathname: '/views/public_map_detail',
                            params: {
                              uuid: item.publicMapUuid,
                              title: item.title ?? '',
                              nickname: item.nickname,
                            },
                          })
                        }
                      >
                        <View style={styles.resultAvatar}>
                          <Ionicons name="person" size={22} color="#f9fafb" />
                        </View>
                        <View style={styles.resultContent}>
                          <Text style={styles.resultNickname}>{item.nickname}</Text>
                          <Text style={styles.resultTitle}>{item.title || '공개 마이지도'}</Text>
                          {item.description ? (
                            <Text style={styles.resultDescription} numberOfLines={2}>
                              {item.description}
                            </Text>
                          ) : null}
                          <Text style={styles.resultMeta}>저장 장소 {item.savedPlaceCount}개</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#8b95a1" />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <Ionicons
                      name={hasSearched ? 'search-outline' : 'map-outline'}
                      size={54}
                      color="#8b95a1"
                    />
                    <Text style={styles.emptyStateText}>
                      {hasSearched ? '검색 결과가 없습니다.' : '닉네임을 검색해보세요.'}
                    </Text>
                    <Text style={styles.emptyStateSubText}>
                      공개 설정된 유저의 마이지도만 검색됩니다.
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <LoginGatePanel
                onLogin={() => router.replace('/views/user_login')}
                onSignup={() => router.replace('/views/user_signup')}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#191f28',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 50,
  },
  card: {
    width: '100%',
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
  },
  cardTitle: {
    color: '#191f28',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  cardSubtitle: {
    color: '#6b7684',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 22,
  },
  gateCard: {
    width: '100%',
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    shadowColor: '#191f28',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  gateIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  gateTitle: {
    color: '#191f28',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 27,
  },
  gateSubtitle: {
    color: '#6b7684',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  gateButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  gateSecondaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateSecondaryButtonText: {
    color: '#18a5a5',
    fontSize: 16,
    fontWeight: '800',
  },
  gatePrimaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 18,
    backgroundColor: '#18a5a5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gatePrimaryButtonText: {
    color: '#f9fafb',
    fontSize: 16,
    fontWeight: '800',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef1f5',
    borderRadius: 16,
    width: '100%',
    paddingHorizontal: 20,
    height: 56,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e8eb',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#191f28',
    fontSize: 16,
  },
  resultList: {
    gap: 12,
    marginTop: 22,
  },
  resultCard: {
    minHeight: 96,
    borderRadius: 16,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  resultContent: {
    flex: 1,
    minWidth: 0,
  },
  resultNickname: {
    color: '#18a5a5',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  resultTitle: {
    color: '#191f28',
    fontSize: 17,
    fontWeight: '800',
  },
  resultDescription: {
    color: '#6b7684',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  resultMeta: {
    color: '#8b95a1',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    color: '#191f28',
    marginTop: 20,
    fontSize: 17,
    fontWeight: '600',
  },
  emptyStateSubText: {
    color: '#6b7684',
    marginTop: 10,
    fontSize: 13,
  },
  primaryButton: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.72,
  },
  primaryButtonText: {
    color: '#18a5a5',
    fontSize: 17,
    fontWeight: 'bold',
    marginRight: 6,
  }
});
