import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme, type Theme } from '../theme';
import { Reveal, page, startOf, useHeadline, type SceneProps } from './shared';

const SPRING = { damping: 18, stiffness: 140 };

/** Progress (0 to 1) of every element of the scene, as a function of the current frame. */
function useStages(scene: SceneProps['scene']) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return scene.elements.map((_, i) => spring({ frame: frame - Math.round((startOf(scene, i) / 1000) * fps), fps, config: SPRING }));
}

const RAINBOW = ['#E5484D', '#F76B15', '#F5D90A', '#30A46C', '#0091FF', '#6E56CF'];

/** Generic flow: boxes top to bottom with an arrow between them. */
function Flow({ scene, t }: { scene: SceneProps['scene']; t: Theme }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      {scene.elements.map((el, i) => (
        <React.Fragment key={el.id}>
          <Reveal startMs={startOf(scene, i)}>
            <div style={{ background: i % 2 ? t.surface : t.primary, color: i % 2 ? t.ink : t.onPrimary, fontFamily: t.fontBody, fontWeight: 600, fontSize: 54, borderRadius: 36, padding: '30px 56px', textAlign: 'center', minWidth: 560 }}>
              {el.text}
            </div>
          </Reveal>
          {i < scene.elements.length - 1 && (
            <Reveal startMs={startOf(scene, i + 1)}>
              <svg width="60" height="56" viewBox="0 0 60 56"><path d="M30 0 V40 M12 26 L30 46 L48 26" stroke={t.spark} strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Reveal>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/** Light through a raindrop: a white beam enters, the drop appears, colours fan out. */
function Raindrop({ scene, t }: { scene: SceneProps['scene']; t: Theme }) {
  const stages = useStages(scene);
  const n = scene.elements.length;
  const beam = stages[0] ?? 1;
  const drop = stages[Math.min(1, n - 1)] ?? 1;
  const fan = stages[n - 1] ?? 1;
  return (
    <div>
      <svg width="888" height="640" viewBox="0 0 888 640">
        <line x1="20" y1="320" x2={20 + 290 * beam} y2="320" stroke={t.ink} strokeWidth="14" strokeLinecap="round" opacity="0.85" />
        <circle cx="440" cy="320" r="150" fill={t.primary} opacity={0.15 + 0.85 * drop} stroke={t.primary} strokeWidth="8" />
        {RAINBOW.map((c, k) => {
          const a = ((k - 2.5) * 9 * Math.PI) / 180;
          const len = 290 * fan;
          return <line key={c} x1="570" y1="330" x2={570 + Math.cos(a) * len} y2={330 + Math.sin(a) * len + 40} stroke={c} strokeWidth="16" strokeLinecap="round" opacity={fan} />;
        })}
      </svg>
      <Legend scene={scene} t={t} />
    </div>
  );
}

/** Earth circling the sun with a tilted axis; the orbit runs continuously with the frame number. */
function Orbit({ scene, t }: { scene: SceneProps['scene']; t: Theme }) {
  const frame = useCurrentFrame();
  const a = (frame / 150) * Math.PI * 2;
  const cx = 444, cy = 300, rx = 330, ry = 170;
  const ex = cx + Math.cos(a) * rx, ey = cy + Math.sin(a) * ry;
  return (
    <div>
      <svg width="888" height="600" viewBox="0 0 888 600">
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={t.muted} strokeWidth="6" strokeDasharray="14 14" opacity="0.6" />
        <circle cx={cx} cy={cy} r="74" fill={t.spark} />
        <g transform={`translate(${ex} ${ey})`}>
          <circle r="42" fill={t.primary} />
          <line x1="-14" y1="52" x2="14" y2="-52" stroke={t.ink} strokeWidth="7" strokeLinecap="round" />
        </g>
      </svg>
      <Legend scene={scene} t={t} />
    </div>
  );
}

/** Labels under a drawing, each shown on its cue. */
function Legend({ scene, t }: { scene: SceneProps['scene']; t: Theme }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center' }}>
      {scene.elements.map((el, i) => (
        <Reveal key={el.id} startMs={startOf(scene, i)}>
          <div style={{ background: t.surface, color: t.ink, fontFamily: t.fontBody, fontWeight: 600, fontSize: 48, borderRadius: 999, padding: '16px 40px', border: `4px solid ${t.spark}` }}>{el.text}</div>
        </Reveal>
      ))}
    </div>
  );
}

export const Diagram: React.FC<SceneProps> = ({ scene }) => {
  const t = useTheme();
  const headline = useHeadline();
  return (
    <AbsoluteFill style={{ background: t.canvas, ...page({ gap: 40 }) }}>
      <div style={{ ...headline, fontSize: 80, color: t.primary }}>{scene.title}</div>
      {scene.diagram === 'raindrop' ? <Raindrop scene={scene} t={t} />
        : scene.diagram === 'orbit' ? <Orbit scene={scene} t={t} />
        : <Flow scene={scene} t={t} />}
    </AbsoluteFill>
  );
};
