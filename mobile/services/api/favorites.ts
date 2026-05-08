import { apiClient } from './client';
import type { FavoriteStoreListResponse, FavoriteStoreResponse } from './types';

export const favoritesApi = {
  async listStores() {
    return apiClient.request<FavoriteStoreListResponse>('/api/v1/favorites/stores');
  },

  async addStore(storeId: number) {
    return apiClient.request<FavoriteStoreResponse>(`/api/v1/favorites/stores/${storeId}`, {
      method: 'POST',
    });
  },

  async removeStore(storeId: number) {
    return apiClient.request<FavoriteStoreResponse>(`/api/v1/favorites/stores/${storeId}`, {
      method: 'DELETE',
    });
  },

  async addPublicInstitution(publicInstitutionId: number) {
    return apiClient.request<FavoriteStoreResponse>(
      `/api/v1/favorites/stores/publics/${publicInstitutionId}`,
      { method: 'POST' }
    );
  },

  async removePublicInstitution(publicInstitutionId: number) {
    return apiClient.request<FavoriteStoreResponse>(
      `/api/v1/favorites/stores/publics/${publicInstitutionId}`,
      { method: 'DELETE' }
    );
  },
};
