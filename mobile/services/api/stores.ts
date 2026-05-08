import { apiClient } from './client';
import type { ResolveStoreRequest, ResolveStoreResponse, StoreLookupRequest, StoreLookupResponse } from './types';

export const storesApi = {
  async resolve(request: ResolveStoreRequest) {
    return apiClient.request<ResolveStoreResponse>('/api/v1/stores/resolve', {
      method: 'POST',
      body: request,
    });
  },

  async lookup(request: StoreLookupRequest) {
    return apiClient.request<StoreLookupResponse>('/api/v1/stores/lookup', {
      method: 'POST',
      body: request,
    });
  },

  async listByIds(ids: number[]) {
    return apiClient.request<StoreLookupResponse>(`/api/v1/stores${apiClient.query({ ids })}`);
  },

  async nearby(latitude: number, longitude: number, radiusMeters = 2000, limit = 30) {
    return apiClient.request<StoreLookupResponse>(
      `/api/v1/stores/nearby${apiClient.query({ latitude, longitude, radiusMeters, limit })}`
    );
  },
};
