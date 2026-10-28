import { describe, it, expect } from 'vitest';
import { psychDRAdjust } from './combat';
import { refreshDefendedPsych } from './psychology';
import type { Combatant } from './types';

function mk(opts: Partial<Combatant>): Combatant {
  return {
    id: 'c', label: 'c', kind: 'enemy', advantage: 0, conditions: [],
    characteristics: {} as never, size: 'moyenne', psychState: [], groups: [],
    weapons: [], armour: {} as never, skills: [], talents: [], movement: 4,
    wounds: { current: 10, max: 10 }, ...opts,
  } as Combatant;
}

/**
 * Modificateur de DR psychologique (LDB 21) — RAW en DEGRÉ DE RÉUSSITE (±1 DR), PAS en valeur cible
 * (l'ancien ±10 sur la cible faussait probabilité ET DR). `psychDRAdjust` est ajouté à `atkSL` à la
 * résolution d'attaque (cf. combineOpposed/resolveMeleePassive/tir non opposé).
 */
describe('psychDRAdjust — Traits psy modulent le DR de l’attaque (LDB 21)', () => {
  it('Animosité active vs un membre du groupe Cible → +1 DR', () => {
    const att = mk({ psychState: [{ type: 'animosite', cible: 'elfe', active: true }] });
    const tgt = mk({ id: 't', groups: ['elfe', 'soldat'] });
    expect(psychDRAdjust(att, tgt)).toBe(1);
  });

  it('Animosité active vs un NON-membre → aucun bonus', () => {
    const att = mk({ psychState: [{ type: 'animosite', cible: 'elfe', active: true }] });
    expect(psychDRAdjust(att, mk({ id: 't', groups: ['humain'] }))).toBe(0);
  });

  it('Animosité INACTIVE (résistée) → aucun bonus', () => {
    const att = mk({ psychState: [{ type: 'animosite', cible: 'elfe', active: false }] });
    expect(psychDRAdjust(att, mk({ id: 't', groups: ['elfe'] }))).toBe(0);
  });

  it('Haine active vs le groupe haï → immunité à la Peur de cette source (pas de −1) + bonus → +1 DR net', () => {
    const tgt = mk({ id: 't', groups: ['skaven'] });
    const att = mk({
      psychState: [
        { type: 'peur', sourceId: 't', indice: 2, calmeDR: 0 },
        { type: 'haine', cible: 'skaven', active: true },
      ],
    });
    expect(psychDRAdjust(att, tgt)).toBe(1); // Peur annulée par Haine (l.41), +1 DR du groupe haï
  });

  it('Peur sans immunité → −1 DR', () => {
    const att = mk({ psychState: [{ type: 'peur', sourceId: 't', indice: 2, calmeDR: 0 }] });
    expect(psychDRAdjust(att, mk({ id: 't', groups: [] }))).toBe(-1);
  });

  it('Peur SURMONTÉE → aucun malus', () => {
    const att = mk({ psychState: [{ type: 'peur', sourceId: 't', indice: 2, calmeDR: 2, surmontee: true }] });
    expect(psychDRAdjust(att, mk({ id: 't', groups: [] }))).toBe(0);
  });

  /** LDB 21 l.75 : « Vous êtes immunisé à la Peur […] tant que vous défendez les êtres aimés » — la
   *  condition tient à la PRÉSENCE de l'aimé, portée par `active` (`refreshDefendedPsych`), de sorte que
   *  les 3 résolutions d'attaque — qui n'ont AUCUN roster en portée — lisent le verdict sans le recalculer. */
  it('Amour actif, l’aimé PRÉSENT → immunité Peur + +1 DR (on le défend) → +1 DR net', () => {
    const tgt = mk({ id: 't', groups: [] });
    const aime = mk({ id: 'a', groups: ['Famille'] });
    const att = mk({
      psychState: [
        { type: 'peur', sourceId: 't', indice: 2, calmeDR: 0 },
        { type: 'amour', cible: 'Famille', active: true },
      ],
    });
    refreshDefendedPsych(att, [att, aime]); // le détenteur du roster pose le verdict de présence
    expect(psychDRAdjust(att, tgt)).toBe(1); // Peur annulée par Amour, +1 DR défense
  });

  it('Amour actif mais AUCUN aimé présent → l’immunité s’éteint, la Peur mord seule : −1', () => {
    const tgt = mk({ id: 't', groups: [] });
    const att = mk({
      psychState: [
        { type: 'peur', sourceId: 't', indice: 2, calmeDR: 0 },
        { type: 'amour', cible: 'Famille', active: true },
      ],
    });
    refreshDefendedPsych(att, [att]); // aucun aimé : l’immunité s’éteint
    expect(psychDRAdjust(att, tgt)).toBe(-1);
  });
});
