"use client";

import { useState } from "react";
import { ROLE_LABELS } from "@/lib/constants";
import { daysSince } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { cn, today } from "@/lib/utils";
import type { UserAccount, UserRole } from "@/types";
import { PeopleIcon, PlusIcon } from "@/components/ft/icons";
import { ChoiceGrid, Field, Pill, Toggle, inputClass } from "@/components/ft/kit";
import { BigButton, ListHeader, Screen, ScreenBody } from "@/components/ft/screen";
import { Dialog } from "@/components/ui/dialog";

const ROLE_TONE: Record<UserRole, "money" | "factory" | "count" | "neutral"> = { admin: "money", manager: "factory", data_entry: "count", viewer: "neutral" };
const ROLES = Object.keys(ROLE_LABELS) as UserRole[];

/** Who can use FreshTrack, and what each person is allowed to do. */
export function UsersScreen() {
  const { t, sub } = useLang();
  const { users, saveUser } = useStore();
  const [editing, setEditing] = useState<UserAccount | null>(null);

  return (
    <Screen width="wide">
      <ListHeader tone="neutral" icon={<PeopleIcon size={26} />} title={t("यूज़र और रोल", "Users & roles")} subtitle={t("कौन क्या कर सकता है", "Who can do what")} />
      <ScreenBody className="gap-3">
        <button
          type="button"
          onClick={() => setEditing({ id: `u-${Date.now()}`, name: "", email: "", role: "manager", isActive: true, lastActive: today(), pin: "" })}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong text-[17px] font-bold text-ink-dim hover:text-ink"
        >
          <PlusIcon size={22} />
          {t("नया यूज़र जोड़ें", "Add a user")}
        </button>
        <div className="grid gap-2.5 lg:grid-cols-2 [&>*]:min-w-0">
          {users.map((u) => {
            const days = daysSince(u.lastActive);
            return (
              <button key={u.id} type="button" onClick={() => setEditing(u)} className={cn("flex items-center gap-3 rounded-[18px] border border-line bg-surface p-3.5 text-left transition-colors hover:bg-elevated", !u.isActive && "opacity-60")}>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-elevated font-display text-xl font-extrabold text-count">{u.name.slice(0, 1)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-bold leading-tight">{u.name}</span>
                  <span className="block truncate text-sm text-ink-dim">
                    {u.email} · {!u.isActive ? t("बंद", "inactive") : !u.lastActive ? t("अभी तक नहीं आए", "not signed in yet") : days === 0 ? t("आज आए", "active today") : t(`${days} दिन पहले`, `${days} days ago`)}
                  </span>
                </span>
                <Pill tone={ROLE_TONE[u.role]}>{t(ROLE_LABELS[u.role].hi, ROLE_LABELS[u.role].en)}</Pill>
              </button>
            );
          })}
        </div>

        <h2 className="mx-0.5 mt-2 font-display text-[21px] font-extrabold">
          {t("रोल का मतलब", "What each role can do")} <span className="font-sans text-sm font-medium text-ink-faint">· {sub("रोल का मतलब", "Roles")}</span>
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((r) => (
            <div key={r} className="rounded-2xl bg-surface p-3.5">
              <Pill tone={ROLE_TONE[r]}>{t(ROLE_LABELS[r].hi, ROLE_LABELS[r].en)}</Pill>
              <p className="mt-2 text-[15px]">{t(ROLE_LABELS[r].hiDesc, ROLE_LABELS[r].enDesc)}</p>
              <p className="text-[13px] text-ink-faint">{sub(ROLE_LABELS[r].hiDesc, ROLE_LABELS[r].enDesc)}</p>
            </div>
          ))}
        </div>
        <p className="mx-0.5 text-sm text-ink-faint">
          {t(
            "PIN इस फ़ोन/ब्राउज़र में जाँचा जाता है — यह बताता है कौन काम कर रहा है। पक्की सुरक्षा डेटाबेस वाले लॉगिन से आएगी।",
            "PINs are checked in the browser: they say who is working. Proper security comes with database sign-in."
          )}
        </p>
      </ScreenBody>
      {editing && (
        <UserSheet
          key={editing.id}
          user={editing}
          isNew={!users.some((u) => u.id === editing.id)}
          onClose={() => setEditing(null)}
          onSave={(u) => {
            saveUser(u);
            setEditing(null);
          }}
        />
      )}
    </Screen>
  );
}

function UserSheet({ user, isNew, onClose, onSave }: { user: UserAccount; isNew: boolean; onClose: () => void; onSave: (u: UserAccount) => void }) {
  const { t, sub } = useLang();
  const { users } = useStore();
  const [draft, setDraft] = useState(user);
  // The last active admin can never lock everyone out of admin screens.
  const lastAdmin = user.role === "admin" && users.filter((u) => u.role === "admin" && u.isActive).length === 1;
  const valid = draft.name.trim() && /\S+@\S+\.\S+/.test(draft.email) && /^\d{4}$/.test(draft.pin) && (!lastAdmin || (draft.role === "admin" && draft.isActive));
  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? t("नया यूज़र", "New user") : user.name}
      footer={
        <BigButton tone="money" disabled={!valid} onClick={() => onSave({ ...draft, name: draft.name.trim(), email: draft.email.trim().toLowerCase() })}>
          {t("सेव करें", "Save")}
        </BigButton>
      }
    >
      <div className="flex flex-col gap-4">
        <Field hi="नाम" en="Name">
          <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus={isNew} />
        </Field>
        <Field hi="ईमेल" en="Email">
          <input className={inputClass} type="email" inputMode="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
        </Field>
        <Field hi="रोल" en="Role">
          <ChoiceGrid
            tone="money"
            value={draft.role}
            onChange={(role) => setDraft({ ...draft, role })}
            options={ROLES.map((r) => ({ value: r, label: t(ROLE_LABELS[r].hi, ROLE_LABELS[r].en), detail: sub(ROLE_LABELS[r].hi, ROLE_LABELS[r].en) }))}
          />
        </Field>
        <Field hi="4 अंक का PIN" en="4-digit PIN" hint={t("यूज़र इसे सेटिंग में खुद बदल सकता है", "The user can change it in Settings")}>
          <input className={inputClass} inputMode="numeric" value={draft.pin} onChange={(e) => setDraft({ ...draft, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="1234" />
        </Field>
        <Toggle on={draft.isActive} onChange={(isActive) => setDraft({ ...draft, isActive })} label={t("चालू है", "Active")} detail={t("बंद यूज़र लॉगिन नहीं कर पाएगा", "Inactive users cannot sign in")} />
        {lastAdmin && (draft.role !== "admin" || !draft.isActive) && (
          <p className="text-[15px] font-bold text-danger-soft">{t("कम से कम एक एडमिन चालू रहना चाहिए", "At least one admin must stay active")}</p>
        )}
      </div>
    </Dialog>
  );
}
