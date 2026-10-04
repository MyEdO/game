import { describe, it, expect } from 'vitest';
import { creerBancLint, lintFixtures, selectionnerMessages } from '../scripts/guards/lib/lint.testkit.mjs';
import { fileURLToPath } from 'node:url';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { estSuiteVitest } from '../scripts/guards/lib/fichierVitest.mjs';

/**
 * FILET DE PÉRIMÈTRE DE LA PURETÉ DE COUCHE (#1709 C3b-2 ; CLAUDE.md règle stricte 3, #8 et #161).
 *
 * La doctrine « `src/engine` est pur, `src/state` est en amont de `src/ui`/`src/gameIso` » se dit
 * UNE fois, dans `oxlint.config.mjs`, et se joue par la gate `lint`. Ce banc ne recopie aucune
 * règle : il MESURE la config RÉSOLUE (lanceur Oxlint, `cwd` à la racine du dépôt).
 *
 * Il existe parce qu'un bloc `files:` qui ne matcherait plus rien (dossier renommé, glob décalé)
 * serait MUET et VERT. Deux volets, donc :
 *  1. PÉRIMÈTRE — le premier fichier RÉEL de chaque couche (lu par `readCorpus`, jamais un nom en
 *     dur) est bien sous les deux règles de pureté ;
 *  2. TABLE DES 7 FORMES — sur ce même fichier réel, chaque forme d'import rend le verdict attendu.
 *
 * PIÈGE MESURÉ : sans config explicite, un outil peut rendre `ruleId` nul et tout
 * paraît « pris » par vacuité — d'où l'assertion sur `ruleId` à chaque verdict.
 *
 * CE QUE LA POLICE NE VOIT PAS, et pourquoi : les formes ÉLIDÉES à la compilation (`import type
 * … from`, `import { type X }` tout-type, la référence inline `import('…').T`) ne créent aucune
 * arête d'exécution — le critère est STRUCTUREL, jamais nominatif. Reste hors de portée, comme pour
 * toute police d'accès : la recopie qui ne passe par aucun import, et `require()`.
 *
 * SECOND MUR MESURÉ ICI — L'ORDRE TOTAL DANS LES TESTS DE `src` (#1709 C3c-1). Même raison d'être :
 * le `files:` du bloc est POSIX, donc un `src/` réorganisé ou un `ignores` élargi le rendrait MUET
 * et VERT — et la sonde de chaque couche vient du CORPUS réel (`readCorpus` refuse une base vide),
 * jamais d'un nom en dur ni d'un compte de fichiers recopié.
 * Trois volets : la TABLE DES FORMES (`FORMES_MARCHE`, et la table NEUTRE `FORMES_NEUTRES` qui ne
 * liste rien) sur un fichier réel de CHAQUE couche couverte ; le PÉRIMÈTRE (les sélecteurs du mur sont résolus
 * pour toutes les couches de `src`, et ABSENTS d'un fichier de production — le mur ne vise que les
 * `*.test.*`) ; et la POLICE de la possession, que le mur REMPLACERAIT sur les tests de `src/ui`
 * s'il ne la redisait pas — mesurée sur la config résolue, jamais postulée.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REF = '#1709';
const eslint = creerBancLint();

/** Les couches gardées, et leurs avals interdits. */
const COUCHES = [
  { amont: 'src/engine', avals: ['state', 'ui', 'gameIso'] },
  { amont: 'src/state', avals: ['ui', 'gameIso'] },
  { amont: 'src/data', avals: ['ui', 'state', 'gameIso'] },
] as const;

/** Les 7 formes d'import vers `p`, et la règle qui DOIT les prendre (`null` = passe : élidée). */
const FORMES: { nom: string; code: (p: string) => string; regle: string | null }[] = [
  { nom: 'statique nommé', code: (p) => `import { X } from '${p}';\nexport const a = X;\n`, regle: 'murs/purete-imports' },
  { nom: 'side-effect', code: (p) => `import '${p}';\n`, regle: 'murs/purete-imports' },
  { nom: 'dynamique', code: (p) => `export const f = async () => (await import('${p}')).X;\n`, regle: 'murs/purete' },
  { nom: 'inline type `import(…).T`', code: (p) => `export type A = import('${p}').X;\n`, regle: null },
  { nom: 'import type … from', code: (p) => `import type { X } from '${p}';\nexport type A = X;\n`, regle: null },
  { nom: 'mixte { type X, y }', code: (p) => `import { type X, y } from '${p}';\nexport const a = y;\nexport type B = X;\n`, regle: 'murs/purete-imports' },
  { nom: 'export … from', code: (p) => `export { X } from '${p}';\n`, regle: 'murs/purete-imports' },
];

/** Règles qui ont pris ce code au titre de la PURETÉ (message porteur de la réf ticket). */
async function pris(code: string, filePath: string): Promise<string[]> {
  const [res] = await eslint.lintText(code, { filePath, warnIgnored: false });
  const purete = selectionnerMessages(res, (m) => m.message.includes(REF));
  for (const m of purete) {
    expect(m.ruleId, `${filePath} : ruleId nul — la config n’a pas été résolue (cwd hors dépôt ?), tout serait faussement « pris »`).toBeTruthy();
  }
  return purete.map((m) => m.ruleId!).sort();
}

function tableLint(formes: {nom: string; code: string; tsx?: boolean}[], chemin: string, filtre: (message: {message:string;ruleId:string|null}) => boolean): Record<string,string> {
  const fixtures = formes.map((f,i)=>({code:f.code,filePath:cheminDe(chemin,f).replace(/(\.test)?(\.[^.]+)$/,`-parite-${i}$1$2`)}));
  const resultats = lintFixtures(fixtures);
  return Object.fromEntries(formes.map((f,i)=>{
    const messages=selectionnerMessages(resultats[i], filtre);
    for(const m of messages) expect(m.ruleId,fixtures[i].filePath).toBeTruthy();
    return [f.nom,[...new Set(messages.map(m=>m.ruleId!))].sort().join('+')||'passe'];
  }));
}

/** Deux fichiers RÉELS de la couche (ordre total de `readCorpus`, tests exclus, jamais un nom en
 *  dur) : le PREMIER, et un fichier de SOUS-DOSSIER — un glob `src/x/**` et un spécificateur de
 *  remontée `../../` ne se comportent pas comme à la racine de la couche, et c'est de là que
 *  viennent les inversions réelles (`state/terrain/`, `engine/traits/`). */
function sondes(amont: string): string[] {
  const corpus = readCorpus([amont]);
  const sousDossier = corpus.find((f) => f.rel.slice(amont.length + 1).includes('/'));
  expect(sousDossier, `${amont} : aucun fichier en sous-dossier dans le corpus — la sonde de profondeur ne mesure rien`).toBeTruthy();
  return [corpus[0].rel, sousDossier!.rel];
}

/** Spécificateur relatif de `rel` vers `src/<aval>/x`. */
function specifieur(rel: string, aval: string): string {
  return `${'../'.repeat(rel.split('/').length - 2)}${aval}/x`;
}

describe('pureté de couche — la doctrine vit dans oxlint.config.mjs, mesurée sur la config RÉSOLUE (#1709)', () => {
  for (const { amont, avals } of COUCHES) {
    it(`${amont} : des fichiers RÉELS de la couche (racine ET sous-dossier) sont sous les deux règles`, { timeout: 30_000 }, async () => {
      for (const rel of sondes(amont)) {
        const cfg = await eslint.calculateConfigForFile(`${ROOT}/${rel}`);
        const messages = JSON.stringify([cfg.rules?.['murs/purete-imports'], cfg.rules?.['murs/purete']]);
        for (const aval of avals) {
          expect(
            messages,
            `Bloc de pureté ${amont}→src/${aval} MUET : il ne s’applique à aucun fichier réel de la couche (glob décalé ? dossier renommé ?). Fichier sondé : ${rel}`,
          ).toContain(`src/${aval} à l’EXÉCUTION`);
        }
      }
    });

    for (const aval of avals) {
      it(`${amont} → src/${aval} : les 7 formes rendent le verdict attendu (racine ET sous-dossier)`, { timeout: 30_000 }, async () => {
        const attendu = Object.fromEntries(FORMES.map((f) => [f.nom, f.regle ?? 'passe']));
        for (const rel of sondes(amont)) {
          const chemin = `${ROOT}/${rel}`;
          const p = specifieur(rel, aval);
          const table = tableLint(FORMES.map(f=>({...f,code:f.code(p)})),chemin,m=>m.message.includes(REF));
          expect(table, `${amont} → src/${aval} (sonde : ${rel}, spécificateur : ${p})`).toEqual(attendu);
        }
      });
    }

    it(`${amont} : l’alias \`@/…\` est pris comme le chemin relatif`, { timeout: 30_000 }, async () => {
      for (const rel of sondes(amont)) {
        for (const aval of avals) {
          expect(
            await pris(`import { X } from '@/${aval}/x';\nexport const a = X;\n`, `${ROOT}/${rel}`),
            `${amont} → @/${aval}/x (sonde : ${rel})`,
          ).toEqual(['murs/purete-imports']);
        }
      }
    });
  }

  it('un import LÉGITIME de la couche ne mord pas (fail-open mesuré, pas postulé)', async () => {
    const [rel] = sondes('src/engine');
    expect(await pris("import { rollD100 } from './dice';\nexport const a = rollD100;\n", `${ROOT}/${rel}`)).toEqual([]);
  });
});

/** Les couches dont les TESTS sont sous le mur de l'ordre total. */
const SOUS_LE_MUR = ['src/engine', 'src/state', 'src/ui', 'src/gameIso', 'src/audio', 'src/scenes', 'src/data', 'src'] as const;

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
  const [res] = await eslint.lintText(code, { filePath, warnIgnored: false });
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
    // C’est ce fait qui porte les deux volets ci-dessus pour cette couche — un `ignores` de tête qui la
    // reprendrait les rendrait MUETS et VERTS.
    for (const rel of [sondeTest('src/data'), sondes('src/data')[0]]) {
      expect(
        await eslint.isPathIgnored(`${ROOT}/${rel}`),
        `src/data : Oxlint doit le LIRE (aucun \`ignores\` ne le reprend) — sinon le mur et la pureté de couche y sont muets. Sonde : ${rel}`,
      ).toBe(false);
    }
  });

  it('POLICE : sur un test réel de `src/ui`, la police de la possession et le mur de l’ordre total sont résolus ENSEMBLE', { timeout: 30_000 }, async () => {
    // Chaque mur porte son nom de règle (`murs/possession`, `murs/ordre-total-imports`) : aucun des deux
    // blocs ne remplace les options de l'autre.
    const rel = sondeTest('src/ui');
    const cfg = await eslint.calculateConfigForFile(`${ROOT}/${rel}`);
    expect(JSON.stringify(cfg.rules?.['murs/possession']), `police de la possession DÉSARMÉE sur les tests de src/ui — sonde : ${rel}`).toContain('netOwnership');
    expect(JSON.stringify(cfg.rules?.['murs/ordre-total-imports']), `mur de l’ordre total absent des tests de src/ui — sonde : ${rel}`).toContain('opendirSync');
  });
});
