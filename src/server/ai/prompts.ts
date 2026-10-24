import { ENABLED_TEMPLATES } from '@/lib/schemas/storyboard';
import type { Prompt } from '@/server/providers';

export const WORDS_PER_SEC = 2.3;

export type StoryboardInput = { topic: string; lengthSec: number; audience: string; angle?: string; language: string };

const ANGLE_TEXT: Record<string, string> = {
  everyday: 'Relate the concept to familiar home, kitchen or street-life examples.',
  step: 'Explain it as a clear sequence of cause and effect, one step per scene.',
  mistake: 'Start by naming a common student misconception, then correct it.',
};

const JSON_ONLY = 'Reply with a single JSON object and nothing else. No markdown, no commentary.';

const rejected = (errors: string[]) =>
  errors.length ? `\n\nYour previous answer was rejected. Fix these problems:\n${errors.map((e) => `- ${e}`).join('\n')}` : '';

export function safetyPrompt(topic: string): Prompt {
  return {
    system: `You check lesson topics for a teaching-video tool used by teachers and students. ${JSON_ONLY}`,
    user: `Topic: """${topic}"""
Is this fine to explain in a short classroom video? Say no for content that gives instructions for violence, weapons, explosives, self-harm, hacking or drugs, sexual content, hate, or harassment of a real person. Normal school and general-knowledge topics (including the history of wars, human biology, chemistry, safety) are fine.
Return {"safe": true, "reason": "short reason"} with "safe" true or false.`,
  };
}

export function ideasPrompt(subject?: string): Prompt {
  return {
    system: `You suggest short-video lesson ideas for Indian school and college teachers. ${JSON_ONLY}`,
    user: `Suggest 6 different lesson topics${subject ? ` in the subject "${subject}"` : ' across school subjects'}. Each is one clear question or concept a teacher could explain in a 60 second video.
Return {"ideas":[{"topic":"Why is the sky blue?","hint":"Light scattering"}]} with exactly 6 items. "topic" is under 90 characters, "hint" is 2 to 4 words.`,
  };
}

export function anglesPrompt(topic: string): Prompt {
  return {
    system: `You help teachers pick how to approach a lesson in a short video. ${JSON_ONLY}`,
    user: `Topic: """${topic}"""
Give 3 angles. The ids must be exactly "everyday", "step", "mistake", in that order. Each has a short "label" and a one-sentence spoken "hook" for this topic.
Return {"angles":[{"id":"everyday","label":"Everyday example","hook":"..."}]}.`,
  };
}

const SCENE_RULES = `Scene rules:
- "template" is one of: ${ENABLED_TEMPLATES.join(', ')}.
  - title-hook: the opening scene, one big "title" element.
  - bullet-reveal: 2 to 4 "bullet" elements that appear one by one.
  - definition-callout: one "term" element and one "definition" element.
- "narration" is exactly what a narrator says aloud: plain sentences, no stage directions, no emoji, numbers written so they can be read aloud.
- Every element has a "cue": a short phrase (1 to 4 words) copied EXACTLY from the narration of that scene. The element appears when the narrator says the cue. List the elements in the order their cues are spoken.
- "text" is the short text shown on screen (under 60 characters; do not repeat the whole narration).
- Set "needsCheck": true and a short "checkNote" for scenes with a number, date, formula or factual claim a teacher should verify.`;

export function storyboardPrompt(i: StoryboardInput, previousErrors: string[] = []): Prompt {
  const words = Math.round(i.lengthSec * WORDS_PER_SEC);
  const scenes = i.lengthSec <= 30 ? '3 to 5' : i.lengthSec <= 60 ? '5 to 7' : '7 to 10';
  return {
    system: `You write scripts and storyboards for short vertical teaching videos (Instagram Reels) for Indian classrooms. Clear, warm, accurate, no hype. ${JSON_ONLY}`,
    user: `Topic: """${i.topic}"""
Audience: ${i.audience}. Language: ${i.language === 'en' ? 'English' : i.language}.
Target length: ${i.lengthSec} seconds, so the narration must total about ${words} words, no fewer than ${Math.round(words * 0.9)} (speech runs at about ${WORDS_PER_SEC} words per second). Count them. Use ${scenes} scenes.
${i.angle && ANGLE_TEXT[i.angle] ? `Approach: ${ANGLE_TEXT[i.angle]}\n` : ''}Start with a hook in the first scene and end with a one-line takeaway.

${SCENE_RULES}

Also write: a short video "title" (under 60 characters), an "accent" colour hex that suits the topic, an Instagram "caption" (under 300 characters, ends with a question for viewers) and up to 5 "hashtags" (each starting with #).
Return {"title":"","accent":"#145A41","caption":"","hashtags":[],"scenes":[{"template":"","title":"","narration":"","needsCheck":false,"checkNote":"","elements":[{"type":"","text":"","cue":""}]}]}.${rejected(previousErrors)}`,
  };
}

export function scenePrompt(
  i: StoryboardInput, scene: { title?: string; narration: string }, others: string[], instruction?: string, previousErrors: string[] = [],
): Prompt {
  return {
    system: `You rewrite one scene of a short teaching video. ${JSON_ONLY}`,
    user: `Topic: """${i.topic}""" for ${i.audience}.
The other scenes say, in order:
${others.map((n, k) => `${k + 1}. ${n}`).join('\n') || '(none)'}

Rewrite this scene${scene.title ? ` ("${scene.title}")` : ''}, currently: """${scene.narration}"""
${instruction ? `Teacher instruction: ${instruction}` : 'Make it clearer and more engaging, about the same length.'}

${SCENE_RULES}
Return one scene: {"template":"","title":"","narration":"","needsCheck":false,"checkNote":"","elements":[{"type":"","text":"","cue":""}]}.${rejected(previousErrors)}`,
  };
}
