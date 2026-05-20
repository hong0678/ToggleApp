import { apiClient } from './client';
import type { MapProfile, MyMapPlaceResponse } from './types';

type UploadFileInput = {
  uri: string;
  name: string;
  type: string;
};

export type MyMapResponse = {
  mapProfile: MapProfile;
  stores: number[];
  publics: number[];
};

export type UpdateMyMapProfileRequest = {
  isPublic?: boolean;
  title?: string;
  description?: string;
  profileImageUrl?: string;
};

export const myMapApi = {
  async get() {
    return apiClient.request<MyMapResponse>('/api/v1/my-map');
  },

  async updateProfile(request: UpdateMyMapProfileRequest) {
    return apiClient.request<MapProfile>('/api/v1/my-map/profile', {
      method: 'PUT',
      body: request,
    });
  },

  async updateProfileImage(mapId: number, file: UploadFileInput) {
    const formData = new FormData();
    formData.append('profileImage', file as any);

    return apiClient.request<{ mapId: number; profileImageUrl: string | null }>(`/api/v1/maps/${mapId}/profile-image`, {
      method: 'PATCH',
      body: formData,
      timeoutMs: 60000,
    });
  },

  async addStore(storeId: number) {
    return apiClient.request<MyMapPlaceResponse>(`/api/v1/my-map/stores/${storeId}`, {
      method: 'POST',
    });
  },

  async removeStore(storeId: number) {
    return apiClient.request<MyMapPlaceResponse>(`/api/v1/my-map/stores/${storeId}`, {
      method: 'DELETE',
    });
  },

  async addPublicInstitution(publicInstitutionId: number) {
    return apiClient.request<MyMapPlaceResponse>(`/api/v1/my-map/publics/${publicInstitutionId}`, {
      method: 'POST',
    });
  },

  async removePublicInstitution(publicInstitutionId: number) {
    return apiClient.request<MyMapPlaceResponse>(`/api/v1/my-map/publics/${publicInstitutionId}`, {
      method: 'DELETE',
    });
  },
};
