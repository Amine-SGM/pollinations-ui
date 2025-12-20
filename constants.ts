
export const DEFAULT_ENDPOINT = 'https://gen.pollinations.ai/v1/chat/completions';
export const DEFAULT_IMAGE_ENDPOINT = 'https://gen.pollinations.ai/image/';

export const WELCOME_SUGGESTIONS = [
  { label: 'Create a cyberpunk city image', prompt: 'Generate an image of a futuristic cyberpunk city with neon lights and flying cars.' },
  { label: 'Explain quantum computing', prompt: 'Explain quantum computing in simple terms to a high school student.' },
  { label: 'Create a video of a dancing robot', prompt: 'A robot dancing in the rain, cinematic lighting.' },
  { label: 'Design a logo concept', prompt: 'Generate an image of a minimalist logo for a coffee shop named "Bean There".' },
];

export const TEXT_MODELS = [
  'openai',
  'openai-large',
  'openai-fast',
  'gemini',
  'gemini-fast',
  'gemini-large',
  'gemini-search',
  'claude',
  'claude-large',
  'claude-fast',
  'mistral',
  'qwen-coder',
  'deepseek',
  'grok',
  'perplexity-fast',
  'perplexity-reasoning',
  'searchgpt',
  'chickytutor',
  'kimi-k2-thinking',
  'nova-micro'
];

export const IMAGE_MODELS = [
  'flux',
  'flux-realism',
  'flux-anime',
  'flux-3d',
  'any-dark',
  'turbo',
  'kontext',
  'gptimage',
  'nanobanana',
  'nanobanana-pro',
  'seedream',
  'seedream-pro',
  'zimage'
];

export const VIDEO_MODELS = [
  'veo',
  'seedance',
  'seedance-pro'
];

export const AUDIO_MODELS = [
  'openai-audio'
];