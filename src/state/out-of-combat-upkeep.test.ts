import { describe, it, expect } from 'vitest';
import { outOfCombatUpkeep } from './outOfCombatUpkeep';
import { hasCondition } from '../engine/conditions';
import { applyStopBleed } from '../engine/healing';
import type { Combatant } from '../engine/types';
import type { RNG } from '../engine/dice';

/**
 * COMPTEUR de TOURS DE BOUCLE : l'entretien est SILENCIEUX pour un porteur sans péril (ni journal, ni
 * mutation d'état), donc « la boucle a tourné » ne se lit qu'au nombre de LECTURES de ses effets
 * actifs — `outOfCombatUpkeep` en lit un par Round. Sonde par accesseur sur le combattant lui-même
 * (le graphe de modules est PARTAGÉ, `isolate: false` : aucun mock de module ici, cf.
 * `src/vi-mock-isolate-guard.test.ts`).
 */
function espionneEffets(c: Combatant, effets: unknown[]): { lectures: number } {
  const sonde = { lectures: 0 };
  let valeur = effets;
  Object.defineProperty(c, 'activeEffects', {
    configurable: true,
    get() { sonde.lectures += 1; return valeur; },
    set(v) { valeur = v; },
  });
  return sonde;
}

const fixed = (v: number): RNG => ({ int: () => v });

function mk(opts: { current?: number; conditions?: { id: string; value: number }[]; fate?: number; advantage?: number }): Combatant {
  return {
    name: 'X', kind: 'hero',
    wounds: { current: opts.current ?? 10, max: 10 },
    advantage: opts.advantage ?? 0,
    conditions: opts.conditions ?? [],
    skills: [], // requis par le Test de Résistance d'Empoisonné, désormais résolu INLINE hors combat (RAW l.66-72)
    armour: { tete: 0, corps: 0, brasG: 0, brasD: 0, jambeG: 0, jambeD: 0 },
    characteristics: { endurance: 30 } as Combatant['characteristics'],
    fate: opts.fate ?? 0,
  } as unknown as Combatant;
}

describe('outOfCombatUpkeep — États qui tickent HORS COMBAT (couture A, LDB 13 l.49-50)', () => {
  it('Empoisonné : perte de PB chaque Round écoulé (et perte d’Avantage via loseWounds)', () => {
    const c = mk({ current: 8, advantage: 2, conditions: [{ id: 'empoisonne', value: 1 }] });
    outOfCombatUpkeep([c], 3, fixed(50)); // 3 Rounds ; jet 50 = pas de mort par hémorragie
    expect(c.wounds.current).toBe(5); // 8 − 3×1
    expect(c.advantage).toBe(0); // perdre des PB → perte de tout l'Avantage (LDB 14 l.219)
  });

  it('Empoisonné : le Test de Résistance se résout AUSSI hors combat (RAW l.66-72) — succès → poison retiré + Exténué', () => {
    const c = mk({ current: 8, conditions: [{ id: 'empoisonne', value: 1 }] });
    outOfCombatUpkeep([c], 1, fixed(5)); // jet 5 ≤ cible (E 30 −10 État = 20) → Résistance réussie
    expect(c.wounds.current).toBe(7);              // 1 dégât périodique appliqué AVANT le Test
    expect(hasCondition(c, 'empoisonne')).toBe(false); // poison vaincu (branche success : retire 1+DR)
    expect(hasCondition(c, 'extenue')).toBe(true);     // vidé → 1 Exténué
  });

  it('Inconscient ET Empoisonné : le Test de Résistance SUBI se lance toujours (LDB 16 l.74)', () => {
    const c = mk({ current: 8, conditions: [{ id: 'empoisonne', value: 1 }, { id: 'inconscient', value: 1 }] });
    outOfCombatUpkeep([c], 1, fixed(5));
    expect(hasCondition(c, 'empoisonne')).toBe(false);
    expect(hasCondition(c, 'extenue')).toBe(true);
  });

  it('aucun effet périodique ni 0 PB → no-op (rien ne ticke)', () => {
    const c = mk({ current: 8 });
    expect(outOfCombatUpkeep([c], 10, fixed(50))).toEqual([]);
    expect(c.wounds.current).toBe(8);
  });

  it('un buff en Rounds SANS RAPPORT ne déclenche PAS l’entretien du porteur en péril : même sort pour le Sonné et l’Aveuglé avec et sans buff', () => {
    const etats = () => [{ id: 'sonne', value: 2 }, { id: 'aveugle', value: 1 }];
    const sansBuff = mk({ current: 8, conditions: etats() });
    const avecBuff = mk({ current: 8, conditions: etats() });
    avecBuff.activeEffects = [{ label: 'Bénédiction', bonus: 10, char: 'capacite-de-combat', duration: { scale: 'rounds', left: 6 } }];
    const sans = outOfCombatUpkeep([sansBuff], 3, fixed(5)); // jet 5 : la Résistance PASSERAIT si le Test avait lieu
    const avec = outOfCombatUpkeep([avecBuff], 3, fixed(5));
    expect(sans).toEqual([]);
    expect(avec.filter((l) => /Sonné|Aveuglé/.test(l)), 'le buff n’ouvre aucun Test ni dissipation d’État').toEqual([]);
    for (const c of [sansBuff, avecBuff]) {
      expect(c.conditions.find((x) => x.id === 'sonne')!.value).toBe(2);
      expect(hasCondition(c, 'aveugle')).toBe(true);
      expect(c.wounds.current).toBe(8);
    }
  });

  /** Effet GELÉ en attente de prolongation (`awaitingExtension`, durée « + » `LDB 47 l.311`) : sa durée
   *  ne s'écoule plus et ses ops ne se rejouent plus — il ne doit donc PAS faire tourner la boucle. */
  it('un effet GELÉ (attente de prolongation) ne fait jouer AUCUN Round, même sur un grand saut d’horloge', () => {
    const gele = { label: 'Bénédiction', bonus: 10, char: 'capacite-de-combat', duration: { scale: 'rounds', left: 0 }, awaitingExtension: true };
    const c = mk({ current: 8 });
    const sonde = espionneEffets(c, [{ ...gele }]);
    expect(outOfCombatUpkeep([c], 480, fixed(5))).toEqual([]);
    expect(sonde.lectures, 'la boucle ne s’allume pas pour un effet qui n’avance plus — quelques lectures de\n      contrôle, jamais un tour par Round de la fenêtre').toBeLessThan(10);
    expect(c.activeEffects, 'l’effet gelé est intact').toEqual([gele]);
    // CONTRÔLE de la sonde : le MÊME effet NON gelé fait bien tourner la boucle — sans lui, la borne
    // ci-dessus serait satisfaite par une sonde qui ne mesure rien.
    const vif = mk({ current: 8 });
    const sondeVive = espionneEffets(vif, [{ ...gele, awaitingExtension: undefined, duration: { scale: 'rounds', left: 6 } }]);
    outOfCombatUpkeep([vif], 480, fixed(5));
    expect(sondeVive.lectures, 'la sonde compte bien les tours').toBeGreaterThan(sonde.lectures);
  });

  it('un effet de 6 Rounds EXPIRE hors combat (sa durée s’écoule à l’horloge) sans toucher aux États', () => {
    const c = mk({ current: 8, conditions: [{ id: 'sonne', value: 2 }] });
    c.activeEffects = [{ label: 'Bénédiction', bonus: 10, char: 'capacite-de-combat', duration: { scale: 'rounds', left: 6 } }];
    const log = outOfCombatUpkeep([c], 6, fixed(5));
    expect(c.activeEffects).toHaveLength(0);
    expect(log.filter((l) => l.includes('Bénédiction'))).toHaveLength(1);
    expect(c.conditions.find((x) => x.id === 'sonne')!.value).toBe(2);
  });

  it('tombe à 0 PB par poison → À Terre + progression d’agonie', () => {
    const c = mk({ current: 2, conditions: [{ id: 'empoisonne', value: 1 }] });
    outOfCombatUpkeep([c], 5, fixed(50));
    expect(c.wounds.current).toBe(0);
    expect(hasCondition(c, 'a-terre')).toBe(true);
  });

  it('Hémorragique mortel hors combat : un héros à Destin est sauvé (Point consommé)', () => {
    const c = mk({ current: 3, conditions: [{ id: 'hemorragique', value: 3 }], fate: 1 });
    outOfCombatUpkeep([c], 1, fixed(5)); // jet 5 (non-double) ≤ 30 → mort, sauf Destin
    expect(c.dead).toBeFalsy();
    expect(c.fate).toBe(0);
    expect(c.wounds.current).toBeGreaterThanOrEqual(1);
  });

  it('Hémorragique mortel sans Destin → mort', () => {
    const c = mk({ current: 3, conditions: [{ id: 'hemorragique', value: 3 }], fate: 0 });
    outOfCombatUpkeep([c], 1, fixed(5));
    expect(c.dead).toBe(true);
  });

  it('Premiers Secours hors combat (infirmerie, Test de Guérison réussi retire l’État, LDB 09 l.261 / LDB 16 l.107-109) évite la mort SANS consommer de Destin', () => {
    const c = mk({ current: 3, conditions: [{ id: 'hemorragique', value: 3 }], fate: 0 });
    applyStopBleed(c, 2); // panse : Test de Guérison réussi, DR 2 → retire 1+2 = 3 pions (tous)
    expect(hasCondition(c, 'hemorragique')).toBe(false);
    outOfCombatUpkeep([c], 1, fixed(5)); // même jet qui, non traité, tue le cas précédent
    expect(c.dead).toBeFalsy();
    expect(c.fate).toBe(0); // aucun Destin consommé : le soin a suffi
  });
});
