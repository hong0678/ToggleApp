import { apiClient } from './client';
import { ApiClientError } from './client';
import type { MyMapPlaceResponse } from './types';

export type UserMapSummaryResponse = {
  mapId: number;
  publicMapUuid: string;
  title: string;
  description: string | null;
  profileImageUrl: string | null;
  isPublic: boolean;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
};

export type UserMapDetailResponse = {
  map: UserMapSummaryResponse;
  stores: number[];
  publicInstitutions: number[];
};

export type UserMapUpsertRequest = {
  title: string;
  description?: string | null;
  isPublic?: boolean;
  profileImageUrl?: string | null;
};

const USER_MAPS_TIMEOUT_MS = 20000;

const requestUserMap = async <T>(
  label: string,
  path: string,
  options: Parameters<typeof apiClient.request<T>>[1] = {}
) => {
  const startedAt = Date.now();

  if (__DEV__) {
    console.log(`[userMapsApi.${label}:request]`, {
      path,
      method: options.method ?? 'GET',
      body: options.body ?? null,
      timeoutMs: options.timeoutMs ?? USER_MAPS_TIMEOUT_MS,
      baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? null,
    });
  }

  try {
    const response = await apiClient.request<T>(path, {
      timeoutMs: USER_MAPS_TIMEOUT_MS,
      ...options,
    });

    if (__DEV__) {
      console.log(`[userMapsApi.${label}:success]`, {
        path,
        elapsedMs: Date.now() - startedAt,
      });
    }

    return response;
  } catch (error) {
    if (__DEV__) {
      console.warn(`[userMapsApi.${label}:error]`, {
        path,
        elapsedMs: Date.now() - startedAt,
        status: error instanceof ApiClientError ? error.status : null,
        code: error instanceof ApiClientError ? error.code : null,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    throw error;
  }
};

export const userMapsApi = {
  async create(request: UserMapUpsertRequest) {
    return requestUserMap<UserMapSummaryResponse>('create', '/api/v1/my-maps', {
      method: 'POST',
      body: request,
    });
  },

  async list() {
    return requestUserMap<UserMapSummaryResponse[]>('list', '/api/v1/my-maps');
  },

  async get(mapId: number) {
    return requestUserMap<UserMapDetailResponse>('get', `/api/v1/my-maps/${mapId}`);
  },

  async update(mapId: number, request: UserMapUpsertRequest) {
    return requestUserMap<UserMapSummaryResponse>('update', `/api/v1/my-maps/${mapId}`, {
      method: 'PUT',
      body: request,
    });
  },

  async addStore(mapId: number, storeId: number) {
    return requestUserMap<MyMapPlaceResponse>('addStore', `/api/v1/my-maps/${mapId}/stores/${storeId}`, {
      method: 'POST',
    });
  },

  async addPublicInstitution(mapId: number, publicInstitutionId: number) {
    return requestUserMap<MyMapPlaceResponse>('addPublicInstitution', `/api/v1/my-maps/${mapId}/public-institutions/${publicInstitutionId}`, {
      method: 'POST',
    });
  },
};
