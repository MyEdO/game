/**
 * Générateur GÉNÉRIQUE de registres « dépose un fichier → intégré ». Scanne un dossier `defs/`
 * et écrit un index EXPLICITE (`_registry.generated.ts`) — pas d'`import.meta.glob` (Vite-only,
 * cassé sous tsx) : l'index généré marche partout (app Vite, Vitest, scripts tsx), est
 * inspectable et sans coût runtime. Réutilisable pour créatures / tenues / modèles / etc.
 *
 *   node scripts/gen-registry.mjs            (`npm run gen`, écrit)
 *   node scripts/gen-registry.mjs --check    (ligne de `GENERATORS`, scripts/docs/build-all.mjs : compare sans écrire)
 *
 * `genAll` joue la PHASE 1 (ces registres) puis la PHASE 2 (`scripts/gen-espaces.mts`, l'INDEX DES
 * IDS, les CLÉS DE DATASET et les RACINES VIVANTES), pour `npm run gen`, `npm run build` et le plugin
 * Vite (`vite.config.ts`, donc chaque run Vitest). Ajouter une entrée = déposer un fichier dans le `defs/` correspondant, puis relancer.
 */
import { readFileSync } from 'node:fs';
import { listerDossier } from './guards/lib/lister.mjs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { estFichierVitest } from './guards/lib/fichierVitest.mjs';
import { litteralJs } from './guards/lib/litteralJs.mjs';
import { ecrireOuVerifier } from './docs/lib/ecriture-derives.mjs';

import { REGISTRIES, SORTIE_ART } from './docs/lib/cibles-registres.mjs';
export { REGISTRIES, SORTIES_DES_ESPACES, SORTIES } from './docs/lib/cibles-registres.mjs';



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
  return listerDossier(dir).filter((f) => /\.tsx?$/.test(f) && !f.startsWith('_') && !estFichierVitest(f) && !f.endsWith('.ascii.ts') && f !== 'index.ts');
}

/** Les exports `noms` de chaque def d'un dossier, par `lireExports` : `{ module, …exports }`. */
export function lireDefs(dir, noms) {
  return modulesDeDefs(dir).map((f) => ({ module: f, ...lireExports(readFileSync(join(dir, f), 'utf8'), noms, join(dir, f)) }));
}

/** Le rouge d'un registre périmé en `--check` : `genAll` résume lui-même le reste. */
export const MESSAGES_DE = (out) => ({
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
  let unionDecl = '';
  if (r.idUnion) {
    const uniq = unionDesIds(r.dir, files, r.idUnion.field);
    // Registre encore VIDE (socle posé avant sa première def) : l'union est `never`, pas la chaîne
    // vide — un `''` accepterait silencieusement l'id vide chez les consommateurs.
    unionDecl =
      `\n/** Union GÉNÉRÉE des \`${r.idUnion.field}\` déclarés dans les defs — le typage réel des consommateurs. */\n` +
      `export type ${r.idUnion.typeName} =\n${uniq.length ? `  | '${uniq.join(`'\n  | '`)}';\n` : '  | never;\n'}`;
  }
  const body =
    `// GÉNÉRÉ par scripts/gen-registry.mjs — NE PAS ÉDITER À LA MAIN.\n` +
    `// Ajouter une entrée = déposer un fichier dans ${importDir === '.' ? r.dir.split('/').pop() : importDir.replace('./', '')}/ puis \`npm run gen\`.\n` +
    `import type { ${r.type} } from '${r.typeFrom}';\n` +
    imports.join('\n') + '\n\n' +
    `export const ${r.arrayName}: ${r.type}[] = [${arr.join(', ')}];\n` +
    unionDecl;
  return { body, files: files.length };
}

function genOne(r, check) {
  const c = renduDuRegistre(r);
  if (!c) return { arrayName: r.arrayName, dir: r.dir, files: 0, changed: false, missing: true };
  // `ecrireDoc` n'écrit que si le contenu change (évite de toucher le mtime → boucles de watch).
  const changed = !ecrireOuVerifier({ out: c.body, path: r.out, check, ...MESSAGES_DE(r.out) });
  return { arrayName: r.arrayName, dir: r.dir, files: c.files, changed, missing: false };
}

/**
 * Valeurs du champ `champ` écrites en LITTÉRAL (guillemets simples ou doubles, en tête de ligne) dans
 * la source d'un def — SEULE règle de lecture d'un littéral du générateur (`idUnion`, `projection`).
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
 * Projection d'un registre de defs : `[id]` par def, ou `[id, valeur de champ]` avec `projection.champ`.
 * FAIL-FAST nominatif : un id porté par deux defs lève.
 * @param {string} dir dossier des defs
 * @param {{ nom:string, champ?:string }} projection
 * @returns {string[][]}
 */
export function projeterDefs(dir, projection) {
  const lignes = modulesDeDefs(dir).map((f) => {
    const src = readFileSync(join(dir, f), 'utf8');
    const [id] = champsLitteraux(src, 'id', join(dir, f), 'un');
    return projection.champ ? [id, ...champsLitteraux(src, projection.champ, join(dir, f), 'un')] : [id];
  });
  const vus = new Set();
  for (const [id] of lignes) {
    if (vus.has(id)) throw new Error(`gen-registry: ${dir} : id « ${id} » porté par deux defs — ${projection.nom} ne peut pas se projeter.`);
    vus.add(id);
  }
  return lignes.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Le module des projections (`projection` des `REGISTRIES`) rendu, et le compte de chaque bloc. */
function renduDesProjections(registres = REGISTRIES) {
  const blocs = registres.filter((r) => r.projection).map((r) => {
    const lignes = projeterDefs(r.dir, r.projection);
    const tete = `/** Projection GÉNÉRÉE de \`${r.dir}\`${r.projection.champ ? ` : id → \`${r.projection.champ}\`` : ' : ids'} (${lignes.length}). */\n`;
    if (!r.projection.champ)
      return { nom: r.projection.nom, n: lignes.length, texte: `${tete}export const ${r.projection.nom}: readonly string[] = [\n${lignes.map(([id]) => `  ${litteralJs(id)},\n`).join('')}];\n` };
    const valeurs = [...new Set(lignes.map(([, v]) => v))].sort().map((v) => litteralJs(v)).join(' | ');
    return { nom: r.projection.nom, n: lignes.length, texte: `${tete}export const ${r.projection.nom}: Readonly<Record<string, ${valeurs}>> = {\n${lignes.map(([id, v]) => `  ${litteralJs(id)}: ${litteralJs(v)},\n`).join('')}};\n` };
  });
  const body =
    `// GÉNÉRÉ par scripts/gen-registry.mjs — NE PAS ÉDITER À LA MAIN.\n` +
    `// Régénérer : \`npm run gen\` (option \`projection\` des REGISTRIES).\n\n` +
    blocs.map((b) => b.texte).join('\n');
  return { body, blocs: blocs.map((b) => `${b.nom}=${b.n}`) };
}

/** Module des projections, écrit seulement s'il change. */
function genArt(check, out = SORTIE_ART) {
  const { body, blocs } = renduDesProjections();
  const changed = !ecrireOuVerifier({ out: body, path: out, check, ...MESSAGES_DE(out) });
  return { out, blocs, changed };
}

/** Un processus enfant `node --import tsx <args>` à la racine du dépôt : la PHASE 2 (`scripts/gen-espaces.mts`)
 *  parse les documents par leurs schémas TypeScript. */
const sousTsx = (args, options) =>
  spawnSync(process.execPath, ['--import', 'tsx', ...args], { cwd: fileURLToPath(new URL('..', import.meta.url)), ...options });

/** Les modules de la PHASE 2 rendus par `rendre()` de `scripts/gen-espaces.mts` (`sousTsx`), sans rien écrire. */
function espacesRendus() {
  const code = "const { rendre } = await import('./scripts/gen-espaces.mts'); process.stdout.write(JSON.stringify([...(await rendre())]));";
  const r = sousTsx(['--input-type=module', '-e', code], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`gen-registry: rendu de la phase 2 (scripts/gen-espaces.mts) en échec (exit ${r.status ?? r.signal}) :\n${r.stderr}`);
  return JSON.parse(r.stdout);
}

/** Contrat `rendre()` de `GENERATORS` (scripts/docs/build-all.mjs) : chaque cible de `SORTIES` → son
 *  texte, sans écrire. */
export function rendre() {
  const rendu = new Map();
  for (const r of REGISTRIES) {
    const c = renduDuRegistre(r);
    if (c) rendu.set(r.out, c.body);
  }
  rendu.set(SORTIE_ART, renduDesProjections().body);
  for (const [chemin, texte] of espacesRendus()) rendu.set(chemin, texte);
  return rendu;
}

/**
 * PHASE 2 : l'INDEX DES IDS, par `scripts/gen-espaces.mts` (`sousTsx`). Hors `--check`, lève si
 * l'enfant échoue ; en `--check`, son code de sortie (bit « corps périmé » compris) rejoint celui de
 * ce processus.
 */
function genEspaces(verbose, check) {
  const r = sousTsx(['scripts/gen-espaces.mts', ...(verbose ? [] : ['--silencieux']), ...(check ? ['--check'] : [])], { stdio: 'inherit' });
  if (r.status === 0) return;
  if (check && r.status !== null) {
    process.exitCode = (Number(process.exitCode) || 0) | r.status;
    return;
  }
  throw new Error(`gen-registry: phase 2 (scripts/gen-espaces.mts) en échec (exit ${r.status ?? r.signal}).`);
}

/**
 * Régénère TOUS les registres (phase 1), les projections d'art (`genArt`), puis l'INDEX DES IDS
 * (phase 2). `verbose` (défaut `false`) : en mode silencieux (appel `buildStart` du plugin Vite de
 * `vite.config.ts`, que chaque run Vitest déclenche), n'imprime QUE les registres réellement RÉGÉNÉRÉS ou en erreur
 * (dossier absent), + UNE ligne agrégée pour le reste — évite les ~15 lignes « [inchangé] » qui
 * polluent chaque sortie de test et cassent le parseur pass/fail de l'outil `rtk`. En mode verbose
 * (exécution directe `npm run gen`), détail complet (usage : audit manuel de ce que le générateur a vu).
 */
export function genAll(verbose = false, { check = false } = {}) {
  // En `--check`, une validation qui LÈVE est un rouge (bit 1) parmi les autres : levée hors du
  // processus, elle sortirait en 1 et effacerait le bit « corps périmé » d'un registre déjà jugé.
  const jouer = (fn) => {
    if (!check) return fn();
    try {
      return fn();
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      process.exitCode = (Number(process.exitCode) || 0) | 1;
      return null;
    }
  };
  const libelle = (nom, detail, changed) =>
    check
      ? `gen-registry --check: ${nom} ${changed ? 'PÉRIMÉ' : 'à jour'} (${detail})`
      : `gen-registry: ${nom} ← ${detail}${changed ? '' : ' [inchangé]'}`;
  const results = REGISTRIES.map((r) => jouer(() => genOne(r, check))).filter(Boolean);
  let unchangedCount = 0;
  for (const res of results) {
    if (res.missing) {
      console.log(`gen-registry: ${res.arrayName} ← dossier absent (${res.dir}) — ignoré`);
      continue;
    }
    if (res.changed || verbose) {
      console.log(libelle(res.arrayName, `${res.files} fichiers, ${res.dir}`, res.changed));
    } else {
      unchangedCount++;
    }
  }
  const artRes = jouer(() => genArt(check));
  if (artRes && (artRes.changed || verbose)) {
    console.log(libelle("projections d'art", `${artRes.blocs.join(', ')}, ${artRes.out}`, artRes.changed));
  } else if (artRes) {
    unchangedCount++;
  }
  if (!verbose && unchangedCount > 0) {
    console.log(`gen-registry: ${unchangedCount} registre${unchangedCount > 1 ? 's' : ''} à jour`);
  }
  genEspaces(verbose, check);
}

// Exécution directe (node scripts/gen-registry.mjs) : détail complet (audit manuel). Point d'entrée
// seulement — l'importer (`vite.config.ts`, gardes, `scripts/gen-espaces.mts`) n'exécute rien.
if (import.meta.main) {
  genAll(true, { check: process.argv.includes('--check') });
}
