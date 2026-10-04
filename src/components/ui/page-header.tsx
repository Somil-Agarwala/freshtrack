import { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-dim">{description}</p>}
      </div>
      {/* On a phone the actions take their own row and share it equally. */}
      {actions && <div className="flex flex-wrap items-center gap-2 max-sm:[&>*]:flex-1">{actions}</div>}
    </div>
  );
}
