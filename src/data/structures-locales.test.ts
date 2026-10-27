/**
 * STRUCTURES LOCALES (#1463, #3012 N1) : la dette de structure mesurée sur le SCHÉMA
 * (`scripts/guards/lib/structuresLocales.mts`) et son stock (`horsStrateStock.mjs`, `STRUCTURES_LOCALES`). Le contrat
 * #2995 (une donnée saine ajoutée ou retirée ne fait naître aucun site) se prouve sur toute la porte : `src/comptes-plage.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { enfantsDe } from './schemas/grammaire/descente';
import { nommerNoeud } from './schemas/grammaire/meta';
import { idDe, ref } from './schemas/grammaire/ref';
import { formulaSinSchema } from './schemas/grammaire/valeurs';
import type { SchemaDef } from './schemas/types';
import { STRUCTURES_LOCALES } from '../../scripts/guards/lib/horsStrateStock.mjs';
import { STRUCTURES_LOCALES as VOLET } from '../../scripts/guards/lib/occurrencesStock.mjs';
import { PORTEURS } from '../../scripts/guards/lib/porteursDesComptes.mjs';
import { ecartDuVolet, remedeDeNaissance } from '../../scripts/guards/lib/stock.mjs';
import { ecartDeRegeneration, texteEnPlace } from '../../scripts/guards/lib/stockDeSites.mjs';
import { cheminsDeDocument, nomDeBranche, noeudsDeStructure, regenerations, sitesDeStructure } from '../../scripts/guards/lib/structuresLocales.mts';

/** Les options d'une union, dans leur ordre (`enfantsDe`). */
const options = (union: unknown) => enfantsDe(union).filter((e) => e.segment.startsWith('|')).map((e) => e.noeud);
const lignes = (xs: readonly string[]) => [...xs].sort();

describe('stock des structures locales : observé == stock', () => {
  it('chaque site mesuré est au stock et chaque entrée du stock est mesurée', () => {
    const { neuves, perimees } = ecartDuVolet({
      sites: sitesDeStructure(),
      stock: STRUCTURES_LOCALES,
      ou: `\`${PORTEURS.STRUCTURES_LOCALES}\``,
      remede: { neuve: remedeDeNaissance(VOLET.cible) },
    });
    expect(lignes(neuves), 'structure(s) locale(s) NÉE(s) : appliquer le remède de chaque site nommé.').toEqual([]);
    expect(
      lignes(perimees),
      'entrée(s) SOLDÉE(s) : régénérer par `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/structuresLocales.mts`.',
    ).toEqual([]);
  });

  it('le stock committé est un point fixe de sa régénération', () => {
    for (const r of regenerations()) expect(ecartDeRegeneration(r, texteEnPlace(r.chemin))).toBeNull();
  });
});

describe('classes d’un nœud de site', () => {
  const nomme = <N extends z.ZodType>(noeud: N) => nommerNoeud(noeud, { nom: 'sonde' });
  const exclusif = { sondeSeule: nomme(z.number()) };
  const partage = () => ref('skill', { sondePartagee: nomme(z.boolean()) });
  const a = z.array(z.strictObject({
    id: z.string(),
    type: z.literal('a'),
    variants: z.array(z.strictObject({ k: z.string(), sous: z.strictObject({ y: z.number() }) })),
    local: z.strictObject({ n: z.number() }),
    libre: z.unknown(),
    seul: ref('skill', exclusif),
    porte: ref('skill', { sondeAncre: nomme(z.strictObject({ x: z.number() })) }),
    commun: partage(),
  }));
  const b = z.array(z.strictObject({ id: z.string(), type: z.literal('b'), commun: partage() }));
  const def = (file: string, schema: z.ZodType): SchemaDef => ({ file, root: 'src/data', famille: 'entite', schema });
  const classes = (defs: SchemaDef[]) =>
    noeudsDeStructure(defs).map((n) => `${n.classe} ${n.fichier} :: ${n.ref}`);

  it('D5, G, G1, L ; racine, entrée et enveloppe ne sont pas des sites ; l’enfant apporté par le def reste à lui', () => {
    expect(classes([def('a.json', a), def('b.json', b)])).toEqual([
      'G src/data#a :: [].commun',
      'D5 src/data#a :: [].libre',
      'L src/data#a :: [].local',
      'G1 src/data#a :: [].porte',
      'L src/data#a :: [].porte.sondeAncre',
      'G1 src/data#a :: [].seul',
      'L src/data#a :: [].variants[].sous',
      'G src/data#b :: [].commun',
    ]);
  });

  it('un produit se juge sur sa CLASSE : composé par un seul def, il est G1', () => {
    expect(classes([def('a.json', a)])).toContain('G1 src/data#a :: [].commun');
  });

  it('un schéma se nomme `‹racine›#‹type›`, quels que soient le nombre et l’ordre de ses documents : un deuxième document ne renomme rien', () => {
    const projet = z.strictObject({ type: z.literal('sonde'), local: z.strictObject({ n: z.number() }) });
    const config = (file: string): SchemaDef => ({ ...def(file, projet), famille: 'config' });
    const noms = (defs: SchemaDef[]) => [...new Set(noeudsDeStructure(defs).map((n) => n.fichier))];
    for (const defs of [[config('a.json')], [config('b.json'), config('a.json')], [config('a.json'), config('c.json'), config('b.json')]])
      expect(noms(defs)).toEqual(['src/data#sonde']);
    expect(noms([def('a.json', a)]), 'le `type` d’un document `entite` se lit à son entrée').toEqual(['src/data#a']);
  });

  it('un schéma sans `type` unique à son enveloppe, sous deux racines ou deux familles, ou deux schémas d’un même nom LÈVENT', () => {
    const config = (schema: z.ZodType): SchemaDef => ({ ...def('a.json', schema), famille: 'config' });
    const rangee = z.strictObject({ entries: z.array(z.strictObject({ type: z.literal('rangee') })) });
    expect(() => noeudsDeStructure([config(rangee)]), 'le `type` d’une rangée n’est pas celui du document').toThrow(/sans `type` unique/);
    expect(() => noeudsDeStructure([config(z.strictObject({ type: z.enum(['a', 'b']) }))])).toThrow(/sans `type` unique/);
    expect(() => noeudsDeStructure([def('a.json', z.array(z.strictObject({ id: z.string() })))])).toThrow(/sans `type` unique/);
    expect(() => noeudsDeStructure([def('a.json', a), { ...def('a.json', a), root: 'src/scenes' }])).toThrow(/sous plusieurs racines/);
    expect(() => noeudsDeStructure([def('a.json', a), { ...def('a2.json', a), famille: 'record' }])).toThrow(/sous plusieurs familles/);
    const autreA = z.array(z.strictObject({ id: z.string(), type: z.literal('a') }));
    expect(() => noeudsDeStructure([def('a.json', a), def('a2.json', autreA)])).toThrow(/src\/data#a nomme deux schémas/);
  });
});

describe('clé d’un site', () => {
  it('une option `z.lazy` se nomme `|<lazy>` et ses branches sous elle : la somme de la formule ne collisionne pas avec celle de la Colère des dieux', () => {
    const sansDiscriminant = z.union([z.lazy(() => z.union([z.strictObject({ sum: z.number() }), z.number()])), z.strictObject({ sum: z.string() })]);
    const cles = noeudsDeStructure([{ file: 'x.json', root: 'src/data', famille: 'config', schema: z.strictObject({ type: z.literal('x'), v: sansDiscriminant }) }]).map((n) => n.ref);
    expect(cles).toEqual(['.v|<lazy>|{sum}', '.v|{sum}']);
    const somme = noeudsDeStructure().find((n) => n.fichier === 'src/data#miscast' && n.ref === '[].entries[].ops[].amount|{sum}');
    expect(somme?.noeud, 'la clé `amount|{sum}` de miscast.json nomme la somme de `formulaSinSchema`, pas celle de `formulaSchema`.').toBe(
      options(formulaSinSchema)[2],
    );
  });

  it('nom de branche : discriminant, clés déclarées et valeurs littérales, type', () => {
    const disc = z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('a'), n: z.number() }), z.strictObject({ kind: z.literal('b') })]);
    expect(nomDeBranche(disc, options(disc)[0])).toBe('|kind=a');
    const libre = z.union([z.strictObject({ op: z.literal('>='), value: z.number() }), z.string()]);
    expect(nomDeBranche(libre, options(libre)[0])).toBe('|{op=>=,value}');
    expect(nomDeBranche(libre, options(libre)[1])).toBe('|<string>');
  });

  it('deux nœuds d’un même type à la même clé LÈVENT (injectivité)', () => {
    const double = z.strictObject({ type: z.literal('x'), v: z.union([z.strictObject({ a: z.string() }), z.strictObject({ a: z.number() })]) });
    expect(() => noeudsDeStructure([{ file: 'x.json', root: 'src/data', famille: 'config', schema: double }])).toThrow(/deux nœuds à la même clé src\/data#x :: \.v\|\{a\}/);
  });

  describe('point conjoint : une intersection et les enfants de même clé de ses côtés sont UN site', () => {
    /** Les sites d'un champ `v` de document, `‹classe› ‹clé›`. */
    const sitesDe = (champ: z.ZodType) =>
      noeudsDeStructure([{ file: 'x.json', root: 'src/data', famille: 'config', schema: z.strictObject({ type: z.literal('x'), v: champ }) }])
        .map((n) => `${n.classe} ${n.ref}`);
    const apparence = () => z.looseObject({ forme: z.strictObject({ n: z.number() }).optional() });

    it('un côté non validant fait le point D5 et y juge le reste d’un objet conjoint', () => {
      expect(sitesDe(z.custom<object>().and(apparence()))).toEqual(['D5 .v', 'L .v.forme']);
      expect(sitesDe(z.custom<object>().and(apparence()).optional()), 'enveloppe autour de l’intersection').toEqual(['D5 .v', 'L .v.forme']);
      expect(sitesDe(z.custom<object>().and(apparence().optional())), 'enveloppe autour d’un côté').toEqual(['D5 .v', 'L .v.forme']);
      expect(sitesDe(z.strictObject({ a: z.number() }).and(z.strictObject({ b: z.number() })).and(z.unknown())), 'intersection imbriquée').toEqual(['D5 .v']);
      expect(sitesDe(z.custom<object>().and(z.strictObject({ a: z.number() }).transform((x) => x))), 'côté pipe').toEqual(['D5 .v']);
    });

    it('le reste d’un objet conjoint reste un site D5 tant qu’aucun objet ne le ferme', () => {
      expect(sitesDe(z.looseObject({ a: z.number() }))).toEqual(['L .v', 'D5 .v.*']);
      expect(sitesDe(z.looseObject({ a: z.number() }).and(z.object({}))), 'objet `strip`').toEqual(['L .v', 'D5 .v.*']);
      expect(sitesDe(z.looseObject({ a: z.number() }).and(z.looseObject({}))), 'deux restes libres').toEqual(['L .v', 'D5 .v.*']);
      expect(sitesDe(z.looseObject({ a: z.number() }).and(apparence())), 'cas satisfiable de deux objets').toEqual(['L .v', 'D5 .v.*', 'L .v.forme']);
      expect(sitesDe(z.looseObject({ a: z.number() }).and(z.preprocess((x) => x, z.strictObject({ a: z.number(), b: z.number() })))), 'fermé par un objet strict sous pipe').toEqual(['L .v']);
      expect(sitesDe(z.strictObject({ a: z.number() }).and(z.record(z.string(), z.unknown()))), 'record conjoint').toEqual(['L .v', 'D5 .v{}']);
    });

    it('les enfants de même clé de côtés conjoints sont une intersection implicite : un site, jamais deux nœuds à la même clé', () => {
      expect(sitesDe(z.strictObject({ f: z.strictObject({ a: z.number() }) }).and(z.strictObject({ f: z.strictObject({ a: z.number() }) })))).toEqual(['L .v', 'L .v.f']);
      expect(sitesDe(z.looseObject({ f: z.looseObject({ a: z.number() }) }).and(z.looseObject({ f: z.looseObject({ b: z.number() }) })))).toEqual([
        'L .v', 'D5 .v.*', 'L .v.f', 'D5 .v.f.*',
      ]);
      expect(sitesDe(z.strictObject({ a: z.number(), forme: z.strictObject({ n: z.number() }).optional() }).and(apparence()))).toEqual(['L .v', 'L .v.forme']);
      expect(sitesDe(z.string().and(z.string().min(1))), 'aucun objet ni nœud non validant : pas de site').toEqual([]);
    });

    it('l’empreinte d’un point est celle de ses champs fusionnés (`empreinteDeChamps`) ; ses chemins conjoints se jugent ensemble', () => {
      const schema = z.strictObject({ type: z.literal('x'), v: z.strictObject({ id: idDe('skill') }).and(z.looseObject({ id: z.string(), b: z.number() })) });
      const defs: SchemaDef[] = [{ file: 'x.json', root: 'src/data', famille: 'config', schema }];
      expect(noeudsDeStructure(defs).map((n) => `${n.ref} ${n.empreinte}`)).toEqual(['.v *:intersection,b:number,id:intersection']);
      expect(cheminsDeDocument(defs).find((c) => c.ref === '.v.id')?.etat, 'une référence conjointe à une chaîne reste une référence').toBe('idDe');
    });
  });
});
