import { afterEach, expect, it, vi } from 'vitest';
import type { AppSettings } from '../types';
import { PollinationsService } from './pollinationsService';

afterEach(() => vi.unstubAllGlobals());

it.each(['elevenmusic', 'elevenlabs/music-v1', 'elevenlabs', 'elevenlabs/eleven-v3'])(
  'sends the selected audio model %s without replacing it with TTS',
  async (model) => {
    const fetch = vi.fn(async () => new Response('audio', { headers: { 'Content-Type': 'audio/mpeg' } }));
    vi.stubGlobal('fetch', fetch);
    const service = new PollinationsService({ apiKey: 'test-key', audioModel: model } as AppSettings);
    const result = await service.generateAudio('An instrumental track', 42);
    const request = new URL(fetch.mock.calls[0][0] as string);
    expect(request.pathname).toBe('/audio/An%20instrumental%20track');
    expect(request.searchParams.get('model')).toBe(model);
    URL.revokeObjectURL(result);
  },
);

it('keeps the existing fallback when no model is selected', async () => {
  const fetch = vi.fn(async () => new Response('audio'));
  vi.stubGlobal('fetch', fetch);
  const result = await new PollinationsService({ apiKey: 'test-key' } as AppSettings).generateAudio('Hello', 1);
  expect(new URL(fetch.mock.calls[0][0] as string).searchParams.get('model')).toBe('elevenlabs');
  URL.revokeObjectURL(result);
});
