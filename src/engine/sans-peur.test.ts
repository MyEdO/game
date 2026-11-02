/**
 * Sans Peur (Ennemi) — LDB 10 l.1051 : « Avec un seul Test de Calme Accessible (+20), vous pouvez
 * IGNORER les effets … de Peur ou de Terreur de l'ennemi spécifié ». Ce n'est PAS une immunité
 * automatique (l'ancien comportement). On vérifie ici la mécanique RAW au niveau moteur :
 *  - le Test passe à Accessible (+20) ;
 *  - pour la PEUR (normalement Test ÉTENDU, LDB 21 l.27), UNE réussite l'ignore d'emblée (surmontée) ;
 *  - pour la TERREUR, une réussite rend surmontée la Peur héritée (LDB 21 l.56), dans les deux camps ;
 *  - un échec laisse le porteur sujet (la source RESTE détectée par fearSourceFor).
 */
import { describe, it, expect } from 'vitest';
import { resolvePeurTest, resolveTerreurTest, fearSourceFor, sansPeurVs, psychBranchOps, sousPeur, issueDePeur, sansPeurLabel, psychTest, type PsychAffliction } from './psychology';
import { refLabel, talents } from '../data';
import { applyOps } from './ops';
import type { Combatant } from './types';
import { deFixe } from './dice.testkit';
import { blessuresSurLeProfil, blessuresDeBase, profilDeTest } from './combattantDeTest.testkit';

const rngOf = deFixe;
const mk = (o: Partial<Combatant> = {}): Combatant => (blessuresSurLeProfil({
  id: 'c', label: 'c', kind: 'enemy', advantage: 0, conditions: [],
  characteristics: profilDeTest({ 'force-mentale': 35 }), psychState: [], psychTraits: [], groups: [],
  weapons: [], armour: {} as never, skills: [], talents: [], movement: 4, wounds: blessuresDeBase(10), ...o,
}) as Combatant);

describe('Sans Peur (Ennemi) — Test de Calme Accessible (+20), un seul Test (LDB 10 l.1051)', () => {
  it('PEUR : le Test passe de Intermédiaire (+0) à Accessible (+20)', () => {
    expect(resolvePeurTest(50, 3, 0, rngOf(99), false, false).target).toBe(50);
    expect(resolvePeurTest(50, 3, 0, rngOf(99), false, true).target).toBe(70);
  });

  it('PEUR : une seule réussite IGNORE la Peur d’emblée (surmontée), même Indice élevé', () => {
    // Indice 5 : en Test étendu normal, une réussite marginale (DR faible) ne vainc PAS…
    const normal = resolvePeurTest(50, 5, 0, rngOf(49), false, false);
    expect(normal.success).toBe(true);
    expect(normal.surmontee).toBe(false); // DR cumulé < Indice
    // … mais avec Sans Peur, la réussite unique vainc (DR porté à l’Indice).
    const sansPeur = resolvePeurTest(50, 5, 0, rngOf(49), false, true);
    expect(sansPeur.success).toBe(true);
    expect(sansPeur.surmontee).toBe(true);
    expect(sansPeur.calmeDR).toBeGreaterThanOrEqual(5);
  });

  it('PEUR : un échec laisse le porteur sujet (pas de progression, non surmontée)', () => {
    const r = resolvePeurTest(50, 3, 0, rngOf(99), false, true); // 99 échoue même à +20 (cible 70)
    expect(r.success).toBe(false);
    expect(r.surmontee).toBe(false);
    expect(r.calmeDR).toBe(0);
  });

  it('TERREUR : +20 ; réussite → la Peur héritée naît surmontée ; échec → Brisé + Peur subie', () => {
    expect(resolveTerreurTest(50, 2, rngOf(99), false, true).target).toBe(70);
    const ok = resolveTerreurTest(50, 2, rngOf(30), false, true);
    expect(ok.success).toBe(true);
    expect(ok.brise).toBe(0);
    expect(ok.peurSurmontee).toBe(true);
    const ko = resolveTerreurTest(50, 2, rngOf(99), false, true);
    expect(ko.success).toBe(false);
    expect(ko.brise).toBeGreaterThan(0);
    expect(ko.peurSurmontee).toBe(false);
    expect(resolveTerreurTest(50, 2, rngOf(30), false, false).peurSurmontee, 'sans le Talent, la réussite n’exempte que de la Terreur').toBe(false);
  });

  it('TERREUR : la Peur héritée garde son PLEIN Indice ; Sans Peur réussi la pose surmontée, même règle que l’IA', () => {
    const heros = mk({ id: 'h', kind: 'hero' });
    applyOps(heros, psychBranchOps({ kind: 'terreur', sourceId: 'o', indice: 2 }, { success: true, sansPeur: true }), { rng: rngOf(50) });
    const peur = heros.psychState!.find((p) => p.type === 'peur' && p.sourceId === 'o')!;
    expect(peur.indice).toBe(2);
    expect(sousPeur(peur)).toBe(false);
    const ia: PsychAffliction = { type: 'peur', sourceId: 'o', indice: 2, ...(resolveTerreurTest(50, 2, rngOf(30), false, true).peurSurmontee ? { surmontee: true } : {}) };
    expect(sousPeur(ia)).toBe(sousPeur(peur));
    const sansTalent = mk({ id: 'h2', kind: 'hero' });
    applyOps(sansTalent, psychBranchOps({ kind: 'terreur', sourceId: 'o', indice: 2 }, { success: true }), { rng: rngOf(50) });
    expect(sousPeur(sansTalent.psychState!.find((p) => p.type === 'peur')!)).toBe(true);
  });

  it('« ignore la peur » n’est dit que d’un Sans Peur RÉUSSI ; un raté que le Test étendu surmonte reste « surmontée » (LDB 10 l.1051 ; LDB 21 l.25)', () => {
    const rate = resolvePeurTest(1, 0, 0, rngOf(99), false, true);
    expect(rate).toMatchObject({ success: false, surmontee: true });
    expect(issueDePeur(rate, true)).toBe('surmontee');
    const reussi = resolvePeurTest(50, 3, 0, rngOf(10), false, true);
    expect(issueDePeur(reussi, true)).toBe('ignoree');
    expect(issueDePeur(reussi, false)).toBe('surmontee');
    expect(issueDePeur({ success: false, surmontee: false }, true)).toBe('tient');
  });

  it('une seule source du Test allégé : `psychTest(kind, sansPeur)`, lu par l’IA comme par les rangées', () => {
    for (const kind of ['peur', 'terreur'] as const) {
      expect(psychTest(kind, true).difficulty).toBe('accessible');
      expect(psychTest(kind, false)).toEqual(psychTest(kind));
    }
    expect(resolveTerreurTest(50, 2, rngOf(99), false, true).target).toBe(70);
  });

  it('le nom du Talent est son LIBELLÉ de donnée, jamais écrit en dur', () => {
    const talent = talents.find((x) => x.combat?.fearImmune)!;
    expect(sansPeurLabel()).toBe(refLabel('talents', { id: talent.id }));
  });

  it('fearSourceFor ne supprime PLUS la source pour un porteur de Sans Peur (plus d’immunité auto)', () => {
    const ogre = mk({ id: 'o', causesPeur: 2, groups: ['ogre'] });
    const brave = mk({ talents: [{ talentId: 'sans-peur', spec: 'ogre', times: 1 }] });
    expect(sansPeurVs(brave, ogre)).toBe(true);
    expect(fearSourceFor(brave, ogre)?.kind).toBe('peur'); // détectée → le porteur la TESTE (+20)
  });

  it('la spécialisation nomme un Groupe : une spécialisation `@id` ne vise pas le combattant de cet id (#3045)', () => {
    const ogre = mk({ id: 'o', causesPeur: 2, groups: ['ogre'] });
    const brave = mk({ talents: [{ talentId: 'sans-peur', spec: '@o', times: 1 }] });
    expect(sansPeurVs(brave, ogre)).toBe(false);
  });
});
