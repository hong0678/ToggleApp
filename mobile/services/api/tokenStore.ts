import type { AuthTokenResponse } from './types';

export type StoredAuthTokens = {
  accessToken: string;
  refreshToken: string;
};

let tokens: StoredAuthTokens | null = null;

export const tokenStore = {
  async getTokens() {
    return tokens;
  },

  async getAccessToken() {
    return tokens?.accessToken ?? null;
  },

  async setTokens(nextTokens: StoredAuthTokens) {
    tokens = nextTokens;
  },

  async setAuthResponse(auth: AuthTokenResponse) {
    tokens = {
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
    };
  },

  async clear() {
    tokens = null;
  },
};
