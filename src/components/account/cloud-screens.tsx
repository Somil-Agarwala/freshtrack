"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useLang } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useSync } from "@/lib/store";
import { SyncError, type SyncErrorKind } from "@/lib/sync/engine";
import { cn } from "@/lib/utils";
import { AlertIcon, CheckIcon, CloudIcon, CloudOffIcon, EyeIcon, LogoutIcon, SackIcon } from "@/components/ft/icons";
import { Field, inputClass } from "@/components/ft/kit";
import { BigButton, softButton } from "@/components/ft/screen";
import { LangToggle } from "@/components/layout/lang-toggle";

/* ------------------------------------------------------------------ */

function Page({ children }: { children: ReactNode }) {
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
      {children}
    </div>
  );
}

function useProblemText() {
  const { t } = useLang();
  return (kind?: SyncErrorKind) => {
    switch (kind) {
      case "network":
        return t("इंटरनेट नहीं है", "No internet");
      case "forbidden":
        return t("इस खाते को FreshTrack का डेटा देखने की अनुमति नहीं है", "This account has no access to FreshTrack data");
      case "setup":
        return t("डेटाबेस अभी तैयार नहीं है", "The database is not set up yet");
      case "auth":
        return t("ईमेल या पासवर्ड गलत है", "Wrong email or password");
      default:
        return t("सर्वर से जवाब नहीं आया, फिर से कोशिश करें", "The server did not answer, try again");
    }
  };
}

/* ------------------------------------------------------------------ */

/**
 * Once per phone: the owner signs the phone in to the business. After that
 * staff only tap their name and PIN, and every phone shows the same data.
 */
export function BusinessLogin() {
  const { t, sub } = useLang();
  const { signIn } = useSync();
  const problem = useProblemText();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SyncErrorKind | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof SyncError ? err.kind : "server");
      setBusy(false);
    }
  }

  return (
    <Page>
      <main className="flex flex-1 flex-col justify-center gap-5 py-8">
        <div>
          <span className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-pickup-tint text-pickup">
            <CloudIcon size={34} />
          </span>
          <h1 className="font-display text-[30px] font-extrabold leading-[1.1]">{t("इस फ़ोन को जोड़ें", "Connect this phone")}</h1>
          <p className="mt-1.5 text-base leading-snug text-ink-dim">
            {t(
              "मालिक एक बार अपना ईमेल और पासवर्ड डालें। फिर इस फ़ोन पर भी वही डेटा दिखेगा जो बाकी सब फ़ोन पर है।",
              "The owner signs in once. After that this phone shows the same data as every other phone."
            )}
          </p>
          <p className="mt-1 text-sm text-ink-faint">{sub("मालिक एक बार लॉग इन करें", "The owner signs in once")}</p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field hi="ईमेल" en="Email">
            <input
              className={inputClass}
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field hi="पासवर्ड" en="Password">
            <div className="relative">
              <input
                className={cn(inputClass, "pr-14")}
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? t("पासवर्ड छुपाएँ", "Hide password") : t("पासवर्ड दिखाएँ", "Show password")}
                aria-pressed={show}
                className={cn("absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-xl", show ? "bg-raised text-ink" : "text-ink-dim")}
              >
                <EyeIcon size={22} />
              </button>
            </div>
          </Field>

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-2xl bg-danger-tint p-3 text-[15px] font-bold text-danger-soft">
              <AlertIcon size={20} className="mt-0.5 shrink-0" />
              {problem(error)}
            </p>
          )}

          <BigButton tone="money" type="submit" disabled={busy || !email.trim() || !password}>
            {busy ? t("जोड़ रहे हैं…", "Connecting…") : t("फ़ोन जोड़ें", "Connect phone")}
          </BigButton>
        </form>
        <p className="text-center text-sm text-ink-faint">{t("पासवर्ड नहीं पता? मालिक से पूछें", "No password? Ask the owner")}</p>
      </main>
    </Page>
  );
}

/** First load on a phone: nothing to show until the data arrives. */
export function SyncLoading() {
  const { t } = useLang();
  return (
    <Page>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <span className="h-14 w-14 animate-spin rounded-full border-4 border-line border-t-money" aria-hidden />
        <p className="font-display text-2xl font-extrabold">{t("डेटा आ रहा है…", "Getting the data…")}</p>
        <p className="text-ink-dim">{t("पहली बार में थोड़ा समय लगता है", "The first time takes a moment")}</p>
      </main>
    </Page>
  );
}

/** The first load failed and there is nothing saved on the phone to show. */
export function SyncProblem() {
  const { t } = useLang();
  const { status, syncNow, signOut } = useSync();
  const problem = useProblemText();
  return (
    <Page>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-tint text-danger-soft">
          {status.error === "network" ? <CloudOffIcon size={32} /> : <AlertIcon size={32} />}
        </span>
        <p className="font-display text-2xl font-extrabold">{problem(status.error)}</p>
        <p className="text-ink-dim">
          {status.error === "network"
            ? t("इंटरनेट आते ही डेटा अपने आप आ जाएगा", "The data comes as soon as the internet is back")
            : status.error === "forbidden"
              ? t("सही खाते से लॉग इन करें", "Sign in with the business account")
              : t("थोड़ी देर में फिर से कोशिश करें", "Try again in a little while")}
        </p>
        <BigButton tone="neutral" className="max-w-xs" onClick={syncNow}>
          {t("फिर से कोशिश करें", "Try again")}
        </BigButton>
        {status.error === "forbidden" && (
          <button type="button" onClick={() => void signOut()} className="text-base font-bold text-ink-dim">
            {t("दूसरे खाते से लॉग इन करें", "Use another account")}
          </button>
        )}
      </main>
    </Page>
  );
}

/* ------------------------------------------------------------------ */

/**
 * A strip at the top of every screen, only while something is not saved:
 * offline (changes kept on the phone), saving slowly, or stuck.
 */
export function SyncPill() {
  const { t } = useLang();
  const { mode, account, status, syncNow } = useSync();
  const saving = status.pending > 0 && status.busy;
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!saving) return setSlow(false);
    const timer = window.setTimeout(() => setSlow(true), 1500);
    return () => window.clearTimeout(timer);
  }, [saving]);

  if (mode !== "cloud" || !account) return null;
  const offline = status.error === "network";
  const stuck = !!status.error && !offline && status.error !== "auth";
  if (!offline && !stuck && !slow) return null;

  const text = offline
    ? status.pending > 0
      ? t(`इंटरनेट नहीं · ${status.pending} बदलाव फ़ोन में रखे हैं`, `Offline · ${status.pending} change${status.pending > 1 ? "s" : ""} kept on this phone`)
      : t("इंटरनेट नहीं · पुराना डेटा दिख रहा है", "Offline · data may be old")
    : stuck
      ? t("सेव नहीं हो रहा · दबाएँ", "Not saving · tap to retry")
      : t("सेव हो रहा है…", "Saving…");

  return (
    <button
      type="button"
      onClick={syncNow}
      aria-live="polite"
      className={cn(
        // In the page flow (sticky), so it pushes the screen down instead of covering its header.
        "sticky top-0 z-50 flex w-full items-center justify-center gap-2 px-4 pb-2 pt-[calc(8px+env(safe-area-inset-top))] text-[15px] font-bold",
        offline ? "bg-count text-count-ink" : stuck ? "bg-danger text-white" : "bg-raised text-ink"
      )}
    >
      {offline ? <CloudOffIcon size={18} className="shrink-0" /> : <CloudIcon size={18} className="shrink-0" />}
      <span className="truncate">{text}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */

function ago(ms: number | undefined, t: (hi: string, en: string) => string) {
  if (!ms) return t("अभी नहीं", "not yet");
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return t("अभी", "just now");
  const m = Math.round(s / 60);
  if (m < 60) return t(`${m} मिनट पहले`, `${m} min ago`);
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Settings: is this phone in step with the others, and the business account. */
export function ThisDeviceCard() {
  const { t, sub } = useLang();
  const { can } = useSession();
  const { mode, account, status, live, syncNow, changePassword, signOut } = useSync();
  const problem = useProblemText();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwState, setPwState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [confirmOut, setConfirmOut] = useState(false);
  const [, tick] = useState(0);

  // Keeps "2 min ago" current.
  useEffect(() => {
    const timer = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (mode === "local") {
    return (
      <p className="rounded-2xl bg-count-tint p-3.5 text-[15px] text-count-note">
        {t("यह ऐप इस फ़ोन पर अकेले चल रहा है: डेटा दूसरे फ़ोन में नहीं जाता और रीलोड पर मिट जाता है।", "This copy runs on this device only: data is not shared and is cleared on reload.")}
      </p>
    );
  }

  const ok = !status.error && status.pending === 0;
  const pwReady = pw.length >= 8 && pw === pw2;

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4">
      <p className="text-[15px] font-bold">
        {t("सब फ़ोन का डेटा", "Shared data")} <span className="font-medium text-ink-faint">· {sub("सब फ़ोन का डेटा", "Shared data")}</span>
      </p>

      <div className={cn("flex items-start gap-3 rounded-2xl p-3", ok ? "bg-money-tint" : status.error === "network" ? "bg-count-tint" : "bg-elevated")}>
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", ok ? "bg-money text-money-ink" : "bg-raised text-ink")}>
          {ok ? <CheckIcon size={22} /> : status.error === "network" ? <CloudOffIcon size={22} /> : <CloudIcon size={22} />}
        </span>
        <span className="min-w-0 flex-1 text-[15px] leading-snug">
          <b className="block text-base">
            {ok
              ? live
                ? t("सब फ़ोन जुड़े हैं — बदलाव तुरंत दिखते हैं", "Connected — changes show on every phone at once")
                : t("सब सेव है", "Everything is saved")
              : status.error
                ? problem(status.error)
                : t("सेव हो रहा है…", "Saving…")}
          </b>
          <span className="text-ink-dim">
            {t("आख़िरी सिंक", "Last sync")}: {ago(status.lastSyncedAt, t)}
            {status.pending > 0 && ` · ${t(`${status.pending} बदलाव बाकी`, `${status.pending} change${status.pending > 1 ? "s" : ""} waiting`)}`}
          </span>
        </span>
      </div>

      <button type="button" onClick={syncNow} className={softButton}>
        <CloudIcon size={22} />
        {t("अभी सिंक करें", "Sync now")}
      </button>

      <p className="text-sm text-ink-dim">
        {t("खाता", "Account")}: <b className="text-ink">{account?.email}</b>
      </p>

      {can("manageUsers") && (
        <>
          <div className="mt-1 flex flex-col gap-2 border-t border-line pt-3">
            <p className="text-[15px] font-bold">{t("खाते का पासवर्ड बदलें", "Change the account password")}</p>
            <p className="text-sm text-ink-dim">{t("कम से कम 8 अक्षर। बाकी फ़ोन जुड़े रहेंगे।", "At least 8 characters. Other phones stay connected.")}</p>
            <div className="grid grid-cols-2 gap-2">
              <input className={inputClass} type="password" autoComplete="new-password" placeholder={t("नया", "New")} value={pw} onChange={(e) => (setPw(e.target.value), setPwState("idle"))} />
              <input className={inputClass} type="password" autoComplete="new-password" placeholder={t("फिर से", "Again")} value={pw2} onChange={(e) => (setPw2(e.target.value), setPwState("idle"))} />
            </div>
            {pw2.length > 0 && pw !== pw2 && <p className="text-[15px] font-bold text-danger-soft">{t("दोनों पासवर्ड अलग हैं", "The passwords do not match")}</p>}
            {pwState === "done" && <p className="text-[15px] font-bold text-money">{t("नया पासवर्ड सेव हुआ", "New password saved")}</p>}
            {pwState === "error" && <p className="text-[15px] font-bold text-danger-soft">{t("पासवर्ड नहीं बदला, फिर कोशिश करें", "Password not changed, try again")}</p>}
            <BigButton
              tone="money"
              className="h-14 text-lg"
              disabled={!pwReady || pwState === "busy"}
              onClick={async () => {
                setPwState("busy");
                try {
                  await changePassword(pw);
                  setPw("");
                  setPw2("");
                  setPwState("done");
                } catch {
                  setPwState("error");
                }
              }}
            >
              {t("पासवर्ड सेव करें", "Save password")}
            </BigButton>
          </div>

          <div className="flex flex-col gap-2 border-t border-line pt-3">
            {confirmOut && status.pending > 0 && (
              <p className="text-[15px] font-bold text-danger-soft">
                {t(`${status.pending} बदलाव अभी सेव नहीं हुए — लॉग आउट करने पर मिट जाएँगे`, `${status.pending} changes are not saved yet — signing out loses them`)}
              </p>
            )}
            <button
              type="button"
              onClick={() => (confirmOut ? void signOut() : setConfirmOut(true))}
              className={cn(softButton, confirmOut && "border-danger text-danger-soft")}
            >
              <LogoutIcon size={22} />
              {confirmOut ? t("पक्का? फिर से दबाएँ", "Sure? Tap again") : t("इस फ़ोन को खाते से हटाएँ", "Sign this phone out")}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
