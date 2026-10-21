import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { creerBancLint, lintFixtures, selectionnerMessages, configPourFichier } from '../scripts/guards/lib/lint.testkit.mjs';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { estSuiteVitest } from '../scripts/guards/lib/fichierVitest.mjs';
import { COUCHES, dossierDe, estZone, fermeture, porteManquee, zoneDe } from '../scripts/guards/lib/couches.mjs';

/**
 * BANC DES MURS DE COUCHE (#1709, #2882 ; AGENTS.md règle stricte 3).
 *
 * Les zones du dépôt et leurs sens d'import se disent UNE fois, dans `COUCHES`
 * (`scripts/guards/lib/couches.mjs`), et se jouent par la gate `lint` (`murs/purete-imports`,
 * `murs/zone`). Ce banc lit cette table, ne la recopie pas, et MESURE la config RÉSOLUE :
 *  1. CONTRAT de la table — chaque zone nommée existe, le dossier de chaque zone est à elle (`zoneDe`), et `fermeture`
 *     rend, sur un ORACLE écrit à la main, le verdict de chaque classe de ligne ;
 *  2. PÉRIMÈTRE — des fichiers RÉELS de chaque zone (racine et sous-dossier) sont sous les deux murs ; une zone dont
 *     l'arbre ne porte pas le dossier se mesure sur des fixtures posées dans son dossier ;
 *  3. FORMES — pour chaque paire de zones, chaque forme d'import rend le verdict de `fermeture`, depuis
 *     des fichiers de la zone, par chemin relatif, par alias `@/` (vers une zone de `src/`) et par chemin `/…` : la
 *     matrice prouve le CÂBLAGE (zone, cible, type ou valeur), l'oracle prouve la table ;
 *  4. FERMETURE — un fichier d'une zone non déclarée est refusé, un fichier d'une zone déclarée passe.
 *
 * PIÈGE MESURÉ : sans config explicite, un outil peut rendre `ruleId` nul et tout paraît « pris » par
 * vacuité — d'où la sélection par le MESSAGE du mur, puis l'assertion sur son `ruleId`.
 */

const REGLE = 'murs/purete-imports';
const ZONES = Object.keys(COUCHES).filter((z) => z !== 'racine');

/** Les formes d'import vers `p` ; `type` : la forme s'efface à la compilation. */
const FORMES: { nom: string; code: (p: string) => string; type: boolean }[] = [
  { nom: 'statique nommé', code: (p) => `import { X } from '${p}';\nexport const a = X;\n`, type: false },
  { nom: 'side-effect', code: (p) => `import '${p}';\n`, type: false },
  { nom: 'dynamique', code: (p) => `export const f = async () => (await import('${p}')).X;\n`, type: false },
  { nom: 'require', code: (p) => `export const r = require('${p}');\n`, type: false },
  { nom: 'inline type `import(…).T`', code: (p) => `export type A = import('${p}').X;\n`, type: true },
  { nom: 'import type … from', code: (p) => `import type { X } from '${p}';\nexport type A = X;\n`, type: true },
  { nom: 'mixte { type X, y }', code: (p) => `import { type X, y } from '${p}';\nexport const a = y;\nexport type B = X;\n`, type: false },
  { nom: 'export … from', code: (p) => `export { X } from '${p}';\n`, type: false },
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

/** Des fichiers RÉELS de la zone, tests exclus (ordre total de `readCorpus`, jamais un nom en dur) : le
 *  PREMIER, et un fichier de SOUS-DOSSIER quand la zone en a — un spécificateur de remontée `../../` ne
 *  se comporte pas comme à la racine de la zone. Une zone dont le dossier, hors de `src/`, est absent de l'arbre : deux
 *  fixtures de son dossier, à sa racine et en sous-dossier ; sous `src/`, un dossier absent ou sans fichier lève
 *  (`readCorpus`) : une ligne sans dossier ne passe jamais sur des fixtures. */
function sondes(zone: string): string[] {
  const dossier = dossierDe(zone);
  if (!dossier.startsWith('src/') && !existsSync(new URL(`../${dossier}`, import.meta.url))) return [`${dossier}/zz-sonde.ts`, `${dossier}/zz-sous/sonde.ts`];
  const corpus = readCorpus([dossier]);
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

/** Le chemin d'une fixture posée à côté du fichier réel `rel`. */
const voisin = (rel: string, i: number) => rel.replace(/(\.[^.]+)$/, `-couche-${i}$1`);

describe('murs de couche — la table `COUCHES`, mesurée sur la config RÉSOLUE (#1709, #2882)', () => {
  it('CONTRAT : chaque zone nommée est déclarée, et le dossier de chaque zone est à elle', () => {
    for (const [zone, { importe, types = [], portes = {} }] of Object.entries(COUCHES) as [string, { importe: readonly string[] | '*'; types?: readonly string[]; portes?: Record<string, string> }][]) {
      const nommees = [...(importe === '*' ? [] : importe), ...types, ...Object.keys(portes)];
      for (const z of nommees) expect(ZONES, `${zone} nomme ${z}`).toContain(z);
    }
    expect(ZONES.map((z) => zoneDe(`${dossierDe(z)}/a/b.ts`)), 'la zone du dossier de chaque zone').toEqual(ZONES);
    // Hors du dossier d'une zone, le nom de la zone ne la rend pas : `src/hotes/`, `src/racine/` sont des dossiers sans ligne.
    expect(['src/a.ts', 'src/zz-inconnue/a.ts', 'src/hotes/a.ts', 'src/racine/a.ts', 'scripts/a.mjs', 'hoteX/a.ts'].map(zoneDe))
      .toEqual(['racine', 'src/zz-inconnue', 'src/hotes', 'src/racine', null, null]);
    for (const z of ['src/zz-inconnue', 'src/hotes', 'src/racine']) expect(estZone(z), z).toBe(false);
  });

  it('ORACLE : `fermeture` rend le verdict écrit à la main de chaque classe de ligne', () => {
    const oracle: [de: string, vers: string, typeSeul: boolean, verdict: ReturnType<typeof fermeture>][] = [
      ['engine', 'data', false, null], // importe
      ['engine', 'engine', false, null], // même zone
      ['racine', 'ui', false, null], // '*'
      ['data', 'scenes', false, 'type'], // fermé (#2884)
      ['audio', 'state', true, 'type'], // fermé (#2884)
      ['audio', 'noyau', false, 'type'],
      ['scenes', 'state', true, 'type'], // fermé (#2884)
      ['scenes', 'ui', true, 'type'],
      ['data', 'state', true, 'type'],
      ['engine', 'gameIso', true, 'type'], // fermé (#2884)
      ['data', 'gameIso', true, 'type'], // fermé (#2884)
      ['state', 'ui', true, null], // `types`
      ['state', 'ui', false, 'execution'],
      ['state', 'gameIso', true, 'type'], // fermé
      ['engine', 'state', true, 'type'],
      ['lib', 'engine', false, 'type'], // feuille
      ['ui', 'racine', false, 'type'], // la présentation n'importe pas l'entrée
      ['engine', 'constructor', false, 'type'], // clé du prototype
      ['constructor', 'ui', false, null], // zone inconnue : `murs/zone` la refuse, pas ce verdict
      ['noyau', 'state', false, 'type'], // fermé (#2817 D5)
      ['noyau', 'state', true, 'type'],
      ['noyau', 'web', false, 'type'], // fermé
      ['engine', 'noyau', false, 'type'],
      ['scenes', 'noyau', false, null], // importe
      ['data', 'noyau', true, 'type'], // fermé (#2884)
      ['data', 'noyau', false, 'type'],
      ['web', 'state', false, 'type'], // fermé
      ['hoteTexte', 'noyau', false, null], // importe (par sa porte)
      ['hoteTexte', 'scenes', false, null],
      ['hoteTexte', 'engine', true, 'type'], // fermé (#2898)
      ['hoteTexte', 'state', true, 'type'],
      ['noyau', 'hoteTexte', false, 'type'],
      ['hote', 'noyau', false, null], // importe (par sa porte, #2928)
      ['hote', 'scenes', false, null],
      ['hote', 'engine', true, 'type'], // fermé
      ['hote', 'hoteTexte', true, 'type'], // le module commun ne lit aucun hôte
      ['hote', 'hotes', true, 'type'],
      ['noyau', 'hote', true, 'type'],
      ['hoteTexte', 'hote', false, null], // importe le module commun
      ['hotes', 'hote', false, null],
      ['hotes', 'noyau', false, null], // importe (par sa porte)
      ['hotes', 'scenes', false, null],
      ['hotes', 'engine', true, 'type'], // fermé (#2928 M4)
      ['hotes', 'data', true, 'type'],
      ['hotes', 'state', true, 'type'],
      ['hotes', 'hoteTexte', true, 'type'],
      ['hoteTexte', 'hotes', true, 'type'],
      ['scenes', 'hote', true, 'type'],
    ];
    expect(oracle.map(([de, vers, t]) => fermeture(de, vers, t))).toEqual(oracle.map(([, , , v]) => v));
    expect(['constructor', '__proto__', 'toString', 'hasOwnProperty'].filter(estZone)).toEqual([]);
    const portes: [de: string, vers: string, cible: string, verdict: string | null][] = [
      ['hoteTexte', 'noyau', 'src/noyau/index.ts', null],
      ['hoteTexte', 'noyau', 'src/noyau/index', null],
      ['hoteTexte', 'noyau', 'src/noyau', null],
      ['hoteTexte', 'noyau', 'src/noyau/combatFlow.ts', 'src/noyau/index.ts'],
      ['hoteTexte', 'noyau', 'src/noyau/monde/index.ts', 'src/noyau/index.ts'],
      ['hoteTexte', 'scenes', 'src/scenes/x.ts', null], // aucune porte vers `scenes`
      ['hotes', 'noyau', 'src/noyau/index.ts', null],
      ['hotes', 'noyau', 'src/noyau/combatFlow.ts', 'src/noyau/index.ts'],
      ['hote', 'noyau', 'src/noyau/monde/index.ts', 'src/noyau/index.ts'],
      ['hotes', 'hote', 'src/hote/projection.ts', null], // aucune porte vers `hote`
      ['scenes', 'noyau', 'src/noyau/combatFlow.ts', null], // aucune porte pour `scenes`
      ['constructor', 'noyau', 'src/noyau/x.ts', null],
    ];
    expect(portes.map(([de, vers, cible]) => porteManquee(de, vers, cible))).toEqual(portes.map(([, , , v]) => v));
  });

  it('PÉRIMÈTRE : des fichiers RÉELS de chaque zone sont sous les deux murs, dans chaque dialecte', () => {
    for (const zone of ZONES) {
      for (const rel of sondes(zone)) {
        const { rules } = configPourFichier(rel);
        expect(Object.keys(rules), rel).toEqual(expect.arrayContaining([REGLE, 'murs/zone']));
      }
    }
    for (const ext of ['.mjs', '.mts', '.cjs', '.js', '.jsx', '.tsx']) {
      const { rules } = configPourFichier(`src/lib/zz-dialecte${ext}`);
      expect(Object.keys(rules), ext).toEqual(expect.arrayContaining([REGLE, 'murs/zone']));
    }
  });

  it('FORMES : chaque paire de zones rend le verdict de la table, sous chaque forme, en relatif, en alias et en chemin `/src/…`', { timeout: 120_000 }, () => {
    const cas: { cle: string; attendu: string; fixture: { filePath: string; code: string } }[] = [];
    for (const de of ZONES) {
      for (const rel of sondes(de)) {
        for (const vers of ZONES) {
          if (vers === de) continue;
          for (const p of specifieurs(rel, vers)) {
            for (const f of FORMES) {
              const attendu = fermeture(de, vers, f.type) === null && porteManquee(de, vers, `${dossierDe(vers)}/x`) === null ? 'passe' : REGLE;
              cas.push({ cle: `${rel} → ${p} (${f.nom})`, attendu, fixture: { filePath: voisin(rel, cas.length), code: f.code(p) } });
            }
          }
        }
      }
    }
    const obtenus = verdicts(cas.map((c) => c.fixture), [REGLE]);
    expect(Object.fromEntries(cas.map((c, i) => [c.cle, obtenus[i]]))).toEqual(Object.fromEntries(cas.map((c) => [c.cle, c.attendu])));
  });

  it('PORTES : une zone à porte ne lit la zone importée que par sa porte, sous chaque forme, en relatif, en alias et en chemin `/src/…`', { timeout: 60_000 }, () => {
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

  it('FORMES : un test est hors du mur de couche, un import interne à la zone passe, la requête ne compte pas', () => {
    const [rel] = sondes('engine');
    const [data] = sondes('data');
    const specifieur = (de: string, vers: string) => specifieurs(de, vers)[0];
    const obtenus = verdicts([
      { filePath: voisin(rel, 0).replace(/\.ts$/, '.test.ts'), code: `import { X } from '${specifieur(rel, 'ui')}';\nexport const a = X;\n` },
      { filePath: voisin(rel, 1), code: "import { rollD100 } from './dice';\nexport const a = rollD100;\n" },
      { filePath: voisin(data, 2), code: `import x from '${specifieur(data, 'engine')}?raw';\nexport const a = x;\n` },
      { filePath: voisin(data, 3), code: `import x from '${specifieur(data, 'ui')}?raw';\nexport const a = x;\n` },
      { filePath: voisin(data, 4), code: `export const g = import.meta.glob(['!${specifieur(data, 'ui')}.ts', '${specifieur(data, 'engine')}.ts']);\n` },
      { filePath: 'src/lib/zz-dialecte.mjs', code: "import { X } from '../engine/x.js';\nexport const a = X;\n" },
    ], [REGLE]);
    expect(obtenus).toEqual(['passe', 'passe', 'passe', REGLE, 'passe', REGLE]);
  });

  it('FERMETURE : un fichier d\'une zone non déclarée est refusé, tests compris ; une zone déclarée et la racine passent', () => {
    const obtenus = verdicts([
      { filePath: 'src/zz-inconnue/a.ts', code: 'export const a = 1;\n' },
      { filePath: 'src/zz-inconnue/sous/b.test.ts', code: 'export const b = 1;\n' },
      { filePath: 'src/engine/zz-connue.ts', code: 'export const c = 1;\n' },
      { filePath: 'src/zz-racine.ts', code: 'export const d = 1;\n' },
      { filePath: 'src/constructor/e.ts', code: 'export const e = 1;\n' },
      { filePath: 'src/toString/f.ts', code: "import { X } from '../ui/x';\nexport const f = X;\n" },
      { filePath: 'src/hotes/g.ts', code: "import { X } from '../noyau/partie';\nexport const g = X;\n" },
      { filePath: 'src/racine/h.ts', code: "import { X } from '../state/store';\nexport const h = X;\n" },
    ], ['murs/zone']);
    expect(obtenus).toEqual(['murs/zone', 'murs/zone', 'passe', 'passe', 'murs/zone', 'murs/zone', 'murs/zone', 'murs/zone']);
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

/** Les couches dont les TESTS sont sous le mur de l'ordre total. */
const SOUS_LE_MUR = ['src/engine', 'src/state', 'src/noyau', 'src/web', 'src/ui', 'src/gameIso', 'src/audio', 'src/scenes', 'src/data', 'src'] as const;

/** Le premier fichier de PRODUCTION réel de `src/ui` (corpus, jamais un nom en dur) : le mur ne vise
 *  que les `*.test.*`, et c'est ce fichier-là qui le dit — un `files:` élargi à toute la couche se
 *  lirait ici. */
function sondeProduction(): string {
  const f = readCorpus(['src/ui'], { exts: ['.tsx'] })[0];
  expect(f, 'src/ui : aucun composant de production — le témoin négatif ne mesure rien').toBeTruthy();
  return f.rel;
}

/** Le premier fichier de TEST réel de la couche `dir`, à sa PROFONDEUR attendue : `src` désigne la
 *  RACINE (un `src/x.test.ts`, glob `src/*.test.ts`), les autres toute la couche. Jamais un nom en
 *  dur — la sonde suit l'arbre. */
function sondeTest(dir: string): string {
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

describe('ordre total dans les tests de `src` — mur mesuré sur la config RÉSOLUE (#1709 C3c-1)', () => {
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
    // aucun sélecteur. Sans lui, un `files:` élargi à `src/ui/**` passerait inaperçu.
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
