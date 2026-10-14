import { host6, token } from './endpoints';
import { integer, intToIp, ipToInt } from './ipv4';
import { ipv6Overlaps } from './ipv6';
import { interfaceName } from './routing';
export interface OspfInterface {
  router: string;
  routerId: string;
  iface: string;
  address: string;
  area: string;
  passive: boolean;
}
export function ospfv3Plan(processId: number, inputs: OspfInterface[]) {
  const process = integer(processId, 1, 65535, 'OSPF process ID');
  if (!inputs.length || inputs.length > 128) throw new Error('Add 1–128 OSPF interface rows.');
  const routers = new Map<string, { name: string; id: string; rows: OspfInterface[] }>(),
    ids = new Map<string, string>(),
    seen = new Set<string>(),
    addresses = new Set<string>();
  const interfaces = inputs.map((r) => {
    const router = token(r.router, 'Router name'),
      key = router.toLowerCase(),
      id = intToIp(ipToInt(r.routerId)),
      iface = interfaceName(r.iface),
      address = host6(r.address, 'OSPF interface address');
    if (ipToInt(id) === 0) throw new Error('Use a nonzero OSPF router ID.');
    const area = r.area.trim();
    if (!area || (!/^\d{1,10}$/.test(area) && !/^\d{1,3}(\.\d{1,3}){3}$/.test(area)))
      throw new Error('Enter an OSPF area as a 32-bit decimal number or dotted ID.');
    const areaNumber = area.includes('.')
      ? ipToInt(area)
      : integer(Number(area), 0, 4294967295, 'OSPF area');
    const existing = routers.get(key);
    if (existing && existing.id !== id)
      throw new Error(`${router}: router ID must be consistent across interface rows.`);
    if (ids.has(id) && ids.get(id) !== key)
      throw new Error('Every OSPF router needs a unique router ID.');
    ids.set(id, key);
    if (seen.has(`${key}:${iface.toLowerCase()}`))
      throw new Error('Each router/interface pair must appear only once.');
    if (addresses.has(address.ip))
      throw new Error('OSPF interface addresses must be unique across routers.');
    seen.add(`${key}:${iface.toLowerCase()}`);
    addresses.add(address.ip);
    const row = {
      router,
      routerId: id,
      iface,
      address: `${address.ip}/${address.prefix}`,
      area: String(areaNumber),
      passive: r.passive,
    };
    if (existing) existing.rows.push(row);
    else routers.set(key, { name: router, id, rows: [row] });
    return { ...row, net: address };
  });
  const warnings: string[] = [];
  interfaces.forEach((a, i) =>
    interfaces.slice(i + 1).forEach((b) => {
      if (a.router.toLowerCase() === b.router.toLowerCase() && ipv6Overlaps(a.net, b.net))
        throw new Error(
          'Two interfaces on the same router must not have overlapping IPv6 prefixes.',
        );
      if (a.net.network === b.net.network && a.net.prefix === b.net.prefix && a.area !== b.area)
        warnings.push(
          `${a.router} and ${b.router}: shared prefix has different OSPF area IDs; adjacency will not form.`,
        );
      if (
        a.net.network === b.net.network &&
        a.net.prefix === b.net.prefix &&
        (a.passive || b.passive)
      )
        warnings.push(
          `${a.router}/${b.router}: a passive interface on the shared prefix will not form an adjacency.`,
        );
    }),
  );
  const areas = new Set(interfaces.map((r) => r.area));
  if (areas.size > 1 && !areas.has('0'))
    warnings.push('Multiple areas are present without area 0. Check the backbone and ABR design.');
  const command = [...routers.values()]
    .map((r) =>
      [
        `! ${r.name}`,
        'enable',
        'configure terminal',
        `hostname ${r.name}`,
        'ipv6 unicast-routing',
        `ipv6 router ospf ${process}`,
        ` router-id ${r.id}`,
        ...r.rows.filter((x) => x.passive).map((x) => ` passive-interface ${x.iface}`),
        'exit',
        ...r.rows.flatMap((x) => [
          `interface ${x.iface}`,
          ` ipv6 address ${x.address}`,
          ` ipv6 ospf ${process} area ${x.area}`,
          ' no shutdown',
          'exit',
        ]),
        'end',
        'show ipv6 ospf neighbor',
        'show ipv6 ospf interface brief',
        'show ipv6 route ospf',
      ].join('\n'),
    )
    .join('\n\n');
  return { process, interfaces, routers: [...routers.values()], command, warnings };
}
