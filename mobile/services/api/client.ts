import { Platform } from 'react-native';
import { tokenStore } from './tokenStore';
import type { ApiResponse } from './types';

const DEFAULT_API_BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

export class ApiClientError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
};

const getBaseUrl = () => {
  return process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
};

const toQueryString = (params: Record<string, unknown>) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;

    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, String(item)));
      return;
    }

    query.append(key, String(value));
  });

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  const parsed = text ? JSON.parse(text) as ApiResponse<T> | T : null;

  if (!response.ok) {
    const apiResponse = parsed as ApiResponse<T> | null;
    const error = apiResponse && 'error' in apiResponse ? apiResponse.error : null;
    throw new ApiClientError(
      response.status,
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? '요청을 처리하지 못했습니다.'
    );
  }

  if (parsed && typeof parsed === 'object' && 'success' in parsed) {
    const apiResponse = parsed as ApiResponse<T>;

    if (!apiResponse.success) {
      throw new ApiClientError(
        response.status,
        apiResponse.error?.code ?? 'API_ERROR',
        apiResponse.error?.message ?? '요청을 처리하지 못했습니다.'
      );
    }

    return apiResponse.data as T;
  }

  return parsed as T;
};

export const apiClient = {
  query: toQueryString,

  async request<T>(path: string, options: RequestOptions = {}) {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options.headers,
    };

    let body: BodyInit | undefined;

    if (options.body instanceof FormData) {
      body = options.body;
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }

    if (options.auth !== false) {
      const accessToken = await tokenStore.getAccessToken();

      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
    }

    const response = await fetch(`${getBaseUrl()}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body,
    });

    return parseResponse<T>(response);
  },
};
