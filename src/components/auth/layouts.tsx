import { AuthFooter, AuthLogo, Icon } from './primitives';

/** Sign-in / Sign-up: form column on sage + forest art plate (Stitch Log In, Sign-Up). */
export function SplitAuth({ title, subtitle, art, children, below, spec }: {
  title: string; subtitle: string; art: React.ReactNode; children: React.ReactNode; below: React.ReactNode; spec?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-solstice-sage text-solstice-charcoal antialiased selection:bg-solstice-forest selection:text-white">
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 items-center justify-center px-4 py-6 md:px-8 md:py-10">
        <div className="grid min-h-[720px] w-full grid-cols-1 items-stretch gap-8 lg:grid-cols-12 lg:gap-10">
          <section className="flex flex-col justify-between rounded-3xl bg-solstice-sage px-4 py-6 sm:px-8 md:px-12 lg:col-span-6">
            <div className="mx-auto w-full max-w-[460px]">
              <div className="mb-10"><AuthLogo size="lg" /></div>
              <div className="mb-6">
                <h1 className="font-display text-[40px] font-bold leading-[1.1] tracking-tight text-solstice-charcoal md:text-[44px]">{title}</h1>
                <p className="mt-2 font-ui-regular text-[16px] leading-relaxed text-solstice-slate">{subtitle}</p>
              </div>
              {children}
              <div className="mt-7 text-center font-ui-regular text-[14px] text-solstice-slate">{below}</div>
            </div>
            {spec && (
              <div className="mt-8 flex items-center justify-between border-t border-solstice-border/60 pt-4 font-martian text-[10px] text-solstice-slate">
                <span>K-12 STUDIO WORKSTATION</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-solstice-success" /> SSO READY</span>
              </div>
            )}
          </section>
          <div className="hidden lg:contents">{art}</div>
        </div>
      </main>
      <AuthFooter />
    </div>
  );
}

/** Forgot / Reset: centred 480px card (Stitch Forgot Password, Reset Password). */
export function CardAuth({ chip, children, trust }: { chip: string; children: React.ReactNode; trust?: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-solstice-sage text-solstice-charcoal antialiased selection:bg-solstice-forest selection:text-white">
      <main className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="mb-8 flex w-full max-w-[480px] items-center justify-between">
          <AuthLogo size="lg" />
          <div className="hidden items-center gap-1.5 rounded-full border border-atelier-border bg-white/70 px-2.5 py-1 font-code-xs text-[11px] text-secondary sm:flex">
            <Icon name="lock" className="text-[14px] text-atelier-green" /><span>{chip}</span>
          </div>
        </div>
        <div className="relative w-full max-w-[480px] overflow-hidden rounded-2xl border border-atelier-border bg-white p-6 shadow-botanical-card transition-all duration-300 sm:p-10">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-atelier-green/20 via-atelier-green to-atelier-green/20 opacity-40" />
          {children}
        </div>
        {trust && (
          <div className="mt-6 flex items-center gap-1.5 font-code-xs text-xs text-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-atelier-green" /><span>{trust}</span>
          </div>
        )}
      </main>
      <AuthFooter />
    </div>
  );
}
