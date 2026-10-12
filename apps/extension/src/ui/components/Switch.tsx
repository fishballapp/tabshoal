import { Switch as BaseSwitch } from '@base-ui/react/switch';
import type { ComponentProps } from 'react';

export const Switch = (props: ComponentProps<typeof BaseSwitch.Root>) => (
  <BaseSwitch.Root
    className="relative flex h-5 w-9 shrink-0 rounded-full bg-input p-0.5 transition-colors duration-150 data-checked:bg-primary"
    {...props}
  >
    <BaseSwitch.Thumb className="size-4 rounded-full bg-card shadow-sm transition-transform duration-150 data-checked:translate-x-4" />
  </BaseSwitch.Root>
);
