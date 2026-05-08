import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ownerApi, storeMenusApi, tokenStore } from '@/services/api';
import type { OwnerLinkedStoreResponse } from '@/services/api/owner';
import type { StoreMenuItem } from '@/services/api/storeMenus';

type MenuDraft = {
  name: string;
  price: string;
  description: string;
  imageUrl: string;
  representative: boolean;
  available: boolean;
};

const EMPTY_DRAFT: MenuDraft = {
  name: '',
  price: '',
  description: '',
  imageUrl: '',
  representative: false,
  available: true,
};

function GatePanel({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  return (
    <View style={styles.gateCard}>
      <View style={styles.gateIconWrap}>
        <Ionicons name="lock-closed-outline" size={24} color="#0ea5a4" />
      </View>
      <Text style={styles.gateTitle}>메뉴 관리는 로그인 후 가능해요</Text>
      <Text style={styles.gateSubtitle}>점주 계정으로 로그인하면 메뉴를 보고 수정할 수 있어요.</Text>
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

function StoreChip({
  store,
  active,
  onPress,
}: {
  store: OwnerLinkedStoreResponse;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.storeChip, active ? styles.storeChipActive : null]} onPress={onPress} activeOpacity={0.9}>
      <Text style={[styles.storeChipText, active ? styles.storeChipTextActive : null]} numberOfLines={1}>
        {store.storeName}
      </Text>
    </TouchableOpacity>
  );
}

function MenuRow({
  draft,
  onChange,
  onRemove,
}: {
  draft: MenuDraft;
  onChange: (next: MenuDraft) => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.menuRow}>
      <View style={styles.menuRowTop}>
        <TextInput
          style={styles.menuInput}
          value={draft.name}
          onChangeText={(name) => onChange({ ...draft, name })}
          placeholder="메뉴명"
          placeholderTextColor="#94a3b8"
        />
        <TextInput
          style={[styles.menuInput, styles.priceInput]}
          value={draft.price}
          onChangeText={(price) => onChange({ ...draft, price })}
          placeholder="가격"
          placeholderTextColor="#94a3b8"
          keyboardType="numeric"
        />
      </View>
      <TextInput
        style={styles.menuDescription}
        value={draft.description}
        onChangeText={(description) => onChange({ ...draft, description })}
        placeholder="설명"
        placeholderTextColor="#94a3b8"
        multiline
      />
      <View style={styles.menuFlagsRow}>
        <TouchableOpacity
          style={[styles.flagButton, draft.representative ? styles.flagButtonActive : null]}
          onPress={() => onChange({ ...draft, representative: !draft.representative })}
          activeOpacity={0.9}
        >
          <Text style={[styles.flagText, draft.representative ? styles.flagTextActive : null]}>대표</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.flagButton, draft.available ? styles.flagButtonActive : null]}
          onPress={() => onChange({ ...draft, available: !draft.available })}
          activeOpacity={0.9}
        >
          <Text style={[styles.flagText, draft.available ? styles.flagTextActive : null]}>판매중</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.removeButton} onPress={onRemove} activeOpacity={0.9}>
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
      <TextInput
        style={styles.imageInput}
        value={draft.imageUrl}
        onChangeText={(imageUrl) => onChange({ ...draft, imageUrl })}
        placeholder="이미지 URL"
        placeholderTextColor="#94a3b8"
      />
    </View>
  );
}

export default function OwnerMenuManageScreen() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stores, setStores] = useState<OwnerLinkedStoreResponse[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [menuItems, setMenuItems] = useState<StoreMenuItem[]>([]);
  const [drafts, setDrafts] = useState<MenuDraft[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const token = await tokenStore.getAccessToken();
      if (!active) return;

      setIsLoggedIn(Boolean(token));
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await ownerApi.listStores();
        if (!active) return;
        setStores(response);
        const first = response[0] ?? null;
        setSelectedStoreId(first?.storeId ?? null);

        if (first) {
          const menus = await storeMenusApi.getMyStoreMenus(first.storeId);
          if (!active) return;
          setMenuItems(menus.items);
          setDrafts(
            menus.items.length > 0
              ? menus.items.map((item) => ({
                  name: item.name,
                  price: String(item.price),
                  description: item.description ?? '',
                  imageUrl: item.imageUrl ?? '',
                  representative: item.representative,
                  available: item.available,
                }))
              : [EMPTY_DRAFT]
          );
        }
      } catch {
        if (!active) return;
        setStores([]);
        setMenuItems([]);
        setDrafts([EMPTY_DRAFT]);
      } finally {
        if (!active) return;
        setIsLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const selectedStore = useMemo(
    () => stores.find((store) => store.storeId === selectedStoreId) ?? null,
    [selectedStoreId, stores]
  );

  const selectStore = async (storeId: number) => {
    const store = stores.find((item) => item.storeId === storeId);
    if (!store) return;

    setSelectedStoreId(storeId);
    try {
      setIsLoading(true);
      const menus = await storeMenusApi.getMyStoreMenus(storeId);
      setMenuItems(menus.items);
      setDrafts(
        menus.items.length > 0
          ? menus.items.map((item) => ({
              name: item.name,
              price: String(item.price),
              description: item.description ?? '',
              imageUrl: item.imageUrl ?? '',
              representative: item.representative,
              available: item.available,
            }))
          : [EMPTY_DRAFT]
      );
    } catch {
      setMenuItems([]);
      setDrafts([EMPTY_DRAFT]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedStore) {
      Alert.alert('매장 선택', '먼저 매장을 선택해주세요.');
      return;
    }

    const normalizedItems = drafts
      .filter((item) => item.name.trim().length > 0)
      .map((item, index) => ({
        name: item.name.trim(),
        price: Number(item.price) || 0,
        representative: item.representative,
        description: item.description.trim(),
        imageUrl: item.imageUrl.trim(),
        displayOrder: index,
        available: item.available,
      }));

    if (normalizedItems.length === 0) {
      Alert.alert('메뉴 확인', '최소 1개의 메뉴를 입력해주세요.');
      return;
    }

    try {
      setIsSaving(true);
      const response = await storeMenusApi.replaceMyStoreMenus(selectedStore.storeId, {
        menus: normalizedItems,
      });
      setMenuItems(response.items);
      setDrafts(
        response.items.map((item) => ({
          name: item.name,
          price: String(item.price),
          description: item.description ?? '',
          imageUrl: item.imageUrl ?? '',
          representative: item.representative,
          available: item.available,
        }))
      );
      Alert.alert('저장 완료', '메뉴가 저장되었어요.');
    } catch (error) {
      Alert.alert('저장 실패', error instanceof Error ? error.message : '메뉴 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={24} color="#0ea5a4" />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>메뉴 관리</Text>
            <Text style={styles.headerSubtitle}>내 매장의 메뉴를 불러오고 수정할 수 있어요.</Text>
          </View>
        </View>

        {!isLoggedIn ? (
          <GatePanel onLogin={() => router.push('/views/owner_login')} onSignup={() => router.push('/views/owner_signup')} />
        ) : isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#0ea5a4" />
            <Text style={styles.loadingText}>메뉴를 불러오는 중...</Text>
          </View>
        ) : stores.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="restaurant-outline" size={28} color="#94a3b8" />
            <Text style={styles.emptyTitle}>연결된 매장이 없어요</Text>
            <Text style={styles.emptySubtitle}>매장 등록이 승인되면 메뉴를 관리할 수 있어요.</Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>매장 선택</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storeChips}>
                {stores.map((store) => (
                  <StoreChip
                    key={store.storeId}
                    store={store}
                    active={selectedStoreId === store.storeId}
                    onPress={() => void selectStore(store.storeId)}
                  />
                ))}
              </ScrollView>
              <Text style={styles.selectedStoreName} numberOfLines={1}>
                {selectedStore?.storeName ?? '매장을 선택해주세요'}
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>메뉴 목록</Text>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => setDrafts((current) => [...current, { ...EMPTY_DRAFT }])}
                  activeOpacity={0.9}
                >
                  <Ionicons name="add" size={16} color="#0ea5a4" />
                  <Text style={styles.addButtonText}>추가</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.helperText}>메뉴명을 입력하고 가격을 적은 뒤 저장 버튼을 눌러주세요.</Text>

              <View style={styles.menuList}>
                {drafts.map((draft, index) => (
                  <MenuRow
                    key={`${index}-${draft.name}`}
                    draft={draft}
                    onChange={(next) =>
                      setDrafts((current) => current.map((item, itemIndex) => (itemIndex === index ? next : item)))
                    }
                    onRemove={() => setDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  />
                ))}
              </View>

              {menuItems.length > 0 ? (
                <View style={styles.currentMenusBox}>
                  <Text style={styles.sectionTitle}>현재 저장된 메뉴</Text>
                  {menuItems.map((item) => (
                    <View key={String(item.menuId ?? `${item.name}-${item.displayOrder}`)} style={styles.currentMenuItem}>
                      <Text style={styles.currentMenuTitle}>
                        {item.name} {item.representative ? '· 대표' : ''}
                      </Text>
                      <Text style={styles.currentMenuSub}>
                        {item.price.toLocaleString()}원 · {item.available ? '판매중' : '판매중지'}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <TouchableOpacity style={styles.primaryButton} onPress={handleSave} activeOpacity={0.9} disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>저장하기</Text>
                    <Ionicons name="chevron-forward" size={18} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fbff' },
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
  loadingCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginTop: 10 },
  emptySubtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 8, lineHeight: 18 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a' },
  sectionSubtitle: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  helperText: { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 12 },
  storeChips: { gap: 10, paddingRight: 4 },
  storeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dbeff0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
  },
  storeChipActive: {
    borderColor: '#0ea5a4',
    backgroundColor: '#eefafa',
  },
  storeChipText: { color: '#334155', fontSize: 13, fontWeight: '700' },
  storeChipTextActive: { color: '#0ea5a4' },
  selectedStoreName: { marginTop: 12, fontSize: 18, fontWeight: '900', color: '#0f172a' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#bfeceb',
    backgroundColor: '#eefafa',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addButtonText: { color: '#0ea5a4', fontSize: 12, fontWeight: '800' },
  menuList: { gap: 12, marginTop: 8 },
  menuRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#f8fafc',
    padding: 14,
  },
  menuRowTop: { flexDirection: 'row', gap: 10 },
  menuInput: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    color: '#0f172a',
  },
  priceInput: { flexBasis: 96, flexGrow: 0 },
  menuDescription: {
    minHeight: 76,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
    textAlignVertical: 'top',
  },
  menuFlagsRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 10 },
  flagButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#fff',
  },
  flagButtonActive: {
    borderColor: '#0ea5a4',
    backgroundColor: '#eefafa',
  },
  flagText: { color: '#334155', fontSize: 12, fontWeight: '800' },
  flagTextActive: { color: '#0ea5a4' },
  removeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff7f7',
  },
  imageInput: {
    marginTop: 10,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    color: '#0f172a',
  },
  currentMenusBox: {
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: '#eefafa',
    borderWidth: 1,
    borderColor: '#dbeff0',
    padding: 14,
  },
  currentMenuItem: {
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginTop: 10,
  },
  currentMenuTitle: { color: '#0f172a', fontSize: 14, fontWeight: '800' },
  currentMenuSub: { color: '#64748b', fontSize: 12, marginTop: 4 },
  primaryButton: {
    marginTop: 14,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#0ea5a4',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
