/** R2 object keys; layout from docs/System-Design.md §7.6. */
export const storageKey = {
  audio: (videoId: string, sceneId: string, hash: string) => `videos/${videoId}/audio/${sceneId}-${hash}.mp3`,
  props: (videoId: string, jobId: string) => `videos/${videoId}/props-${jobId}.json`,
  output: (videoId: string, jobId: string) => `videos/${videoId}/out/${jobId}.mp4`,
  thumb: (videoId: string, jobId: string) => `videos/${videoId}/thumb-${jobId}.jpg`,
  media: (source: string, assetId: string) => `media/${source}/${assetId}.mp4`,
  music: (trackId: string) => `music/${trackId}.mp3`,
  narrationPreview: (videoId: string, hash: string) => `videos/${videoId}/preview/${hash}.mp3`,
  voiceSample: (voiceId: string) => `voices/${voiceId}-sample.mp3`,
};
