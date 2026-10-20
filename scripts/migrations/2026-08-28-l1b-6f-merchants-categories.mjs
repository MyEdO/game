/**
 * Migration #1467 L1b V-P5 — `merchants.json` : `category.types` devient `category.categories`.
 *
 * MOTIF MESURÉ : le champ liste des CATÉGORIES de catalogue et rien d'autre — mesuré sur l'unique
 * porteur (`armurier`) : {ammunition, armor, melee, ranged} ⊆ `trappings.categorie` (5 valeurs
 * réelles). Il est comparé DIRECTEMENT au champ renommé par la vague 6d
 * (`noyau/merchantFlow.ts` : `arch.category.categories.includes(t.categorie)`) : même concept, donc
 * même terme. Son frère `subTypes` NE BOUGE PAS — `trappings.subType` n'a pas changé de nom.
 * Le nom change, les VALEURS ne changent pas.
 *
 * POSITION PRÉSERVÉE : `categories` prend la place exacte qu'occupait `types` dans `category`.
 *
 * ENTRÉES : `src/data/merchants.json` (la seule donnée lue et écrite), `src/data/trappings.json`
 * (LECTURE SEULE — vocabulaire de catégorie contre lequel les valeurs sont vérifiées).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une entrée portant déjà `categories` (et plus de `types`)
 * est reconnue migrée ; rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : `category` portant les deux noms, `types` non-tableau, valeur hors du vocabulaire de
 * catégorie mesuré sur `trappings.json`, racine VIDE → rien n'est écrit, sortie 1. JAMAIS un
 * cardinal (#1812) : le catalogue des marchands est app-owned et grandit.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)` (vérifié avant toute
 * écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/merchants.json');
const CATALOGUE = path.join(ROOT, 'src/data/trappings.json');

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);

if (JSON.stringify(data, null, 2) !== brut) {
  console.error('FORME NON CANONIQUE — src/data/merchants.json n’est pas `JSON.stringify(doc, null, 2)` ; AUCUNE écriture.');
  process.exit(1);
}

/** Vocabulaire de catégorie MESURÉ sur le catalogue, jamais recopié à la main. */
const VALEURS = new Set(JSON.parse(fs.readFileSync(CATALOGUE, 'utf8')).map((t) => t.categorie ?? t.type));

const echecs = [];
if (!Array.isArray(data)) echecs.push('racine non tableau');
else if (!data.length) echecs.push('racine VIDE — périmètre déplacé');

let migres = 0;
let dejaMigres = 0;
let sansTypes = 0;

const sortie = Array.isArray(data)
  ? data.map((e, i) => {
      const c = e?.category;
      if (c == null || typeof c !== 'object') { echecs.push(`merchants #${i} (${e?.id}) : \`category\` absent ou non objet`); return e; }
      const aTypes = c.types !== undefined;
      const aCats = c.categories !== undefined;
      if (aTypes && aCats) { echecs.push(`merchants #${i} (${e.id}) : \`category\` porte À LA FOIS \`types\` et \`categories\``); return e; }
      if (aCats) { dejaMigres++; return e; }
      if (!aTypes) { sansTypes++; return e; } // marchand classé par `subTypes` seuls — rien à renommer
      if (!Array.isArray(c.types)) { echecs.push(`merchants #${i} (${e.id}) : \`types\` de forme inattendue ${JSON.stringify(c.types)}`); return e; }
      const hors = c.types.filter((v) => !VALEURS.has(v));
      if (hors.length) { echecs.push(`merchants #${i} (${e.id}) : ${JSON.stringify(hors)} hors du vocabulaire de catégorie de trappings.json`); return e; }
      migres++;
      return { ...e, category: Object.fromEntries(Object.entries(c).map(([k, v]) => [k === 'types' ? 'categories' : k, v])) };
    })
  : data;

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

const out = JSON.stringify(sortie, null, 2);
if (out !== brut) fs.writeFileSync(CIBLE, out, 'utf8');

// PREUVE post-écriture : plus aucun `types`, listes conservées entrée par entrée, `subTypes` intact.
const apres = JSON.parse(out);
const residus = apres.filter((e) => e.category?.types !== undefined).length;
const avant = data.map((e) => (e.category?.types ?? e.category?.categories ?? []).join('/')).join('|');
const rendu = apres.map((e) => (e.category?.categories ?? []).join('/')).join('|');
const subAvant = data.map((e) => (e.category?.subTypes ?? []).join('/')).join('|');
const subApres = apres.map((e) => (e.category?.subTypes ?? []).join('/')).join('|');
if (residus || avant !== rendu || subAvant !== subApres || apres.length !== data.length) {
  console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE : ${residus} \`types\` résiduel(s), ${apres.length} entrée(s), listes ${avant === rendu ? 'conservées' : 'ALTÉRÉES'}, subTypes ${subAvant === subApres ? 'intacts' : 'ALTÉRÉS'}`);
  process.exit(1);
}

console.log(`merchants.json — \`category.types\` → \`category.categories\` : ${migres} migrée(s), ${dejaMigres} déjà migrée(s), ${sansTypes} sans \`types\``);
console.log(`Entrées : ${apres.length} ; \`types\` restant : 0 ; valeurs ${rendu.split('|').filter(Boolean).join(' ; ') || '—'} ; \`subTypes\` intacts`);
console.log(`Fichier ${out !== brut ? 'réécrit' : 'INCHANGÉ'} : src/data/merchants.json`);
