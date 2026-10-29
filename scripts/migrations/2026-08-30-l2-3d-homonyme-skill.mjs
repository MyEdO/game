/**
 * Migration L2 #1548 (commit 3d) — l'HOMONYME `skill` s'ÉTEINT : dans les deux racines de donnée,
 * la clé `skill` ne désigne plus JAMAIS autre chose qu'une référence de Compétence emboîtée.
 *
 * QUATRE gestes, chacun sur son chemin de schéma :
 *  1. `advancementCosts.json` — les DEUX colonnes du Tableau de Coût des Augmentations sont des COÛTS
 *     EN PX, pas des références : `char` → `coutCarac`, `skill` → `coutCompetence` (DESIGN v2 §S2).
 *  2. `arene-projet.json` — l'effet `medicalAid` portait `skill: 55`, la VALEUR de Test de Guérison du
 *     PNJ soigneur : elle rejoint la référence, à la forme de statbloc `{ id, spec?, value }` déjà
 *     écrite par `creatures.json` (`defs/creatures.ts:40`) et par la racine scènes
 *     (`defs-scenes/communs.ts:21`) → `skill: { id: 'guerison', value: 55 }`.
 *  3. `tavernGames.json` — `skill: null` (« le jeu ne teste aucune Compétence ») devient l'ABSENCE du
 *     champ : l'idiome « absence dit non » posé par `castPenalty` au commit 3c.
 *  4. `talents.json` — `reverseFailed.skill` portait SOIT une réf SOIT une liste : le champ devient
 *     `skills`, TOUJOURS une liste de réfs (un terme = un concept).
 *
 * TRANSFORMATION PAR CHEMIN DE SCHÉMA (jamais un remplacement de texte) : chaque chemin est énuméré
 * ci-dessous et visité par un marcheur ; un porteur rencontré HORS de ces chemins est une anomalie
 * → rien n'est écrit, sortie 1.
 * RENAME PUR : aucune valeur ne change. Le seul apport d'information est l'id `guerison` du geste 2 :
 * la MÉCANIQUE du soigneur PNJ reste sa VALEUR (`noyau/medicFlow.ts` ne lit que `npc.skill.value` —
 * un PNJ payant n'a pas de fiche, sa cible EST le seuil fourni) ; l'id porte le LIBELLÉ affiché au
 * joueur (`ui/MedicModal.tsx` → `skillRefLabel(npc.skill)`, jusqu'ici la chaîne « Guérison » en dur).
 * PREUVE : les deux artefacts (avant, après) ramenés à la graphie D'ORIGINE sont deep-equal.
 * ENTRÉES : les quatre documents énumérés par `GESTES` ci-dessous — `src/data/advancementCosts.json`,
 * `src/scenes/arene/arene-projet.json`, `src/data/tavernGames.json`, `src/data/talents.json`.
 * IDEMPOTENT : rejouée sur l'état final, elle n'écrit rien et sort 0.
 * FORMATAGE PRÉSERVÉ : chaque fichier est EXACTEMENT une des formes déclarées, constatée AVANT toute
 * écriture et réécrite dans SA forme (LF, aucun `\r`).
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { jsonCanonique } from '../../src/lib/jsonCanonique.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Compétence du PNJ soigneur de l'effet `medicalAid`, codée en dur aux deux sites qui la lisent. */
const SOIN = 'guerison';

/** Un geste = un chemin PORTEUR (suite de clés depuis la racine, `[]` traverse un tableau), le test
 *  qui reconnaît un nœud ENCORE à migrer, la transformation, et son INVERSE (preuve de graphie).
 *  Un geste porte `chemin` (un seul) ou `chemins` (plusieurs sites du MÊME concept). */
const GESTES = [
  {
    nom: 'advancementCosts — coûts en PX',
    fichier: 'src/data/advancementCosts.json',
    chemin: ['[]'],
    porteur: (n) => estObjet(n) && (Object.hasOwn(n, 'char') || Object.hasOwn(n, 'skill')),
    vers: (n) => renommer(n, { char: 'coutCarac', skill: 'coutCompetence' }),
    inverse: (n) => renommer(n, { coutCarac: 'char', coutCompetence: 'skill' }),
    inversePorteur: (n) => estObjet(n) && (Object.hasOwn(n, 'coutCarac') || Object.hasOwn(n, 'coutCompetence')),
  },
  {
    nom: 'medicalAid — la valeur de Test rejoint la référence',
    fichier: 'src/scenes/arene/arene-projet.json',
    chemin: ['scenes', '[]', 'dialogues', '[]', 'nodes', '[]', 'choices', '[]', 'flow', 'steps', '[]', 'effect'],
    porteur: (n) => estObjet(n) && n.type === 'medicalAid' && typeof n.skill === 'number',
    vers: (n) => remplacer(n, 'skill', { id: SOIN, value: n.skill }),
    inverse: (n) => remplacer(n, 'skill', n.skill.value),
    inversePorteur: (n) => estObjet(n) && n.type === 'medicalAid' && estObjet(n.skill),
  },
  {
    nom: 'tavernGames — aucune Compétence testée = ABSENCE',
    fichier: 'src/data/tavernGames.json',
    chemin: ['[]'],
    porteur: (n) => estObjet(n) && Object.hasOwn(n, 'skill') && n.skill === null,
    vers: (n) => retirer(n, 'skill'),
    // L'inverse ne peut pas deviner OÙ le champ absent se trouvait : la preuve du geste 3 se fait
    // dans l'autre sens (on RÉ-INSÈRE le `null` sur l'artefact d'après et on compare aux clés d'avant).
    inverse: (n) => n,
    inversePorteur: () => false,
    reinsere: { cle: 'skill', valeur: null, ou: (n) => estObjet(n) && typeof n.id === 'string' && typeof n.desc === 'string' && !Object.hasOwn(n, 'skill') },
  },
  {
    nom: 'talents — reverseFailed porte une LISTE de Compétences',
    fichier: 'src/data/talents.json',
    chemins: [['[]', 'combat', 'reverseFailed'], ['[]', 'variants', '[]', 'combat', 'reverseFailed']],
    porteur: (n) => estObjet(n) && Object.hasOwn(n, 'skill'),
    concept: (n) => (estObjet(n) && estObjet(n.reverseFailed) ? n.reverseFailed : null),
    vers: (n) => remplacerCle(n, 'skill', 'skills', (v) => (Array.isArray(v) ? v : [v])),
    inverse: (n) => remplacerCle(n, 'skills', 'skill', (v) => (v.length === 1 ? v[0] : v)),
    inversePorteur: (n) => estObjet(n) && Array.isArray(n.skills) && Object.keys(n).every((k) => k === 'skills' || k === 'capDR'),
  },
];

const estObjet = (n) => n != null && typeof n === 'object' && !Array.isArray(n);

const cheminsDe = (g) => g.chemins ?? [g.chemin];

/** Renomme des clés EN PLACE (l'ordre d'écriture du document est conservé). */
function renommer(o, table) {
  const sortie = {};
  for (const [k, v] of Object.entries(o)) sortie[table[k] ?? k] = v;
  return sortie;
}

/** Remplace la VALEUR d'une clé, à sa place. */
function remplacer(o, cle, valeur) {
  const sortie = {};
  for (const [k, v] of Object.entries(o)) sortie[k] = k === cle ? valeur : v;
  return sortie;
}

/** Renomme UNE clé et transforme sa valeur, à sa place. */
function remplacerCle(o, avant, apres, f) {
  const sortie = {};
  for (const [k, v] of Object.entries(o)) {
    if (k === avant) sortie[apres] = f(v);
    else sortie[k] = v;
  }
  return sortie;
}

function retirer(o, cle) {
  const sortie = {};
  for (const [k, v] of Object.entries(o)) if (k !== cle) sortie[k] = v;
  return sortie;
}

/** FORMES d'écriture ADMISES, constatées fichier par fichier et réécrites à l'identique. */
const FORMES = [
  { nom: 'indent 2', rendu: (d) => JSON.stringify(d, null, 2) },
  { nom: 'indent 1 + saut final', rendu: (d) => `${JSON.stringify(d, null, 1)}\n` },
];

const FICHIERS = [...new Set(GESTES.map((g) => g.fichier))].sort();

/** Visite les nœuds au bout de `chemin` et rend le COUPLE (conteneur, clé) du nœud terminal. */
function* parents(noeud, chemin, conteneur = null, cle = null) {
  if (chemin.length === 0) {
    if (conteneur != null) yield { conteneur, cle };
    return;
  }
  if (noeud == null || typeof noeud !== 'object') return;
  const [tete, ...reste] = chemin;
  if (tete === '[]') {
    if (!Array.isArray(noeud)) return;
    for (let i = 0; i < noeud.length; i++) yield* parents(noeud[i], reste, noeud, i);
  } else {
    if (Array.isArray(noeud)) return;
    yield* parents(noeud[tete], reste, noeud, tete);
  }
}

/** Tous les nœuds du document (contrôle d'exhaustivité). */
function* partout(noeud) {
  if (Array.isArray(noeud)) { for (const e of noeud) yield* partout(e); return; }
  if (noeud == null || typeof noeud !== 'object') return;
  yield noeud;
  for (const v of Object.values(noeud)) yield* partout(v);
}

const documents = new Map();
for (const f of FICHIERS) {
  const abs = path.join(ROOT, f);
  const brut = fs.readFileSync(abs, 'utf8');
  const data = JSON.parse(brut);
  const forme = FORMES.find((fm) => fm.rendu(data) === brut);
  if (!forme) {
    console.error(`FORME NON CANONIQUE — ${f} n’est aucune des formes déclarées (${FORMES.map((fm) => fm.nom).join(', ')}) ; AUCUNE écriture.`);
    process.exit(1);
  }
  documents.set(f, { abs, brut, data, forme });
}

// EXHAUSTIVITÉ : tout nœud du document qui PORTE LE CONCEPT du geste doit être atteint par son chemin
// déclaré. `concept` (quand il diffère de `porteur`) nomme le concept par sa CLÉ DE CONTENEUR : la forme
// `{ skill }` seule est celle de bien d'autres slots de `talents.json`, seule la clé `reverseFailed`
// désigne sans ambiguïté le nœud visé.
const anomalies = [];
for (const g of GESTES) {
  const { data } = documents.get(g.fichier);
  const concept = g.concept ?? ((n) => (g.porteur(n) ? n : null));
  const cibles = new Set();
  for (const ch of cheminsDe(g)) for (const { conteneur, cle } of parents(data, ch)) if (g.porteur(conteneur[cle])) cibles.add(conteneur[cle]);
  for (const n of partout(data)) {
    const c = concept(n);
    if (c != null && g.porteur(c) && !cibles.has(c)) anomalies.push(`${g.fichier} [${g.nom}] : porteur HORS chemin déclaré — ${JSON.stringify(c).slice(0, 160)}`);
  }
}
if (anomalies.length) {
  console.error(`ARBITRAGE REQUIS — ${anomalies.length} anomalie(s), AUCUNE écriture :`);
  for (const a of new Set(anomalies)) console.error(`  ${a}`);
  process.exit(1);
}

const comptes = new Map();
for (const g of GESTES) {
  const { data } = documents.get(g.fichier);
  for (const ch of cheminsDe(g)) for (const { conteneur, cle } of parents(data, ch)) {
    if (!g.porteur(conteneur[cle])) continue;
    conteneur[cle] = g.vers(conteneur[cle]);
    comptes.set(g.nom, (comptes.get(g.nom) ?? 0) + 1);
  }
}

/** Ramène un document MIGRÉ à sa graphie d'origine — les inverses des SEULS gestes de CE fichier
 *  (un inverse appliqué au document d'un autre fichier mordrait sur ses homonymes). */
function versAvant(noeud, gestes) {
  if (Array.isArray(noeud)) return noeud.map((e) => versAvant(e, gestes));
  if (!estObjet(noeud)) return noeud;
  let n = noeud;
  for (const g of gestes) {
    if (g.inversePorteur(n)) n = g.inverse(n);
    else if (g.reinsere && g.reinsere.ou(n)) n = { ...n, [g.reinsere.cle]: g.reinsere.valeur };
  }
  const sortie = {};
  for (const [k, v] of Object.entries(n)) sortie[k] = versAvant(v, gestes);
  return sortie;
}

let ecrits = 0;
for (const [f, { abs, brut, data, forme }] of documents) {
  const out = forme.rendu(data);
  try {
    const gestes = GESTES.filter((g) => g.fichier === f);
    assert.equal(jsonCanonique(versAvant(JSON.parse(out), gestes)), jsonCanonique(versAvant(JSON.parse(brut), gestes)));
    assert.equal(out.includes('\r'), false, `${f} : le texte réécrit contient un \`\\r\``);
  } catch (e) {
    console.error(`VÉRIFICATION PRÉ-ÉCRITURE ROUGE : ${e.message}`);
    process.exit(1);
  }
  if (out !== brut) { fs.writeFileSync(abs, out, 'utf8'); ecrits++; }
  console.log(`${f} — ${out !== brut ? 'réécrit' : 'INCHANGÉ (no-op byte-identique)'}.`);
}

let total = 0;
for (const g of GESTES) {
  const n = comptes.get(g.nom) ?? 0;
  total += n;
  console.log(`  ${g.nom} : ${n} site(s).`);
}
console.log(`TOTAL : ${total} site(s) migré(s) sur ${FICHIERS.length} documents ; ${ecrits} fichier(s) réécrit(s).`);
console.log('PREUVE deep-equal : les deux artefacts ramenés à la graphie D’ORIGINE sont IDENTIQUES — OK ; `\\r` : 0.');
