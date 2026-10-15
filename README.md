# NetSteps

A privacy-focused, offline **IPv4 and IPv6** networking study workspace built with **TypeScript, HTML, CSS, Vite and Vitest**. It shows the manual working behind the answer. Users enter real IP addresses and networks directly.

**[Open NetSteps](https://huytuph.github.io/netsteps/)** · [Source repository](https://github.com/huytuph/netsteps)

The website and source are public. Your calculations and saved scenarios stay in your browser.

The visual theme follows the [Packet Tracer Catalogue](https://huytuph.github.io/packet-tracer-catalogue/): a blue gradient header, horizontal tabs, system typography, compact rounded panels, and matching light/dark palettes. All styling and fonts remain local.

Calculation inputs start empty, including newly added VLSM/VLAN rows and custom practice inputs. Each tool mode keeps an independent draft while you switch tools. Reset inputs clears the current mode. Required numeric fields must be entered explicitly; empty optional reserve/infrastructure fields mean no allowance, and an empty voice VLAN means no voice VLAN. Tool selectors and study/display preferences retain their initial selections. Saved scenarios restore the values you saved.

## Use it immediately

1. Extract the archive.
2. Open **`netsteps/dist/offline.html`** in a modern browser.
3. Start calculating. No installation, account, backend or network connection is required.

Both production HTML entry files include all application code and styling. Browser policies can restrict localStorage or clipboard access for local files; export a JSON backup before closing if the app reports a storage error. Browser saves belong to that browser and origin (a local file and localhost have separate storage).

## Local development

Prerequisite: **Node.js 22.22.2+ (22.x), 24.15.0+ (24.x), or 26+**, with npm. These versions support the development test tools.

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

| Tab             | Features                                                                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dashboard       | Tool shortcuts, saved scenarios, recent calculations, practice score, privacy/cache status                                                                                                                                           |
| Number Systems  | Decimal/binary/hex integers up to 256 significant bits, separate octet mode, 8-bit IPv4 segments, division/remainder, decimal verification, place values and nibble grouping                                                         |
| Subnetting      | CIDR or dotted mask input, network, broadcast, usable range, mask, wildcard, host/network bits, capacity, block increment, boundaries, neighboring subnets, binary AND, hosts-to-CIDR with growth/infrastructure, overlap checker    |
| IPv6            | Address formats, binary conversion, types/scope, prefix math, allocation/locks/overlaps, static routes and multi-router OSPFv3 configuration                                                                                         |
| VLSM            | Add/remove/reorder rows, automatic largest-first or manual order, per-row LAN/P2P/host mode, locked allocations, aligned placement around locks, overlap/capacity validation, free ranges, unused usable capacity, allocation tables |
| Static Routing  | Next-hop, exit-interface and fully specified routes, default route, distance, floating route, connected-network analysis, next-hop validation, /30 or /31 transit-link allocation                                                    |
| VLAN/HSRP       | VLAN IDs/names, host-based allocation with gateway allowance, manual subnet/gateway, access-port ranges, trunk membership, voice VLAN tagging, Cisco study commands, configurable HSRP VIP/SVIs/group/priorities and conflict checks |
| DHCP/NAT        | DHCP exclusions/options, NAT/PAT overload, dynamic NAT pools with exact capacity, ACL selection, interface roles and optional interface/default-route configuration                                                                  |
| Tunnelling      | Reciprocal IPv6-over-IPv4 and GRE plans for both endpoints, outer host routes, LAN/tunnel validation and remote LAN routes                                                                                                           |
| Distance Vector | Weighted topology links, isolated routers, attached destinations, round-0 tables, simultaneous or sequential rounds, candidate-cost working, equal-cost next hops and convergence checks                                             |
| Frame Relay     | Physical serial parent, multiple numbered point-to-point subinterfaces, independent local DLCIs, circuit/peer validation and remote-LAN static routes                                                                                |
| Practice        | Seventeen IPv4/IPv6 question topics, easy/medium/hard/custom questions, per-field checking, progressive hints, hidden answers, alternative working, first-attempt score                                                              |
| Settings        | System/light/dark theme, default explanation/detail, optional history, backup import/export and local data reset                                                                                                                     |

## Explanations and study notes

- The **Methodology** selector lists the relevant explanation names in alphabetical order. **Recommended / Easiest** is selected by default even when another option appears first. Settings provides a separate default methodology preference.
- The independent detail selector supports **Full Working**, **Standard**, **Short Exam Form**, and **Final Answer Only**.
- Progressive hint mode reveals steps on demand. Practice answers remain hidden until revealed.
- Copy answers, working, commands and Markdown tables; export allocation CSV, Markdown notes, a single scenario or the whole workspace as JSON.
- JSON import validates the schema before applying it. It merges saved scenarios/history by ID, keeps the latest 100 calculations in date order, applies preferences, and retains the larger practice totals. It does not erase existing scenarios.
- Imports preserve uncalculated inputs and row edits, including edits or navigation made while the backup is being read.
- Scenario names and practice answers survive explanation, detail and theme changes. Changed inputs retain a stale-result warning until recalculated.
- Print styles remove navigation and action buttons. Print while a result is shown to produce study notes.

## Networking conventions

### IPv6

- The **IPv6** tab includes address formats/type, binary-to-IPv6, prefix analysis, allocation, overlap checks, static routes and OSPFv3 configuration. Address, prefix and row inputs start blank. Save/copy/export/print use the same controls as IPv4, with no additional network services.
- Address parsing supports compressed, expanded and trailing embedded IPv4 forms. Canonical hex output follows [RFC 5952](https://www.rfc-editor.org/rfc/rfc5952.html): lowercase, no leading hextet zeros, longest run of two or more zero hextets compressed, leftmost run on ties. Embedded IPv4 input is displayed in pure hexadecimal. Brackets and zone IDs are rejected; enter an exit interface separately for routes.
- Address types include unspecified, loopback, multicast/scope, link-local, unique-local, documentation, IPv4-mapped, deprecated site-local and global unicast space. Classification is educational, not an allocation/Internet-reachability check. Anycast use requires configuration context. See [RFC 4291](https://www.rfc-editor.org/rfc/rfc4291.html), [RFC 4193](https://www.rfc-editor.org/rfc/rfc4193.html) and [RFC 5156](https://www.rfc-editor.org/rfc/rfc5156.html).
- Prefix math uses exact `BigInt` arithmetic over all 128 bits, including `/0`, `/127`, `/128` and boundaries within a hextet. Results show total bit patterns and first/last range addresses. IPv6 has no broadcast address and does not use IPv4's `−2` LAN formula. These totals do not guarantee that every address can be assigned; account for reserved and anycast uses.
- Allocate by requested prefix length, with automatic largest-first or manual order, optional aligned locks and free-range accounting. Use `/64` for ordinary SLAAC LANs ([RFC 4862](https://www.rfc-editor.org/rfc/rfc4862.html)); `/127` applies to inter-router point-to-point links ([RFC 6164](https://www.rfc-editor.org/rfc/rfc6164.html)); `/128` identifies a single address. The planner also handles aggregate allocations.
- IPv6 route commands use `ipv6 route destination/prefix [interface] [next-hop] [distance]`. Link-local next hops require the exit interface. Local/self, invalid-neighbor and floating-distance validation are included. Supplied connected prefixes support reachability/overlap warnings; real topology and device state remain outside the calculator. See [Cisco IPv6 static routing](https://www.cisco.com/c/en/us/td/docs/routers/ios/config/17-x/ip-routing/b-ip-routing/m_ip6-route-static-xe.html).
- Six IPv6 practice topics cover compression, expansion, address type, network prefix, exact capacity and static routes. Compression requires canonical lowercase output, expansion requires eight four-digit hextets, and prefix/route questions accept equivalent valid address spellings.
- OSPFv3 uses classic IOS / Packet Tracer commands: `ipv6 unicast-routing`, `ipv6 router ospf`, unique `router-id`, interface IPv6 addresses and `ipv6 ospf process area`. Multiple routers/interfaces and passive LANs are supported. Shared-prefix area/passive conflicts produce warnings. This generates a plan; it does not simulate OSPF neighbor formation.
- VLAN/HSRP and DHCP/NAT planners remain IPv4 tools. DHCPv6, IPv6 HSRP and NAT64 are outside these planners.

### Number systems and WAN tools

- **Integer conversion** accepts actual numbers directly, including 000–999, without a Student ID field. Repeated division produces hexadecimal/binary; positional multiplication verifies the decimal total. `BigInt` preserves precision up to 256 significant bits. The separate octet mode retains 0–255 validation. IPv4 conversion explicitly shows eight bits per segment and 32 bits overall.
- **Dynamic NAT** accepts an arbitrary contiguous pool range plus the actual translation subnet prefix/mask. Pool capacity is `end − start + 1`; the pool itself need not have a power-of-two size. The generator binds a standard source ACL to the pool without overload, marks inside/outside interfaces and includes verification commands. See [Cisco NAT configuration](https://www.cisco.com/c/en/us/support/docs/ip/network-address-translation-nat/13772-12.html).
- **Tunnelling** supports `tunnel mode ipv6ip` for manually configured IPv6 over IPv4, and `tunnel mode gre ip` with IPv4 or IPv6 LANs. Supply both routers' physical WAN addresses, tunnel addresses and LAN addresses. Both directions and optional outer host routes are generated. Underlay reachability and clocking remain topology/device responsibilities. See [Cisco manual IPv6 tunnels](https://www.cisco.com/c/en/us/td/docs/ios/ipv6/command/reference/ipv6_book/ipv6_17.html) and [GRE configuration](https://www.cisco.com/c/en/us/td/docs/routers/ios-xe/ip-routing/b-ip-routing/m_ir-impl-tun-xe.html).
- **Distance Vector** is a weighted Bellman–Ford teaching model. Round 0 contains self/direct-neighbor costs plus optional attached destinations. Simultaneous rounds use only the previous round; sequential sweeps use the latest tables in the explicit router order. Results include every router/destination, unreachable infinity, ties and all neighbor candidate sums. Limits are 12 routers, 32 destinations and eight rounds. It does not simulate failure recovery, protocol timers or split horizon. See [RFC 2453, distance-vector algorithms](https://www.rfc-editor.org/rfc/rfc2453.html#section-3.4).
- **Frame Relay** generates the physical serial encapsulation, numbered point-to-point subinterfaces, local DLCIs and global-mode static routes. Circuit subnets, peer addresses and local DLCI/subinterface uniqueness are validated. Cloud/PVC mappings, remote router configuration and multipoint subinterfaces are separate. See [Cisco Frame Relay configuration](https://www.cisco.com/en/US/docs/ios-xml/ios/wan_frly/configuration/15-0m/wan-cfg-frm-rly.html).
- Command outputs are conceptual study configurations. Verify device/image support, underlay routing, provider mappings, clocking and connectivity in your simulator or lab. The application does not execute commands on devices.

### IPv4

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
│   ├── app/                    # state, independent mode drafts, controller, actions, views
│   │   ├── storage.ts          # version-1 backups and local persistence
│   │   ├── history.ts          # shared merge, sorting and retention rules
│   │   └── tools.ts            # tool descriptions and icons
│   ├── calculators/            # pure IPv4/IPv6, VLSM, routing and services logic
│   │   ├── dynamic-nat.ts      # pool validation and configuration
│   │   ├── tunnelling.ts       # typed IPv4/IPv6 payload adapters
│   │   ├── frame-relay.ts      # circuits and remote routes
│   │   ├── ospfv3.ts           # multi-router IPv6 OSPF planning
│   │   └── distance-vector.ts  # Bellman–Ford teaching model
│   ├── explanations/           # structured lessons, methods and shared command explanations
│   ├── pages/
│   │   ├── features/           # per-feature forms, defaults and calculation adapters
│   │   ├── forms.ts            # remaining calculator form composition
│   │   ├── calculate.ts        # input parsing and calculator dispatch
│   │   └── inputs.ts           # shared required-number and choice validation
│   ├── components/             # escaped UI and reusable row controls
│   ├── styles/                 # responsive themes and print rules
│   └── main.ts                 # application bootstrap
├── public/                     # local icon and app manifest
├── scripts/offline-build.mjs   # inline HTML and versioned offline cache
├── tests/                      # Vitest calculation and jsdom interaction tests
└── dist/                       # supplied production build
```

Calculators have no dependency on DOM or explanation rendering. Explanation modules consume structured calculation results; choosing a teaching method never changes the answer.

The controller delegates clicks, submits, input and change events once at the application root and removes those listeners when unmounted. Result refreshes do not add listeners. Explanation-method fallback is resolved before rendering; views and note exports read the state without changing it. Number conversions share digit normalisation and formatting while retaining separate octet and 256-bit integer limits.

## Verification

The 215 tests cover IPv4 `/0`, `/1`, `/24`, `/30`, `/31`, `/32`, endpoints, every mask prefix, all 256 octet values, malformed addresses/masks, host growth, VLSM alignment/fragmentation/locks/capacity/overlaps, static/default/floating routes and invalid next hops, HSRP conflicts, DHCP exclusion merging, VLAN overlaps, PAT and backup validation. IPv6 coverage includes compression ties/single zero groups, malformed and embedded addresses, binary round trips, all 129 prefix lengths, exact 128-bit capacity, range endpoints, allocation/lock conflicts, next-hop scope, six practice topics and saved-scenario compatibility. Additional tests cover every three-digit integer, large integer precision, dynamic NAT pool boundaries, reciprocal tunnels, Frame Relay circuits, OSPF IDs/areas, simultaneous/sequential distance-vector rounds, equal-cost paths, attached destinations and row input handling. Interaction tests exercise every workspace, representative calculation forms, independent IPv6/OSPF rows, row reorder/removal/reset, version-1 scenario restoration, scenario-name preservation, stale printing and practice answers. State tests cover history ordering/deduplication/retention and shared command explanations. Regression tests cover pending imports, edits during file reading, listener cleanup after repeated rendering, read-only views, safe method fallback and shared number parsing boundaries. The build validates generated service-worker JavaScript syntax. Vitest and jsdom are development-only dependencies; the deployed app has no runtime dependencies.

## License

MIT. See `LICENSE`.
