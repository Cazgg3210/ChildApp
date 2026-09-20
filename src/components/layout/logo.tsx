import Link from "next/link";
import { cn } from "@/lib/utils";
import { brand } from "@/shared/config/brand";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground",
        className,
      )}
    >
      <svg viewBox="0 0 512 512" className="size-5" fill="none">
        <path
          d="M256 448c-14 0-27-5-37-14L98 322C56 283 48 218 80 172c35-50 106-58 152-20l24 20 24-20c46-38 117-30 152 20 32 46 24 111-18 150L293 434c-10 9-23 14-37 14z"
          fill="currentColor"
        />
        <circle cx="256" cy="250" r="46" fill="var(--primary)" />
        <path
          d="M186 372c10-44 40-66 70-66s60 22 70 66"
          stroke="var(--primary)"
          strokeWidth="28"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function Logo({
  href = "/",
  className,
  compact = false,
}: {
  href?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5 font-heading font-semibold tracking-tight", className)}
    >
      <LogoMark />
      {!compact && <span className="text-[15px]">{brand.name}</span>}
    </Link>
  );
}
