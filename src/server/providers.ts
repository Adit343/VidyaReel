import type { ZodType } from 'zod';

export type Word = { word: string; startMs: number; endMs: number };
export type Prompt = { system: string; user: string };
export type MediaCandidate = { id: string; url: string; source: 'pexels' | 'pixabay'; licence: string; attribution?: string };
export type Connection = { igUserId: string; accessToken: string };

export interface LlmProvider {
  generate<T>(prompt: Prompt, schema: ZodType<T>): Promise<T>;
}
export interface VoiceProvider {
  synthesize(text: string, opts: { voiceId: string; speed: number }): Promise<{
    audio: Buffer; durationMs: number; words: Word[]; credits: number;
  }>;
}
export interface MediaProvider {
  search(query: string, opts: { orientation: 'portrait'; minSec: number }): Promise<MediaCandidate[]>;
}
export interface StorageProvider {
  put(key: string, body: Buffer, type: string): Promise<void>;
  signedGet(key: string, ttlSec: number): Promise<string>;
  delete(key: string): Promise<void>;
}
export interface Renderer {
  render(props: unknown, opts: { sceneIds?: string[] }): Promise<{ outputKey: string; durationMs: number }>;
}
export interface SocialPublisher {
  createContainer(conn: Connection, videoUrl: string, caption: string): Promise<string>;
  status(conn: Connection, containerId: string): Promise<'IN_PROGRESS' | 'FINISHED' | 'ERROR'>;
  publish(conn: Connection, containerId: string): Promise<{ mediaId: string; permalink: string }>;
}
