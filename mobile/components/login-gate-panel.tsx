import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type LoginGatePanelProps = {
  title: string;
  subtitle: string;
  onLogin: () => void;
  onSignup: () => void;
};

export function LoginGatePanel({ title, subtitle, onLogin, onSignup }: LoginGatePanelProps) {
  return (
    <View style={styles.gateCard}>
      <View style={styles.gateIconWrap}>
        <Ionicons name="lock-closed-outline" size={24} color="#18a5a5" />
      </View>
      <Text style={styles.gateTitle}>{title}</Text>
      <Text style={styles.gateSubtitle}>{subtitle}</Text>
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

const styles = StyleSheet.create({
  gateCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 22,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    alignItems: 'center',
  },
  gateIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  gateTitle: {
    color: '#191f28',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  gateSubtitle: {
    marginTop: 8,
    color: '#6b7684',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    textAlign: 'center',
  },
  gateButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  gateSecondaryButton: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#eef1f5',
    borderWidth: 1,
    borderColor: '#eef1f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateSecondaryButtonText: {
    color: '#4e5968',
    fontSize: 13,
    fontWeight: '900',
  },
  gatePrimaryButton: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#18a5a5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gatePrimaryButtonText: {
    color: '#f9fafb',
    fontSize: 13,
    fontWeight: '900',
  },
});
