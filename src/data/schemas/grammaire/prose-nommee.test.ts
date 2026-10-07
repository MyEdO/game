import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { PROSES_NOMMEES } from './champs-prose-de-scene';
import { declarationProseNommee, proseNommee } from './prose';
import { indiceStadeSchema, documentNarratifSchema, ouvertureSchema } from '../defs-scenes/narratif';
import { massBattleSpecSchema } from '../defs-scenes/effets';
import { coDescendre } from './descente';

const SOURCE = { book: 'ennemi-dans-l-ombre', page: 12 };
const ADAPTE = { book: 'ennemi-dans-l-ombre', page: 14 };
const SITES = {
  'narratif.ouverture.pitch': { schema: ouvertureSchema, nu: { titre: 'Titre', pitch: 'Texte.' } },
  'narratif.indices[].stades[].prose': { schema: indiceStadeSchema, nu: { id: 'stade', prose: 'Texte.' } },
  'narratif.documents[].prose': { schema: documentNarratifSchema, nu: { id: 'document', titre: 'Titre', prose: 'Texte.' } },
  'massBattle.terrain': { schema: massBattleSpecSchema, nu: { allyMight: 50, enemyMight: 50, terrain: 'Texte.' } },
} satisfies Record<keyof typeof PROSES_NOMMEES, { schema: z.ZodType; nu: object }>;

describe('prose nommée — déclaration et provenance locales', () => {
  for (const chemin of Object.keys(PROSES_NOMMEES) as (keyof typeof PROSES_NOMMEES)[]) {
    const definition = PROSES_NOMMEES[chemin];
    const { schema, nu } = SITES[chemin];
    it(`${chemin} compose sa déclaration du registre`, () => {
      expect(declarationProseNommee(schema)).toBe(definition);
    });
    it(`${chemin} accepte Maison et la copie sourcée par folio`, () => {
      expect(schema.safeParse(nu).success).toBe(true);
      expect(schema.safeParse({ ...nu, source: SOURCE }).success).toBe(true);
    });
    it(`${chemin} applique son régime d’adaptation`, () => {
      const adapte = schema.safeParse({ ...nu, adapteDe: ADAPTE });
      expect(adapte.success).toBe(definition.regime === 'narration');
      const double = schema.safeParse({ ...nu, source: SOURCE, adapteDe: ADAPTE });
      expect(double.success).toBe(false);
      if (definition.regime === 'narration') expect(double.error?.issues.map((i) => i.path)).toEqual([['adapteDe']]);
    });
    it(`${chemin} conserve la présence du champ`, () => {
      const sansTexte: Record<string, unknown> = { ...nu };
      delete sansTexte[definition.champ];
      expect(schema.safeParse(sansTexte).success).toBe(definition.presence === 'optionnel');
      expect(schema.safeParse({ ...nu, [definition.champ]: '' }).success).toBe(definition.presence === 'optionnel');
    });
  }

  it('un nouvel objet narratif reçoit automatiquement l’exclusivité', () => {
    const schema = proseNommee(z.strictObject({ id: z.literal('fixture') }), 'massBattle.terrain');
    const r = schema.safeParse({ id: 'fixture', terrain: 'Texte.', source: SOURCE, adapteDe: ADAPTE });
    expect(r.error?.issues.map((i) => i.path)).toEqual([['adapteDe']]);
  });

  it.each(Object.keys(PROSES_NOMMEES) as (keyof typeof PROSES_NOMMEES)[])('%s garde sa déclaration après refine, enveloppe, optional et liste', (chemin) => {
    const definition = PROSES_NOMMEES[chemin];
    const { schema: original, nu } = SITES[chemin];
    const clone = original.superRefine(() => {});
    expect(declarationProseNommee(clone)).toBe(definition);
    const schema = z.strictObject({ sites: z.array(clone.optional()).optional() }).optional();
    const declarations: unknown[] = [];
    coDescendre(schema, { sites: [nu] }, (p) => {
      const trouvee = p.noeuds.map(declarationProseNommee).find((d) => d !== undefined);
      if (trouvee) declarations.push(trouvee);
    });
    expect(declarations).toEqual([definition]);
    const adapte = clone.safeParse({ ...nu, adapteDe: ADAPTE });
    expect(adapte.success).toBe(definition.regime === 'narration');
    expect(clone.safeParse({ ...nu, source: SOURCE, adapteDe: ADAPTE }).success).toBe(false);
  });
});
