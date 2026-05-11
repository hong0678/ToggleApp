import { apiClient } from './client';

export type FileUploadResponse = {
  url: string;
  key: string;
};

const uploadFile = async (path: string, file: { uri: string; name: string; type: string }) => {
  const formData = new FormData();
  formData.append('file', file as any);

  return apiClient.request<FileUploadResponse>(path, {
    method: 'POST',
    body: formData,
    timeoutMs: 60000,
  });
};

export const filesApi = {
  uploadBusiness(file: { uri: string; name: string; type: string }) {
    return uploadFile('/api/v1/files/business', file);
  },
  uploadBusinessDetailed(file: { uri: string; name: string; type: string }) {
    const formData = new FormData();
    formData.append('file', file as any);

    return apiClient.requestDetailed<FileUploadResponse>('/api/v1/files/business', {
      method: 'POST',
      body: formData,
      timeoutMs: 60000,
    });
  },
  uploadMenu(file: { uri: string; name: string; type: string }) {
    return uploadFile('/api/v1/files/menu', file);
  },
  uploadReview(file: { uri: string; name: string; type: string }) {
    return uploadFile('/api/v1/files/review', file);
  },
  uploadStore(file: { uri: string; name: string; type: string }) {
    return uploadFile('/api/v1/files/store', file);
  },
  viewUrl(key: string) {
    return `/api/v1/files/view${apiClient.query({ key })}`;
  },
};
