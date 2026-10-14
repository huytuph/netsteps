import { Tab, Values } from '../app/storage';
import { hostsToPrefix, integer, overlapRanges, parseNetwork, subnet } from '../calculators/ipv4';
import {
  compressIPv6,
  ipv6Address,
  ipv6OverlapCheck,
  ipv6StaticRoute,
  ipv6Subnet,
  parseBinaryIPv6,
  planIPv6,
} from '../calculators/ipv6';
import { convert, convertInteger, convertIPv4 } from '../calculators/numbers';
import { staticRoute } from '../calculators/routing';
import { dhcpPlan, hsrpPlan, natPlan, vlanPlan } from '../calculators/services';
import { planVlsm, Requirement } from '../calculators/vlsm';
import { integerLesson } from '../explanations/integer';
import {
  ipv6AddressLesson,
  ipv6OverlapLesson,
  ipv6PlanLesson,
  ipv6RouteLesson,
  ipv6SubnetLesson,
} from '../explanations/ipv6';
import {
  hostsLesson,
  ipv4Lesson,
  Lesson,
  numberLesson,
  routeLesson,
  subnetLesson,
  vlsmLesson,
} from '../explanations/lessons';
import { overlapLesson, transitLesson } from '../explanations/planning';
import { dhcpLesson, hsrpLesson, natLesson, vlanLesson } from '../explanations/services';
import { featureFor } from './features';
import { choice, requiredNumber } from './inputs';
export { requiredNumber } from './inputs';
export function requirements(rows: Values[]): Requirement[] {
  return rows.map((r) => ({
    name: r.name,
    hosts: requiredNumber(r.hosts, 'Required hosts'),
    mode: choice(r.mode, ['lan', 'p2p', 'host'], 'address mode'),
    locked: r.locked,
  }));
}
export function calculate(tab: Tab, v: Values, rows: Values[]): Lesson {
  const advanced = featureFor(tab, v)?.calculate(v, rows);
  if (advanced) return advanced;
  if (tab === 'IPv6') {
    if (v.mode === 'subnet') return ipv6SubnetLesson(ipv6Subnet(v.address, v.prefix));
    if (v.mode === 'overlap')
      return ipv6OverlapLesson(ipv6OverlapCheck(v.networks.split('\n').filter((x) => x.trim())));
    if (v.mode === 'plan')
      return ipv6PlanLesson(
        planIPv6(
          v.base,
          rows.map((r) => ({ name: r.name, prefix: r.prefix, locked: r.locked })),
          v.order !== 'manual',
        ),
      );
    if (v.mode === 'route')
      return ipv6RouteLesson(
        ipv6StaticRoute({
          destination: v.destination,
          nextHop: v.nextHop,
          exitInterface: v.exit,
          localAddress: v.local,
          connected: v.connected.split('\n'),
          distance: requiredNumber(v.distance, 'Administrative distance'),
          floating: v.floating === 'on',
          primaryDistance:
            v.floating === 'on' ? requiredNumber(v.primaryDistance, 'Primary route distance') : 0,
        }),
      );
    return ipv6AddressLesson(
      ipv6Address(v.mode === 'binary' ? compressIPv6(parseBinaryIPv6(v.binary)) : v.address),
    );
  }
  if (tab === 'Number Systems') {
    if (v.mode === 'integer')
      return integerLesson(
        convertInteger(
          v.input,
          choice(v.from, ['decimal', 'binary', 'hex'], 'source base'),
          choice(v.to, ['decimal', 'binary', 'hex'], 'target base'),
        ),
      );
    if (v.mode === 'octet')
      return numberLesson(
        convert(
          v.input,
          choice(v.from, ['decimal', 'binary', 'hex'], 'source base'),
          choice(v.to, ['decimal', 'binary', 'hex'], 'target base'),
          v.pad === 'on',
        ),
      );
    const r = convertIPv4(v.mode === 'ipv4' ? v.ipv4 : v.binaryIpv4, v.mode === 'binary-ip');
    const l = ipv4Lesson(r.decimal, r.binary, r.octets);
    if (v.mode === 'binary-ip') l.summary = r.decimal;
    return l;
  }
  if (tab === 'Subnetting') {
    if (v.mode === 'hosts')
      return hostsLesson(
        hostsToPrefix(
          requiredNumber(v.hosts, 'Required usable hosts'),
          Number(v.reserve),
          Number(v.infrastructure),
          choice(v.hostMode, ['lan', 'p2p', 'host'], 'address mode'),
        ),
      );
    if (v.mode === 'overlap') {
      const inputs = v.networks.split('\n').filter((s) => s.trim());
      if (inputs.length < 2 || inputs.length > 256)
        throw new Error('Enter 2–256 networks to compare.');
      const conflicts = overlapRanges(inputs);
      return overlapLesson(
        inputs.map((s) => parseNetwork(s)),
        conflicts,
      );
    }
    return subnetLesson(subnet(v.mode === 'mask' ? '0.0.0.0' : v.ip, v.prefix));
  }
  if (tab === 'VLSM')
    return vlsmLesson(
      planVlsm(v.base, requirements(rows), v.order !== 'manual', Number(v.reserve)),
    );
  if (tab === 'Static Routing') {
    if (v.mode === 'transit') {
      const count = integer(requiredNumber(v.links, 'Number of links'), 1, 256, 'Number of links');
      const plan = planVlsm(
        v.base,
        Array.from({ length: count }, (_, i) => ({
          name: `Link ${i + 1}`,
          hosts: 2,
          mode: v.linkMode === 'p2p' ? 'p2p' : 'lan',
        })),
      );
      return transitLesson(plan);
    }
    return routeLesson(
      staticRoute({
        destination: v.destination,
        nextHop: v.nextHop,
        exitInterface: v.exit,
        distance: requiredNumber(v.distance, 'Administrative distance'),
        primaryDistance:
          v.floating === 'on'
            ? requiredNumber(v.primaryDistance, 'Primary route distance')
            : Number(v.primaryDistance),
        floating: v.floating === 'on',
        connected: v.connected.split('\n'),
        localAddress: v.local,
      }),
    );
  }
  if (tab === 'VLAN/HSRP') {
    if (v.mode === 'hsrp') {
      const r = hsrpPlan({
        network: v.network,
        vip: v.vip,
        primary: v.primary,
        secondary: v.secondary,
        group: requiredNumber(v.group, 'HSRP group'),
        vlan: requiredNumber(v.vlan, 'VLAN ID'),
        priority1: requiredNumber(v.priority1, 'Primary priority'),
        priority2: requiredNumber(v.priority2, 'Secondary priority'),
      });
      return hsrpLesson(r);
    }
    const r = vlanPlan(
      rows.map((row) => ({
        id: requiredNumber(row.id, 'VLAN ID'),
        name: row.name,
        network: row.network,
        gateway: row.gateway,
        ports: row.ports,
        voice: Number(row.voice),
        trunk: row.trunk,
      })),
    );
    r.forEach((a, i) => {
      const h = integer(
        requiredNumber(rows[i].hosts, 'Required VLAN hosts'),
        1,
        2 ** 32 - 2,
        'Required VLAN hosts',
      );
      if (h > a.subnet.usable - 1)
        throw new Error(
          `VLAN ${a.input.id}: ${h} hosts plus one gateway do not fit. Allocate subnets again or use a larger subnet.`,
        );
    });
    return vlanLesson(r);
  }
  if (tab === 'DHCP/NAT') {
    if (v.mode === 'nat') {
      const r = natPlan(
        v.insideNetwork,
        v.inside,
        v.outside,
        requiredNumber(v.acl, 'Standard ACL number'),
      );
      return natLesson(r);
    }
    const r = dhcpPlan({
      network: v.network,
      gateway: v.gateway,
      excluded: v.excluded,
      pool: v.pool,
      dns: v.dns,
      domain: v.domain,
      lease: requiredNumber(v.lease, 'Lease days'),
      tftp: v.tftp,
    });
    return dhcpLesson(r);
  }
  throw new Error('Select a calculator first.');
}
