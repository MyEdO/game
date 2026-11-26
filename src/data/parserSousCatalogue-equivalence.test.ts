/**
 * ÉQUIVALENCE du parse sous catalogue (#5070, étape A) : sur la base livrée, `parserSousCatalogue(schema, v,
 * catalogueDuProcessus())` rend le verdict et les fautes du parse qui juge les ids à l'index (`schema.safeParse`).
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { parserSousCatalogue } from './schemas/catalogue/references';
import { catalogueDuProcessus } from './catalogueDuProcessus';
import { idDe, idsDe, reperesDuParse, type RepereDeMesure } from './schemas/grammaire/ref';
import { especeDApparenceSchema } from './schemas/grammaire/valeurs';
import { SCHEMA_DEFS } from './schemas/_registry.generated';
import { projetSchema } from './schemas/defs-scenes/projet';
import { BIBLIOTHEQUE } from './_racines-vivantes.generated';
import paquetDeTest from '../scenes/fixtures/paquet-de-test.json';
import { versDisque } from './schemas/grammaire/prose';
import { auChemin } from '../lib/objet.mjs';

const ID_MORT = 'id-mort-de-l-equivalence';

const disqueDu = (fichier: string): unknown => versDisque(BIBLIOTHEQUE[fichier]);

/** Les issues d'un parse, en `{ code, path, message }`. */
const issuesDe = (r: z.ZodSafeParseResult<unknown>) => r.error?.issues.map(({ code, path, message }) => ({ code, path, message }));

describe('parserSousCatalogue ≡ parse à l’index — chaque document de la bibliothèque, en sa forme disque', () => {
  it('chaque document livré est accepté par les deux', () => {
    const cat = catalogueDuProcessus();
    const ecarts = SCHEMA_DEFS.flatMap(({ file, schema }) => {
      const document = disqueDu(file);
      const normal = (schema as z.ZodType).safeParse(document).success;
      const sous = parserSousCatalogue(schema as z.ZodType, document, cat).success;
      return normal && sous ? [] : [`${file} : index ${normal}, catalogue ${sous}`];
    });
    expect(ecarts, `${ecarts.length} écart(s) sur ${SCHEMA_DEFS.length} documents`).toEqual([]);
  });
});

/** `document` dont le repère `r` vaut `id`, sur une copie : la valeur au `path`, ou la clé d'un record. */
function avecLId(document: unknown, r: RepereDeMesure, id: string): unknown {
  const copie = structuredClone(document);
  const parent = auChemin(copie, r.path.slice(0, -1)) as Record<PropertyKey, unknown>;
  const cle = r.path[r.path.length - 1];
  if (r.parCle) {
    parent[id] = parent[cle];
    delete parent[cle];
  } else parent[cle] = id;
  return copie;
}

/** La forme d'un repère, indices de liste effacés : un id mort par forme suffit à juger sa feuille. */
const formeDu = (r: RepereDeMesure): string => `${String(r.type)}|${r.parCle}|${r.path.map((s) => (typeof s === 'number' ? '*' : String(s))).join('.')}`;

describe('une référence morte — chaque forme de repère de chaque document', () => {
  it('est refusée par les deux, aux mêmes fautes', { timeout: 120_000 }, () => {
    const cat = catalogueDuProcessus();
    const documents = [
      ...SCHEMA_DEFS.map(({ file, schema }) => ({ file, schema: schema as z.ZodType, document: disqueDu(file) })),
      { file: 'paquet-de-test.json', schema: projetSchema as z.ZodType, document: versDisque(paquetDeTest) },
    ];
    let cas = 0;
    const ecarts = documents.flatMap(({ file, schema, document }) => {
      const vues = new Set<string>();
      return reperesDuParse(schema, document).flatMap((r) => {
        const forme = formeDu(r);
        if (vues.has(forme)) return [];
        vues.add(forme);
        cas++;
        const mort = avecLId(document, r, ID_MORT);
        const normal = schema.safeParse(mort);
        const sous = parserSousCatalogue(schema, mort, cat);
        return JSON.stringify(issuesDe(normal)) === JSON.stringify(issuesDe(sous)) ? [] : [`${file} ${forme}`];
      });
    });
    expect(ecarts, `${ecarts.length} écart(s) sur ${cas} formes`).toEqual([]);
  });
});

describe('UNION d’ids — la branche qui vaut est celle du parse à l’index', () => {
  it('`especeDApparenceSchema` admet `humain` sous les deux', () => {
    expect(especeDApparenceSchema.safeParse('humain').success).toBe(true);
    expect(parserSousCatalogue(especeDApparenceSchema, 'humain', catalogueDuProcessus()).success).toBe(true);
  });

  it('une union de deux espaces admet l’id du second, et refuse l’id mort aux mêmes fautes', () => {
    const union = z.union([z.strictObject({ x: idDe('trait') }), z.strictObject({ x: idDe('skill') })]);
    const competence = [...idsDe('skill')][0];
    expect(union.safeParse({ x: competence }).success).toBe(true);
    expect(parserSousCatalogue(union, { x: competence }, catalogueDuProcessus()).success).toBe(true);
    expect(issuesDe(parserSousCatalogue(union, { x: ID_MORT }, catalogueDuProcessus()))).toEqual(issuesDe(union.safeParse({ x: ID_MORT })));
  });
});
