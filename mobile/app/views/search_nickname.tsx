import React, { useState } from 'react';
import { ActivityIndicator, Alert, View, Text, StyleSheet, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { publicMapsApi, type PublicMapSearchItemResponse } from '@/services/api';

export default function SearchNicknameScreen() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [results, setResults] = useState<PublicMapSearchItemResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

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
      <LinearGradient colors={['#1e293b', '#312e81', '#4c1d95']} style={styles.container}>
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
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>마이지도 검색</Text>
          <View style={{width: 28}} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>다른 유저의 공개 마이지도 찾기</Text>
              <Text style={styles.cardSubtitle}>닉네임으로 검색해서 저장한 장소 목록을 찾아볼 수 있어요.</Text>

              <View style={styles.inputContainer}>
                <Ionicons name="search-outline" size={20} color="rgba(255, 255, 255, 0.7)" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="닉네임을 입력해주세요"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
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
                  <ActivityIndicator color="#312e81" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>검색하기</Text>
                    <Ionicons name="chevron-forward" size={20} color="#312e81" />
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
                      onPress={() => Alert.alert('공개 마이지도', `지도 ID: ${item.publicMapUuid}`)}
                    >
                      <View style={styles.resultAvatar}>
                        <Ionicons name="person" size={22} color="#fff" />
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
                      <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.48)" />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons
                    name={hasSearched ? 'search-outline' : 'map-outline'}
                    size={54}
                    color="rgba(255,255,255,0.3)"
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
    color: '#FFF',
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
  },
  cardTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  cardSubtitle: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    width: '100%',
    paddingHorizontal: 20,
    height: 56,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
  },
  resultList: {
    gap: 12,
    marginTop: 22,
  },
  resultCard: {
    minHeight: 96,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(140,180,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  resultContent: {
    flex: 1,
    minWidth: 0,
  },
  resultNickname: {
    color: '#8cb4ff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  resultTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  resultDescription: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  resultMeta: {
    color: 'rgba(255,255,255,0.5)',
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
    color: 'rgba(255,255,255,0.8)',
    marginTop: 20,
    fontSize: 17,
    fontWeight: '600',
  },
  emptyStateSubText: {
    color: 'rgba(255,255,255,0.5)',
    marginTop: 10,
    fontSize: 13,
  },
  primaryButton: {
    backgroundColor: '#fff',
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
    color: '#312e81',
    fontSize: 17,
    fontWeight: 'bold',
    marginRight: 6,
  }
});
