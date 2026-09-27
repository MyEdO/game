/**
 * Contrats de la CO-DESCENTE (#1463) — `ouverts`, `pasDeDonnee`, `coDescendre` (`grammaire/descente.ts`)
 * segment par segment, et ce que `collectionsDuDocument` / `collectionALaCle`
 * (`grammaire/collection-cle.ts`) en tirent, arbres invalides compris. Garde : aucune collection
 * marquée des deux registres n'est atteinte à travers une union SIMPLE.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { SCHEMA_DEFS } from '../_registry.generated';
import { SCHEMA_DEFS_SCENES } from '../_registry-scenes.generated';
import { coDescendre, defDe, descendre, enfantsDe, type PointDeDonnee } from './descente';
import { collectionALaCle, collectionDe, collectionsDuDocument, idsDeCollection, listeCle } from './collection-cle';
import { noyauEnum } from './meta';

const el = z.strictObject({ id: z.string() });
const liste = () => listeCle(el, 'id');
const lu = (schema: unknown, donnee: unknown) => collectionsDuDocument(schema, donnee).map((c) => [c.suite, c.ids]);

/** Les chemins de donnée que `coDescendre` visite. */
const visites = (schema: unknown, donnee: unknown): string[] => {
  const out: string[] = [];
  coDescendre(schema, donnee, (p: PointDeDonnee) => void out.push(p.chemin.map(String).join('.') || '(racine)'));
  return out;
};

describe('co-descente — un pas de donnée par segment de schéma', () => {
  it("`''` : une enveloppe (optionnel, nullable, défaut, lazy, pipe) est transparente", () => {
    const lazy = z.lazy(() => liste());
    const schema = z.strictObject({ a: liste().optional(), b: liste().nullable(), c: liste().default([]), d: lazy, e: liste().transform((v) => v) });
    const donnee = { a: [{ id: 'x' }], b: [{ id: 'y' }], c: [{ id: 'z' }], d: [{ id: 'w' }], e: [{ id: 'v' }] };
    expect(lu(schema, donnee)).toEqual([['a', ['x']], ['b', ['y']], ['c', ['z']], ['d', ['w']], ['e', ['v']]]);
  });

  it('`&N` : les deux côtés d’une intersection', () => {
    const schema = z.intersection(z.object({ n: z.string() }), z.object({ l: liste() }));
    expect(lu(schema, { n: 'a', l: [{ id: 'x' }] })).toEqual([['l', ['x']]]);
  });

  it('`|N` d’une union DISCRIMINÉE : la seule branche qu’admet le discriminant de la donnée', () => {
    const schema = z.discriminatedUnion('k', [
      z.strictObject({ k: z.literal('a'), l: liste() }),
      z.strictObject({ k: z.literal('b'), l: listeCle(z.strictObject({ nom: z.string() }), 'nom') }),
    ]);
    const [c] = collectionsDuDocument(schema, { k: 'b', l: [{ nom: 'x' }] });
    expect([c.suite, c.marque.forme === 'liste' && c.marque.nom, c.ids]).toEqual(['l', 'nom', ['x']]);
    expect(() => collectionsDuDocument(schema, { l: [{ nom: 'x' }] }), 'sans discriminant, les deux branches marquent `l`').toThrow(/2 marques différentes au point « l »/);
  });

  it('`|N` d’une union DISCRIMINÉE sans valeur lisible : TOUTES les branches (arbre invalide)', () => {
    const schema = z.discriminatedUnion('k', [z.strictObject({ k: z.literal('a'), l: liste() }), z.strictObject({ k: z.literal('b'), m: z.string() })]);
    expect(lu(schema, { l: [{ id: 'x' }] })).toEqual([['l', ['x']]]);
    expect(lu(schema, { k: 'b', l: [{ id: 'x' }] }), 'la branche `b` ignore `l` : la descente ne s’y engage pas').toEqual([]);
  });

  it('`|N` d’une union SIMPLE : toutes les branches', () => {
    expect(lu(z.union([z.strictObject({ l: liste() }), z.string()]), { l: [{ id: 'x' }] })).toEqual([['l', ['x']]]);
  });

  it('`.*` : une clé hors `shape` passe par le `catchall`, une clé du `shape` non', () => {
    const schema = z.strictObject({ s: z.string() }).catchall(liste());
    expect(lu(schema, { s: 'a', x: [{ id: 'y' }] })).toEqual([['x', ['y']]]);
  });

  it('`{}` : une clé de record passe par sa valeur', () => {
    expect(lu(z.record(z.string(), liste()), { x: [{ id: 'y' }] })).toEqual([['x', ['y']]]);
  });

  it('`[i]` et `[...]` : un rang de tuple passe par son élément, au-delà par le reste', () => {
    const schema = z.tuple([z.string()], liste());
    expect(lu(schema, ['a', [{ id: 'x' }], [{ id: 'y' }]])).toEqual([['[]', ['x']], ['[]', ['y']]]);
    expect(lu(z.tuple([liste()]), [[{ id: 'x' }]])).toEqual([['[]', ['x']]]);
  });

  it('`null` et `undefined` n’ont pas d’enfant : aucune collection, aucune descente', () => {
    const schema = z.strictObject({ l: liste().nullable().optional() });
    expect([lu(schema, { l: null }), lu(schema, { l: undefined })]).toEqual([[], []]);
    expect(visites(schema, { l: null })).toEqual(['(racine)', 'l']);
    expect(visites(z.strictObject({ o: z.strictObject({ p: z.string() }).nullable() }), { o: null })).toEqual(['(racine)', 'o']);
  });

  it('une clé que le schéma ignore n’est pas visitée : la co-descente ne valide pas', () => {
    expect(visites(z.object({ a: z.string() }), { a: 'x', inconnue: { b: 1 } })).toEqual(['(racine)', 'a']);
  });
});

describe('collections d’un document — la suite nichée, et les arbres invalides', () => {
  const specs = z.strictObject({ id: z.string(), specs: listeCle(el, 'id', { espace: {} }).optional(), note: z.string().optional() });
  const schema = listeCle(specs, 'id', { espace: {} });
  const racine = [{ id: 'art', specs: [{ id: 'peinture' }, { id: 'sculpture' }] }, { id: 'nage' }];

  it('suite nichée : `[clé]` lu par la marque de la liste, `.champ` ensuite', () => {
    expect(lu(schema, racine)).toEqual([
      ['', ['art', 'nage']],
      ['[art].specs', ['peinture', 'sculpture']],
    ]);
  });

  it('fait de SCHÉMA : deux marques différentes sur un même point LÈVENT', () => {
    const ambigu = z.union([liste(), listeCle(z.strictObject({ nom: z.string() }), 'nom')]);
    expect(() => collectionsDuDocument(ambigu, [{ id: 'a' }])).toThrow(/2 marques différentes au point « \(racine\) »/);
  });

  it('fait de DONNÉE : l’élément d’une liste marquée sans clé lisible est ÉLAGUÉ et rapporté anonyme', () => {
    const copie = [{ specs: [{ id: 'peinture' }] }, { id: 'nage' }];
    const collections = collectionsDuDocument(schema, copie);
    expect(collections.map((c) => [c.suite, c.ids, c.anonymes])).toEqual([['', ['nage'], [0]]]);
  });

  it('`collectionALaCle` : atteinte, absente de la donnée, ou suite qui ne mène à aucune collection marquée', () => {
    const atteinte = collectionALaCle(schema, racine, '[art].specs');
    expect(idsDeCollection(atteinte.marque, atteinte.valeur)).toEqual(['peinture', 'sculpture']);
    expect(idsDeCollection(collectionALaCle(schema, racine, '').marque, racine)).toEqual(['art', 'nage']);
    const absente = collectionALaCle(schema, racine, '[nage].specs');
    expect([absente.valeur, absente.marque === atteinte.marque]).toEqual([undefined, true]);
    expect(collectionALaCle(schema, racine, '[inconnue].specs').valeur).toBeUndefined();
    expect(() => collectionALaCle(schema, [{ id: 'art', note: 'n' }], '[art].note')).toThrow(/« \[art\]\.note » ne mène à aucune collection à clé/);
    expect(() => collectionALaCle(schema, racine, '[nage].note')).toThrow(/« \[nage\]\.note » ne mène à aucune collection à clé/);
  });
});

describe('`collectionALaCle` — une suite désigne UN point, ou lève', () => {
  const item = z.strictObject({ id: z.string() });
  const schema = z.strictObject({
    lots: z.array(z.strictObject({ items: listeCle(item, 'id') })),
    top: listeCle(z.strictObject({ id: z.string(), sub: listeCle(item, 'id').nullable().optional() }), 'id'),
  });
  const donnee = { lots: [{ items: [{ id: 'a' }] }, { items: [{ id: 'b' }] }], top: [{ id: 'x', sub: null }, { id: 'y', sub: [{ id: 'c' }] }] };

  it('un pas `[]` sous une liste NON marquée désigne un point par élément : lève, données présentes ou non', () => {
    expect(() => collectionALaCle(schema, donnee, 'lots[].items')).toThrow(/« lots\[\]\.items » porte un pas « \[\] »/);
    expect(() => collectionALaCle(schema, { top: [] }, 'lots[].items')).toThrow(/porte un pas « \[\] »/);
    expect(() => collectionALaCle(schema, { lots: [{ items: [{ id: 'a' }] }], top: [] }, 'lots[].items'), 'un seul élément').toThrow(/porte un pas « \[\] »/);
  });

  it('un pas `[]` sous une liste MARQUÉE n’est pas sa graphie (`[clé]`) : lève', () => {
    expect(() => collectionALaCle(schema, donnee, 'top[].sub')).toThrow(/« top\[\]\.sub » porte un pas « \[\] »/);
  });

  it('deux points de la donnée sous la même suite (clé en double) : lève en les comptant', () => {
    const double = { lots: [], top: [{ id: 'x', sub: [{ id: 'c' }] }, { id: 'x', sub: [{ id: 'd' }] }] };
    expect(() => collectionALaCle(schema, double, 'top[x].sub')).toThrow(/« top\[x\]\.sub » désigne 2 points de la donnée/);
  });

  it('`null` se lit comme absent : `valeur: undefined`, comme une collection que la donnée ne porte pas', () => {
    const nulle = collectionALaCle(schema, donnee, 'top[x].sub');
    const presente = collectionALaCle(schema, donnee, 'top[y].sub');
    expect([nulle.valeur, nulle.marque === presente.marque, presente.valeur]).toEqual([undefined, true, [{ id: 'c' }]]);
    expect(collectionALaCle(schema, donnee, 'top[zz].sub').valeur).toBeUndefined();
  });
});

/** Les collections marquées d'un jeu de racines atteintes à travers une union SIMPLE : chaque branche
 *  `|N` de chaque union simple est descendue À PART, une collection partagée y est donc nommée même
 *  quand un autre chemin l'atteint d'abord. */
function collectionsSousUnionSimple(racines: readonly { readonly file: string; readonly schema: unknown }[]): string[] {
  const branches: { readonly noeud: unknown; readonly lieu: string }[] = [];
  descendre(
    racines.map((r) => r.schema),
    ({ noeud, def, path, racine }) => {
      if (def.type !== 'union' || defDe(noeud)?.discriminator !== undefined) return;
      for (const e of enfantsDe(noeud)) if (e.segment.startsWith('|')) branches.push({ noeud: e.noeud, lieu: `${racines[racine].file} ${path}${e.segment}` });
    },
  );
  const out = new Set<string>();
  for (const b of branches) descendre([b.noeud], ({ noeud, path }) => void (collectionDe(noeud) && out.add(b.lieu + path)));
  return [...out];
}

describe('`noyauEnum` — un lecteur d’`enfantsDe` : un seul enfant, de segment `\'\'` ou `[]`', () => {
  const e = z.enum(['a', 'b']);

  it('trouve le `z.enum` à travers optionnel, nullable, défaut, liste et lazy', () => {
    for (const noeud of [e.optional(), e.nullable(), e.default('a'), z.array(e), z.lazy(() => e), z.array(e.optional()).nullable()]) expect(noyauEnum(noeud)).toBe(e);
  });

  it('`undefined` sous une union qui contient un enum, un pipe dont l’entrée est un enum, une intersection', () => {
    for (const noeud of [z.union([e, z.number()]), e.optional().or(z.literal('c')), e.pipe(z.enum(['a', 'b'])), e.transform((v) => v), z.intersection(e, z.string())]) expect(noyauEnum(noeud)).toBeUndefined();
  });

  it('termine sur un cycle de `lazy`', () => {
    const boucle: z.ZodType = z.lazy(() => z.array(boucle));
    expect(noyauEnum(boucle)).toBeUndefined();
  });
});

describe('GARDE — aucune collection marquée sous une union SIMPLE (la branche n’y est désignée que par le parse)', () => {
  it('les racines des deux registres n’en portent aucune', () => {
    expect(collectionsSousUnionSimple([...SCHEMA_DEFS, ...SCHEMA_DEFS_SCENES])).toEqual([]);
  });

  it('la garde MORD : une collection marquée sous une union simple est nommée', () => {
    expect(collectionsSousUnionSimple([{ file: 'fixture.json', schema: z.strictObject({ u: z.union([liste(), z.string()]) }) }])).toEqual(['fixture.json .u|0']);
  });

  it('la garde MORD sur une collection PARTAGÉE, atteinte d’abord hors de l’union, dans la même racine', () => {
    const l = liste();
    expect(collectionsSousUnionSimple([{ file: 'f.json', schema: z.strictObject({ a: l, u: z.union([l, z.string()]) }) }])).toEqual(['f.json .u|0']);
  });

  it('la garde MORD sur une collection PARTAGÉE, atteinte d’abord hors de l’union, par une autre racine', () => {
    const l = liste();
    const racines = [
      { file: 'f.json', schema: z.strictObject({ a: l }) },
      { file: 'g.json', schema: z.strictObject({ u: z.union([l, z.string()]) }) },
    ];
    expect(collectionsSousUnionSimple(racines)).toEqual(['g.json .u|0']);
  });
});
