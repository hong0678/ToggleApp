import { apiClient } from './client';

export type FileUploadResponse = {
  url: string;
  key: string;
};

const uploadFile = async (path: string, file: { uri: string; name: string; type: string }) => {
  const formData = new FormData();
  formData.append('file', file as unknown as Blob);

  return apiClient.request<FileUploadResponse>(path, {
    method: 'POST',
    body: formData,
  });
};

export const filesApi = {
  uploadBusiness(file: { uri: string; name: string; type: string }) {
    return uploadFile('/api/v1/files/business', file);
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
