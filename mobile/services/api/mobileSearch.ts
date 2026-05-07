import { apiClient } from './client';
import type {
  KakaoLookupRequest,
  KakaoLookupResponse,
  KakaoPlaceSearchResponse,
  StoreLookupResponse,
} from './types';

export type PlaceSearchParams = {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  page?: number;
  size?: number;
  sort?: string;
};

export type KeywordSearchParams = Partial<PlaceSearchParams> & {
  query: string;
  categoryGroupCode?: string;
};

export type CategorySearchParams = PlaceSearchParams & {
  categoryGroupCode: string;
};

export const mobileSearchApi = {
  async keyword(params: KeywordSearchParams) {
    return apiClient.request<KakaoPlaceSearchResponse>(
      `/api/v1/mobile-search/places/keyword${apiClient.query(params)}`
    );
  },

  async category(params: CategorySearchParams) {
    return apiClient.request<KakaoPlaceSearchResponse>(
      `/api/v1/mobile-search/places/category${apiClient.query(params)}`
    );
  },

  async nearby(params: CategorySearchParams) {
    return apiClient.request<KakaoPlaceSearchResponse>(
      `/api/v1/mobile-search/places/nearby${apiClient.query(params)}`
    );
  },

  async lookup(request: KakaoLookupRequest) {
    return apiClient.request<KakaoLookupResponse>('/api/v1/mobile-search/places/lookup', {
      method: 'POST',
      body: request,
    });
  },

  async nearbyStores(params: PlaceSearchParams & { limit?: number }) {
    return apiClient.request<StoreLookupResponse>(
      `/api/v1/mobile-search/stores/nearby${apiClient.query(params)}`
    );
  },
};
