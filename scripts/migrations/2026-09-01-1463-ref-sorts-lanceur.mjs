/**
 * Migration L-ref-2 (#1463) — la Portée/Cible d'un Sort cesse de DÉSIGNER son lanceur en toutes
 * lettres : `{kind:'special', text:'Sorcier'|'Sorcière'|'Skaven'|'Démon'|'démon'|'Rebouteux'}`
 * devient `{kind:'self'}`, la forme que le moteur porte déjà (114 `range` + 105 `target` en donnée).
 *
 * MOTIF AU SOURCE — les tables de Sorts du livre `frenchy-bzh` impriment, dans les colonnes
 * « Portée » et « Cible », le NOM DU LANCEUR du chapitre courant, là où le Livre de base imprime
 * « Vous » :
 *   `Source/Warhammer - Habitants & Creatures  du Vieux-Monde (Discord) PDF/71 - Necromanciens.md`
 *   l.249 : « |**Armure**<br>**d’AEthyr**|_AEthyric_<br>_Armour_|0|Sorcier|Sorcier|7 Rounds|Le PJ
 *   bénéficie de 2 Points d’Armure sur tout le corps. » — le bénéficiaire EST le lanceur ;
 *   `57 - Clan Eshin.md` l.264 « |Poids Plume|…|6|Skaven|Skaven|40 Minutes|le sorcier semble aussi
 *   léger que du liège. » ; `50 - Demons de Nurgle.md` l.214 « |Furoncle<br>Infecté|…|5|Démon|Démon| »
 *   ; `51 - Demons de Tzeentch.md` l.188 « |Langue des<br>Tzaangors|…|0|démon|démon| » (minuscule) ;
 *   `26 - Services Ruraux Frequents & Usuels.md` l.385 « |Position|_Bearings_|0|Rebouteux|Rebouteux|
 *   Instantané|Le PJ sait où est le nord » et l.575 « |Vol|_Flight_|Sorcière|Sorcière|30 minutes| » ;
 *   `43 - Ungors, Gors & Bestigors.md` l.584 « |Flamme|_Magic Flame_|0|Shaman|Shaman|6 Rounds|Une
 *   flamme apparaît dans la paume du Shaman. » et l.804 « |Secousse<br>Tellurique|…|6|Mage|Zone
 *   Diamètre 8 mètres| » ; `49 - Demons de Slaanesh.md` l.79 « |Langue des<br>Slaangors|…|0|Mage|Mage| » ;
 *   `61 - Prophete Gris.md` l.97 « |Faveur du Rat<br>Cornu|…|0|Mage|Mage|13 heures|Le Mage gagne
 *   +1 Point de Détermination. » ; `67 - Orcs.md` l.605 « |**WAAAGH !**|…|11|Mage|Zone Diamètre 85 Mètres| ».
 * Le même Sort s'imprime « Vampire|Vampire » au chapitre des Vampires, et « Sorcier|Shaman » au
 * ch. 46 (l.70, Bélier) : c'est la DÉSIGNATION du porteur de la table, pas une cible tierce. La
 * cible correcte est donc `self`, jamais une référence de carrière ou d'espèce
 * (`src/engine/spellRange.test.ts` avait relevé l'anomalie sans suite).
 *
 * LISTE CLOSE, jamais un motif : seuls les 8 textes ci-dessus migrent. L'échappatoire `special`
 * reste entière pour « Spécial », « Voir texte », « 1 voilier dans la Ligne de vue »…
 *
 * ENTRÉES : `src/data/spells.json` — les seules clés `range` et `target` des entrées de racine ;
 * aucun autre fichier n'est lu. Cardinal ASSERTÉ champ par champ, total 54 (32 Sorts) :
 *  - `[].range` — 32 (Skaven 7, Mage 6, Démon 6, Shaman 4, Sorcier 3, Rebouteux 3, Sorcière 2, démon 1) ;
 *  - `[].target` — 22 (Skaven 4, Démon 4, Mage 3, Shaman 3, Sorcier 3, Rebouteux 2, Sorcière 2, démon 1).
 * Une colonne « Cible » qui portait autre chose que le lanceur n'entre PAS (Bouclier, Désarroi,
 * Secousse Tellurique, WAAAGH ! : leur `target` est une ZdE, déjà structurée `kind:'area'`).
 * EXHAUSTIVITÉ : un porteur d'un texte de la liste close rencontré HORS de ces deux clés (une
 * `duration`, une variante, un statbloc embarqué) est une anomalie → rien n'est écrit, sortie 1.
 * IDEMPOTENT : rejouée sur l'état final, elle ne trouve plus aucun porteur et sort 0.
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 2)` exact (LF), constaté AVANT toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FICHIER = 'src/data/spells.json';

/** LISTE CLOSE des désignations de lanceur imprimées par `frenchy-bzh` (graphies EXACTES du livre,
 *  minuscule comprise). Tout autre texte `special` reste tel quel. */
const LANCEUR = ['Sorcier', 'Sorcière', 'Skaven', 'Démon', 'démon', 'Rebouteux', 'Mage', 'Shaman'];

/** Clés d'entrée PORTEUSES d'une désignation de lanceur. Leur NOMBRE n'est pas asserté (#1812) : le
 *  catalogue des Sorts grandit à chaque livre FR, et un sort neuf à la graphie ancienne doit se
 *  MIGRER, pas faire sortir 1. */
const CHAMPS = ['range', 'target'];

const abs = path.join(ROOT, FICHIER);
const brut = fs.readFileSync(abs, 'utf8');
const data = JSON.parse(brut);
if (JSON.stringify(data, null, 2) !== brut) {
  console.error(`FORME NON CANONIQUE — ${FICHIER} n'est pas un JSON indenté à 2 ; AUCUNE écriture.`);
  process.exit(1);
}
if (!Array.isArray(data)) {
  console.error(`FORME INATTENDUE — ${FICHIER} n'est pas une liste d'entrées ; AUCUNE écriture.`);
  process.exit(1);
}

/** Un nœud désigne-t-il le lanceur en toutes lettres ? */
const designeLeLanceur = (n) =>
  !!n && typeof n === 'object' && !Array.isArray(n) && n.kind === 'special' && LANCEUR.includes(n.text);

/** Tout porteur, où qu'il soit dans le document — contrôle d'EXHAUSTIVITÉ. */
function* partout(noeud, chemin) {
  if (Array.isArray(noeud)) { for (const e of noeud) yield* partout(e, `${chemin}[]`); return; }
  if (noeud == null || typeof noeud !== 'object') return;
  if (designeLeLanceur(noeud)) yield chemin;
  for (const [k, v] of Object.entries(noeud)) yield* partout(v, `${chemin}.${k}`);
}

const anomalies = [];

/** SITES relevés AVANT toute écriture : `{ index, champ, valeur }`. */
const sites = [];
for (const [champ] of CHAMPS) {
  for (const [i, entree] of data.entries()) {
    if (!entree || typeof entree !== 'object') continue;
    if (designeLeLanceur(entree[champ])) sites.push({ i, champ, valeur: entree[champ] });
  }
}
for (const chemin of partout(data, '')) {
  if (!/^\[\]\.(range|target)$/.test(chemin)) anomalies.push(`${FICHIER} : désignation de lanceur HORS clé déclarée (${chemin})`);
}

if (anomalies.length) {
  console.error(`ANOMALIES (${anomalies.length}) — AUCUNE écriture :`);
  for (const a of anomalies) console.error(`  - ${a}`);
  process.exit(1);
}

if (sites.length === 0) {
  console.log("RIEN À FAIRE — aucune Portée/Cible ne désigne son lanceur en toutes lettres.");
  process.exit(0);
}

// FORME, jamais cardinal (#1812) : chaque site relevé porte une clé DU VOCABULAIRE et une valeur
// `special` dont le texte est de la LISTE CLOSE ci-dessus — c'est cela qui délimite le périmètre.
for (const s of sites) {
  assert.ok(CHAMPS.includes(s.champ), `${FICHIER} ${data[s.i].id} : champ ${s.champ} hors {${CHAMPS.join(', ')}}`);
  assert.ok(LANCEUR.includes(s.valeur.text), `${FICHIER} ${data[s.i].id}.${s.champ} : « ${s.valeur.text} » hors liste close`);
}

for (const { i, champ } of sites) data[i][champ] = { kind: 'self' };

// SEULES les valeurs relevées ont changé : le document d'entrée, aux SEULS sites relevés remplacés
// par `{kind:'self'}`, est deep-equal au document écrit.
const temoin = JSON.parse(brut);
for (const { i, champ } of sites) temoin[i][champ] = { kind: 'self' };
assert.deepEqual(data, temoin, `${FICHIER} : la migration a changé autre chose que les Portées/Cibles relevées`);

fs.writeFileSync(abs, JSON.stringify(data, null, 2));
const journal = sites.map((s) => `${data[s.i].id}.${s.champ} (« ${s.valeur.text} »)`);
console.log(`${sites.length} Portée(s)/Cible(s) « lanceur » → {kind:'self'} :`);
for (const l of journal) console.log(`  ${l}`);
