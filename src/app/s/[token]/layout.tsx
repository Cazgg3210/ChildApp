import type { Metadata } from "next";
import { LogoMark } from "@/components/layout/logo";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { brand } from "@/shared/config/brand";

export const metadata: Metadata = {
  title: "Care Pass",
  robots: { index: false, follow: false, noarchive: true },
};

/** Caregiver surface: no app chrome, mobile-first, nothing indexable. */
export default function CarePassLayout({ children }: LayoutProps<"/s/[token]">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <header className="flex h-12 items-center justify-between px-4">
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <LogoMark className="size-7" /> {brand.shortName}
        </span>
        <LanguageSwitcher />
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-12 safe-bottom">{children}</main>
    </div>
  );
}
