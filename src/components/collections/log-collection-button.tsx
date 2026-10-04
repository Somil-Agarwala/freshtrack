"use client";

import { Plus } from "lucide-react";
import { Button, type ButtonSize } from "@/components/ui/button";
import { useLogCollection } from "./log-collection-provider";

export function LogCollectionButton({ size, className }: { size?: ButtonSize; className?: string }) {
  const { open } = useLogCollection();
  return (
    <Button size={size} onClick={open} className={className}>
      <Plus className="h-4 w-4" /> Log collection
    </Button>
  );
}
