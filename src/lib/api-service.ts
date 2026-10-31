import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { environment } from '@/lib/config/environment';
import type { ChatPersona } from '@/lib/chat-persona';

export interface LocationData {
  latitude: number;
  longitude: number;
}

export interface ChatResponse {
  response: string;
  status: string;
}

export interface TranscriptionResponse {
  text: string;
  lang_code: string;
  status: string;
}

export interface SuggestionItem {
  question: string;
}

interface TTSResponse {
  status: string;
  audio_data: string;
  session_id: string;
}

// Constants
const JWT_STORAGE_KEY = 'auth_jwt';
const SUPPORTED_LANGUAGE_CODES = new Set(['en', 'gu', 'hi', 'mr', 'bn', 'pa']);

class ApiService {
  private apiUrl: string = environment.apiUrl;
  private locationData: LocationData | null = null;
  private currentSessionId: string | null = null;
  private axiosInstance: AxiosInstance;
  private authToken: string | null = null;  

  constructor() {
    this.authToken = this.getAuthToken();
    this.axiosInstance = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.authToken ? `Bearer ${this.authToken}` : 'NA'
      }
    });

    // Add response interceptor for 401 errors
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.redirectToErrorPage();
        }
        return Promise.reject(error);
      }
    );
  }

  private getAuthToken(): string | null {
    const keys = [JWT_STORAGE_KEY, 'accessToken', 'token'];
    
    for (const key of keys) {
      const data = localStorage.getItem(key);
      if (!data) continue;

      // Try to parse as JSON first (our new format)
      try {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object') {
          // It's JSON. Check for token property.
          const token = parsed.token || parsed.access_token || parsed.accessToken;
          if (token) {
            const now = new Date().getTime();
            // Only expire if we have a valid future expiry date set
            if (parsed.expiry && parsed.expiry > 0 && now > parsed.expiry) {
              localStorage.removeItem(key);
              continue;
            }
            return token;
          }
        }
      } catch (e) {
        console.error(e);
        // Not JSON, assume it's a plain token string
        if (data.split('.').length === 3) {
          return data;
        }
      }
    }
    return null;
  }

  /** The signed-in user's token, for callers that use fetch() so a 401 does not redirect to /error. */
  getBearerToken(): string | null {
    this.refreshAuthToken();
    return this.authToken;
  }

  private refreshAuthToken(): void {
    this.authToken = this.getAuthToken();
    if (this.authToken) {
      this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${this.authToken}`;
    } else {
      this.axiosInstance.defaults.headers.common['Authorization'] = 'NA';
      // Don't redirect here - let the 401 interceptor handle it when actual API calls fail
    }
  }
  
  private redirectToErrorPage(): void {
    // Check if we're in a browser environment and not already on error page
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/error')) {
      window.location.href = '/error?reason=auth';
    }
  }
  
  updateAuthToken(): void {
    this.refreshAuthToken();
  }

  private getAuthHeaders(): Record<string, string> {
    // this.refreshAuthToken();
    return {
      'Authorization': this.authToken ? `Bearer ${this.authToken}` : 'NA'
    };
  }

  private normalizeLanguageCode(lang: string, fallback = 'gu'): string {
    const normalized = (lang || '').toLowerCase();
    return SUPPORTED_LANGUAGE_CODES.has(normalized) ? normalized : fallback;
  }

  private validateAuth(): boolean {
    // If we have no token, alert but don't force redirect here
    // Let the calling component or an interceptor handle navigation
    if (!this.authToken) {
      console.error("Authentication token missing in ApiService");
      return false;
    }
    return true;
  }

  async sendUserQuery(
    msg: string,
    session: string,
    sourceLang: string,
    targetLang: string,
    onStreamData?: (data: string) => void,
    persona?: ChatPersona,
    onTraceId?: (traceId: string) => void
  ): Promise<ChatResponse> {
    try {
      this.refreshAuthToken();
      if (!this.validateAuth()) {
        return { response: "Authentication error", status: "error" };
      }
      
      const resolvedSourceLang = this.normalizeLanguageCode(sourceLang, 'gu');
      const resolvedTargetLang = this.normalizeLanguageCode(targetLang, 'gu');
      const params: Record<string, string> = {
        session_id: session,
        query: msg,
        source_lang: resolvedSourceLang,
        target_lang: resolvedTargetLang,
        ...(persona && { persona }),
        ...(this.locationData && { location: `${this.locationData.latitude},${this.locationData.longitude}` })
      };

      if (onStreamData) {
        // Handle streaming response
        // Do not use getAuthHeaders which might include Content-Type
        this.refreshAuthToken();
        const headers = {
            'Authorization': this.authToken ? `Bearer ${this.authToken}` : 'NA',
            'Accept': '*/*'
        };
        
        const response = await fetch(`${this.apiUrl}/api/chat/?${new URLSearchParams(params)}`, {
          method: 'GET',
          headers: headers          
        });

        if (!response.ok) {
          if (response.status === 401) {
            this.redirectToErrorPage();
            const error = new Error('Unauthorized');
            (error as any).status = 401;
            throw error;
          }
          if (response.status === 429) {
            const error = new Error('Rate limit exceeded');
            (error as any).status = 429;
            throw error;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Read before the stream so the id is known while the answer is still arriving.
        const traceId = response.headers.get('X-Trace-Id');
        if (traceId && onTraceId) onTraceId(traceId);

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }

        let fullResponse = '';
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          fullResponse += chunk;
          onStreamData(chunk);
        }

        return { response: fullResponse, status: 'success' };
      } else {
        // Regular non-streaming request
        const config = {
          params,
          headers: this.getAuthHeaders()
        };
        const response = await this.axiosInstance.get('/api/chat/', config);
        return response.data;
      }
    } catch (error) {
      console.error('Error sending user query:', error);
      throw error;
    }
  }

  async getSuggestions(session: string, targetLang: string = 'gu'): Promise<SuggestionItem[]> {
    try {
      this.refreshAuthToken();
      if (!this.validateAuth()) {
        return [];
      }
      
      const params = {
        session_id: session,
        target_lang: this.normalizeLanguageCode(targetLang, 'gu')
      };

      const config = {
        params,
        headers: this.getAuthHeaders()
      };

      const response = await this.axiosInstance.get('/api/suggest/', config);
      return response.data.map((item: string) => ({
        question: item
      }));
    } catch (error) {
      console.error('Error getting suggestions:', error);
      throw error;
    }
  }

  async transcribeAudio(
    audioBase64: string,
    sessionId: string,
    sourceLang: string = 'gu',
    serviceType: string = environment.transcriptionProvider,
  ): Promise<TranscriptionResponse> {
    try {
      this.refreshAuthToken();
      if (!this.validateAuth()) {
        return { text: "", lang_code: "", status: "error" };
      }
      
      const payload = {
        audio_content: audioBase64,
        source_lang: this.normalizeLanguageCode(sourceLang, 'gu'),
        service_type: serviceType,
        session_id: sessionId
      };

      const config = {
        headers: this.getAuthHeaders()
      };

      const response = await this.axiosInstance.post('/api/transcribe/', payload, config);
      return response.data;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw error;
    }
  }

  getTranscript(sessionId: string, text: string, targetLang: string): Promise<AxiosResponse<TTSResponse>> {
    this.refreshAuthToken();
    if (!this.validateAuth()) {
      return Promise.reject(new Error("Authentication required"));
    }
    
    const config = {
      headers: this.getAuthHeaders()
    };
    
    return this.axiosInstance.post(`/api/tts/`, {
      session_id: sessionId,
      text: text,
      target_lang: this.normalizeLanguageCode(targetLang, 'gu'),
      service_type: environment.ttsProvider,
    }, config);
  }

  async submitPositiveFeedback(messageId: string): Promise<void> {
    try {
      this.refreshAuthToken();
      if (!this.validateAuth()) return;
      
      const payload = {
        message_id: messageId,
        feedback: "positive"
      };

      await this.axiosInstance.post('/api/feedback/positive/', payload, {
        headers: this.getAuthHeaders()
      });
    } catch (error) {
      console.error('Error submitting positive feedback:', error);
      throw error;
    }
  }

  async submitNegativeFeedback(messageId: string, reason: string, feedback: string): Promise<void> {
    try {
      this.refreshAuthToken();
      if (!this.validateAuth()) return;
      
      const payload = {
        message_id: messageId,
        reason: reason,
        feedback: feedback
      };

      await this.axiosInstance.post('/api/feedback/negative/', payload, {
        headers: this.getAuthHeaders()
      });
    } catch (error) {
      console.error('Error submitting negative feedback:', error);
      throw error;
    }
  }

  blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          const result = reader.result as string;
          const base64String = result.split(',')[1];
          if (base64String) {
            resolve(base64String);
          } else {
            reject(new Error('Failed to extract base64 from data URL'));
          }
        } catch (error) {
          console.error(error);
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(blob);
    });
  }

  setLocationData(location: LocationData): void {
    this.locationData = location;
  }

  getLocationData(): LocationData | null {
    return this.locationData;
  }

  setSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  getSessionId(): string | null {
    return this.currentSessionId;
  }
}

const apiService = new ApiService();
export default apiService;
