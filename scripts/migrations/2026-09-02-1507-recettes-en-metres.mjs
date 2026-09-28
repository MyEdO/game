/**
 * Migration #1507 — UNITÉ des recettes de décor et des rayons de lumière : tout passe en MÈTRES.
 *
 * Une recette volumique (`PropData.volume`, `src/data/props.types.ts`) mêlait deux unités : `x`/`y`
 * en CASES, `h`/`heightM` en MÈTRES. Le monde multipliant `x`/`y` par le `metresPerTile` de la scène
 * à la cuisson (`gpToWorld`), un tonneau de 0,75 m de large mesurait 3,74 m sur une scène MER
 * (`metresPerTile: 10`). La recette devient donc MÉTRIQUE sur ses trois axes, et ce sont ses LECTEURS
 * qui divisent par l'échelle de la scène (`builders/propVolumes.ts`, `state/seating.ts`).
 *
 * FACTEUR DE MIGRATION : ×2, global. Les 22 recettes ont été authorées pour la seule échelle qui
 * existait alors, celle du défaut du monde — 2 m/case (`LDB 15 l.12` : « chaque case représentant une
 * distance de 2 mètres dans le jeu »). Aucune scène ne change de `metresPerTile` : à 2 m/case, la
 * géométrie MONDE produite après migration est celle d'avant, à l'octet — 2 est une puissance de 2,
 * donc `(v × 2) / 2 === v` EXACTEMENT sur les 650 valeurs du plan que porte le catalogue (638 de
 * primitives + 12 d'ancres de place ; mesuré — un facteur 10 y ferait 34 valeurs inexactes).
 *
 * CE QUI EST MULTIPLIÉ, et rien d'autre : les coordonnées et les dimensions DU PLAN — `center.x/y`,
 * `size.x/y`, `radius` d'un cylindre, `seatSlots[].anchor.x/y`. Les HAUTEURS (`center.h`, `size.h`,
 * `heightM`) étaient déjà métriques : elles sont seulement RENOMMÉES. `seatSlots[].approach` reste
 * intact : c'est un offset de CASE voisine, un pas de grille et non une longueur.
 *
 * RENOMMAGES : `x → xM`, `y → yM`, `h → hM` (dans `center`, `size` et `anchor`), `radius → radiusM`.
 * L'ordre des clés est PRÉSERVÉ (chaque objet est reconstruit clé par clé) — le diff reste lisible.
 *
 * SECOND VOLET, MÊME DÉFAUT — le rayon d'une source de lumière. `light.radiusTiles` portait une
 * valeur RAW en mètres PRÉ-DIVISÉE par 2 (Bougie « fournit un éclairage sur 10 mètres », `LDB 74
 * l.43`, écrite `5` ; Lanterne 20 m, `LDB 74 l.58`, écrite `10`), donc fausse dès qu'une scène change
 * d'échelle — 50 m en mer pour une bougie. Le champ devient `light.radiusM` et porte la valeur RAW
 * TELLE QUELLE ; `rayonEnCases` (`src/state/vision.ts`) le ramène aux cases à la fabrication de la
 * `LightSource`, qui reste le champ MÉCANIQUE en cases. Même règle pour l'op `light`
 * (`GameOp`, `src/engine/ops.ts`), qui est l'autre écriture de ce même rayon en donnée :
 * `radiusTiles → radiusM`, ×2, dans `trappings.json`, `spells.json` et `tables.json`.
 * Les `source`/`maison` des entrées ne bougent pas : elles nomment un étalon EN MÈTRES, elles
 * restent donc vraies (les `maison` posés par `2026-09-02-1680-props-provenance.mjs` compris).
 *
 * MARQUEUR D'IDEMPOTENCE, un par forme touchée, tous lisibles sur la FORME rendue : la GRAPHIE des
 * clés — `xM` dans un `center`/`size`/`anchor`, `radiusM` sur un cylindre, `radiusM` sur un `light`
 * ou sur une op `light`. Un mélange des deux graphies dans un même fichier est un ARBITRAGE REQUIS :
 * aucune valeur n'est multipliée deux fois, ni laissée en arrière.
 *
 * ENTRÉES : `src/data/props.json`, `src/data/trappings.json`, `src/data/spells.json`,
 * `src/data/tables.json` (les seules données lues et écrites).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : un fichier déjà entièrement migré est reconnu ; rejoué sur
 * l'état final, le script n'écrit rien et sort 0.
 * FAIL-FAST : cardinal inattendu (recettes, primitives, valeurs du plan, ancres, sources, ops),
 * racine non-tableau, forme non canonique, mélange de graphies, clé de point inconnue → rien n'est
 * écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : chaque fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT
 * toute écriture.
 */
import { tableTotale } from '../../src/lib/tableTotale.ts';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const chemin = (f) => path.join(ROOT, 'src/data', f);

/** Le `metresPerTile` sous lequel les 22 recettes ont été authorées — le défaut du monde, `LDB 15 l.12`. */
const FACTEUR = 2;

/**
 * Datasets portant des ops `light` à convertir. Leur NOMBRE d'ops n'est pas asserté (#1812), pas plus
 * que le nombre de recettes ou de sources : ces catalogues grandissent, et un décor neuf doit se
 * MIGRER. Ce qui délimite le périmètre est la FORME — et le MÉLANGE de graphies (par forme touchée,
 * tout ou rien) reste la porte qui mord.
 */
const DATASETS_OPS = ['trappings.json', 'spells.json', 'tables.json'];

/**
 * PROVENANCES en MÈTRES — les 10 phrases de `maison` que le lot #1680 a écrites disaient leur étalon
 * en CASES (« 10 m = 5 cases », « 4 cases contre 5 »). L'unité de la donnée n'est plus la case : elles
 * sont réécrites à l'identique, l'étalon en mètres. Le texte cible est CELUI QUE LE SCRIPT DE #1680
 * ÉCRIT (`RAISONS`) — les deux migrations convergent, dans n'importe quel ordre de rejeu.
 * @type {Record<string, string>}
 */
const PROVENANCES = {
  "feu-camp": "rayon maison : aucun folio ne chiffre un feu de camp — calé sur l’étalon de la bougie (LDB 74 l.43, 10 m), le plus petit que le canon chiffre, un foyer ouvert n’éclairant pas moins qu’une chandelle",
  "brasero": "rayon maison : aucun folio ne chiffre un brasero — un cran SOUS le feu de camp (8 m contre 10), la cuve n’ouvrant sa flamme que vers le haut",
  "chandelier": "rayon maison : le chandelier PORTE des bougies — calé sur l’étalon de la bougie (LDB 74 l.43, 10 m) ; un chandelier n’est pas une bougie, d’où l’arbitrage plutôt que le folio",
  "lampadaire": "rayon maison : le lampadaire PORTE une lanterne — calé sur l’étalon de la lanterne (LDB 74 l.58, 20 m) ; un lampadaire n’est pas une lanterne de poing, d’où l’arbitrage plutôt que le folio",
  "marmite": "rayon maison : braises SOUS la marmite (def d’art), sans flamme dégagée — même cran que le brasero (8 m), le chaudron masquant une part du foyer",
  "foyer-de-forge": "rayon maison : cuve de charbons ardents (def d’art) — même étalon que le feu de camp (bougie, LDB 74 l.43, 10 m), c’est un lit de braises à ciel ouvert",
  "cheminee-interieure": "rayon maison : aucun folio ne chiffre un âtre — même étalon que le feu de camp (bougie, LDB 74 l.43, 10 m), c’est le même foyer ouvert. Couvert maison : un manteau d’âtre maçonné s’apparente au mur de pierre de l’étalon de couvert TOTAL (LDB 14 l.86), et il coupe la vue",
  "applique-murale": "rayon maison : l’applique PORTE trois bougies (def d’art : bras à bougies et flammes) — calé sur l’étalon de la bougie (LDB 74 l.43, 10 m), le canon ne chiffrant pas le nombre de mèches",
  "lanterne-de-poupe": "rayon maison : c’est une lanterne, vitrée et à cage de fer (def d’art) — calé sur l’étalon de la lanterne (LDB 74 l.58, 20 m) ; montée en poupe et non portée, d’où l’arbitrage plutôt que le folio",
  "lustre-opera": "rayon maison : le lustre PORTE des bougies (def d’art : bras porte-bougies à flammes) — calé sur l’étalon de la bougie (LDB 74 l.43, 10 m), le canon ne chiffrant pas le nombre de mèches",
};

const echecs = [];
const ecarts = [];
const rapport = [];

/** Lit un document, en exigeant la forme canonique et une racine tableau. */
function lire(f) {
  const brut = fs.readFileSync(chemin(f), 'utf8');
  const doc = JSON.parse(brut);
  if (!Array.isArray(doc)) ecarts.push(`${f} : racine non-TABLEAU`);
  else if (JSON.stringify(doc, null, 2) !== brut)
    ecarts.push(`${f} : FORME NON CANONIQUE (pas \`JSON.stringify(doc, null, 2)\`)`);
  return { brut, doc };
}

/** Toutes les ops `light` d'un document, à n'importe quelle profondeur. */
function opsLight(noeud, out = []) {
  if (Array.isArray(noeud)) for (const v of noeud) opsLight(v, out);
  else if (noeud && typeof noeud === 'object') {
    if (noeud.op === 'light') out.push(noeud);
    for (const k of Object.keys(noeud)) opsLight(noeud[k], out);
  }
  return out;
}

/**
 * Point du plan converti : `{x,y,h}` (cases + mètres) → `{xM,yM,hM}` (mètres), l'ordre des clés
 * préservé et les clés étrangères refusées — un point de recette n'en porte pas.
 */
function pointEnMetres(p, quoi) {
  const sortie = {};
  for (const [k, v] of Object.entries(p)) {
    if (k === 'x') sortie.xM = v * FACTEUR;
    else if (k === 'y') sortie.yM = v * FACTEUR;
    else if (k === 'h') sortie.hM = v;
    else ecarts.push(`${quoi} : clé inconnue « ${k} » dans un point de recette`);
  }
  return sortie;
}

const dejaPoint = (p) => p && typeof p === 'object' && 'xM' in p;

// ————————————————————————————————— PORTE DE LECTURE —————————————————————————————————
const props = lire('props.json');
const datasetsOps = tableTotale(DATASETS_OPS, (f) => lire(f));

{
  const recettes = props.doc.filter((e) => e && e.volume);
  const primitives = recettes.flatMap((e) => e.volume.primitives ?? []);
  const places = props.doc.flatMap((e) => e?.seatSlots ?? []);
  const sources = props.doc.filter((e) => e && e.light);
  if (!recettes.length) ecarts.push('aucune recette de volume — périmètre déplacé');
  if (!primitives.length) ecarts.push('aucune primitive de recette — périmètre déplacé');

  // MÉLANGE DE GRAPHIES — par forme touchée, jamais globalement : chaque marqueur répond de sa forme.
  const marques = (liste, estMarque) => liste.filter(estMarque).length;
  const partages = [
    ['primitives (center)', primitives.length, marques(primitives, (p) => dejaPoint(p.center))],
    ['primitives (dimensions)', primitives.length, marques(primitives, (p) => (p.kind === 'cylinder' ? 'radiusM' in p : dejaPoint(p.size)))],
    ['places (anchor)', places.length, marques(places, (s) => dejaPoint(s.anchor))],
    ['sources (light)', sources.length, marques(sources, (e) => 'radiusM' in e.light)],
  ];
  for (const [quoi, total, faits] of partages)
    if (faits !== 0 && faits !== total) ecarts.push(`MÉLANGE de graphies — ${quoi} : ${faits} migrée(s) sur ${total}`);

  for (const [id, phrase] of Object.entries(PROVENANCES)) {
    const e = props.doc.find((x) => x && x.id === id);
    if (!e) ecarts.push(`${id} : entrée introuvable (provenance)`);
    else if (typeof e.maison !== 'string' || !e.maison) ecarts.push(`${id} : \`maison\` absente — ce script n'en invente aucune`);
    else if (e.maison !== phrase && !/cases\)|cases contre/.test(e.maison))
      ecarts.push(`${id} : phrase de provenance INCONNUE — ni l'ancienne (en cases) ni la nouvelle (en mètres)`);
  }
  for (const f of DATASETS_OPS) {
    const ops = opsLight(datasetsOps[f].doc);
    const faits = ops.filter((o) => 'radiusM' in o).length;
    if (faits !== 0 && faits !== ops.length) ecarts.push(`${f} : MÉLANGE de graphies — ${faits} op(s) \`light\` migrée(s) sur ${ops.length}`);
    for (const o of ops)
      if (!('radiusM' in o) && typeof o.radiusTiles !== 'number') ecarts.push(`${f} : op \`light\` sans rayon numérique`);
  }
}

if (ecarts.length) {
  console.error(`ARBITRAGE REQUIS — rien n’est écrit (${ecarts.length}) :`);
  for (const m of ecarts) console.error(`  ${m}`);
  process.exit(1);
}

// ————————————————————————————————— CONVERSION —————————————————————————————————
let primitivesConverties = 0;
let ancresConverties = 0;
let sourcesConverties = 0;
let provenancesReecrites = 0;

/** Une primitive, ses cotes du plan multipliées et ses clés renommées ; l'ordre des clés est gardé. */
function primitiveEnMetres(p, id) {
  if (dejaPoint(p.center)) return p;
  primitivesConverties++;
  const sortie = {};
  for (const [k, v] of Object.entries(p)) {
    if (k === 'center') sortie.center = pointEnMetres(v, `${id}/center`);
    else if (k === 'size') sortie.size = pointEnMetres(v, `${id}/size`);
    else if (k === 'radius') sortie.radiusM = v * FACTEUR;
    else sortie[k] = v;
  }
  return sortie;
}

const apresProps = props.doc.map((e) => {
  if (!e || typeof e !== 'object') return e;
  const sortie = {};
  for (const [k, v] of Object.entries(e)) {
    if (k === 'volume') {
      sortie.volume = { ...v, primitives: (v.primitives ?? []).map((p) => primitiveEnMetres(p, e.id)) };
    } else if (k === 'seatSlots') {
      sortie.seatSlots = v.map((s) => {
        if (dejaPoint(s.anchor)) return s;
        ancresConverties++;
        const place = {};
        for (const [sk, sv] of Object.entries(s)) place[sk] = sk === 'anchor' ? pointEnMetres(sv, `${e.id}/${s.id}`) : sv;
        return place;
      });
    } else if (k === 'light') {
      if ('radiusM' in v) sortie.light = v;
      else {
        sourcesConverties++;
        const lumiere = {};
        for (const [lk, lv] of Object.entries(v)) {
          if (lk === 'radiusTiles') lumiere.radiusM = lv * FACTEUR;
          else lumiere[lk] = lv;
        }
        sortie.light = lumiere;
      }
    } else if (k === 'maison' && PROVENANCES[e.id]) {
      // La phrase de provenance dit son étalon dans l'unité de la DONNÉE : elle suit le champ.
      if (v !== PROVENANCES[e.id]) provenancesReecrites++;
      sortie.maison = PROVENANCES[e.id];
    } else sortie[k] = v;
  }
  return sortie;
});

/** Une op `light` d'un dataset, son rayon passé en mètres. Les autres nœuds sont rendus TELS QUELS. */
let opsConverties = 0;
function opsEnMetres(noeud) {
  if (Array.isArray(noeud)) return noeud.map(opsEnMetres);
  if (!noeud || typeof noeud !== 'object') return noeud;
  const sortie = {};
  for (const [k, v] of Object.entries(noeud)) {
    if (noeud.op === 'light' && k === 'radiusTiles') { sortie.radiusM = v * FACTEUR; opsConverties++; }
    else sortie[k] = opsEnMetres(v);
  }
  return sortie;
}

// ————————————————————————————————— ÉCRITURE —————————————————————————————————
// NO-OP SÉMANTIQUE : ce script ne possède que les conversions en mètres et la phrase de provenance
// qui les suit. Aucune à faire = rien à écrire, quel que soit l'ordre des clés ou le formatage des
// fichiers. `opsEnMetres` compte en rendant : ses sorties se calculent AVANT la porte.
const sortiesOps = tableTotale(DATASETS_OPS, (f) => JSON.stringify(opsEnMetres(datasetsOps[f].doc), null, 2));
if (primitivesConverties + ancresConverties + sourcesConverties + provenancesReecrites + opsConverties === 0) {
  console.log('src/data : no-op (0 conversion — recettes, places et sources déjà en mètres)');
  process.exit(0);
}

const ecrits = [];
const sortieProps = JSON.stringify(apresProps, null, 2);
if (sortieProps !== props.brut) { fs.writeFileSync(chemin('props.json'), sortieProps, 'utf8'); ecrits.push('props.json'); }

for (const f of DATASETS_OPS) {
  if (sortiesOps[f] !== datasetsOps[f].brut) { fs.writeFileSync(chemin(f), sortiesOps[f], 'utf8'); ecrits.push(f); }
}

// ── PREUVE post-écriture : le facteur est EXACT (diviser par 2 rend la valeur d'entrée, valeur par
// valeur), les hauteurs et les approches n'ont pas bougé, plus aucune graphie ancienne ne survit.
{
  const relu = JSON.parse(fs.readFileSync(chemin('props.json'), 'utf8'));
  if (relu.length !== props.doc.length) echecs.push(`POST props.json : ${relu.length} entrée(s) ≠ ${props.doc.length}`);
  for (let i = 0; i < relu.length; i++) {
    const d = relu[i];
    const a = props.doc[i];
    if (d.id !== a.id) echecs.push(`POST [${i}] : id ${d.id} ≠ ${a.id}`);
    const prims = d.volume?.primitives ?? [];
    const avantPrims = a.volume?.primitives ?? [];
    if (prims.length !== avantPrims.length) echecs.push(`POST ${d.id} : ${prims.length} primitive(s) ≠ ${avantPrims.length}`);
    for (let k = 0; k < prims.length; k++) {
      const p = prims[k];
      const q = avantPrims[k];
      // L'EXACTITUDE ne se vérifie que sur ce que CE passage a converti : une primitive déjà métrique
      // à l'entrée n'a rien subi, et la comparer à elle-même ne prouverait rien.
      if (dejaPoint(q.center)) continue;
      const retour = {};
      for (const [key, v] of Object.entries(p)) {
        if (key === 'center' || key === 'size') retour[key] = { x: v.xM / FACTEUR, y: v.yM / FACTEUR, h: v.hM };
        else if (key === 'radiusM') retour.radius = v / FACTEUR;
        else retour[key] = v;
      }
      if (JSON.stringify(retour) !== JSON.stringify(q))
        echecs.push(`POST ${d.id}[${k}] : ×${FACTEUR} n’est pas exact (${JSON.stringify(retour)} ≠ ${JSON.stringify(q)})`);
    }
    for (let k = 0; k < (d.seatSlots ?? []).length; k++) {
      const s = d.seatSlots[k];
      const t = a.seatSlots[k];
      if (JSON.stringify(s.approach) !== JSON.stringify(t.approach)) echecs.push(`POST ${d.id}/${s.id} : \`approach\` modifiée`);
      if (dejaPoint(t.anchor)) continue;
      if (s.anchor.hM !== t.anchor.h) echecs.push(`POST ${d.id}/${s.id} : hauteur d’ancre modifiée`);
      if (s.anchor.xM / FACTEUR !== t.anchor.x || s.anchor.yM / FACTEUR !== t.anchor.y)
        echecs.push(`POST ${d.id}/${s.id} : ×${FACTEUR} n’est pas exact sur l’ancre`);
    }
    if (PROVENANCES[d.id] && d.maison !== PROVENANCES[d.id]) echecs.push(`POST ${d.id} : provenance non réécrite en mètres`);
    if (typeof d.maison === 'string' && /cases\)|cases contre/.test(d.maison)) echecs.push(`POST ${d.id} : la provenance parle encore en CASES`);
    if (d.light && 'radiusTiles' in d.light) echecs.push(`POST ${d.id} : \`radiusTiles\` survit dans \`light\``);
    if (d.light && a.light && 'radiusTiles' in a.light && d.light.radiusM / FACTEUR !== a.light.radiusTiles)
      echecs.push(`POST ${d.id} : rayon ${d.light.radiusM} m ≠ ${a.light.radiusTiles} × ${FACTEUR}`);
  }
  for (const f of DATASETS_OPS) {
    const opsApres = opsLight(JSON.parse(fs.readFileSync(chemin(f), 'utf8')));
    const opsAvant = opsLight(datasetsOps[f].doc);
    if (opsApres.length !== opsAvant.length) echecs.push(`POST ${f} : ${opsApres.length} op(s) \`light\` ≠ ${opsAvant.length}`);
    for (let i = 0; i < opsApres.length; i++) {
      if ('radiusTiles' in opsApres[i]) echecs.push(`POST ${f}[${i}] : \`radiusTiles\` survit dans une op \`light\``);
      if ('radiusTiles' in opsAvant[i] && opsApres[i].radiusM / FACTEUR !== opsAvant[i].radiusTiles)
        echecs.push(`POST ${f}[${i}] : rayon ${opsApres[i].radiusM} m ≠ ${opsAvant[i].radiusTiles} × ${FACTEUR}`);
    }
  }
  rapport.push(`${ecrits.join(', ')} : ${primitivesConverties} primitive(s) et ${ancresConverties} ancre(s) de place en mètres (×${FACTEUR} sur le plan, hauteurs renommées) ; ${sourcesConverties} source(s) de \`props.json\` et ${opsConverties} op(s) \`light\` en mètres ; ${provenancesReecrites} phrase(s) de provenance réécrite(s)`);
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s) après écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

for (const l of rapport) console.log(l);
