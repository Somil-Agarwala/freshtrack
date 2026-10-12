"use client";

import { useState } from "react";
import { ROLE_LABELS } from "@/lib/constants";
import { daysSince } from "@/lib/format";
import { useFlash } from "@/lib/device";
import { useLang } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useStore, useSync } from "@/lib/store";
import { SyncError } from "@/lib/sync/engine";
import { cn } from "@/lib/utils";
import type { UserAccount, UserRole } from "@/types";
import { PeopleIcon, PlusIcon } from "@/components/ft/icons";
import { ChoiceGrid, Field, Pill, Toggle, inputClass } from "@/components/ft/kit";
import { BigButton, ListHeader, Screen, ScreenBody } from "@/components/ft/screen";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";

const ROLE_TONE: Record<UserRole, "money" | "factory" | "count" | "neutral"> = { admin: "money", manager: "factory", data_entry: "count", viewer: "neutral" };
const ROLES = Object.keys(ROLE_LABELS) as UserRole[];

/** Who can use FreshTrack, and what each person is allowed to do. */
export function UsersScreen() {
  const { t, sub } = useLang();
  const { users } = useStore();
  const [editing, setEditing] = useState<UserAccount | null>(null);
  const [message, flash] = useFlash();

  return (
    <Screen width="wide">
      <ListHeader tone="neutral" icon={<PeopleIcon size={26} />} title={t("यूज़र और रोल", "Users & roles")} subtitle={t("कौन क्या कर सकता है", "Who can do what")} />
      <ScreenBody className="gap-3">
        <button
          type="button"
          onClick={() => setEditing({ id: `u-${Date.now().toString(36)}`, name: "", email: "", role: "manager", isActive: true, lastActive: "" })}
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
            "हर व्यक्ति अपने ईमेल और पासवर्ड से लॉग इन करता है। पासवर्ड भूल जाए तो उसका नाम दबाकर नया पासवर्ड दें।",
            "Everyone signs in with their own email and password. If someone forgets it, tap their name and give a new one."
          )}
        </p>
      </ScreenBody>
      {editing && (
        <UserSheet
          key={editing.id}
          user={editing}
          isNew={!users.some((u) => u.id === editing.id)}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            flash(text);
          }}
        />
      )}
      <Notice message={message} />
    </Screen>
  );
}

function UserSheet({ user, isNew, onClose, onSaved }: { user: UserAccount; isNew: boolean; onClose: () => void; onSaved: (message: string) => void }) {
  const { t, sub } = useLang();
  const { users, saveUser } = useStore();
  const { user: me } = useSession();
  const { mode, setLogin, removeLogin } = useSync();
  const cloud = mode === "cloud";
  const [draft, setDraft] = useState(user);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = draft.email.trim().toLowerCase();
  const emailChanged = !isNew && email !== user.email.trim().toLowerCase();
  // A new person, or a new email, needs a password to sign in with.
  const needsPassword = cloud && (isNew || emailChanged);
  const taken = users.some((u) => u.id !== user.id && u.email.trim().toLowerCase() === email);
  // The last active admin can never lock everyone out of admin screens.
  const lastAdmin = user.role === "admin" && users.filter((u) => u.role === "admin" && u.isActive).length === 1;
  const isMe = me?.id === user.id;
  const demotingMe = isMe && (!draft.isActive || (user.role === "admin" && draft.role !== "admin"));
  const passwordOk = password === "" ? !needsPassword : password.length >= 8;
  const valid =
    draft.name.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && !taken && passwordOk && !demotingMe && (!lastAdmin || (draft.role === "admin" && draft.isActive));

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (cloud) {
        // The login is changed first: if that fails, nothing is saved.
        if (draft.isActive) await setLogin(email, password || null, draft.role === "admin");
        else await removeLogin(email);
        if (emailChanged) await removeLogin(user.email);
      }
      saveUser({ ...draft, name: draft.name.trim(), email });
      onSaved(
        !draft.isActive
          ? t(`${draft.name.trim()} का लॉगिन बंद किया`, `${draft.name.trim()} can no longer sign in`)
          : password
            ? t(`${draft.name.trim()} का पासवर्ड सेव हुआ`, `Password saved for ${draft.name.trim()}`)
            : t("सेव हुआ", "Saved")
      );
    } catch (err) {
      const text = err instanceof SyncError ? `${err.kind} ${err.message}` : "";
      setError(
        text.startsWith("network")
          ? t("इंटरनेट नहीं है — इंटरनेट आने पर फिर सेव करें", "No internet — save again when you are online")
          : text.startsWith("forbidden")
            ? t("सिर्फ़ एडमिन लॉगिन बदल सकता है", "Only the admin can change logins")
            : /password/i.test(text)
              ? t("पासवर्ड कम से कम 8 अक्षर का हो", "The password needs at least 8 characters")
              : /email/i.test(text)
                ? t("ईमेल सही नहीं है", "That email is not valid")
                : t("सेव नहीं हुआ, फिर कोशिश करें", "Not saved, try again")
      );
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? t("नया यूज़र", "New user") : user.name}
      footer={
        <BigButton tone="money" disabled={!valid || busy} onClick={save}>
          {busy ? t("सेव हो रहा है…", "Saving…") : t("सेव करें", "Save")}
        </BigButton>
      }
    >
      <div className="flex flex-col gap-4">
        <Field hi="नाम" en="Name">
          <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus={isNew} />
        </Field>
        <Field hi="ईमेल (लॉगिन)" en="Email (login)">
          <input
            className={inputClass}
            type="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          />
        </Field>
        {taken && <p className="-mt-2 text-[15px] font-bold text-danger-soft">{t("यह ईमेल किसी और यूज़र का है", "Another user already has this email")}</p>}
        {cloud && (
          <Field
            hi={needsPassword ? "पासवर्ड" : "नया पासवर्ड"}
            en={needsPassword ? "Password" : "New password"}
            optional={!needsPassword}
            hint={
              needsPassword
                ? t("कम से कम 8 अक्षर। यही पासवर्ड उस व्यक्ति को बताएँ।", "At least 8 characters. Tell this password to the person.")
                : t("खाली छोड़ें तो पुराना पासवर्ड ही चलेगा", "Leave empty to keep the current password")
            }
          >
            <input className={inputClass} type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        )}
        <Field hi="रोल" en="Role">
          <ChoiceGrid
            tone="money"
            value={draft.role}
            onChange={(role) => setDraft({ ...draft, role })}
            options={ROLES.map((r) => ({ value: r, label: t(ROLE_LABELS[r].hi, ROLE_LABELS[r].en), detail: sub(ROLE_LABELS[r].hi, ROLE_LABELS[r].en) }))}
          />
        </Field>
        <Toggle on={draft.isActive} onChange={(isActive) => setDraft({ ...draft, isActive })} label={t("चालू है", "Active")} detail={t("बंद यूज़र लॉगिन नहीं कर पाएगा", "Inactive users cannot sign in")} />
        {lastAdmin && (draft.role !== "admin" || !draft.isActive) && (
          <p className="text-[15px] font-bold text-danger-soft">{t("कम से कम एक एडमिन चालू रहना चाहिए", "At least one admin must stay active")}</p>
        )}
        {demotingMe && !lastAdmin && <p className="text-[15px] font-bold text-danger-soft">{t("आप खुद को बंद या एडमिन से हटा नहीं सकते", "You cannot switch off or demote yourself")}</p>}
        {error && <p className="text-[15px] font-bold text-danger-soft">{error}</p>}
      </div>
    </Dialog>
  );
}
