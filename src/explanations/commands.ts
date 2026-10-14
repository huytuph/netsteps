import type { Lesson, Step } from './model';
const step = (title: string, text: string): Step => ({ title, text });
export function commandLesson(
  title: string,
  metrics: [string, string][],
  commands: string,
  steps: Step[],
  why: string,
  rows?: string[][],
  columns?: string[],
  options: { summary?: string; warnings?: string[] } = {},
): Lesson {
  return {
    title,
    summary: options.summary ?? (metrics[0] ? `${metrics[0][0]}: ${metrics[0][1]}` : title),
    warnings: options.warnings,
    metrics,
    commands,
    why,
    rows,
    columns,
    methods: {
      recommended: steps,
      commands: commands
        .split('\n')
        .filter((x) => x.trim() && !x.trimStart().startsWith('!'))
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
    [/^enable$/, 'Enter privileged EXEC mode.'],
    [/^configure terminal$/, 'Enter global configuration mode.'],
    [/^hostname /, 'Set this router’s name.'],
    [/^end$/, 'Return to privileged EXEC mode.'],
    [/^exit$/, 'Return to the previous configuration context.'],
    [/^show /, 'Inspect operational state to verify the configuration.'],
    [/^ipv6 unicast-routing$/, 'Enable forwarding of IPv6 unicast traffic.'],
    [/^ipv6 router ospf /, 'Create or select this IPv6 OSPF process.'],
    [/^router-id /, 'Identify this router with its unique 32-bit OSPF ID.'],
    [
      /^passive-interface /,
      'Advertise this connected prefix without forming neighbors on the interface.',
    ],
    [/^ipv6 ospf /, 'Enable this OSPF process and area on the interface.'],
    [/^ipv6 address /, 'Assign the IPv6 interface address and prefix length.'],
    [
      /^ipv6 route /,
      'Forward this IPv6 destination prefix through the specified next hop or interface.',
    ],
    [
      /^ip route /,
      'Forward this IPv4 destination network through the specified next hop or interface.',
    ],
    [
      /^no ip address$/,
      'Remove a physical-interface IPv4 address; numbered subinterfaces or IPv6 can be used.',
    ],
    [/^tunnel source /, 'Choose the local outer interface for this tunnel.'],
    [/^tunnel destination /, 'Identify the remote outer IPv4 tunnel endpoint.'],
    [/^tunnel mode /, 'Select the encapsulation used between the outer tunnel endpoints.'],
    [/^encapsulation frame-relay$/, 'Use Frame Relay encapsulation on the physical serial link.'],
    [
      /^frame-relay interface-dlci /,
      'Associate this point-to-point subinterface with its local DLCI.',
    ],
    [/^ip nat pool /, 'Define the translated address range and its actual subnet mask.'],
    [
      /^ip nat inside source list .* pool /,
      'Translate selected inside sources using separate addresses from the named pool.',
    ],
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
