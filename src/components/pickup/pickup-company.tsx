"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { CompanyAvatar } from "@/components/ft/brand";
import { CheckIcon, InfoIcon } from "@/components/ft/icons";
import { Note, Question, Screen, ScreenBody, StepHeader } from "@/components/ft/screen";

/** Pickup step 1: whose goods are these? */
export function PickupCompany() {
  const { companies } = useStore();
  const selected = useSearchParams().get("company");
  const active = companies.filter((c) => c.isActive);

  return (
    <Screen>
      <StepHeader back="/" step={1} total={3} tone="pickup" hi="नया माल" en="New pickup" />
      <ScreenBody className="gap-0 pt-[18px]">
        <Question hi="किस कंपनी का माल है?" en="Which company's goods? Tap one." />
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {active.map((company) => {
            const on = company.id === selected;
            return (
              <Link
                key={company.id}
                href={`/pickup/party?company=${company.id}`}
                className={cn(
                  "relative flex min-h-[128px] flex-col gap-3 rounded-[20px] border-2 bg-surface p-4 transition-colors hover:border-pickup/60",
                  on ? "border-pickup" : "border-line"
                )}
              >
                <CompanyAvatar company={company} size={56} />
                <span className="font-display text-[21px] font-bold leading-[1.1]">{company.name}</span>
                {on && (
                  <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-pickup text-pickup-ink">
                    <CheckIcon size={16} />
                  </span>
                )}
              </Link>
            );
          })}
        </div>
        <Note
          className="mt-[18px]"
          tone="pickup"
          icon={<InfoIcon size={22} />}
          hi="दो कंपनी का माल एक बैग में न रखें। अलग-अलग पिकअप बनाएँ।"
          en="Never mix two companies in one bag."
        />
      </ScreenBody>
    </Screen>
  );
}
