import { apiClient } from './client';

export type StoreReviewItem = {
  reviewId: number;
  storeId: number;
  storeName?: string | null;
  displayName: string | null;
  authorNickname?: string;
  rating: number;
  content: string;
  imageUrls: string[];
  createdAt: string;
  updatedAt: string | null;
};

export type StoreReviewPageResponse = {
  content: StoreReviewItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type StoreReviewSummaryResponse = {
  averageRating: number | null;
  reviewCount: number;
};

export type StoreReviewMineResponse = StoreReviewPageResponse & {
  summary: StoreReviewSummaryResponse;
};

export type StoreReviewMinePageResponse = StoreReviewPageResponse;

export type StoreReviewCreateRequest = {
  rating: number;
  content: string;
  imageUrls?: string[];
};

export type StoreReviewUpdateRequest = {
  rating: number;
  content: string;
  imageUrls?: string[];
};

export const storeReviewsApi = {
  async mine(page = 0, size = 20) {
    return apiClient.request<StoreReviewMinePageResponse>(
      `/api/v1/reviews/mine${apiClient.query({ page, size })}`
    );
  },

  async list(storeId: number, page = 0, size = 20, sort = 'latest') {
    return apiClient.request<StoreReviewPageResponse>(
      `/api/v1/stores/${storeId}/reviews${apiClient.query({ page, size, sort })}`
    );
  },

  async mineByStore(storeId: number, page = 0, size = 20, sort = 'latest') {
    return apiClient.request<StoreReviewMineResponse>(
      `/api/v1/stores/${storeId}/reviews/mine${apiClient.query({ page, size, sort })}`
    );
  },

  async create(storeId: number, request: StoreReviewCreateRequest) {
    return apiClient.request<StoreReviewItem>(`/api/v1/stores/${storeId}/reviews`, {
      method: 'POST',
      body: request,
    });
  },

  async update(reviewId: number, request: StoreReviewUpdateRequest) {
    return apiClient.request<StoreReviewItem>(`/api/v1/reviews/${reviewId}`, {
      method: 'PATCH',
      body: request,
    });
  },

  async remove(reviewId: number) {
    return apiClient.request<void>(`/api/v1/reviews/${reviewId}`, {
      method: 'DELETE',
    });
  },
};
