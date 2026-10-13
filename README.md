# NetSteps

A privacy-focused, offline networking study workspace built with **TypeScript, HTML, CSS, Vite and Vitest**. It shows the manual working behind the answer. Users enter real IP addresses and networks directly.

**[Open NetSteps](https://huytuph.github.io/netsteps/)** · [Source repository](https://github.com/huytuph/netsteps)

The website and source are public. Your calculations and saved scenarios stay in your browser.

The visual theme follows the [Packet Tracer Catalogue](https://huytuph.github.io/packet-tracer-catalogue/): a blue gradient header, horizontal tabs, system typography, compact rounded panels, and matching light/dark palettes. All styling and fonts remain local.

Calculation inputs start empty, including newly added VLSM/VLAN rows and custom practice inputs. Reset inputs restores the empty form. Required numeric fields must be entered explicitly; empty optional reserve/infrastructure fields mean no allowance, and an empty voice VLAN means no voice VLAN. Tool selectors and study/display preferences retain their initial selections. Saved scenarios restore the values you saved.

## Use it immediately

1. Extract the archive.
2. Open **`netsteps/dist/offline.html`** in a modern browser.
3. Start calculating. No installation, account, backend or network connection is required.

Both production HTML entry files include all application code and styling. Browser policies can restrict localStorage or clipboard access for local files; export a JSON backup before closing if the app reports a storage error. Browser saves belong to that browser and origin (a local file and localhost have separate storage).

## Local development

Prerequisite: **Node.js 22.12 or newer**, with npm.

```sh
cd netsteps
npm ci
npm run dev
```

Open the local URL printed by Vite (normally `http://127.0.0.1:5173`). Installing development dependencies needs network access once. Running the application does not.

```sh
npm test          # unit tests
npm run check    # strict TypeScript checks
npm run build    # static build + self-contained HTML + service worker
npm run preview  # preview dist at http://127.0.0.1:4173
```

Alternatively use `pnpm install --frozen-lockfile` and the equivalent `pnpm` scripts. Both npm and pnpm lockfiles are supplied; `pnpm-workspace.yaml` allows esbuild's standard installation script.

The included `dist/` is ready to use. Serve it from localhost for service-worker caching, or use `offline.html` directly. Service workers require localhost or HTTPS; the development server intentionally does not install one. On a production preview, wait for **Offline app cache ready**, then later visits can work even if the server is stopped. After an update, close all toolkit tabs and reopen to activate the new cache.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` installs locked dependencies, runs all unit tests, checks TypeScript, builds the offline app and deploys `dist/` after a successful push to `main`. Pull requests run the same checks without publishing. No deployment secrets or backend are required.

In the repository's **Settings → Pages**, choose **GitHub Actions** as the publishing source. The live URL is **https://huytuph.github.io/netsteps/**. You can rerun publication from **Actions → Test and deploy NetSteps → Run workflow**.

Vite uses relative asset paths (`base: './'`) so the app works under the `/netsteps/` project path. Visit once online and wait for **Offline app cache ready** before using it offline. Saved data is local to the browser and origin; it is never committed to the repository. Export/import a JSON backup to transfer saves from a local copy to the published app.

The source checkout does not track generated `dist/`. Release archives include `dist/` for immediate offline use; a GitHub source ZIP needs `npm ci` followed by `npm run build` first.

## Workspaces

| Tab            | Features                                                                                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dashboard      | Tool shortcuts, saved scenarios, recent calculations, practice score, privacy/cache status                                                                                                                                           |
| Number Systems | All decimal/binary/hex octet conversions, 8-bit padding, IPv4 ↔ binary, division/remainder, place values, powers of two, nibble grouping                                                                                             |
| Subnetting     | CIDR or dotted mask input, network, broadcast, usable range, mask, wildcard, host/network bits, capacity, block increment, boundaries, neighboring subnets, binary AND, hosts-to-CIDR with growth/infrastructure, overlap checker    |
| VLSM           | Add/remove/reorder rows, automatic largest-first or manual order, per-row LAN/P2P/host mode, locked allocations, aligned placement around locks, overlap/capacity validation, free ranges, unused usable capacity, allocation tables |
| Static Routing | Next-hop, exit-interface and fully specified routes, default route, distance, floating route, connected-network analysis, next-hop validation, /30 or /31 transit-link allocation                                                    |
| VLAN/HSRP      | VLAN IDs/names, host-based allocation with gateway allowance, manual subnet/gateway, access-port ranges, trunk membership, voice VLAN tagging, Cisco study commands, configurable HSRP VIP/SVIs/group/priorities and conflict checks |
| DHCP/NAT       | Pool network/gateway/exclusions, merged exclusions, gateway reservation, DNS/domain/lease, TFTP Option 150, NAT/PAT ACL wildcard and interface roles                                                                                 |
| Practice       | Eleven question topics, easy/medium/hard/custom questions, per-field checking, progressive hints, hidden answers, alternative working, first-attempt score                                                                           |
| Settings       | System/light/dark theme, default explanation/detail, optional history, backup import/export and local data reset                                                                                                                     |

## Explanations and study notes

- **Recommended / Easiest** is the initial method. Relevant alternatives appear for each calculator.
- The independent detail selector supports **Full Working**, **Standard**, **Short Exam Form**, and **Final Answer Only**.
- Progressive hint mode reveals steps on demand. Practice answers remain hidden until revealed.
- Copy answers, working, commands and Markdown tables; export allocation CSV, Markdown notes, a single scenario or the whole workspace as JSON.
- JSON import validates the schema before applying it. It merges saved scenarios/history by ID, applies preferences, and retains the larger practice totals. It does not erase existing scenarios.
- Print styles remove navigation and action buttons. Print while a result is shown to produce study notes.

## Networking conventions

- Traditional LAN capacity is `2^(32-prefix) − 2`. Host requirements use `/30` or larger by default, including a one-host LAN.
- `/31` uses both addresses **only for point-to-point links**, following [RFC 3021](https://www.rfc-editor.org/info/rfc3021/). `/32` is a single host route. Neither has a directed broadcast in this toolkit.
- VLSM base networks and locks must be aligned. Static-route destinations can be normalized from a host address, with a warning.
- VLAN required hosts count endpoints; automatic allocation adds one gateway address. Voice VLANs have separate IDs; plan their subnets, DHCP and call services separately.
- HSRP uses v1 groups `0–255` and distinct VIP, primary SVI and secondary SVI addresses.
- DHCP includes the gateway in exclusions automatically. Overlapping exclusions are merged so capacity is not double-counted.
- Cisco output is a conceptual study configuration. The toolkit validates local address arithmetic and inputs, not real device state, remote reachability or a complete topology. An unresolved next hop produces a reachability warning. See [Cisco static-routing documentation](https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/iproute_pi/configuration/xe-16/iri-xe-16-book/iri-iprouting.html).

## Privacy and storage

- No backend, external APIs, analytics, ads, accounts, remote fonts or runtime third-party dependencies.
- Calculation functions run entirely in-browser.
- Preferences, scenarios, history (latest 100 entries), and practice scores use localStorage under `network-study-toolkit-v1` (the original key is retained so existing saves remain available after the rename).
- Inputs and backups are never uploaded by the application.
- Clearing browser data or using private browsing may remove saved work. Download backups to retain it.
- Exported files contain your inputs. Keep them wherever you keep your study notes.

## Architecture

```text
netsteps/
├── index.html                  # application shell
├── src/
│   ├── calculators/            # pure calculation and validation functions
│   │   ├── ipv4.ts             # addresses, masks, subnetting, host sizing, overlaps
│   │   ├── numbers.ts          # octet and IPv4 base conversions
│   │   ├── vlsm.ts             # aligned allocator and lock handling
│   │   ├── routing.ts          # route generation and connected-network checks
│   │   ├── services.ts         # VLAN, HSRP, DHCP and NAT
│   │   └── practice.ts         # question generation and checking
│   ├── explanations/lessons.ts # teaching methods over structured results
│   ├── pages/                  # input definitions and calculator dispatch
│   ├── components/ui.ts        # escaped semantic UI, copy, tables, downloads
│   ├── app/storage.ts          # versioned local state and backup validation
│   ├── styles/                 # responsive themes and print rules
│   └── main.ts                 # navigation and event coordination
├── public/                     # local icon and app manifest
├── scripts/offline-build.mjs   # inline HTML and versioned offline cache
├── tests/                      # Vitest unit tests
└── dist/                       # supplied production build
```

Calculators have no dependency on DOM or explanation rendering. Explanation modules consume structured calculation results; choosing a teaching method never changes the answer.

## Verification

The tests cover `/0`, `/1`, `/24`, `/30`, `/31`, `/32`, IPv4 endpoints, every mask prefix, all 256 octet values, malformed addresses/masks, host growth, VLSM alignment/fragmentation/locks/capacity/overlaps, static/default/floating routes and invalid next hops, HSRP conflicts, DHCP exclusion merging, VLAN overlaps, PAT and backup validation. The build validates generated service-worker JavaScript syntax.

## License

MIT. See `LICENSE`.
