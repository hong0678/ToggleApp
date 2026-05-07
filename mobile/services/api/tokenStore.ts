import type { AuthTokenResponse } from './types';

export type StoredAuthTokens = {
  accessToken: string;
  refreshToken: string;
};

let tokens: StoredAuthTokens | null = null;
let isMockSession = false;

export const tokenStore = {
  async getTokens() {
    return tokens;
  },

  async getAccessToken() {
    return tokens?.accessToken ?? null;
  },

  async setTokens(nextTokens: StoredAuthTokens) {
    tokens = nextTokens;
    isMockSession = false;
  },

  async setAuthResponse(auth: AuthTokenResponse, options?: { mock?: boolean }) {
    tokens = {
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
    };
    isMockSession = !!options?.mock;
  },

  async isMock() {
    return isMockSession;
  },

  async clear() {
    tokens = null;
    isMockSession = false;
  },
};
