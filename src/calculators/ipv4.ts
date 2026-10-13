export const MAX_IP = 2 ** 32 - 1;
export function integer(value: number, min: number, max: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(`${label} must be an integer from ${min} to ${max}.`);
  return value;
}
export function ipToInt(ip: string): number {
  const parts = ip.trim().split('.');
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p)))
    throw new Error('Enter an IPv4 address with four decimal octets.');
  return parts.reduce((n, p) => n * 256 + integer(Number(p), 0, 255, `IPv4 octet ${p}`), 0);
}
export function intToIp(value: number): string {
  integer(value, 0, MAX_IP, 'IPv4 value');
  return [24, 16, 8, 0].map((shift) => Math.floor(value / 2 ** shift) % 256).join('.');
}
export function binaryIp(ip: string): string {
  return intToIp(ipToInt(ip))
    .split('.')
    .map((x) => Number(x).toString(2).padStart(8, '0'))
    .join('.');
}
export function parsePrefix(value: string | number): number {
  const text = String(value).trim();
  if (text.includes('.')) {
    const bits = ipToInt(text).toString(2).padStart(32, '0');
    if (!/^1*0*$/.test(bits))
      throw new Error('Subnet mask must have contiguous 1 bits followed by 0 bits.');
    return bits.indexOf('0') === -1 ? 32 : bits.indexOf('0');
  }
  if (!/^\/?\d{1,2}$/.test(text))
    throw new Error('Enter a CIDR prefix (/0–/32) or a contiguous dotted mask.');
  return integer(Number(text.replace('/', '')), 0, 32, 'CIDR prefix');
}
export function maskFor(prefix: number): string {
  integer(prefix, 0, 32, 'CIDR prefix');
  return intToIp(MAX_IP - (2 ** (32 - prefix) - 1));
}
export type HostMode = 'lan' | 'p2p' | 'host';
export interface Subnet {
  ip: string;
  prefix: number;
  network: string;
  broadcast: string | null;
  end: string;
  first: string;
  last: string;
  mask: string;
  wildcard: string;
  size: number;
  usable: number;
  startInt: number;
  endInt: number;
  hostBits: number;
  blockSize: number;
  boundaryOctet: number;
  boundaries: number[];
  previous: string | null;
  next: string | null;
}
export function subnet(ip: string, prefixValue: string | number): Subnet {
  const address = ipToInt(ip),
    prefix = parsePrefix(prefixValue),
    size = 2 ** (32 - prefix);
  // Arithmetic avoids JavaScript's signed 32-bit shift behavior at /0 and /1.
  const startInt = Math.floor(address / size) * size,
    endInt = startInt + size - 1;
  const special = prefix >= 31,
    boundaryOctet = Math.min(3, Math.floor(prefix / 8));
  const bitsInOctet = prefix === 32 ? 8 : prefix % 8;
  const blockSize = 2 ** (8 - bitsInOctet);
  return {
    ip: intToIp(address),
    prefix,
    network: intToIp(startInt),
    end: intToIp(endInt),
    broadcast: special ? null : intToIp(endInt),
    first: intToIp(startInt + (special ? 0 : 1)),
    last: intToIp(endInt - (special ? 0 : 1)),
    mask: maskFor(prefix),
    wildcard: intToIp(size - 1),
    size,
    usable: special ? size : size - 2,
    startInt,
    endInt,
    hostBits: 32 - prefix,
    boundaryOctet,
    blockSize,
    boundaries: Array.from({ length: 256 / blockSize }, (_, i) => i * blockSize),
    previous: startInt >= size ? `${intToIp(startInt - size)}/${prefix}` : null,
    next: endInt < MAX_IP ? `${intToIp(endInt + 1)}/${prefix}` : null,
  };
}
export function parseNetwork(text: string, strict = false): Subnet {
  const parts = text.trim().split('/');
  if (parts.length !== 2)
    throw new Error('Enter a network as IPv4/CIDR, for example 172.16.1.0/24.');
  const result = subnet(parts[0], parts[1]);
  if (strict && result.ip !== result.network)
    throw new Error(`Network must be aligned: use ${result.network}/${result.prefix}.`);
  return result;
}
export function isUsable(ip: string, net: Subnet): boolean {
  const value = ipToInt(ip);
  return value >= ipToInt(net.first) && value <= ipToInt(net.last);
}
export function requireHost(ip: string, net: Subnet, label = 'Address'): void {
  if (!isUsable(ip, net))
    throw new Error(
      `${label} ${ip} is outside the usable range ${net.first}–${net.last}, or is a network/broadcast address.`,
    );
}
export function overlaps(a: Subnet, b: Subnet): boolean {
  return a.startInt <= b.endInt && b.startInt <= a.endInt;
}
export function overlapRanges(networks: string[]): string[] {
  const nets = networks.filter((x) => x.trim()).map((x) => parseNetwork(x));
  return nets.flatMap((a, i) =>
    nets
      .slice(i + 1)
      .filter((b) => overlaps(a, b))
      .map(
        (b) =>
          `${a.network}/${a.prefix} overlaps ${b.network}/${b.prefix}: ${intToIp(Math.max(a.startInt, b.startInt))}–${intToIp(Math.min(a.endInt, b.endInt))}`,
      ),
  );
}
export interface HostRequirement {
  required: number;
  target: number;
  prefix: number;
  hostBits: number;
  usable: number;
  unused: number;
  mask: string;
  mode: HostMode;
}
export function hostsToPrefix(
  required: number,
  reserve = 0,
  infrastructure = 0,
  mode: HostMode = 'lan',
): HostRequirement {
  integer(required, 1, MAX_IP - 1, 'Required hosts');
  integer(infrastructure, 0, MAX_IP - 1, 'Infrastructure allowance');
  if (!Number.isFinite(reserve) || reserve < 0 || reserve > 1000)
    throw new Error('Reserve percentage must be from 0 to 1000.');
  const target = Math.ceil(required * (1 + reserve / 100)) + infrastructure;
  let prefix: number;
  if (mode === 'host') {
    if (target !== 1) throw new Error('/32 host mode requires exactly one address.');
    prefix = 32;
  } else if (mode === 'p2p') {
    if (target > 2) throw new Error('/31 point-to-point mode supports at most two endpoints.');
    prefix = 31;
  } else {
    if (target > MAX_IP - 1) throw new Error('Host requirement exceeds IPv4 capacity.');
    prefix = 32 - Math.ceil(Math.log2(target + 2));
  }
  const usable = prefix >= 31 ? 2 ** (32 - prefix) : 2 ** (32 - prefix) - 2;
  return {
    required,
    target,
    prefix,
    hostBits: 32 - prefix,
    usable,
    unused: usable - target,
    mask: maskFor(prefix),
    mode,
  };
}
