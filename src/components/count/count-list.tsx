"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { daysSince, num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { STALE_COUNT_DAYS, uncountedOldestFirst } from "@/lib/pipeline";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { CompanyAvatar } from "@/components/ft/brand";
import { ArrowRightIcon, CheckIcon, ClipboardIcon } from "@/components/ft/icons";
import { AgePill, CompanyTabs, ListHeader, Screen, ScreenBody } from "@/components/ft/screen";

/** Every sealed bag still to be counted, oldest on top. */
export function CountList() {
  const { t, lang } = useLang();
  const { collections, companies, distributors } = useStore();
  const [companyId, setCompanyId] = useState("all");

  const all = useMemo(() => uncountedOldestFirst(collections), [collections]);
  const shown = companyId === "all" ? all : all.filter((c) => c.companyId === companyId);
  const perCompany = companies
    .map((c) => ({ company: c, count: all.filter((b) => b.companyId === c.id).length }))
    .filter((row) => row.count > 0);

  return (
    <Screen width="wide">
      <ListHeader
        tone="count"
        icon={<ClipboardIcon size={26} />}
        title={lang === "hi" ? `गिनती बाकी · ${all.length} बैग` : `To count · ${all.length} bags`}
        subtitle={lang === "hi" ? "Bags to count · पुराने बैग सबसे ऊपर" : "Oldest bags on top · पुराने बैग सबसे ऊपर"}
      >
        {all.length > 0 && (
          <CompanyTabs
            companies={perCompany.map((r) => r.company)}
            value={companyId}
            onChange={setCompanyId}
            tone="count"
            all={`${t("सब", "All")} ${all.length}`}
            counts={Object.fromEntries(perCompany.map((r) => [r.company.id, r.count]))}
          />
        )}
      </ListHeader>

      <ScreenBody className="gap-2.5">
        {shown.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-[20px] border border-line bg-surface px-4 py-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-money text-money-ink">
              <CheckIcon size={34} />
            </span>
            <p className="font-display text-2xl font-extrabold">{t("सब गिन लिया!", "Everything is counted!")}</p>
            <p className="text-ink-dim">{t("नया माल आने पर यहाँ दिखेगा", "New pickups will show up here")}</p>
          </div>
        )}
        <div className="grid gap-2.5 lg:grid-cols-2">
          {shown.map((bag, index) => {
            const days = daysSince(bag.collectedDate);
            const company = companies.find((c) => c.id === bag.companyId);
            const party = distributors.find((d) => d.id === bag.distributorId);
            const first = index === 0;
            return (
              <Link
                key={bag.id}
                href={`/count/${bag.id}`}
                className={cn(
                  "flex flex-col gap-2.5 rounded-[18px] border bg-surface p-3.5 transition-colors hover:bg-elevated",
                  days >= STALE_COUNT_DAYS ? "border-danger-line" : "border-line",
                  first && "lg:col-span-2"
                )}
              >
                <span className="flex items-center gap-3">
                  <CompanyAvatar company={company} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[17px] font-semibold">{bag.bagNumber}</span>
                    <span className="block truncate text-[15px] text-ink-dim">
                      {shortParty(party?.name ?? "")} ·{" "}
                      {bag.estimatedPieces ? `~${num(bag.estimatedPieces)} ${t("पीस", "pcs")}` : t("अंदाज़ा नहीं", "no estimate")}
                    </span>
                  </span>
                  <AgePill days={days} clock alarmAt={STALE_COUNT_DAYS} />
                </span>
                {first && (
                  <span className="flex h-12 items-center justify-center gap-2 rounded-[14px] bg-count font-display text-lg font-extrabold text-count-ink">
                    {t("गिनती शुरू करें · Start counting", "Start counting · गिनती शुरू करें")}
                    <ArrowRightIcon size={22} />
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </ScreenBody>
    </Screen>
  );
}

/** "Shiv Shakti Enterprises" -> "Shiv Shakti Ent." to keep one line. */
function shortParty(name: string) {
  return name
    .replace(/\bEnterprises\b/, "Ent.")
    .replace(/\bDistributors\b/, "Dist.")
    .replace(/\s+(Co\.|Corp)$/, "");
}
