import type { ZodType, ZodTypeDef } from 'zod';

export type Word = { word: string; startMs: number; endMs: number };
export type Prompt = { system: string; user: string };
export type MediaCandidate = {
  id: string; url: string; pageUrl: string; source: 'pexels' | 'pixabay'; licence: string; attribution?: string;
  durationSec: number; width: number; height: number;
};
export type Connection = { igUserId: string; accessToken: string };

export interface LlmProvider {
  generate<T>(prompt: Prompt, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T>;
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
  /** A time-limited link; `downloadName` makes the browser save the file under that name instead of playing it. */
  signedGet(key: string, ttlSec: number, opts?: { downloadName?: string }): Promise<string>;
  exists(key: string): Promise<boolean>;
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
