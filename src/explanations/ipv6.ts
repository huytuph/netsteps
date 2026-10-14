import {
  binaryIPv6,
  compressIPv6,
  expandIPv6,
  hextets,
  ipv6Address,
  IPv6Subnet,
  ipv6OverlapCheck,
  ipv6StaticRoute,
  planIPv6,
} from '../calculators/ipv6';
import type { Lesson, Step } from './lessons';

export function ipv6AddressLesson(r: ReturnType<typeof ipv6Address>): Lesson {
  const groups = hextets(r.value),
    trimmed = groups.map((h) => parseInt(h, 16).toString(16));
  const steps: Step[] = [
    {
      title: 'Expand to eight hextets',
      text: `${r.expanded}\nEach hextet contains 16 bits; 8 × 16 = 128 bits. :: fills the missing zero hextets.`,
    },
    {
      title: 'Remove leading zeros',
      text: `${trimmed.join(':')}\nKeep a single 0 for an all-zero hextet.`,
    },
    {
      title: 'Compress the longest zero run',
      text: `${r.compressed}\nReplace the longest run of at least two zero hextets with ::. A tie uses the leftmost run. Use lowercase hex; do not compress a single zero hextet.`,
    },
    {
      title: 'Read the address type',
      text: `${r.type}: ${r.note}\nAnycast use depends on configuration and cannot be determined from the address text alone.`,
    },
  ];
  return {
    title: 'IPv6 address formats & type',
    summary: r.compressed,
    metrics: [
      ['Compressed (hex)', r.compressed],
      ['Expanded', r.expanded],
      ['Address type', r.type],
      ['Type / scope note', r.note],
      ['Binary', r.binary],
      ['Solicited-node multicast', r.solicitedNode || 'Not applicable'],
    ],
    columns: ['Hextet', 'Hex', 'Decimal', '16-bit binary'],
    rows: groups.map((h, i) => [
      String(i + 1),
      h,
      String(parseInt(h, 16)),
      parseInt(h, 16).toString(2).padStart(16, '0'),
    ]),
    why: 'Expand first to make all 128 bits visible, then apply the zero-compression rules consistently.',
    methods: {
      recommended: steps,
      binary: groups.map((h, i) => ({
        title: `Hextet ${i + 1}: ${h}`,
        text:
          h
            .split('')
            .map((d) => `${d}₁₆ = ${parseInt(d, 16).toString(2).padStart(4, '0')}₂`)
            .join('\n') + `\n${parseInt(h, 16).toString(2).padStart(16, '0')}`,
      })),
      place: groups.map((h, i) => ({
        title: `Hextet ${i + 1} place values`,
        text:
          h
            .split('')
            .map((d, j) => `${d} × 16^${3 - j} = ${parseInt(d, 16) * 16 ** (3 - j)}`)
            .join('\n') + `\nSum = ${parseInt(h, 16)}`,
      })),
      exam: [{ title: 'Canonical address', text: `${r.expanded} → ${r.compressed}\n${r.type}.` }],
    },
  };
}
export function ipv6SubnetLesson(n: IPv6Subnet): Lesson {
  const formula: Step[] = [
    {
      title: 'Separate prefix and remaining bits',
      text: `128 − ${n.prefix} = ${n.hostBits} remaining bits. Total addresses = 2^${n.hostBits} = ${n.size}.`,
    },
    {
      title: 'Clear the remaining bits',
      text: `Keep the first ${n.prefix} bits; set the remaining ${n.hostBits} bits to zero.\n${n.ip}/${n.prefix} → ${n.network}/${n.prefix}`,
    },
    {
      title: 'Find the last address',
      text: `Network + 2^${n.hostBits} − 1 = ${n.last}. This is a range boundary, not a broadcast address.`,
    },
    {
      title: 'Interpret capacity correctly',
      text: 'IPv6 has no broadcast address. Do not subtract two as in an IPv4 LAN. The total bit-pattern count is not a promise that every address is assignable; account for anycast, reserved uses and the link design.',
    },
    {
      title: 'Choose an appropriate prefix',
      text:
        n.prefix === 127
          ? 'A /127 contains two addresses and is used for inter-router point-to-point links (RFC 6164).'
          : n.prefix === 128
            ? 'A /128 identifies one address / host route.'
            : n.prefix === 64
              ? 'A /64 is the normal LAN/SLAAC subnet boundary. The all-zero interface identifier can have subnet-router anycast meaning.'
              : 'For ordinary LANs using SLAAC, plan /64 subnets. Other lengths can describe allocations, routes or specialized links.',
    },
  ];
  return {
    title: 'IPv6 prefix analysis',
    summary: `${n.network}/${n.prefix}`,
    metrics: [
      ['Network / prefix', `${n.network}/${n.prefix}`],
      ['First address in range', n.network],
      ['Last address in range', n.last],
      ['Prefix bits', String(n.prefix)],
      ['Remaining bits', String(n.hostBits)],
      ['Total addresses (exact)', String(n.size)],
      ['Broadcast', 'Not used in IPv6'],
      ['Prefix mask (hex)', expandIPv6(n.mask)],
      ['Previous prefix', n.previous || 'None'],
      ['Next prefix', n.next || 'None'],
      ['Binary address', binaryIPv6(ipv6Address(n.ip).value)],
    ],
    why: 'Keep the prefix bits and clear the rest. Exact 128-bit arithmetic avoids rounding large IPv6 capacities.',
    methods: {
      recommended: formula,
      formula,
      binary: [
        { title: 'Expand the address', text: expandIPv6(n.ip) },
        {
          title: 'AND with the prefix mask',
          text: `Address ${binaryIPv6(ipv6Address(n.ip).value)}\nMask    ${binaryIPv6(n.mask)}\nNetwork ${binaryIPv6(n.start)}`,
        },
        {
          title: 'Read the prefix result',
          text: `${n.network}/${n.prefix}\nNo broadcast address.`,
        },
      ],
      exam: [
        {
          title: 'Prefix and range',
          text: `128 − ${n.prefix} = ${n.hostBits}; 2^${n.hostBits} = ${n.size}.\n${n.network}–${n.last}. No broadcast.`,
        },
      ],
    },
  };
}
export function ipv6PlanLesson(p: ReturnType<typeof planIPv6>): Lesson {
  const steps: Step[] = [
    {
      title: 'Size by prefix length',
      text: `Base ${p.base.network}/${p.base.prefix}. Each requested /p consumes 2^(128 − p) addresses. /64 is the normal LAN boundary; allocate prefixes, not IPv4-style usable-host counts.`,
    },
    ...p.allocations.map((a) => ({
      title: `${a.name}${a.locked ? ' (locked)' : ''}`,
      text: `/${a.subnet.prefix} → 2^${a.subnet.hostBits} = ${a.subnet.size} addresses.\nAlign to a multiple of this size, avoiding existing allocations.\n${a.subnet.network}/${a.subnet.prefix} → ${a.subnet.last}`,
    })),
    {
      title: 'Check remaining ranges',
      text:
        p.free.map((r) => `${r.first}–${r.last}: ${r.size} addresses`).join('\n') ||
        'The base is fully allocated.',
    },
  ];
  return {
    title: 'IPv6 subnet allocation',
    summary: `${p.allocations.length} subnets in ${p.base.network}/${p.base.prefix}`,
    metrics: [
      ['Base', `${p.base.network}/${p.base.prefix}`],
      ['Allocated prefixes', String(p.allocations.length)],
      ['Remaining addresses (exact)', String(p.remaining)],
      ['Unallocated ranges', p.free.map((r) => `${r.first}–${r.last}`).join('\n') || 'None'],
    ],
    columns: ['Name', 'Prefix', 'Last address', 'Total addresses', 'Allocation'],
    rows: p.allocations.map((a) => [
      a.name,
      `${a.subnet.network}/${a.subnet.prefix}`,
      a.subnet.last,
      String(a.subnet.size),
      a.locked ? 'Locked' : 'Automatic',
    ]),
    warnings: p.allocations.some((a) => a.subnet.prefix !== 64)
      ? [
          'Check prefix use: /64 for ordinary SLAAC LANs, /127 for router point-to-point links, /128 for host routes. Other lengths may describe aggregate allocations.',
        ]
      : [],
    why: 'Allocate larger prefixes first and respect boundaries and locks, so subnet ranges stay disjoint.',
    methods: {
      recommended: steps,
      formula: steps,
      exam: [
        {
          title: 'Allocation result',
          text: p.allocations
            .map((a) => `${a.name}: ${a.subnet.network}/${a.subnet.prefix}`)
            .join('\n'),
        },
      ],
    },
  };
}
export function ipv6OverlapLesson(r: ReturnType<typeof ipv6OverlapCheck>): Lesson {
  const steps = r.networks.map((n) => ({
    title: `${n.network}/${n.prefix}`,
    text: `Range ${n.network}–${n.last}.\nInteger interval [${n.start}, ${n.end}].`,
  }));
  return {
    title: 'IPv6 overlap check',
    summary: r.conflicts.length ? `${r.conflicts.length} overlaps detected` : 'No overlaps',
    metrics: [
      ['Prefixes compared', String(r.networks.length)],
      ['Overlaps', String(r.conflicts.length)],
    ],
    warnings: r.conflicts,
    columns: ['Normalized prefix', 'First address', 'Last address'],
    rows: r.networks.map((n) => [`${n.network}/${n.prefix}`, n.network, n.last]),
    why: 'Compare complete 128-bit ranges to detect containment, duplicate prefixes and partial overlap.',
    methods: {
      recommended: steps,
      formula: [
        {
          title: 'Compare each pair',
          text: 'A.start ≤ B.end AND B.start ≤ A.end means the ranges overlap. Adjacent ranges do not overlap.',
        },
      ],
      exam: [
        {
          title: 'Conflict result',
          text: r.conflicts.join('\n') || 'All supplied ranges are disjoint.',
        },
      ],
    },
  };
}
export function ipv6RouteLesson(r: ReturnType<typeof ipv6StaticRoute>): Lesson {
  const steps: Step[] = [
    {
      title: 'Normalize the destination prefix',
      text: `${r.destination.network}/${r.destination.prefix}. IPv6 commands use prefix length, not a dotted subnet mask. ::/0 is the default route.`,
    },
    {
      title: 'Choose how to reach the neighbor',
      text: r.nextHop
        ? `Next hop ${r.nextHop}${r.exit ? ' on ' + r.exit : ''}. A link-local next hop must include an exit interface because the same address can exist on different links.`
        : `Use exit interface ${r.exit}; verify that the link is point-to-point.`,
    },
    {
      title: 'Set route preference',
      text: `Administrative distance ${r.distance}; a floating backup must have a larger distance than its primary route.`,
    },
    { title: 'Write the route', text: r.command },
    {
      title: 'Enable and verify forwarding',
      text: 'On an IPv6 router, configure ipv6 unicast-routing as appropriate. Verify using show ipv6 route and show ipv6 neighbors; this calculator cannot establish real reachability.',
    },
  ];
  return {
    title: 'IPv6 static route',
    summary: r.command,
    commands: r.command,
    warnings: r.warnings,
    metrics: [
      ['Destination', `${r.destination.network}/${r.destination.prefix}`],
      ['Next hop', r.nextHop || 'Interface only'],
      ['Exit interface', r.exit || 'Recursive lookup'],
      ['Administrative distance', String(r.distance)],
    ],
    why: 'Use an IPv6 prefix, then the exit interface and/or unicast next hop. A link-local address needs the interface to identify its link.',
    methods: {
      recommended: steps,
      commands: steps,
      connected: [
        {
          title: 'Supplied connected prefixes',
          text: r.connected.map((n) => `${n.network}/${n.prefix}`).join('\n') || 'None supplied.',
        },
        ...steps,
      ],
      exam: [{ title: 'Cisco IPv6 route', text: r.command }],
    },
  };
}
