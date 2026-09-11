"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { distributors } from "@/lib/mock-data";
import { useStore } from "@/lib/store";
import { today } from "@/lib/utils";

// Logging a collection is the fast path at pickup: pick the party, and
// everything else is optional. The bag number is generated, not typed,
// so two people logging bags cannot collide on numbering.
export function NewCollectionDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (bagNumber: string) => void }) {
  const { addCollection } = useStore();
  const [distributorId, setDistributorId] = useState("");
  const [collectedDate, setCollectedDate] = useState(today());
  const [estimatedPieces, setEstimatedPieces] = useState("");
  const [notes, setNotes] = useState("");

  if (!open) return null;

  function handleCreate() {
    if (!distributorId) return;
    const created = addCollection({
      distributorId,
      collectedDate,
      estimatedPieces: estimatedPieces === "" ? undefined : Number(estimatedPieces),
      notes: notes.trim() || undefined,
    });
    onCreated(created.bagNumber);
    setDistributorId("");
    setCollectedDate(today());
    setEstimatedPieces("");
    setNotes("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-xl border border-line-strong bg-surface sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Log a collection</h2>
            <p className="mt-0.5 text-sm text-ink-dim">Record the bag now, count it later.</p>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-faint hover:bg-elevated" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <Label htmlFor="party">Party</Label>
            <Select id="party" value={distributorId} onChange={(e) => setDistributorId(e.target.value)}>
              <option value="">Select a party</option>
              {distributors.filter((d) => d.isActive).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="collectedDate">Collected on</Label>
              <Input id="collectedDate" type="date" value={collectedDate} onChange={(e) => setCollectedDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="estimatedPieces">Rough piece count</Label>
              <Input
                id="estimatedPieces"
                type="number"
                min={0}
                placeholder="Optional"
                value={estimatedPieces}
                onChange={(e) => setEstimatedPieces(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="collectionNotes">Notes</Label>
            <Textarea id="collectionNotes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth noting at pickup" />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!distributorId}>Generate bag number</Button>
        </div>
      </div>
    </div>
  );
}
