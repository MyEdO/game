/**
 * Le cycle quotidien d'une maladie POSE ses États par la SOURCE UNIQUE (`addCondition`) — il ne
 * poussait ses pions à la main. Deux invariants de LDB 16 en dépendent :
 *  - l.115, verbatim : « L'État *Inconscient* ne se cumule pas – soit vous êtes *Inconscient*, soit
 *    vous ne l'êtes pas. » ;
 *  - l.7, verbatim : « Si vous subissez un État quel qu'il soit, vous perdez immédiatement tout
 *    Avantage (voir p. 164). »
 * Le chemin est le VRAI : `tickDisease` sur une phase active, conséquence `onTick.ops` sans jet.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Combatant, type UpkeepDeferTest } from './types';
import { MINUTES_PER_DAY } from './clock';
import { contractDisease, tickDisease } from './disease';
import { symptoms } from '../data';
import { setDataset } from '../data/overrides';
import { stacks, hasCondition } from './conditions';
import { gabarit } from '../gabarit.testkit';
import type { RNG } from './dice';
import { desEnSuite } from './dice.testkit';

const seq = (values: number[]): RNG => desEnSuite(values);
const ignore: UpkeepDeferTest = () => {};

const cobaye = (over: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'p', label: 'Cobaye', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 35 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [], items: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, weapons: [], diseases: [],
    ...over,
  }) as Combatant;

const SONDE = 'sonde-double-ko';
const SYMPTOMES_LIVRES = [...symptoms];
afterEach(() => { setDataset('symptoms', SYMPTOMES_LIVRES); });

describe('le cycle de maladie pose ses États par la source unique (LDB 16)', () => {
  it('un `onTick.ops` qui pose DEUX fois l’Inconscient ne rend qu’UN pion (l.115)', () => {
    // Aucun symptôme LIVRÉ ne pose d'État non cumulable par son cycle : la sonde en déclare un dans
    // l'index que le moteur interroge (`findSymptomById`), pour que le chemin joué soit le VRAI —
    // conséquence quotidienne CERTAINE (aucun `test`), posée deux fois.
    setDataset('symptoms', [...symptoms, { id: SONDE, label: 'Sonde', onTick: { ops: [{ op: 'condition', id: 'inconscient' }, { op: 'condition', id: 'inconscient' }] } } as never]);
    const c = cobaye({
      diseases: [{ id: 'dz-sonde', phase: 'active', symptoms: [{ symptomId: SONDE }], minutesLeft: 40 * MINUTES_PER_DAY, durationMinutes: 40 * MINUTES_PER_DAY }] as never,
    });
    tickDisease(c, MINUTES_PER_DAY, seq([]), ignore);
    expect(stacks(c, 'inconscient'), 'l’Inconscient s’est cumulé').toBe(1);
  });

  it('l’éclatement du Vers du Reik fait perdre TOUT l’Avantage avec l’État Sonné (l.7)', () => {
    const c = cobaye({ advantage: 3, diseases: [contractDisease('vers-du-reik', seq([]), { incubation: 0 })!] });
    for (let d = 0; d < 6; d++) tickDisease(c, MINUTES_PER_DAY, seq([]), ignore);
    expect(c.advantage, 'l’Avantage a été perdu avant l’État').toBe(3);
    tickDisease(c, MINUTES_PER_DAY, seq([]), ignore); // 7ᵉ jour actif → la cloque éclate, État Sonné
    expect(stacks(c, 'sonne')).toBe(1);
    expect(c.advantage, 'l’Avantage a survécu au gain d’État').toBe(0);
  });
});

/** Porteur du Vers du Reik au 6ᵉ jour actif, `pb` PB et 2 Hémorragique : la cloque éclate au prochain jour. */
function versDuReikALaVeille(pb: number): Combatant {
  const c = cobaye({ wounds: { current: pb, max: 12 }, conditions: [{ id: 'hemorragique', value: 2 }], diseases: [contractDisease('vers-du-reik', seq([]), { incubation: 0 })!] });
  for (let d = 0; d < 6; d++) tickDisease(c, MINUTES_PER_DAY, seq([]), ignore);
  return c;
}

describe('l’éclatement du Vers du Reik retire ses PB par la perte centralisée (LDB 16 l.105 ; MSRC 16 l.142)', () => {
  it('à 1 PB, porteur de 2 Hémorragique : 0 PB, Inconscient et À Terre', () => {
    const c = versDuReikALaVeille(1);
    const log = tickDisease(c, MINUTES_PER_DAY, seq([]), ignore);
    expect(c.wounds.current).toBe(0);
    expect(hasCondition(c, 'inconscient'), 'LDB 16 l.105 : Inconscient à 0 PB').toBe(true);
    expect(hasCondition(c, 'a-terre'), 'LDB 18 l.15 : À Terre à 0 PB').toBe(true);
    expect(log.filter((l) => gabarit('op.wounds').test(l))).toEqual(['Cobaye subit 1 Blessure(s) (ignorant BE et PA).']);
  });

  it('à 0 PB : aucune Blessure au journal', () => {
    const c = versDuReikALaVeille(0);
    const log = tickDisease(c, MINUTES_PER_DAY, seq([]), ignore);
    expect(stacks(c, 'sonne'), 'témoin : la cloque a bien éclaté').toBe(1);
    expect(log.filter((l) => gabarit('op.wounds').test(l))).toEqual([]);
  });
});
