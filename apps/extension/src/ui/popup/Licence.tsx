import { Collapsible } from '@base-ui/react/collapsible';
import { useState } from 'react';
import type { Entitlement, StoppedEntitlement } from '../../licence/entitlement';
import { polar, type Validation } from '../../licence/polar';
import { formatYearlyPrice } from '../../licence/price';
import { send } from '../../messages';
import { Button, ButtonLink } from '../components/Button';

const PRICE = formatYearlyPrice(
  Intl.DateTimeFormat().resolvedOptions().timeZone,
  navigator.language,
);

/** Where grouping stands with the licence, in the panel's footer. */
export const Licence = ({ entitlement }: { entitlement: Entitlement }) => {
  switch (entitlement.status) {
    case 'trial':
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">
              Free trial ·{' '}
              {entitlement.daysLeft === 1 ? '1 day left' : `${entitlement.daysLeft} days left`}
            </span>
            <a
              className="font-medium text-primary underline-offset-2 hover:underline"
              href={polar.checkoutUrl}
              target="_blank"
              rel="noreferrer"
            >
              Subscribe · {PRICE}/year
            </a>
          </div>
          <LicenceKeyForm />
        </div>
      );
    case 'licensed':
      return (
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            Licensed
          </span>
          <a
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            href={polar.portalUrl}
            target="_blank"
            rel="noreferrer"
          >
            Manage subscription
          </a>
        </div>
      );
    case 'trial-ended':
    case 'ended':
    case 'unreachable':
      return <LicenceKeyForm />;
  }
};

const PAYWALL_COPY: Record<StoppedEntitlement['status'], { title: string; body: string }> = {
  'trial-ended': {
    title: 'Your free trial has ended',
    body: `TabShoal has stopped grouping your tabs. Keep it going for ${PRICE} a year.`,
  },
  ended: {
    title: 'Your licence has ended',
    body: `TabShoal has stopped grouping your tabs. Subscribe again for ${PRICE} a year.`,
  },
  unreachable: {
    title: 'TabShoal can’t check your licence',
    body: 'It hasn’t reached the licence server for 14 days, so grouping is paused. It picks up again by itself once it does.',
  },
};

/** What the panel shows instead of its controls once grouping has stopped. */
export const Paywall = ({ entitlement }: { entitlement: StoppedEntitlement }) => {
  const { title, body } = PAYWALL_COPY[entitlement.status];
  return (
    <section className="mx-4 mb-4 flex flex-col gap-3 rounded-lg bg-amber-soft p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-amber-foreground">{body}</p>
      </div>
      {entitlement.status !== 'unreachable' && (
        <ButtonLink variant="primary" href={polar.checkoutUrl} className="w-full">
          Subscribe · {PRICE}/year
        </ButtonLink>
      )}
    </section>
  );
};

const ACTIVATION_ERRORS: Record<Exclude<Validation['type'], 'granted'>, string> = {
  rejected: 'That key isn’t valid, or its subscription has ended.',
  'rate-limited': 'Too many tries. Wait a minute, then try again.',
  unreachable: 'Couldn’t reach the licence server. Check your connection and try again.',
};

const LicenceKeyForm = () => {
  const [key, setKey] = useState('');
  const [state, setState] = useState<'idle' | 'checking' | Validation['type']>('idle');
  return (
    <Collapsible.Root>
      <Collapsible.Trigger className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline data-panel-open:hidden">
        I have a licence key
      </Collapsible.Trigger>
      <Collapsible.Panel>
        <form
          className="flex flex-col gap-2"
          onSubmit={async event => {
            event.preventDefault();
            setState('checking');
            setState(await send({ type: 'activate-licence', key }));
          }}
        >
          <label htmlFor="licence-key" className="font-medium">
            Licence key
          </label>
          <div className="flex gap-2">
            <input
              id="licence-key"
              value={key}
              onChange={event => setKey(event.target.value)}
              placeholder="TABSHOAL-…"
              autoComplete="off"
              spellCheck={false}
              className="h-8 min-w-0 flex-1 rounded-md border border-input bg-card px-2 font-mono text-xs"
            />
            <Button type="submit" disabled={key.trim() === '' || state === 'checking'}>
              {state === 'checking' ? 'Checking…' : 'Activate'}
            </Button>
          </div>
          {state !== 'idle' && state !== 'checking' && state !== 'granted' && (
            <p role="alert" className="text-destructive">
              {ACTIVATION_ERRORS[state]}
            </p>
          )}
        </form>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
};
