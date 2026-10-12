"use client";

import { ROLE_LABELS } from "@/lib/constants";
import { useLang } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { UserAccount } from "@/types";
import { SackIcon } from "@/components/ft/icons";
import { LangToggle } from "@/components/layout/lang-toggle";

export const ROLE_COLOR: Record<UserAccount["role"], string> = {
  admin: "bg-money-tint text-money",
  manager: "bg-count-tint text-count",
  data_entry: "bg-pickup-tint text-pickup",
  viewer: "bg-elevated text-ink-dim",
};

/**
 * On-device demo copy only (no database): who is using FreshTrack. With the
 * database, each person signs in with their own email instead.
 */
export function SignInScreen() {
  const { t, sub } = useLang();
  const { users } = useStore();
  const { pick } = useSession();
  const people = users.filter((u) => u.isActive).sort((a, b) => (a.role === "admin" ? 1 : 0) - (b.role === "admin" ? 1 : 0) || a.name.localeCompare(b.name));

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-5">
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2.5 font-display text-2xl font-extrabold">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-money text-money-ink">
            <SackIcon size={22} strokeWidth={2.4} />
          </span>
          FreshTrack
        </span>
        <LangToggle />
      </header>

      <main className="flex flex-1 flex-col justify-center gap-4 py-8">
        <div>
          <h1 className="font-display text-[32px] font-extrabold leading-[1.1]">{t("आप कौन हैं?", "Who are you?")}</h1>
          <p className="mt-1 text-base text-ink-dim">{sub("आप कौन हैं? अपने नाम पर टैप करें", "Tap your name to start")}</p>
        </div>
        <div className="flex flex-col gap-2.5">
          {people.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => pick(u.id)}
              className="flex items-center gap-4 rounded-[20px] border-2 border-line bg-surface p-4 text-left transition-colors hover:border-line-strong"
            >
              <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-display text-2xl font-extrabold", ROLE_COLOR[u.role])}>{u.name.slice(0, 1)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-[22px] font-bold leading-tight">{u.name}</span>
                <span className="block truncate text-[15px] text-ink-dim">{t(ROLE_LABELS[u.role].hi, ROLE_LABELS[u.role].en)}</span>
              </span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
