import { apiClient } from './client';
import type {
  LikedPublicMapListResponse,
  MapLikeResponse,
  PublicMapListResponse,
  PublicMapSearchResponse,
  UserPublicMapResponse,
} from './types';

type PublicMapListParams = {
  keyword?: string;
  sort?: 'latest' | 'likes';
  page?: number;
  size?: number;
};

export const publicMapsApi = {
  async search(nickname: string) {
    return apiClient.request<PublicMapSearchResponse>(
      `/api/v1/public-maps/search${apiClient.query({ nickname })}`
    );
  },

  async list(params: PublicMapListParams = {}) {
    return apiClient.request<PublicMapListResponse>(`/api/v1/maps${apiClient.query({
      keyword: params.keyword,
      sort: params.sort ?? 'latest',
      page: params.page ?? 0,
      size: params.size ?? 12,
    })}`);
  },

  async get(publicMapUuid: string) {
    return apiClient.request<UserPublicMapResponse>(`/api/v1/public-maps/${publicMapUuid}`, {
      auth: false,
    });
  },

  async getByMapId(mapId: number) {
    return apiClient.request<UserPublicMapResponse>(`/api/v1/maps/${mapId}`, {
      auth: false,
    });
  },

  async getLikes(mapId: number) {
    return apiClient.request<MapLikeResponse>(`/api/v1/maps/${mapId}/likes`);
  },

  async like(mapId: number) {
    return apiClient.request<MapLikeResponse>(`/api/v1/maps/${mapId}/likes`, {
      method: 'POST',
    });
  },

  async listLikedByMe(params?: { page?: number; size?: number }) {
    return apiClient.request<LikedPublicMapListResponse>(`/api/v1/my-maps/liked${apiClient.query({
      page: params?.page ?? 0,
      size: params?.size ?? 20,
    })}`);
  },

  async unlike(mapId: number) {
    return apiClient.request<MapLikeResponse>(`/api/v1/maps/${mapId}/likes`, {
      method: 'DELETE',
    });
  },
};
