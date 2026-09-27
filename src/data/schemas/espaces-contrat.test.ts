/**
 * CONTRAT DE L'INDEX DES IDS (#1463) — `IDS_PAR_ESPACE` (`_ids.generated.ts`, phase 2 de `npm run gen`,
 * `scripts/gen-espaces.mts`), keyé par CLÉ D'ESPACE (`grammaire/cle-d-espace.ts`).
 *
 * La construction d'un schéma ne lit plus la table (`grammaire/ref.ts`, `idsVivants.ts:9-11`) : ce qui
 * s'y attrapait s'attrape ici — chaque espace DÉSIGNÉ (`idDe`, `porteLeMarqueur`) a sa cible, chaque
 * document `entite`/`record` a son espace de racine, chaque source de spécialisations ses espaces.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { listerDossier } from '../../../scripts/guards/lib/lister.mjs';
import { indexChargeable, TABLE_VIDE } from '../../../scripts/gen-espaces.mjs';
import { z } from 'zod';
import { IDS_PAR_ESPACE } from './_ids.generated';
import { SCHEMA_DEFS } from './_registry.generated';
import './_registry-scenes.generated';
import '../index';
import { espacesDesignes, idDe, mesureDuParse, refOuSpec } from './grammaire/ref';
import { collectionsDuDocument, listeCle } from './grammaire/collection-cle';
import { HORS_DE_LA_GRAPHIE, cleDesSpecs, cleFiltree, estPrefixeDeSuite, lireCleDEspace, pasDeLaSuite, porteLeChampMarqueur, suiteAvecPas, type PasDeSuite } from './grammaire/cle-d-espace';
import { SOURCES_DE_SPECS, type SourceDeSpecs } from './grammaire/sourcesDeSpecs';

const CLES = Object.keys(IDS_PAR_ESPACE);

describe('INDEX DES IDS — chaque cible a son espace', () => {
  it('chaque document `entite`/`record` de `src/data` a son espace de racine, NON VIDE ; aucun document `config` n’en a', () => {
    const racines = new Set(CLES.filter((c) => !/[#?]/.test(c)));
    const attendues = SCHEMA_DEFS.filter((d) => d.famille !== 'config').map((d) => d.file);
    expect([...racines].sort()).toEqual([...attendues].sort());
    expect(attendues.filter((f) => !IDS_PAR_ESPACE[f]?.length), 'document `entite`/`record` à 0 id').toEqual([]);
  });

  it('chaque spécialisation désignée `{ id, spec }` sur une entrée FERMÉE et spécialisable (`estSpecialisable`) a sa cible à l’espace des `specs` de l’entrée', () => {
    const racine = (f: string) => new Set(IDS_PAR_ESPACE[f]);
    const [competences, talents, traits] = [racine('skills.json'), racine('talents.json'), racine('traits.json')];
    const ouvertes = new Set([...(IDS_PAR_ESPACE['skills.json?specsOpen'] ?? []), ...(IDS_PAR_ESPACE['talents.json?specsOpen'] ?? [])]);
    const fautes: string[] = [];
    let designees = 0;
    const visiter = (v: unknown): void => {
      if (Array.isArray(v)) return v.forEach(visiter);
      if (!v || typeof v !== 'object') return;
      const o = v as { id?: unknown; spec?: unknown };
      if (typeof o.id === 'string' && typeof o.spec === 'string' && !traits.has(o.id) && competences.has(o.id) !== talents.has(o.id) && !ouvertes.has(o.id)) {
        const cle = cleDesSpecs(competences.has(o.id) ? 'skills.json' : 'talents.json', o.id);
        const cible = IDS_PAR_ESPACE[cle];
        if (!cible?.length) return Object.values(v).forEach(visiter);
        designees++;
        if (!cible.includes(o.spec)) fautes.push(`${cle} ∌ « ${o.spec} »`);
      }
      Object.values(v).forEach(visiter);
    };
    for (const f of listerDossier('src/data').filter((x: string) => x.endsWith('.json'))) visiter(JSON.parse(readFileSync(`src/data/${f}`, 'utf8')));
    expect(designees, 'aucune spécialisation désignée : la preuve serait vacante').toBeGreaterThan(50);
    expect([...new Set(fautes)]).toEqual([]);
  });

  it('chaque espace DÉSIGNÉ par une feuille `idDe` ou un `porteLeMarqueur` construit est une clé de l’index', () => {
    const designes = espacesDesignes();
    expect(designes.length, 'aucune désignation construite : la preuve serait vacante').toBeGreaterThan(20);
    expect(designes).toContain('materials.json?domain=roof');
    expect(designes).toContain('props.json?volume');
    expect(designes.filter((c) => !(c in IDS_PAR_ESPACE))).toEqual([]);
  });

  it('chaque source de spécialisations a son univers et son pool à l’index, le pool ⊆ l’univers', () => {
    const fautes = Object.entries(SOURCES_DE_SPECS as Record<string, SourceDeSpecs>).flatMap(([nom, s]) => {
      const univers = IDS_PAR_ESPACE[s.univers];
      const pool = IDS_PAR_ESPACE[s.pool ?? s.univers];
      if (!univers?.length || !pool?.length) return [`${nom} : espace absent ou vide`];
      return pool.filter((id) => !univers.includes(id)).map((id) => `${nom} : « ${id} » au pool, hors univers`);
    });
    expect(fautes).toEqual([]);
  });

  it('la GRAPHIE est univoque : une clé se relit à l’identique, aucun pas `[clé]` ni filtre ne porte `[`, `]`, `#`, `?` ou `=`', () => {
    const fautes = CLES.flatMap((cle) => {
      const lue = lireCleDEspace(cle);
      const pas = [...(lue.niche ?? '').matchAll(/\[([^\]]*)\]/g)].map((m) => m[1]);
      const base = lue.niche === undefined ? lue.fichier : `${lue.fichier}#${lue.niche}`;
      const relue = lue.filtre ? cleFiltree(base, lue.filtre) : base;
      const ennemis = [...pas, ...(lue.filtre ? [lue.filtre.champ, lue.filtre.vaut ?? ''] : [])].filter((p) => HORS_DE_LA_GRAPHIE.test(p) || /[[\]]/.test(p));
      return relue !== cle || ennemis.length ? [cle] : [];
    });
    expect(fautes).toEqual([]);
  });

  it('les racines s’écrivent `\'fichier.json\': [` — la graphie que lisent les migrations datées (`scripts/migrations/2026-09-01-1463-*.mjs`)', () => {
    const texte = readFileSync(new URL('./_ids.generated.ts', import.meta.url), 'utf8');
    expect(texte).toMatch(/'careers\.json':\s*\[/);
  });
});

describe('AMORÇAGE — la co-descente relève les collections sans lire l’index', () => {
  const NEUVE = 'competence-neuve-du-meme-commit';
  const schema = z.strictObject({
    lignes: listeCle(z.strictObject({ id: z.string(), competence: idDe('skill'), designee: refOuSpec('skill').optional() }), 'id', { espace: {} }),
  });
  const donnee = { lignes: [{ id: 'a', competence: NEUVE, designee: { id: 'art', spec: 'spec-neuve-du-meme-commit' } }] };

  it('un espace neuf et ses désignateurs se mesurent avant d’être à l’index', () => {
    expect(collectionsDuDocument(schema, donnee).map((c) => [c.suite, c.marque.forme, c.ids])).toEqual([['lignes', 'liste', ['a']]]);
  });

  it('au parse, la même donnée est refusée contre l’index', () => {
    expect(schema.safeParse(donnee).success).toBe(false);
    expect(() => mesureDuParse(schema, donnee)).toThrow(/invalide au parse normal/);
  });
});

describe('AMORÇAGE — `npm run gen` répare un index illisible', () => {
  it('un index en conflit, vide ou sans `IDS_PAR_ESPACE` n’est pas chargeable ; la table vide et l’index courant le sont', () => {
    const courant = readFileSync(new URL('./_ids.generated.ts', import.meta.url), 'utf8');
    const conflit = `<<<<<<< HEAD\n${courant}=======\n${courant}>>>>>>> autre\n`;
    expect([conflit, '', 'export const IDS_PAR_DATASET = {};\n', TABLE_VIDE, courant].map(indexChargeable)).toEqual([false, false, false, true, true]);
  });

  it('la phase 2 sur une table VIDE rend le même index que sur la table courante', () => {
    const table = 'export const IDS_PAR_ESPACE = {};';
    const crochets = `export async function resolve(s, c, n) { return /_ids\\.generated(\\.ts)?$/.test(s) ? { url: 'data:text/javascript,' + encodeURIComponent(${JSON.stringify(table)}), shortCircuit: true } : n(s, c); }`;
    const code = [
      "import { register } from 'node:module';",
      `register('data:text/javascript,' + encodeURIComponent(${JSON.stringify(crochets)}));`,
      "const { IDS_PAR_ESPACE } = await import('./src/data/schemas/_ids.generated.ts');",
      "const { indexDesIds } = await import('./scripts/gen-espaces.mts');",
      'console.log(JSON.stringify({ vue: Object.keys(IDS_PAR_ESPACE).length, index: Object.fromEntries(await indexDesIds()) }));',
    ].join('\n');
    const r = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    expect(r.status, r.stderr).toBe(0);
    const { vue, index } = JSON.parse(r.stdout.trim().split('\n').pop()!) as { vue: number; index: Record<string, string[]> };
    expect(vue, 'la table vue par l’enfant n’est pas la table vide').toBe(0);
    expect(index).toEqual(IDS_PAR_ESPACE);
  }, 60_000);
});

describe('GRAPHIE DES SUITES — `suiteAvecPas` écrit, `pasDeLaSuite` et `estPrefixeDeSuite` lisent', () => {
  const PAS: readonly PasDeSuite[] = [{ champ: 'specs' }, { cle: 'art' }, { rang: true }];

  it('aller-retour `pasDeLaSuite(suiteAvecPas(…))` sur chaque forme de pas, en premier pas et après chacune', () => {
    for (const premier of PAS) {
      expect(pasDeLaSuite(suiteAvecPas('', premier))).toEqual([premier]);
      for (const second of PAS) expect(pasDeLaSuite(suiteAvecPas(suiteAvecPas('', premier), second))).toEqual([premier, second]);
    }
    expect(pasDeLaSuite('')).toEqual([]);
  });

  it('`estPrefixeDeSuite` : la racine, la suite elle-même, un point suivi de `.champ` ou `[…]` ; pas un préfixe de nom', () => {
    const cas: [string, string, boolean][] = [
      ['', '[art].specs', true],
      ['[art].specs', '[art].specs', true],
      ['[art]', '[art].specs', true],
      ['lots', 'lots[].items', true],
      ['rang', 'rangedMod', false],
      ['[art].spec', '[art].specs', false],
    ];
    for (const [prefixe, suite, attendu] of cas) expect([prefixe, suite, estPrefixeDeSuite(prefixe, suite)]).toEqual([prefixe, suite, attendu]);
  });
});

describe('MARQUEUR — un seul prédicat', () => {
  it('une entrée PORTE le marqueur quand le champ est présent, ni `false` (décochage au Codex), ni vide', () => {
    const racine = [{ id: 'coche', m: true }, { id: 'decoche', m: false }, { id: 'absent' }, { id: 'objet', m: { h: 1 } }, { id: 'liste-vide', m: [] }, { id: 'liste', m: ['x'] }, { id: 'texte', m: 'Aqshy' }];
    expect(racine.filter((e) => porteLeChampMarqueur(e, 'm')).map((e) => e.id)).toEqual(['coche', 'objet', 'liste', 'texte']);
  });
});
