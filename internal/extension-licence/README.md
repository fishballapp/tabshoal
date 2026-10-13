# @fishballapps/extension-licence

A Chrome extension's licence, sold through [Polar](https://polar.sh) licence keys: a trial counted
in the browser, keys checked against Polar, and a daily re-check. TabShoal and Vinimal use it.

| Module | What it is |
| --- | --- |
| `entitlement` | **The pure rules**: a 14-day trial from install; a granted key works for 14 days without an answer from Polar, and an expiring key stops at its expiry date |
| `polar` | Polar's no-auth validate endpoint, asked about each of the extension's benefits in turn |
| `store` | The install time and the licence in `storage.local`: per browser, never synced |
| `worker` | For the service worker: checking the key once `nextCheckAt` has passed (an hourly alarm looks), and entering one, in a queue of their own |

Each extension keeps its own Polar config (organization, benefits, checkout links) and passes
a `LicenceServer` (`api`, `organizationId`, `benefitIds`) in. The organization can be shared by
several products, so every validate names a benefit: without one, another product's key would
count.
