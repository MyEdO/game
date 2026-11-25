/**
 * Générateur GÉNÉRIQUE de registres « dépose un fichier → intégré ». Scanne un dossier `defs/`
 * et écrit un index EXPLICITE (`_registry.generated.ts`) — pas d'`import.meta.glob` (Vite-only,
 * cassé sous tsx) : l'index généré marche partout (app Vite, Vitest, scripts tsx), est
 * inspectable et sans coût runtime. Réutilisable pour créatures / tenues / modèles / etc.
 *
 *   node scripts/gen-registry.mjs            (`npm run gen`, écrit)
 *   node scripts/gen-registry.mjs --check    (ligne de `GENERATORS`, scripts/docs/build-all.mjs : compare sans écrire)
 *
 * La production livre les registres avant de charger la phase 2 (`scripts/gen-espaces.mts`, l'INDEX
 * DES IDS, les CLÉS DE DATASET et les RACINES VIVANTES). Ajouter une entrée = déposer un fichier
 * dans le `defs/` correspondant, puis relancer.
 */
import { readFileSync } from 'node:fs';
import { listerDossier } from './guards/lib/lister.mjs';
import { join } from 'node:path';
import { estFichierVitest, estKitDeTest } from './guards/lib/fichierVitest.mjs';
import { lancerDepuisCLI } from './docs/lib/ecriture-derives.mjs';
import { litteralJs } from './guards/lib/litteralJs.mjs';

import { REGISTRIES, SORTIE_VOCABULAIRES_D_ART } from './docs/lib/cibles-registres.mjs';
export { REGISTRIES } from './docs/lib/cibles-registres.mjs';

/**
 * FORME CANONIQUE de chaque export de premier niveau qu'un def porte et que CE générateur lit :
 * `chaine` = `export const X = '…';`, `presence` = seule l'existence de `export const X` compte (la valeur n'est lue qu'à la compilation du registre).
 * Un nom lu hors de cette table est une faute du générateur, pas du def.
 */
const FORMES_D_EXPORT = {
  file: 'chaine',
  famille: 'chaine',
  meta: 'presence',
};

const CHAINE = "'([^'\\\\\\n]+)'";
const VALEUR_CANONIQUE = new RegExp(`^ = ${CHAINE};$`);

/**
 * LECTEUR UNIQUE des exports de premier niveau d'un def — la seule lecture textuelle d'un export du
 * générateur. Règle unique, par nom lu : export absent → `undefined` ; `export const X` à sa forme
 * canonique (`FORMES_D_EXPORT`) → sa valeur (`true` pour une forme `presence`) ; tout autre export du
 * nom (commentaire en fin de ligne, `as const`, annotation de type, guillemets doubles, `export { … }`,
 * `export let`…) → la génération LÈVE en nommant le def et le champ.
 * @param {string} src source du def
 * @param {readonly string[]} noms exports lus
 * @param {string} def chemin du def, pour le message
 * @returns {Record<string, string | true | undefined>}
 */
export function lireExports(src, noms, def) {
  const lu = {};
  for (const nom of noms) {
    const forme = FORMES_D_EXPORT[nom];
    if (!forme) throw new Error(`gen-registry: lireExports : « ${nom} » n'a aucune forme à FORMES_D_EXPORT.`);
    const declaration = new RegExp(`^export const ${nom}\\b(.*)$`, 'm').exec(src);
    const autreForme = new RegExp(`^export\\s+(?:(?:let|var|function\\*?|async\\s+function|class)\\s+${nom}\\b|const\\s*\\{[^}]*\\b${nom}\\b)|^export\\s*\\{[^}]*\\b${nom}\\s*[,}]`, 'm').test(src);
    const hors = (attendu) =>
      new Error(`gen-registry: ${def} : export « ${nom} » hors de sa forme canonique (${attendu}) — le générateur est textuel, il ne lit que cette forme.`);
    const attendu = forme === 'chaine' ? `export const ${nom} = '…';` : `export const ${nom}`;
    if (autreForme && !declaration) throw hors(attendu);
    if (!declaration) { lu[nom] = undefined; continue; }
    if (forme === 'presence') { lu[nom] = true; continue; }
    const m = VALEUR_CANONIQUE.exec(declaration[1]);
    if (!m) throw hors(attendu);
    lu[nom] = m[1];
  }
  return lu;
}

/** Modules de def d'un dossier — la population de tout registre ; lève si le dossier manque. */
function modulesDeDefs(dir) {
  return listerDossier(dir).filter((f) => /\.tsx?$/.test(f) && !f.startsWith('_') && !estFichierVitest(f) && !estKitDeTest(f) && !f.endsWith('.ascii.ts') && f !== 'index.ts');
}

/** Les exports `noms` de chaque def d'un dossier, par `lireExports` : `{ module, …exports }`. */
export function lireDefs(dir, noms) {
  return modulesDeDefs(dir).map((f) => ({ module: f, ...lireExports(readFileSync(join(dir, f), 'utf8'), noms, join(dir, f)) }));
}

/** Le diagnostic d'une cible de registre périmée. */
const messagesDe = (out) => ({
  staleMsg: `gen-registry — ${out} est PÉRIMÉ (un fichier de defs ou une donnée a changé).`,
  rerunMsg: '  → relancer `npm run gen` (cible de code jamais commitée, #2203 A2).',
});

/** Le module rendu d'un registre, ou `null` quand son dossier n'existe pas. */
function renduDuRegistre(r) {
  const importDir = r.importDir ?? './defs';
  try {
    listerDossier(r.dir);
  } catch {
    return null;
  }
  // Registre à champ `file` : un module du dossier qui ne DÉCLARE pas de document (modules de
  // FORME partagés entre defs) n'est pas une entrée — critère STRUCTUREL, jamais une liste de noms.
  const lus = r.fields
    ? lireDefs(r.dir, [...(r.fields.includes('file') ? ['file'] : []), ...(r.optionalFields ?? [])])
      .filter((d) => !r.fields.includes('file') || d.file !== undefined)
    : modulesDeDefs(r.dir).map((module) => ({ module }));
  const files = lus.map((d) => d.module);
  // `fields` (option PAR registre) : un module de def exporte PLUSIEURS noms (ex. `file`+`schema`,
  // cf. src/data/schemas/defs/) → une entrée `{ champ1, champ2, … }` par fichier, au lieu du
  // tableau plat d'un seul export (`exportName`) des registres « 1 def = 1 valeur ».
  // Alias suffixé (`e0_champ`) UNIQUEMENT pour les registres multi-champs : les registres
  // « 1 def = 1 valeur » gardent `e0` — leur sortie générée reste byte-identique.
  // `optionalFields` : champ qu'un module de def exporte OU NON (`meta`, #1466). Le générateur est
  // TEXTUEL (listing + regex, jamais d'import runtime), donc un export absent doit être vu AVANT
  // d'être importé, sinon le module généré ne compile pas.
  const presents = (i) => (r.optionalFields ?? []).filter((fn) => lus[i][fn] !== undefined);
  const imports = files.map((f, i) => {
    const names = r.fields
      ? [...r.fields, ...presents(i)].map((fn) => `${fn} as e${i}_${fn}`).join(', ')
      : `${r.exportName} as e${i}`;
    return `import { ${names} } from '${importDir}/${f.replace(/\.tsx?$/, '')}';`;
  });
  const constParts = Object.entries(r.constFields ?? {}).map(([k, v]) => `${k}: ${v}`);
  const arr = r.fields
    ? files.map((_, i) => `{ ${[...r.fields, ...presents(i)].map((fn) => `${fn}: e${i}_${fn}`).concat(constParts).join(', ')} }`)
    : files.map((_, i) => `e${i}`);
  // Union de littéraux des ids déclarés dans les defs (option `idUnion`) — triée, dédupliquée.
  // `idUnion.out` posé : l'union s'écrit dans ce module à part, hors du registre des définitions.
  let unionDecl = '';
  if (r.idUnion) {
    const uniq = unionDesIds(r.dir, files, r.idUnion.field);
    // Registre encore VIDE (socle posé avant sa première def) : l'union est `never`, pas la chaîne
    // vide — un `''` accepterait silencieusement l'id vide chez les consommateurs.
    unionDecl =
      `\n/** Union GÉNÉRÉE des \`${r.idUnion.field}\` déclarés dans les defs — le typage réel des consommateurs. */\n` +
      `export type ${r.idUnion.typeName} =\n${uniq.length ? `  | '${uniq.join(`'\n  | '`)}';\n` : '  | never;\n'}`;
  }
  // `dossier` se lit depuis le module écrit : relatif au registre, depuis la racine pour l'union à part.
  const entete = (dossier) =>
    `// GÉNÉRÉ par scripts/gen-registry.mjs — NE PAS ÉDITER À LA MAIN.\n` +
    `// Ajouter une entrée = déposer un fichier dans ${dossier}/ puis \`npm run gen\`.\n`;
  const aPart = Boolean(r.idUnion?.out);
  const body =
    entete(importDir === '.' ? r.dir.split('/').pop() : importDir.replace('./', '')) +
    `import type { ${r.type} } from '${r.typeFrom}';\n` +
    imports.join('\n') + '\n\n' +
    `export const ${r.arrayName}: ${r.type}[] = [${arr.join(', ')}];\n` +
    (aPart ? '' : unionDecl);
  return { body, files: files.length, union: aPart ? { out: r.idUnion.out, body: entete(r.dir) + unionDecl } : null };
}

function ciblesDuRegistre(registre, rendu) {
  return [[registre.out, rendu.body], ...(rendu.union ? [[rendu.union.out, rendu.union.body]] : [])];
}

/**
 * Valeurs du champ `champ` écrites en LITTÉRAL (guillemets simples ou doubles, en tête de ligne) dans
 * la source d'un def — SEULE règle de lecture d'un littéral du générateur (`idUnion`).
 * Un compte hors de la `cardinalite`, ou une mention du champ qui n'est pas un tel littéral, LÈVE en
 * nommant le def : un id calculé, absent ou doublé ne sort pas du registre en silence.
 * @param {string} src source du def
 * @param {string} champ champ lu
 * @param {string} def chemin du def, pour le message
 * @param {'un' | 'auMoinsUn'} cardinalite
 * @returns {string[]}
 */
export function champsLitteraux(src, champ, def, cardinalite) {
  const vus = [...src.matchAll(new RegExp(String.raw`^\s*${champ}:\s*(['"])([^'"\\\n]+)\1`, 'gm'))].map((m) => m[2]);
  if (cardinalite === 'un' ? vus.length !== 1 : vus.length === 0)
    throw new Error(`gen-registry: ${def} : ${vus.length} champ(s) « ${champ} » littéral(aux) — le registre en exige ${cardinalite === 'un' ? 'EXACTEMENT' : 'AU MOINS'} un.`);
  const mentions = [...src.matchAll(new RegExp(String.raw`\b${champ}\s*:`, 'g'))].length;
  if (mentions !== vus.length)
    throw new Error(`gen-registry: ${def} : ${mentions - vus.length} champ(s) « ${champ} » non littéral(aux) — le registre ne lit que des littéraux.`);
  return vus;
}

/**
 * Union des `field` littéraux déclarés par les defs `files` de `dir` (option `idUnion`) — triée, dédupliquée.
 * @param {string} dir @param {string[]} files @param {string} field @returns {string[]}
 */
export function unionDesIds(dir, files, field) {
  const ids = files.flatMap((f) => champsLitteraux(readFileSync(join(dir, f), 'utf8'), field, join(dir, f), 'auMoinsUn'));
  return [...new Set(ids)].sort();
}

/**
 * VOCABULAIRE D'ART d'un registre (option `vocabulaire`, #2968 P-art) : `{ id: libellé }` des defs de `dir`,
 * dans l'ordre de ses modules (`modulesDeDefs`). Chaque def porte EXACTEMENT un `id` et un libellé
 * littéraux (`champsLitteraux`) ; un id que deux defs déclarent LÈVE en les nommant.
 * @param {string} dir @param {{ id: string, libelle: string }} vocabulaire @returns {Record<string, string>}
 */
export function vocabulaireDuRegistre(dir, { id, libelle }) {
  const table = new Map();
  for (const f of modulesDeDefs(dir)) {
    const def = join(dir, f);
    const src = readFileSync(def, 'utf8');
    const [cle] = champsLitteraux(src, id, def, 'un');
    const [nom] = champsLitteraux(src, libelle, def, 'un');
    if (table.has(cle)) throw new Error(`gen-registry: ${def} : l'id « ${cle} » est déjà déclaré par ${table.get(cle).def}.`);
    table.set(cle, { nom, def });
  }
  return Object.fromEntries([...table].map(([cle, { nom }]) => [cle, nom]));
}

/** Le module des VOCABULAIRES D'ART (`SORTIE_VOCABULAIRES_D_ART`) : la table de chaque registre à option
 *  `vocabulaire`, et le dossier de defs qui la porte. */
function renduDesVocabulairesDArt() {
  const registres = REGISTRIES.filter((r) => r.vocabulaire);
  return (
    `// GÉNÉRÉ par scripts/gen-registry.mjs — NE PAS ÉDITER À LA MAIN.\n` +
    `// Régénérer : \`npm run gen\` (option \`vocabulaire\` d'un registre, scripts/docs/lib/cibles-registres.mjs).\n\n` +
    `/** VOCABULAIRES D'ART : la table \`id → libellé\` de chaque registre qui en déclare un, lue à ses defs — des\n` +
    ` *  VOCABULAIRES (\`grammaire/vocabulaires.ts\`). */\n` +
    `export const VOCABULAIRES_D_ART = {\n` +
    registres
      .map((r) => `  ${litteralJs(r.vocabulaire.nom)}: {\n${Object.entries(vocabulaireDuRegistre(r.dir, r.vocabulaire)).map(([cle, nom]) => `    ${litteralJs(cle)}: ${litteralJs(nom)},\n`).join('')}  },\n`)
      .join('') +
    `} as const;\n\n` +
    `/** Le dossier de defs de chaque vocabulaire d'art : le registre que nomme le refus d'une référence (\`refMorte\`). */\n` +
    `export const REGISTRE_DU_VOCABULAIRE_D_ART: Readonly<Record<string, string>> = {\n` +
    registres.map((r) => `  ${litteralJs(r.vocabulaire.nom)}: ${litteralJs(r.dir)},\n`).join('') +
    `};\n`
  );
}

/** La phase 2 charge les schémas TypeScript une fois les registres disponibles. */
async function chargerEspaces() {
  const { tsImport } = await import('tsx/esm/api');
  return tsImport('./gen-espaces.mts', import.meta.url);
}

/** Contrat `rendre()` de `GENERATORS` : chaque cible du registre → son texte, sans écrire. */
export async function rendre() {
  const cibles = new Map();
  for (const r of REGISTRIES) {
    const c = renduDuRegistre(r);
    if (c) for (const [chemin, texte] of ciblesDuRegistre(r, c)) cibles.set(chemin, texte);
  }
  cibles.set(SORTIE_VOCABULAIRES_D_ART, renduDesVocabulairesDArt());
  const espaces = await chargerEspaces();
  for (const [chemin, texte] of await espaces.rendre()) cibles.set(chemin, texte);
  return cibles;
}

export async function* produire({ check }) {
  const calculer = (fn) => {
    if (!check) return fn();
    try {
      return fn();
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      process.exitCode = (Number(process.exitCode) || 0) | 1;
      return undefined;
    }
  };
  const libelle = (nom, detail, changed) =>
    check
      ? `gen-registry --check: ${nom} ${changed ? 'PÉRIMÉ' : 'à jour'} (${detail})`
      : `gen-registry: ${nom} ← ${detail}${changed ? '' : ' [inchangé]'}`;
  const journal = [];
  for (const r of REGISTRIES) {
    const c = calculer(() => renduDuRegistre(r));
    if (!c) {
      if (c === null) journal.push(`gen-registry: ${r.arrayName} ← dossier absent (${r.dir}) — ignoré`);
      continue;
    }
    let changed = false;
    for (const [path, out] of ciblesDuRegistre(r, c)) {
      const aJour = yield { path, out, ...messagesDe(path) };
      changed = !aJour || changed;
    }
    journal.push(libelle(r.arrayName, `${c.files} fichiers, ${r.dir}`, changed));
  }
  for (const ligne of journal) console.log(ligne);
  const vocabulaire = calculer(renduDesVocabulairesDArt);
  if (vocabulaire !== undefined) {
    const aJour = yield { path: SORTIE_VOCABULAIRES_D_ART, out: vocabulaire, ...messagesDe(SORTIE_VOCABULAIRES_D_ART) };
    console.log(libelle('VOCABULAIRES_D_ART', SORTIE_VOCABULAIRES_D_ART, !aJour));
  }
  const espaces = await chargerEspaces();
  yield* espaces.produire({ check }, messagesDe);
}

if (import.meta.main) await lancerDepuisCLI(import.meta, produire);
