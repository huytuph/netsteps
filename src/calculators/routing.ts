import { Subnet, integer, ipToInt, overlaps, parseNetwork, requireHost } from './ipv4';
export function interfaceName(text: string): string {
  if (!/^[A-Za-z][A-Za-z0-9./:-]{0,39}$/.test(text.trim()))
    throw new Error('Use an interface name such as GigabitEthernet0/1 or Gi0/1.');
  return text.trim();
}
export interface RouteInput {
  destination: string;
  nextHop: string;
  exitInterface: string;
  distance: number;
  connected: string[];
  floating: boolean;
  primaryDistance: number;
  localAddress?: string;
}
export interface RouteResult {
  destination: Subnet;
  nextHop: string;
  command: string;
  warnings: string[];
  connected: Subnet[];
  distance: number;
}
export function staticRoute(input: RouteInput): RouteResult {
  const destination = parseNetwork(input.destination),
    warnings: string[] = [];
  const connected = input.connected.filter((s) => s.trim()).map((s) => parseNetwork(s));
  const distance = integer(input.distance, 1, 254, 'Administrative distance');
  if (
    input.floating &&
    distance <= integer(input.primaryDistance, 1, 254, 'Primary route distance')
  )
    throw new Error('A floating route must have a greater distance than the primary route.');
  if (!input.nextHop.trim() && !input.exitInterface.trim())
    throw new Error('Provide a next hop or exit interface.');
  let nextHop = '';
  if (input.nextHop.trim()) {
    const n = ipToInt(input.nextHop);
    nextHop = input.nextHop.trim();
    if (n === 0 || n >= 0xe0000000 || n >>> 24 === 127)
      throw new Error(
        'Next hop must be a unicast address, not unspecified, loopback, multicast or reserved.',
      );
    if (input.localAddress && ipToInt(input.localAddress) === n)
      throw new Error('Next hop cannot be the local router address.');
    const containing = connected.filter((c) => n >= c.startInt && n <= c.endInt);
    if (
      containing.length &&
      !containing.some((c) => {
        try {
          requireHost(nextHop, c);
          return true;
        } catch {
          return false;
        }
      })
    )
      throw new Error('Next hop is a network or broadcast address on the connected link.');
    if (!containing.length)
      warnings.push(
        'Next hop is not in a supplied connected network. Verify recursive reachability.',
      );
  }
  if (destination.ip !== destination.network)
    warnings.push(`Destination normalized to ${destination.network}/${destination.prefix}.`);
  if (connected.some((c) => c.startInt === destination.startInt && c.prefix === destination.prefix))
    warnings.push(
      'This destination is already directly connected; a static route is usually unnecessary.',
    );
  else if (connected.some((c) => overlaps(c, destination)) && destination.prefix !== 0)
    warnings.push(
      'Destination overlaps a connected network. Check whether a more-specific route is intended.',
    );
  const exit = input.exitInterface.trim() ? interfaceName(input.exitInterface) : '';
  const command = [
    'ip route',
    destination.network,
    destination.mask,
    exit,
    nextHop,
    distance === 1 ? '' : String(distance),
  ]
    .filter(Boolean)
    .join(' ');
  return { destination, nextHop, command, warnings, connected, distance };
}
