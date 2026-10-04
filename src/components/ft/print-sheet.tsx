"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Content that exists only on paper; see .print-sheet in globals.css. */
export function PrintSheet({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(<div className="print-sheet bg-white p-4 font-sans text-[#111418]">{children}</div>, document.body);
}

/** A cut-out label for one bag: number large, the rest small. */
export function PrintLabel({ number, lines }: { number: string; lines: string[] }) {
  return (
    <div className="mb-3 break-inside-avoid rounded-xl border-2 border-dashed border-[#111418] p-4">
      <p className="text-center font-mono text-[26px] font-semibold tracking-[0.5px]">{number}</p>
      {lines.map((line) => (
        <p key={line} className="text-center text-sm">
          {line}
        </p>
      ))}
    </div>
  );
}
