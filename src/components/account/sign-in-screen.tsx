"use client";

import { useEffect, useState } from "react";
import { ROLE_LABELS } from "@/lib/constants";
import { useLang } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { UserAccount } from "@/types";
import { BackIcon, SackIcon } from "@/components/ft/icons";
import { LangToggle } from "@/components/layout/lang-toggle";

const LOCK_AFTER = 5;
const LOCK_SECONDS = 30;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export const ROLE_COLOR: Record<UserAccount["role"], string> = {
  admin: "bg-money-tint text-money",
  manager: "bg-count-tint text-count",
  data_entry: "bg-pickup-tint text-pickup",
  viewer: "bg-elevated text-ink-dim",
};

/** The first screen: who is using FreshTrack, then their 4-digit PIN. */
export function SignInScreen() {
  const { t, sub } = useLang();
  const { users } = useStore();
  const [picked, setPicked] = useState<UserAccount | null>(null);
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

      {picked ? (
        <PinPad user={picked} onBack={() => setPicked(null)} />
      ) : (
        <main className="flex flex-1 flex-col justify-center gap-4 py-8">
          <div>
            <h1 className="font-display text-[32px] font-extrabold leading-[1.1]">{t("आप कौन हैं?", "Who are you?")}</h1>
            <p className="mt-1 text-base text-ink-dim">{sub("आप कौन हैं? अपने नाम पर टैप करें", "Tap your name to sign in")}</p>
          </div>
          <div className="flex flex-col gap-2.5">
            {people.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setPicked(u)}
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
      )}
    </div>
  );
}

function PinPad({ user, onBack }: { user: UserAccount; onBack: () => void }) {
  const { t } = useLang();
  const { signIn } = useSession();
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(0);
  const [shake, setShake] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const locked = lockedUntil > now;

  useEffect(() => {
    if (!locked) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [locked]);

  function press(key: string) {
    if (locked || !key) return;
    if (key === "⌫") return setPin((p) => p.slice(0, -1));
    const next = (pin + key).slice(0, 4);
    setPin(next);
    if (next.length < 4) return;
    // Let the fourth dot show before checking.
    window.setTimeout(() => {
      if (signIn(user.id, next)) return;
      const misses = wrong + 1;
      setWrong(misses);
      setShake(true);
      window.setTimeout(() => setShake(false), 400);
      setPin("");
      if (misses % LOCK_AFTER === 0) {
        setLockedUntil(Date.now() + LOCK_SECONDS * 1000);
        setNow(Date.now());
      }
    }, 120);
  }

  // A hardware keyboard works too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("⌫");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <main className="flex flex-1 flex-col gap-5 pt-6">
      <button type="button" onClick={onBack} className="flex items-center gap-2 self-start rounded-[14px] bg-elevated py-2.5 pl-3 pr-4 text-[15px] font-bold">
        <BackIcon size={20} />
        {t("दूसरा नाम", "Not you?")}
      </button>
      <div className="text-center">
        <span className={cn("mx-auto flex h-20 w-20 items-center justify-center rounded-full font-display text-4xl font-extrabold", ROLE_COLOR[user.role])}>{user.name.slice(0, 1)}</span>
        <h1 className="mt-3 font-display text-[28px] font-extrabold leading-tight">
          {t("नमस्ते", "Hello")}, {user.name}
        </h1>
        <p className="text-base text-ink-dim">{t("अपना 4 अंक का PIN डालें", "Enter your 4-digit PIN")}</p>
      </div>

      <div className={cn("flex justify-center gap-4", shake && "animate-[shake_0.35s]")} aria-live="polite" aria-label={`${pin.length} of 4`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-5 w-5 rounded-full border-2", i < pin.length ? "border-money bg-money" : "border-line-strong")} />
        ))}
      </div>
      <p className="min-h-6 text-center text-[15px] font-bold text-danger-soft">
        {locked
          ? t(`बहुत बार गलत — ${Math.ceil((lockedUntil - now) / 1000)} सेकंड रुकें`, `Too many tries — wait ${Math.ceil((lockedUntil - now) / 1000)}s`)
          : wrong > 0
            ? t("PIN गलत है, फिर से डालें", "Wrong PIN, try again")
            : ""}
      </p>

      <div className="mt-auto grid grid-cols-3 gap-2">
        {KEYS.map((key, i) =>
          key ? (
            <button
              key={i}
              type="button"
              disabled={locked}
              onClick={() => press(key)}
              aria-label={key === "⌫" ? "Delete" : key}
              className={cn("min-h-[68px] rounded-2xl font-display text-[30px] font-bold active:brightness-125 disabled:opacity-40", key === "⌫" ? "bg-raised" : "bg-elevated")}
            >
              {key}
            </button>
          ) : (
            <span key={i} />
          )
        )}
      </div>
      <p className="text-center text-[13px] text-ink-faint">{t("PIN भूल गए? एडमिन से नया PIN लें", "Forgot your PIN? Ask the admin to reset it")}</p>
    </main>
  );
}
