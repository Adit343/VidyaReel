import type React from 'react';
import type { Scene } from '@/lib/schemas/storyboard';
import { BulletReveal } from './BulletReveal';
import { DefinitionCallout } from './DefinitionCallout';
import { TitleHook } from './TitleHook';

export const templates: Partial<Record<Scene['template'], React.FC<{ scene: Scene }>>> = {
  'title-hook': TitleHook,
  'bullet-reveal': BulletReveal,
  'definition-callout': DefinitionCallout,
};
