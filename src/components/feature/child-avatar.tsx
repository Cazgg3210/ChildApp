import { cn } from "@/lib/utils";

const palette = [
  "bg-[oklch(0.9_0.05_190)] text-[oklch(0.35_0.07_190)]",
  "bg-[oklch(0.93_0.05_70)] text-[oklch(0.4_0.08_70)]",
  "bg-[oklch(0.92_0.04_330)] text-[oklch(0.4_0.08_330)]",
  "bg-[oklch(0.92_0.05_150)] text-[oklch(0.35_0.08_150)]",
  "bg-[oklch(0.92_0.04_260)] text-[oklch(0.38_0.08_260)]",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Child photos are private (signed URLs only). When there is no photo — or the
 * viewer is not allowed to see it — we render calm initials instead.
 */
export function ChildAvatar({
  name,
  seed,
  photoUrl,
  size = "md",
  className,
}: {
  name: string;
  seed?: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const sizes = { sm: "size-9 text-sm", md: "size-12 text-base", lg: "size-16 text-xl", xl: "size-24 text-3xl" };
  const color = palette[hash(seed ?? name) % palette.length];
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt="" className={cn("rounded-2xl object-cover", sizes[size], className)} />;
  }
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-2xl font-semibold",
        sizes[size],
        color,
        className,
      )}
    >
      {initials}
    </span>
  );
}
