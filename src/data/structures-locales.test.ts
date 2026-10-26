/**
 * STRUCTURES LOCALES (#1463, #3012 N1) : la dette de structure mesurée sur le SCHÉMA
 * (`scripts/guards/lib/structuresLocales.mts`), son stock (`horsStrateStock.mjs`, `STRUCTURES_LOCALES`) et le contrat
 * #2995 : une donnée conforme ajoutée ne crée aucun site.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';
import { enfantsDe } from './schemas/grammaire/descente';
import { nommerNoeud } from './schemas/grammaire/meta';
import { ref } from './schemas/grammaire/ref';
import { formulaSinSchema } from './schemas/grammaire/valeurs';
import type { SchemaDef } from './schemas/types';
import { listerDocuments } from '../../scripts/docs/lib/structures-scan.mjs';
import { STRUCTURES_LOCALES } from '../../scripts/guards/lib/horsStrateStock.mjs';
import { STRUCTURES_LOCALES as VOLET } from '../../scripts/guards/lib/occurrencesStock.mjs';
import { PORTEURS } from '../../scripts/guards/lib/porteursDesComptes.mjs';
import { ecartDuVolet, remedeDeNaissance } from '../../scripts/guards/lib/stock.mjs';
import { ecartDeRegeneration, texteEnPlace } from '../../scripts/guards/lib/stockDeSites.mjs';
import { nomDeBranche, noeudsDeStructure, regenerations, sitesDeStructure } from '../../scripts/guards/lib/structuresLocales.mts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
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
});

/** Les fichiers TEXTE d'une copie de l'arbre : ce que lit la génération du code et la mesure. */
const TEXTE = /\.(?:md|json|ts|tsx|mts|mjs|js|cjs|css|snap)$/;

describe('#2995 : une donnée conforme ajoutée ne crée aucun site', () => {
  it('une entrée copiée sous un id neuf dans chaque dataset et un projet de scène neuf trié en tête, cibles de code régénérées : la mesure est identique', { timeout: 240_000 }, () => {
    const dossier = mkdtempSync(join(tmpdir(), 'structures-locales-2995-'));
    try {
      for (const rel of ['src', 'scripts']) {
        cpSync(join(ROOT, rel), join(dossier, rel), { recursive: true, filter: (p) => !p.includes('node_modules') && (!/\.[A-Za-z0-9]+$/.test(p) || TEXTE.test(p)) });
      }
      for (const rel of ['package.json', 'tsconfig.json']) cpSync(join(ROOT, rel), join(dossier, rel));
      let ajoutees = 0;
      for (const d of listerDocuments(ROOT)) {
        const donnee = JSON.parse(readFileSync(join(ROOT, d.chemin), 'utf8')) as unknown;
        if (!Array.isArray(donnee) || typeof donnee[0]?.id !== 'string') continue;
        donnee.push({ ...donnee[0], id: `${donnee[0].id}-sonde-2995` });
        writeFileSync(join(dossier, d.chemin), JSON.stringify(donnee, null, 2));
        ajoutees += 1;
      }
      expect(ajoutees, 'aucun dataset à entrées n’a reçu de copie : la sonde ne prouverait rien.').toBeGreaterThan(50);
      const projet = 'aaa-sonde-2995/aaa-sonde-2995-projet.json';
      cpSync(join(ROOT, 'src/scenes/arene/arene-projet.json'), join(dossier, 'src/scenes', projet), { recursive: true });
      const module = readFileSync(join(ROOT, 'src/data/schemas/defs-scenes/arene.ts'), 'utf8').replace("'arene/arene-projet.json'", `'${projet}'`);
      writeFileSync(join(dossier, 'src/data/schemas/defs-scenes/aaa-sonde-2995.ts'), module);
      const url = (rel: string) => JSON.stringify(pathToFileURL(join(dossier, rel)).href);
      const env = Object.fromEntries(Object.entries(process.env).filter(([nom]) => !nom.startsWith('GIT_')));
      execFileSync(process.execPath, ['--input-type=module', '-e', `const { preparerExport } = await import(${JSON.stringify(pathToFileURL(join(ROOT, 'scripts/migrations/replay-head.mjs')).href)}); preparerExport(process.argv[1]);`, dossier], { cwd: dossier, env, stdio: 'pipe' });
      expect(readFileSync(join(dossier, 'src/data/schemas/_registry-scenes.generated.ts'), 'utf8'), 'le projet neuf n’est pas au registre régénéré : la sonde ne prouverait rien.').toContain('aaa-sonde-2995');
      const mesure = execFileSync(process.execPath, [join(ROOT, 'node_modules/tsx/dist/cli.mjs'), '--input-type=module', '-e', `const { sitesDeStructure } = await import(${url('scripts/guards/lib/structuresLocales.mts')}); process.stdout.write(JSON.stringify(sitesDeStructure()));`], { cwd: dossier, env, encoding: 'utf8', maxBuffer: 1 << 28 });
      expect(JSON.parse(mesure), 'une donnée ajoutée a changé la mesure : elle lit autre chose que les defs.').toEqual(sitesDeStructure());
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});
