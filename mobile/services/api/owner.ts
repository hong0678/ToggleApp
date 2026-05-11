import { apiClient } from './client';

export type OwnerApplicationRequest = {
  storeName: string;
  businessNumber: string;
  representativeName: string;
  businessOpenDate: string;
  businessAddress: string;
  businessPhone: string;
};

export type OwnerApplicationUpdateRequest = OwnerApplicationRequest;

export type OwnerApplicationSummaryResponse = {
  applicationId: number;
  ownerUserId: number;
  ownerEmail: string;
  ownerNickname: string;
  storeName: string;
  businessNumber: string;
  representativeName: string;
  businessOpenDate: string;
  businessAddressRaw: string;
  businessPhone: string;
  businessLicenseObjectKey: string | null;
  businessLicenseDeletedAt: string | null;
  businessLicenseDeleteReason: string | null;
  requestStatus: string;
  businessVerificationStatus: string;
  mapVerificationStatus: string;
  verifiedStoreId: number | null;
  verifiedStoreName: string | null;
  rejectReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
};

export type OwnerApplicationResponse = {
  applicationId: number;
  ownerUserId: number;
  storeName: string;
  requestStatus: string;
  businessVerificationStatus: string;
  mapVerificationStatus: string;
  submittedAt: string;
};

export type OwnerApplicationReviewRequest = {
  reason: string;
};

export type OwnerApplicationReviewResponse = {
  applicationId: number;
  ownerUserId: number;
  requestStatus: string;
  businessVerificationStatus: string;
  mapVerificationStatus: string;
  verifiedStoreId: number | null;
  linkedStoreId: number | null;
  reviewedAt: string | null;
  rejectReason: string | null;
};

export type OwnerApplicationDetailResponse = {
  application: OwnerApplicationSummaryResponse;
  businessLicensePresignedUrl: string | null;
  businessVerificationHistories: Record<string, unknown>[];
  mapVerificationHistories: Record<string, unknown>[];
};

export type OwnerLinkedStoreResponse = {
  linkId: number;
  ownerUserId: number;
  ownerNickname: string;
  ownerEmail: string;
  storeId: number;
  storeName: string;
  storeAddress: string;
  categoryName: string | null;
  liveBusinessStatus: string | null;
  ownerNotice: string | null;
  openTime: string | null;
  closeTime: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  imageUrls: string[];
  operationalState: string | null;
  closureRequestStatus: string | null;
  menuEligible: boolean;
  menuEditable: boolean;
  menuEligibilityReason: string | null;
};

export type OwnerStoreStatusUpdateRequest = {
  status: string;
  comment?: string;
};

export type OwnerStoreStatusResponse = {
  storeId: number;
  storeName: string;
  liveBusinessStatus: string;
  statusSource: string | null;
  comment: string | null;
};

export type OwnerStoreProfileUpdateRequest = {
  ownerNotice?: string;
  openTime?: string;
  closeTime?: string;
  breakStart?: string;
  breakEnd?: string;
  imageUrls?: string[];
};

export type StoreClosureRequestCreateRequest = {
  reason: string;
  effectiveAt?: string;
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

export const ownerApi = {
  async createApplication(request: OwnerApplicationRequest, businessLicenseFile: { uri: string; name: string; type: string }) {
    return ownerApi.createApplicationDetailed(request, businessLicenseFile).then((response) => {
      if (!response.success) {
        throw new Error(response.error?.message ?? '매장 등록 신청이 처리되지 않았어요.');
      }

      return response.data as OwnerApplicationResponse;
    });
  },
  async createApplicationDetailed(request: OwnerApplicationRequest, businessLicenseFile: { uri: string; name: string; type: string }) {
    const formData = new FormData();
    formData.append('request', JSON.stringify(request));
    formData.append('businessLicenseFile', businessLicenseFile as any);

    return apiClient.requestDetailed<OwnerApplicationResponse>('/api/v1/owner/store-applications', {
      method: 'POST',
      body: formData,
      timeoutMs: 120000,
    });
  },

  async updateApplication(applicationId: number, request: OwnerApplicationUpdateRequest, businessLicenseFile?: { uri: string; name: string; type: string }) {
    return ownerApi.updateApplicationDetailed(applicationId, request, businessLicenseFile).then((response) => {
      if (!response.success) {
        throw new Error(response.error?.message ?? '매장 등록 수정이 처리되지 않았어요.');
      }

      return response.data as OwnerApplicationResponse;
    });
  },

  async updateApplicationDetailed(applicationId: number, request: OwnerApplicationUpdateRequest, businessLicenseFile?: { uri: string; name: string; type: string }) {
    const formData = new FormData();
    formData.append('request', JSON.stringify(request));
    if (businessLicenseFile) {
      formData.append('businessLicenseFile', businessLicenseFile as any);
    }

    return apiClient.requestDetailed<OwnerApplicationResponse>(`/api/v1/owner/store-applications/${applicationId}`, {
      method: 'PATCH',
      body: formData,
      timeoutMs: 120000,
    });
  },

  async listApplications() {
    return apiClient.request<OwnerApplicationSummaryResponse[]>('/api/v1/owner/store-applications');
  },

  async listStores() {
    return apiClient.request<OwnerLinkedStoreResponse[]>('/api/v1/owner/stores');
  },

  async updateStoreStatus(storeId: number, request: OwnerStoreStatusUpdateRequest) {
    return apiClient.request<OwnerStoreStatusResponse>(`/api/v1/owner/stores/${storeId}/status`, {
      method: 'POST',
      body: request,
    });
  },

  async updateStoreProfile(storeId: number, request: OwnerStoreProfileUpdateRequest) {
    return apiClient.request<OwnerLinkedStoreResponse>(`/api/v1/owner/stores/${storeId}/profile`, {
      method: 'PUT',
      body: request,
    });
  },

  async unlinkStore(storeId: number) {
    return apiClient.request<void>(`/api/v1/owner/stores/${storeId}/link`, {
      method: 'DELETE',
    });
  },

  async createClosureRequest(storeId: number, request: StoreClosureRequestCreateRequest) {
    return apiClient.request<StoreClosureRequestResponse>(`/api/v1/owner/stores/${storeId}/closure-requests`, {
      method: 'POST',
      body: request,
    });
  },

  async getLatestClosureRequest(storeId: number) {
    return apiClient.request<StoreClosureRequestResponse>(`/api/v1/owner/stores/${storeId}/closure-requests/latest`);
  },
};
