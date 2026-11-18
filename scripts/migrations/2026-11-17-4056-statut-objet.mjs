/**
 * Migration #4056 — le Statut d'une donnée est un OBJET d'ids, plus un libellé.
 *
 *   forme d'avant                     forme d'après
 *   `"Argent 2"`                      `{ "tier": "argent", "standing": 2 }`
 *
 * Le Statut se juge au parse (`statutSchema`, `src/data/schemas/grammaire/valeurs.ts`).
 *
 * Entrées : `src/data/careerLevels.json` (`status` de chaque Niveau), `src/data/activities.json` (Condition
 * `{ kind: 'status', atLeast }`).
 *
 * Un libellé illisible (Échelon hors `bronze|argent|or`, Standing non entier) est un ARRÊT nominatif (exit 1),
 * AUCUNE écriture. Un Statut déjà objet passe. Rejouée sur l'arbre migré : no-op byte-identique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ECHELONS = ['bronze', 'argent', 'or'];
const STATUT_LU = /^(\S+)\s+(\d+)$/;

const arrets = [];
const gestes = new Map();

/** Le document sérialisé dans la forme de son texte d'origine : indentation de sa 2e ligne, saut final. */
function reserialise(doc, texte) {
  const indent = /^\n?[[{]\r?\n( +)/.exec(texte)?.[1].length ?? 2;
  return `${JSON.stringify(doc, null, indent)}${texte.endsWith('\n') ? '\n' : ''}`;
}

/** Le Statut objet du libellé `texte`, ou `null` (arrêt noté) s'il est illisible. */
function statutDe(texte, chemin) {
  const m = STATUT_LU.exec(texte.trim());
  const tier = m?.[1].toLowerCase();
  if (!m || !ECHELONS.includes(tier)) { arrets.push(`${chemin} : « ${texte} » illisible`); return null; }
  return { tier, standing: Number(m[2]) };
}

/** Migre, dans `doc`, chaque Statut libellé que `cible(noeud)` désigne par sa clé. */
function parcourir(noeud, chemin, cle, fichier) {
  if (Array.isArray(noeud)) { noeud.forEach((v, i) => parcourir(v, `${chemin}[${i}]`, cle, fichier)); return; }
  if (!noeud || typeof noeud !== 'object') return;
  const k = cle(noeud);
  if (k && typeof noeud[k] === 'string') {
    const statut = statutDe(noeud[k], `${chemin}.${k}`);
    if (statut) { noeud[k] = statut; gestes.set(fichier, (gestes.get(fichier) ?? 0) + 1); }
  }
  for (const [c, v] of Object.entries(noeud)) parcourir(v, `${chemin}.${c}`, cle, fichier);
}

const ENTREES = [
  { fichier: 'careerLevels.json', cle: (n) => (n.type === 'careerLevels' ? 'status' : null) },
  { fichier: 'activities.json', cle: (n) => (n.kind === 'status' ? 'atLeast' : null) },
];

const ecritures = [];
for (const { fichier, cle } of ENTREES) {
  const chemin = join(ROOT, 'src/data', fichier);
  const brut = readFileSync(chemin, 'utf8');
  const doc = JSON.parse(brut);
  if (brut !== reserialise(doc, brut)) { arrets.push(`${fichier} : forme non canonique`); continue; }
  parcourir(doc, fichier, cle, fichier);
  if (gestes.get(fichier)) ecritures.push(() => writeFileSync(chemin, reserialise(doc, brut)));
}

if (arrets.length) {
  console.error(`migration #4056 statut — ${arrets.length} arrêt(s), aucune écriture :\n  ${arrets.join('\n  ')}`);
  process.exit(1);
}
for (const ecrire of ecritures) ecrire();
for (const [fichier, n] of gestes) console.log(`migration #4056 statut — ${fichier} : ${n} Statut(s) en objet.`);
