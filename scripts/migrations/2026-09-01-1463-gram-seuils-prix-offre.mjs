/**
 * Migration #1463 L-gram-3 (vague `grammaire`) — les SEUILS du prix d'offre deviennent des FOURCHETTES.
 *
 *   `sea-cargo.json  › vente.prixDOffre`      `{ sum, pct }`            → `{ min, max, pct }`
 *   `land-cargo.json › vente.offreParRichesse` `{ richesse, label, pct }` → `{ min, max, label, pct }`
 *
 * Les deux livres impriment une table à BANDES lue par une colonne d'entrée, et les deux étaient
 * authorées par leur seule borne BASSE, relues par un `[...t].reverse().find(v >= seuil)` à repli
 * silencieux. Les bornes deviennent celles que `findTableEntry` (`src/engine/tables.ts`) lit.
 *
 * MARITIME — `Source/WH - V4 - La Mer de Griffe/15 - Longs voyages.md` l.378-383 :
 *   « | Richesse + Taille +<br>Demande du Lieu | Prix d'offre       |
 *     | 1 | Prix de base –50 % | | 2 | Prix de base –25 % | | 3 | Prix de base –10 % |
 *     | 4 ou plus | Prix de base | »
 * « 4 ou plus » est une bande OUVERTE : `max: null` (JSON n'a pas d'Infinity — `plageOuverteSchema`).
 *
 * TERRESTRE — `Source/Warhammer v4 - 2.0 Mort sur le Reik Compagnon/13 - CHAPITRE 11 - Règles du
 * commerce.md` l.150-156 :
 *   « | Richesse de<br>l'emplacement | Description | Offre                |
 *     | 1 | Misérable | 50 % du prix de base | | 2 | Pauvre | -20 % | | 3 | Moyen | Prix de base |
 *     | 4 | Animé | +5 % | | 5 | Prospère | +10 % | »
 * Cinq lignes, une par valeur de l'Indice de richesse (l.52-60 : de 1 à 5), et AUCUN « ou plus » :
 * les cinq bandes sont FERMÉES aux deux bouts.
 *
 * ARBITRAGE NOMMÉ — LES LIBÉLLÉS. Le livre se contredit sur la colonne Description : l.52-60 imprime
 * l'échelle des indices (« | Misérable | - | | Pauvre | 1 | | Moyen | 2 | | Animé | 3 | | Prospère | 4 |
 * | Florissant | 5 | »), tandis que la table d'offre l.150-156 décale les mots d'un cran (« 1 |
 * Misérable » … « 5 | Prospère »). Son PROPRE exemple tranche par le NUMÉRO, l.174 : « Kemperbad a une
 * Richesse Prospère (Indice de richesse 4) donnant une Mise à prix de +5 % par rapport au Prix de base
 * original de 750 CO. » — or l.156 nomme « Prospère » l'indice 5. La table se lit donc par l'indice, et
 * ce sont les LIBELLÉS de l.150-156 qui glissent. On garde les POURCENTAGES de l.150-156 (que
 * l'exemple confirme : indice 4 → +5 %) et on recale les LIBELLÉS sur l.52-60 + l.174 : 1 Pauvre,
 * 2 Moyen, 3 Animé, 4 Prospère, 5 Florissant. « Misérable », dont l.55 imprime « - », n'a AUCUN indice :
 * il sort du domaine authorable (`defs-scenes/worldmap.ts` borne la saisie à 1..5). Cardinal 5.
 *
 * CARDINAL ASSERTÉ SUR LE RÉSULTAT : 4 bandes maritimes (la dernière ouverte) et 5 bandes terrestres
 * (toutes fermées), contiguës depuis 1, aux pourcentages ci-dessus — ni plus ni moins. Vrai sur un
 * arbre vierge comme au rejeu ; tout écart est un ARRÊT (exit 1).
 *
 * ENTRÉES : `src/data/sea-cargo.json`, `src/data/land-cargo.json` (seuls documents lus et écrits).
 * IDEMPOTENT : rejouée, elle ne voit plus aucun `sum`/`richesse` et n'écrit rien.
 * FORMATAGE : `JSON.stringify(doc, null, 2)`, vérifié canonique AVANT toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MER = path.join(ROOT, 'src/data/sea-cargo.json');
const TERRE = path.join(ROOT, 'src/data/land-cargo.json');

/** Bandes maritimes attendues au RÉSULTAT : `min` → `[max, pct]` (MDG 15 l.378-383). */
const ATTENDU_MER = { 1: [1, -50], 2: [2, -25], 3: [3, -10], 4: [null, 0] };
/** Bandes terrestres attendues au RÉSULTAT : `min` → `[max, label, pct]` — pourcentages de
 *  MSRC 13 l.150-156, libellés de l.52-60 confirmés par l'exemple l.174 (cf. l'arbitrage en tête). */
const ATTENDU_TERRE = {
  1: [1, 'Pauvre', -50],
  2: [2, 'Moyen', -20],
  3: [3, 'Animé', 0],
  4: [4, 'Prospère', 5],
  5: [5, 'Florissant', 10],
};
/** Libellé par indice — l'unique geste de recalage (l.52-60), keyé par l'INDICE, jamais par l'ancien mot. */
const LIBELLE_PAR_INDICE = { 1: 'Pauvre', 2: 'Moyen', 3: 'Animé', 4: 'Prospère', 5: 'Florissant' };

const arrets = [];

/** Lit un document en refusant toute forme non canonique. */
function lire(fichier) {
  const brut = fs.readFileSync(fichier, 'utf8');
  const doc = JSON.parse(brut);
  if (brut !== JSON.stringify(doc, null, 2)) {
    console.error(`FORME NON CANONIQUE — ${path.relative(ROOT, fichier)} ; AUCUNE écriture.`);
    process.exit(1);
  }
  return { brut, doc };
}

const mer = lire(MER);
const terre = lire(TERRE);

/**
 * Convertit une table de SEUILS en table de FOURCHETTES : chaque bande court de son seuil au seuil
 * suivant moins un. `ouverte` = la dernière bande n'a pas de plafond (`max: null`).
 * @param {object[]} table rangées authorées
 * @param {string} seuilCle nom de la clé de seuil (`sum` / `richesse`)
 * @param {boolean} ouverte la dernière bande est-elle sans plafond ?
 * @param {string} nom nom du site, pour les arrêts
 */
function enFourchettes(table, seuilCle, ouverte, nom) {
  const seuils = table.map((r) => r[seuilCle]);
  if (seuils.some((s) => typeof s !== 'number')) {
    arrets.push(`${nom} : rangée sans \`${seuilCle}\` numérique — table hors du patron de seuils`);
    return 0;
  }
  const trie = [...seuils].sort((a, b) => a - b);
  if (trie.join() !== seuils.join()) {
    arrets.push(`${nom} : seuils non triés (${seuils.join(', ')}) — l'ordre authoré porte la table`);
    return 0;
  }
  for (const [i, rangee] of table.entries()) {
    const min = rangee[seuilCle];
    const dernier = i === table.length - 1;
    const max = dernier ? (ouverte ? null : min) : table[i + 1][seuilCle] - 1;
    // La fourchette prend la PLACE du seuil : l'ordre des clés du document est conservé.
    for (const [k, v] of Object.entries({ ...rangee })) {
      delete rangee[k];
      if (k === seuilCle) { rangee.min = min; rangee.max = max; }
      else rangee[k] = v;
    }
  }
  return table.length;
}

const bandesMer = mer.doc.vente?.prixDOffre ?? [];
const bandesTerre = terre.doc.vente?.offreParRichesse ?? [];
const migresMer = bandesMer.some((b) => 'sum' in b) ? enFourchettes(bandesMer, 'sum', true, 'sea-cargo.json › vente.prixDOffre') : 0;
const migresTerre = bandesTerre.some((b) => 'richesse' in b)
  ? enFourchettes(bandesTerre, 'richesse', false, 'land-cargo.json › vente.offreParRichesse')
  : 0;

/** RECALAGE DES LIBELLÉS (arbitrage en tête) : le mot suit l'INDICE de la bande, pas sa position.
 *  Idempotent — rejoué, le libellé est déjà le bon et rien n'est écrit. */
let libellesRecales = 0;
for (const b of bandesTerre) {
  const attendu = LIBELLE_PAR_INDICE[b.min];
  if (attendu === undefined) {
    arrets.push(`land-cargo.json › vente.offreParRichesse : bande d'indice ${b.min} hors de l'échelle imprimée (l.52-60 : 1 à 5)`);
    continue;
  }
  if (b.label !== attendu) { b.label = attendu; libellesRecales++; }
}

/** CONSTAT sur le RÉSULTAT — maritime. */
const vuMer = {};
for (const b of bandesMer) {
  if (typeof b.min !== 'number' || b.max === undefined || typeof b.pct !== 'number' || 'sum' in b) {
    arrets.push(`sea-cargo.json › vente.prixDOffre : bande ${JSON.stringify(b)} hors forme \`{min, max, pct}\``);
    continue;
  }
  vuMer[b.min] = [b.max, b.pct];
}
/** CONSTAT sur le RÉSULTAT — terrestre. */
const vuTerre = {};
for (const b of bandesTerre) {
  if (typeof b.min !== 'number' || typeof b.max !== 'number' || typeof b.label !== 'string' || typeof b.pct !== 'number' || 'richesse' in b) {
    arrets.push(`land-cargo.json › vente.offreParRichesse : bande ${JSON.stringify(b)} hors forme \`{min, max, label, pct}\``);
    continue;
  }
  vuTerre[b.min] = [b.max, b.label, b.pct];
}

/** Compare un constat au nommé, clé par clé. */
function confronter(vu, attendu, nom, cardinal, ref) {
  const vus = Object.keys(vu).sort();
  const nommes = Object.keys(attendu).sort();
  if (vus.join('\n') !== nommes.join('\n')) {
    arrets.push(`${nom} : bandes du document ≠ bandes nommées :\n    vues   : ${vus.join(', ') || '(aucune)'}\n    nommées: ${nommes.join(', ')}`);
    return;
  }
  for (const min of vus) {
    if (JSON.stringify(vu[min]) !== JSON.stringify(attendu[min])) {
      arrets.push(`${nom} : bande ${min} = ${JSON.stringify(vu[min])}, attendu ${JSON.stringify(attendu[min])}`);
    }
  }
  // Cardinal IMPOSÉ PAR LE LIVRE, et sa preuve est sa RÉFÉRENCE : la table à bandes est CLOSE, une
  // bande n'y entre pas par croissance de contenu (#1812).
  if (vus.length !== cardinal) arrets.push(`${nom} : cardinal ${vus.length}, attendu ${cardinal} — table CLOSE, ${ref}`);
}

confronter(vuMer, ATTENDU_MER, 'sea-cargo.json › vente.prixDOffre', 4, 'MDG 15 l.378-383');
confronter(vuTerre, ATTENDU_TERRE, 'land-cargo.json › vente.offreParRichesse', 5, 'MSRC 13 l.150-156');

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}

let ecrits = 0;
for (const [fichier, etat, migres] of [[MER, mer, migresMer], [TERRE, terre, migresTerre]]) {
  const rel = path.relative(ROOT, fichier).replace(/\\/g, '/');
  const out = JSON.stringify(etat.doc, null, 2);
  if (out === etat.brut) { console.log(`${rel} — INCHANGÉ (no-op byte-identique).`); continue; }
  if (out.includes('\r')) {
    console.error(`${fichier} : \\r dans le texte réécrit ; AUCUNE écriture.`);
    process.exit(1);
  }
  fs.writeFileSync(fichier, out, 'utf8');
  ecrits++;
  const mots = fichier === TERRE ? `, ${libellesRecales} libellé(s) recalé(s) sur l'indice` : '';
  console.log(`${rel} — réécrit (${migres} bande(s) passée(s) du seuil à la fourchette${mots}).`);
}
if (!ecrits) process.exit(0);
