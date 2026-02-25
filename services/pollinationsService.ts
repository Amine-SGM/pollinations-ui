import { AppSettings, MediaType, GenerationParams } from '../types';

const BASE_URL = 'https://gen.pollinations.ai';
// The public key set by the developer in .env — safe for client-side use.
// Users can override it by entering their own key in Settings.
const ENV_PUBLIC_KEY: string = (import.meta as any).env.VITE_POLLINATIONS_API_KEY || '';

export class PollinationsService {
  private settings: AppSettings;

  constructor(settings: AppSettings) {
    this.settings = settings;
  }

  updateSettings(newSettings: AppSettings) {
    this.settings = newSettings;
  }

  /** Returns the effective API key: user's personal key, or falls back to the env public key. */
  getApiKey(): string {
    return this.settings.apiKey?.trim() || ENV_PUBLIC_KEY;
  }

  /** True when only the env default key is being used (no user key set). */
  isUsingDefaultKey(): boolean {
    return !this.settings.apiKey?.trim() && !!ENV_PUBLIC_KEY;
  }

  getMediaUrl(prompt: string, type: MediaType, seed: number, params: GenerationParams): string {
    const encodedPrompt = encodeURIComponent(prompt);
    const query = new URLSearchParams();

    // Common params
    query.append('seed', seed.toString());
    if (params.private) query.append('private', 'true');
    if (params.nologo) query.append('nologo', 'true');

    // Add API Key to GET requests for tracking
    const apiKey = this.getApiKey();
    if (apiKey) {
      query.append('key', apiKey);
    }

    switch (type) {
      case 'image':
        query.append('model', this.settings.imageModel || 'flux');
        if (params.width) query.append('width', params.width.toString());
        if (params.height) query.append('height', params.height.toString());
        if (params.enhance !== undefined) query.append('enhance', params.enhance.toString());
        if (params.quality) query.append('quality', params.quality);
        if (params.imageUrl) query.append('image', params.imageUrl);
        if (params.negativePrompt) query.append('negative_prompt', params.negativePrompt);
        return `${BASE_URL}/image/${encodedPrompt}?${query.toString()}`;

      // Video is now handled by generateVideo async method, but we keep this for fallback/sync usage if needed
      case 'video':
        query.append('model', this.settings.videoModel || 'veo');
        if (params.aspectRatio) query.append('aspectRatio', params.aspectRatio);
        if (params.quality) query.append('quality', params.quality);
        if (params.imageUrl) query.append('image', params.imageUrl);
        if (params.duration) query.append('duration', params.duration.toString());
        if (params.negativePrompt) query.append('negative_prompt', params.negativePrompt);
        return `${BASE_URL}/image/${encodedPrompt}?${query.toString()}`;

      case 'audio':
        // Audio handled by generateAudio
        let audioModel = this.settings.audioModel || 'openai-audio';
        if (audioModel.includes('gemini') && !audioModel.includes('audio')) {
          audioModel = 'openai-audio';
        }
        query.append('model', audioModel);
        return `${BASE_URL}/text/${encodedPrompt}?${query.toString()}`;

      default:
        return '';
    }
  }

  async generateVideo(prompt: string, seed: number, params: GenerationParams): Promise<string> {
    const encodedPrompt = encodeURIComponent(prompt);
    const query = new URLSearchParams();

    const model = this.settings.videoModel || 'veo';
    query.append('model', model);
    query.append('seed', seed.toString());

    // Ensure valid aspect ratio for video models (veo/seedance only support 16:9 or 9:16)
    // Defaulting 1:1 to 16:9 to avoid 400 errors
    let ratio = params.aspectRatio || '16:9';
    if (ratio !== '16:9' && ratio !== '9:16') {
      ratio = '16:9';
    }
    query.append('aspectRatio', ratio);

    if (params.private) query.append('private', 'true');
    if (params.nologo) query.append('nologo', 'true');

    // Video specific params
    if (params.quality) query.append('quality', params.quality);
    if (params.imageUrl) query.append('image', params.imageUrl);
    if (params.duration) query.append('duration', params.duration.toString());
    if (params.negativePrompt) query.append('negative_prompt', params.negativePrompt);

    const apiKey = this.getApiKey();
    if (apiKey) {
      query.append('key', apiKey);
    }

    const url = `${BASE_URL}/image/${encodedPrompt}?${query.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server returned ${response.status}: ${errorText.substring(0, 100)}`);
      }
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error: any) {
      console.error("Video generation error:", error);
      throw error;
    }
  }

  async generateAudio(prompt: string, seed: number): Promise<string> {
    const encodedPrompt = encodeURIComponent(prompt);
    const query = new URLSearchParams();

    let model = this.settings.audioModel || 'elevenlabs';
    // Strip out any text-only models that don't belong on the audio endpoint
    if (!['elevenlabs', 'elevenmusic'].includes(model)) {
      model = 'elevenlabs';
    }

    query.append('model', model);
    query.append('seed', seed.toString());

    const apiKey = this.getApiKey();
    if (apiKey) {
      query.append('key', apiKey);
    }

    // Correct audio endpoint: /audio/{text}
    const url = `${BASE_URL}/audio/${encodedPrompt}?${query.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server returned ${response.status}: ${errorText.substring(0, 100)}`);
      }
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error: any) {
      console.error("Audio generation error:", error);
      throw error;
    }
  }

  async sendTextMessage(prompt: string, history: { role: string; content: string }[], params: GenerationParams): Promise<string> {
    const endpoint = `${BASE_URL}/v1/chat/completions`;

    const systemMessage = params.system
      ? { role: 'system', content: params.system }
      : { role: 'system', content: 'You are a helpful AI assistant.' };

    const body: any = {
      messages: [
        systemMessage,
        ...history.map(h => ({ role: h.role, content: h.content })),
        { role: 'user', content: prompt }
      ],
      model: this.settings.textModel || 'openai',
      stream: false,
      seed: params.seed
    };

    if (params.temperature !== undefined) {
      body.temperature = params.temperature;
    }

    if (params.isJSON) {
      body.response_format = { type: "json_object" };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.getApiKey() ? { 'Authorization': `Bearer ${this.getApiKey()}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('⚠️ API key required. Please add your Pollinations API key in Settings → Your API Key. Get one at enter.pollinations.ai');
        }
        if (response.status === 402) {
          throw new Error('⚠️ Insufficient pollen balance. Please check your account at enter.pollinations.ai');
        }
        throw new Error(`API Error: ${response.status} - ${responseText}`);
      }

      try {
        const data = JSON.parse(responseText);
        if (data.choices && data.choices.length > 0) {
          return data.choices[0].message.content;
        } else if (typeof data === 'string') {
          return data;
        } else {
          return typeof data === 'object' ? JSON.stringify(data) : String(data);
        }
      } catch (e) {
        return responseText;
      }

    } catch (error: any) {
      console.error("Pollinations API Error:", error);
      return `Error: ${error.message}`;
    }
  }
}