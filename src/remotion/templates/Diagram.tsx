import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme, type Theme } from '../theme';
import { hasIcon, Icon } from './icons';
import { Backdrop, Reveal, page, startOf, useHeadline, useReveal, type SceneProps } from './shared';

const SPRING = { damping: 18, stiffness: 140 };

/** Progress (0 to 1) of every element of the scene, as a function of the current frame. */
function useStages(scene: SceneProps['scene']) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return scene.elements.map((_, i) => spring({ frame: frame - Math.round((startOf(scene, i) / 1000) * fps), fps, config: SPRING }));
}

const RAINBOW = ['#E5484D', '#F76B15', '#F5D90A', '#30A46C', '#0091FF', '#6E56CF'];

/** Pops in on its cue (scale and fade), then drifts a few pixels so the picture is never completely still. */
const Pop: React.FC<{ startMs: number; phase?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ startMs, phase = 0, children, style }) => {
  const p = useReveal(startMs);
  const frame = useCurrentFrame();
  const bob = Math.sin(frame / 22 + phase * 1.7) * 5 * Math.min(1, p);
  return <div style={{ opacity: Math.min(1, p * 1.6), transform: `translateY(${bob}px) scale(${0.45 + 0.55 * p})`, ...style }}>{children}</div>;
};

/** Round badge with the element's icon, or its number when it has none. */
const Bubble: React.FC<{ el: SceneProps['scene']['elements'][number]; n: number; size: number; t: Theme; light?: boolean }> = ({ el, n, size, t, light }) => {
  const bg = light ? t.surface : t.primary;
  const fg = light ? t.primary : t.onPrimary;
  return (
    <div style={{ width: size, height: size, borderRadius: size / 2, background: bg, border: `6px solid ${t.spark}`, boxShadow: '0 10px 28px rgba(0,0,0,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxSizing: 'border-box' }}>
      {hasIcon(el.icon)
        ? <Icon name={el.icon} size={size * 0.56} color={fg} strokeWidth={3.2} />
        : <span style={{ fontFamily: t.fontHeadline, fontWeight: 800, fontSize: size * 0.46, color: fg }}>{n}</span>}
    </div>
  );
};

const Label: React.FC<{ text: string; t: Theme; size?: number; width?: number }> = ({ text, t, size = 40, width = 250 }) => (
  <div style={{ fontFamily: t.fontBody, fontWeight: 600, fontSize: size, color: t.ink, textAlign: 'center', lineHeight: 1.12, width, background: t.surface, borderRadius: 28, padding: '10px 18px', boxSizing: 'border-box' }}>{text}</div>
);

/** Boxes top to bottom, each with its icon, joined by a line along which a dot keeps travelling. */
function Flow({ scene, t, stages }: { scene: SceneProps['scene']; t: Theme; stages: number[] }) {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: 888 }}>
      {scene.elements.map((el, i) => (
        <React.Fragment key={el.id}>
          <Pop startMs={startOf(scene, i)} phase={i} style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <Bubble el={el} n={i + 1} size={132} t={t} />
            <div style={{ flex: 1, background: t.surface, color: t.ink, fontFamily: t.fontBody, fontWeight: 600, fontSize: 52, lineHeight: 1.15, borderRadius: 36, padding: '28px 40px', borderLeft: `10px solid ${t.spark}` }}>
              {el.text}
            </div>
          </Pop>
          {i < scene.elements.length - 1 && (
            <div style={{ position: 'relative', height: 68, marginLeft: 62, width: 8 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: 4, background: t.spark, opacity: 0.55, transformOrigin: 'top', transform: `scaleY(${stages[i + 1] ?? 1})` }} />
              {(stages[i + 1] ?? 1) > 0.95 && <div style={{ position: 'absolute', left: -7, top: ((frame + i * 9) % 36) * 1.8 - 10, width: 22, height: 22, borderRadius: 11, background: t.primary }} />}
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

const ellipsePoint = (cx: number, cy: number, rx: number, ry: number, a: number) => [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];

/** Steps around a loop (water cycle, life cycle, carbon cycle): icons on a ring, arrows drawn between them, a dot circling. */
function Cycle({ scene, t, stages }: { scene: SceneProps['scene']; t: Theme; stages: number[] }) {
  const frame = useCurrentFrame();
  const n = scene.elements.length;
  const cx = 444, cy = 470, rx = 300, ry = 340;
  const angle = (i: number) => -Math.PI / 2 + (i / Math.max(3, n)) * Math.PI * 2;
  const pad = 0.36; // angle kept clear around each icon so the arrows start and end outside it
  const done = stages[n - 1] ?? 1;
  const dot = ellipsePoint(cx, cy, rx, ry, -Math.PI / 2 + (frame / 110) * Math.PI * 2);
  return (
    <div style={{ position: 'relative', width: 888, height: 960 }}>
      <svg width="888" height="960" style={{ position: 'absolute', inset: 0 }}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={t.muted} strokeWidth="4" strokeDasharray="4 18" strokeLinecap="round" opacity="0.4" />
        {scene.elements.map((el, i) => {
          if (n < 2) return null;
          const last = i === n - 1;
          const p = last ? Math.max(0, ((stages[n - 1] ?? 1) - 0.55) * 2.2) : stages[i + 1] ?? 1;
          const [x1, y1] = ellipsePoint(cx, cy, rx, ry, angle(i) + pad);
          const [x2, y2] = ellipsePoint(cx, cy, rx, ry, angle(i + 1) - pad);
          const shown = Math.min(1, p);
          return (
            <g key={el.id}>
              <path d={`M${x1} ${y1} A${rx} ${ry} 0 0 1 ${x2} ${y2}`} fill="none" stroke={t.spark} strokeWidth="11" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - shown} />
              {shown > 0.97 && <ArrowHead x={x2} y={y2} a={angle(i + 1) - pad + Math.PI / 2} color={t.spark} />}
            </g>
          );
        })}
        {done > 0.9 && n > 1 && <circle cx={dot[0]} cy={dot[1]} r="15" fill={t.primary} />}
      </svg>
      {scene.elements.map((el, i) => {
        const [x, y] = ellipsePoint(cx, cy, rx, ry, angle(i));
        return (
          <div key={el.id} style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)' }}>
            <Pop startMs={startOf(scene, i)} phase={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <Bubble el={el} n={i + 1} size={150} t={t} />
              <Label text={el.text} t={t} size={38} width={250} />
            </Pop>
          </div>
        );
      })}
    </div>
  );
}

const ArrowHead: React.FC<{ x: number; y: number; a: number; color: string }> = ({ x, y, a, color }) => (
  <polygon points="0,-22 36,0 0,22" fill={color} transform={`translate(${x} ${y}) rotate(${(a * 180) / Math.PI})`} />
);

/** One idea in the middle with parts or effects around it, joined by lines that grow outwards. */
function Radial({ scene, t, stages }: { scene: SceneProps['scene']; t: Theme; stages: number[] }) {
  const [centre, ...rest] = scene.elements;
  const cx = 444, cy = 470, rx = 300, ry = 350;
  const pos = rest.map((_, i) => ellipsePoint(cx, cy, rx, ry, -Math.PI / 2 + (i / Math.max(3, rest.length)) * Math.PI * 2));
  return (
    <div style={{ position: 'relative', width: 888, height: 960 }}>
      <svg width="888" height="960" style={{ position: 'absolute', inset: 0 }}>
        {pos.map(([x, y], i) => {
          const p = stages[i + 1] ?? 1;
          return <line key={rest[i].id} x1={cx} y1={cy} x2={cx + (x - cx) * p} y2={cy + (y - cy) * p} stroke={t.spark} strokeWidth="10" strokeLinecap="round" strokeDasharray="2 22" />;
        })}
      </svg>
      {centre && (
        <div style={{ position: 'absolute', left: cx, top: cy, transform: 'translate(-50%, -50%)' }}>
          <Pop startMs={startOf(scene, 0)}>
            <div style={{ width: 300, height: 300, borderRadius: 150, background: t.primary, border: `8px solid ${t.spark}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 24, boxSizing: 'border-box', boxShadow: '0 14px 36px rgba(0,0,0,0.2)' }}>
              {hasIcon(centre.icon) && <Icon name={centre.icon} size={92} color={t.onPrimary} strokeWidth={3} />}
              <span style={{ fontFamily: t.fontHeadline, fontWeight: 800, fontSize: centre.text.length > 16 ? 42 : 52, color: t.onPrimary, textAlign: 'center', lineHeight: 1.05 }}>{centre.text}</span>
            </div>
          </Pop>
        </div>
      )}
      {rest.map((el, i) => (
        <div key={el.id} style={{ position: 'absolute', left: pos[i][0], top: pos[i][1], transform: 'translate(-50%, -50%)' }}>
          <Pop startMs={startOf(scene, i + 1)} phase={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Bubble el={el} n={i + 1} size={140} t={t} light />
            <Label text={el.text} t={t} size={38} width={240} />
          </Pop>
        </div>
      ))}
    </div>
  );
}

/** Stacked bands that widen downwards (atmosphere layers, Earth's layers, a food pyramid); each slides in on its cue. */
function Layers({ scene, t }: { scene: SceneProps['scene']; t: Theme }) {
  const n = scene.elements.length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, width: 888 }}>
      {scene.elements.map((el, i) => {
        const pct = 100 - (i * 55) / Math.max(1, n - 1);
        const fg = pct >= 62 ? t.onPrimary : t.ink;
        return (
          <Pop key={el.id} startMs={startOf(scene, i)} phase={i} style={{ width: 520 + (i / Math.max(1, n - 1)) * 368, display: 'flex' }}>
            <div style={{ flex: 1, height: 168, borderRadius: 40, background: `color-mix(in srgb, ${t.primary} ${pct}%, ${t.surface})`, border: `5px solid ${t.spark}`, display: 'flex', alignItems: 'center', gap: 28, padding: '0 40px', boxSizing: 'border-box', boxShadow: '0 8px 22px rgba(0,0,0,0.12)' }}>
              {hasIcon(el.icon) && <Icon name={el.icon} size={84} color={fg} />}
              <span style={{ fontFamily: t.fontBody, fontWeight: 700, fontSize: 54, lineHeight: 1.1, color: fg }}>{el.text}</span>
            </div>
          </Pop>
        );
      })}
    </div>
  );
}

/** "Label: 40 percent" becomes a label and a number; without a number the bars simply step up. */
function parseBar(text: string) {
  const m = text.match(/^(.*?)\s*[:\-–]\s*(-?\d[\d,]*(?:\.\d+)?)\s*(.*)$/);
  if (!m) return { label: text, value: null as number | null, unit: '' };
  return { label: m[1] || text, value: parseFloat(m[2].replace(/,/g, '')), unit: m[3] };
}

/** Horizontal bars that grow to their value, with the number counting up. */
function Bars({ scene, t, stages }: { scene: SceneProps['scene']; t: Theme; stages: number[] }) {
  const rows = scene.elements.map((el) => ({ el, ...parseBar(el.text) }));
  const numeric = rows.every((r) => r.value !== null);
  const values = rows.map((r, i) => (numeric ? Math.max(0, r.value as number) : i + 1));
  const max = Math.max(1, ...values);
  const pctOf = (i: number) => Math.max(8, (values[i] / max) * 100);
  const amount = (i: number, shown: number) => `${Number.isInteger(values[i]) ? Math.round(shown) : shown.toFixed(1)}${rows[i].unit ? ` ${rows[i].unit}` : ''}`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40, width: 888 }}>
      {rows.map((r, i) => {
        const p = stages[i] ?? 1;
        const shown = values[i] * p;
        return (
          <div key={r.el.id} style={{ opacity: Math.min(1, p * 2) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 12 }}>
              {hasIcon(r.el.icon) && <Icon name={r.el.icon} size={58} color={t.primary} />}
              <span style={{ fontFamily: t.fontBody, fontWeight: 600, fontSize: 50, color: t.ink }}>{r.label}</span>
            </div>
            <div style={{ height: 84, borderRadius: 42, background: t.surface, border: `4px solid ${t.spark}`, overflow: 'hidden', display: 'flex', alignItems: 'center', boxSizing: 'border-box' }}>
              <div style={{ width: `${pctOf(i) * p}%`, height: '100%', background: t.primary, borderRadius: 38, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 28, boxSizing: 'border-box', flexShrink: 0 }}>
                {numeric && pctOf(i) >= 40 && <span style={{ fontFamily: t.fontHeadline, fontWeight: 800, fontSize: 48, color: t.onPrimary, whiteSpace: 'nowrap' }}>{amount(i, shown)}</span>}
              </div>
              {numeric && pctOf(i) < 40 && <span style={{ fontFamily: t.fontHeadline, fontWeight: 800, fontSize: 48, color: t.primary, whiteSpace: 'nowrap', paddingLeft: 20 }}>{amount(i, shown)}</span>}
            </div>
          </div>
        );
      })}
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
  const stages = useStages(scene);
  return (
    <AbsoluteFill style={{ background: t.canvas }}>
      <Backdrop bg={t.canvas} />
      <AbsoluteFill style={page({ gap: 40 })}>
        <div style={{ ...headline, fontSize: 80, color: t.primary }}>{scene.title}</div>
        {scene.diagram === 'raindrop' ? <Raindrop scene={scene} t={t} />
          : scene.diagram === 'orbit' ? <Orbit scene={scene} t={t} />
          : scene.diagram === 'cycle' ? <Cycle scene={scene} t={t} stages={stages} />
          : scene.diagram === 'radial' ? <Radial scene={scene} t={t} stages={stages} />
          : scene.diagram === 'layers' ? <Layers scene={scene} t={t} />
          : scene.diagram === 'bars' ? <Bars scene={scene} t={t} stages={stages} />
          : <Flow scene={scene} t={t} stages={stages} />}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
