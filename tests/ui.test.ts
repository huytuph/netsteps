// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp } from '../src/app/controller';
import { defaults, entry, tabs, type Tab, type Values } from '../src/app/storage';

let stop: () => void;
const query = <T extends HTMLElement = HTMLElement>(selector: string) => {
  const result = document.querySelector<T>(selector);
  if (!result) throw new Error(`Missing element: ${selector}`);
  return result;
};
const click = (selector: string) => query<HTMLButtonElement>(selector).click();
function input(name: string, value: string, change = false) {
  const el = query<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
  el.value = value;
  el.dispatchEvent(new Event(change ? 'change' : 'input', { bubbles: true }));
}
const submit = () =>
  query('#calculator').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
const value = (name: string) => query<HTMLInputElement>(`[name="${name}"]`).value;
const nav = (tab: string) => click(`nav [data-tab="${tab}"]`);

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '<div id="app"></div>';
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  stop = startApp(query<HTMLDivElement>('#app'));
});
afterEach(() => {
  stop?.();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('application workflows', () => {
  it.each(tabs)('renders the %s workspace', (tab) => {
    nav(tab);
    expect(query('.page-title').textContent).toBe(tab);
    expect(document.body.textContent).not.toContain('undefined');
  });
  const examples: { tab: Tab; mode?: string; fields: Values; expected: string }[] = [
    { tab: 'Subnetting', fields: { ip: '192.0.2.42', prefix: '27' }, expected: '192.0.2.32' },
    {
      tab: 'Subnetting',
      mode: 'overlap',
      fields: { networks: '10.0.0.0/24\n10.0.0.128/25' },
      expected: '1 overlaps detected',
    },
    {
      tab: 'VLSM',
      fields: { base: '10.0.0.0/24', 'r-0-name': 'LAN', 'r-0-hosts': '22' },
      expected: '10.0.0.0/27',
    },
    {
      tab: 'Static Routing',
      fields: {
        destination: '203.0.113.0/24',
        nextHop: '192.0.2.2',
        distance: '1',
        connected: '192.0.2.0/30',
      },
      expected: 'ip route 203.0.113.0 255.255.255.0 192.0.2.2',
    },
    {
      tab: 'Static Routing',
      mode: 'transit',
      fields: { base: '10.0.0.0/24', links: '2' },
      expected: 'Router-to-router transit allocation',
    },
    {
      tab: 'VLAN/HSRP',
      fields: {
        'r-0-id': '10',
        'r-0-name': 'LAB',
        'r-0-hosts': '20',
        'r-0-network': '10.0.0.0/27',
        'r-0-ports': 'Gi0/1-10',
        'r-0-trunk': 'Gi0/24',
      },
      expected: 'switchport access vlan 10',
    },
    {
      tab: 'VLAN/HSRP',
      mode: 'hsrp',
      fields: {
        network: '10.0.0.0/24',
        group: '10',
        vlan: '10',
        priority1: '110',
        priority2: '100',
      },
      expected: 'standby 10 priority 110',
    },
    {
      tab: 'DHCP/NAT',
      fields: { network: '192.0.2.0/28', pool: 'LAB', gateway: '192.0.2.1', lease: '1' },
      expected: 'ip dhcp pool LAB',
    },
    {
      tab: 'DHCP/NAT',
      mode: 'nat',
      fields: { insideNetwork: '10.0.0.0/24', inside: 'Gi0/0', outside: 'Gi0/1', acl: '1' },
      expected: 'interface Gi0/1 overload',
    },
    {
      tab: 'DHCP/NAT',
      mode: 'dynamic',
      fields: {
        insideNetwork: '10.0.0.0/24',
        pool: 'POOL',
        poolStart: '203.0.113.10',
        poolEnd: '203.0.113.20',
        poolPrefix: '/24',
        acl: '1',
        inside: 'Gi0/0',
        outside: 'Gi0/1',
      },
      expected: 'ip nat inside source list 1 pool POOL',
    },
    {
      tab: 'IPv6',
      mode: 'ospf',
      fields: {
        ospfProcess: '1',
        'r-0-router': 'R1',
        'r-0-routerId': '1.1.1.1',
        'r-0-iface': 'Gi0/0',
        'r-0-address': '2001:db8::1/64',
        'r-0-area': '0',
      },
      expected: 'ipv6 ospf 1 area 0',
    },
    {
      tab: 'Distance Vector',
      fields: { rounds: '2', 'r-0-a': 'R1', 'r-0-b': 'R2', 'r-0-cost': '1' },
      expected: 'Distance-vector',
    },
    {
      tab: 'Frame Relay',
      fields: {
        router: 'R1',
        parent: 'Serial0/0/0',
        'r-0-suffix': '1',
        'r-0-dlci': '220',
        'r-0-address': '10.0.1.1/30',
        'r-0-peer': '10.0.1.2',
        'r-0-networks': '10.2.0.0/24',
      },
      expected: 'frame-relay interface-dlci 220',
    },
    {
      tab: 'Tunnelling',
      fields: {
        tunnelId: '0',
        aName: 'R1',
        aWanInterface: 'Serial0/0/0',
        aWanAddress: '192.0.2.1/30',
        aTunnelAddress: '2001:db8:3::1/64',
        aLanInterface: 'Gi0/0',
        aLanAddress: '2001:db8:1::1/64',
        bName: 'R2',
        bWanInterface: 'Serial0/0/0',
        bWanAddress: '192.0.2.2/30',
        bTunnelAddress: '2001:db8:3::2/64',
        bLanInterface: 'Gi0/0',
        bLanAddress: '2001:db8:2::1/64',
      },
      expected: 'tunnel mode ipv6ip',
    },
  ];
  it.each(examples)(
    'calculates and explains $tab $mode through the actual form',
    ({ tab, mode, fields, expected }) => {
      nav(tab);
      if (mode) input('mode', mode, true);
      for (const [name, text] of Object.entries(fields)) input(name, text);
      submit();
      expect(document.querySelector('[role="alert"]')?.textContent).toBeUndefined();
      expect(query('#result').textContent).toContain(expected);
      expect(query('.steps').textContent?.length).toBeGreaterThan(0);
    },
  );
  it('keeps entered scenario names through method, detail and theme changes', () => {
    nav('Number Systems');
    input('input', '567');
    input('to', 'hex', true);
    submit();
    expect(query('#result').textContent).toContain('237');
    input('scenario-name', 'Exam preparation');
    input('explanation-method', 'place', true);
    expect(value('scenario-name')).toBe('Exam preparation');
    input('detail-level', 'exam', true);
    expect(value('scenario-name')).toBe('Exam preparation');
    click('[data-action="theme"]');
    expect(value('scenario-name')).toBe('Exam preparation');
    click('[data-action="save-scenario"]');
    const saved = JSON.parse(localStorage.getItem('network-study-toolkit-v1')!);
    expect(saved.saved[0].name).toBe('Exam preparation');
  });
  it('preserves planner rows while OSPF rows are added, removed and reordered', () => {
    nav('IPv6');
    input('mode', 'plan', true);
    input('base', '2001:db8::/48');
    input('r-0-name', 'Campus');
    input('r-0-prefix', '64');
    input('mode', 'ospf', true);
    expect(value('r-0-router')).toBe('');
    input('ospfProcess', '1');
    input('r-0-router', 'R1');
    click('[data-action="add-row"]');
    input('r-1-router', 'R2');
    click('[data-action="up"][data-index="1"]');
    expect(value('r-0-router')).toBe('R2');
    click('[data-action="remove-row"][data-index="1"]');
    input('mode', 'plan', true);
    expect(value('base')).toBe('2001:db8::/48');
    expect(value('r-0-name')).toBe('Campus');
    expect(document.querySelectorAll('[data-row]')).toHaveLength(1);
    input('mode', 'ospf', true);
    expect(value('r-0-router')).toBe('R2');
    expect(value('ospfProcess')).toBe('1');
    click('[data-action="reset-form"]');
    expect(value('mode')).toBe('ospf');
    expect(value('r-0-router')).toBe('');
    input('mode', 'plan', true);
    expect(value('r-0-name')).toBe('Campus');
  });
  it('restores and recalculates version-1 saved scenarios without overwriting their inputs', () => {
    stop();
    const workspace = defaults();
    workspace.saved = [
      entry(
        'Number Systems',
        { mode: 'integer', input: '567', from: 'decimal', to: 'hex' },
        [],
        'Saved exam',
        '237',
      ),
    ];
    localStorage.setItem('network-study-toolkit-v1', JSON.stringify(workspace));
    stop = startApp(query<HTMLDivElement>('#app'));
    click('[data-action="open-entry"]');
    expect(value('input')).toBe('567');
    expect(value('to')).toBe('hex');
    expect(query('#result').textContent).toContain('237');
  });
  it('retains the stale-result warning after a presentation change and blocks stale printing', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    nav('Number Systems');
    input('input', '81');
    submit();
    input('input', '82');
    input('detail-level', 'standard', true);
    expect(query('#stale').classList.contains('hidden')).toBe(false);
    click('[data-action="print"]');
    await Promise.resolve();
    await Promise.resolve();
    expect(print).not.toHaveBeenCalled();
    expect(query('#notice').textContent).toContain('Calculate again');
  });
  it('keeps practice answers through rendering and clears them when generating a new question', () => {
    nav('Practice');
    submit();
    input('answer-0', 'my answer');
    click('[data-action="practice-hint"]');
    expect(value('answer-0')).toBe('my answer');
    click('[data-action="theme"]');
    expect(value('answer-0')).toBe('my answer');
    submit();
    expect(value('answer-0')).toBe('');
  });
  async function importText(text: string) {
    const file = query<HTMLInputElement>('#import-file');
    Object.defineProperty(file, 'files', {
      value: [{ size: text.length, text: async () => text }],
      configurable: true,
    });
    file.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  }
  it('imports version-1 saves and applies preferences through the file input', async () => {
    const incoming = defaults();
    incoming.preferences.theme = 'dark';
    incoming.saved = [
      entry(
        'Number Systems',
        { mode: 'integer', input: '255', from: 'decimal', to: 'hex' },
        [],
        'Imported example',
        'FF',
      ),
    ];
    await importText(JSON.stringify(incoming));
    expect(query('#notice').textContent).toContain('Imported 1 saved scenarios');
    expect(document.documentElement.dataset.theme).toBe('dark');
    click('[data-action="open-entry"]');
    expect(value('input')).toBe('255');
    expect(query('#result').textContent).toContain('FF');
  });
  it('rejects malformed imports without removing existing saves', async () => {
    nav('Number Systems');
    input('input', '81');
    submit();
    input('scenario-name', 'Keep this');
    click('[data-action="save-scenario"]');
    await importText('{invalid');
    expect(query('#notice').textContent).not.toContain('Imported');
    expect(JSON.parse(localStorage.getItem('network-study-toolkit-v1')!).saved[0].name).toBe(
      'Keep this',
    );
  });
  it('copies the calculated answer and exports notes from the calculation snapshot', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    vi.stubGlobal('isSecureContext', true);
    const blobs: Blob[] = [];
    const OriginalURL = URL;
    vi.stubGlobal(
      'URL',
      class extends OriginalURL {
        static createObjectURL(blob: Blob) {
          blobs.push(blob);
          return 'blob:netsteps';
        }
        static revokeObjectURL() {}
      },
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    nav('Number Systems');
    input('input', '567');
    input('to', 'hex', true);
    submit();
    click('[data-action="copy-answer"]');
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Hexadecimal: 237'));
    input('input', '999');
    click('[data-action="export-result"]');
    expect(blobs).toHaveLength(1);
    expect(await blobs[0].text()).toContain('input: 567');
    expect(await blobs[0].text()).toContain('Hexadecimal: 237');
  });
});
