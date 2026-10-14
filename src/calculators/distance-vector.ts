import { integer } from './ipv4';
export interface VectorLink {
  a: string;
  b: string;
  cost: number;
}
export interface VectorAttachment {
  router: string;
  destination: string;
  cost: number;
}
export interface VectorRoute {
  cost: number;
  nextHops: string[];
}
export type VectorTable = Record<string, Record<string, VectorRoute>>;
export interface VectorUpdate {
  round: number;
  router: string;
  destination: string;
  before: number;
  after: number;
  nextHops: string[];
  candidates: { via: string; link: number; advertised: number; total: number }[];
}
export function distanceVector(input: {
  nodes: string[];
  links: VectorLink[];
  rounds: number;
  mode: 'synchronous' | 'sequential';
  order?: string[];
  attachments?: VectorAttachment[];
}) {
  const rounds = integer(input.rounds, 1, 8, 'Rounds');
  if (!['synchronous', 'sequential'].includes(input.mode))
    throw new Error('Choose simultaneous exchanges or sequential router updates.');
  const name = (v: string) => {
    const n = v.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,49}$/.test(n))
      throw new Error(
        'Router/destination labels need letters, digits or . : / _ - without spaces.',
      );
    return n;
  };
  const nodes = (input.nodes.length ? input.nodes : input.links.flatMap((l) => [l.a, l.b]))
    .map(name)
    .filter((n, i, a) => a.indexOf(n) === i);
  if (!nodes.length || nodes.length > 12) throw new Error('Enter 1–12 routers.');
  if (new Set(nodes.map((n) => n.toLowerCase())).size !== nodes.length)
    throw new Error('Router names must be distinct without case-only differences.');
  const adjacency: Record<string, Record<string, number>> = Object.fromEntries(
    nodes.map((n) => [n, Object.create(null)]),
  );
  const links = input.links.map((l) => {
    const a = name(l.a),
      b = name(l.b),
      cost = integer(l.cost, 1, 1000000, 'Link cost');
    if (!nodes.includes(a) || !nodes.includes(b))
      throw new Error('Every link endpoint must appear in the router list (matching case).');
    if (a === b) throw new Error('A topology link must connect two different routers.');
    if (adjacency[a][b] !== undefined)
      throw new Error('Enter each undirected router link only once.');
    adjacency[a][b] = cost;
    adjacency[b][a] = cost;
    return { a, b, cost };
  });
  const attachments = (input.attachments || []).map((a) => ({
    router: name(a.router),
    destination: name(a.destination),
    cost: integer(a.cost, 0, 1000000, 'Attached destination cost'),
  }));
  const dests = [...nodes];
  const attachedKeys = new Set<string>();
  for (const a of attachments) {
    if (!nodes.includes(a.router))
      throw new Error('Attached destinations must name a known router.');
    if (nodes.includes(a.destination))
      throw new Error('An attached network label must differ from router names.');
    if (attachedKeys.has(`${a.router}|${a.destination}`))
      throw new Error('An attached router/destination pair is duplicated.');
    attachedKeys.add(`${a.router}|${a.destination}`);
    if (!dests.includes(a.destination)) dests.push(a.destination);
  }
  if (dests.length > 32) throw new Error('Use at most 32 total router and network destinations.');
  const order = input.mode === 'sequential' ? input.order || [] : nodes;
  if (
    input.mode === 'sequential' &&
    (order.length !== nodes.length ||
      new Set(order).size !== nodes.length ||
      order.some((n) => !nodes.includes(n)))
  )
    throw new Error('Sequential order must list every router exactly once.');
  let current: VectorTable = Object.fromEntries(
    nodes.map((n) => [
      n,
      Object.fromEntries(
        dests.map((d) => [
          d,
          {
            cost: n === d ? 0 : (adjacency[n][d] ?? Infinity),
            nextHops: n === d ? [] : adjacency[n][d] !== undefined ? [d] : [],
          },
        ]),
      ),
    ]),
  );
  for (const a of attachments) current[a.router][a.destination] = { cost: a.cost, nextHops: [] };
  const clone = (t: VectorTable): VectorTable =>
    Object.fromEntries(
      nodes.map((n) => [
        n,
        Object.fromEntries(
          dests.map((d) => [d, { cost: t[n][d].cost, nextHops: [...t[n][d].nextHops] }]),
        ),
      ]),
    );
  const states: { round: number; table: VectorTable }[] = [{ round: 0, table: clone(current) }],
    updates: VectorUpdate[] = [];
  for (let round = 1; round <= rounds; round++) {
    const previous = clone(current),
      next = clone(current);
    for (const router of order)
      for (const destination of dests) {
        if (router === destination) continue;
        const source = input.mode === 'synchronous' ? previous : next;
        const candidates = Object.entries(adjacency[router]).map(([via, link]) => ({
          via,
          link,
          advertised: source[via][destination].cost,
          total: link + source[via][destination].cost,
        }));
        const before = previous[router][destination].cost;
        const best = Math.min(before, ...candidates.map((c) => c.total));
        const local = attachments.some(
          (a) => a.router === router && a.destination === destination && a.cost === best,
        );
        const nextHops =
          Number.isFinite(best) && !local
            ? [
                ...new Set([
                  ...(best === before ? previous[router][destination].nextHops : []),
                  ...candidates.filter((c) => c.total === best).map((c) => c.via),
                ]),
              ].sort()
            : [];
        next[router][destination] = { cost: best, nextHops };
        updates.push({ round, router, destination, before, after: best, nextHops, candidates });
      }
    current = next;
    states.push({ round, table: clone(current) });
  }
  const converged = nodes.every((n) =>
    dests.every((d) =>
      Object.entries(adjacency[n]).every(
        ([neighbor, cost]) => cost + current[neighbor][d].cost >= current[n][d].cost,
      ),
    ),
  );
  return {
    nodes,
    destinations: dests,
    links,
    attachments,
    mode: input.mode,
    order,
    rounds,
    states,
    updates,
    converged,
  };
}
