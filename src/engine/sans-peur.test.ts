/**
 * Sans Peur (Ennemi) — LDB 10 l.1051 : « Avec un seul Test de Calme Accessible (+20), vous pouvez
 * IGNORER les effets … de Peur ou de Terreur de l'ennemi spécifié ». Ce n'est PAS une immunité
 * automatique (l'ancien comportement). On vérifie ici la mécanique RAW au niveau moteur :
 *  - le Test passe à Accessible (+20) ;
 *  - pour la PEUR (normalement Test ÉTENDU, LDB 21 l.27), UNE réussite l'ignore d'emblée (vaincue) ;
 *  - un échec laisse le porteur sujet (la source RESTE détectée par fearSourceFor).
 */
import { describe, it, expect } from 'vitest';
import type { RNG } from './dice';
import { resolvePeurTest, resolveTerreurTest, fearSourceFor, sansPeurVs } from './psychology';
import type { Combatant } from './types';

const rngOf = (roll: number): RNG => ({ int: () => roll });
const mk = (o: Partial<Combatant> = {}): Combatant => ({
  id: 'c', label: 'c', kind: 'enemy', advantage: 0, conditions: [],
  characteristics: { 'force-mentale': 35 } as Combatant['characteristics'], psychState: [], psychTraits: [], groups: [],
  weapons: [], armour: {} as never, skills: [], talents: [], movement: 4, wounds: { current: 10, max: 10 }, ...o,
} as Combatant);

describe('Sans Peur (Ennemi) — Test de Calme Accessible (+20), un seul Test (LDB 10 l.1051)', () => {
  it('PEUR : le Test passe de Intermédiaire (+0) à Accessible (+20)', () => {
    expect(resolvePeurTest(50, 3, 0, rngOf(99), false, false).target).toBe(50);
    expect(resolvePeurTest(50, 3, 0, rngOf(99), false, true).target).toBe(70);
  });

  it('PEUR : une seule réussite IGNORE la Peur d’emblée (vaincue), même Indice élevé', () => {
    // Indice 5 : en Test étendu normal, une réussite marginale (DR faible) ne vainc PAS…
    const normal = resolvePeurTest(50, 5, 0, rngOf(49), false, false);
    expect(normal.success).toBe(true);
    expect(normal.vaincue).toBe(false); // DR cumulé < Indice
    // … mais avec Sans Peur, la réussite unique vainc (DR porté à l’Indice).
    const sansPeur = resolvePeurTest(50, 5, 0, rngOf(49), false, true);
    expect(sansPeur.success).toBe(true);
    expect(sansPeur.vaincue).toBe(true);
    expect(sansPeur.calmeDR).toBeGreaterThanOrEqual(5);
  });

  it('PEUR : un échec laisse le porteur sujet (pas de progression, non vaincue)', () => {
    const r = resolvePeurTest(50, 3, 0, rngOf(99), false, true); // 99 échoue même à +20 (cible 70)
    expect(r.success).toBe(false);
    expect(r.vaincue).toBe(false);
    expect(r.calmeDR).toBe(0);
  });

  it('TERREUR : +20 ; réussite → ne devient PAS une Peur (devientPeur 0) ; échec → Brisé + Peur', () => {
    expect(resolveTerreurTest(50, 2, rngOf(99), false, true).target).toBe(70);
    const ok = resolveTerreurTest(50, 2, rngOf(30), false, true);
    expect(ok.success).toBe(true);
    expect(ok.brise).toBe(0);
    expect(ok.devientPeur).toBe(0); // ignorée : pas de Peur subséquente
    const ko = resolveTerreurTest(50, 2, rngOf(99), false, true);
    expect(ko.success).toBe(false);
    expect(ko.brise).toBeGreaterThan(0); // Brisé comme une Terreur normale
    expect(ko.devientPeur).toBe(2); // … puis devient une Peur d’Indice 2
  });

  it('fearSourceFor ne supprime PLUS la source pour un porteur de Sans Peur (plus d’immunité auto)', () => {
    const ogre = mk({ id: 'o', causesPeur: 2, groups: ['Ogre'] });
    const brave = mk({ talents: [{ talentId: 'sans-peur', spec: 'Ogre', times: 1 }] });
    expect(sansPeurVs(brave, ogre)).toBe(true);
    expect(fearSourceFor(brave, ogre)?.kind).toBe('peur'); // détectée → le porteur la TESTE (+20)
  });
});
