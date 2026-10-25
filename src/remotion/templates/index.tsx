import type React from 'react';
import type { Scene } from '@/lib/schemas/storyboard';
import { BulletReveal } from './BulletReveal';
import { Comparison } from './Comparison';
import { DefinitionCallout } from './DefinitionCallout';
import { Diagram } from './Diagram';
import { Formula } from './Formula';
import { Recap } from './Recap';
import { Stat } from './Stat';
import { StockClip } from './StockClip';
import { StepFlow } from './StepFlow';
import { Timeline } from './Timeline';
import { TitleHook } from './TitleHook';

export const templates: Partial<Record<Scene['template'], React.FC<{ scene: Scene }>>> = {
  'title-hook': TitleHook,
  'bullet-reveal': BulletReveal,
  'definition-callout': DefinitionCallout,
  'step-flow': StepFlow,
  stat: Stat,
  comparison: Comparison,
  timeline: Timeline,
  formula: Formula,
  diagram: Diagram,
  recap: Recap,
  'stock-clip': StockClip,
};
