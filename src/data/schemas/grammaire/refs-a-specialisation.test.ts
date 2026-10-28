/**
 * #3045 — une Spécialisation se désigne par la fabrique qui la valide : tout objet `{ id, spec }` du registre
 * est une référence à spécialisation (`refOuSpec`, `specRef`), lue par `declarationDeRefASpecialisation`,
 * que l'atelier rend en `RefField` (`spec`) ; jamais un objet écrit au site dont l'`id` et la `spec`
 * passeraient en chaînes libres. Seule la dotation d'un objet du catalogue (`dotationDeCatalogueSchema`,
 * reconnue par identité de nœud) porte une `spec` qui n'est pas une Spécialisation.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { DEFS_DE_DOCUMENT } from '../validate';
import { OP_DEFS, conditionSchema, facilitationSchema, flowTestSchema } from './mecanique';
import { descendre, enfantsDe } from './descente';
import { declarationDeRefASpecialisation, refOuSpec } from './ref';
import { nommerChamps } from './meta';
import { dotationDeCatalogueSchema } from './reference';

/** Toute `spec` désigne une Spécialisation, sauf celle de la dotation d'un objet du catalogue. */
const specDesigneUneSpecialisation = (noeud: unknown): boolean => noeud !== dotationDeCatalogueSchema;

/** Les objets `{ id, spec }` désignant une Spécialisation qu'aucune fabrique à spécialisation n'a construits,
 *  nommés `<racine> <chemin>`. */
function objetsASpecNonMarques(racines: readonly unknown[], nomDeRacine: (rang: number) => string = String): string[] {
  const out: string[] = [];
  descendre(racines, ({ noeud, def, path, racine }) => {
    if (def.type !== 'object') return;
    const cles = new Set(enfantsDe(noeud).map((e) => e.cle));
    if (cles.has('id') && cles.has('spec') && specDesigneUneSpecialisation(noeud) && !declarationDeRefASpecialisation(noeud)) out.push(`${nomDeRacine(racine)} ${path}`);
  });
  return out;
}

const RACINES = [...DEFS_DE_DOCUMENT.map((d) => d.schema), ...Object.values(OP_DEFS)];
const nomDeRacine = (rang: number): string => DEFS_DE_DOCUMENT[rang]?.file ?? `op ${Object.keys(OP_DEFS)[rang - DEFS_DE_DOCUMENT.length]}`;

/** STOCK : chaque site encore hors de la fabrique, et ce qui le solde. Une entrée de plus ou périmée rougit. */
const STOCK: Readonly<Record<string, string>> = {
  // `talentRefSchema` (`id` en `z.string()`) : réf de Talent de statbloc, `refOuSpec('talent', { times })` à régime `choix`.
  'creatures.json [].talents[]': '#1621',
};

describe('objets `{ id, spec }` du registre', () => {
  it('chacun est une référence à spécialisation, hors du stock', () => {
    expect(objetsASpecNonMarques(RACINES, nomDeRacine).sort()).toEqual(Object.keys(STOCK).sort());
  });

  it('la Compétence d’une facilitation, de l’attaquant d’un Test opposé et d’une Condition `skill` résolvent au catalogue', () => {
    expect(facilitationSchema.safeParse({ hasSkill: { id: 'zorglub' } }).success).toBe(false);
    expect(facilitationSchema.safeParse({ hasSkill: { id: 'athletisme', spec: 'zorglub' } }).success).toBe(false);
    expect(facilitationSchema.safeParse({ hasSkill: { id: 'athletisme' }, steps: 1 }).success).toBe(true);
    const opposeA = (attackerSkill: string) => flowTestSchema.safeParse({ characteristic: 'force', difficulty: 'intermediaire', opposed: { attacker: 'force', attackerSkill } }).success;
    expect(opposeA('zorglub')).toBe(false);
    expect(opposeA('athletisme')).toBe(true);
    const competence = (c: object) => conditionSchema.safeParse({ kind: 'skill', ...c }).success;
    expect(competence({ id: 'crochetage', advances: 5, who: 'any' })).toBe(true);
    expect(competence({ id: 'zorglub' })).toBe(false);
    expect(competence({ id: 'savoir', spec: 'histoire' })).toBe(true);
    expect(competence({ id: 'athletisme', spec: 'zorglub' })).toBe(false);
  });

  it('contrôle positif : un objet écrit au site est relevé quel que soit son libellé ; la fabrique et la dotation de catalogue ne le sont pas', () => {
    const libre = z.strictObject({ id: z.string(), spec: z.string().optional() });
    const nomme = (label: string) => nommerChamps(z.strictObject({ id: z.string(), spec: z.string().optional() }), { id: { label: 'identifiant' }, spec: { label } });
    const racine = z.strictObject({ a: libre, b: refOuSpec('skill'), c: nomme('Spécialisation'), d: nomme('précision'), e: dotationDeCatalogueSchema });
    expect(objetsASpecNonMarques([racine])).toEqual(['0 .a', '0 .c', '0 .d']);
  });
});
