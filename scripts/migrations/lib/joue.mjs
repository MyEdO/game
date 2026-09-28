// Une migration DATÉE jouée dans un DÉPÔT JETABLE : elle y est COPIÉE, puis lancée dans son propre
// processus. Une migration lit sa racine depuis `import.meta.url` — c'est l'emplacement de la copie
// qui la fait travailler sur le dépôt jetable, jamais sur l'arbre réel.
// Source UNIQUE des outils des bancs de migration : fabrication du dépôt (`depot`), témoin
// d'écriture (`ANTIDATE`, `rienTouche`, `crees`), refus d'avant-écriture (`refuse`), lecture de
// l'arbre (`lireArbre`) et du dépôt (`lireDans`). Les formes canoniques d'un document vivent dans
// `croissance.mjs` (`FORMES`, `serialise`).
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = fileURLToPath(new URL('../', import.meta.url));
const RACINE = fileURLToPath(new URL('../../../', import.meta.url));

/** Horodatage ANTIDATÉ de tout fichier posé : une écriture, même à contenu égal, le remonte — le
 *  témoin est déterministe là où l'octet seul ne dit rien (granularité de `mtime` sous Windows). */
export const ANTIDATE = new Date('2000-01-01T00:00:00Z');

/** Le texte d'un fichier de l'ARBRE réel, par chemin relatif à sa racine. */
export const lireArbre = (rel) => fs.readFileSync(path.join(RACINE, rel), 'utf8');

/** Le texte d'un fichier du dépôt jetable `racine`. */
export const lireDans = (racine, rel) => fs.readFileSync(path.join(racine, rel), 'utf8');

/**
 * Dépôt jetable sous `os.tmpdir()` : les chemins `copies` de l'arbre (fichiers ou dossiers) y sont
 * COPIÉS, puis `fichiers` (`{ <rel>: texte }`) y est posé par-dessus, antidaté. REND
 * `{ racine, avant }` — `avant` : la table des textes posés, référence du témoin.
 */
export function depot(fichiers, copies = []) {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'migr-'));
  for (const rel of copies) fs.cpSync(path.join(RACINE, rel), path.join(racine, rel), { recursive: true });
  const avant = new Map();
  for (const [rel, texte] of Object.entries(fichiers)) {
    const cible = path.join(racine, rel);
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    fs.writeFileSync(cible, texte, 'utf8');
    fs.utimesSync(cible, ANTIDATE, ANTIDATE);
    avant.set(rel, texte);
  }
  return { racine, avant };
}

/** Le dépôt jetable, effacé : il ne porte que des COPIES, rien de l'arbre ne part avec. */
export const efface = (racine) => fs.rmSync(racine, { recursive: true, force: true });

/** Les fichiers posés sont INTACTS (présence, octet, horodatage). REND la liste des fautes. */
export function rienTouche(racine, avant) {
  const fautes = [];
  for (const [rel, texte] of avant) {
    const cible = path.join(racine, rel);
    if (!fs.existsSync(cible)) { fautes.push(`${rel} : SUPPRIMÉ`); continue; }
    if (fs.readFileSync(cible, 'utf8') !== texte) fautes.push(`${rel} : octet DIVERGENT`);
    if (fs.statSync(cible).mtimeMs !== ANTIDATE.getTime()) fautes.push(`${rel} : horodatage remonté (écriture)`);
  }
  return fautes;
}

/** Les fichiers du dossier `dossier` (relatif à `racine`) qui ne sont pas au nombre des posés. */
export function crees(racine, avant, dossier) {
  const poses = new Set(avant.keys());
  return fs
    .readdirSync(path.join(racine, dossier))
    .map((f) => path.posix.join(dossier, f))
    .filter((rel) => !poses.has(rel))
    .map((rel) => `${rel} : fichier CRÉÉ`);
}

/** La migration jouée dans le dépôt jetable `racine`, copiée s'il ne la porte pas déjà.
 *  REND `{ code, stdout, stderr, sortie }` — `sortie` : les deux flux mis bout à bout. */
export function joue(racine, migration) {
  const cible = path.join(racine, 'scripts/migrations', migration);
  if (!fs.existsSync(cible)) {
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    fs.copyFileSync(path.join(MIGRATIONS, migration), cible);
  }
  const r = spawnSync(process.execPath, [cible], { encoding: 'utf8' });
  const stdout = r.stdout ?? '';
  const stderr = r.stderr ?? '';
  return { code: r.status, stdout, stderr, sortie: `${stdout}${stderr}` };
}

/** Un rouge d'AVANT-écriture : sur un dépôt portant `fichiers` (et les `copies` de l'arbre, cf.
 *  `depot`), `migration` sort 1, DEMANDE l'arbitrage, NOMME `message`, et ne touche aucun fichier posé. */
export function refuse(migration, fichiers, message, copies = []) {
  const d = depot(fichiers, copies);
  try {
    const { code, sortie } = joue(d.racine, migration);
    assert.equal(code, 1, `sortie ${code} — la migration devait ARRÊTER : ${sortie.slice(0, 1200)}`);
    assert.ok(sortie.includes('ARBITRAGE REQUIS'), `arrêt sans DEMANDER l’arbitrage : ${sortie.slice(0, 1200)}`);
    assert.ok(sortie.includes(message), `arrêt sans NOMMER « ${message} » : ${sortie.slice(0, 1200)}`);
    assert.deepEqual(rienTouche(d.racine, d.avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
  } finally {
    efface(d.racine);
  }
}
