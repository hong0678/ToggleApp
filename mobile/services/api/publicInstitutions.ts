import { apiClient } from './client';
import type { PublicInstitutionLookupRequest, PublicInstitutionLookupResponse } from './types';

export const publicInstitutionsApi = {
  async lookup(request: PublicInstitutionLookupRequest) {
    return apiClient.request<PublicInstitutionLookupResponse>('/api/v1/public-institutions/lookup', {
      method: 'POST',
      body: request,
    });
  },

  async getByIds(ids: number[]) {
    return apiClient.request<PublicInstitutionLookupResponse>(
      `/api/v1/public-institutions${apiClient.query({ ids })}`
    );
  },
};
