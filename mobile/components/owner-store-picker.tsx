import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { OwnerLinkedStoreResponse } from '@/services/api/owner';

export function OwnerStorePicker({
  stores,
  selectedStoreId,
  selectedStore,
  title = '매장 선택',
  onSelect,
}: {
  stores: OwnerLinkedStoreResponse[];
  selectedStoreId: number | null;
  selectedStore?: OwnerLinkedStoreResponse | null;
  title?: string;
  onSelect: (storeId: number) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {stores.map((store) => {
          const active = selectedStoreId === store.storeId;
          return (
            <TouchableOpacity
              key={store.storeId}
              style={[styles.chip, active ? styles.chipActive : null]}
              activeOpacity={0.9}
              onPress={() => onSelect(store.storeId)}
            >
              <Text style={[styles.chipText, active ? styles.chipTextActive : null]} numberOfLines={1}>
                {store.storeName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <Text style={styles.selectedName} numberOfLines={1}>
        {selectedStore?.storeName ?? '매장을 선택해주세요'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#dbe7ec',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    marginBottom: 12,
  },
  title: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 8,
  },
  chipRow: {
    gap: 10,
    paddingRight: 6,
  },
  chip: {
    minWidth: 112,
    maxWidth: 172,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#dbe7ec',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: '#e6fbfa',
    borderColor: '#0ea5a4',
    borderWidth: 2,
  },
  chipText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '900',
  },
  chipTextActive: {
    color: '#0ea5a4',
  },
  selectedName: {
    marginTop: 14,
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
  },
});
