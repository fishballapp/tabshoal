import { Button as BaseButton } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import type { ComponentProps } from 'react';

const buttonVariants = cva(
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors select-none data-disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        secondary: 'border border-border bg-card text-foreground hover:bg-muted',
        link: 'h-auto px-0 text-primary underline-offset-2 hover:underline',
      },
    },
    defaultVariants: { variant: 'secondary' },
  },
);

export const Button = ({
  variant,
  className,
  ...props
}: ComponentProps<typeof BaseButton> & VariantProps<typeof buttonVariants>) => (
  <BaseButton className={cn(buttonVariants({ variant }), className)} {...props} />
);

/** A link styled as a button, for the checkout and the customer portal. */
export const ButtonLink = ({
  variant,
  className,
  ...props
}: ComponentProps<'a'> & VariantProps<typeof buttonVariants>) => (
  <a
    target="_blank"
    rel="noreferrer"
    className={cn(buttonVariants({ variant }), className)}
    {...props}
  />
);
