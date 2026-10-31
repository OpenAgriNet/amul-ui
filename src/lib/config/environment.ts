export const environment = {
  /**
   * API base URL. Set via VITE_API_BASE_URL (env / .env / Docker build-arg).
   * No default so the environment stays explicit.
   */
  apiUrl: (import.meta.env.VITE_API_BASE_URL as string) ?? '',
  maintenanceMode: false,
  guestUserLimit: 10,
  /** Provider identifiers for TTS and transcription services. */
  ttsProvider: (import.meta.env.VITE_TTS_PROVIDER as string) || 'bhashini',
  transcriptionProvider: (import.meta.env.VITE_TRANSCRIPTION_PROVIDER as string) || 'bhashini',
};
