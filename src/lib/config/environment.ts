import { browserStorage, resolveApiBaseUrl } from './preview-backend';

export const environment = {
  /**
   * API base URL. Set via VITE_API_BASE_URL (env / .env / Docker build-arg).
   * No default so the environment stays explicit. A dev build may point this browser at a
   * preview backend instead (see preview-backend.ts); other builds are never changed.
   */
  apiUrl: resolveApiBaseUrl((import.meta.env.VITE_API_BASE_URL as string) ?? '', browserStorage()),
  maintenanceMode: false,
  guestUserLimit: 10,
  /** Provider identifiers for TTS and transcription services. */
  ttsProvider: (import.meta.env.VITE_TTS_PROVIDER as string) || 'bhashini',
  transcriptionProvider: (import.meta.env.VITE_TRANSCRIPTION_PROVIDER as string) || 'bhashini',
};
