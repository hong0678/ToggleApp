import { apiClient } from './client';

export type StoreMenuItem = {
  menuId: number | null;
  name: string;
  price: number;
  representative: boolean;
  description: string;
  imageUrl: string;
  displayOrder: number;
  available: boolean;
};

export type StoreMenuResponse = {
  storeId: number;
  storeName: string;
  categoryName: string | null;
  enabled: boolean;
  editable: boolean;
  items: StoreMenuItem[];
  operationalState: string | null;
  closureRequestStatus: string | null;
  menuEligible: boolean;
  menuEditable: boolean;
  menuEligibilityReason: string | null;
};

export type StoreMenuUpsertItemRequest = {
  name: string;
  price: number;
  representative?: boolean;
  description?: string;
  imageUrl?: string;
  displayOrder?: number;
  available?: boolean;
};

export type StoreMenuUpsertRequest = {
  menus: StoreMenuUpsertItemRequest[];
};

export const storeMenusApi = {
  async getStoreMenus(storeId: number) {
    return apiClient.request<StoreMenuResponse>(`/api/v1/stores/${storeId}/menus`);
  },

  async getMyStoreMenus(storeId: number) {
    return apiClient.request<StoreMenuResponse>(`/api/v1/owner/stores/${storeId}/menus`);
  },

  async replaceMyStoreMenus(storeId: number, request: StoreMenuUpsertRequest) {
    return apiClient.request<StoreMenuResponse>(`/api/v1/owner/stores/${storeId}/menus`, {
      method: 'PUT',
      body: request,
    });
  },
};
