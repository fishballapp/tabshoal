import { NumberField } from '@base-ui/react/number-field';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { type ReactNode, useState } from 'react';
import { visibleTitleFor } from '../../grouping/site';
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
  const exampleSite = settings.groupBy === 'subdomain' ? 'mail.google.com' : 'google.com';

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center gap-3">
        <Mark size={32} />
        <div>
          <h1 className="text-lg font-semibold tracking-tight">TabShoal</h1>
        </div>
      </header>

      <Section title="What becomes a group">
        <ChoiceRow
          id="group-by"
          label="Group by"
          options={GROUP_BY_OPTIONS}
          value={settings.groupBy}
          onChange={groupBy => update({ groupBy })}
        />
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
        <NeverGroup sites={settings.neverGroup} onChange={neverGroup => update({ neverGroup })} />
      </Section>

      <Section title="How groups look">
        <ChoiceRow
          id="title-style"
          label="Group names"
          options={[
            { value: 'name', label: 'Short', example: visibleTitleFor(exampleSite, 'name') },
            { value: 'domain', label: 'Full', example: visibleTitleFor(exampleSite, 'domain') },
          ]}
          value={settings.titleStyle}
          onChange={titleStyle => update({ titleStyle })}
        />
        <Row
          label="Collapse groups you’re not using"
          htmlFor="collapse-inactive"
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
          description="Right after your pinned tabs."
          control={
            <Switch
              id="keep-groups-at-start"
              checked={settings.shouldKeepGroupsAtStart}
              onCheckedChange={shouldKeepGroupsAtStart => update({ shouldKeepGroupsAtStart })}
            />
          }
        />
      </Section>

      <Section title="Closing tabs">
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
      </Section>
    </main>
  );
};

/** The settings that answer one question, under a heading that asks it. */
const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="flex flex-col gap-2">
    <h2 className="font-medium text-muted-foreground">{title}</h2>
    <div className="divide-y divide-border rounded-lg border border-border bg-card">{children}</div>
  </section>
);

const STEPPER =
  'flex w-8 items-center justify-center bg-card text-muted-foreground select-none hover:bg-muted hover:text-foreground data-disabled:opacity-40';

const GROUP_BY_OPTIONS = [
  { value: 'subdomain', label: 'Subdomain', example: 'mail.google.com' },
  { value: 'domain', label: 'Domain', example: 'google.com' },
] as const;

/** A setting with a few named values, each with an example of what it gives, under its label. */
const ChoiceRow = <Value extends string>({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: readonly { value: Value; label: string; example: string }[];
  value: Value;
  onChange: (value: Value) => void;
}) => (
  <div className="flex flex-col gap-2 px-4 py-3">
    <p id={id} className="font-medium">
      {label}
    </p>
    <RadioGroup
      aria-labelledby={id}
      value={value}
      onValueChange={next => {
        const option = options.find(option => option.value === next);
        if (option !== undefined) onChange(option.value);
      }}
      className="flex rounded-md bg-muted p-0.5"
    >
      {options.map(option => (
        <Radio.Root
          key={option.value}
          value={option.value}
          className="flex flex-1 items-baseline justify-center gap-2 rounded px-2.5 py-1 text-muted-foreground data-checked:bg-card data-checked:text-foreground data-checked:shadow-sm"
        >
          {option.label}
          <span className="font-mono text-xs">{option.example}</span>
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
    <div className="flex flex-col gap-2 px-4 py-3">
      <div>
        <label htmlFor="never-group" className="block font-medium">
          Sites never to group
        </label>
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
          id="never-group"
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
        <ul className="divide-y divide-border rounded-md border border-border">
          {sites.map(site => (
            <li key={site} className="flex items-center justify-between gap-3 py-1 pr-1.5 pl-2.5">
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
    </div>
  );
};
