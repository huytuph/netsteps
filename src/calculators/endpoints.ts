import { intToIp, ipToInt, parseNetwork, requireHost, Subnet } from './ipv4';
import { ipv6Type, parseIPv6, parseIPv6Network } from './ipv6';
export function token(input: string, label: string): string {
  const v = input.trim();
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(v))
    throw new Error(
      `${label}: use a name starting with a letter, followed by letters, digits, - or _.`,
    );
  return v;
}
export function unicast4(input: string, label: string): string {
  const n = ipToInt(input);
  if (n === 0 || Math.floor(n / 2 ** 24) === 127 || n >= 0xe0000000)
    throw new Error(`${label} must be a unicast IPv4 address.`);
  return intToIp(n);
}
export function host4(input: string, label: string): Subnet {
  const n = parseNetwork(input);
  unicast4(n.ip, label);
  requireHost(n.ip, n, label);
  return n;
}
export function host6(input: string, label: string) {
  const n = parseIPv6Network(input),
    value = parseIPv6(n.ip),
    type = ipv6Type(value).type;
  if (
    value <= 1n ||
    value >> 120n === 255n ||
    type === 'IPv4-mapped' ||
    type === 'Link-local unicast'
  )
    throw new Error(
      `${label}: enter a global/unique-local IPv6 interface address and prefix, not a link-local or special endpoint.`,
    );
  return n;
}
