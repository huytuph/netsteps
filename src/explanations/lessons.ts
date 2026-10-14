import { binaryIp, HostRequirement, Subnet } from '../calculators/ipv4';
import { Conversion } from '../calculators/numbers';
import { VlsmPlan } from '../calculators/vlsm';
import { RouteResult } from '../calculators/routing';
import type { Question } from '../calculators/practice';
import { ipv6AddressLesson, ipv6SubnetLesson, ipv6RouteLesson } from './ipv6';
export interface Step {
  title: string;
  text: string;
}
export interface Lesson {
  title: string;
  summary: string;
  metrics: [string, string][];
  methods: Record<string, Step[]>;
  why: string;
  columns?: string[];
  rows?: string[][];
  commands?: string;
  warnings?: string[];
}
const step = (title: string, text: string): Step => ({ title, text });
export function numberLesson(r: Conversion): Lesson {
  const radix = { decimal: 10, binary: 2, hex: 16 };
  const division: Step[] = [];
  let n = r.value;
  const target = r.to === 'decimal' ? radix[r.from] : radix[r.to];
  do {
    division.push(
      step(
        `Divide ${n} by ${target}`,
        `${n} ÷ ${target} = ${Math.floor(n / target)}, remainder ${(n % target).toString(target).toUpperCase()}`,
      ),
    );
    n = Math.floor(n / target);
  } while (n);
  division.push(
    step(
      'Read remainders from bottom to top',
      r.to === 'decimal'
        ? `These digits confirm the source ${r.input}; its decimal value is ${r.value}.`
        : `Pad the octet if needed → ${r.output}.`,
    ),
  );
  const digits = r.input.replace(/^0x/i, '').split('');
  const place = digits.map((d, i) =>
    step(
      `Position ${digits.length - 1 - i}`,
      `${d} × ${radix[r.from]}^${digits.length - 1 - i} = ${parseInt(d, radix[r.from]) * radix[r.from] ** (digits.length - 1 - i)}`,
    ),
  );
  place.push(step('Add the place values', `Decimal total = ${r.value}. In ${r.to}: ${r.output}.`));
  const power: Step[] = [];
  let remaining = r.value;
  for (let p = 7; p >= 0; p--) {
    const weight = 2 ** p,
      bit = remaining >= weight ? 1 : 0;
    if (bit) remaining -= weight;
    power.push(
      step(
        `2^${p} = ${weight}`,
        `${bit ? `Use ${weight}; subtract it` : `Skip ${weight}`} → bit ${bit}, remainder ${remaining}.`,
      ),
    );
  }
  power.push(
    step(
      'Read the bits',
      `${r.value.toString(2).padStart(8, '0')}₂ = ${r.value}₁₀ = ${r.value.toString(16).toUpperCase().padStart(2, '0')}₁₆`,
    ),
  );
  const nibble = step(
    'Group four binary bits per hex digit',
    r.value
      .toString(2)
      .padStart(8, '0')
      .match(/.{4}/g)!
      .map((bits) => `${bits} = ${parseInt(bits, 2).toString(16).toUpperCase()}`)
      .join('\n'),
  );
  return {
    title: 'Octet conversion',
    summary: r.output,
    metrics: [
      ['Decimal', String(r.value)],
      ['Binary', r.value.toString(2).padStart(8, '0')],
      ['Hexadecimal', r.value.toString(16).toUpperCase().padStart(2, '0')],
    ],
    why: 'Use place values when reading a number; use repeated division when writing a new base. Four-bit groups make binary ↔ hex quick.',
    methods: {
      recommended: r.from === 'decimal' ? division : place,
      division,
      place,
      powers: power,
      binary: [nibble, step('Final conversion', r.output)],
      exam: [
        step(
          'Convert via decimal',
          `${r.input} (${r.from}) = ${r.value} decimal = ${r.output} (${r.to}).`,
        ),
      ],
    },
  };
}
export function ipv4Lesson(decimal: string, binary: string, octets: Conversion[]): Lesson {
  const recommended = octets.flatMap((r, i) => [
    step(
      `Octet ${i + 1}: ${r.value}`,
      `${r.value} = ${[128, 64, 32, 16, 8, 4, 2, 1].filter((w) => (r.value & w) !== 0).join(' + ') || '0'} → ${r.output}`,
    ),
  ]);
  const variants: Record<string, Step[]> = {
    recommended,
    exam: [step('Convert each octet independently', `${decimal}\n${binary}`)],
  };
  ['division', 'place', 'powers'].forEach(
    (m) =>
      (variants[m] = octets.flatMap((r, i) =>
        numberLesson(r).methods[m].map((s) => ({ ...s, title: `Octet ${i + 1} · ${s.title}` })),
      )),
  );
  return {
    title: 'IPv4 conversion',
    summary: binary,
    metrics: [
      ['Decimal IPv4', decimal],
      ['Binary IPv4', binary],
    ],
    columns: ['Octet', 'Decimal', 'Binary', 'Hex'],
    rows: octets.map((r, i) => [
      String(i + 1),
      String(r.value),
      r.output,
      r.value.toString(16).toUpperCase().padStart(2, '0'),
    ]),
    why: 'Each IPv4 octet is an independent 8-bit value. Powers of two show exactly where each bit comes from.',
    methods: variants,
  };
}
export function subnetLesson(n: Subnet): Lesson {
  const block = [
    step(
      'Find the subnet size',
      `32 − ${n.prefix} = ${n.hostBits} host bits.\n2^${n.hostBits} = ${n.size} addresses per subnet.`,
    ),
    step(
      'Find the containing block',
      `In octet ${n.boundaryOctet + 1}: 256 − ${n.mask.split('.')[n.boundaryOctet]} = ${n.blockSize}.\nIP octet = ${n.ip.split('.')[n.boundaryOctet]}.\nfloor(${n.ip.split('.')[n.boundaryOctet]} ÷ ${n.blockSize}) × ${n.blockSize} = ${n.network.split('.')[n.boundaryOctet]}.\nKeep earlier octets; set following octets to 0.\nNetwork = ${n.network}.`,
    ),
    step('Find the last address', `${n.network} + ${n.size} − 1 = ${n.end}.`),
    step(
      'Reserve addresses',
      n.prefix >= 31
        ? `/${n.prefix}: ${n.prefix === 31 ? 'both endpoints usable on a point-to-point link' : 'one host-route address'}. No directed broadcast.`
        : `Network and broadcast are reserved.\nUsable range: ${n.first}–${n.last}.\n${n.size} − 2 = ${n.usable} usable hosts.`,
    ),
  ];
  block.push(
    step(
      'Build the wildcard mask',
      n.mask
        .split('.')
        .map((x) => `255 − ${x} = ${255 - Number(x)}`)
        .join('\n') + `\nWildcard = ${n.wildcard}.`,
    ),
  );
  const binary = [
    step('Write IP and mask in binary', `IP:   ${binaryIp(n.ip)}\nMASK: ${binaryIp(n.mask)}`),
    step(
      'AND matching bit positions',
      `1 AND 1 = 1. Every other combination = 0.\nNET:  ${binaryIp(n.network)}\n      ${n.network}`,
    ),
    step(
      'Set host bits to 1',
      `Last address: ${binaryIp(n.end)}\n${n.end}${n.prefix >= 31 ? ' (no directed broadcast)' : ' (broadcast)'}`,
    ),
    block[3],
  ];
  return {
    title: 'IPv4 subnet analysis',
    summary: `${n.network}/${n.prefix}`,
    metrics: [
      ['Network', n.network],
      ['Broadcast', n.broadcast || 'None'],
      ['First usable', n.first],
      ['Last usable', n.last],
      ['Subnet mask', n.mask],
      ['Wildcard', n.wildcard],
      ['CIDR', `/${n.prefix}`],
      ['Network bits', String(n.prefix)],
      ['Host bits', String(n.hostBits)],
      ['Total addresses', String(n.size)],
      ['Usable hosts', String(n.usable)],
      ['Block increment', String(n.blockSize)],
      ['Boundary octet', String(n.boundaryOctet + 1)],
      ['Previous subnet', n.previous || 'None'],
      ['Next subnet', n.next || 'None'],
      ['Binary IP', binaryIp(n.ip)],
      ['Binary mask', binaryIp(n.mask)],
      ['Subnet boundaries', n.boundaries.join(', ')],
    ],
    warnings:
      n.prefix >= 31
        ? [
            n.prefix === 31
              ? '/31 usable range assumes a point-to-point link (RFC 3021).'
              : '/32 represents one host route.',
          ]
        : [],
    why: 'Block size finds the network boundary quickly. Bitwise AND shows why that boundary is correct.',
    methods: {
      recommended: block,
      block,
      binary,
      and: binary,
      formula: block,
      powers: [
        block[0],
        step(
          'Write the mask',
          `${n.prefix} leading 1 bits, then ${n.hostBits} 0 bits.\n${binaryIp(n.mask)} = ${n.mask}`,
        ),
        ...block.slice(1),
      ],
      exam: [
        step(
          'Subnet result',
          `${n.network}/${n.prefix}\nMask ${n.mask}\nRange ${n.first}–${n.last}\nBroadcast ${n.broadcast || 'none'}\nUsable ${n.usable}`,
        ),
      ],
    },
  };
}
export function hostsLesson(r: HostRequirement): Lesson {
  const trials: Step[] = [];
  if (r.mode === 'lan')
    for (let h = 2; h <= r.hostBits; h++)
      trials.push(
        step(
          `Try ${h} host bits`,
          `2^${h} − 2 = ${2 ** h - 2} → ${2 ** h - 2 >= r.target ? 'sufficient' : 'insufficient'} for ${r.target}.`,
        ),
      );
  else
    trials.push(
      step(
        'Choose the special-purpose prefix',
        r.mode === 'p2p'
          ? '/31 provides exactly two point-to-point endpoints.'
          : '/32 provides exactly one host-route address.',
      ),
    );
  const full = [
    step(
      'Allow for growth and infrastructure',
      `Original demand: ${r.required}. Adjusted requirement: ${r.target}.`,
    ),
    ...trials,
    step(
      'Calculate CIDR and mask',
      `32 − ${r.hostBits} = /${r.prefix}\nMask = ${r.mask}\nUnused usable capacity = ${r.usable} − ${r.target} = ${r.unused}.`,
    ),
  ];
  return {
    title: 'Host requirement sizing',
    summary: `/${r.prefix}`,
    metrics: [
      ['Required hosts', String(r.required)],
      ['Adjusted target', String(r.target)],
      ['CIDR', `/${r.prefix}`],
      ['Subnet mask', r.mask],
      ['Host bits', String(r.hostBits)],
      ['Usable capacity', String(r.usable)],
      ['Unused usable capacity', String(r.unused)],
    ],
    why: 'Try increasing powers of two until the adjusted demand fits. This is easy to reproduce by hand.',
    methods: {
      recommended: full,
      powers: full,
      formula: [
        step(
          'Solve the capacity inequality',
          r.mode === 'lan'
            ? `2^h − 2 ≥ ${r.target}\nh = ceil(log₂(${r.target} + 2)) = ${r.hostBits}`
            : `Special mode: /${r.prefix}`,
        ),
        full.at(-1)!,
      ],
      binary: [
        step('Build the binary mask', `${r.prefix} network bits → ${binaryIp(r.mask)}\n${r.mask}`),
        ...full,
      ],
      exam: [full[0], full.at(-1)!],
    },
  };
}
export function vlsmLesson(plan: VlsmPlan): Lesson {
  const steps = plan.allocations.flatMap((a) => [
    ...(a.locked
      ? [
          step(
            `${a.name} · Locked capacity`,
            `The locked /${a.subnet.prefix} is retained even if a smaller prefix would satisfy the requirement. Check its capacity rather than choosing a new block.`,
          ),
        ]
      : []),
    ...hostsLesson({
      required: a.hosts,
      target: a.target,
      prefix: a.subnet.prefix,
      hostBits: a.subnet.hostBits,
      usable: a.subnet.usable,
      unused: a.unused,
      mask: a.subnet.mask,
      mode: a.subnet.prefix === 31 ? 'p2p' : a.subnet.prefix === 32 ? 'host' : 'lan',
    }).methods.recommended.map((s) => ({ ...s, title: `${a.name} · ${s.title}` })),
    step(
      `${a.name} · Allocate an aligned block`,
      `${a.locked ? 'Keep the locked block' : 'Use the first aligned free block'}: ${a.subnet.network}/${a.subnet.prefix}.\nThis block occupies ${a.subnet.network}–${a.subnet.end}.`,
    ),
  ]);
  return {
    title: 'VLSM address allocation',
    summary: `${plan.allocations.length} networks · ${plan.remaining} addresses remaining`,
    metrics: [
      ['Base', `${plan.base.network}/${plan.base.prefix}`],
      ['Allocated addresses', String(plan.used)],
      ['Remaining addresses', String(plan.remaining)],
      [
        'Free address ranges',
        plan.free.map((f) => `${f.start}–${f.end} (${f.size})`).join('\n') || 'None',
      ],
    ],
    columns: [
      'Name',
      'Hosts',
      'Target',
      'CIDR',
      'Mask',
      'Network',
      'Gateway / endpoint',
      'Usable range',
      'Broadcast',
      'Unused usable',
      'Locked',
    ],
    rows: plan.allocations.map((a) => [
      a.name,
      String(a.hosts),
      String(a.target),
      `/${a.subnet.prefix}`,
      a.subnet.mask,
      a.subnet.network,
      a.subnet.first,
      `${a.subnet.first}–${a.subnet.last}`,
      a.subnet.broadcast || 'None',
      String(a.unused),
      a.locked ? 'Yes' : 'No',
    ]),
    why: 'Size each requirement first, allocate largest blocks first, and skip locked allocations. Every allocation begins on a boundary and is checked for overlap.',
    methods: {
      recommended: steps,
      formula: plan.allocations.flatMap((a) => [
        step(
          `${a.name} · Size`,
          `${a.subnet.prefix >= 31 ? 'Special-purpose addressing' : a.locked ? `Locked block: h = 32 − ${a.subnet.prefix}` : `h = ceil(log₂(${a.target} + 2))`}\n/${a.subnet.prefix}, capacity ${a.subnet.usable}`,
        ),
        step('Aligned allocation', `${a.subnet.network}/${a.subnet.prefix} → ${a.subnet.end}`),
      ]),
      binary: plan.allocations.map((a) =>
        step(
          a.name,
          `NET  ${binaryIp(a.subnet.network)}\nMASK ${binaryIp(a.subnet.mask)}\nEND  ${binaryIp(a.subnet.end)}`,
        ),
      ),
      exam: plan.allocations.map((a) =>
        step(
          a.name,
          `${a.hosts} hosts → /${a.subnet.prefix} → ${a.subnet.network}, range ${a.subnet.first}–${a.subnet.last}`,
        ),
      ),
    },
  };
}
export function routeLesson(r: RouteResult): Lesson {
  const steps = [
    step(
      'Identify what is already known',
      r.connected.map((c) => `${c.network}/${c.prefix} is directly connected.`).join('\n') ||
        'No connected networks supplied; reachability cannot be verified.',
    ),
    step(
      'Choose the destination',
      `${r.destination.network}/${r.destination.prefix} uses mask ${r.destination.mask}.`,
    ),
    step(
      'Choose how to forward',
      r.nextHop
        ? `Send toward next hop ${r.nextHop}. The next hop needs an independently reachable route.`
        : 'Forward through the specified exit interface.',
    ),
    step(
      'Set route preference',
      `Administrative distance ${r.distance}. Lower distances are preferred for the same prefix.`,
    ),
    step('Build the command', r.command),
  ];
  return {
    title: 'Static route plan',
    summary: `${r.destination.network}/${r.destination.prefix}`,
    metrics: [
      ['Destination', `${r.destination.network}/${r.destination.prefix}`],
      ['Mask', r.destination.mask],
      ['Next hop', r.nextHop || 'Exit interface'],
      ['Distance', String(r.distance)],
    ],
    commands: r.command,
    warnings: r.warnings,
    why: 'Start with connected networks, identify the remote destination, then choose the neighboring router that can reach it.',
    methods: {
      recommended: steps,
      connected: steps,
      binary: [
        step(
          'Convert the destination mask',
          `${binaryIp(r.destination.mask)} → ${r.destination.mask}`,
        ),
        ...steps.slice(2),
      ],
      exam: [steps[1], steps.at(-1)!],
    },
  };
}
export function commandLesson(
  title: string,
  metrics: [string, string][],
  commands: string,
  steps: Step[],
  why: string,
  rows?: string[][],
  columns?: string[],
): Lesson {
  return {
    title,
    summary: metrics[0] ? `${metrics[0][0]}: ${metrics[0][1]}` : title,
    metrics,
    commands,
    why,
    rows,
    columns,
    methods: {
      recommended: steps,
      commands: commands
        .split('\n')
        .filter((x) => x.trim() && !x.startsWith('!'))
        .map((line) => step('Configuration line', `${line}\n${commandMeaning(line.trim())}`)),
      exam: [
        step('Address and command summary', metrics.map(([k, v]) => `${k}: ${v}`).join('\n')),
        step('Configuration', commands),
      ],
    },
  };
}
function commandMeaning(line: string): string {
  const meanings: [RegExp, string][] = [
    [/^vlan /, 'Create or select this VLAN in global configuration.'],
    [/^name /, 'Assign the VLAN a descriptive name.'],
    [/^interface range /, 'Select these switch ports for the following access configuration.'],
    [/^interface /, 'Select the interface or SVI for the following commands.'],
    [/^switchport mode access/, 'Put the port in access mode for endpoint traffic.'],
    [/^switchport access vlan/, 'Assign untagged data traffic to this VLAN.'],
    [/^switchport voice vlan/, 'Tag phone traffic with this separate voice VLAN.'],
    [/^switchport mode trunk/, 'Carry multiple tagged VLANs over this link.'],
    [/^switchport trunk allowed/, 'Add the listed VLANs to this trunk’s allowed membership.'],
    [/^ip address/, 'Assign this interface its real IPv4 address and subnet mask.'],
    [/^standby .* ip /, 'Set the shared HSRP virtual gateway used by hosts.'],
    [/^standby .* priority /, 'Set election preference; the higher priority is preferred.'],
    [/^standby .* preempt/, 'Allow a higher-priority recovered router to become active again.'],
    [/^no shutdown/, 'Enable the interface administratively.'],
    [/^ip dhcp excluded/, 'Prevent DHCP from leasing these statically reserved addresses.'],
    [/^ip dhcp pool/, 'Create or select the named DHCP pool.'],
    [/^network /, 'Set the subnet from which this DHCP pool leases addresses.'],
    [/^default-router/, 'Give clients this default gateway.'],
    [/^dns-server/, 'Give clients these DNS resolver addresses.'],
    [/^domain-name/, 'Give clients this domain suffix.'],
    [/^lease/, 'Set lease duration in days, or infinite.'],
    [/^option 150/, 'Give IP phones their TFTP/CME server address.'],
    [/^access-list/, 'Match the inside network using its wildcard mask.'],
    [
      /^ip nat inside source/,
      'Translate matching sources to the WAN interface address; overload distinguishes sessions by ports.',
    ],
    [/^ip nat inside$/, 'Mark this interface as the inside NAT boundary.'],
    [/^ip nat outside$/, 'Mark this interface as the outside NAT boundary.'],
  ];
  return (
    meanings.find(([pattern]) => pattern.test(line))?.[1] ||
    'Apply this line in its configuration context.'
  );
}
export function questionLesson(question: Question): Lesson {
  const c = question.calculation;
  if (!c) throw new Error('This practice question has no calculation.');
  switch (c.kind) {
    case 'ipv6-address':
      return ipv6AddressLesson(c.result);
    case 'ipv6-subnet':
      return ipv6SubnetLesson(c.result);
    case 'ipv6-route':
      return ipv6RouteLesson(c.result);
    case 'number':
      return numberLesson(c.result);
    case 'hosts':
      return hostsLesson(c.result);
    case 'subnet':
      return subnetLesson(c.result);
    case 'route':
      return routeLesson(c.result);
    case 'vlsm':
      return vlsmLesson(c.result);
  }
}
export const methodLabels: Record<string, string> = {
  recommended: 'Recommended / Easiest',
  division: 'Division / Remainder',
  place: 'Place Value',
  powers: 'Powers of Two',
  formula: 'Formula',
  binary: 'Binary',
  and: 'Bitwise AND',
  block: 'Block Size',
  connected: 'Connected Networks',
  commands: 'Command by Command',
  exam: 'Short Exam Method',
};
export function methodWhy(lesson: Lesson, method: string): string {
  return (
    (
      {
        division:
          'Repeated division produces one digit at a time. Reading remainders in reverse reconstructs the value in the chosen base.',
        place: 'Multiplying each digit by its positional weight makes every contribution visible.',
        powers:
          'Powers of two connect bit positions to address capacity and help you reproduce the result by hand.',
        formula:
          'The formula expresses the boundary or capacity rule directly, so you can substitute the input values.',
        binary:
          'Binary exposes the network and host bits. Four-bit groups also map directly to hexadecimal digits.',
        and: 'Bitwise AND keeps only positions that are 1 in both the address and the mask.',
        block:
          'Subtract the changing mask octet from 256, then locate the nearest lower block boundary.',
        connected:
          'List connected networks first so you can distinguish local destinations from networks that need a route.',
        commands:
          'Reading each command with its purpose connects the address plan to the configuration.',
        exam: 'This compact method retains the essential arithmetic and final answer for quick revision.',
      } as Record<string, string>
    )[method] || lesson.why
  );
}
