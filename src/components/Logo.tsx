import Link from 'next/link';

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="logo">
      <span className="logo-mark" aria-hidden />
      vidyareel
    </Link>
  );
}
