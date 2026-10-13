import { HostMode, Subnet, hostsToPrefix, intToIp, overlaps, parseNetwork, subnet } from './ipv4';
export interface Requirement {
  name: string;
  hosts: number;
  mode: HostMode;
  locked?: string;
}
export interface Allocation {
  name: string;
  hosts: number;
  target: number;
  unused: number;
  locked: boolean;
  subnet: Subnet;
}
export interface VlsmPlan {
  base: Subnet;
  allocations: Allocation[];
  free: { start: string; end: string; size: number }[];
  used: number;
  remaining: number;
}
export function planVlsm(
  baseText: string,
  requirements: Requirement[],
  automatic = true,
  reserve = 0,
): VlsmPlan {
  const base = parseNetwork(baseText, true);
  if (!requirements.length || requirements.length > 256)
    throw new Error('Provide between 1 and 256 network rows.');
  const names = requirements.map((r) => r.name.trim());
  if (names.some((n) => !n) || new Set(names).size !== names.length)
    throw new Error('Network names must be non-empty and unique.');
  const sized = requirements.map((r, index) => ({
    ...r,
    index,
    sizing: hostsToPrefix(r.hosts, reserve, 0, r.mode),
  }));
  const allocated = new Map<number, Allocation>();
  const place = (r: (typeof sized)[number], net: Subnet, locked: boolean) => {
    if (net.startInt < base.startInt || net.endInt > base.endInt)
      throw new Error(`${r.name}: subnet is outside the base network.`);
    if (net.prefix < base.prefix || net.usable < r.sizing.target)
      throw new Error(`${r.name}: locked subnet cannot fit the host requirement.`);
    if (
      (r.mode === 'lan' && net.prefix > 30) ||
      (r.mode === 'p2p' && net.prefix !== 31) ||
      (r.mode === 'host' && net.prefix !== 32)
    )
      throw new Error(`${r.name}: locked prefix conflicts with address mode.`);
    const conflict = [...allocated.values()].find((a) => overlaps(a.subnet, net));
    if (conflict)
      throw new Error(
        `${r.name} overlaps ${conflict.name}: ${intToIp(Math.max(net.startInt, conflict.subnet.startInt))}–${intToIp(Math.min(net.endInt, conflict.subnet.endInt))}.`,
      );
    allocated.set(r.index, {
      name: r.name,
      hosts: r.hosts,
      target: r.sizing.target,
      unused: net.usable - r.sizing.target,
      locked,
      subnet: net,
    });
  };
  sized
    .filter((r) => r.locked?.trim())
    .forEach((r) => place(r, parseNetwork(r.locked!, true), true));
  const pending = sized.filter((r) => !r.locked?.trim());
  if (automatic) pending.sort((a, b) => a.sizing.prefix - b.sizing.prefix || a.index - b.index);
  for (const r of pending) {
    const size = 2 ** (32 - r.sizing.prefix);
    let candidate = Math.ceil(base.startInt / size) * size;
    for (const taken of [...allocated.values()].sort(
      (a, b) => a.subnet.startInt - b.subnet.startInt,
    )) {
      if (candidate + size - 1 < taken.subnet.startInt) break;
      if (candidate <= taken.subnet.endInt)
        candidate = Math.ceil((taken.subnet.endInt + 1) / size) * size;
    }
    if (candidate + size - 1 > base.endInt)
      throw new Error(
        `Insufficient base address space for ${r.name}; requires an aligned /${r.sizing.prefix}.`,
      );
    place(r, subnet(intToIp(candidate), r.sizing.prefix), false);
  }
  const allocations = [...allocated.values()].sort((a, b) => a.subnet.startInt - b.subnet.startInt);
  let cursor = base.startInt;
  const free: VlsmPlan['free'] = [];
  for (const a of allocations) {
    if (a.subnet.startInt > cursor)
      free.push({
        start: intToIp(cursor),
        end: intToIp(a.subnet.startInt - 1),
        size: a.subnet.startInt - cursor,
      });
    cursor = a.subnet.endInt + 1;
  }
  if (cursor <= base.endInt)
    free.push({ start: intToIp(cursor), end: base.end, size: base.endInt - cursor + 1 });
  const used = allocations.reduce((sum, a) => sum + a.subnet.size, 0);
  return { base, allocations, free, used, remaining: base.size - used };
}
