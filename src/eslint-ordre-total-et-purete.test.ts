import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blocsDeRegle, creerBancLint, lintFixtures, selectionnerMessages, configPourFichier } from '../scripts/guards/lib/lint.testkit.mjs';
import { correspondGlob } from '../scripts/guards/lib/lister.mjs';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { estFichierVitest, estKitDeTest, estSuiteVitest } from '../scripts/guards/lib/fichierVitest.mjs';
import { estDeLaSuiteVitest } from '../scripts/guards/lib/racinesDeLaSuite.mjs';
import {
  COUCHES,
  DROITS_D_UN_PROJET,
  PAQUETS_DE_L_HOTE_WEB,
  RACINES_DES_ZONES,
  SURFACE_DU_NOYAU,
  dossierDe,
  estProjet,
  estZone,
  fermeParLeProjet,
  fermeture,
  ligneDeProjet,
  ouvertes,
  paquetFerme,
  porteManquee,
  zoneDe,
} from '../scripts/guards/lib/couches.mjs';

/**
 * BANC DES MURS DE COUCHE (#1709, #2882 ; AGENTS.md règle stricte 3).
 *
 * Les zones du dépôt et leurs sens d'import se disent UNE fois, dans `COUCHES`
 * (`scripts/guards/lib/couches.mjs`), et se jouent par la gate `lint` (`murs/purete-imports`, `murs/tests-survivants`,
 * `murs/zone`, `murs/suite-jouee`, `murs/reexportation`, `murs/quarantaine`). Ce banc lit cette table, ne la recopie pas, et MESURE la
 * config RÉSOLUE :
 *  1. CONTRAT de la table — chaque zone nommée existe, le dossier de chaque zone est à elle (`zoneDe`), une zone qui
 *     survit à la bascule (`survit`) n'ouvre que des zones qui survivent, chaque script d'`outillage` et chacun de ses
 *     modules existent, l'un dans sa zone, les autres hors des zones, la ligne d'un projet est celle de son
 *     constructeur, aucune autre ligne ne le nomme et aucune de ses ouvertures n'est morte, `fermeture` et `ouvertes`
 *     le ferment à toute autre zone, et `fermeture`, `porteManquee` et `paquetFerme` rendent, sur un ORACLE écrit à la
 *     main, le verdict de chaque classe de ligne ;
 *  2. PÉRIMÈTRE — des fichiers RÉELS de chaque zone (racine et sous-dossier) sont sous les murs ; une zone dont
 *     l'arbre ne porte pas le dossier se mesure sur des fixtures posées dans son dossier ;
 *  3. FORMES — pour chaque paire de zones, chaque forme d'import rend le verdict de `fermeture`, et, depuis une
 *     suite de la zone, celui de `fermeParLaSurvie` (INSTRUMENTS, #3058) et de `fermeParLeProjet` (#4903 H3), depuis des fichiers de la zone, par chemin relatif, par alias `@/` (vers une zone de `src/`), par chemin `/…` et vers
 *     l'index du dossier : la matrice prouve le CÂBLAGE (zone, cible, type ou valeur), l'oracle prouve la table ;
 *  4. PAQUETS, JOKER — chaque zone × chaque paquet de l'hôte web rend le verdict de `paquetFerme` ; un motif de glob
 *     dont un joker peut atteindre une zone fermée au fichier est refusé, un projet depuis `racine` compris ;
 *  5. JSX, HORS ZONE — chaque zone qui survit refuse le JSX et tout module de code hors des zones, hors des modules
 *     que l'`outillage` d'un de ses scripts déclare pour ce script seul ; une zone qui ne survit pas, une donnée passent ;
 *  6. RÉEXPORTATION, SUITE JOUÉE, QUARANTAINE — chaque forme refusée l'est, chaque forme voisine passe ; chaque
 *     fichier en quarantaine existe ;
 *  7. FERMETURE — un fichier d'une zone non déclarée est refusé, un fichier d'une zone déclarée passe.
 * Ensemble, CONTRAT, PAQUETS, JSX et HORS ZONE impliquent que chaque arc qu'un module d'une zone qui survit trace
 * mène à une zone qui survit, à un paquet hors de l'hôte web, à une donnée, ou à un module d'outillage déclaré, que
 * seul son script lit ; le mur est LEXICAL, ce module d'outillage n'y est pas suivi. Les suites et bancs de ces zones
 * sont sous `murs/tests-survivants` (#3058 : INSTRUMENTS) ; la clôture d'imports de tout module de ces zones, production
 * comprise, est sous le mur `scripts/corpus/guards/clotureDesZonesQuiSurvivent.test.mjs`.
 *
 * PIÈGE MESURÉ : sans config explicite, un outil peut rendre `ruleId` nul et tout paraît « pris » par
 * vacuité — d'où la sélection par le MESSAGE du mur, puis l'assertion sur son `ruleId`.
 */

const REGLE = 'murs/purete-imports';
const REEX = 'murs/reexportation';
const INSTR = 'murs/tests-survivants';
const SUITE_JOUEE = 'murs/suite-jouee';
const ZONES = Object.keys(COUCHES).filter((z) => z !== 'racine');

/** L'objet de Vitest que les fixtures appellent pour mocker : le banc ne mocke rien, il écrit le code qu'il lint
 *  (`src/vi-mock-isolate-guard.test.ts` lit le texte des suites). */
const MOQUEUR = 'vi';

/** Les formes d'import vers `p` ; `type` : la forme s'efface à la compilation ; `reexporte` : elle réexporte. */
const FORMES: { nom: string; code: (p: string) => string; type: boolean; reexporte?: boolean }[] = [
  { nom: 'statique nommé', code: (p) => `import { X } from '${p}';\nexport const a = X;\n`, type: false },
  { nom: 'side-effect', code: (p) => `import '${p}';\n`, type: false },
  { nom: 'dynamique', code: (p) => `export const f = async () => (await import('${p}')).X;\n`, type: false },
  { nom: 'dynamique gabarit', code: (p) => `export const f = async () => (await import(\`${p}\`)).X;\n`, type: false },
  { nom: 'require', code: (p) => `export const r = require('${p}');\n`, type: false },
  { nom: 'require gabarit', code: (p) => `export const r = require(\`${p}\`);\n`, type: false },
  { nom: '`createRequire(…)(…)`', code: (p) => `export const r = createRequire(import.meta.url)('${p}');\n`, type: false },
  { nom: '`module.require`', code: (p) => `export const r = module.require('${p}');\n`, type: false },
  { nom: '`module.require` gabarit', code: (p) => `export const r = module.require(\`${p}\`);\n`, type: false },
  { nom: 'inline type `import(…).T`', code: (p) => `export type A = import('${p}').X;\n`, type: true },
  { nom: '`typeof import(…)`', code: (p) => `export type A = typeof import('${p}');\n`, type: true },
  { nom: 'import type … from', code: (p) => `import type { X } from '${p}';\nexport type A = X;\n`, type: true },
  { nom: 'mixte { type X, y }', code: (p) => `import { type X, y } from '${p}';\nexport const a = y;\nexport type B = X;\n`, type: false },
  { nom: 'export … from', code: (p) => `export { X } from '${p}';\n`, type: false, reexporte: true },
  { nom: '`export *`', code: (p) => `export * from '${p}';\n`, type: false, reexporte: true },
  { nom: '`import x = require()`', code: (p) => `import x = require('${p}');\nexport const a = x;\n`, type: false },
  { nom: '`vi.mock`', code: (p) => `${MOQUEUR}.mock('${p}');\n`, type: false },
  { nom: '`vi.doMock`', code: (p) => `${MOQUEUR}.doMock('${p}');\n`, type: false },
  { nom: '`vi.importActual`', code: (p) => `export const f = () => vi.importActual('${p}');\n`, type: false },
  { nom: '`vi.importMock`', code: (p) => `export const f = () => vi.importMock('${p}');\n`, type: false },
  { nom: 'import.meta.glob', code: (p) => `export const g = import.meta.glob('${p}.ts');\n`, type: false },
];

/** Les murs de couche qui ont pris chaque fixture (messages porteurs de `#2882`), joints, ou `passe` ;
 *  chaque message pris doit venir d'une règle de `regles`. */
function verdicts(fixtures: { filePath: string; code: string }[], regles: readonly string[]): string[] {
  return lintFixtures(fixtures).map((res) => {
    const pris = selectionnerMessages(res, (m) => m.message.includes('#2882'));
    for (const m of pris) expect(regles, `${res.filePath} : ${m.message}`).toContain(m.ruleId);
    return [...new Set(pris.map((m) => m.ruleId!))].sort().join('+') || 'passe';
  });
}

/** Des fichiers TypeScript RÉELS de la zone, comme les fixtures, tests exclus (ordre total de `readCorpus`, jamais un
 *  nom en dur) : le PREMIER, et un fichier de SOUS-DOSSIER quand la zone en a — un spécificateur de remontée `../../` ne
 *  se comporte pas comme à la racine de la zone. Une zone dont le dossier, hors de `src/`, est absent de l'arbre : deux
 *  fixtures de son dossier, à sa racine et en sous-dossier ; sous `src/`, un dossier absent ou sans fichier lève
 *  (`readCorpus`) : une ligne sans dossier ne passe jamais sur des fixtures. */
function sondes(zone: string): string[] {
  const dossier = dossierDe(zone);
  if (!dossier.startsWith('src/') && !existsSync(new URL(`../${dossier}`, import.meta.url))) return [`${dossier}/zz-sonde.ts`, `${dossier}/zz-sous/sonde.ts`];
  const corpus = readCorpus([dossier], { exts: ['.ts'] });
  const sousDossier = corpus.find((f) => f.rel.slice(dossier.length + 1).includes('/'));
  return sousDossier ? [corpus[0].rel, sousDossier.rel] : [corpus[0].rel];
}

/** Spécificateur relatif de `rel` vers `cible` (chemins relatifs à la racine du dépôt). */
const relatif = (rel: string, cible: string) => {
  const p = posix.relative(posix.dirname(rel), cible);
  return p.startsWith('.') ? p : `./${p}`;
};

/** L'alias `@/` de `cible`, `null` hors de `src/`. */
const alias = (cible: string) => (cible.startsWith('src/') ? `@/${cible.slice('src/'.length)}` : null);

/** Les spécificateurs de `rel` vers `<dossier de vers>/x` : relatif, alias `@/` quand la zone est sous `src/`, chemin `/…`. */
const specifieurs = (rel: string, vers: string): string[] => {
  const cible = `${dossierDe(vers)}/x`;
  return [relatif(rel, cible), alias(cible), `/${cible}`].filter((p): p is string => p !== null);
};

/** Les arcs de `rel` vers la zone `vers` que la matrice joue : `specifieurs` vers `<dossier>/x`, et l'index du
 *  dossier en relatif — sans motif de glob, qui viserait le fichier `<dossier>.ts`. */
const arcsVers = (rel: string, vers: string): { p: string; cible: string; avecMotif: boolean }[] => [
  ...specifieurs(rel, vers).map((p) => ({ p, cible: `${dossierDe(vers)}/x`, avecMotif: true })),
  { p: relatif(rel, dossierDe(vers)), cible: dossierDe(vers), avecMotif: false },
];

/** Les chargeurs qu'une suite emploie hors de la lecture des arcs (#3058, `surCalcule` de `visiteurDArcs`). */
const CHARGEURS_DETOURNES: [forme: string, code: string][] = [
  ['`import { vi as v }`', "import { vi as v } from 'vitest';\nexport const f = () => v.importActual('./zz-a');\n"],
  ['`const v = vi`', "import { vi } from 'vitest';\nconst v = vi;\nexport const f = () => v.importActual('./zz-a');\n"],
  ['`vi[…]`', "import { vi } from 'vitest';\nexport const f = () => vi['importActual']('./zz-a');\n"],
  ['`vi.importActual.call`', "import { vi } from 'vitest';\nexport const f = () => vi.importActual.call(vi, './zz-a');\n"],
  ['`const { importActual } = vi`', "import { vi } from 'vitest';\nconst { importActual } = vi;\nexport const f = () => importActual('./zz-a');\n"],
  ['`createRequire as cr`', "import { createRequire as cr } from 'node:module';\nexport const s = cr(import.meta.url)('./zz-a');\n"],
  ['`createRequire` déstructuré', "import nm from 'node:module';\nconst { createRequire: cr } = nm;\nexport const s = cr(import.meta.url)('./zz-a');\n"],
  ['requireur réaffecté', "import { createRequire } from 'node:module';\nconst r = createRequire(import.meta.url);\nconst r2 = r;\nexport const s = r2('./zz-a');\n"],
  ['`createRequire(…)` dans un objet', "import { createRequire } from 'node:module';\nconst m = { require: createRequire(import.meta.url) };\nexport const s = m['require']('./zz-a');\n"],
  ['`module[…]`', "export const s = module['require']('./zz-a');\n"],
  ['`require` passé', 'export const s = [require].map((r) => r(\'./zz-a\'));\n'],
  ['motif de glob calculé', "const p = './*.ts';\nexport const g = import.meta.glob(p);\n"],
];

/** Les emplois de chargeur que la lecture des arcs suit, ou qui ne chargent rien. */
const CHARGEURS_LISIBLES: [forme: string, code: string][] = [
  ['`vi.fn`, `vi.spyOn`', "import { vi } from 'vitest';\nexport const f = vi.fn();\nexport const g = (o: { a(): void }) => vi.spyOn(o, 'a');\n"],
  ['`createRequire(…).resolve`', "import { createRequire } from 'node:module';\nexport const p = createRequire(import.meta.url).resolve('tsx');\n"],
  ['liaison `createRequire(…)` appelée', "import { createRequire } from 'node:module';\nconst r = createRequire(import.meta.url);\nexport const s = r('./zz-a');\n"],
  ['`module` local', "export const f = async () => { const module = await import('./zz-a'); return Object.keys(module); };\n"],
  ['`vitest` local', "const [vitest] = [1];\nexport const v = [vitest];\n"],
  ['type `typeof vi`', "import { vi } from 'vitest';\nexport type V = typeof vi;\n"],
];

/** Le chemin d'une fixture posée à côté du fichier réel `rel`. */
const voisin = (rel: string, i: number) => rel.replace(/(\.[^.]+)$/, `-couche-${i}$1`);

/** La suite du module `rel`, dans son dialecte, jouée par la suite principale ou, hors d'elle, par celle du noyau. */
const suite = (rel: string) => {
  const principale = rel.replace(/(\.[^.]+)$/, '.test$1');
  return estDeLaSuiteVitest(principale) ? principale : rel.replace(/(\.[^.]+)$/, '.hors-store.test$1');
};

describe('murs de couche — la table `COUCHES`, mesurée sur la config RÉSOLUE (#1709, #2882)', () => {
  it('CONTRAT : chaque zone nommée est déclarée, et le dossier de chaque zone est à elle', () => {
    for (const [zone, { importe, types = [], portes = {} }] of Object.entries(COUCHES) as [string, { importe: readonly string[] | '*'; types?: readonly string[]; portes?: Record<string, string> }][]) {
      const nommees = [...(importe === '*' ? [] : importe), ...types, ...Object.keys(portes)];
      for (const z of nommees) expect(ZONES, `${zone} nomme ${z}`).toContain(z);
    }
    expect(ZONES.map((z) => zoneDe(`${dossierDe(z)}/a/b.ts`)), 'la zone du dossier de chaque zone').toEqual(ZONES);
    // Hors du dossier d'une zone, le nom de la zone ne la rend pas : `src/godot/`, `src/racine/` sont des dossiers sans ligne.
    expect(['src/a.ts', 'src/zz-inconnue/a.ts', 'src/godot/a.ts', 'src/racine/a.ts', 'scripts/a.mjs', 'hoteX/a.ts'].map(zoneDe))
      .toEqual(['racine', 'src/zz-inconnue', 'src/godot', 'src/racine', null, null]);
    // Sous `hotes/` et `projets/`, chaque dossier est une zone (#4903 H3) : un dossier sans ligne rend son dossier, un
    // fichier posé à même la racine rend la racine, et aucun n'est une zone.
    expect(['hotes/zz-inconnu/a.ts', 'hotes/a.ts', 'projets/zz-inconnu/sous/a.ts', 'projets/a.ts', 'hotes/godot/a.ts', 'hotes/texte/a.ts'].map(zoneDe))
      .toEqual(['hotes/zz-inconnu', 'hotes', 'projets/zz-inconnu', 'projets', 'godot', 'texte']);
    for (const z of ['src/zz-inconnue', 'src/godot', 'src/racine', 'hotes/zz-inconnu', 'hotes', 'projets/zz-inconnu', 'projets']) expect(estZone(z), z).toBe(false);
    expect(RACINES_DES_ZONES, 'les racines des zones').toEqual(['src', 'hotes', 'projets']);
  });

  it('CONTRAT : une zone qui survit à la bascule (`survit`) n’ouvre que des zones qui survivent, en valeur, en type et par porte', () => {
    const survivent = Object.keys(COUCHES).filter((z) => COUCHES[z].survit === true);
    expect(survivent.sort()).toEqual(['data', 'engine', 'geometry', 'godot', 'hote', 'i18n', 'lib', 'noyau', 'racine', 'roguelite', 'scenes', 'texte']);
    expect(survivent).toHaveLength(Object.keys(COUCHES).length);
    for (const z of survivent) {
      const { importe, types = [], portes = {} } = COUCHES[z];
      expect(importe === '*', `${z} et ses droits d’import`).toBe(z === 'racine');
      for (const v of [...(importe === '*' ? [] : importe), ...types, ...Object.keys(portes)]) expect(COUCHES[v].survit, `${z} ouvre ${v}`).toBe(true);
    }
  });

  it('CONTRAT : la ligne d’un projet est celle de son constructeur, chacun de ses affichages un dossier de `hotes/`, aucune ligne hors de lui ne le nomme, aucune de ses ouvertures n’est morte, et toute autre zone le trouve fermé (#4903 H3)', () => {
    const projets = Object.keys(COUCHES).filter(estProjet);
    expect(projets, 'les projets de la table').toEqual(['roguelite']);
    for (const p of projets) {
      const { ouvertures = {}, affichages = [], outillage } = COUCHES[p];
      expect(COUCHES[p], `${p} : la ligne de son constructeur`).toEqual(ligneDeProjet(dossierDe(p), ouvertures, { affichages, outillage }));
      for (const a of affichages) expect(estZone(a) && dossierDe(a).startsWith('hotes/'), `${p} déclare ${a} : un affichage`).toBe(true);
      for (const [z, ticket] of Object.entries(ouvertures)) {
        expect(Number.isInteger(ticket) && ticket > 0, `${p} ouvre ${z} : son ticket`).toBe(true);
        const libre = (DROITS_D_UN_PROJET.importe as readonly string[]).includes(z) && DROITS_D_UN_PROJET.portes?.[z] === undefined;
        expect(libre, `${p} ouvre ${z}, que les droits d’un projet ouvrent déjà sans porte : ouverture morte`).toBe(false);
      }
    }
    for (const [z, { importe, types = [], portes = {} }] of Object.entries(COUCHES)) {
      const nommees = [...(importe === '*' ? [] : importe), ...types, ...Object.keys(portes)];
      expect(nommees.filter((v) => fermeParLeProjet(z, v)), `${z} nomme un projet`).toEqual([]);
      for (const p of projets.filter((q) => q !== z)) {
        expect([fermeture(z, p, false), fermeture(z, p, true)], `${z} → ${p}`).toEqual(['type', 'type']);
        const { libres, enType } = ouvertes(z);
        expect([...libres, ...enType], `${z} ouvre ${p}`).not.toContain(p);
      }
    }
  });

  it('CONTRAT : chaque script d’`outillage` est un fichier de sa zone qui survit, et chacun de ses modules un fichier hors des zones', () => {
    const declares = Object.entries(COUCHES).flatMap(([z, c]) => Object.entries(c.outillage ?? {}).map(([script, modules]) => ({ z, script, modules })));
    expect(declares.length, 'aucun outillage déclaré : le contrat ne mesure rien').toBeGreaterThan(0);
    const existe = (rel: string) => existsSync(new URL(`../${rel}`, import.meta.url));
    for (const { z, script, modules } of declares) {
      expect([zoneDe(script), COUCHES[z].survit, existe(script)], script).toEqual([z, true, true]);
      expect(modules.length, script).toBeGreaterThan(0);
      for (const m of modules) expect([estZone(zoneDe(m) ?? ''), existe(m)], `${script} → ${m}`).toEqual([false, true]);
    }
  });

  it('ORACLE : `fermeture` rend le verdict écrit à la main de chaque classe de ligne', () => {
    const oracle: [de: string, vers: string, typeSeul: boolean, verdict: ReturnType<typeof fermeture>][] = [
      ['engine', 'data', false, null], // importe
      ['engine', 'engine', false, null], // même zone
      ['racine', 'godot', false, null], // '*'
      ['data', 'scenes', false, 'type'], // fermé (#2884)
      ['lib', 'engine', false, 'type'], // feuille
      ['engine', 'constructor', false, 'type'], // clé du prototype
      ['constructor', 'godot', false, null], // zone inconnue : `murs/zone` la refuse, pas ce verdict
      ['engine', 'noyau', false, 'type'],
      ['scenes', 'noyau', false, null], // importe
      ['data', 'noyau', true, 'type'], // fermé (#2884)
      ['data', 'noyau', false, 'type'],
      ['texte', 'noyau', false, null], // importe (par sa porte)
      ['texte', 'scenes', false, null],
      ['texte', 'engine', true, 'type'], // fermé (#2898)
      ['texte', 'data', true, 'type'],
      ['noyau', 'texte', false, 'type'],
      ['hote', 'noyau', false, null], // importe (par sa porte, #2928)
      ['hote', 'scenes', false, null],
      ['hote', 'engine', true, 'type'], // fermé
      ['hote', 'data', true, 'type'],
      ['hote', 'texte', true, 'type'], // le module commun ne lit aucun hôte
      ['hote', 'godot', true, 'type'],
      ['noyau', 'hote', true, 'type'],
      ['texte', 'hote', false, null], // importe le module commun
      ['godot', 'hote', false, null],
      ['godot', 'noyau', false, null], // importe (par sa porte)
      ['godot', 'scenes', false, null],
      ['godot', 'engine', true, 'type'], // fermé (#2928 M4)
      ['godot', 'data', true, 'type'],
      ['godot', 'texte', true, 'type'],
      ['texte', 'godot', true, 'type'],
      ['scenes', 'hote', true, 'type'],
      ['roguelite', 'engine', false, null], // ouverture (#4932)
      ['roguelite', 'noyau', false, null], // ouverture, sans porte (#4931)
      ['roguelite', 'hote', false, null], // droits d'un projet
      ['roguelite', 'godot', true, 'type'],
      ['roguelite', 'racine', true, 'type'],
      ['racine', 'roguelite', true, 'type'], // un projet est fermé, `'*'` compris (#4903 H3)
      ['godot', 'roguelite', true, 'type'],
      ['engine', 'roguelite', true, 'type'],
    ];
    expect(oracle.map(([de, vers, t]) => fermeture(de, vers, t))).toEqual(oracle.map(([, , , v]) => v));
    expect(['constructor', '__proto__', 'toString', 'hasOwnProperty'].filter(estZone)).toEqual([]);
    const portes: [de: string, vers: string, cible: string, verdict: string | null][] = [
      ['texte', 'noyau', 'src/noyau/index.ts', null],
      ['texte', 'noyau', 'src/noyau/index', null],
      ['texte', 'noyau', 'src/noyau', null],
      ['texte', 'noyau', 'src/noyau/combatFlow.ts', 'src/noyau/index.ts'],
      ['texte', 'noyau', 'src/noyau/monde/index.ts', 'src/noyau/index.ts'],
      ['texte', 'scenes', 'src/scenes/x.ts', null], // aucune porte vers `scenes`
      ['godot', 'noyau', 'src/noyau/index.ts', null],
      ['godot', 'noyau', 'src/noyau/combatFlow.ts', 'src/noyau/index.ts'],
      ['hote', 'noyau', 'src/noyau/monde/index.ts', 'src/noyau/index.ts'],
      ['godot', 'hote', 'src/hote/projection.ts', null], // aucune porte vers `hote`
      ['scenes', 'noyau', 'src/noyau/combatFlow.ts', null], // aucune porte pour `scenes`
      ['roguelite', 'noyau', 'src/noyau/combatFlow.ts', null], // l'ouverture retire la porte (#4931)
      ['constructor', 'noyau', 'src/noyau/x.ts', null],
    ];
    expect(portes.map(([de, vers, cible]) => porteManquee(de, vers, cible))).toEqual(portes.map(([, , , v]) => v));
    const paquets: [de: string, paquet: string | null, verdict: boolean][] = [
      ['noyau', 'react', true],
      ['godot', 'three', true],
      ['scenes', 'zustand', true],
      ['hote', 'react-dom', true],
      ['lib', 'react', true],
      ['noyau', 'zod', false], // hors de l'hôte web
      ['noyau', '@scope/react', false],
      ['noyau', null, false], // module de Node
      ['racine', 'react', true],
      ['racine', 'three', true],
      ['constructor', 'react', false],
    ];
    expect(paquets.map(([de, p]) => paquetFerme(de, p))).toEqual(paquets.map(([, , v]) => v));
  });

  it('PÉRIMÈTRE : des fichiers RÉELS de chaque zone sont sous les murs, dans chaque dialecte ; la réexportation, en production de `src/noyau` et `src/scenes` hors de la surface', () => {
    const regles = (rel: string) => Object.keys(configPourFichier(rel).rules);
    for (const zone of ZONES) {
      for (const rel of sondes(zone)) {
        expect(regles(rel), rel).toEqual(expect.arrayContaining([REGLE, 'murs/zone', SUITE_JOUEE]));
        expect(regles(rel).includes(REEX), rel).toBe(['noyau', 'scenes'].includes(zone) && !estKitDeTest(rel));
      }
    }
    for (const ext of ['.mjs', '.mts', '.cjs', '.js', '.jsx', '.tsx']) {
      expect(regles(`src/lib/zz-dialecte${ext}`), ext).toEqual(expect.arrayContaining([REGLE, 'murs/zone', SUITE_JOUEE]));
    }
    const [noyau] = sondes('noyau');
    const horsReexportation = [SURFACE_DU_NOYAU, voisin(noyau, 0).replace(/\.ts$/, '.test.ts'), voisin(noyau, 1).replace(/\.ts$/, '.testkit.ts'), 'src/noyau/zz.d.ts'];
    expect(horsReexportation.filter((rel) => regles(rel).includes(REEX))).toEqual([]);
  });

  it('FORMES : chaque paire de zones rend le verdict de la table, sous chaque forme, en relatif, en alias et en chemin `/src/…`', { timeout: 460_000 }, () => {
    const cas: { cle: string; attendu: string; fixture: { filePath: string; code: string } }[] = [];
    for (const de of ZONES) {
      for (const rel of sondes(de)) {
        for (const vers of ZONES) {
          if (vers === de) continue;
          for (const { p, cible, avecMotif } of arcsVers(rel, vers)) {
            for (const f of FORMES.filter((x) => avecMotif || x.nom !== 'import.meta.glob')) {
              const ferme = fermeture(de, vers, f.type) !== null || porteManquee(de, vers, cible) !== null;
              const filePath = voisin(rel, cas.length);
              const reexporte = f.reexporte === true && REEX in configPourFichier(filePath).rules;
              const attendu = [...(ferme ? [REGLE] : []), ...(reexporte ? [REEX] : [])].join('+') || 'passe';
              cas.push({ cle: `${rel} → ${p} (${f.nom})`, attendu, fixture: { filePath, code: f.code(p) } });
            }
          }
        }
      }
    }
    // Les suites gardent tous les imports entre zones vivantes, hors du projet d'une autre zone (#4903 H3) ; une suite
    // qu'aucune configuration de Vitest ne joue est refusée (`murs/suite-jouee`). Chaque forme d’accès à Three hors de
    // son outillage reste refusée, en valeur comme en type.
    for (const de of ZONES) {
      const [rel] = sondes(de);
      for (const vers of ZONES.filter((v) => v !== de)) {
        const { p } = arcsVers(rel, vers)[0];
        const filePath = suite(voisin(rel, cas.length));
        const attendu = [...(estDeLaSuiteVitest(filePath) ? [] : [SUITE_JOUEE]), ...(fermeParLeProjet(de, vers) ? [INSTR] : [])].join('+') || 'passe';
        cas.push({ cle: `${filePath} → ${p}`, attendu, fixture: { filePath, code: FORMES[0].code(p) } });
      }
    }
    const [noyau] = sondes('noyau');
    for (const f of FORMES.filter(({ nom }) => nom !== 'import.meta.glob')) {
      const filePath = suite(voisin(noyau, cas.length));
      cas.push({ cle: `${filePath} → three (${f.nom})`, attendu: INSTR, fixture: { filePath, code: f.code('three') } });
    }
    const obtenus = verdicts(cas.map((c) => c.fixture), [REGLE, REEX, INSTR, SUITE_JOUEE]);
    expect(Object.fromEntries(cas.map((c, i) => [c.cle, obtenus[i]]))).toEqual(Object.fromEntries(cas.map((c) => [c.cle, c.attendu])));
  });

  it('PORTES : une zone à porte ne lit la zone importée que par sa porte, sous chaque forme, en relatif, en alias et en chemin `/src/…`', { timeout: 120_000 }, () => {
    const cas: { cle: string; attendu: string; fixture: { filePath: string; code: string } }[] = [];
    const aPortes = (Object.entries(COUCHES) as [string, { portes?: Record<string, string> }][]).filter(([, c]) => c.portes);
    for (const [de, { portes = {} }] of aPortes) {
      for (const rel of sondes(de)) {
        for (const [vers, porte] of Object.entries(portes)) {
          const module = porte.replace(/\.ts$/, '');
          const dossier = dossierDe(vers);
          const specs: [string | null, string][] = [
            [relatif(rel, module), 'passe'], [relatif(rel, dossier), 'passe'], [alias(porte), 'passe'], [`/${module}`, 'passe'],
            [relatif(rel, `${dossier}/combatFlow`), REGLE], [alias(`${dossier}/monde/index`), REGLE], [`/${dossier}/etat.ts`, REGLE],
          ];
          for (const [p, attendu] of specs.filter((s): s is [string, string] => s[0] !== null)) {
            for (const f of FORMES.filter((x) => x.nom !== 'import.meta.glob')) {
              cas.push({ cle: `${rel} → ${p} (${f.nom})`, attendu, fixture: { filePath: voisin(rel, cas.length), code: f.code(p) } });
            }
          }
        }
      }
    }
    expect(cas.length, 'aucune zone à porte : le banc ne mesure rien').toBeGreaterThan(0);
    const obtenus = verdicts(cas.map((c) => c.fixture), [REGLE]);
    expect(Object.fromEntries(cas.map((c, i) => [c.cle, obtenus[i]]))).toEqual(Object.fromEntries(cas.map((c) => [c.cle, c.attendu])));
  });

  it('FORMES : une suite d’une zone qui survit est sous le mur des instruments, pas sous la pureté de couche ; un import interne à la zone passe, la requête ne compte pas', () => {
    const [rel] = sondes('engine');
    const [data] = sondes('data');
    const specifieur = (de: string, vers: string) => specifieurs(de, vers)[0];
    const obtenus = verdicts([
      { filePath: suite(voisin(rel, 0)), code: `import { X } from 'three';\nexport const a = X;\n` },
      { filePath: voisin(rel, 1), code: "import { rollD100 } from './dice';\nexport const a = rollD100;\n" },
      { filePath: voisin(data, 2), code: `import x from '${specifieur(data, 'engine')}?raw';\nexport const a = x;\n` },
      { filePath: voisin(data, 3), code: `import x from '${specifieur(data, 'hote')}?raw';\nexport const a = x;\n` },
      { filePath: voisin(data, 4), code: `export const g = import.meta.glob(['!${specifieur(data, 'hote')}.ts', '${specifieur(data, 'engine')}.ts']);\n` },
      { filePath: 'src/lib/zz-dialecte.mjs', code: "import { X } from '../engine/x.js';\nexport const a = X;\n" },
      { filePath: voisin(data, 6), code: `export const f = () => import('${relatif(data, `${dossierDe('hote')}X/x.json`)}');\n` },
    ], [REGLE, INSTR]);
    expect(obtenus).toEqual([INSTR, 'passe', 'passe', REGLE, 'passe', REGLE, 'passe']);
  });

  it('PARTAGE : un fichier d’une zone est sous la pureté de couche ou sous le mur des instruments, selon `estFichierVitest`, jamais sous les deux ni sous aucun', () => {
    const vers = () => "import { X } from 'three';\nexport const a = X;\n";
    const cas: [filePath: string, attendu: string][] = [
      ['src/noyau/zz-partage-0.test.ts', INSTR],
      ['src/noyau/zz-partage-1.bench.ts', INSTR],
      ['src/noyau/zz-partage-2.hors-store.test.ts', INSTR],
      ['src/noyau/zz-partage-3.test.aide.ts', REGLE],
      ['src/noyau/zz-partage-4.testkit.ts', REGLE],
      ['src/engine/zz-partage-5.bench.kit.ts', REGLE],
      ['src/noyau/zz-partage-6.ts', REGLE],
      ['hotes/godot/zz-partage-7.hors-store.test.ts', INSTR],
    ];
    expect(cas.map(([f]) => estFichierVitest(f))).toEqual(cas.map(([, v]) => v === INSTR));
    const obtenus = verdicts(cas.map(([filePath]) => ({ filePath, code: vers() })), [REGLE, INSTR]);
    expect(Object.fromEntries(cas.map(([f], i) => [f, obtenus[i]]))).toEqual(Object.fromEntries(cas.map(([f, v]) => [f, v])));
  });

  it('INSTRUMENTS : une suite ou un banc d’une zone qui survit refuse le banc, le paquet de l’hôte web, le JSX et le spécificateur calculé ; `noyau→scenes`, un module hors des zones, l’`import()` d’un `vi.mock` et la production passent', () => {
    const [noyau] = sondes('noyau');
    const [engine] = sondes('engine');
    const calcule = ['import(p)', 'require(p)', `${MOQUEUR}.mock(p)`, `${MOQUEUR}.doMock(p)`, 'vi.importActual(p)', 'vi.importMock(p)', 'createRequire(import.meta.url)(p)', 'module.require(p)', 'require(...[p])'];
    const cas: [cle: string, filePath: string, code: string, attendu: string][] = [
      ['banc engine → three (type)', voisin(engine, 0).replace(/\.ts$/, '.bench.ts'), "import type { Mesh } from 'three';\nexport type A = Mesh;\n", INSTR],
      ['noyau → scenes', suite(voisin(noyau, 2)), `import { X } from '${specifieurs(noyau, 'scenes')[0]}';\nexport const a = X;\n`, 'passe'],
      ['noyau → hors des zones', suite(voisin(noyau, 3)), `import { X } from '${relatif(noyau, 'scripts/zz-pont.mjs')}';\nexport const a = X;\n`, 'passe'],
      ['noyau → react', suite(voisin(noyau, 4)), "import { useState } from 'react';\nexport const a = useState;\n", INSTR],
      ['noyau : JSX', suite(voisin(noyau, 6)).replace(/\.ts$/, '.tsx'), 'export const A = () => <div />;\n', `${SUITE_JOUEE}+${INSTR}`],
      ['noyau : mock d’un `import(…)`', suite(voisin(noyau, 7)), `${MOQUEUR}.mock(import('./zz-a'));\n`, 'passe'],
      ...calcule.map((appel, i): [string, string, string, string] => [`noyau : ${appel}`, suite(voisin(noyau, 8 + i)), `const p = './zz-' + 'a';\nexport const f = () => ${appel};\n`, INSTR]),
      ...calcule.map((appel, i): [string, string, string, string] => [`production noyau : ${appel}`, voisin(noyau, 20 + i), `const p = './zz-' + 'a';\nexport const f = () => ${appel};\n`, 'passe']),
      ...CHARGEURS_DETOURNES.map(([forme, code], i): [string, string, string, string] => [`noyau : ${forme}`, suite(voisin(noyau, 50 + i)), code, INSTR]),
      ...CHARGEURS_LISIBLES.map(([forme, code], i): [string, string, string, string] => [`noyau, lisible : ${forme}`, suite(voisin(noyau, 110 + i)), code, 'passe']),
    ];
    const obtenus = verdicts(cas.map(([, filePath, code]) => ({ filePath, code })), [INSTR, SUITE_JOUEE]);
    expect(Object.fromEntries(cas.map(([cle], i) => [cle, obtenus[i]]))).toEqual(Object.fromEntries(cas.map(([cle, , , v]) => [cle, v])));
  });

  it('PAQUETS : chaque zone × chaque paquet de l’hôte web rend le verdict de `paquetFerme`, en valeur comme en type ; un autre paquet passe', { timeout: 60_000 }, () => {
    const paquets = [...PAQUETS_DE_L_HOTE_WEB.map((p) => [p, p]), ['react', 'react/jsx-runtime'], ['@scope/x', '@scope/x'], ['zod', 'zod'], ['node:fs', 'node:fs']] as const;
    const formes = FORMES.filter((f) => ['statique nommé', 'import type … from', 'require'].includes(f.nom));
    const cas: { cle: string; attendu: string; fixture: { filePath: string; code: string } }[] = [];
    for (const de of ZONES) {
      const [rel] = sondes(de);
      for (const [paquet, spec] of paquets) {
        for (const f of formes) cas.push({ cle: `${rel} → ${spec} (${f.nom})`, attendu: paquetFerme(de, paquet) ? REGLE : 'passe', fixture: { filePath: voisin(rel, cas.length), code: f.code(spec) } });
      }
    }
    expect(cas.filter((c) => c.attendu === REGLE).length, 'aucune zone qui survit : le banc ne mesure rien').toBeGreaterThan(0);
    const obtenus = verdicts(cas.map((c) => c.fixture), [REGLE]);
    expect(Object.fromEntries(cas.map((c, i) => [c.cle, obtenus[i]]))).toEqual(Object.fromEntries(cas.map((c) => [c.cle, c.attendu])));
  });

  it('JOKER : les motifs transversaux sont refusés en production et dans les suites ; un dossier autorisé, un motif exclu et sa propre zone passent', () => {
    const [noyau] = sondes('noyau');
    const [data] = sondes('data');
    const vers = (rel: string, motif: string) => relatif(rel, 'src').replace(/\/?$/, '/') + motif;
    const cas: [rel: string, motif: string, attendu: string, instrument?: true][] = [
      [noyau, vers(noyau, '*/x.ts'), REGLE],
      [noyau, vers(noyau, '**/*.ts'), REGLE],
      [noyau, vers(noyau, '{data,engine}/x.ts'), REGLE],
      [data, vers(data, '*/*.json'), REGLE],
      [noyau, vers(noyau, 'engine/*.ts'), 'passe'],
      [noyau, vers(noyau, 'engine/**/*.ts'), 'passe'],
      [noyau, `!${vers(noyau, '*/x.ts')}`, 'passe'],
      [noyau, './**/*.ts', 'passe'],
      ['src/zz-racine.ts', './*/x.ts', REGLE],
      ['src/zz-racine.ts', './data/*.ts', 'passe'],
      [noyau, vers(noyau, '*/x.ts'), INSTR, true],
      [noyau, vers(noyau, '{data,engine}/x.ts'), INSTR, true],
      [data, vers(data, '*/*.json'), INSTR, true],
      [noyau, vers(noyau, 'engine/*.ts'), 'passe', true],
      [noyau, `!${vers(noyau, '*/x.ts')}`, 'passe', true],
    ];
    const fichiers = cas.map(([rel, , , instrument], i) => (instrument ? suite(voisin(rel, i)) : voisin(rel, i)));
    const obtenus = verdicts(cas.map(([, motif], i) => ({ filePath: fichiers[i], code: `export const g = import.meta.glob(['${motif}']);\n` })), [REGLE, INSTR]);
    expect(Object.fromEntries(cas.map(([, motif], i) => [`${fichiers[i]} : ${motif}`, obtenus[i]]))).toEqual(Object.fromEntries(cas.map(([, motif, v], i) => [`${fichiers[i]} : ${motif}`, v])));
  });

  it('JSX, HORS ZONE : une zone qui survit n’écrit aucun JSX et ne lit aucun module de code hors des zones, en valeur comme en type ; son outillage déclaré, une donnée, `node:` et une zone qui ne survit pas passent', () => {
    const survivent = ZONES.filter((z) => COUCHES[z].survit === true);
    const autres = ZONES.filter((z) => COUCHES[z].survit !== true);
    const cas: [cle: string, filePath: string, code: string, attendu: string][] = [];
    const scriptsSeuls: typeof cas = [];
    const jsx = ['export const A = () => <div />;\n', 'export const F = () => <></>;\n'];
    for (const z of ZONES) {
      for (const [i, code] of jsx.entries()) {
        for (const ext of ['.tsx', '.jsx']) cas.push([`${z} : JSX ${i} ${ext}`, `${dossierDe(z)}/zz-jsx-${i}${ext}`, code, survivent.includes(z) ? REGLE : 'passe']);
      }
    }
    const horsZone = ['scripts/zz-pont.mjs', 'scripts/zz-pont', 'server/src/zz', 'hoteX/zz.ts'];
    for (const z of [...survivent, ...autres]) {
      const [rel] = sondes(z);
      const attendu = survivent.includes(z) ? REGLE : 'passe';
      for (const cible of horsZone) {
        for (const f of FORMES.filter((x) => ['statique nommé', 'import type … from', 'dynamique', 'require'].includes(x.nom))) {
          cas.push([`${rel} → ${cible} (${f.nom})`, voisin(rel, cas.length), f.code(relatif(rel, cible)), attendu]);
        }
      }
      for (const neutre of [relatif(rel, 'docs/zz.json'), 'node:fs']) cas.push([`${rel} → ${neutre}`, voisin(rel, cas.length), `import x from '${neutre}';\nexport const a = x;\n`, 'passe']);
    }
    for (const [z, { outillage = {} }] of Object.entries(COUCHES)) {
      for (const [cle, modules] of Object.entries(outillage)) {
        const script = cle.endsWith('/') ? `${cle}zz-outil.mjs` : cle;
        const [autre] = sondes(z).filter((rel) => rel !== script);
        for (const m of modules) {
          cas.push([`${script} → ${m} (déclaré)`, script, `import * as x from '${relatif(script, m)}';\nexport const a = x;\n`, 'passe']);
          cas.push([`${autre} → ${m} (déclaré pour un autre script)`, voisin(autre, cas.length), `import * as x from '${relatif(autre, m)}';\nexport const a = x;\n`, REGLE]);
        }
        scriptsSeuls.push([`${script} → scripts/zz-autre.mjs (non déclaré)`, script, `import * as x from '${relatif(script, 'scripts/zz-autre.mjs')}';\nexport const a = x;\n`, REGLE]);
      }
    }
    // Le script d'outillage porte deux fixtures : une passe de `lintFixtures` par chemin.
    for (const lot of [cas, scriptsSeuls]) {
      const obtenus = verdicts(lot.map(([, filePath, code]) => ({ filePath, code })), [REGLE]);
      expect(Object.fromEntries(lot.map(([cle], i) => [cle, obtenus[i]]))).toEqual(Object.fromEntries(lot.map(([cle, , , v]) => [cle, v])));
    }
  });

  it('RÉEXPORTATION : un module de production de `src/noyau` ou `src/scenes` ne réexporte rien, sous aucune forme ; une déclaration locale, un réexport en valeur, la surface, `src/data` et un test passent', () => {
    const cas: [filePath: string, code: string, attendu: string][] = [
      ['src/noyau/zz-reex-0.ts', "export * from './a';\n", REEX],
      ['src/noyau/zz-reex-1.ts', "export * as c from './c';\n", REEX],
      ['src/noyau/zz-reex-2.ts', "export { d, type E } from './d';\n", REEX],
      ['src/noyau/zz-reex-3.ts', "export type { T } from './t';\n", REEX],
      ['src/noyau/monde/zz-reex-4.ts', "import { a } from './a';\nexport { a };\n", REEX],
      ['src/noyau/zz-reex-5.ts', "import * as ns from './ns';\nexport { ns };\n", REEX],
      ['src/noyau/zz-reex-6.ts', "import def from './def';\nexport { def as autre };\n", REEX],
      ['src/scenes/zz-reex-7.ts', "import type { T } from '../noyau/t';\nexport type { T };\n", REEX],
      ['src/scenes/zz-reex-8.ts', "export { x } from '../noyau/x';\n", REEX],
      ['src/scenes/zz-reex-15.ts', "export { creerHeros } from '../engine/character';\n", REEX],
      ['src/noyau/zz-reex-9.ts', 'const locale = 1;\nexport { locale };\n', 'passe'],
      ['src/noyau/zz-reex-10.ts', "import { a } from './a';\nexport const valeur = a;\n", 'passe'],
      [SURFACE_DU_NOYAU, "export { a } from './a';\n", 'passe'],
      ['src/data/zz-reex-12.ts', "export { a } from './a';\n", 'passe'],
      ['src/noyau/zz-reex-13.test.ts', "export { a } from './a';\n", 'passe'],
      ['src/scenes/zz-reex-14.testkit.ts', "export { a } from './a';\n", 'passe'],
    ];
    const obtenus = verdicts(cas.map(([filePath, code]) => ({ filePath, code })), [REEX, REGLE]);
    expect(Object.fromEntries(cas.map(([f], i) => [f, obtenus[i]]))).toEqual(Object.fromEntries(cas.map(([f, , v]) => [f, v])));
  });

  it('SUITE JOUÉE : une suite hors du corpus Vitest est refusée ; une suite jouée et un module passent', () => {
    const cas: [filePath: string, attendu: string][] = [
      ['hotes/godot/pont/zz.test.ts', 'passe'],
      ['src/lib/zz.test.mjs', SUITE_JOUEE],
      ['src/lib/zz.test.js', SUITE_JOUEE],
      ['hotes/godot/pont/zz.hors-store.test.ts', 'passe'],
      ['src/hote/zz.test.ts', 'passe'],
      ['src/noyau/zz.hors-store.test.ts', 'passe'],
      ['src/lib/zz.test.tsx', SUITE_JOUEE],
      ['hotes/godot/pont/zz.ts', 'passe'],
    ];
    const obtenus = verdicts(cas.map(([filePath]) => ({ filePath, code: 'export const a = 1;\n' })), [SUITE_JOUEE]);
    expect(Object.fromEntries(cas.map(([f], i) => [f, obtenus[i]]))).toEqual(Object.fromEntries(cas.map(([f, v]) => [f, v])));
  });

  it('QUARANTAINE : chaque fichier en quarantaine refuse, sous chaque forme d’arc, chaque module de l’arbre que ses `cibles` visent ; un autre module, et le même code hors quarantaine, passent', { timeout: 60_000 }, () => {
    const QUAR = 'murs/quarantaine';
    const blocs = blocsDeRegle(QUAR);
    expect(blocs.length, 'aucune quarantaine déclarée : le banc ne mesure rien').toBeGreaterThan(0);
    const arbre = readCorpus(['src']).map((f) => f.rel);
    const lignes = (rel: string, cibles: string[]) => cibles.flatMap((cible, i) => {
      const p = relatif(rel, cible.replace(/\.(?:[cm]?[jt]sx?)$/, ''));
      return [`import '${p}';`, `void import('${p}');`, `void import(\`${p}\`);`, `require('${p}');`, `module.require('${p}');`,
        `createRequire(import.meta.url)('${p}');`, `export * from '${p}';`, `export type T${i} = typeof import('${p}');`,
        `import type * as N${i} from '${p}';`, `void import.meta.glob('${p}.ts');`];
    });
    for (const bloc of blocs) {
      expect(bloc.files.filter((rel) => !existsSync(new URL(`../${rel}`, import.meta.url))), 'fichier en quarantaine absent de l’arbre').toEqual([]);
      const [{ cibles }] = bloc.options as [{ cibles: string[] }];
      const visees = arbre.filter((rel) => cibles.some((g) => correspondGlob(rel, g)));
      expect(visees.length, `${cibles.join(', ')} : aucun module de l’arbre visé`).toBeGreaterThan(0);
      for (const rel of bloc.files) {
        const refus = lignes(rel, visees);
        const neutres = lignes(rel, [`${posix.dirname(rel)}/zz-neutre.ts`]);
        const [pris] = lintFixtures([{ filePath: rel, code: refus.join('\n') + '\n' }]);
        expect(selectionnerMessages(pris, (m) => m.ruleId === QUAR).map((m) => m.line).sort((x, y) => x - y), rel).toEqual(refus.map((_, i) => i + 1));
        const [libre] = lintFixtures([{ filePath: rel, code: neutres.join('\n') + '\n' }]);
        expect(selectionnerMessages(libre, (m) => m.ruleId === QUAR), `${rel} : module neutre`).toEqual([]);
        const hors = rel.replace(/[^/]+$/, 'zz-hors-quarantaine.ts');
        const [ailleurs] = lintFixtures([{ filePath: hors, code: lignes(hors, visees).join('\n') + '\n' }]);
        expect(selectionnerMessages(ailleurs, (m) => m.ruleId === QUAR), hors).toEqual([]);
      }
    }
  });

  it('FERMETURE : un fichier d\'une zone non déclarée est refusé, tests compris ; une zone déclarée et la racine passent', () => {
    const obtenus = verdicts([
      { filePath: 'src/zz-inconnue/a.ts', code: 'export const a = 1;\n' },
      { filePath: 'src/zz-inconnue/sous/b.test.ts', code: 'export const b = 1;\n' },
      { filePath: 'src/engine/zz-connue.ts', code: 'export const c = 1;\n' },
      { filePath: 'src/zz-racine.ts', code: 'export const d = 1;\n' },
      { filePath: 'src/constructor/e.ts', code: 'export const e = 1;\n' },
      { filePath: 'src/toString/f.ts', code: "import { X } from '../ui/x';\nexport const f = X;\n" },
      { filePath: 'src/godot/g.ts', code: "import { X } from '../noyau/partie';\nexport const g = X;\n" },
      { filePath: 'src/racine/h.ts', code: "import { X } from '../state/store';\nexport const h = X;\n" },
    ], ['murs/zone']);
    expect(obtenus).toEqual(['murs/zone', 'murs/zone', 'passe', 'passe', 'murs/zone', 'murs/zone', 'murs/zone', 'murs/zone']);
  });

  it('HORS DES ZONES (#4903 L3) : un fichier de code hors des zones et de l’outillage déclaré est refusé, à même la racine, sous un dossier racine non déclaré, sous `.claude/` hors du code d’un mod et sous `public/` ; l’outillage déclaré passe', () => {
    const code = 'export const a = 1;\n';
    const cas: [string, string][] = [
      ['zz-racine.mjs', 'murs/zone'],
      ['zz-dossier/a.ts', 'murs/zone'],
      ['zz-dossier/sous/b.test.ts', 'murs/zone'],
      ['.claude/zz.mjs', 'murs/zone'],
      ['.claude/skills/zz-mod/c.ts', 'murs/zone'],
      ['.claude/agents/d.js', 'murs/zone'],
      ['public/zz/e.js', 'murs/zone'],
      ['docs/f.mjs', 'murs/zone'],
      ['zz.config.mjs', 'murs/zone'],
      ['scripts/zz/g.mjs', 'passe'],
      ['server/zz/h.ts', 'passe'],
      ['.claude/workflows/zz.js', 'passe'],
      ['.claude/skills/zz-mod/hooks/i.ts', 'passe'],
      ['.claude/skills/zz-mod/types/j.ts', 'passe'],
      ['vitest.config.ts', 'passe'],
    ];
    const obtenus = verdicts(cas.map(([filePath]) => ({ filePath, code })), ['murs/zone']);
    expect(Object.fromEntries(cas.map(([f], i) => [f, obtenus[i]]))).toEqual(Object.fromEntries(cas));
  });

  it('AFFICHAGES ET PROJETS (#4903 H3) : un dossier de `hotes/` ou de `projets/` sans ligne est refusé ; un affichage n’importe ni un autre affichage ni un module de `projets/`, un fichier de `src/` aucun module de `projets/`, suites comprises, ni par un motif joker qui peut l’atteindre ; un projet lit ses ouvertures, de droit les affichages qu’il déclare, et ses propres jokers, pas un affichage qu’il ne déclare pas ni un joker qui peut atteindre une zone fermée, fichiers à même `src/` compris', () => {
    const declarant = ligneDeProjet('projets/zz', { engine: 1 }, { affichages: ['godot'], outillage: { 'projets/zz/x.mjs': ['scripts/y.mjs'] } });
    expect([declarant.importe, declarant.portes, declarant.ouvertures, declarant.affichages, declarant.outillage]).toEqual([
      [...DROITS_D_UN_PROJET.importe, 'godot', 'engine'], DROITS_D_UN_PROJET.portes, { engine: 1 }, ['godot'], { 'projets/zz/x.mjs': ['scripts/y.mjs'] },
    ]);
    const obtenus = verdicts([
      { filePath: 'hotes/zz-inconnu/a.ts', code: 'export const a = 1;\n' },
      { filePath: 'hotes/zz-a.ts', code: 'export const a = 1;\n' },
      { filePath: 'projets/zz-inconnu/sous/a.ts', code: 'export const a = 1;\n' },
      { filePath: 'hotes/godot/zz-g.ts', code: "import { vue } from '../texte/vue';\nexport const g = vue;\n" },
      { filePath: 'hotes/texte/zz-t.ts', code: "import type { Pont } from '../godot/pont/pont';\nexport type T = Pont;\n" },
      { filePath: 'hotes/godot/zz-p.ts', code: "import { p } from '../../projets/zz-a/p';\nexport const g = p;\n" },
      { filePath: 'src/zz-racine.ts', code: "import { p } from '../projets/zz-a/p';\nexport const r = p;\n" },
      { filePath: 'hotes/godot/zz-h.ts', code: "import { gesteDuVerbe } from '../../src/hote/geste';\nexport const h = gesteDuVerbe;\n" },
      { filePath: 'src/zz.ts', code: "import { p } from '../projets/roguelite/p';\nexport const r = p;\n" },
      { filePath: 'src/zz.test.ts', code: "import { p } from '../projets/roguelite/p';\nexport const r = p;\n" },
      { filePath: 'src/engine/zz.test.ts', code: "import type { P } from '../../projets/roguelite/p';\nexport type E = P;\n" },
      { filePath: 'hotes/godot/zz.ts', code: "import { p } from '../../projets/roguelite/p';\nexport const g = p;\n" },
      { filePath: 'hotes/godot/zz.test.ts', code: "import { p } from '../../projets/roguelite/p';\nexport const g = p;\n" },
      { filePath: 'hotes/texte/zz.testkit.ts', code: "import { p } from '../../projets/roguelite/p';\nexport const t = p;\n" },
      { filePath: 'projets/roguelite/src/zz-e.ts', code: "import { rollD100 } from '../../../src/engine/dice';\nexport const e = rollD100;\n" },
      { filePath: 'projets/roguelite/src/zz-g.ts', code: "import { pont } from '../../../hotes/godot/pont/pont';\nexport const g = pont;\n" },
      { filePath: 'projets/roguelite/src/zz-n.ts', code: "import { X } from '../../../src/noyau/combatFlow';\nexport const n = X;\n" },
      ...['../projets/*/x.ts', '../projets/**/*.ts', '../*/roguelite/**/*.ts', '../projets/{roguelite,zz}/x.ts', '../projets/roguelit?/x.ts', '../projets/[r]oguelite/x.ts']
        .map((motif, i) => ({ filePath: `src/zz-joker-${i}.test.ts`, code: `export const g = import.meta.glob('${motif}');\n` })),
      { filePath: 'hotes/godot/zz-joker.ts', code: "export const g = import.meta.glob('../../projets/*/x.ts');\n" },
      { filePath: 'projets/roguelite/src/zz-joker.ts', code: "export const g = import.meta.glob('../**/*.ts');\n" },
      { filePath: 'projets/roguelite/src/zz-a.ts', code: "export const g = import.meta.glob('../../../src/**/*.json');\n" },
      { filePath: 'projets/roguelite/src/zz-a.test.ts', code: "export const g = import.meta.glob('../../../src/**/*.json');\n" },
    ], ['murs/zone', REGLE, INSTR]);
    expect(obtenus).toEqual([
      'murs/zone', 'murs/zone', 'murs/zone',
      REGLE, REGLE, REGLE, REGLE,
      'passe',
      REGLE, INSTR, INSTR, REGLE, INSTR, REGLE,
      'passe', REGLE, 'passe',
      INSTR, INSTR, INSTR, INSTR, INSTR, INSTR,
      REGLE, 'passe',
      REGLE, INSTR,
    ]);
  });
});

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const eslint = creerBancLint();

function tableLint(formes: {nom: string; code: string; tsx?: boolean}[], chemin: string, filtre: (message: {message:string;ruleId:string|null}) => boolean): Record<string,string> {
  const fixtures = formes.map((f,i)=>({code:f.code,filePath:cheminDe(chemin,f).replace(/(\.test)?(\.[^.]+)$/,`-parite-${i}$1$2`)}));
  const resultats = lintFixtures(fixtures);
  return Object.fromEntries(formes.map((f,i)=>{
    const messages=selectionnerMessages(resultats[i], filtre);
    for(const m of messages) expect(m.ruleId,fixtures[i].filePath).toBeTruthy();
    return [f.nom,[...new Set(messages.map(m=>m.ruleId!))].sort().join('+')||'passe'];
  }));
}

/** Les couches dont les TESTS sont sous le mur de l'ordre total : le dossier de chaque zone. */
const SOUS_LE_MUR = [...new Set(Object.keys(COUCHES).map(dossierDe))];

/** Un module de production réel du moteur sert de témoin négatif de la portée du mur des tests. */
function sondeProduction(): string {
  return sondes('engine')[0];
}

/** Le premier fichier de TEST réel de la couche `dir`, à sa PROFONDEUR attendue : `src` désigne la
 *  RACINE (un `src/x.test.ts`, glob `src/*.test.ts`), les autres toute la couche. Jamais un nom en
 *  dur — la sonde suit l'arbre. Une couche dont le dossier, hors de `src/`, est absent de l'arbre : une suite fixture
 *  de son dossier (`sondes`). */
function sondeTest(dir: string): string {
  if (!dir.startsWith('src') && !existsSync(new URL(`../${dir}`, import.meta.url))) return `${dir}/zz-sonde.test.ts`;
  const profondeurRacine = dir === 'src';
  const f = readCorpus([dir], { tests: true }).find(
    ({ rel }) => estSuiteVitest(rel) && (!profondeurRacine || rel.split('/').length === 2),
  );
  expect(f, `${dir} : aucun fichier de test réel — la sonde du mur ne mesure rien`).toBeTruthy();
  return f!.rel;
}

/** La table UNIQUE des formes d'écriture de la marche brute, pour un nom de fonction de `fs`
 *  (`readdirSync`) comme pour `glob`, et la ou les règles qui DOIVENT prendre chacune. `oxlint.config.mjs`
 *  s'y mesure : `murs/ordre-total-imports` seule prend l'import nommé et l'alias, les deux prennent le
 *  namespace, le mur `murs/ordre-total` seul prend tout le reste — membre (optionnel compris) sur tout
 *  receveur, clé littérale ou gabarit, déstructuration, alias d'import TypeScript, membre JSX (\`tsx\` :
 *  la forme se lint sous l'extension \`.tsx\`). */
const FORMES_PAR_NOM = (n: string): { nom: string; code: string; regle: string; tsx?: boolean }[] => [
  { nom: 'import nommé', code: `import { ${n} } from 'node:fs';\nexport const a = ${n};\n`, regle: 'murs/ordre-total-imports' },
  { nom: 'alias', code: `import { ${n} as r } from 'node:fs/promises';\nexport const a = r;\n`, regle: 'murs/ordre-total-imports' },
  { nom: 'namespace', code: `import * as fs from 'node:fs';\nexport const a = fs.${n};\n`, regle: 'murs/ordre-total+murs/ordre-total-imports' },
  { nom: 'membre', code: `import fs from 'node:fs';\nexport const a = fs.${n};\n`, regle: 'murs/ordre-total' },
  { nom: 'membre optionnel', code: `import fs from 'node:fs';\nexport const a = fs?.${n};\n`, regle: 'murs/ordre-total' },
  { nom: '`fs.promises`', code: `import fs from 'node:fs';\nexport const a = fs.promises.${n};\n`, regle: 'murs/ordre-total' },
  { nom: 'membre d’un `import()`', code: `export const a = (await import('node:fs')).${n};\n`, regle: 'murs/ordre-total' },
  { nom: '`.default` d’un `import()`', code: `export const a = (await import('node:fs')).default.${n};\n`, regle: 'murs/ordre-total' },
  { nom: 'membre d’un `require`', code: `export const a = require('fs').${n};\n`, regle: 'murs/ordre-total' },
  { nom: '`import { default as f }`', code: `import { default as f } from 'node:fs';\nexport const a = f.${n};\n`, regle: 'murs/ordre-total' },
  { nom: '`process.getBuiltinModule`', code: `export const a = process.getBuiltinModule('fs').${n};\n`, regle: 'murs/ordre-total' },
  { nom: 'clé littérale', code: `import fs from 'node:fs';\nexport const a = fs['${n}'];\n`, regle: 'murs/ordre-total' },
  { nom: 'clé gabarit', code: `import fs from 'node:fs';\nexport const a = fs[\`${n}\`];\n`, regle: 'murs/ordre-total' },
  { nom: 'déstructuration', code: `import fs from 'node:fs';\nconst { ${n} } = fs;\nexport const a = ${n};\n`, regle: 'murs/ordre-total' },
  { nom: 'déstructuration de `promises`', code: `import fs from 'node:fs';\nconst { promises: { ${n} } } = fs;\nexport const a = ${n};\n`, regle: 'murs/ordre-total' },
  { nom: 'déstructuration par clé gabarit', code: `import fs from 'node:fs';\nconst { [\`${n}\`]: g } = fs;\nexport const a = g;\n`, regle: 'murs/ordre-total' },
  { nom: 'reste `...rest`', code: `import fs from 'node:fs';\nconst { ...rest } = fs;\nexport const a = rest.${n};\n`, regle: 'murs/ordre-total' },
  { nom: 'receveur quelconque', code: `const r = { ${n}: 1 };\nexport const a = r.${n};\n`, regle: 'murs/ordre-total' },
  { nom: 'alias d’import TS', code: `import f from 'node:fs';\nimport r = f.${n};\nexport const a = r;\n`, regle: 'murs/ordre-total' },
  { nom: 'JSX', code: `import fs from 'node:fs';\nexport const A = () => <fs.${n} />;\n`, regle: 'murs/ordre-total', tsx: true },
];
/** Le chemin sous lequel une forme se lint : l'extension \`.tsx\` pour une forme JSX. */
const cheminDe = (chemin: string, f: { tsx?: boolean }) => (f.tsx ? chemin.replace(/\.tsx?$/, '.tsx') : chemin);
const FORMES_MARCHE = ['readdirSync', 'glob'].flatMap((n) => FORMES_PAR_NOM(n).map((f) => ({ ...f, nom: `${n} : ${f.nom}` })));

/** Les formes qui ne listent RIEN et que la table ci-dessus côtoie : `import.meta.glob` de Vite, le
 *  mot en commentaire, une variable `glob` et son indice, une clé d'objet LITTÉRAL, une fonction de
 *  `fs` qui ne liste pas. */
const FORMES_NEUTRES: { nom: string; code: string }[] = [
  { nom: '`import.meta.glob`', code: "export const a = import.meta.glob('./*.json');\n" },
  { nom: 'commentaire', code: '// un glob ESLint, un motif glob `*`\nexport const a = 1;\n' },
  { nom: 'variable `glob` et son indice', code: "const glob = 'a.md'.match(/a/);\nexport const a = glob?.[0];\nexport const b = glob![0];\n" },
  { nom: 'clé d’objet littéral', code: 'export const a = { glob: 1 };\n' },
  { nom: '`fs.existsSync`', code: "import fs from 'node:fs';\nexport const a = fs.existsSync('.');\n" },
  { nom: 'position de type', code: "import fs from 'node:fs';\nexport type G = typeof fs.glob;\n" },
];

/** La table des formes de la LOCALE (\`VERROU_LOCALE_COMPARE\`, clôture des générateurs seule), et ses
 *  formes neutres : \`localeCompare\` et les \`toLocale*\` sous toute forme de clé, toute référence à la
 *  valeur \`Intl\`. */
const FORMES_LOCALE: { nom: string; code: string }[] = [
  { nom: 'membre', code: "export const a = 'a'.localeCompare('b');\n" },
  { nom: 'membre optionnel', code: "const s = 'a';\nexport const a = s?.localeCompare('b');\n" },
  { nom: 'clé littérale', code: "export const a = 'a'['localeCompare']('b');\n" },
  { nom: 'clé gabarit', code: "export const a = 'a'[`localeCompare`]('b');\n" },
  { nom: 'déstructuration', code: 'const { localeCompare } = String.prototype;\nexport const a = localeCompare;\n' },
  { nom: '`toLocaleString`', code: 'export const a = (1).toLocaleString();\n' },
  { nom: '`toLocaleLowerCase`', code: "export const a = 'A'.toLocaleLowerCase();\n" },
  { nom: '`new Intl.Collator`', code: "export const a = new Intl.Collator('fr').compare;\n" },
  { nom: '`Intl.DateTimeFormat`', code: 'export const a = Intl.DateTimeFormat;\n' },
  { nom: '`Intl` en valeur', code: 'const I = Intl;\nexport const a = I;\n' },
];
const FORMES_LOCALE_NEUTRES: { nom: string; code: string }[] = [
  { nom: '`a.localeCompareX`', code: 'const o = { localeCompareX: 1 };\nexport const a = o.localeCompareX;\n' },
  { nom: 'commentaire', code: '// localeCompare, Intl.Collator, toLocaleString\nexport const a = 1;\n' },
  { nom: 'champ `o.Intl`', code: 'const o = { Intl: 1 };\nexport const a = o.Intl;\n' },
];

/** Règles qui ont pris ce code au titre de l'ORDRE TOTAL (message porteur de la réf du mur). */
async function prisOrdreTotal(code: string, filePath: string): Promise<string[]> {
  const [res] = await eslint.lintText(code, { filePath });
  const mur = selectionnerMessages(res, (m) => m.message.includes('Ordre total'));
  for (const m of mur) {
    expect(m.ruleId, `${filePath} : ruleId nul — la config n’a pas été résolue, tout serait faussement « pris »`).toBeTruthy();
  }
  return [...new Set(mur.map((m) => m.ruleId!))].sort();
}

describe('ordre total dans les tests des zones — mur mesuré sur la config RÉSOLUE (#1709 C3c-1)', () => {
  for (const dir of SOUS_LE_MUR) {
    it(`${dir} : les formes de marche brute sont prises, les formes neutres et \`readCorpus\` passent`, { timeout: 30_000 }, async () => {
      const chemin = `${ROOT}/${sondeTest(dir)}`;
      const table = tableLint(FORMES_MARCHE,chemin,m=>m.message.includes('Ordre total'));
      expect(table, `sonde : ${chemin}`).toEqual(Object.fromEntries(FORMES_MARCHE.map((f) => [f.nom, f.regle])));
      const neutres = tableLint(FORMES_NEUTRES,chemin,m=>m.message.includes('Ordre total'));
      expect(neutres, `faux positif du mur — sonde : ${chemin}`).toEqual(Object.fromEntries(FORMES_NEUTRES.map((f) => [f.nom, 'passe'])));
      const parLaPorte = "import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';\nexport const a = readCorpus(['src']);\n";
      expect(await prisOrdreTotal(parLaPorte, chemin), 'la PORTE ne doit jamais mordre').toEqual([]);
    });
  }

  it('LOCALE : sur un générateur réel, les formes de la locale sont prises, les formes neutres passent', { timeout: 30_000 }, async () => {
    const chemin = `${ROOT}/scripts/docs/build-all.mjs`;
    const table = tableLint([...FORMES_LOCALE,...FORMES_LOCALE_NEUTRES],chemin,m=>m.message.includes('Ordre total'));
    expect(table, `sonde : ${chemin}`).toEqual({
      ...Object.fromEntries(FORMES_LOCALE.map((f) => [f.nom, 'murs/ordre-total-locale'])),
      ...Object.fromEntries(FORMES_LOCALE_NEUTRES.map((f) => [f.nom, 'passe'])),
    });
  });

  it('PÉRIMÈTRE : les sélecteurs du mur sont résolus pour les couches couvertes, et ABSENTS des autres', { timeout: 30_000 }, async () => {
    const selecteursDe = async (rel: string) => {
      const cfg = await eslint.calculateConfigForFile(`${ROOT}/${rel}`);
      return JSON.stringify(Object.entries(cfg.rules ?? {}).filter(([r]) => r.startsWith('murs/')));
    };
    for (const dir of SOUS_LE_MUR) {
      const rel = sondeTest(dir);
      const resolus = await selecteursDe(rel);
      expect(resolus, `Mur MUET sur ${dir} (glob décalé ? dossier renommé ?) — sonde : ${rel}`).toContain('opendirSync');
      // Le volet `localeCompare` reste à la CLÔTURE DES GÉNÉRATEURS : un test qui asserte l'ordre
      // que le produit rend par locale mesure un contrat produit, pas un listing.
      expect(resolus, `${dir} : \`localeCompare\` n’appartient pas au mur des tests — sonde : ${rel}`).not.toContain('localeCompare');
    }
    const generateur = await selecteursDe('scripts/docs/build-all.mjs');
    expect(generateur, 'la clôture des générateurs garde son volet `localeCompare`').toContain('localeCompare');
    // TÉMOIN NÉGATIF : le mur vise les TESTS, pas la couche — un composant de production n'en résout
    // aucun sélecteur. Sans lui, un `files:` élargi à `src/engine/**` passerait inaperçu.
    const production = sondeProduction();
    expect(
      await selecteursDe(production),
      `le mur ne vise que les \`*.test.*\` : un fichier de PRODUCTION ne doit résoudre aucun de ses sélecteurs. Sonde : ${production}`,
    ).not.toContain('opendirSync');
    // #1709 C3c-3b
    for (const rel of [sondeTest('src/data'), sondes('data')[0]]) {
      const [resultat] = await eslint.lintText('debugger;', { filePath: `${ROOT}/${rel}` });
      expect(
        selectionnerMessages(resultat, (message) => message.ruleId === 'no-debugger').map((message) => message.severity),
        `src/data : Oxlint doit le LIRE (aucun \`ignores\` ne le reprend) — sinon le mur et la pureté de couche y sont muets. Sonde : ${rel}`,
      ).toEqual([2]);
    }
  });
});
