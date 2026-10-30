'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { AUDIENCES, audienceGroup, type AudienceGroup } from '@/config/audiences';
import { api } from '@/lib/client-api';
import type { VideoView } from '@/server/videos/view';
import { Select } from '../ui/Select';
import { Stepper } from './Stepper';

const MAX = 500;
const LENGTHS = [30, 60, 90] as const;
const ANGLES = [
  { id: 'everyday', icon: 'wb_twilight', title: 'Everyday example', text: 'Ties the idea to daily life, home or work.' },
  { id: 'step', icon: 'conversion_path', title: 'Step by step', text: 'Cause and effect, one step at a time.' },
  { id: 'mistake', icon: 'psychology_alt', title: 'Common mistake', text: 'Clears up the usual misunderstanding first.' },
] as const;
type AngleId = (typeof ANGLES)[number]['id'];

type Idea = { label: string; text: string; groups: readonly AudienceGroup[] };
type RawIdea = Omit<Idea, 'groups'>;
const withGroups = (groups: readonly AudienceGroup[], items: RawIdea[]): Idea[] => items.map((i) => ({ ...i, groups }));

const SCHOOL_IDEAS: RawIdea[] = [
  { label: 'Photosynthesis', text: 'Photosynthesis in leaf chloroplasts. Explain light and dark reactions for Class 7.' },
  { label: 'Water cycle', text: 'Water cycle and precipitation dynamics for Grade 7 earth science.' },
  { label: 'How vaccines work', text: 'How vaccines work and train the immune system with antibodies.' },
  { label: 'Why the sky is blue', text: 'Why the sky is blue and how Rayleigh scattering disperses sunlight.' },
  { label: 'Rainbows', text: 'Rainbows: Refraction, reflection, and dispersion through raindrops.' },
  { label: 'Seasons', text: 'Why do we have seasons? Axial tilt and Earth orbital path explained for Class 7.' },
  { label: 'Plate tectonics', text: 'Plate tectonics, fault lines, and why earthquakes happen.' },
  { label: "Newton's Third Law", text: "Newton's third law of motion: Action and reaction forces in sports." },
  { label: 'Mitochondria', text: 'Mitochondria: Cellular respiration and ATP production in animal cells.' },
  { label: 'Acids and bases', text: 'Acids and bases: How the pH scale works, with lemon juice and soap as examples.' },
  { label: 'Fall of Rome', text: 'Why did the Western Roman Empire fall? Key causes explained simply.' },
  { label: 'Fractions', text: 'What are fractions? Explain with pizza slices for Class 5.' },
  { label: 'Food chains', text: 'Food chains and food webs: Who eats whom in a forest ecosystem.' },
  { label: 'Electric circuits', text: 'How a simple electric circuit works: Battery, wire, bulb and switch.' },
  { label: 'Phases of the Moon', text: 'Why does the Moon change shape? The phases of the Moon for Class 6.' },
  { label: 'Pythagoras theorem', text: 'Pythagoras theorem explained with a ladder against a wall.' },
  { label: 'Indian Independence', text: 'Key events of the Indian freedom struggle from 1857 to 1947.' },
  { label: 'States of matter', text: 'Solid, liquid, gas: How particles behave when matter is heated or cooled.' },
  { label: 'Human digestion', text: 'The journey of a chapati through the human digestive system.' },
  { label: 'Metaphor vs simile', text: 'Metaphor versus simile: How to tell them apart, with examples.' },
  { label: 'Volcanoes', text: 'How volcanoes erupt: Magma, pressure and the ring of fire.' },
  { label: 'Friction', text: 'Friction: Why a ball stops rolling and how we use friction every day.' },
  { label: 'Prime numbers', text: 'Prime numbers: What makes a number prime and how to find them.' },
  { label: 'Heart and circulation', text: 'How the heart pumps blood around the body, step by step.' },
  { label: 'Industrial Revolution', text: 'The Industrial Revolution: How machines changed work and cities.' },
  { label: 'Chemical reactions', text: 'Signs of a chemical reaction: Rusting, cooking and burning compared.' },
  { label: 'Photosynthesis vs respiration', text: 'Photosynthesis versus respiration: Common mistake of mixing them up.' },
  { label: 'Tides', text: 'What causes ocean tides? The pull of the Moon and Sun explained.' },
  { label: 'Simple machines', text: 'Simple machines: Lever, pulley and inclined plane in daily life.' },
  { label: 'Democracy', text: 'What is democracy? How voting and elections work in India.' },
  { label: 'Parts of speech', text: 'Parts of speech: Nouns, verbs and adjectives with fun examples.' },
  { label: 'Greenhouse effect', text: 'The greenhouse effect and why Earth is warming.' },
  { label: 'Sound waves', text: 'How sound travels: Vibrations, waves and why we hear echoes.' },
  { label: 'Area and perimeter', text: 'Area versus perimeter: A common mistake with a garden example.' },
  { label: 'Mughal Empire', text: 'The Mughal Empire: Rise, achievements and decline in a few minutes.' },
  { label: 'DNA', text: 'What is DNA? How genes carry instructions for a living thing.' },
  { label: 'Magnetism', text: 'How magnets work: Poles, field lines and the Earth as a magnet.' },
  { label: 'Percentages', text: 'Percentages in shopping: Discounts and sale prices for Class 7.' },
  { label: 'Soil formation', text: 'How soil forms from rock over thousands of years.' },
  { label: 'Light reflection', text: 'Reflection of light: Mirrors, angles and why you see yourself.' },
  { label: 'Ancient Indus Valley', text: 'The Indus Valley Civilisation: Cities, drainage and trade.' },
  { label: 'Cell division', text: 'Mitosis step by step: How one cell becomes two.' },
  { label: 'Climate vs weather', text: 'Climate versus weather: A common mistake students make.' },
  { label: 'Gravity', text: 'What is gravity? Why things fall and why the Moon stays in orbit.' },
  { label: 'Haiku poetry', text: 'How to read and write a haiku: Syllables and imagery.' },
  { label: 'Evaporation', text: 'Evaporation and condensation: Why a cold glass gets wet outside.' },
  { label: 'Probability', text: 'Probability with a coin and a die: Simple chances for Class 7.' },
  { label: 'Renewable energy', text: 'Solar, wind and hydro: How renewable energy is made.' },
  { label: 'Respiratory system', text: 'How we breathe: Lungs, diaphragm and gas exchange.' },
  { label: 'Fundamental rights', text: 'Fundamental Rights in the Indian Constitution in plain language.' },
];

const COLLEGE_IDEAS: RawIdea[] = [
  { label: 'Big O notation', text: 'Big O notation: How to compare the speed of algorithms, with a search example.' },
  { label: 'Supply and demand', text: 'Supply and demand: How prices move, with a petrol price example.' },
  { label: 'Opportunity cost', text: 'Opportunity cost: The hidden price of every choice, with a student budget example.' },
  { label: 'Machine learning', text: 'What is machine learning? How a model learns from examples instead of rules.' },
  { label: 'Binary search', text: 'Binary search step by step: Why it finds a name in a sorted list so fast.' },
  { label: 'Normal distribution', text: 'The normal distribution: Why heights and exam marks form a bell curve.' },
  { label: 'Ohm\'s law', text: 'Ohm\'s law: Voltage, current and resistance in a simple circuit.' },
  { label: 'Inflation', text: 'What is inflation and why does the same Rs 100 buy less every year?' },
  { label: 'Recursion', text: 'Recursion explained: A function that calls itself, with a factorial example.' },
  { label: 'Entropy', text: 'Entropy and the second law of thermodynamics in everyday terms.' },
  { label: 'Cognitive biases', text: 'Confirmation bias: What it is and how it shapes the way we study and decide.' },
  { label: 'Derivatives', text: 'What a derivative really means: Slope and rate of change, with a speedometer example.' },
  { label: 'SQL joins', text: 'SQL joins: Inner, left and right join explained with two simple tables.' },
  { label: 'Study technique', text: 'Active recall and spaced repetition: A study method that beats re-reading.' },
  { label: 'Constitution basics', text: 'Separation of powers: Legislature, executive and judiciary in India.' },
  { label: 'Exam time management', text: 'How to plan the last 30 days before a competitive exam.' },
  { label: 'GDP', text: 'What is GDP? What it measures and what it leaves out.' },
  { label: 'Newton vs Einstein', text: 'Newton versus Einstein: How relativity changes our idea of gravity.' },
];

const WORK_IDEAS: RawIdea[] = [
  { label: 'Running better meetings', text: 'How to run a 15 minute meeting that ends with clear decisions and owners.' },
  { label: 'Writing clear emails', text: 'Five habits for writing emails people answer on the first read.' },
  { label: 'Eisenhower matrix', text: 'The Eisenhower matrix: Sorting work into urgent and important to beat overload.' },
  { label: 'Giving feedback', text: 'How to give feedback to a colleague without hurting the relationship.' },
  { label: 'SMART goals', text: 'SMART goals: How to turn a vague target into one you can track this quarter.' },
  { label: 'Phishing', text: 'How to spot a phishing email at work: Five warning signs.' },
  { label: 'Agile and Scrum', text: 'Agile and Scrum in one minute: Sprints, backlog and daily stand-up.' },
  { label: 'Salary negotiation', text: 'Salary negotiation basics: Preparing numbers, timing and what to say.' },
  { label: 'Time blocking', text: 'Time blocking: Plan your workday so deep work actually happens.' },
  { label: 'Public speaking', text: 'Three ways to calm nerves before presenting to your team.' },
  { label: 'Basic Excel formulas', text: 'Three Excel formulas every office worker should know: SUM, IF and VLOOKUP.' },
  { label: 'Data privacy at work', text: 'Data privacy at work: What counts as personal data and how to handle it.' },
  { label: 'Delegation', text: 'How to delegate well: Clear outcome, right person, regular check-in.' },
  { label: 'Burnout', text: 'Burnout: Early warning signs and what to do before it hits.' },
  { label: 'OKRs', text: 'OKRs: How objectives and key results keep a team pointed the same way.' },
  { label: 'Mutual funds', text: 'Mutual funds and SIPs explained for first-time investors.' },
  { label: 'Customer empathy', text: 'Handling an angry customer: Listen, acknowledge, then solve.' },
  { label: 'Onboarding first week', text: 'Your first week at a new job: What to learn, who to meet and what to ask.' },
];

const GENERAL_ONLY: RawIdea[] = [
  { label: 'Compound interest', text: 'Compound interest: Why starting to save early matters so much.' },
  { label: 'Credit score', text: 'What is a credit score and how can you improve yours?' },
  { label: 'Sleep and memory', text: 'Why sleep matters: What happens in your brain while you rest.' },
  { label: 'Fake news', text: 'How to check if a viral message is true in under a minute.' },
  { label: 'How UPI works', text: 'How a UPI payment moves money in seconds, step by step.' },
  { label: 'Habit loop', text: 'The habit loop: Cue, routine and reward, and how to build a good habit.' },
];

// The chips are picked from this list in the browser, so "Suggest more" is instant and costs no AI call.
const POOL: Idea[] = [
  ...withGroups(['school'], SCHOOL_IDEAS),
  // School topics that name a class or students do not suit a general audience.
  ...withGroups(['general'], SCHOOL_IDEAS.filter((i) => !/\b(class|grade|students?)\b/i.test(i.text))),
  ...withGroups(['college'], COLLEGE_IDEAS),
  ...withGroups(['work'], WORK_IDEAS),
  ...withGroups(['general'], GENERAL_ONLY),
];
const SHOWN = 12;

function ideasFor(group: AudienceGroup): Idea[] {
  return POOL.filter((i) => i.groups.includes(group));
}

function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type Banner =
  | { kind: 'unsafe' }
  | { kind: 'daily' }
  | { kind: 'failed'; message: string; videoId?: string; version?: number }
  | { kind: 'error'; message: string };

type Props = { initialTopic: string; voiceId?: string; quota: { used: number; limit: number }; tzLabel: string };

/** Create, Step 1 (Stitch "Create — Step 1: Idea"): default, topic typed, loading, unsafe topic, daily limit, script failed. */
export function CreateClient({ initialTopic, voiceId, quota, tzLabel }: Props) {
  const router = useRouter();
  const input = useRef<HTMLTextAreaElement>(null);
  const [topic, setTopic] = useState(initialTopic);
  const [angle, setAngle] = useState<AngleId | null>('everyday');
  const [lengthSec, setLengthSec] = useState<30 | 60 | 90>(60);
  const [audience, setAudience] = useState('General');
  const [ideas, setIdeas] = useState<Idea[]>(() => ideasFor(audienceGroup('General')).slice(0, SHOWN));
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState(false);
  const [used, setUsed] = useState(quota.used);
  const [banner, setBanner] = useState<Banner | null>(quota.used >= quota.limit ? { kind: 'daily' } : null);

  const limited = used >= quota.limit;
  const left = Math.max(0, quota.limit - used);
  const pct = Math.min(100, Math.round((used / Math.max(1, quota.limit)) * 100));

  function applyTopic(text: string) {
    setTopic(text.slice(0, MAX));
    setHint(false);
    if (banner?.kind === 'unsafe') setBanner(null);
    input.current?.focus();
  }

  function suggestMore() {
    const shown = new Set(ideas.map((i) => i.text));
    const pool = ideasFor(audienceGroup(audience));
    const fresh = shuffled(pool.filter((i) => !shown.has(i.text)));
    // Once everything has been shown, start over with a new order.
    setIdeas((fresh.length >= SHOWN ? fresh : [...fresh, ...shuffled(pool.filter((i) => shown.has(i.text)))]).slice(0, SHOWN));
  }

  function pickAudience(value: string) {
    setAudience(value);
    // Different audiences get different example topics.
    setIdeas(shuffled(ideasFor(audienceGroup(value))).slice(0, SHOWN));
  }

  function fail(e: { code: string; message: string; details?: Record<string, unknown> }) {
    if (e.code === 'UNSAFE_TOPIC') setBanner({ kind: 'unsafe' });
    else if (e.code === 'DAILY_LIMIT') { setUsed(quota.limit); setBanner({ kind: 'daily' }); }
    else if (e.code === 'STORYBOARD_FAILED' || e.code === 'PROVIDER_UNAVAILABLE' || e.code === 'NETWORK') {
      setBanner({
        kind: 'failed', message: e.code === 'NETWORK' ? e.message : e.code === 'PROVIDER_UNAVAILABLE' ? 'The AI service is busy right now.' : 'The script did not pass our checks.',
        videoId: e.details?.videoId as string | undefined, version: e.details?.version as number | undefined,
      });
    } else setBanner({ kind: 'error', message: e.message });
  }

  async function create() {
    if (loading || limited) return;
    if (topic.trim().length < 3) { setHint(true); input.current?.focus(); return; }
    setBanner(null);
    setLoading(true);
    const res = await api<VideoView>('/api/videos', {
      body: { topic: topic.trim(), lengthSec, audience, language: 'en', ...(angle ? { angle } : {}), ...(voiceId ? { voiceId } : {}) },
    });
    if (res.ok) { router.push(`/videos/${res.data.id}/review`); return; }
    setLoading(false);
    fail(res.error);
  }

  async function retry() {
    const b = banner;
    if (b?.kind !== 'failed' || loading) return;
    if (!b.videoId || b.version === undefined) { setBanner(null); return create(); }
    setBanner(null);
    setLoading(true);
    const res = await api<VideoView>(`/api/videos/${b.videoId}/regenerate`, { body: { version: b.version } });
    if (res.ok) { router.push(`/videos/${res.data.id}/review`); return; }
    setLoading(false);
    fail({ ...res.error, details: { videoId: b.videoId, version: res.error.details?.version ?? b.version } });
  }

  return (
    <main className="flex-1 w-full max-w-[1120px] mx-auto px-4 sm:px-6 pt-6 md:pt-9 pb-24 md:pb-20">
      <div className="max-w-[720px] mx-auto">
        <Stepper current={1} variant="dots" />

        <div className="mb-6">
          <h1 className="font-headline-lg text-headline-lg-mobile sm:text-[40px] sm:leading-[1.1] text-[#0F2A20] tracking-tight">What should the video explain?</h1>
          <p className="font-body-md text-[16px] text-[#54675D] mt-2 leading-[26px]">Describe what you want to explain. You can edit everything before it renders.</p>
        </div>

        {banner?.kind === 'unsafe' && (
          <div role="alert" className="mb-5 p-4 rounded-2xl bg-[#FDF2F2] border border-[#F5C2C2] text-[#C93A2E] flex items-start gap-3 animate-fade-in">
            <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">report</span>
            <div className="flex-1">
              <p className="text-[14px] font-medium">We cannot make a video about that topic. Try a different topic.</p>
              <p className="text-[12px] text-[#54675D] mt-0.5">The safety check flagged this topic as unsuitable for an educational video. Reword it or pick another idea below.</p>
            </div>
            <button onClick={() => setBanner(null)} className="text-[#54675D] hover:text-[#0F2A20] text-xs font-code-sm">Dismiss</button>
          </div>
        )}
        {banner?.kind === 'daily' && (
          <div role="status" className="mb-5 p-4 rounded-2xl bg-[#FEF8F0] border border-[#FBE0BC] flex items-start gap-3 animate-fade-in">
            <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5 text-[#B36B00]">timelapse</span>
            <div className="flex-1">
              <p className="text-[14px] font-medium text-[#935500]">You have used all {quota.limit} videos today. Resets at 12:00 AM {tzLabel}.</p>
              <p className="text-[12px] text-[#54675D] mt-0.5">Daily limits keep the free rendering service available for everyone. You can still edit and download existing videos.</p>
            </div>
            <button onClick={() => setBanner(null)} className="text-[#54675D] hover:text-[#0F2A20] text-xs font-code-sm">Dismiss</button>
          </div>
        )}
        {banner?.kind === 'failed' && (
          <div role="alert" className="mb-5 p-4 rounded-2xl bg-[#FDF2F2] border border-[#F5C2C2] text-[#C93A2E] flex items-start gap-3 animate-fade-in">
            <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">error_outline</span>
            <div className="flex-1">
              <p className="text-[14px] font-medium">We could not write the script. Try again.</p>
              <p className="text-[12px] text-[#54675D] mt-0.5">{banner.message} This attempt does not use up your daily allowance.</p>
            </div>
            <button onClick={retry} className="px-3 py-1 rounded-lg bg-white border border-[#B9C5B5] text-[#0F2A20] hover:bg-[#E1E7DF] text-xs font-medium transition-colors">Try again</button>
          </div>
        )}
        {banner?.kind === 'error' && (
          <div role="alert" className="mb-5 p-4 rounded-2xl bg-[#FDF2F2] border border-[#F5C2C2] text-[#C93A2E] flex items-start gap-3 animate-fade-in">
            <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">error_outline</span>
            <p className="flex-1 text-[14px] font-medium">{banner.message}</p>
            <button onClick={() => setBanner(null)} className="text-[#54675D] hover:text-[#0F2A20] text-xs font-code-sm">Dismiss</button>
          </div>
        )}

        <div className="bg-white rounded-[24px] border border-[#D3DBD0] hero-atelier-shadow p-6 sm:p-8 relative">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="topic-input" className="font-headline-sm text-[15px] text-[#0F2A20] tracking-tight">Topic or prompt</label>
              <span className={`font-code-sm text-[12px] ${topic.length >= MAX ? 'text-[#C93A2E]' : 'text-[#54675D]'}`}>{topic.length} / {MAX}</span>
            </div>
            <textarea
              ref={input} id="topic-input" rows={4} maxLength={MAX} value={topic} disabled={loading}
              onChange={(e) => { setTopic(e.target.value); setHint(false); }}
              placeholder={hint ? 'Please enter a topic first (at least 3 characters)…' : 'Why do we have seasons? Or: how to run a better meeting.'}
              className={`w-full rounded-[12px] border bg-white p-4 text-[16px] leading-[26px] text-[#0F2A20] placeholder:text-[#54675D]/60 focus:border-[#145A41] focus:ring-2 focus:ring-[#145A41]/10 outline-none transition-all resize-none font-body-md ${hint ? 'border-[#C93A2E]' : 'border-[#D3DBD0]'}`}
            />
          </div>

          <div className="mt-4 pt-1">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[13px] font-medium text-[#54675D] flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#FF9F1C]" />Need an idea?</span>
              <button type="button" onClick={suggestMore} disabled={loading} className="text-[13px] text-[#145A41] hover:text-[#0F4632] font-medium underline-offset-4 hover:underline rounded px-1 disabled:opacity-60">
                Suggest more
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {ideas.map((i) => (
                <button
                  key={i.text} type="button" onClick={() => applyTopic(i.text)} disabled={loading}
                  className="px-3 py-1.5 rounded-full bg-[#E1E7DF]/60 hover:bg-[#E1E7DF] text-[#0F2A20] text-[13px] border border-[#D3DBD0]/80 transition-colors"
                >{i.label}</button>
              ))}
            </div>
          </div>

          <div className="mt-7 pt-6 border-t border-[#D3DBD0]/80">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="font-headline-sm text-[15px] text-[#0F2A20] tracking-tight">Choose an angle</span>
                <span className="text-xs text-[#54675D] ml-2 font-code-sm">(Optional)</span>
              </div>
              <span className="text-xs text-[#54675D] hidden sm:inline">Adapts the tone</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Angle">
              {ANGLES.map((a) => {
                const on = angle === a.id;
                return (
                  <button
                    key={a.id} type="button" role="radio" aria-checked={on} disabled={loading} onClick={() => setAngle(on ? null : a.id)}
                    className={`text-left p-3.5 rounded-[16px] border relative transition-all group ${on ? 'border-[#145A41] bg-[#145A41]/5 shadow-sm' : 'border-[#D3DBD0] hover:border-[#B9C5B5] bg-white'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`material-symbols-outlined text-[20px] transition-colors ${on ? 'text-[#145A41]' : 'text-[#54675D] group-hover:text-[#145A41]'}`}>{a.icon}</span>
                      {on && <span className="w-4 h-4 rounded-full bg-[#145A41] text-white flex items-center justify-center text-[10px]">✓</span>}
                    </div>
                    <h2 className="font-headline-sm text-[14px] text-[#0F2A20] mt-2">{a.title}</h2>
                    <p className="text-[12px] text-[#54675D] mt-0.5 leading-normal">{a.text}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-7 pt-6 border-t border-[#D3DBD0]/80">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-end">
              <div className="sm:col-span-5">
                <span className="block font-headline-sm text-[13px] text-[#0F2A20] mb-2 tracking-tight">Length</span>
                <div className="flex bg-[#EEF1EC] p-1 rounded-[12px] border border-[#D3DBD0]" role="radiogroup" aria-label="Reel length">
                  {LENGTHS.map((s) => (
                    <button
                      key={s} type="button" role="radio" aria-checked={lengthSec === s} disabled={loading} onClick={() => setLengthSec(s)}
                      className={`flex-1 py-1.5 text-center text-[13px] font-code-sm rounded-[8px] transition-all ${lengthSec === s ? 'bg-white text-[#145A41] font-semibold shadow-sm border border-[#D3DBD0]/60' : 'text-[#54675D] hover:text-[#0F2A20]'}`}
                    >{s}s</button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-4">
                <label htmlFor="audience-select" className="block font-headline-sm text-[13px] text-[#0F2A20] mb-2 tracking-tight">Audience</label>
                <Select
                  id="audience-select" value={audience} disabled={loading} onChange={pickAudience}
                  options={AUDIENCES.map(({ value, label, hint }) => ({ value, label, hint }))}
                />
              </div>
              <div className="sm:col-span-3">
                <span className="block font-headline-sm text-[13px] text-[#0F2A20] mb-2 tracking-tight">Language</span>
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-[12px] bg-[#E1E7DF]/50 border border-[#D3DBD0] text-[#0F2A20] text-[14px]">
                  <span className="material-symbols-outlined text-[16px] text-[#145A41]">translate</span>
                  <span className="font-medium">English</span>
                  <span className="text-[10px] font-code-sm text-[#54675D] uppercase ml-auto">Fixed</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-[#D3DBD0] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="material-symbols-outlined text-[16px] text-[#145A41]">timelapse</span>
              <span className="font-code-sm text-[12px] text-[#54675D]">{left} of {quota.limit} videos left today{limited ? ' (Limit reached)' : ''}</span>
              <div className="w-8 h-1.5 bg-[#E1E7DF] rounded-full overflow-hidden" aria-hidden>
                <div className="h-full bg-gradient-to-r from-[#145A41] to-[#FF9F1C] rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <div className="w-full sm:w-auto flex flex-col items-end">
              {!loading ? (
                <button
                  type="button" onClick={create} disabled={limited}
                  className={`btn-lift w-full sm:w-auto px-6 py-3.5 rounded-[12px] text-white font-semibold text-[15px] tracking-tight shadow-sm flex items-center justify-center gap-2.5 ${limited ? 'bg-[#145A41] opacity-50 cursor-not-allowed' : 'bg-[#145A41] hover:bg-[#0F4632]'}`}
                >
                  <span>Create script and storyboard</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              ) : (
                <div className="w-full sm:w-[320px] flex flex-col items-end gap-1.5" role="status" aria-live="polite">
                  <button disabled className="w-full px-6 py-3.5 rounded-[12px] bg-[#145A41]/90 text-white font-semibold text-[15px] flex items-center justify-center gap-2.5 cursor-wait">
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    <span>Writing your script...</span>
                  </button>
                  <div className="w-full h-1 bg-[#D3DBD0] rounded-full overflow-hidden relative mt-1">
                    <div className="h-full w-1/2 bg-gradient-to-r from-[#145A41] to-[#FF9F1C] rounded-full animate-indeterminate" />
                  </div>
                  <span className="text-[12px] font-code-sm text-[#54675D]">This takes about 30 seconds</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between text-[12px] font-code-sm text-[#54675D] px-2">
          <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#1A8F5A]" /><span>The AI drafts it, you review every scene</span></div>
          <div className="mt-2 sm:mt-0">Target: 1080×1920 9:16 Vertical</div>
        </div>
      </div>
    </main>
  );
}
