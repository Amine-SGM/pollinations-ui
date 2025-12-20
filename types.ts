export type MediaType = 'text' | 'image' | 'video' | 'audio';

export interface GenerationParams {
  width?: number;
  height?: number;
  aspectRatio?: string;
  enhance?: boolean;
  private?: boolean;
  isJSON?: boolean;
  nologo?: boolean;
  seed?: number;
  system?: string;
  temperature?: number;
  quality?: string;
  imageUrl?: string;
  duration?: number;
  negativePrompt?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  mediaUrl?: string;
  mediaType?: MediaType;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

export interface AppSettings {
  apiKey: string;
  useCustomEndpoint: boolean;
  customEndpoint: string;
  textModel: string;
  imageModel: string;
  videoModel: string;
  audioModel: string;
}