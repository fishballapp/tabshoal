import { NumberField } from '@base-ui/react/number-field';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { useState } from 'react';
import { type TitleStyle, visibleTitleFor } from '../../grouping/site';
import {
  loadSettings,
  MINIMUM_TABS_RANGE,
  normaliseSiteEntry,
  type Settings,
  saveSettings,
} from '../../settings';
import { Button } from '../components/Button';
import { Mark } from '../components/Mark';
import { Row } from '../components/Row';
import { Switch } from '../components/Switch';
import { useStored } from '../hooks';

export const Options = () => {
  const settings = useStored('sync', ['settings'], loadSettings);
  if (settings === undefined) return null;
  const update = (patch: Partial<Settings>) => void saveSettings({ ...settings, ...patch });

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center gap-3">
        <Mark size={32} />
        <div>
          <h1 className="text-lg font-semibold tracking-tight">TabShoal</h1>
          <p className="text-muted-foreground">Changes apply to your tabs straight away.</p>
        </div>
      </header>

      <section className="divide-y divide-border rounded-lg border border-border bg-card">
        <Row
          label="Minimum tabs per group"
          htmlFor="minimum-tabs"
          description="A site gets a group once it has this many tabs in a window."
          control={
            <NumberField.Root
              id="minimum-tabs"
              value={settings.minimumTabs}
              min={MINIMUM_TABS_RANGE.minimum}
              max={MINIMUM_TABS_RANGE.maximum}
              onValueChange={value => {
                if (value !== null) update({ minimumTabs: value });
              }}
            >
              <NumberField.Group className="flex h-8 overflow-hidden rounded-md border border-input">
                <NumberField.Decrement className={STEPPER}>−</NumberField.Decrement>
                <NumberField.Input className="w-10 border-x border-input bg-card text-center tabular-nums" />
                <NumberField.Increment className={STEPPER}>+</NumberField.Increment>
              </NumberField.Group>
            </NumberField.Root>
          }
        />
        <TitleStyleRow
          value={settings.titleStyle}
          onChange={titleStyle => update({ titleStyle })}
        />
        <Row
          label="Collapse groups you’re not using"
          htmlFor="collapse-inactive"
          description="Only the group of the tab you’re on stays open."
          control={
            <Switch
              id="collapse-inactive"
              checked={settings.shouldCollapseInactive}
              onCheckedChange={shouldCollapseInactive => update({ shouldCollapseInactive })}
            />
          }
        />
        <Row
          label="Keep groups at the start"
          htmlFor="keep-groups-at-start"
          description="TabShoal’s groups stay together right after your pinned tabs."
          control={
            <Switch
              id="keep-groups-at-start"
              checked={settings.shouldKeepGroupsAtStart}
              onCheckedChange={shouldKeepGroupsAtStart => update({ shouldKeepGroupsAtStart })}
            />
          }
        />
      </section>

      <NeverGroup sites={settings.neverGroup} onChange={neverGroup => update({ neverGroup })} />

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Advanced</h2>
        <div className="rounded-lg border border-border bg-card">
          <Row
            label="Closing a tab goes back to the tab that opened it"
            htmlFor="return-to-opener"
            description="Only when that tab is still open in this window and you were on it in the last 10 minutes."
            control={
              <Switch
                id="return-to-opener"
                checked={settings.shouldReturnToOpener}
                onCheckedChange={shouldReturnToOpener => update({ shouldReturnToOpener })}
              />
            }
          />
        </div>
      </section>
    </main>
  );
};

const STEPPER =
  'flex w-8 items-center justify-center bg-card text-muted-foreground select-none hover:bg-muted hover:text-foreground data-disabled:opacity-40';

const TITLE_STYLES: readonly { style: TitleStyle; label: string }[] = [
  { style: 'name', label: 'Name' },
  { style: 'domain', label: 'Domain' },
];

const TitleStyleRow = ({
  value,
  onChange,
}: {
  value: TitleStyle;
  onChange: (value: TitleStyle) => void;
}) => (
  <div className="flex items-center justify-between gap-6 px-4 py-3">
    <div>
      <p id="title-style" className="font-medium">
        Group names
      </p>
      <p className="mt-0.5 text-muted-foreground">How a group is labelled in the tab strip.</p>
    </div>
    <RadioGroup
      aria-labelledby="title-style"
      value={value}
      onValueChange={next => onChange(next === 'domain' ? 'domain' : 'name')}
      className="flex shrink-0 rounded-md bg-muted p-0.5"
    >
      {TITLE_STYLES.map(({ style, label }) => (
        <Radio.Root
          key={style}
          value={style}
          aria-label={label}
          className="rounded px-2.5 py-1 font-mono text-xs text-muted-foreground data-checked:bg-card data-checked:text-foreground data-checked:shadow-sm"
        >
          {visibleTitleFor('google.com', style)}
        </Radio.Root>
      ))}
    </RadioGroup>
  </div>
);

const NeverGroup = ({
  sites,
  onChange,
}: {
  sites: readonly string[];
  onChange: (sites: string[]) => void;
}) => {
  const [draft, setDraft] = useState('');
  const entry = normaliseSiteEntry(draft);
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-medium">Sites never to group</h2>
        <p className="mt-0.5 text-muted-foreground">
          Their tabs, and their subdomains’ tabs, are left where they are.
        </p>
      </div>
      <form
        className="flex gap-2"
        onSubmit={event => {
          event.preventDefault();
          if (entry === undefined) return;
          if (!sites.includes(entry)) onChange([...sites, entry]);
          setDraft('');
        }}
      >
        <input
          aria-label="Site"
          value={draft}
          onChange={event => setDraft(event.target.value)}
          placeholder="localhost"
          autoComplete="off"
          spellCheck={false}
          className="h-8 min-w-0 flex-1 rounded-md border border-input bg-card px-2.5"
        />
        <Button type="submit" disabled={entry === undefined}>
          Add
        </Button>
      </form>
      {sites.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {sites.map(site => (
            <li key={site} className="flex items-center justify-between gap-3 py-1.5 pr-1.5 pl-4">
              <span className="font-mono text-xs">{site}</span>
              <Button
                variant="link"
                className="px-2 text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${site}`}
                onClick={() => onChange(sites.filter(s => s !== site))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
