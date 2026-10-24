import type { VideoStatus } from '@/lib/schemas/video';

type Look = { label: string; pill: string; dot: string; ping?: boolean };

/** Status pill used on Home cards (Stitch Dashboard). */
export const HOME_STATUS: Record<VideoStatus, Look> = {
  ready: { label: 'Ready to post', pill: 'bg-[#E7FFF2] text-[#145A41] border-[#92D4B4] font-bold', dot: 'bg-[#1A8F5A]' },
  storyboard_ready: { label: 'In review', pill: 'bg-[#FFF8EB] text-[#744400] border-[#FFDCBC] font-bold', dot: 'bg-[#FF9F1C]' },
  posted: { label: 'Posted', pill: 'bg-[#EEF1EC] text-[#506359] border-[#D3DBD0] font-medium', dot: 'bg-[#506359]' },
  draft: { label: 'Draft script', pill: 'bg-white text-[#506359] border-[#D3DBD0] font-medium', dot: 'bg-[#B9C5B5]' },
  rendering: { label: 'Rendering', pill: 'bg-[#FFF8EB] text-[#744400] border-[#FFDCBC] font-bold', dot: 'bg-[#FF9F1C]', ping: true },
  scheduled: { label: 'Scheduled', pill: 'bg-[#EAF3FB] text-[#1F5E99] border-[#C9DFF2] font-bold', dot: 'bg-[#2F7FC1]' },
  failed: { label: 'Failed', pill: 'bg-[#FFDAD6] text-[#93000A] border-[#C93A2E]/30 font-bold', dot: 'bg-[#C93A2E]' },
};

/** Where a card's primary action leads, and its label, per status (Home and Library). */
export const NEXT_STEP: Record<VideoStatus, { label: string; to: (id: string) => string; icon: string }> = {
  draft: { label: 'Continue at Idea', to: (id) => `/videos/${id}/review`, icon: 'edit' },
  storyboard_ready: { label: 'Continue at Review', to: (id) => `/videos/${id}/review`, icon: 'arrow_forward' },
  rendering: { label: 'View render progress', to: (id) => `/videos/${id}/generate`, icon: 'tune' },
  ready: { label: 'Continue to Post', to: (id) => `/videos/${id}/post`, icon: 'arrow_forward' },
  scheduled: { label: 'View schedule settings', to: (id) => `/videos/${id}/post`, icon: 'event' },
  posted: { label: 'View post', to: (id) => `/videos/${id}/post`, icon: 'open_in_new' },
  failed: { label: 'Try again', to: (id) => `/videos/${id}/generate`, icon: 'refresh' },
};

export const FILTER_GROUPS = {
  drafts: ['draft', 'storyboard_ready'], ready: ['ready', 'scheduled'], posted: ['posted'],
} as const;
