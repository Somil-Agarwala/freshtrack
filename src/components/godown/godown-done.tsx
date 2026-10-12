"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCanSpeak } from "@/lib/device";
import { inr, num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { CheckIcon, SpeakerIcon } from "@/components/ft/icons";
import { BigLink, Screen, ScreenBody, ScreenFooter } from "@/components/ft/screen";
import { BagDirections, bagCards, speakDirections } from "@/components/count/bag-directions";

/**
 * Saved: what was recorded and -- for damage in our own godown -- which
 * numbered claim bag the pieces go into, then the quickest way to log the
 * next one.
 */
export function GodownDone() {
  const { t, lang } = useLang();
  const params = useSearchParams();
  const speakable = useCanSpeak();
  const { products, companies, countLines, sortedBags } = useStore();
  const product = products.find((p) => p.id === params.get("product"));
  const company = companies.find((c) => c.id === params.get("company"));
  const recordId = params.get("record") ?? "";
  const again = new URLSearchParams({ company: params.get("company") ?? "", ...(params.get("source") ? { source: "party" } : {}) });
  const nameOf = (id: string) => products.find((p) => p.id === id)?.name ?? "—";
  const cards = recordId ? bagCards(`godown:${recordId}`, countLines.filter((l) => l.recordId === recordId), sortedBags) : [];

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

        {cards.length > 0 && (
          <>
            <div className="mt-1 flex items-center justify-between gap-3">
              <h2 className="font-display text-[22px] font-extrabold leading-tight">{t("किस बैग में डालें", "Which bag it goes in")}</h2>
              {speakable && (
                <button
                  type="button"
                  onClick={() => speakDirections(cards, nameOf, lang)}
                  aria-label={t("निर्देश सुनें", "Listen to instructions")}
                  className="flex h-11 shrink-0 items-center gap-1.5 rounded-[14px] bg-pile-tint px-3 text-[15px] font-bold text-pile-soft"
                >
                  <SpeakerIcon size={20} />
                  {t("सुनें", "Listen")}
                </button>
              )}
            </div>
            <BagDirections cards={cards} company={company} nameOf={nameOf} />
          </>
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
