"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { inr, num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { CheckIcon } from "@/components/ft/icons";
import { BigLink, Screen, ScreenBody, ScreenFooter } from "@/components/ft/screen";

/** Saved: what was recorded, and the quickest way to log the next one. */
export function GodownDone() {
  const { t } = useLang();
  const params = useSearchParams();
  const { products, companies } = useStore();
  const product = products.find((p) => p.id === params.get("product"));
  const company = companies.find((c) => c.id === params.get("company"));
  const again = new URLSearchParams({ company: params.get("company") ?? "", ...(params.get("source") ? { source: "party" } : {}) });

  return (
    <Screen>
      <ScreenBody className="items-center gap-3 pt-10 text-center">
        <span className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-godown text-godown-ink">
          <CheckIcon size={44} strokeWidth={3} />
        </span>
        <h1 className="font-display text-[30px] font-extrabold leading-[1.1]">{t("नुकसान दर्ज हो गया", "Damage recorded")}</h1>
        <p className="text-base text-ink-dim">
          {company?.name} · {product?.name}
        </p>
        <div className="mt-2 w-full rounded-[20px] border border-godown-line bg-godown-panel p-4">
          <p className="font-display text-[34px] font-extrabold text-godown">{inr(Number(params.get("value")) || 0)}</p>
          <p className="text-[15px] text-godown-mute">
            {num(Number(params.get("qty")) || 0)} {params.get("unit")} · {t("जाँच बाकी", "to review")}
          </p>
        </div>
      </ScreenBody>
      <ScreenFooter className="gap-2.5">
        <BigLink tone="godown" href={`/godown/new?${again}`}>
          + {t("एक और एंट्री", "Log another")}
        </BigLink>
        <div className="grid grid-cols-2 gap-2.5">
          <Link href="/godown" className="flex h-[52px] items-center justify-center rounded-2xl bg-elevated text-base font-bold hover:bg-raised">
            {t("सारी एंट्री", "All entries")}
          </Link>
          <Link href="/" className="flex h-[52px] items-center justify-center rounded-2xl bg-elevated text-base font-bold hover:bg-raised">
            {t("घर जाएँ", "Home")}
          </Link>
        </div>
      </ScreenFooter>
    </Screen>
  );
}
