import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions, KeyboardAvoidingView, Platform, ScrollView, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// TODO: API 연동을 위한 타입 정의
export interface OwnerHoursManageData {
  id: string;
}

const { width } = Dimensions.get('window');

export default function OwnerHoursManageScreen() {
  const router = useRouter();
  
  // TODO: API 데이터 연동용 state (현재는 빈 배열로 empty state 렌더링)
  const [data, setData] = useState<OwnerHoursManageData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // TODO: 데이터 패칭 함수 자리
  const fetchData = async () => {
    try {
      setIsLoading(true);
      // await api.get('/endpoint');
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
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
          <Text style={styles.headerTitle}>운영시간 관리</Text>
          <View style={{width: 28}} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            
            {/* Glassmorphism Card */}
            <View style={styles.card}>
              
              <View style={styles.inputContainer}>
                <Ionicons name="create-outline" size={20} color="rgba(255, 255, 255, 0.7)" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="입력해주세요"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                />
              </View>
              

              {/* Empty State */}
              <View style={styles.emptyState}>
                <Ionicons name="folder-open-outline" size={54} color="rgba(255,255,255,0.3)" />
                <Text style={styles.emptyStateText}>
                  작성된 내용이 없습니다.
                </Text>
                <Text style={styles.emptyStateSubText}>
                  나중에 API 연결 시 여기에 데이터가 표시됩니다.
                </Text>
              </View>
            </View>

            {/* Action Button */}
            <TouchableOpacity style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>
                제출하기
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
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
    borderRadius: 28,
    padding: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 24,
    minHeight: 300,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
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
    borderRadius: 20,
    paddingVertical: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#312e81',
    fontSize: 17,
    fontWeight: 'bold',
  }
});
