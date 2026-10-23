import { describe, it, expect } from 'vitest';
import { portHireCrew, portDismissCrew } from '../noyau/portFlow';
import { weeklyCrewWageBrass } from '../engine/crewMorale';
import { fromBrass, toBrass } from '../engine/money';
import { partyMoneyTotal } from '../noyau/bourseFlow';
import { ensureBourse, bourseInstanceOf } from '../engine/bourse';
import type { Combatant } from '../engine/types';
import type { CampaignVessel } from '../noyau/etat';
import type { Get, Set } from '../noyau/flowTypes';
import { idNeufDeBanc } from '../lib/entityId.testkit';

/**
 * RECRUTEMENT à quai (#228, escale-hub) — embauche/débarquement salariés (MDG 14 l.293-302).
 * Le moteur NE DÉBITE PAS à l'embauche (aucune avance dans le modèle #216 : la solde se prélève à
 * l'entretien hebdomadaire) — la bourse ne bouge donc jamais ici ; seule la solde hebdomadaire recalcule.
 */
function mkStore(vessel: CampaignVessel | null) {
  const hero = ensureBourse({ id: 'h1', label: 'h1', items: [] } as unknown as Combatant, idNeufDeBanc);
  bourseInstanceOf(hero)!.money = fromBrass(100000);
  let state = { vessel, party: [hero], journal: [] as string[] };
  const log = (msg: string | string[]) => {
    state = { ...state, journal: [...state.journal.slice(-40), ...(Array.isArray(msg) ? msg : [msg])] };
  };
  const get = (() => ({ ...state, log })) as unknown as Get;
  const set = ((patch: Partial<typeof state>) => { state = { ...state, ...patch }; }) as unknown as Set;
  return { get, set, read: () => state };
}

const baseVessel = (crew?: CampaignVessel['crew']): CampaignVessel => ({
  vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, ...(crew ? { crew } : {}),
});

describe('portHireCrew / portDismissCrew (#228)', () => {
  it('embauche → crew+1, solde hebdomadaire recalculée, bourse INTACTE (aucune avance)', () => {
    const { get, set, read } = mkStore(baseVessel());
    const before = toBrass(partyMoneyTotal(get));
    portHireCrew(get, set, 'timonier', 1);
    const v = read().vessel!;
    expect(v.crew).toEqual([{ roleId: 'timonier', count: 1 }]);
    // Timonier : 3 CO 12 PA/semaine = 3×240 + 12×12 = 864 sous de cuivre (crew-roles.json).
    expect(weeklyCrewWageBrass(v.crew)).toBe(864);
    expect(toBrass(partyMoneyTotal(get))).toBe(before); // le moteur ne débite qu'à la paie
    expect(read().journal.length).toBeGreaterThan(0);
  });

  it('deux embauches du même rôle → FUSION du compte', () => {
    const { get, set, read } = mkStore(baseVessel());
    portHireCrew(get, set, 'mousse', 2);
    portHireCrew(get, set, 'mousse', 1);
    expect(read().vessel!.crew).toEqual([{ roleId: 'mousse', count: 3 }]);
  });

  it('rôles distincts → entrées distinctes ; solde = somme des barèmes', () => {
    const { get, set, read } = mkStore(baseVessel());
    portHireCrew(get, set, 'timonier', 1);
    portHireCrew(get, set, 'mousse', 1);
    const v = read().vessel!;
    expect(v.crew).toEqual([{ roleId: 'timonier', count: 1 }, { roleId: 'mousse', count: 1 }]);
    // Mousse : 1 CO 4 PA = 240 + 48 = 288 ; total 864 + 288 = 1152.
    expect(weeklyCrewWageBrass(v.crew)).toBe(1152);
  });

  it('débarquement décrémente puis SUPPRIME le poste à 0', () => {
    const { get, set, read } = mkStore(baseVessel([{ roleId: 'timonier', count: 2 }]));
    portDismissCrew(get, set, 'timonier', 1);
    expect(read().vessel!.crew).toEqual([{ roleId: 'timonier', count: 1 }]);
    portDismissCrew(get, set, 'timonier', 1);
    expect(read().vessel!.crew).toEqual([]);
  });

  it('rôle inconnu / count ≤ 0 → no-op (aucune mutation)', () => {
    const { get, set, read } = mkStore(baseVessel());
    portHireCrew(get, set, 'role-fantome', 1);
    portHireCrew(get, set, 'timonier', 0);
    portDismissCrew(get, set, 'timonier', 1); // rien à débarquer
    expect(read().vessel!.crew).toBeUndefined();
  });
});
