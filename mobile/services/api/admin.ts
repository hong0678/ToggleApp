import { apiClient } from './client';
import type {
  OwnerApplicationDetailResponse,
  OwnerApplicationReviewRequest,
  OwnerApplicationReviewResponse,
  OwnerApplicationSummaryResponse,
} from './owner';

export type ExecuteMapVerificationRequest = {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  limit?: number;
};

export type ManualBusinessVerificationRequest = {
  verified: boolean;
  reason?: string;
};

export type OwnerApplicationApproveRequest = {
  approved: boolean;
  note?: string;
};

export type StoreClosureRequestResponse = {
  requestId: number;
  storeId: number;
  storeName: string;
  status: string;
  reason: string | null;
  reviewedReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export const adminApi = {
  async listApplications() {
    return apiClient.request<OwnerApplicationSummaryResponse[]>('/api/v1/admin/owner-store-applications');
  },

  async getApplication(applicationId: number) {
    return apiClient.request<OwnerApplicationDetailResponse>(`/api/v1/admin/owner-store-applications/${applicationId}`);
  },

  async executeBusinessVerification(applicationId: number) {
    return apiClient.request<OwnerApplicationSummaryResponse>(
      `/api/v1/admin/owner-store-applications/${applicationId}/business-verifications/execute`,
      { method: 'POST' }
    );
  },

  async manualBusinessVerification(applicationId: number, request: ManualBusinessVerificationRequest) {
    return apiClient.request<OwnerApplicationSummaryResponse>(
      `/api/v1/admin/owner-store-applications/${applicationId}/business-verifications/manual`,
      { method: 'POST', body: request }
    );
  },

  async executeMapVerification(applicationId: number, request: ExecuteMapVerificationRequest) {
    return apiClient.request<OwnerApplicationSummaryResponse>(
      `/api/v1/admin/owner-store-applications/${applicationId}/map-verifications/execute`,
      { method: 'POST', body: request }
    );
  },

  async approve(applicationId: number, request: OwnerApplicationApproveRequest) {
    return apiClient.request<OwnerApplicationReviewResponse>(
      `/api/v1/admin/owner-store-applications/${applicationId}/approve`,
      { method: 'POST', body: request }
    );
  },

  async reject(applicationId: number, request: OwnerApplicationReviewRequest) {
    return apiClient.request<OwnerApplicationReviewResponse>(
      `/api/v1/admin/owner-store-applications/${applicationId}/reject`,
      { method: 'POST', body: request }
    );
  },
};
