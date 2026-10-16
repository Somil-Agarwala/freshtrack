"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { inr, num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { MrpCircle } from "@/components/ft/brand";
import { ArrowRightIcon, CheckIcon } from "@/components/ft/icons";
import { BigLink, Screen, ScreenBody, ScreenFooter } from "@/components/ft/screen";

/**
 * Saved: what was recorded and -- for damage in our own godown counted in
 * pieces -- the way to put those pieces into the claim bag of their MRP,
 * then the quickest way to log the next one.
 */
export function GodownDone() {
  const { t } = useLang();
  const params = useSearchParams();
  const { products, companies, countLines } = useStore();
  const product = products.find((p) => p.id === params.get("product"));
  const company = companies.find((c) => c.id === params.get("company"));
  const recordId = params.get("record") ?? "";
  const again = new URLSearchParams({ company: params.get("company") ?? "", ...(params.get("source") ? { source: "party" } : {}) });
  // Own-godown damage in pieces waits with the counted goods of its MRP.
  const ownLines = countLines.filter((l) => l.recordId === recordId);
  const own = ownLines.length
    ? { mrp: ownLines[0].mrp, companyId: ownLines[0].companyId, pieces: ownLines.reduce((s, l) => s + l.quantity, 0), bagId: ownLines.every((l) => l.bagId) }
    : null;

  return (
    <Screen>
      <ScreenBody className="gap-3 pt-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-godown text-godown-ink">
            <CheckIcon size={40} strokeWidth={3} />
          </span>
          <h1 className="font-display text-[28px] font-extrabold leading-[1.1]">{t("नुकसान दर्ज हो गया", "Damage recorded")}</h1>
          <p className="text-base text-ink-dim">
            {company?.name} · {product?.name}
          </p>
        </div>
        <div className="w-full rounded-[20px] border border-godown-line bg-godown-panel p-4 text-center">
          <p className="font-display text-[30px] font-extrabold text-godown">{inr(Number(params.get("value")) || 0)}</p>
          <p className="text-[15px] text-godown-mute">
            {num(Number(params.get("qty")) || 0)} {params.get("unit")} · {t("जाँच बाकी", "to review")}
          </p>
        </div>

        {own && (
          <section className="flex w-full flex-col gap-3 rounded-[20px] border border-line bg-surface p-3.5">
            <div className="flex items-center gap-3">
              <MrpCircle mrp={own.mrp} size={48} />
              <p className="min-w-0 flex-1 text-base leading-snug">
                {own.bagId
                  ? t("यह माल बैग में डाल दिया गया है", "These pieces are already in a bag")
                  : t(`${num(own.pieces)} पीस ₹${own.mrp} के बाकी माल में जुड़ गए — अब बैग में डालें`, `${num(own.pieces)} pcs joined the ₹${own.mrp} goods waiting — now put them into a bag`)}
              </p>
            </div>
            {!own.bagId && (
              <BigLink tone="pile" href={`/fill?company=${own.companyId}&mrp=${own.mrp}&from=godown:${recordId}`} className="h-14 text-lg">
                {t(`₹${own.mrp} बैग में डालें`, `Put into ₹${own.mrp} bag`)}
                <ArrowRightIcon />
              </BigLink>
            )}
          </section>
        )}
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
