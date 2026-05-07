import { apiClient } from './client';
import type { PublicMapSearchResponse, UserPublicMapResponse } from './types';

export const publicMapsApi = {
  async search(nickname: string) {
    return apiClient.request<PublicMapSearchResponse>(
      `/api/v1/public-maps/search${apiClient.query({ nickname })}`
    );
  },

  async get(publicMapUuid: string) {
    return apiClient.request<UserPublicMapResponse>(`/api/v1/public-maps/${publicMapUuid}`, {
      auth: false,
    });
  },
};
