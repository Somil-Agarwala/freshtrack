"use client";

import { useEffect, useState } from "react";
import { useFlash, useVoiceInput } from "@/lib/device";
import { useLang } from "@/lib/i18n";
import { findPlace, pileCode, wherePresets } from "@/lib/places";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Company } from "@/types";
import { companyColor, MrpCircle } from "@/components/ft/brand";
import { MicIcon, PinIcon, PrinterIcon } from "@/components/ft/icons";
import { inputClass } from "@/components/ft/kit";
import { PrintSheet } from "@/components/ft/print-sheet";
import { BigButton, softButton } from "@/components/ft/screen";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";

/**
 * Pile places: every pile in the godown carries a placard with its code
 * (HLD-10 = Haldiram ₹10), and the app tells staff which placard to look
 * for and where in the godown it stands.
 */

const TAG_SIZE = {
  sm: "px-2 py-1 text-[13px] rounded-md",
  md: "px-2.5 py-1.5 text-[17px] rounded-lg",
  lg: "px-3 py-1.5 text-[26px] rounded-xl",
};

/** The placard code as it looks on the placard: company colour, "HLD-10". */
export function PileTag({ company, mrp, size = "md", className }: { company?: Company; mrp: number; size?: keyof typeof TAG_SIZE; className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center font-mono font-semibold leading-none tracking-[0.5px] text-white", TAG_SIZE[size], className)}
      style={{ background: companyColor(company?.code ?? "") }}
    >
      {pileCode(company, mrp)}
    </span>
  );
}

/** Where a pile lies, or a nudge to write it down. */
export function PlaceLine({ where, onEdit, className }: { where?: string; onEdit?: () => void; className?: string }) {
  const { t } = useLang();
  if (where) {
    return (
      <p className={cn("flex items-start gap-1.5 text-[15px] font-semibold leading-snug text-ink-soft", className)}>
        <PinIcon size={18} className="mt-0.5 shrink-0 text-pile-soft" />
        <span className="min-w-0 flex-1">{where}</span>
        {onEdit && (
          <button type="button" onClick={onEdit} className="shrink-0 text-sm font-bold text-pile-soft">
            {t("बदलें", "Change")}
          </button>
        )}
      </p>
    );
  }
  if (onEdit) {
    return (
      <button type="button" onClick={onEdit} className={cn("flex items-center gap-1.5 text-left text-[15px] font-bold text-count-soft", className)}>
        <PinIcon size={18} className="shrink-0" />
        {t("गोदाम में जगह नहीं लिखी — अभी लिखें", "Spot in the godown not written — add it")}
      </button>
    );
  }
  return (
    <p className={cn("flex items-center gap-1.5 text-[15px] text-ink-dim", className)}>
      <PinIcon size={18} className="shrink-0" />
      {t("जगह नहीं लिखी — पर्ची वाला ढेर ढूँढें", "Spot not written — look for the placard")}
    </p>
  );
}

/** Write down where a pile lies. Used inline and inside PlaceDialog. */
export function PlaceEditor({ companyId, mrp, onDone, onPrint }: { companyId: string; mrp: number; onDone: () => void; onPrint?: () => void }) {
  const { t, lang } = useLang();
  const { companies, pilePlaces, savePilePlace } = useStore();
  const company = companies.find((c) => c.id === companyId);
  const [text, setText] = useState(findPlace(pilePlaces, companyId, mrp)?.where ?? "");
  const [message, flash] = useFlash();
  const voice = useVoiceInput(setText, lang);
  const presets = wherePresets(pilePlaces, companyId).filter((p) => p !== text.trim());
  const code = pileCode(company, mrp);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-2xl bg-elevated p-3">
        <MrpCircle mrp={mrp} size={48} />
        <span className="min-w-0 flex-1 text-[15px] leading-snug text-ink-soft">
          {t(`इस ढेर पर ${code} की पर्ची लगी होनी चाहिए।`, `This pile should carry the ${code} placard.`)}
        </span>
        <PileTag company={company} mrp={mrp} />
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-[15px] font-bold">{t("गोदाम में कहाँ है?", "Where in the godown?")}</span>
        <span className="flex gap-2">
          <input
            className={inputClass}
            value={text}
            maxLength={60}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("जैसे: पीछे वाली दीवार, रैक 2", "e.g. back wall, rack 2")}
          />
          <button
            type="button"
            aria-label={t("बोलकर लिखें", "Speak it")}
            onClick={() => voice.start() || flash(t("इस फ़ोन पर बोलकर लिखना नहीं चलता", "Voice typing is not available on this phone"))}
            className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-elevated text-pile", voice.listening && "animate-pulse")}
          >
            <MicIcon size={24} />
          </button>
        </span>
      </label>

      {presets.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-ink-dim">{t("पहले लिखी जगहें · एक टैप में चुनें", "Spots used before · tap to pick")}</span>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button key={p} type="button" onClick={() => setText(p)} className="min-h-11 rounded-full border border-line bg-surface px-3.5 text-[15px] font-semibold hover:bg-elevated">
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <BigButton
        tone="pile"
        onClick={() => {
          savePilePlace(companyId, mrp, text);
          onDone();
        }}
      >
        <PinIcon />
        {t("जगह सेव करें", "Save the spot")}
      </BigButton>
      {onPrint && (
        <button type="button" onClick={onPrint} className={softButton}>
          <PrinterIcon size={22} />
          {t(`${code} की पर्ची छापें`, `Print the ${code} placard`)}
        </button>
      )}
      <Notice message={message} />
    </div>
  );
}

export function PlaceDialog({ companyId, mrp, onClose, onPrint }: { companyId: string; mrp: number; onClose: () => void; onPrint?: () => void }) {
  const { t } = useLang();
  const { companies } = useStore();
  const company = companies.find((c) => c.id === companyId);
  return (
    <Dialog open onClose={onClose} title={t(`${pileCode(company, mrp)} ढेर की जगह`, `Where pile ${pileCode(company, mrp)} lies`)} description={t(`${company?.name} · ₹${mrp} का माल`, `${company?.name} · ₹${mrp} goods`)}>
      <PlaceEditor companyId={companyId} mrp={mrp} onDone={onClose} onPrint={onPrint} />
    </Dialog>
  );
}

/** A placard to put up at a pile: the code huge, readable across the godown. */
function Placard({ company, mrp, where }: { company?: Company; mrp: number; where?: string }) {
  return (
    // One placard per page, big enough to read from across the godown.
    <div className="flex min-h-[95vh] break-inside-avoid flex-col items-center justify-center gap-6 rounded-3xl border-[6px] border-[#111418] p-8 text-center [break-after:page] [print-color-adjust:exact] last:[break-after:auto] [-webkit-print-color-adjust:exact]">
      <p className="text-3xl font-bold">{company?.name} · ढेर / Pile</p>
      <p className="font-mono text-[160px] font-bold leading-none tracking-tight">{pileCode(company, mrp)}</p>
      <div className="flex items-center justify-center gap-5">
        <MrpCircle mrp={mrp} size={150} />
        <p className="text-left text-4xl font-bold leading-tight">
          सिर्फ़ ₹{mrp} MRP का माल
          <br />
          <span className="text-2xl font-semibold">Only ₹{mrp} MRP goods</span>
        </p>
      </div>
      {where && <p className="text-3xl">{where}</p>}
    </div>
  );
}

/**
 * Prints placards. `print([...])` lays them out on the paper-only sheet and
 * opens the print dialog (which also offers "Save as PDF").
 */
export function usePlacards() {
  const { companies, pilePlaces } = useStore();
  const [list, setList] = useState<{ companyId: string; mrp: number }[]>([]);

  useEffect(() => {
    if (list.length === 0) return;
    // Wait one frame so the sheet is on the page before the dialog opens.
    const id = window.setTimeout(() => window.print(), 80);
    return () => window.clearTimeout(id);
  }, [list]);

  useEffect(() => {
    // Clear afterwards, so the next print on this screen is not padded with placards.
    const clear = () => setList([]);
    window.addEventListener("afterprint", clear);
    return () => window.removeEventListener("afterprint", clear);
  }, []);

  const sheet =
    list.length > 0 ? (
      <PrintSheet>
        {list.map(({ companyId, mrp }) => (
          <Placard key={`${companyId}-${mrp}`} company={companies.find((c) => c.id === companyId)} mrp={mrp} where={findPlace(pilePlaces, companyId, mrp)?.where} />
        ))}
      </PrintSheet>
    ) : null;

  return { print: (items: { companyId: string; mrp: number }[]) => setList([...items]), sheet };
}
