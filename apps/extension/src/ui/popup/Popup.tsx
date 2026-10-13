import { type Entitlement, isGroupingAllowed } from '@fishballapps/extension-licence/entitlement';
import { loadEntitlement } from '@fishballapps/extension-licence/store';
import { useEffect, useState } from 'react';
import { loadSession, saveSession } from '../../chrome/session';
import { WindowId } from '../../grouping/plan';
import { send } from '../../messages';
import { Button } from '../components/Button';
import { Mark } from '../components/Mark';
import { Switch } from '../components/Switch';
import { useStored } from '../hooks';
import { Licence, Paywall } from './Licence';

export const Popup = () => {
  const entitlement = useStored('local', ['installedAt', 'licence'], () => loadEntitlement());
  const pausedWindowIds = useStored(
    'session',
    ['pausedWindowIds'],
    async () => (await loadSession()).pausedWindowIds,
  );
  const [windowId, setWindowId] = useState<WindowId>();
  useEffect(() => {
    void (async () => {
      const { id } = await chrome.windows.getCurrent();
      if (id !== undefined) setWindowId(WindowId(id));
    })();
  }, []);

  if (entitlement === undefined || pausedWindowIds === undefined || windowId === undefined) {
    return null;
  }
  return (
    <main className="flex w-80 flex-col">
      <header className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Mark size={20} />
        <h1 className="text-sm font-semibold tracking-tight">TabShoal</h1>
        <Button
          variant="link"
          className="ml-auto text-muted-foreground hover:text-foreground"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          Settings
        </Button>
      </header>
      {isGroupingAllowed(entitlement) ? (
        <Controls
          isPaused={pausedWindowIds.has(windowId)}
          onPausedChange={isPaused =>
            saveSession({
              pausedWindowIds: isPaused
                ? pausedWindowIds.union(new Set([windowId]))
                : pausedWindowIds.difference(new Set([windowId])),
            })
          }
        />
      ) : (
        <Paywall entitlement={entitlement} />
      )}
      <Footer entitlement={entitlement} />
    </main>
  );
};

const Controls = ({
  isPaused,
  onPausedChange,
}: {
  isPaused: boolean;
  onPausedChange: (isPaused: boolean) => void;
}) => {
  const [regroup, setRegroup] = useState<'idle' | 'running' | 'done'>('idle');
  return (
    <section className="flex flex-col gap-3 px-4 pb-4">
      <div className="flex flex-col gap-1.5">
        <Button
          variant="primary"
          className="w-full"
          disabled={regroup === 'running'}
          onClick={async () => {
            setRegroup('running');
            await send({ type: 'regroup-all' });
            setRegroup('done');
          }}
        >
          {regroup === 'done' ? 'Regrouped' : 'Regroup all'}
        </Button>
        <p className="text-muted-foreground">
          Groups every tab again, including the ones you took out of a group.
        </p>
      </div>
      <div className="flex items-center justify-between gap-4 rounded-md bg-muted px-3 py-2.5">
        <span className="flex flex-col">
          <label htmlFor="pause-window" className="font-medium">
            Pause on this window
          </label>
          {isPaused && (
            <span className="text-muted-foreground">Tabs here stay as you leave them.</span>
          )}
        </span>
        <Switch id="pause-window" checked={isPaused} onCheckedChange={onPausedChange} />
      </div>
    </section>
  );
};

const Footer = ({ entitlement }: { entitlement: Entitlement }) => (
  <footer className="border-t border-border px-4 py-3">
    <Licence entitlement={entitlement} />
  </footer>
);
