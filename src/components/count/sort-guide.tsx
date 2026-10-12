"use client";

import Link from "next/link";
import { useCanSpeak } from "@/lib/device";
import { num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { ArrowRightIcon, SpeakerIcon } from "@/components/ft/icons";
import { EmptyCard } from "@/components/ft/kit";
import { BigLink, Screen, ScreenBody, ScreenFooter, TaskHeader } from "@/components/ft/screen";
import { BagDirections, bagCards, speakDirections } from "./bag-directions";

/**
 * Straight after counting: the numbered bags this pickup's goods go into.
 * Pieces were put into bags the moment the count was saved -- the open bag
 * of each MRP topped up, a new numbered bag opened when one filled -- so
 * this screen only has to say, bag by bag: this number, these items, this
 * many pieces. Staff write new numbers on fresh bags, fill them, tick each.
 */
export function SortGuide({ collectionId }: { collectionId: string }) {
  const { t, lang } = useLang();
  const { collections, companies, distributors, countLines, products, sortedBags } = useStore();
  const speakable = useCanSpeak();
  const pickup = collections.find((c) => c.id === collectionId);
  const company = companies.find((c) => c.id === pickup?.companyId);

  if (!pickup || !company) {
    return (
      <Screen>
        <ScreenBody className="items-center justify-center">
          <Link href="/count" className="font-bold text-count">
            {t("गिनती की सूची देखें", "Back to the count list")}
          </Link>
        </ScreenBody>
      </Screen>
    );
  }

  const party = distributors.find((d) => d.id === pickup.distributorId);
  const mine = countLines.filter((l) => l.collectionId === pickup.id);
  const counted = mine.reduce((s, l) => s + l.quantity, 0);
  const nameOf = (productId: string) => products.find((p) => p.id === productId)?.name ?? "—";
  const cards = bagCards(pickup.id, mine, sortedBags);
  const shortNumber = pickup.bagNumber.replace(/-\d{4}-/, "-");

  return (
    <Screen>
      <TaskHeader
        back={`/collections/${pickup.id}`}
        tone="pile"
        kicker={`✓ ${num(counted)} ${pickup.direct ? t("पीस डाले", "pieces entered") : t("पीस गिने", "pieces counted")} · ${shortNumber}${party ? ` · ${party.name}` : ""}`}
        aside={
          speakable && cards.length > 0 ? (
            <button
              type="button"
              onClick={() => speakDirections(cards, nameOf, lang)}
              aria-label={t("निर्देश सुनें", "Listen to instructions")}
              className="flex h-12 shrink-0 items-center gap-1.5 rounded-[14px] bg-pile-tint px-3 text-[15px] font-bold text-pile-soft"
            >
              <SpeakerIcon size={22} />
              {t("सुनें", "Listen")}
            </button>
          ) : undefined
        }
      >
        <h1 className="font-display text-2xl font-extrabold leading-[1.15]">{t("किस बैग में क्या डालें", "What goes in which bag")}</h1>
      </TaskHeader>

      <ScreenBody className="gap-3 pt-1">
        {cards.length === 0 && <EmptyCard title={t("इस बैग में कुछ नहीं गिना गया", "Nothing was counted in this bag")} />}
        <BagDirections cards={cards} company={company} nameOf={nameOf} />
      </ScreenBody>

      <ScreenFooter>
        {pickup.direct ? (
          <BigLink tone="count" href={`/direct?company=${company.id}`}>
            {t("अगली पार्टी का माल डालें", "Next party's goods")}
            <ArrowRightIcon />
          </BigLink>
        ) : (
          <BigLink tone="count" href="/count">
            {t("अगला बैग गिनें", "Count the next bag")}
            <ArrowRightIcon />
          </BigLink>
        )}
        <Link href={`/piles?company=${company.id}`} className="flex h-11 items-center justify-center text-base font-bold text-ink-dim">
          {t("सारे खुले बैग देखें", "See all open bags")}
        </Link>
      </ScreenFooter>
    </Screen>
  );
}
