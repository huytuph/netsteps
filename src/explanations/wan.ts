import type { Lesson, Step } from './lessons';
import type { dynamicNat, frameRelayPlan, ospfv3Plan, tunnelPlan } from '../calculators/wan';
import type { distanceVector } from '../calculators/distance-vector';
const step = (title: string, text: string): Step => ({ title, text });
const commandLesson = (
  title: string,
  summary: string,
  metrics: [string, string][],
  commands: string,
  steps: Step[],
  why: string,
  warnings: string[],
): Lesson => ({
  title,
  summary,
  metrics,
  commands,
  why,
  warnings,
  methods: { recommended: steps, commands: steps, exam: [step('Configuration', commands)] },
});
export function dynamicNatLesson(r: ReturnType<typeof dynamicNat>): Lesson {
  return commandLesson(
    'Dynamic NAT pool',
    `${r.pool}: ${r.start}–${r.end}`,
    [
      ['Translated pool', `${r.start}–${r.end}`],
      ['Pool mask', r.poolNet.mask],
      ['Pool capacity', String(r.count)],
      ['Inside interface', r.inside],
      ['Outside interface', r.outside],
    ],
    r.command,
    [
      step(
        'Define the translated pool',
        `${r.end} − ${r.start} + 1 = ${r.count} translated addresses. A pool can be an arbitrary contiguous host range; its mask describes the subnet, not a power-of-two-sized pool.`,
      ),
      ...r.networks.map((n) =>
        step(
          'Select inside sources',
          `${n.network}/${n.prefix}: mask ${n.mask}, wildcard ${n.wildcard}. ACL ${r.acl} is referenced by NAT; it is not applied as an interface traffic filter.`,
        ),
      ),
      step(
        'Bind ACL to pool',
        `ip nat inside source list ${r.acl} pool ${r.pool}\nNo overload: each active inside host uses a separate pool address. At most ${r.count} such mappings can coexist.`,
      ),
      step(
        'Mark the boundaries',
        `${r.inside}: ip nat inside. ${r.outside}: ip nat outside. Router interface addresses must remain outside the translation pool.`,
      ),
      step(
        'Verify with traffic',
        'Generate inside-to-outside traffic, then inspect show ip nat translations and show ip nat statistics. The outside network needs a return path to the translated pool.',
      ),
    ],
    'Define the pool, select the sources, bind them together, and identify the two sides.',
    r.warnings,
  );
}
export function tunnelLesson(r: ReturnType<typeof tunnelPlan>): Lesson {
  const steps = r.endpoints.flatMap((e, i) => [
    step(
      `${e.name}: outer IPv4 path`,
      `${e.wan.ip} → ${r.endpoints[1 - i].wan.ip}. The far edge is the tunnel destination; intermediate routers only forward the outer packet.`,
    ),
    step(
      `${e.name}: inner tunnel`,
      `${e.tunnel.ip}/${e.tunnel.prefix} on Tunnel${r.id}. Mode ${r.mode === 'ipv6ip' ? 'ipv6ip carries IPv6 inside IPv4' : 'gre ip uses GRE over IPv4'}.`,
    ),
    step(
      `${e.name}: remote LAN route`,
      `Route ${r.endpoints[1 - i].lan.network}/${r.endpoints[1 - i].lan.prefix} to the far tunnel address ${r.endpoints[1 - i].tunnel.ip}. The reverse route is also needed.`,
    ),
  ]);
  return commandLesson(
    'Two-router tunnel plan',
    `${r.endpoints[0].name} ↔ ${r.endpoints[1].name}`,
    [
      ['Tunnel', `Tunnel${r.id}`],
      ['Mode', r.mode],
      ['Outer endpoint A', r.endpoints[0].wan.ip],
      ['Outer endpoint B', r.endpoints[1].wan.ip],
    ],
    r.command,
    [
      step(
        'Separate underlay and overlay',
        'The physical IPv4 network is the underlay. LAN and tunnel addresses are the inner network. Verify outer endpoint pings before configuring or testing the overlay.',
      ),
      ...steps,
      step(
        'Verify in order',
        'Check physical interfaces and outer routing; check Tunnel status and addresses; ping the far tunnel address; inspect routes and test both LANs. Tunnel up/up alone is not proof of end-to-end delivery.',
      ),
    ],
    'Build a reachable outer IPv4 path, assign matching inner tunnel addresses and route each remote LAN through the tunnel.',
    r.warnings,
  );
}
export function frameRelayLesson(r: ReturnType<typeof frameRelayPlan>): Lesson {
  const steps = [
    step(
      'Enable the physical serial parent',
      `${r.parent}: no ip address, encapsulation frame-relay, no shutdown. IP addresses belong to the subinterfaces.`,
    ),
    ...r.allocations.flatMap((a) => [
      step(
        `Create ${r.parent}.${a.suffix}`,
        `Use point-to-point, address ${a.net.ip} mask ${a.net.mask}, local DLCI ${a.dlci}. The subinterface number and DLCI are separate values; they need not be equal.`,
      ),
      ...a.remote.map((n) =>
        step(
          `Route to ${n.network}/${n.prefix}`,
          `ip route ${n.network} ${n.mask} ${a.peer}\nThe peer must be a distinct host in this circuit subnet.`,
        ),
      ),
    ]),
    step(
      'Verify the virtual circuits',
      'Check show frame-relay pvc, show frame-relay map and show ip route. Provider/cloud DLCI mappings and remote return routes must exist.',
    ),
  ];
  const l = commandLesson(
    'Frame Relay point-to-point subinterfaces',
    `${r.router}: ${r.allocations.length} circuits`,
    [
      ['Router', r.router],
      ['Physical parent', r.parent],
      ['Circuits', String(r.allocations.length)],
    ],
    r.command,
    steps,
    'One numbered point-to-point subinterface represents one virtual circuit; static routes send each remote LAN to its peer.',
    r.warnings,
  );
  l.columns = ['Subinterface', 'Local DLCI', 'Address', 'Peer', 'Remote networks'];
  l.rows = r.allocations.map((a) => [
    `${r.parent}.${a.suffix}`,
    String(a.dlci),
    `${a.net.ip}/${a.net.prefix}`,
    a.peer,
    a.remote.map((n) => `${n.network}/${n.prefix}`).join(', '),
  ]);
  return l;
}
export function ospfv3Lesson(r: ReturnType<typeof ospfv3Plan>): Lesson {
  const steps = [
    step('Enable IPv6 forwarding', 'ipv6 unicast-routing is configured on every router.'),
    ...r.routers.map((router) =>
      step(
        `${router.name}: identify the OSPF process`,
        `ipv6 router ospf ${r.process}\nrouter-id ${router.id}\nThe process ID is local to the router; the 32-bit router ID must be unique in the OSPF domain.`,
      ),
    ),
    ...r.interfaces.map((i) =>
      step(
        `${i.router}: ${i.iface}`,
        `ipv6 address ${i.address}\nipv6 ospf ${r.process} area ${i.area}\n${i.passive ? 'Passive: advertises this LAN but sends no OSPF Hellos on it.' : 'Active: can form adjacencies with neighbors using compatible link/area settings.'}`,
      ),
    ),
    step(
      'Verify OSPFv3',
      'Check show ipv6 ospf neighbor and show ipv6 route ospf. Interface activation uses the classic IOS / Packet Tracer syntax. Neighbor areas, timers, link connectivity and device support still need verification.',
    ),
  ];
  const l = commandLesson(
    'IPv6 OSPFv3 configuration',
    `${r.routers.length} routers; process ${r.process}`,
    [
      ['Routers', String(r.routers.length)],
      ['Interfaces', String(r.interfaces.length)],
      ['Process ID', String(r.process)],
    ],
    r.command,
    steps,
    'Enable forwarding, give each router a unique ID, then activate OSPF on the interfaces in the appropriate areas.',
    r.warnings,
  );
  l.columns = ['Router', 'Router ID', 'Interface', 'IPv6 address', 'Area', 'Mode'];
  l.rows = r.interfaces.map((i) => [
    i.router,
    i.routerId,
    i.iface,
    i.address,
    i.area,
    i.passive ? 'Passive' : 'Active',
  ]);
  return l;
}
export function distanceVectorLesson(r: ReturnType<typeof distanceVector>): Lesson {
  const cost = (n: number) => (Number.isFinite(n) ? String(n) : '∞');
  const steps = [
    step(
      'Initialize round 0',
      'Each router knows itself at cost 0 and its direct link costs. Other destinations start at ∞, except explicitly attached networks. All links in this model are undirected.',
    ),
    step(
      'Choose the update convention',
      r.mode === 'synchronous'
        ? 'Simultaneous exchanges: every update in round k uses only tables from the end of round k−1. Router display order does not change the result.'
        : `Sequential sweep: ${r.order.join(' → ')}. Each router uses the latest neighbor tables, including earlier updates in the same sweep. This can propagate farther within one round.`,
    ),
    ...r.updates.map((u) =>
      step(
        `Round ${u.round}: ${u.router} → ${u.destination}`,
        u.candidates
          .map((c) => `Via ${c.via}: ${c.link} + ${cost(c.advertised)} = ${cost(c.total)}`)
          .join('\n') +
          `\nPrevious ${cost(u.before)}; best ${cost(u.after)}; next hop ${u.nextHops.join(' / ') || (Number.isFinite(u.after) ? 'local' : 'unreachable')}.`,
      ),
    ),
  ];
  return {
    title: 'Distance-vector routing rounds',
    summary: `${r.rounds} ${r.mode === 'synchronous' ? 'exchange rounds' : 'sequential sweeps'}`,
    metrics: [
      ['Routers', String(r.nodes.length)],
      [
        'Round convention',
        r.mode === 'synchronous' ? 'Simultaneous exchanges' : 'Sequential router sweeps',
      ],
      ['Requested rounds', String(r.rounds)],
      ['Reached fixed point', r.converged ? 'Yes' : 'No — more exchanges can still improve routes'],
    ],
    why: 'For each destination, add the cost to a neighbor to that neighbor’s advertised distance, then choose the minimum. Equal-cost next hops are retained.',
    warnings: [
      'This is a static weighted Bellman–Ford teaching model. It does not simulate RIP timers, split horizon, poisoned reverse or link-failure recovery. Match the round convention and initial tables to the question.',
    ],
    columns: ['Round', 'Router', 'Destination', 'Cost', 'Next hop'],
    rows: r.states.flatMap((s) =>
      r.nodes.flatMap((n) =>
        r.destinations.map((d) => [
          String(s.round),
          n,
          d,
          cost(s.table[n][d].cost),
          s.table[n][d].nextHops.join(' / ') ||
            (Number.isFinite(s.table[n][d].cost) ? 'local' : 'unreachable'),
        ]),
      ),
    ),
    methods: {
      recommended: steps,
      formula: [
        step(
          'Bellman–Ford update',
          'Dᵤ(d) = min(current Dᵤ(d), min over neighbors v of [cost(u,v) + Dᵥ(d)]). Self-distance stays zero.',
        ),
        ...steps.slice(1),
      ],
      exam: [
        step(
          'Final-round vectors',
          r.nodes
            .map(
              (n) =>
                `${n}: ${r.destinations.map((d) => `${d}=${cost(r.states.at(-1)!.table[n][d].cost)}`).join(', ')}`,
            )
            .join('\n'),
        ),
      ],
    },
  };
}
