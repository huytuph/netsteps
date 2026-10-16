// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp } from '../src/app/controller';
import { defaults, entry, tabs, type Tab, type Values } from '../src/app/storage';
import { navigationTools, toolFor } from '../src/app/navigation';

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
function nav(tab: Tab, mode?: string) {
  const tool = toolFor(tab, mode);
  click(`nav [data-section="${tool.section}"]`);
  if (document.querySelector(`.subtabs [data-tool="${tool.id}"]`))
    click(`[data-tool="${tool.id}"]`);
  if (mode && value('mode') !== mode) input('mode', mode, true);
}

describe('extended number systems', () => {
  it('starts blank, supports octal and preserves independent Base64 drafts', () => {
    nav('Number Systems');
    expect(value('input')).toBe('');
    input('from', 'octal', true);
    input('to', 'hex', true);
    input('input', '755');
    submit();
    expect(query('.final-panel').textContent).toContain('1ED');
    input('mode', 'base64', true);
    expect(value('data')).toBe('');
    submit();
    expect(query('[role="alert"]').textContent).toContain('Enter data');
    input('data', '你好 🌐');
    submit();
    expect(query('.final-panel').textContent).toContain('5L2g5aW9IPCfjJA=');
    expect(value('explanation-method')).toBe('recommended');
    const labels = [...query<HTMLSelectElement>('[name="explanation-method"]').options].map(
      (option) => option.text,
    );
    expect(labels).toEqual(
      [...labels].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })),
    );
    input('explanation-method', 'indices', true);
    expect(query('.steps').textContent).toContain('Calculate index');
    expect(query('.steps mark.working-input')).toBeTruthy();
    expect(query('.steps em.working-rule')).toBeTruthy();
    expect(query('.steps strong.working-result u')).toBeTruthy();
    input('detail-level', 'final', true);
    expect(document.querySelector('.steps')).toBeNull();
    expect(value('explanation-method')).toBe('indices');
    input('mode', 'integer', true);
    expect(value('input')).toBe('755');
    expect(value('from')).toBe('octal');
    input('mode', 'base64', true);
    expect(value('data')).toBe('你好 🌐');
  });
  it('validates Base64, restores saves and copies readable working without HTML tags', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    vi.stubGlobal('isSecureContext', true);
    nav('Number Systems');
    input('mode', 'base64', true);
    input('direction', 'decode', true);
    input('byteFormat', 'hex', true);
    input('data', 'Zh==');
    submit();
    expect(query('[role="alert"]').textContent).toContain('padding bits');
    input('data', 'Zg==');
    submit();
    expect(query('.final-panel').textContent).toContain('66');
    input('explanation-method', 'grouping', true);
    click('[data-action="copy-working"]');
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('discard 4 unused zero bit(s)'));
    expect(writeText.mock.calls[0][0]).not.toMatch(/<\/?(?:mark|strong|em|u)[ >]/);
    input('scenario-name', 'Base64 decode');
    click('[data-action="save-scenario"]');
    nav('Dashboard');
    click('[data-kind="saved"]');
    expect(value('mode')).toBe('base64');
    expect(value('direction')).toBe('decode');
    expect(value('byteFormat')).toBe('hex');
    expect(value('data')).toBe('Zg==');
    expect(query('.final-panel').textContent).toContain('66');
  });
});

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
  it('shows exactly eight main tabs and the agreed tool groups', () => {
    expect(
      [...document.querySelectorAll('.tabs button')].map((button) => button.textContent),
    ).toEqual([
      'Dashboard',
      'Number Systems',
      'IP Addressing',
      'Routing',
      'LAN Services',
      'WAN Technologies',
      'Practice',
      'Settings',
    ]);
    const groups = [
      ['IP Addressing', ['IPv4 Subnetting', 'IPv6 Addressing', 'VLSM']],
      ['Routing', ['IPv4 Static Routing', 'IPv6 Static Routing', 'Distance Vector', 'OSPFv3']],
      ['LAN Services', ['VLAN', 'HSRP', 'DHCP', 'NAT / PAT']],
      ['WAN Technologies', ['Tunnelling', 'Frame Relay']],
    ] as const;
    for (const [section, labels] of groups) {
      click(`.tabs [data-section="${section}"]`);
      expect(query('.tabs [aria-current="page"]').textContent).toBe(section);
      expect(
        [...document.querySelectorAll('.subtabs button')].map((button) => button.textContent),
      ).toEqual(labels);
    }
    click('.tabs [data-section="Number Systems"]');
    expect(document.querySelector('.subtabs')).toBeNull();
  });
  it.each(navigationTools)('opens the $label tool in $section', (tool) => {
    click(`.tabs [data-section="${tool.section}"]`);
    if (document.querySelector(`[data-tool="${tool.id}"]`)) click(`[data-tool="${tool.id}"]`);
    expect(query('.page-title').textContent).toBe(tool.section);
    expect(query('.tabs [aria-current="page"]').textContent).toBe(tool.section);
    if (tool.modes) {
      expect(tool.modes).toContain(value('mode'));
      const modeSelect = document.querySelector<HTMLSelectElement>('select[name="mode"]');
      if (modeSelect)
        expect([...modeSelect.options].map((option) => option.value)).toEqual(tool.modes);
      else expect(query<HTMLInputElement>('input[name="mode"]').type).toBe('hidden');
    }
  });
  it('remembers each section and shared-calculator submode without losing draft edits', () => {
    click('.tabs [data-section="IP Addressing"]');
    click('[data-tool="ipv6"]');
    input('mode', 'plan', true);
    input('base', '2001:db8::/48');
    input('r-0-name', 'Campus');
    input('r-0-prefix', '64');
    click('.tabs [data-section="Routing"]');
    click('[data-tool="ospfv3"]');
    input('ospfProcess', '8');
    input('r-0-router', 'R8');
    click('[data-tool="static-ipv6"]');
    input('destination', '2001:db8:20::/64');
    click('.tabs [data-section="IP Addressing"]');
    expect(query('.subtabs [aria-current="page"]').textContent).toBe('IPv6 Addressing');
    expect(value('mode')).toBe('plan');
    expect(value('base')).toBe('2001:db8::/48');
    expect(value('r-0-name')).toBe('Campus');
    click('.tabs [data-section="Routing"]');
    expect(query('.subtabs [aria-current="page"]').textContent).toBe('IPv6 Static Routing');
    expect(value('destination')).toBe('2001:db8:20::/64');
    click('[data-tool="ospfv3"]');
    expect(value('ospfProcess')).toBe('8');
    expect(value('r-0-router')).toBe('R8');
  });
  it('retains a selected NAT mode while DHCP and HSRP drafts stay separate', () => {
    click('.tabs [data-section="LAN Services"]');
    input('r-0-id', '10');
    click('[data-tool="hsrp"]');
    input('network', '10.0.0.0/24');
    click('[data-tool="dhcp"]');
    input('pool', 'DHCP-LAB');
    click('[data-tool="nat"]');
    expect(value('mode')).toBe('nat');
    input('mode', 'dynamic', true);
    input('pool', 'PUBLIC-POOL');
    click('[data-tool="dhcp"]');
    expect(value('pool')).toBe('DHCP-LAB');
    click('[data-tool="nat"]');
    expect(value('mode')).toBe('dynamic');
    expect(value('pool')).toBe('PUBLIC-POOL');
    click('[data-tool="hsrp"]');
    expect(value('network')).toBe('10.0.0.0/24');
    click('[data-tool="vlan"]');
    expect(value('r-0-id')).toBe('10');
  });
  it('keeps an active result when its already selected main tab or tool is clicked', () => {
    nav('Subnetting');
    input('ip', '192.0.2.42');
    input('prefix', '27');
    submit();
    input('scenario-name', 'Still here');
    click('.tabs [data-section="IP Addressing"]');
    click('[data-tool="ipv4"]');
    expect(value('scenario-name')).toBe('Still here');
    expect(query('.final-panel').textContent).toContain('192.0.2.32');
  });
  it('clears remembered navigation together with a full local-data reset', () => {
    click('.tabs [data-section="LAN Services"]');
    click('[data-tool="nat"]');
    input('mode', 'dynamic', true);
    input('pool', 'OLD-POOL');
    nav('Settings');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    click('[data-action="reset-data"]');
    expect(query('.page-title').textContent).toBe('Dashboard');
    click('.tabs [data-section="LAN Services"]');
    expect(query('.subtabs [aria-current="page"]').textContent).toBe('VLAN');
    click('[data-tool="nat"]');
    expect(value('mode')).toBe('nat');
    input('mode', 'dynamic', true);
    expect(value('pool')).toBe('');
  });
  it('opens legacy OSPF saves in Routing and preserves their version-1 IDs', () => {
    stop();
    const workspace = defaults();
    workspace.saved = [
      entry(
        'IPv6',
        { mode: 'ospf', ospfProcess: '1' },
        [
          {
            router: 'R1',
            routerId: '1.1.1.1',
            iface: 'Gi0/0',
            address: '2001:db8::1/64',
            area: '0',
            passive: '',
          },
        ],
        'Legacy OSPF',
        '',
      ),
    ];
    localStorage.setItem('network-study-toolkit-v1', JSON.stringify(workspace));
    stop = startApp(query<HTMLDivElement>('#app'));
    expect(query('[data-kind="saved"]').textContent).toContain('Routing · OSPFv3');
    click('[data-kind="saved"]');
    expect(query('.page-title').textContent).toBe('Routing');
    expect(query('.subtabs [aria-current="page"]').textContent).toBe('OSPFv3');
    expect(value('ospfProcess')).toBe('1');
    expect(query('.final-panel').textContent).toContain('ipv6 ospf 1 area 0');
    input('scenario-name', 'New OSPF');
    click('[data-action="save-scenario"]');
    const saved = JSON.parse(localStorage.getItem('network-study-toolkit-v1')!);
    expect(saved.version).toBe(1);
    expect(saved.saved[1].tab).toBe('IPv6');
    expect(saved.saved[1].values.mode).toBe('ospf');
  });
  it.each(tabs)('renders the %s workspace', (tab) => {
    nav(tab);
    expect(query('.page-title').textContent).toBe(toolFor(tab).section);
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
      nav(tab, mode);
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
    nav('IPv6', 'ospf');
    expect(value('r-0-router')).toBe('');
    input('ospfProcess', '1');
    input('r-0-router', 'R1');
    click('[data-action="add-row"]');
    input('r-1-router', 'R2');
    click('[data-action="up"][data-index="1"]');
    expect(value('r-0-router')).toBe('R2');
    click('[data-action="remove-row"][data-index="1"]');
    nav('IPv6', 'plan');
    expect(value('base')).toBe('2001:db8::/48');
    expect(value('r-0-name')).toBe('Campus');
    expect(document.querySelectorAll('[data-row]')).toHaveLength(1);
    nav('IPv6', 'ospf');
    expect(value('r-0-router')).toBe('R2');
    expect(value('ospfProcess')).toBe('1');
    click('[data-action="reset-form"]');
    expect(value('mode')).toBe('ospf');
    expect(value('r-0-router')).toBe('');
    nav('IPv6', 'plan');
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
  it('preserves uncalculated input through backup import and later navigation', async () => {
    nav('Number Systems');
    input('input', '567');
    await importText(JSON.stringify(defaults()));
    expect(value('input')).toBe('567');
    nav('Subnetting');
    nav('Number Systems');
    expect(value('input')).toBe('567');
    expect(document.querySelector('.final-panel')).toBeNull();
  });
  it('preserves row edits through backup import', async () => {
    nav('IPv6');
    input('mode', 'plan', true);
    input('base', '2001:db8::/48');
    input('r-0-name', 'LAN A');
    input('r-0-prefix', '64');
    click('[data-action="add-row"]');
    input('r-1-name', 'LAN B');
    input('r-1-prefix', '64');
    await importText(JSON.stringify(defaults()));
    expect(value('base')).toBe('2001:db8::/48');
    expect(value('r-0-name')).toBe('LAN A');
    expect(value('r-1-name')).toBe('LAN B');
    expect(document.querySelectorAll('[data-row]')).toHaveLength(2);
    submit();
    expect(query('.final-panel').textContent).toContain('2001:db8:0:1::/64');
  });
  it('preserves edits and navigation made while an import is reading', async () => {
    nav('Number Systems');
    input('input', '567');
    let finish!: (text: string) => void;
    const text = new Promise<string>((resolve) => {
      finish = resolve;
    });
    Object.defineProperty(query('#import-file'), 'files', {
      value: [{ size: 100, text: () => text }],
      configurable: true,
    });
    query('#import-file').dispatchEvent(new Event('change', { bubbles: true }));
    input('input', '568');
    nav('Subnetting');
    input('ip', '192.0.2.42');
    input('prefix', '27');
    finish(JSON.stringify(defaults()));
    await text;
    await Promise.resolve();
    expect(query('.page-title').textContent).toBe('IP Addressing');
    expect(value('ip')).toBe('192.0.2.42');
    expect(value('prefix')).toBe('27');
    nav('Number Systems');
    expect(value('input')).toBe('568');
  });
  it('does not finish an import after the application is unmounted', async () => {
    let finish!: (text: string) => void;
    const text = new Promise<string>((resolve) => {
      finish = resolve;
    });
    Object.defineProperty(query('#import-file'), 'files', {
      value: [{ size: 100, text: () => text }],
      configurable: true,
    });
    query('#import-file').dispatchEvent(new Event('change', { bubbles: true }));
    stop();
    finish(JSON.stringify(defaults()));
    await text;
    await Promise.resolve();
    expect(query('#app').innerHTML).toBe('');
    expect(localStorage.getItem('network-study-toolkit-v1')).toBeNull();
  });
  it('processes each input once after repeated rendering and removes listeners on unmount', () => {
    stop();
    let calls = 0;
    const original = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    const wrappers = new WeakMap<EventListenerOrEventListenerObject, EventListener>();
    vi.spyOn(EventTarget.prototype, 'addEventListener').mockImplementation(function (
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (
        this instanceof HTMLElement &&
        ['app', 'result'].includes(this.id) &&
        type === 'input' &&
        listener
      ) {
        const wrapped = function (this: EventTarget, event: Event) {
          calls++;
          if (typeof listener === 'function') listener.call(this, event);
          else listener.handleEvent(event);
        };
        wrappers.set(listener, wrapped);
        return original.call(this, type, wrapped, options);
      }
      return original.call(this, type, listener, options);
    });
    vi.spyOn(EventTarget.prototype, 'removeEventListener').mockImplementation(function (
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ) {
      return remove.call(this, type, listener && (wrappers.get(listener) || listener), options);
    });
    const root = query<HTMLDivElement>('#app');
    stop = startApp(root);
    nav('Number Systems');
    input('input', '567');
    submit();
    for (let i = 0; i < 5; i++) {
      input('explanation-method', i % 2 ? 'recommended' : 'place', true);
      input('detail-level', i % 2 ? 'full' : 'standard', true);
    }
    calls = 0;
    input('scenario-name', 'Once');
    expect(calls).toBe(1);
    stop();
    root.innerHTML = '<input name="probe"><button data-tab="Subnetting">Dormant</button>';
    calls = 0;
    input('probe', 'ignored');
    click('[data-tab="Subnetting"]');
    expect(calls).toBe(0);
    expect(root.textContent).toBe('Dormant');
    stop = startApp(root);
    nav('Number Systems');
    calls = 0;
    input('input', '81');
    expect(calls).toBe(1);
  });
  it('handles navigation clicks on nested dashboard content', () => {
    click('.tool-card[data-section="IP Addressing"] .card-link span');
    expect(query('.page-title').textContent).toBe('IP Addressing');
  });
  it('resolves unsupported explanation methods before showing or exporting a new result', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    vi.stubGlobal('isSecureContext', true);
    nav('Subnetting');
    input('ip', '192.0.2.42');
    input('prefix', '27');
    submit();
    input('explanation-method', 'and', true);
    input('mode', 'hosts', true);
    input('hosts', '22');
    submit();
    expect(value('explanation-method')).toBe('recommended');
    click('[data-action="copy-markdown"]');
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('Manual working (Recommended / Easiest)'),
    );
  });
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
