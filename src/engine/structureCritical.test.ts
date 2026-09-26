import { describe, it, expect } from 'vitest';
import { rollStructureCritical } from './structureCritical';
import { makeRNG } from './dice';
import { STRUCTURE_CRITICALS } from '../data/structureCriticals';

/**
 * Critique de Structure — résolveur PUR (Aux Armes p.120-121). Déterministe via `forcedRoll` (le d100 imposé) :
 * on vérifie le lookup de table (`findTableEntry`), la traduction des « Blessures » de la table en `GameOp`
 * (`wounds`, ignore BE/PA), le drapeau d'Effondrement (destruction) et la Blessure Triviale (0 Blessure).
 * NB : `STRUCTURE_CRITICALS` = la table verbatim (`structure-criticals.json`) — on lit ses fourchettes ici.
 */
describe('rollStructureCritical (AA 10 l.112-127)', () => {
  it("Effondrement (96+) : destruction, AUCUNE op `wounds` (la chute à 0 = la BRÈCHE)", () => {
    const r = rollStructureCritical(makeRNG(1), 98);
    expect(r.id).toBe('effondrement');
    expect(r.destroyed).toBe(true);
    expect(r.ops).toEqual([]); // pas de Blessures chiffrées : Effondrement = destruction directe
    expect(r.log.join(' ')).toContain('Effondrement');
  });

  it("ligne à Blessures (Secouée, 36-50) : op `wounds` du montant exact, non détruite", () => {
    const r = rollStructureCritical(makeRNG(1), 40);
    expect(r.id).toBe('secouee');
    expect(r.destroyed).toBe(false);
    expect(r.ops).toEqual([{ op: 'wounds', amount: 1 }]); // Secouée = 1 Blessure supplémentaire
  });

  it("Blessure Triviale (Ébréchée, 01-35) : 0 Blessure → aucune op", () => {
    const r = rollStructureCritical(makeRNG(1), 10);
    expect(r.id).toBe('ebrechee');
    expect(r.entry.trivial).toBe(true);
    expect(r.destroyed).toBe(false);
    expect(r.ops).toEqual([]); // « T » : ne retire aucune Blessure
  });

  it("Effondrement partiel (81-90) : op `wounds` de 3", () => {
    const r = rollStructureCritical(makeRNG(1), 85);
    expect(r.id).toBe('effondrement-partiel');
    expect(r.ops).toEqual([{ op: 'wounds', amount: 3 }]);
  });

  it("CONTRAT de la donnée : chaque entrée porte une `note` NON VIDE (effets verbatim sur les personnes)", () => {
    // L'affichage de l'étape à table (#942 L2, `state/combatFlow` `STRUCTURE_CRIT_TABLE.lines`) rend
    // `log` PUIS `note` : une entrée sans note perdrait sa 2ᵉ ligne — la table entière doit en porter.
    const sansNote = STRUCTURE_CRITICALS.filter((e) => !e.note || !e.note.trim()).map((e) => e.id);
    expect(sansNote).toEqual([]);
  });

  it('le d100 par défaut (sans forcedRoll) reste dans la table et renvoie une entrée valide', () => {
    const r = rollStructureCritical(makeRNG(7));
    expect(r.roll).toBeGreaterThanOrEqual(1);
    expect(r.roll).toBeLessThanOrEqual(100);
    expect(STRUCTURE_CRITICALS.some((e) => e.id === r.id)).toBe(true);
  });
});
