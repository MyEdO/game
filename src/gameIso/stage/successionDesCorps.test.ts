/**
 * Succession des corps (#1396, #2097, design n°11) : I1 à I5 (`successionDesCorps.ts`) tenus après
 * CHAQUE évènement — passe (`memeBase` vrai et faux), montage, rejet — sur TOUS les états atteignables
 * en cinq évènements depuis l'écran vide : trois combattants, chacun seul ou en couple sur toutes les
 * paires ordonnées, deux dessins chacun. Le figurant dont l'id brut collisionne avec un combattant est
 * bancé à part. Plus les cas nommés des juges.
 */
import { describe, expect, it } from 'vitest';
import { occupantsDe, succession, type SujetDeSuccession } from './successionDesCorps';

interface BoardDeBanc {
  sub: SujetDeSuccession;
  visible: boolean;
  sursis: boolean;
}
interface Etat {
  boards: BoardDeBanc[];
  voulus: SujetDeSuccession[];
  attente: SujetDeSuccession[];
}
type Evenement =
  | { type: 'passe'; voulus: SujetDeSuccession[]; memeBase: boolean }
  | { type: 'monter'; sujet: SujetDeSuccession }
  | { type: 'rejeter'; sujet: SujetDeSuccession };

const seul = (cid: string, dessin: string): SujetDeSuccession => ({ identity: `acteur:${cid}|${dessin}`, cid });
const couple = (monture: string, cavalier: string, dessin: string): SujetDeSuccession => ({ identity: `acteur:${monture}+${cavalier}|${dessin}`, cid: monture, cavalier });
const figurant = (eid: string, dessin: string): SujetDeSuccession => ({ identity: `entite:${eid}|${dessin}`, eid });

const VIDE: Etat = { boards: [], voulus: [], attente: [] };
const DESSINS = ['A', 'B'];

function appliquer(e: Etat, ev: Evenement): Etat {
  const voulus = ev.type === 'passe' ? ev.voulus : e.voulus;
  const memeBase = ev.type === 'passe' ? ev.memeBase : true;
  const avant = e.boards.map((b) => ({ sub: b.sub, visible: b.visible }));
  if (ev.type === 'monter') avant.push({ sub: ev.sujet, visible: false });
  const attente =
    ev.type === 'passe'
      ? voulus.filter((s) => !(memeBase && e.boards.some((b) => b.sub.identity === s.identity)))
      : e.attente.filter((s) => s.identity !== ev.sujet.identity);
  const parIdentité = new Map(voulus.map((s) => [s.identity, s]));
  const r = succession({ boards: avant, voulus: parIdentité, attente, memeBase, configurationPrécédente: new Set(avant.filter((b) => b.visible)) });
  const libérés = new Set(r.libérés);
  const boards = avant
    .filter((b) => !libérés.has(b))
    .map((b) => ({ sub: parIdentité.get(b.sub.identity) ?? b.sub, visible: r.visibles.has(b), sursis: r.sursis.has(b) }));
  return { boards, voulus, attente };
}

const montrés = (e: Etat, occ: string): number => e.boards.filter((b) => b.visible && occupantsDe(b.sub).includes(occ)).length;

/** Composantes de l'oracle, recalculées ici : liens par entrant, par board visible avant, par attente. */
function composantes(avant: Etat, après: Etat): (occ: string) => string {
  const voisins = new Map<string, Set<string>>();
  const lier = (occ: string[]): void => {
    for (const a of occ) for (const b of occ) {
      if (!voisins.has(a)) voisins.set(a, new Set());
      voisins.get(a)!.add(b);
    }
  };
  const voulues = new Set(après.voulus.map((s) => s.identity));
  for (const b of après.boards) if (voulues.has(b.sub.identity)) lier(occupantsDe(b.sub));
  for (const b of avant.boards) if (b.visible) lier(occupantsDe(b.sub));
  for (const s of après.attente) lier(occupantsDe(s));
  const rep = new Map<string, string>();
  for (const départ of voisins.keys()) {
    const pile = [départ];
    while (pile.length) {
      const o = pile.pop()!;
      if (rep.has(o)) continue;
      rep.set(o, départ);
      for (const v of voisins.get(o) ?? []) pile.push(v);
    }
  }
  return (occ) => rep.get(occ) ?? occ;
}

/** I1 à I5 après l'évènement `ev` mené de `avant` à `après` — rend la liste des violations. */
function violations(avant: Etat, ev: Evenement, après: Etat, occupants: readonly string[]): string[] {
  const v: string[] = [];
  for (const o of occupants) if (montrés(après, o) > 1) v.push(`I1 ${o}`);
  const voulues = new Set(après.voulus.map((s) => s.identity));
  const entrants = après.boards.filter((b) => voulues.has(b.sub.identity));
  // `montrables` exclut les rejetés (#2097).
  const montrables = new Set([...entrants.map((b) => b.sub), ...après.attente].flatMap(occupantsDe));
  if (!(ev.type === 'passe' && !ev.memeBase))
    for (const o of occupants) if (montrables.has(o) && montrés(avant, o) > 0 && montrés(après, o) === 0) v.push(`I2 ${o}`);
  if (après.attente.length === 0 && (après.boards.some((b) => b.sursis || !b.visible) || entrants.length !== après.boards.length)) v.push('I3');
  const K = composantes(avant, après);
  const attend = new Set(après.attente.flatMap(occupantsDe).map(K));
  const précédents = new Set(avant.boards.filter((b) => b.visible).map((b) => b.sub.identity));
  for (const b of après.boards) {
    if (!b.sursis) continue;
    const occ = occupantsDe(b.sub);
    if (!précédents.has(b.sub.identity) || !occ.some((o) => attend.has(K(o))) || !occ.some((o) => montrables.has(o))) v.push(`I4 ${b.sub.identity}`);
  }
  for (const b of entrants) if (!b.visible && !occupantsDe(b.sub).some((o) => attend.has(K(o)))) v.push(`I5 ${b.sub.identity}`);
  return v;
}

/** Deux boards à flipbook (sujets SEULS : un couple n'en joue pas) sur un même occupant. */
function deuxFlipbooks(e: Etat): boolean {
  const seuls = e.boards.filter((b) => b.sub.cavalier === undefined);
  return seuls.some((a, i) => seuls.some((b, j) => j !== i && occupantsDe(a.sub).some((o) => occupantsDe(b.sub).includes(o))));
}

const cle = (e: Etat): string =>
  JSON.stringify([
    e.boards.map((b) => `${b.sub.identity}:${b.visible ? 'v' : '-'}${b.sursis ? 'S' : ''}`).sort(),
    e.voulus.map((s) => s.identity).sort(),
    e.attente.map((s) => s.identity).sort(),
  ]);
const nomEv = (ev: Evenement): string =>
  ev.type === 'passe' ? `passe[${ev.voulus.map((s) => s.identity).join(',')}]${ev.memeBase ? '' : '(base)'}` : `${ev.type}(${ev.sujet.identity})`;

function banc(configurations: SujetDeSuccession[][], occupants: readonly string[], profondeur: number) {
  const evenements = (e: Etat): Evenement[] => [
    ...configurations.flatMap((voulus) => [true, false].map((memeBase): Evenement => ({ type: 'passe', voulus, memeBase }))),
    ...e.attente.map((sujet): Evenement => ({ type: 'monter', sujet })),
    ...e.attente.map((sujet): Evenement => ({ type: 'rejeter', sujet })),
  ];
  const vus = new Map<string, { etat: Etat; chemin: string[] }>([[cle(VIDE), { etat: VIDE, chemin: [] }]]);
  let front = [...vus.values()];
  const fautes: string[] = [];
  let transitions = 0;
  let rejets = 0;
  for (let p = 0; p < profondeur; p++) {
    const suivant: { etat: Etat; chemin: string[] }[] = [];
    for (const { etat, chemin } of front) {
      for (const ev of evenements(etat)) {
        transitions += 1;
        if (ev.type === 'rejeter') rejets += 1;
        const après = appliquer(etat, ev);
        const f = violations(etat, ev, après, occupants);
        if (f.length && fautes.length < 5) fautes.push(`${[...chemin, nomEv(ev)].join(' → ')} : ${f.join(', ')}`);
        const k = cle(après);
        if (!vus.has(k)) {
          const n = { etat: après, chemin: [...chemin, nomEv(ev)] };
          vus.set(k, n);
          suivant.push(n);
        }
      }
    }
    front = suivant;
  }
  const étatsÀDeuxFlipbooks = [...vus.values()].filter(({ etat }) => deuxFlipbooks(etat)).length;
  return { états: vus.size, transitions, fautes, rejets, étatsÀDeuxFlipbooks };
}

const COMBATTANTS = ['m', 'r', 'x'];
/** Configurations voulues VALIDES : chaque combattant couvert par au plus un sujet voulu. */
const CONFIGURATIONS: SujetDeSuccession[][] = (() => {
  const options = (c: string): (SujetDeSuccession | null)[] => [null, ...DESSINS.map((d) => seul(c, d))];
  const out: SujetDeSuccession[][] = [];
  for (const a of options('m')) for (const b of options('r')) for (const c of options('x')) out.push([a, b, c].filter((s): s is SujetDeSuccession => s !== null));
  for (const mo of COMBATTANTS) for (const ca of COMBATTANTS) {
    if (mo === ca) continue;
    const tiers = COMBATTANTS.find((z) => z !== mo && z !== ca)!;
    for (const d of DESSINS) for (const o of options(tiers)) out.push([couple(mo, ca, d), ...(o ? [o] : [])]);
  }
  return out;
})();

describe('succession des corps — banc EXHAUSTIF à profondeur 5', () => {
  it('trois combattants {c:m, c:r, c:x}, seuls et couples sur toutes les paires ordonnées : I1 à I5 à chaque évènement', () => {
    const r = banc(CONFIGURATIONS, ['c:m', 'c:r', 'c:x'], 5);
    console.log(`succession (combattants) : profondeur 5, ${CONFIGURATIONS.length} configurations, ${r.états} états, ${r.transitions} transitions, rejets ${r.rejets}, états à deux flipbooks ${r.étatsÀDeuxFlipbooks}`);
    expect(r.états, 'PRÉMISSE : le banc parcourt des états').toBeGreaterThan(1000);
    expect(r.rejets, 'PRÉMISSE : le banc passe par des rejets').toBeGreaterThan(0);
    expect(r.fautes).toEqual([]);
    // #2158
    expect(r.étatsÀDeuxFlipbooks).toBe(0);
  }, 180_000);

  it('témoins de l’oracle I2 : une perte de corps est une faute, sauf quand le sujet voulu est rejeté', () => {
    const mA = seul('m', 'A');
    const mB = seul('m', 'B');
    const avant: Etat = { boards: [{ sub: mA, visible: true, sursis: false }], voulus: [mA], attente: [] };
    const perdu: Etat = { boards: [], voulus: [mB], attente: [mB] };
    expect(violations(avant, { type: 'passe', voulus: [mB], memeBase: true }, perdu, ['c:m'])).toContain('I2 c:m');
    const rejeté: Etat = { boards: [], voulus: [mB], attente: [] };
    expect(violations(avant, { type: 'rejeter', sujet: mB }, rejeté, ['c:m'])).toEqual([]);
  });

  it('figurant `e:m` et combattant `c:m` de MÊME id brut : deux occupants distincts', () => {
    const options = (f: (d: string) => SujetDeSuccession): (SujetDeSuccession | null)[] => [null, ...DESSINS.map(f)];
    const configurations = options((d) => seul('m', d)).flatMap((a) => options((d) => figurant('m', d)).map((b) => [a, b].filter((s): s is SujetDeSuccession => s !== null)));
    const r = banc(configurations, ['c:m', 'e:m'], 5);
    console.log(`succession (figurant) : profondeur 5, ${configurations.length} configurations, ${r.états} états, ${r.transitions} transitions, rejets ${r.rejets}, états à deux flipbooks ${r.étatsÀDeuxFlipbooks}`);
    expect(r.états).toBeGreaterThan(50);
    expect(r.fautes).toEqual([]);
  });
});

describe('succession des corps — cas nommés des juges', () => {
  const passe = (voulus: SujetDeSuccession[], memeBase = true): Evenement => ({ type: 'passe', voulus, memeBase });
  const monter = (sujet: SujetDeSuccession): Evenement => ({ type: 'monter', sujet });
  const rejeter = (sujet: SujetDeSuccession): Evenement => ({ type: 'rejeter', sujet });
  const OCC = ['c:m', 'c:r', 'c:x', 'c:y', 'c:k', 'e:k'];
  function jouer(evs: Evenement[]): { etat: Etat; fautes: string[] } {
    let etat = VIDE;
    const fautes: string[] = [];
    for (const ev of evs) {
      const après = appliquer(etat, ev);
      fautes.push(...violations(etat, ev, après, OCC).map((f) => `${nomEv(ev)} : ${f}`));
      etat = après;
    }
    return { etat, fautes };
  }
  const écran = (e: Etat): string[] => e.boards.filter((b) => b.visible).map((b) => b.sub.identity).sort();
  const mr = couple('m', 'r', 'A');
  const couple0 = [passe([mr]), monter(mr)];

  it('CAS 1 : monture retirée, cavalier seul voulu — le couple tient jusqu’au montage du cavalier', () => {
    const { etat, fautes } = jouer([...couple0, passe([seul('r', 'A')]), monter(seul('r', 'A'))]);
    expect(fautes).toEqual([]);
    expect(écran(etat)).toEqual(['acteur:r|A']);
    expect(etat.boards).toHaveLength(1);
  });

  it('CAS 2 : cavalier retiré, monture seule voulue — le couple tient jusqu’au montage de la monture', () => {
    const { etat, fautes } = jouer([...couple0, passe([seul('m', 'A')]), monter(seul('m', 'A'))]);
    expect(fautes).toEqual([]);
    expect(écran(etat)).toEqual(['acteur:m|A']);
  });

  it('CAS 4 : descente, r monté, r change de dessin avant m, puis m rejeté — r reste visible', () => {
    const { etat, fautes } = jouer([...couple0, passe([seul('m', 'A'), seul('r', 'A')]), monter(seul('r', 'A')), passe([seul('m', 'A'), seul('r', 'B')]), rejeter(seul('m', 'A'))]);
    expect(fautes).toEqual([]);
    expect(montrés(etat, 'c:r')).toBe(1);
  });

  it('S1 : r quitte m pour x en une passe — m, r et x restent visibles jusqu’à la fin de la succession', () => {
    const x = seul('x', 'A');
    const xr = couple('x', 'r', 'A');
    const m = seul('m', 'A');
    const { etat, fautes } = jouer([passe([mr, x]), monter(mr), monter(x), passe([xr, m]), monter(xr)]);
    expect(fautes).toEqual([]);
    expect(['c:m', 'c:r', 'c:x'].map((o) => montrés(etat, o))).toEqual([1, 1, 1]);
    expect(écran(etat)).toEqual([mr.identity, x.identity].sort());
    const fin = jouer([passe([mr, x]), monter(mr), monter(x), passe([xr, m]), monter(xr), monter(m)]);
    expect(écran(fin.etat)).toEqual([m.identity, xr.identity].sort());
  });

  it('S2 : deux couples échangent leurs cavaliers — les quatre êtres restent visibles', () => {
    const xy = couple('x', 'y', 'A');
    const my = couple('m', 'y', 'A');
    const xr = couple('x', 'r', 'A');
    const { etat, fautes } = jouer([passe([mr, xy]), monter(mr), monter(xy), passe([my, xr]), monter(my)]);
    expect(fautes).toEqual([]);
    expect(['c:m', 'c:r', 'c:x', 'c:y'].map((o) => montrés(etat, o))).toEqual([1, 1, 1, 1]);
  });

  it('S3 : figurant `e:k` et combattant `c:k` — les deux se montrent', () => {
    const { etat, fautes } = jouer([passe([seul('k', 'A'), figurant('k', 'A')]), monter(seul('k', 'A')), monter(figurant('k', 'A'))]);
    expect(fautes).toEqual([]);
    expect(écran(etat)).toEqual(['acteur:k|A', 'entite:k|A']);
  });

  it('S4 : mise en selle rejetée puis revoulue — la composante succède au rejet, la passe suivante réattend', () => {
    const m = seul('m', 'A');
    const r = seul('r', 'A');
    const { etat, fautes } = jouer([passe([m, r]), monter(m), monter(r), passe([mr]), rejeter(mr), passe([mr])]);
    expect(fautes).toEqual([]);
    expect(etat.boards).toEqual([]);
    expect(etat.attente.map((s) => s.identity)).toEqual([mr.identity]);
  });

  it('S5 : base changée au milieu d’une attente — tout est libéré, tout réattend', () => {
    const m = seul('m', 'A');
    const r = seul('r', 'A');
    const { etat } = jouer([...couple0, passe([m, r]), monter(r), passe([m, r], false)]);
    expect(etat.boards).toEqual([]);
    expect(etat.attente).toHaveLength(2);
  });

  it('FANTÔME : un sortant hors de la configuration précédente ne relie rien', () => {
    const mx = couple('m', 'x', 'A');
    const { etat, fautes } = jouer([...couple0, passe([mx, seul('r', 'A')]), monter(mx), passe([seul('x', 'A')])]);
    expect(fautes).toEqual([]);
    expect(etat.boards).toEqual([]);
  });

  it('I4-couvre-un-voulu : le sortant tenu couvre un occupant montrable', () => {
    const x = seul('x', 'A');
    const mx = couple('m', 'x', 'A');
    const { etat, fautes } = jouer([passe([mr, x]), monter(mr), monter(x), passe([mx, seul('r', 'A')]), monter(mx)]);
    expect(fautes).toEqual([]);
    expect(écran(etat)).toEqual([mr.identity, x.identity].sort());
    expect(etat.boards.filter((b) => b.sursis).map((b) => b.sub.identity).sort()).toEqual([mr.identity, x.identity].sort());
  });

  it('occupants : la monture et le cavalier pour un couple, l’id espacé du figurant sinon', () => {
    expect(occupantsDe(mr)).toEqual(['c:m', 'c:r']);
    expect(occupantsDe(figurant('k', 'A'))).toEqual(['e:k']);
  });
});
