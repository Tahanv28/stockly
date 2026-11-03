import Link from "next/link";

export function Logo({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-white">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
          <path d="m3 8 9 5 9-5M12 13v8" />
        </svg>
      </span>
      <span>Stockly</span>
    </Link>
  );
}
