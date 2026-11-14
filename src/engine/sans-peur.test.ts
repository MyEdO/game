/**
 * Sans Peur (Ennemi) — LDB 10 l.1051 : « Avec un seul Test de Calme Accessible (+20), vous pouvez
 * IGNORER les effets … de Peur ou de Terreur de l'ennemi spécifié ». Ce n'est PAS une immunité
 * automatique (l'ancien comportement). On vérifie ici la mécanique RAW au niveau moteur :
 *  - le Test passe à Accessible (+20) ;
 *  - pour la PEUR (normalement Test ÉTENDU, LDB 21 l.27), UNE réussite l'ignore d'emblée (surmontée) ;
 *  - pour la TERREUR, une réussite rend surmontée la Peur héritée (LDB 21 l.56) ;
 *  - un échec laisse le porteur sujet (la source RESTE détectée par fearSourceFor).
 */
import { idsDeTest } from './idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { pasDePeur, fearSourceFor, sansPeurVs, psychBranchOps, sousPeur, issueDePeur, sansPeurLabel, psychTest, sourceCombattant } from './psychology';
import { refLabel, talents } from '../data';
import { applyOps } from './ops';
import type { Combatant } from './types';
import { deFixe } from './dice.testkit';
import { blessuresSurLeProfil, blessuresDeBase, profilDeTest } from './combattantDeTest.testkit';

const rngOf = deFixe;
const mk = (o: Partial<Combatant> = {}): Combatant => (blessuresSurLeProfil({
  id: 'c', label: 'c', kind: 'ennemi', advantage: 0, conditions: [],
  characteristics: profilDeTest({ 'force-mentale': 35 }), psychState: [], psychTraits: [], groups: [],
  weapons: [], armour: {} as never, skills: [], talents: [], movement: 4, wounds: blessuresDeBase(10), ...o,
}) as Combatant);

describe('Sans Peur (Ennemi) — Test de Calme Accessible (+20), un seul Test (LDB 10 l.1051)', () => {
  it('le Test allégé a une seule source, `psychTest(kind, sansPeur)` : Accessible (+20) pour la Peur et la Terreur', () => {
    for (const kind of ['peur', 'terreur'] as const) {
      expect(psychTest(kind, true).difficulty).toBe('accessible');
      expect(psychTest(kind, false)).toEqual(psychTest(kind));
      expect(psychTest(kind, false).difficulty).toBe('intermediaire');
    }
  });

  it('PEUR : une seule réussite IGNORE la Peur d’emblée (surmontée), même Indice élevé', () => {
    const normal = pasDePeur(0, { success: true, sl: 0 }, 5);
    expect(normal.surmontee).toBe(false); // DR cumulé < Indice
    const sansPeur = pasDePeur(0, { success: true, sl: 0 }, 5, true);
    expect(sansPeur.surmontee).toBe(true);
    expect(sansPeur.calmeDR).toBeGreaterThanOrEqual(5);
  });

  it('PEUR : un échec laisse le porteur sujet (pas de progression, non surmontée)', () => {
    expect(pasDePeur(0, { success: false, sl: -2 }, 3, true)).toEqual({ calmeDR: 0, surmontee: false });
  });

  it('TERREUR : réussite → la Peur héritée naît surmontée ; échec → Brisé + Peur subie (LDB 21 l.56)', () => {
    const ok = mk({ id: 'h', kind: 'heros' });
    applyOps(ok, psychBranchOps({ kind: 'terreur', sourceId: 'o', indice: 2 }, { success: true, sansPeur: true }), { idNeuf: idsDeTest, rng: rngOf(50), sl: 1 });
    expect(ok.conditions).toEqual([]);
    expect(sousPeur(ok.psychState!.find((p) => p.type === 'peur')!)).toBe(false);
    const ko = mk({ id: 'h', kind: 'heros' });
    applyOps(ko, psychBranchOps({ kind: 'terreur', sourceId: 'o', indice: 2 }, { success: false, sansPeur: true }), { idNeuf: idsDeTest, rng: rngOf(50), sl: -1 });
    expect(ko.conditions.find((k) => k.id === 'brise')?.value).toBe(3);
    expect(sousPeur(ko.psychState!.find((p) => p.type === 'peur')!)).toBe(true);
  });

  it('TERREUR : la Peur héritée garde son PLEIN Indice ; sans le Talent, la réussite n’exempte que de la Terreur', () => {
    const heros = mk({ id: 'h', kind: 'heros' });
    applyOps(heros, psychBranchOps({ kind: 'terreur', sourceId: 'o', indice: 2 }, { success: true, sansPeur: true }), { idNeuf: idsDeTest, rng: rngOf(50) });
    expect(heros.psychState!.find((p) => p.type === 'peur' && p.sourceId === 'o')!.indice).toBe(2);
    const sansTalent = mk({ id: 'h2', kind: 'heros' });
    applyOps(sansTalent, psychBranchOps({ kind: 'terreur', sourceId: 'o', indice: 2 }, { success: true }), { idNeuf: idsDeTest, rng: rngOf(50) });
    expect(sousPeur(sansTalent.psychState!.find((p) => p.type === 'peur')!)).toBe(true);
  });

  it('« ignore la peur » n’est dit que d’un Sans Peur RÉUSSI ; un raté que le Test étendu surmonte reste « surmontée » (LDB 10 l.1051 ; LDB 21 l.25)', () => {
    const rate = { success: false, ...pasDePeur(0, { success: false, sl: -2 }, 0, true) };
    expect(rate).toMatchObject({ success: false, surmontee: true });
    expect(issueDePeur(rate, true)).toBe('surmontee');
    const reussi = { success: true, ...pasDePeur(0, { success: true, sl: 1 }, 3, true) };
    expect(issueDePeur(reussi, true)).toBe('ignoree');
    expect(issueDePeur(reussi, false)).toBe('surmontee');
    expect(issueDePeur({ success: false, surmontee: false }, true)).toBe('tient');
  });

  it('le nom du Talent est son LIBELLÉ de donnée, jamais écrit en dur', () => {
    const talent = talents.find((x) => x.combat?.fearImmune)!;
    expect(sansPeurLabel()).toBe(refLabel('talents', { id: talent.id }));
  });

  it('fearSourceFor ne supprime PLUS la source pour un porteur de Sans Peur (plus d’immunité auto)', () => {
    const ogre = mk({ id: 'o', causesPeur: 2, groups: ['ogre'] });
    const brave = mk({ talents: [{ talentId: 'sans-peur', spec: 'ogre', times: 1 }] });
    expect(sansPeurVs(brave, sourceCombattant(ogre))).toBe(true);
    expect(fearSourceFor(brave, sourceCombattant(ogre))?.kind).toBe('peur'); // détectée → le porteur la TESTE (+20)
  });

  it('la spécialisation nomme un Groupe : une spécialisation `@id` ne vise pas le combattant de cet id (#3045)', () => {
    const ogre = mk({ id: 'o', causesPeur: 2, groups: ['ogre'] });
    const brave = mk({ talents: [{ talentId: 'sans-peur', spec: '@o', times: 1 }] });
    expect(sansPeurVs(brave, sourceCombattant(ogre))).toBe(false);
  });
});
