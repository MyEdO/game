/**
 * Migration L-ref-1bis (#1463) — la DERNIÈRE dotation `{text}` du bestiaire qui NOMME une possession
 * du catalogue cesse d'être du texte : `{text:"cache-œil"}` devient `{id:'cache-oeil'}`. AUCUN
 * changement de schéma : `trappingRefSchema` (`src/data/schemas/grammaire/reference.ts`) accepte
 * déjà `{id, spec?, count?, qualities?}` — la MÊME liste porte déjà `{id:'crochet'}`.
 *
 * MOTIF AU SOURCE — le statbloc imprime la possession en toutes lettres, au singulier, à la graphie
 * exacte du catalogue :
 *   `Source/WH - V4 - La Mer de Griffe/16 - Bestiaire.md` l.407 : « **Possessions :** bandoulière
 *   avec 12 pistolets chargés, cache-œil, crochet, épée, jambe de bois, perroquet (Pièce), poudre et
 *   munitions pour 24 tirs, rhum tord-boyaux » — statbloc de Long Drong Silver (MDG folio 152,
 *   `src/data/creatures.json › long-drong-silver`). Le catalogue porte l'entrée
 *   `trappings.json › cache-oeil` (`"label": "Cache-œil"`, l.7084-7086).
 *
 * ENTRÉES : `src/data/creatures.json` — les seuls objets de la clé `trappings` (y compris sous un
 * `choice`) dont la clé `text` figure dans la TABLE CLOSE ci-dessous ; `src/data/trappings.json` et
 * `src/data/_ids.generated.ts` sont LUS (jamais écrits) pour valider l'id produit et
 * l'exhaustivité. Cardinal ASSERTÉ 1 — MESURÉ aux trois portes du contrat (libellé entier, SINGULIER
 * mot à mot, tête de parenthèse) sur les 43 `{text}` de dotation du fichier : un seul candidat.
 * EXHAUSTIVITÉ : après écriture, tout `{text}` de dotation restant dont le libellé — entier, tête de
 * parenthèse, ou SINGULIER mot à mot — est le `label` d'une entrée de `trappings.json` hors des
 * EXCLUSIONS est une anomalie → sortie 1.
 * IDEMPOTENT : rejouée sur l'état final, elle ne trouve plus aucun porteur et sort 0.
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 2)` exact (LF), constaté AVANT toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FICHIERS = ['src/data/creatures.json'];

/** TABLE CLOSE `texte EXACT → forme cible`, avec le cardinal attendu. */
const LIAISONS = [['cache-œil', { id: 'cache-oeil' }, 1]];
const CARDINAL = 1;

/**
 * Les `{text}` de dotation du bestiaire que les trois portes NOMMENT sans qu'ils soient des
 * références. VIDE : la mesure n'en relève aucun — les 42 autres textes du fichier sont de la prose
 * de statbloc (« bandoulière avec 12 pistolets chargés », « rhum tord-boyaux »), et aucun n'a de
 * tête de parenthèse au catalogue (« perroquet (Pièce) » : `perroquet` n'est pas une possession).
 */
const EXCLUSIONS = [];

/** Ids de `trappings.json` tels que `idDe('trapping')` les refine — le registre généré lui-même
 *  (`src/data/schemas/grammaire/ref.ts` › `idsDe`, `cibleDe('trapping') === 'trappings.json'`). */
const registre = fs.readFileSync(path.join(ROOT, 'src/data/_ids.generated.ts'), 'utf8');
const ligneRegistre = /'trappings\.json':\s*\[([^\]]*)\]/.exec(registre);
if (!ligneRegistre) {
  console.error("REGISTRE ILLISIBLE — `IDS_PAR_DATASET['trappings.json']` introuvable ; AUCUNE écriture.");
  process.exit(1);
}
const IDS_TRAPPING = new Set([...ligneRegistre[1].matchAll(/'([^']*)'/g)].map((m) => m[1]));
assert.ok(IDS_TRAPPING.size > 400, `registre des ids de trapping suspect (${IDS_TRAPPING.size} ids)`);

/** Index `libellé normalisé → ids` de `trappings.json` SEUL — le catalogue DU SITE. */
const normaliser = (s) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** SINGULIER mot à mot d'un libellé normalisé : « haches de lancer » et « hache de lancer » ont la
 *  même forme. Sans elle, un pluriel du livre n'est vu par AUCUNE des deux autres portes. */
const singulier = (s) =>
  normaliser(s)
    .split(' ')
    .map((mot) => mot.replace(/aux$/, 'al').replace(/[sx]$/, ''))
    .join(' ');
const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/trappings.json'), 'utf8'));
const PAR_LABEL = new Map();
const PAR_SINGULIER = new Map();
for (const t of catalogue) {
  if (typeof t?.label !== 'string') continue;
  const k = normaliser(t.label);
  if (!PAR_LABEL.has(k)) PAR_LABEL.set(k, []);
  PAR_LABEL.get(k).push(t.id);
  const s = singulier(t.label);
  if (!PAR_SINGULIER.has(s)) PAR_SINGULIER.set(s, []);
  PAR_SINGULIER.get(s).push(t.id);
}

/** Tout id produit par la table existe au registre. */
const idsProduits = LIAISONS.flatMap(([, vers]) => (vers.choice ? vers.choice.map((b) => b.id) : [vers.id]));
const inconnus = idsProduits.filter((id) => !IDS_TRAPPING.has(id));
if (inconnus.length) {
  console.error(`ID(S) ABSENT(S) de trappings.json — AUCUNE écriture : ${[...new Set(inconnus)].join(', ')}`);
  process.exit(1);
}

/** Tête de parenthèse d'un texte (« Atelier (Magie) » → « Atelier »), sinon undefined. */
const teteDeParenthese = (texte) => {
  const m = /^(.*?)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*$/.exec(texte);
  return m ? m[1] : undefined;
};

/** Un `{text}` de dotation NOMME-t-il une possession du catalogue ? (contrôle d'exhaustivité) */
const nommeUnePossession = (texte) => {
  if (EXCLUSIONS.includes(texte)) return false;
  if (PAR_LABEL.has(normaliser(texte))) return true;
  if (PAR_SINGULIER.has(singulier(texte))) return true;
  const tete = teteDeParenthese(texte);
  return tete != null && (PAR_LABEL.has(normaliser(tete)) || PAR_SINGULIER.has(singulier(tete)));
};

/** Une dotation et ses branches `choice` (récursives au schéma), jamais un `choice` d'un autre concept. */
function* branches(liste) {
  yield liste;
  for (const e of liste) if (e && typeof e === 'object' && Array.isArray(e.choice)) yield* branches(e.choice);
}

/** Parcourt les dotations d'un document : rend chaque tableau `trappings`, branches comprises. */
function* dotations(noeud) {
  if (Array.isArray(noeud)) {
    for (const e of noeud) yield* dotations(e);
    return;
  }
  if (noeud == null || typeof noeud !== 'object') return;
  for (const [k, v] of Object.entries(noeud)) {
    if (k === 'trappings' && Array.isArray(v)) {
      yield* branches(v);
      continue;
    }
    yield* dotations(v);
  }
}

const documents = [];
for (const fichier of FICHIERS) {
  const abs = path.join(ROOT, fichier);
  const brut = fs.readFileSync(abs, 'utf8');
  const data = JSON.parse(brut);
  if (JSON.stringify(data, null, 2) !== brut) {
    console.error(`FORME NON CANONIQUE — ${fichier} n'est pas un JSON indenté à 2 ; AUCUNE écriture.`);
    process.exit(1);
  }
  documents.push({ fichier, abs, brut, data });
}

/** SITES relevés AVANT toute écriture : `{ fichier, liste, index, texte, vers }`. */
const sites = [];
for (const { fichier, data } of documents)
  for (const liste of dotations(data))
    for (const [index, e] of liste.entries()) {
      if (!e || typeof e !== 'object' || typeof e.text !== 'string') continue;
      const liaison = LIAISONS.find(([texte]) => texte === e.text);
      if (liaison) sites.push({ fichier, liste, index, texte: e.text, vers: liaison[1] });
    }

if (sites.length === 0) {
  console.log('RIEN À FAIRE — aucune dotation `{text}` du bestiaire ne nomme une possession du catalogue.');
  process.exit(0);
}

for (const [texte, , attendu] of LIAISONS) {
  const vus = sites.filter((s) => s.texte === texte).length;
  assert.equal(vus, attendu, `« ${texte} » : ${vus} porteurs vus, ${attendu} attendus`);
}
assert.equal(sites.length, CARDINAL, `cardinal attendu ${CARDINAL} porteur, vu ${sites.length}`);

for (const { liste, index, vers } of sites) {
  const avant = liste[index];
  liste[index] = vers.choice
    ? { choice: vers.choice.map((b) => ({ ...b })) }
    : {
        ...vers,
        ...(avant.count === undefined ? {} : { count: avant.count }),
        ...(avant.qualities === undefined ? {} : { qualities: avant.qualities }),
      };
}

// SEULES les valeurs relevées ont changé : le document d'entrée, aux SEULS sites relevés remplacés,
// est deep-equal au document écrit.
for (const { fichier, brut, data } of documents) {
  const temoin = JSON.parse(brut);
  for (const liste of dotations(temoin))
    for (const [index, e] of liste.entries()) {
      if (!e || typeof e !== 'object' || typeof e.text !== 'string') continue;
      const liaison = LIAISONS.find(([texte]) => texte === e.text);
      if (!liaison) continue;
      const vers = liaison[1];
      liste[index] = vers.choice
        ? { choice: vers.choice.map((b) => ({ ...b })) }
        : {
            ...vers,
            ...(e.count === undefined ? {} : { count: e.count }),
            ...(e.qualities === undefined ? {} : { qualities: e.qualities }),
          };
    }
  assert.deepEqual(data, temoin, `${fichier} : la migration a changé autre chose que les dotations relevées`);
}

/** EXHAUSTIVITÉ sur l'état FINAL : plus aucun `{text}` de dotation ne nomme une possession. */
const restants = [];
for (const { fichier, data } of documents)
  for (const liste of dotations(data))
    for (const e of liste)
      if (e && typeof e === 'object' && typeof e.text === 'string' && nommeUnePossession(e.text))
        restants.push(`${fichier} : « ${e.text} » nomme une possession du catalogue`);
if (restants.length) {
  console.error(`ANOMALIES (${restants.length}) — AUCUNE écriture :`);
  for (const a of restants) console.error(`  - ${a}`);
  process.exit(1);
}

for (const { abs, data } of documents) fs.writeFileSync(abs, JSON.stringify(data, null, 2));
console.log(`${CARDINAL} dotation liée au catalogue :`);
for (const [texte, vers, n] of LIAISONS) console.log(`  ${n} × « ${texte} » → ${JSON.stringify(vers)}`);
