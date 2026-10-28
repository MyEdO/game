/**
 * L'HORLOGE VIRTUELLE (#2928, #3058, `horlogeVirtuelle.ts`) : ses gestes d'avance rendent, sur des suites tirées à graine
 * fixe de gestes et d'armements, la trace des minuteurs factices de Vitest (`vi.useFakeTimers`) ; `vider`, la reprise
 * d'un hôte, garde l'ordre de l'horloge des hôtes (échéance puis arrivée, sans milliseconde pour un délai nul armé
 * pendant la reprise), figé sur des cas témoins.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { horlogeVirtuelle } from './horlogeVirtuelle';

/** Un jeton à planifier : son nom, son délai, et ceux que sa reprise programme. */
type Plan = { nom: string; delai: number; suites: Plan[] };
type Geste = { k: 'avancer'; ms: number } | { k: 'enAttente' } | { k: 'prochaine' } | { k: 'abandonner' } | { k: 'armer'; plans: Plan[] };

/** Le tirage congruentiel d'une graine fixe. */
function tirage(graine: number) {
  let g = graine;
  return (n: number) => ((g = (g * 1103515245 + 12345) % 2147483648) % n);
}

/** Un cas tiré : les jetons armés au départ et la suite de gestes. */
function cas(alea: (n: number) => number, c: number): { plans: Plan[]; gestes: Geste[] } {
  const arbre = (prof: number, pre: string): Plan[] => Array.from({ length: alea(3) + (prof ? 0 : 1) }, (_, i) => ({
    nom: `${pre}${i}`, delai: [0, 0, 1, 2, 5, 10][alea(6)], suites: prof < 3 ? arbre(prof + 1, `${pre}${i}.`) : [],
  }));
  const plans = arbre(0, `${c}-`);
  const gestes = Array.from({ length: 1 + alea(5) }, (_, i): Geste => {
    const r = alea(5);
    if (r === 0) return { k: 'avancer', ms: [0, 1, 2, 3, 7, 50][alea(6)] };
    if (r === 1) return { k: 'enAttente' };
    if (r === 2) return { k: 'prochaine' };
    if (r === 3) return alea(3) === 0 ? { k: 'abandonner' } : { k: 'prochaine' };
    return { k: 'armer', plans: arbre(1, `${c}g${i}-`) };
  });
  return { plans, gestes };
}

/** La trace (journal et jetons en attente après chaque geste) sous les minuteurs factices de Vitest. */
function sousVitest({ plans, gestes }: { plans: Plan[]; gestes: Geste[] }): string[] {
  vi.useFakeTimers();
  const journal: string[] = [];
  const poser = (q: Plan) => setTimeout(() => { journal.push(q.nom); q.suites.forEach(poser); }, q.delai);
  plans.forEach(poser);
  return gestes.map((g) => {
    if (g.k === 'avancer') vi.advanceTimersByTime(g.ms);
    else if (g.k === 'enAttente') vi.runOnlyPendingTimers();
    else if (g.k === 'prochaine') vi.advanceTimersToNextTimer();
    else if (g.k === 'abandonner') vi.clearAllTimers();
    else g.plans.forEach(poser);
    return `${journal.join(',')}#${vi.getTimerCount()}`;
  });
}

/** Les jetons numérotés d'un journal, et la reprise qui inscrit un nom et programme ses suites. */
function numeroteur(journal: string[]) {
  const suites = new Map<number, Plan>();
  let n = 0;
  const programmer = (ps: Plan[]) => ps.map((q) => { const id = n++; suites.set(id, q); return { id, delai: q.delai }; });
  const reprendre = (id: number) => { const q = suites.get(id)!; journal.push(q.nom); return programmer(q.suites); };
  return { programmer, reprendre };
}

/** La même trace sous l'horloge virtuelle. */
function sousLHorloge({ plans, gestes }: { plans: Plan[]; gestes: Geste[] }): string[] {
  const journal: string[] = [];
  const { programmer, reprendre } = numeroteur(journal);
  const h = horlogeVirtuelle(reprendre, programmer(plans));
  return gestes.map((g) => {
    if (g.k === 'avancer') h.avancer(g.ms);
    else if (g.k === 'enAttente') h.reprendreLesEnAttente();
    else if (g.k === 'prochaine') h.jusquALaProchaine();
    else if (g.k === 'abandonner') h.abandonner();
    else h.armer(programmer(g.plans));
    return `${journal.join(',')}#${h.enAttente()}`;
  });
}

describe('horloge virtuelle', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('ses gestes d’avance et d’abandon rendent la trace des minuteurs factices de Vitest (500 cas, graine 11)', () => {
    const alea = tirage(11);
    const ecarts: string[] = [];
    for (let c = 0; c < 500; c++) {
      const tire = cas(alea, c);
      const [horloge, vitest] = [sousLHorloge(tire), sousVitest(tire)];
      vi.useRealTimers();
      if (horloge.join(' | ') !== vitest.join(' | ')) ecarts.push(`${c} ${tire.gestes.map((g) => g.k).join(',')}\n  horloge : ${horloge.join(' | ')}\n  vitest  : ${vitest.join(' | ')}`);
    }
    expect(ecarts.slice(0, 3), `${ecarts.length} écart(s)`).toEqual([]);
  });

  it('`vider` reprend par échéance puis arrivée, un délai nul armé pendant la reprise sans milliseconde de plus', () => {
    type Temoin = [string, number, Temoin[]?];
    const CAS: [nom: string, plans: Temoin[], reprises: number, journal: string[]][] = [
      ['délai nul programmé par une reprise, avant un jeton à 1 ms', [['A', 0, [['X', 0]]], ['B', 1]], 3, ['A', 'X', 'B']],
      ['ex æquo : ordre d’arrivée', [['B', 5], ['A', 5], ['C', 0]], 3, ['C', 'B', 'A']],
      ['suite plus tôt qu’un jeton présent', [['A', 10, [['X', 5]]], ['B', 20]], 3, ['A', 'X', 'B']],
      ['chaîne à délai nul', [['T', 0, [['T1', 0, [['T2', 0]]]]]], 3, ['T', 'T1', 'T2']],
      ['arbre', [['a', 100, [['a1', 50], ['a2', 200]]], ['b', 150], ['c', 300, [['c1', 0], ['c2', 0, [['c3', 1]]]]]], 8, ['a', 'b', 'a1', 'c', 'a2', 'c1', 'c2', 'c3']],
    ];
    const plan = ([nom, delai, suites = []]: Temoin): Plan => ({ nom, delai, suites: suites.map(plan) });
    for (const [nom, temoins, reprises, attendu] of CAS) {
      const journal: string[] = [];
      const { programmer, reprendre } = numeroteur(journal);
      expect([horlogeVirtuelle(reprendre, programmer(temoins.map(plan))).vider(), journal], nom).toEqual([reprises, attendu]);
    }
  });
});
