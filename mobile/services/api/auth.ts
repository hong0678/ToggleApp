import { apiClient } from './client';
import { tokenStore } from './tokenStore';
import type {
  AuthTokenResponse,
  LogoutResponse,
  MeResponse,
  SignupRequest,
  SignupResponse,
} from './types';

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
};
