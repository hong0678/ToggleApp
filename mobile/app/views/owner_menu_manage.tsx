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
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { OwnerStorePicker } from '@/components/owner-store-picker';
import { useSafeBack } from '@/components/use-safe-back';
import { filesApi, ownerApi, storeMenusApi, tokenStore } from '@/services/api';
import type { OwnerLinkedStoreResponse } from '@/services/api/owner';
import type { StoreMenuItem } from '@/services/api/storeMenus';

type MenuDraft = {
  id: string;
  name: string;
  price: string;
  description: string;
  imageUrl: string;
  representative: boolean;
  available: boolean;
};

const createEmptyDraft = (): MenuDraft => ({
  id: `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  name: '',
  price: '',
  description: '',
  imageUrl: '',
  representative: false,
  available: true,
});

const buildDraftFromMenu = (item: StoreMenuItem, index: number): MenuDraft => ({
  id: item.menuId != null ? `menu-${item.menuId}` : `menu-${index}-${item.displayOrder}`,
  name: item.name,
  price: String(item.price),
  description: item.description ?? '',
  imageUrl: item.imageUrl ?? '',
  representative: item.representative,
  available: item.available,
});

function GatePanel({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  return (
    <View style={styles.gateCard}>
      <View style={styles.gateIconWrap}>
        <Ionicons name="lock-closed-outline" size={24} color="#18a5a5" />
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

function MenuRow({
  draft,
  onChange,
  onRemove,
  onUploadImage,
}: {
  draft: MenuDraft;
  onChange: (next: MenuDraft) => void;
  onRemove: () => void;
  onUploadImage: () => void;
}) {
  return (
    <View style={styles.menuRow}>
      <View style={styles.menuRowTop}>
        <TextInput
          style={[styles.menuInput, styles.menuNameInput]}
          value={draft.name}
          onChangeText={(name) => onChange({ ...draft, name })}
          placeholder="메뉴명"
          placeholderTextColor="#8b95a1"
        />
        <TextInput
          style={[styles.menuInput, styles.priceInput]}
          value={draft.price}
          onChangeText={(price) => onChange({ ...draft, price })}
          placeholder="가격"
          placeholderTextColor="#8b95a1"
          keyboardType="numeric"
        />
      </View>
      <TextInput
        style={styles.menuDescription}
        value={draft.description}
        onChangeText={(description) => onChange({ ...draft, description })}
        placeholder="설명 (길게 적어도 돼요)"
        placeholderTextColor="#8b95a1"
        multiline
        numberOfLines={3}
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
        placeholderTextColor="#8b95a1"
      />
      <TouchableOpacity style={styles.uploadButton} onPress={onUploadImage} activeOpacity={0.9}>
        <Ionicons name="image-outline" size={16} color="#18a5a5" />
        <Text style={styles.uploadButtonText}>이미지 파일 업로드</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function OwnerMenuManageScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/views/owner_dashboard');
  const params = useLocalSearchParams<{ storeId?: string | string[] }>();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stores, setStores] = useState<OwnerLinkedStoreResponse[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [menuItems, setMenuItems] = useState<StoreMenuItem[]>([]);
  const [drafts, setDrafts] = useState<MenuDraft[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const requestedStoreId = Array.isArray(params.storeId) ? params.storeId[0] : params.storeId;

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
        const requestedId = requestedStoreId ? Number(requestedStoreId) : null;
        const first = response.find((store) => store.storeId === requestedId) ?? response[0] ?? null;
        setSelectedStoreId(first?.storeId ?? null);

        if (first) {
          const menus = await storeMenusApi.getMyStoreMenus(first.storeId);
          if (!active) return;
          setMenuItems(menus.items);
          setDrafts(menus.items.length > 0 ? menus.items.map((item, index) => buildDraftFromMenu(item, index)) : [createEmptyDraft()]);
        }
      } catch {
        if (!active) return;
        setStores([]);
        setMenuItems([]);
        setDrafts([createEmptyDraft()]);
      } finally {
        if (!active) return;
        setIsLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [requestedStoreId]);

  const selectedStore = useMemo(
    () => stores.find((store) => store.storeId === selectedStoreId) ?? null,
    [selectedStoreId, stores]
  );

  const handleAddDraft = () => {
    setDrafts((current) => [...current, createEmptyDraft()]);
  };

  const selectStore = async (storeId: number) => {
    const store = stores.find((item) => item.storeId === storeId);
    if (!store) return;

    setSelectedStoreId(storeId);
    try {
      setIsLoading(true);
      const menus = await storeMenusApi.getMyStoreMenus(storeId);
      setMenuItems(menus.items);
      setDrafts(menus.items.length > 0 ? menus.items.map((item, index) => buildDraftFromMenu(item, index)) : [createEmptyDraft()]);
    } catch {
      setMenuItems([]);
      setDrafts([createEmptyDraft()]);
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
        response.items.map((item, index) => buildDraftFromMenu(item, index))
      );
      Alert.alert('저장 완료', '메뉴가 저장되었어요.');
    } catch (error) {
      Alert.alert('저장 실패', error instanceof Error ? error.message : '메뉴 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadMenuImage = async (index: number) => {
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

      const response = await filesApi.uploadMenu({
        uri: file.uri,
        name: file.name ?? 'menu-image.jpg',
        type: file.mimeType ?? 'image/jpeg',
      });

      setDrafts((current) => current.map((item, itemIndex) => (
        itemIndex === index
          ? { ...item, imageUrl: response.url }
          : item
      )));
      Alert.alert('업로드 완료', '메뉴 이미지를 불러왔어요.');
    } catch (error) {
      Alert.alert('이미지 업로드 실패', error instanceof Error ? error.message : '메뉴 이미지 업로드에 실패했습니다.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={goBack} style={styles.backButton} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={24} color="#18a5a5" />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>메뉴 관리</Text>
            <Text style={styles.headerSubtitle}>내 매장의 메뉴를 불러오고 수정할 수 있어요.</Text>
          </View>
        </View>

        {!isLoggedIn ? (
          <GatePanel onLogin={() => router.replace('/views/owner_login')} onSignup={() => router.replace('/views/owner_signup')} />
        ) : isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#18a5a5" />
            <Text style={styles.loadingText}>메뉴를 불러오는 중...</Text>
          </View>
        ) : stores.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="restaurant-outline" size={28} color="#8b95a1" />
            <Text style={styles.emptyTitle}>연결된 매장이 없어요</Text>
            <Text style={styles.emptySubtitle}>매장 등록이 승인되면 메뉴를 관리할 수 있어요.</Text>
          </View>
        ) : (
          <>
            <OwnerStorePicker
              stores={stores}
              selectedStoreId={selectedStoreId}
              selectedStore={selectedStore}
              onSelect={(storeId) => void selectStore(storeId)}
            />

            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>메뉴 목록</Text>
                <View style={styles.sectionHeaderHint}>
                  <Text style={styles.sectionHeaderHintText}>메뉴는 한번에 저장돼요</Text>
                </View>
              </View>
              <Text style={styles.helperText}>메뉴명을 입력하고 가격을 적은 뒤 저장 버튼을 눌러주세요.</Text>

              {menuItems.length > 0 ? (
                <View style={styles.currentMenusBox}>
                  <Text style={styles.sectionTitle}>현재 저장된 메뉴</Text>
                  {menuItems.map((item) => (
                    <View key={String(item.menuId ?? `${item.name}-${item.displayOrder}`)} style={styles.currentMenuItem}>
                      <View style={styles.currentMenuTopRow}>
                        <Text style={styles.currentMenuTitle} numberOfLines={1} ellipsizeMode="tail">
                          {item.name}
                        </Text>
                        {item.representative ? (
                          <View style={styles.currentMenuBadge}>
                            <Text style={styles.currentMenuBadgeText}>대표</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.currentMenuSub}>
                        {item.price.toLocaleString()}원 · {item.available ? '판매중' : '판매중지'}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.menuList}>
                {drafts.map((draft, index) => (
                  <MenuRow
                    key={draft.id}
                    draft={draft}
                    onChange={(next) =>
                      setDrafts((current) => current.map((item, itemIndex) => (itemIndex === index ? next : item)))
                    }
                    onRemove={() => setDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    onUploadImage={() => void handleUploadMenuImage(index)}
                  />
                ))}
              </View>

              <TouchableOpacity style={styles.addMenuButton} onPress={handleAddDraft} activeOpacity={0.9} hitSlop={8}>
                <Ionicons name="add" size={18} color="#18a5a5" />
                <Text style={styles.addMenuButtonText}>메뉴 추가</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.primaryButton} onPress={handleSave} activeOpacity={0.9} disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator color="#f9fafb" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>저장하기</Text>
                    <Ionicons name="chevron-forward" size={18} color="#f9fafb" />
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
  container: { flex: 1, backgroundColor: '#f7f8fa' },
  scrollContent: { padding: 20, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  backButton: { paddingTop: 4, paddingRight: 4 },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#191f28' },
  headerSubtitle: { marginTop: 6, color: '#6b7684', fontSize: 13, lineHeight: 18 },
  gateCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e8eb',
  },
  gateIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eef1f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  gateTitle: { fontSize: 18, fontWeight: '900', color: '#191f28', marginBottom: 8 },
  gateSubtitle: { fontSize: 13, color: '#6b7684', lineHeight: 18 },
  gateButtons: { flexDirection: 'row', gap: 10, marginTop: 18 },
  gateSecondaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#edf8f8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  gateSecondaryButtonText: { color: '#18a5a5', fontSize: 15, fontWeight: '800' },
  gatePrimaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18a5a5',
  },
  gatePrimaryButtonText: { color: '#f9fafb', fontSize: 15, fontWeight: '800' },
  loadingCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: '#6b7684', fontSize: 13, fontWeight: '600' },
  emptyCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e8eb',
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#191f28', marginTop: 10 },
  emptySubtitle: { fontSize: 13, color: '#6b7684', textAlign: 'center', marginTop: 8, lineHeight: 18 },
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    marginBottom: 12,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#191f28' },
  sectionSubtitle: { fontSize: 13, fontWeight: '700', color: '#6b7684' },
  sectionHeaderHint: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sectionHeaderHintText: { color: '#6b7684', fontSize: 11, fontWeight: '700' },
  helperText: { fontSize: 13, color: '#6b7684', lineHeight: 18, marginBottom: 12 },
  storeChips: { gap: 10, paddingRight: 4 },
  storeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
  },
  storeChipActive: {
    borderColor: '#18a5a5',
    backgroundColor: '#eef1f5',
  },
  storeChipText: { color: '#4e5968', fontSize: 13, fontWeight: '700' },
  storeChipTextActive: { color: '#18a5a5' },
  selectedStoreName: { marginTop: 12, fontSize: 18, fontWeight: '900', color: '#191f28' },
  addMenuButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#edf8f8',
    backgroundColor: '#eef1f5',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  addMenuButtonText: { color: '#18a5a5', fontSize: 14, fontWeight: '900' },
  menuList: { gap: 12, marginTop: 8 },
  menuRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    padding: 14,
  },
  menuRowTop: { flexDirection: 'row', gap: 10 },
  menuInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#191f28',
  },
  menuNameInput: {
    flex: 1.35,
    textAlignVertical: 'top',
  },
  priceInput: { flexBasis: 96, flexGrow: 0 },
  menuDescription: {
    minHeight: 76,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#191f28',
    textAlignVertical: 'top',
  },
  menuFlagsRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 10 },
  flagButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
  },
  flagButtonActive: {
    borderColor: '#18a5a5',
    backgroundColor: '#eef1f5',
  },
  flagText: { color: '#4e5968', fontSize: 12, fontWeight: '800' },
  flagTextActive: { color: '#18a5a5' },
  removeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#f9fafb',
  },
  imageInput: {
    marginTop: 10,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e8eb',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    color: '#191f28',
  },
  uploadButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#edf8f8',
    backgroundColor: '#eef1f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  uploadButtonText: {
    color: '#18a5a5',
    fontSize: 12,
    fontWeight: '800',
  },
  currentMenusBox: {
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: '#eef1f5',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 14,
  },
  currentMenuItem: {
    borderRadius: 14,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e8eb',
    padding: 12,
    marginTop: 10,
  },
  currentMenuTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  currentMenuTitle: { color: '#191f28', fontSize: 14, fontWeight: '800', flexShrink: 1 },
  currentMenuBadge: {
    borderRadius: 999,
    backgroundColor: '#eef1f5',
    borderWidth: 1,
    borderColor: '#edf8f8',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  currentMenuBadgeText: { color: '#18a5a5', fontSize: 10, fontWeight: '900' },
  currentMenuSub: { color: '#6b7684', fontSize: 12, marginTop: 4 },
  primaryButton: {
    marginTop: 14,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#18a5a5',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  primaryButtonText: { color: '#f9fafb', fontSize: 16, fontWeight: '800' },
});
