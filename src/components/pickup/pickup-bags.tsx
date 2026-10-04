"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { dayMonth, num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { today } from "@/lib/utils";
import { CompanyAvatar } from "@/components/ft/brand";
import { CameraIcon, CheckIcon, MinusIcon, PlusIcon, SackIcon } from "@/components/ft/icons";
import { BigButton, Question, Screen, ScreenBody, ScreenFooter, StepHeader, softButton } from "@/components/ft/screen";
import { MissingStep } from "./pickup-party";
import { usePickupParams } from "./use-pickup-params";

const MAX_BAGS = 50;

/** Pickup step 3: how many bags, roughly how many pieces, a photo. */
export function PickupBags() {
  const router = useRouter();
  const { t, sub, lang } = useLang();
  const { addCollections } = useStore();
  const { company, party } = usePickupParams();
  const [bags, setBags] = useState(1);
  const [pieces, setPieces] = useState("");
  const [date, setDate] = useState(today());
  const [photo, setPhoto] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  if (!company || !party) return <MissingStep />;

  const total = Number(pieces.replace(/\D/g, "")) || 0;
  const perBag = total ? Math.round(total / bags) : undefined;
  const isToday = date === today();

  function save() {
    if (!company || !party) return;
    const created = addCollections(
      { companyId: company.id, distributorId: party.id, collectedDate: date, estimatedPieces: perBag, photoUrl: photo ?? undefined },
      bags
    );
    router.replace(`/pickup/done?ids=${created.map((c) => c.id).join(",")}`);
  }

  return (
    <Screen>
      <StepHeader back={`/pickup/party?company=${company.id}`} step={3} total={3} tone="pickup" hi="नया माल" en="New pickup" />
      <ScreenBody className="gap-4 pt-3.5">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3">
          <CompanyAvatar company={company} size={44} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[17px] font-bold leading-[1.2]">
              {company.name} · {party.name}
            </span>
            {/* Tapping the date opens the phone's date picker, for pickups
                entered a day or two late. */}
            <label className="relative block text-sm text-ink-dim">
              {isToday ? `${t("आज", "Today")}, ` : ""}
              {dayMonth(date, lang)} · {party.region} <span className="text-pickup">· {t("तारीख बदलें", "change date")}</span>
              <input
                type="date"
                value={date}
                max={today()}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                aria-label={t("पिकअप की तारीख", "Pickup date")}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </span>
        </div>

        <Question hi="कितने बैग आए?" en="How many bags did you bring back?" />

        <div className="flex items-center justify-between gap-3 rounded-[22px] border border-line bg-surface p-3.5">
          <button
            type="button"
            onClick={() => setBags((n) => Math.max(1, n - 1))}
            disabled={bags <= 1}
            aria-label={t("एक बैग कम", "One less bag")}
            className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-[20px] bg-elevated disabled:opacity-40"
          >
            <MinusIcon size={34} />
          </button>
          <div className="text-center">
            <p aria-live="polite" className="font-display text-[76px] font-extrabold leading-[0.95] text-pickup">
              {bags}
            </p>
            <p className="text-base font-semibold text-ink-dim">{lang === "hi" ? "बैग · bags" : "bags · बैग"}</p>
          </div>
          <button
            type="button"
            onClick={() => setBags((n) => Math.min(MAX_BAGS, n + 1))}
            disabled={bags >= MAX_BAGS}
            aria-label={t("एक बैग और", "One more bag")}
            className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-[20px] bg-pickup text-pickup-ink disabled:opacity-40"
          >
            <PlusIcon size={34} />
          </button>
        </div>

        <div aria-hidden="true" className="flex min-h-16 flex-wrap justify-center gap-2">
          {Array.from({ length: bags }, (_, i) => (
            <div key={i} className="flex w-[52px] flex-col items-center gap-0.5 text-pickup">
              <SackIcon size={40} strokeWidth={1.8} fill="#13202F" />
              <span className="text-[13px] font-bold text-ink-dim">{i + 1}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="roughPcs" className="text-[15px] font-bold">
            {t("अंदाज़न कितने पीस?", "Rough pieces?")} <span className="font-medium text-ink-faint">· {lang === "hi" ? "Rough pieces (optional)" : "अंदाज़न (ज़रूरी नहीं)"}</span>
          </label>
          <input
            id="roughPcs"
            inputMode="numeric"
            value={pieces}
            onChange={(e) => setPieces(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder={t("जैसे 500", "e.g. 500")}
            className="h-14 rounded-2xl border border-line bg-surface px-4 text-lg text-ink outline-none placeholder:text-ink-faint focus:border-pickup"
          />
          {bags > 1 && perBag ? (
            <p className="text-sm text-ink-dim">
              {t(`हर बैग में ~${num(perBag)} पीस`, `~${num(perBag)} pieces in each bag`)}
            </p>
          ) : null}
        </div>

        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setPhoto(URL.createObjectURL(file));
          }}
        />
        <button type="button" onClick={() => photoInput.current?.click()} className={`${softButton} h-14 border-line bg-surface text-[17px]`}>
          {photo ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
              <img src={photo} alt="" className="h-9 w-9 rounded-lg object-cover" />
              <CheckIcon size={20} className="text-money" />
              {t("फोटो लगी · बदलें", "Photo added · change")}
            </>
          ) : (
            <>
              <CameraIcon size={22} />
              {t("बैग की फोटो लें", "Add photo")} · {sub("बैग की फोटो लें", "Add photo")}
            </>
          )}
        </button>
      </ScreenBody>

      <ScreenFooter>
        <BigButton tone="pickup" onClick={save} className="text-[21px]">
          <CheckIcon />
          {t("सेव करें", "Save")} · {bags} {t("बैग", bags === 1 ? "bag" : "bags")}
        </BigButton>
      </ScreenFooter>
    </Screen>
  );
}
