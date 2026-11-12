/**
 * Gratuite TERMINALE (#4011) : la porte par fichier (`validateDataset`, save du Compendium et contrat CI)
 * refuse un Flow d'effet déclenché où quelque chose suit une `grantFreeAttack` (`refuserLaGratuiteNonTerminale`,
 * `grammaire/mecanique.ts`). Les deux Flows livrés passent.
 */
import { describe, it, expect } from 'vitest';
import { validateDataset } from '../validate';
import talentsJson from '../../talents.json';

type Talent = { id: string; effects?: { flow: unknown }[] };
const copie = (): Talent[] => JSON.parse(JSON.stringify(talentsJson)) as Talent[];
const gratuite = { op: 'grantFreeAttack', weapon: 'held', when: 'immediate' };
const autreOp = { op: 'sbBonus', amount: 1 };
const feuille = (ops: unknown[]) => ({ kind: 'effet', effet: { type: 'ops', on: 'caster', ops } });

/** `talents.json` dont le Flow d'Assaut féroce est remplacé par `flow`. */
function avecLeFlow(flow: unknown): Talent[] {
  const doc = copie();
  const assaut = doc.find((t) => t.id === 'assaut-feroce');
  if (!assaut?.effects) throw new Error('assaut-feroce sans effects');
  assaut.effects[0].flow = flow;
  return doc;
}

describe('une attaque gratuite est le dernier geste de son Flow (#4011)', () => {
  it('les Flows livrés (assaut-feroce onHit, frappe-reactive onCharged) passent', () => {
    expect(validateDataset('talents.json', copie())).toBeNull();
  });

  it('feuille [gratuite, op] : refusée, à l’op', () => {
    const dit = validateDataset('talents.json', avecLeFlow(feuille([gratuite, autreOp])));
    expect(dit).toContain('attaque gratuite suivie d’une opération');
  });

  it('séquence [gratuite, nœud] : refusée, même si la gratuite est au bout d’une branche', () => {
    const branche = { kind: 'si', condition: { kind: 'always' }, alors: feuille([gratuite]) };
    for (const tete of [feuille([gratuite]), branche]) {
      const dit = validateDataset('talents.json', avecLeFlow({ kind: 'sequence', etapes: [tete, feuille([autreOp])] }));
      expect(dit).toContain('attaque gratuite suivie d’une étape');
    }
  });

  it('séquence [nœud, gratuite] : admise', () => {
    expect(validateDataset('talents.json', avecLeFlow({ kind: 'sequence', etapes: [feuille([autreOp]), feuille([gratuite])] }))).toBeNull();
  });
});
