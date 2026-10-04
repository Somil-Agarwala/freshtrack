"use client";

import { ROLE_LABELS } from "@/lib/constants";
import { useLang } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { LogoutIcon } from "@/components/ft/icons";
import { ROLE_COLOR } from "./sign-in-screen";

/** Who is signed in on this phone, with the switch-user button. */
export function AccountCard({ className }: { className?: string }) {
  const { t, sub } = useLang();
  const { user, signOut } = useSession();
  if (!user) return null;
  return (
    <div className={cn("flex items-center gap-3 rounded-[20px] border border-line bg-surface p-3.5", className)}>
      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-xl font-extrabold", ROLE_COLOR[user.role])}>{user.name.slice(0, 1)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-bold leading-tight">{user.name}</span>
        <span className="block truncate text-sm text-ink-dim">
          {t(ROLE_LABELS[user.role].hi, ROLE_LABELS[user.role].en)} · {sub(ROLE_LABELS[user.role].hi, ROLE_LABELS[user.role].en)}
        </span>
      </span>
      <button type="button" onClick={signOut} className="flex h-12 shrink-0 items-center gap-1.5 rounded-[14px] bg-elevated px-3 text-[15px] font-bold hover:bg-raised">
        <LogoutIcon size={20} />
        {t("यूज़र बदलें", "Switch user")}
      </button>
    </div>
  );
}
