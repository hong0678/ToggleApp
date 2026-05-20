import { apiClient } from './client';
import { tokenStore } from './tokenStore';
import type {
  AuthTokenResponse,
  LogoutResponse,
  MeResponse,
  SimpleMessageResponse,
  SignupRequest,
  SignupResponse,
  UserProfileResponse,
} from './types';

type UploadFileInput = {
  uri: string;
  name: string;
  type: string;
};

export const authApi = {
  async signup(request: SignupRequest) {
    return apiClient.request<SignupResponse>('/api/v1/auth/signup', {
      method: 'POST',
      body: request,
      auth: false,
    });
  },

  async login(email: string, password: string) {
    const response = await apiClient.request<AuthTokenResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });

    await tokenStore.setAuthResponse(response);
    return response;
  },

  async refresh() {
    const tokens = await tokenStore.getTokens();

    if (!tokens?.refreshToken) {
      throw new Error('Refresh token is missing.');
    }

    const response = await apiClient.request<AuthTokenResponse>('/api/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken: tokens.refreshToken },
      auth: false,
    });

    await tokenStore.setAuthResponse(response);
    return response;
  },

  async logout() {
    const tokens = await tokenStore.getTokens();

    const response = await apiClient.request<LogoutResponse>('/api/v1/auth/logout', {
      method: 'POST',
      body: { refreshToken: tokens?.refreshToken ?? '' },
      auth: false,
    });

    await tokenStore.clear();
    return response;
  },

  async me() {
    return apiClient.request<MeResponse>('/api/v1/auth/me');
  },

  async updateNickname(nickname: string) {
    return apiClient.request<UserProfileResponse>('/api/v1/users/me/nickname', {
      method: 'PATCH',
      body: { nickname },
    });
  },

  async changePassword(currentPassword: string, newPassword: string) {
    return apiClient.request<SimpleMessageResponse>('/api/v1/users/me/password', {
      method: 'PATCH',
      body: { currentPassword, newPassword },
    });
  },

  async updateProfileImage(file: UploadFileInput) {
    const formData = new FormData();
    formData.append('profileImage', file as any);

    return apiClient.request<UserProfileResponse>('/api/v1/users/me/profile-image', {
      method: 'PATCH',
      body: formData,
      timeoutMs: 60000,
    });
  },

  async deleteMe() {
    const response = await apiClient.request<SimpleMessageResponse>('/api/v1/users/me', {
      method: 'DELETE',
    });

    await tokenStore.clear();
    return response;
  },
};
