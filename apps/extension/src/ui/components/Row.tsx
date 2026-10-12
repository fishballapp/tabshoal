import type { ReactNode } from 'react';

/** A settings row: what it is and what it does on the left, its control on the right. */
export const Row = ({
  label,
  description,
  control,
  htmlFor,
}: {
  label: ReactNode;
  description?: ReactNode;
  control: ReactNode;
  htmlFor?: string;
}) => (
  <div className="flex items-center justify-between gap-6 px-4 py-3">
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="block font-medium text-foreground">
        {label}
      </label>
      {description !== undefined && <p className="mt-0.5 text-muted-foreground">{description}</p>}
    </div>
    {control}
  </div>
);
