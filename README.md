# TabShoal

**Your tabs, grouped by site, automatically.** A Chrome extension: open a second tab from a site
and the two sit together in a tab group named after it, like "🐟 github"; close one and the group goes away.

- Groups by site, so `mail.google.com` and `docs.google.com` share a "🐟 google" group.
- Leaves your own groups alone, and any tab you drag out of one of its groups.
- Never touches pinned tabs or tabs in a split view.
- Works per window and never moves a tab to another window.
- Nothing leaves your browser except a daily licence check.

$5, £5 or €5 a year after a 14-day free trial. Licensed under [GPL-3.0](LICENSE).

## How it groups

- A site gets a group once it has **2** tabs in a window (you can raise that). When a group drops
  below the minimum, its last tab is ungrouped.
- A tab follows its site: navigate from one site to another and it moves to that site's group.
- Groups TabShoal makes start with 🐟 so you can spot them, and carry an invisible marker at the end
  of their title. A group without the marker is yours, even one you name with a 🐟, and TabShoal
  ignores it and every tab in it.
- Drag a tab out of one of its groups (or use Chrome's **Ungroup**) and TabShoal leaves that tab
  alone until you press **Regroup all**. Drag it back in and it's tracked again.

## The panel and settings

Click the toolbar icon for **Regroup all**, **Pause on this window**, your licence, and
**Settings**:

| Setting | Default |
| --- | --- |
| Minimum tabs per group | 2 |
| Sites never to group, e.g. `localhost` | none |
| Group names: `🐟 google` or `🐟 google.com` | `🐟 google` |
| Collapse groups you're not using | off |
| Keep groups at the start (right after pinned tabs) | off |

## Permissions

`tabs` (read tab URLs to know their site), `tabGroups`, `storage` (your settings) and `alarms`
(the daily licence check). No access to page content, and no host permissions.

## Building

Needs Node 24 or later and pnpm.

```sh
pnpm install
pnpm -F @tabshoal/extension build   # → apps/extension/dist
pnpm -F @tabshoal/extension test
```

Then `chrome://extensions` → **Developer mode** → **Load unpacked** → the `apps/extension/dist` folder.

The source is GPL-3.0, so anyone may build it themselves.

## Trying it

With the build loaded:

1. Open two tabs of one site: they form a group named after it. Open a third: it joins.
2. Navigate one of them to another site: it leaves the group; with one tab left, the group goes.
3. Pin a grouped tab: it stays pinned and out of any group. Unpin it: it rejoins.
4. Drag a tab out of a TabShoal group: it stays out, even after it navigates. **Regroup all** puts
   it back.
5. Make a group of your own: TabShoal leaves it and its tabs alone.
6. Turn on **Pause on this window**: new tabs there stay ungrouped. Turn it off: they group.
7. In Options, add a site you have grouped to **Sites never to group**: its group dissolves.
   Switch the group names to `🐟 google.com`: groups are renamed. Turn on **Collapse groups you're
   not using**: every group but the current tab's folds. Turn on **Keep groups at the start**:
   TabShoal's groups line up after the pinned tabs, your own groups after them; drag one of them
   away and it swims back.
