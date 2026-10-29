/**
 * Migration #2820 — le FOYER de la règle d'une entrée (`rule` : id NU + `ruleCategory` : catégorie
 * Codex, `'regles'` par défaut) devient UNE référence typée `{ id, type }`
 * (`foyerDeRegleSchema`, `src/data/schemas/grammaire/valeurs.ts`), dont l'id résout AU PARSE dans
 * l'espace de son type ; `ruleCategory` disparaît.
 *
 * ENTRÉES : écrites — `src/data/actions.json`, `activities.json`, `combat-stakes.json`,
 * `flow-stakes.json`, `night-stakes.json`, `voyage-stakes.json` (listes de racine) et
 * `crew-test-types.json` (`types`) ; LUS — les catalogues des types admis (`CATEGORIES` ci-dessous),
 * pour juger chaque id dans l'espace de son type.
 * TABLE FIGÉE catégorie Codex → type : celle que portaient les données au 2026-10-18. Une catégorie
 * ABSENTE vaut `regles`, le défaut que lisait `resolveStake` ; il s'ÉCRIT (une seule graphie par site).
 * Le type ne se déduit jamais de l'id : un même id vit dans plusieurs espaces (`chute`, `mouvement`…).
 * FAIL-FAST — avant toute écriture, porteurs nommés, sortie 1 : catégorie hors table, `ruleCategory`
 * sans `rule`, `rule` ni chaîne ni référence `{ id, type }`, référence typée qui garde un
 * `ruleCategory`, id absent du catalogue de son type.
 * IDEMPOTENT : une référence `{ id, type }` traverse intacte, quel que soit l'ordre de ses clés ;
 * rejouée sur l'état final, rien ne s'écrit. Rejouable sur une donnée qui mêle les deux formes.
 * FORMATAGE PRÉSERVÉ : chaque fichier est EXACTEMENT `JSON.stringify(doc, null, 2)` (sans saut de ligne
 * final), vérifié avant l'écriture ; `rule` garde sa place dans l'entrée.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const abs = (rel) => path.join(ROOT, rel);
/** Catégorie Codex → type de la grammaire (`TYPES`, `grammaire/ref.ts`) et fichier de son espace. */
const CATEGORIES = {
  regles: { type: 'regle', fichier: 'regles.json' },
  skills: { type: 'skill', fichier: 'skills.json' },
  talents: { type: 'talent', fichier: 'talents.json' },
  etats: { type: 'etat', fichier: 'etats.json' },
  qualities: { type: 'quality', fichier: 'qualities.json' },
  characteristics: { type: 'characteristic', fichier: 'characteristics.json' },
  spells: { type: 'spell', fichier: 'spells.json' },
  psychologies: { type: 'psychology', fichier: 'psychology.json' },
  symptoms: { type: 'symptome', fichier: 'symptoms.json' },
  steamBreakdowns: { type: 'steamBreakdown', fichier: 'steam-breakdown.json' },
};
const DEFAUT = 'regles';

/** Porteurs : fichier → clé de la liste (`null` : la racine). */
const PORTEURS = {
  'actions.json': null,
  'activities.json': null,
  'combat-stakes.json': null,
  'flow-stakes.json': null,
  'night-stakes.json': null,
  'voyage-stakes.json': null,
  'crew-test-types.json': 'types',
};

const lireJson = (rel) => JSON.parse(fs.readFileSync(abs(rel), 'utf8'));
const idsParFichier = new Map();
/** Ids du catalogue `fichier`, lu une fois. */
function idsDe(fichier) {
  if (!idsParFichier.has(fichier)) idsParFichier.set(fichier, new Set(lireJson(`src/data/${fichier}`).map((e) => e?.id)));
  return idsParFichier.get(fichier);
}

const estRefTypee = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v) &&
  Object.keys(v).length === 2 && typeof v.id === 'string' && typeof v.type === 'string';

const echecs = [];
const aEcrire = [];
let migrees = 0;
let defauts = 0;

for (const [fichier, cle] of Object.entries(PORTEURS)) {
  const rel = `src/data/${fichier}`;
  const brut = fs.readFileSync(abs(rel), 'utf8');
  const doc = JSON.parse(brut);
  if (serializeDataset(doc) !== brut) { echecs.push(`${fichier} : le fichier n’est pas sous sa forme canonique — aucun reflow silencieux`); continue; }
  const liste = cle === null ? doc : doc?.[cle];
  if (!Array.isArray(liste)) { echecs.push(`${fichier} : ${cle === null ? 'la racine' : `« ${cle} »`} n’est pas une liste`); continue; }
  let gestes = 0;
  const nouvelle = liste.map((e, i) => {
    const ou = `${fichier} « ${e?.id ?? `[${i}]`} »`;
    if (!e || typeof e !== 'object' || !('rule' in e || 'ruleCategory' in e)) return e;
    if (!('rule' in e)) { echecs.push(`${ou} : ruleCategory « ${e.ruleCategory} » sans rule`); return e; }
    if (estRefTypee(e.rule)) {
      if ('ruleCategory' in e) echecs.push(`${ou} : référence typée ${JSON.stringify(e.rule)} ET ruleCategory « ${e.ruleCategory} » — deux graphies du même foyer`);
      return e;
    }
    if (typeof e.rule !== 'string') { echecs.push(`${ou} : rule ${JSON.stringify(e.rule)} n’est ni un id ni une référence { id, type }`); return e; }
    const categorie = e.ruleCategory ?? DEFAUT;
    const cible = CATEGORIES[categorie];
    if (!cible) { echecs.push(`${ou} : catégorie « ${categorie} » hors de la table figée (${Object.keys(CATEGORIES).join(', ')})`); return e; }
    if (!idsDe(cible.fichier).has(e.rule)) { echecs.push(`${ou} : « ${e.rule} » absent du catalogue ${cible.fichier} (catégorie « ${categorie} »)`); return e; }
    gestes += 1;
    if (e.ruleCategory === undefined) defauts += 1;
    return Object.fromEntries(
      Object.entries(e).flatMap(([k, v]) => (k === 'ruleCategory' ? [] : [[k, k === 'rule' ? { id: v, type: cible.type } : v]])),
    );
  });
  if (gestes > 0) {
    migrees += gestes;
    aEcrire.push([rel, cle === null ? nouvelle : { ...doc, [cle]: nouvelle }]);
  }
}

if (echecs.length) {
  console.error(`[${path.basename(fileURLToPath(import.meta.url))}] ARBITRAGE REQUIS — ${echecs.length} foyer(s) non migrable(s), rien n’est écrit :\n  ${echecs.join('\n  ')}`);
  process.exit(1);
}
for (const [rel, doc] of aEcrire) fs.writeFileSync(abs(rel), serializeDataset(doc));
console.log(
  migrees === 0
    ? 'foyers de règle : no-op (aucun id nu).'
    : `foyers de règle : ${migrees} id(s) nu(s) migré(s) en { id, type } dont ${defauts} au défaut « ${DEFAUT} », ${aEcrire.length} fichier(s) écrit(s).`,
);
