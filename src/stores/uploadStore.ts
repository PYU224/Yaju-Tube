// 進行中のアップロードを永続化し、アプリ再起動後の再開を可能にする
import { defineStore } from 'pinia';

export interface PendingUpload {
  host: string;
  uploadId: string;
  name: string;
  channelId: number;
  privacy: number;
  description: string;
  fileName: string;
  fileSize: number;
  uploadedBytes: number;
}

export const useUploadStore = defineStore('upload', {
  state: () => ({
    pending: null as PendingUpload | null,
  }),
  getters: {
    hasPending: state => state.pending !== null,
  },
  actions: {
    setPending(upload: PendingUpload) {
      this.pending = upload;
    },
    updateProgress(uploadedBytes: number) {
      if (this.pending) {
        this.pending.uploadedBytes = uploadedBytes;
      }
    },
    clearPending() {
      this.pending = null;
    },
  },
  persist: true,
});
