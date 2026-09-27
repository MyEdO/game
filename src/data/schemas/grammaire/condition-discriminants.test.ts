/**
 * VERROU D'UNION de `Condition` (#1466 L1a T3-c, sonde du juge promue en garde).
 *
 * POURQUOI ce test existe : un schéma récursif est OBLIGÉ de s'annoter `z.ZodType<Condition>` (le
 * `z.lazy` empêche l'inférence), et cette annotation est SATISFAITE par une SOUS-union — un schéma
 * qui ne déclare que 26 des 30 variantes reste vert au typecheck ET au test d'infer
 * (`mecanique-infer.test.ts`), tout en REFUSANT au runtime les 6 variantes manquantes. C'est
 * exactement ainsi que 4 variantes ont manqué de T3-a à T3-c sans qu'aucune porte ne rougisse.
 *
 * Le contrat tenu ici est donc une ÉGALITÉ D'ENSEMBLE, mesurée des DEUX côtés du pont :
 * — côté TYPE : les membres de l'union manuscrite `Condition` (`src/engine/flowCore.ts`), extraits
 *   à l'AST TypeScript (jamais une liste recopiée : une liste en dur mourrait au premier ajout) ;
 * — côté SCHÉMA : les discriminants réels des options de `conditionSchema`, par INTROSPECTION zod
 *   (le `z.lazy` est déroulé — c'est la seule façon de voir ce que la porte accepte VRAIMENT).
 * Manquants et en-trop sont NOMMÉS dans les deux sens.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { conditionSchema } from './mecanique';
import { defDe, enfantsDe, ouverts } from './descente';

const FLOW_CORE = fileURLToPath(new URL('../../../engine/flowCore.ts', import.meta.url));

/** Les `kind` de l'union manuscrite `Condition`, lus à l'AST. Un membre sans littéral `kind` sort
 *  sous une clé `<…>` PARLANTE : il ferait rougir l'égalité au lieu de disparaître en silence. */
function kindsDuType(): string[] {
  const sf = ts.createSourceFile(FLOW_CORE, readFileSync(FLOW_CORE, 'utf8'), ts.ScriptTarget.ESNext, true);
  const kinds: string[] = [];
  sf.forEachChild((n) => {
    if (!ts.isTypeAliasDeclaration(n) || n.name.text !== 'Condition') return;
    const membres = ts.isUnionTypeNode(n.type) ? n.type.types : [n.type];
    for (const m of membres) {
      if (!ts.isTypeLiteralNode(m)) {
        kinds.push(`<non-literal: ${m.getText().slice(0, 40)}>`);
        continue;
      }
      const k = m.members.find((mm) => ts.isPropertySignature(mm) && mm.name?.getText() === 'kind') as
        | ts.PropertySignature
        | undefined;
      kinds.push(
        k?.type && ts.isLiteralTypeNode(k.type)
          ? k.type.literal.getText().replace(/'/g, '')
          : `<sans kind: ${m.getText().slice(0, 40)}>`,
      );
    }
  });
  return kinds;
}

/** Les discriminants des options de `conditionSchema` — le `z.lazy` est déroulé pour atteindre le
 *  `discriminatedUnion` réellement servi à la porte. */
function kindsDuSchema(): string[] {
  const union = ouverts([conditionSchema]).find((n) => defDe(n)?.type === 'union');
  return enfantsDe(union)
    .filter((e) => e.segment.startsWith('|'))
    .map(({ noeud }) => [...(defDe(enfantsDe(noeud).find((e) => e.cle === 'kind')?.noeud)?.values as Iterable<string>)][0]);
}

describe('`conditionSchema` — verrou d\'union : les discriminants du SCHÉMA == ceux du TYPE', () => {
  const kindsType = kindsDuType();
  const kindsSchema = kindsDuSchema();
  const duType = new Set(kindsType);
  const duSchema = new Set(kindsSchema);

  it('les deux extractions VOIENT leur union (une lecture muette rendrait l\'égalité vacueuse)', () => {
    expect(kindsType.length).toBeGreaterThan(20);
    expect(kindsSchema.length).toBeGreaterThan(20);
    expect(kindsType.filter((k) => k.startsWith('<')), `Membre(s) de \`Condition\` sans littéral \`kind\` :\n${kindsType.filter((k) => k.startsWith('<')).join('\n')}`).toEqual([]);
    expect(kindsSchema.length, 'discriminant DUPLIQUÉ dans les options du schéma.').toBe(duSchema.size);
  });

  it('AUCUNE variante du type ne MANQUE au schéma — la porte accepterait moins que le moteur', () => {
    const manquants = [...duType].filter((k) => !duSchema.has(k));
    expect(manquants, `Variante(s) de \`Condition\` absente(s) de \`conditionSchema\` (refusées au runtime) :\n${manquants.join('\n')}`).toEqual([]);
  });

  it('AUCUNE variante EN TROP au schéma — la porte accepterait ce que le moteur ne sait pas évaluer', () => {
    const enTrop = [...duSchema].filter((k) => !duType.has(k));
    expect(enTrop, `Option(s) de \`conditionSchema\` sans membre correspondant dans \`Condition\` :\n${enTrop.join('\n')}`).toEqual([]);
  });
});
