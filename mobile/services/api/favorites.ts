import { apiClient } from './client';
import type { FavoriteStoreResponse } from './types';

export const favoritesApi = {
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
