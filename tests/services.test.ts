import { describe, it, expect } from 'vitest';
import { dhcpPlan, hsrpPlan, natPlan, vlanPlan } from '../src/calculators/services';
describe('LAN services and redundancy', () => {
  const h = {
    network: '172.89.0.0/25',
    vip: '',
    primary: '',
    secondary: '',
    group: 10,
    priority1: 110,
    priority2: 100,
    vlan: 10,
  };
  it('reserves distinct HSRP addresses', () =>
    expect(hsrpPlan(h)).toMatchObject({
      vip: '172.89.0.1',
      primary: '172.89.0.2',
      secondary: '172.89.0.3',
    }));
  it('rejects HSRP duplicates, reserved addresses, and too-small subnets', () => {
    expect(() => hsrpPlan({ ...h, vip: '172.89.0.2' })).toThrow(/distinct/);
    expect(() => hsrpPlan({ ...h, vip: '172.89.0.0' })).toThrow(/usable/);
    expect(() => hsrpPlan({ ...h, network: '172.89.0.0/30' })).toThrow(/three/);
  });
  it('merges DHCP exclusions and always reserves the gateway', () => {
    const r = dhcpPlan({
      network: '192.0.2.0/28',
      pool: 'LAB',
      gateway: '192.0.2.1',
      excluded: '192.0.2.3-192.0.2.5\n192.0.2.5-192.0.2.7',
      dns: '1.1.1.1',
      domain: 'lab.local',
      lease: 1,
      tftp: '192.0.2.2',
    });
    expect(r.available).toBe(8);
    expect(r.command).toContain('option 150 ip 192.0.2.2');
    expect(r.excluded.length).toBe(2);
  });
  it('generates correct PAT wildcards and distinct interfaces', () => {
    expect(natPlan('172.89.0.0/16', 'Gi0/1', 'Gi0/2', 1).command).toContain(
      '172.89.0.0 0.0.255.255',
    );
    expect(() => natPlan('10.0.0.0/24', 'Gi0/1', 'Gi0/1', 1)).toThrow(/distinct/);
  });
  it('validates VLAN IDs, overlaps and voice separation', () => {
    const a = {
      id: 10,
      name: 'LAB',
      network: '10.0.0.0/25',
      gateway: '',
      ports: 'Gi0/1-10',
      voice: 110,
      trunk: 'Gi0/24',
    };
    expect(vlanPlan([a])[0].command).toContain('switchport voice vlan 110');
    expect(() => vlanPlan([a, { ...a, id: 20, network: '10.0.0.64/26' }])).toThrow(/overlaps/);
    expect(() => vlanPlan([{ ...a, id: 4095 }])).toThrow();
    expect(() => vlanPlan([{ ...a, voice: 10 }])).toThrow(/differ/);
  });
});
