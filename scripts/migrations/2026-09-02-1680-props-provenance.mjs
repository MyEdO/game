/**
 * Migration #1680 ligne 5 — PROVENANCE et RAYONS des règles portées par `props.json`.
 *
 * `props.json` est exempté de provenance au DATASET (`SANS_LIVRE`) : ce qu'il décrit est de l'art.
 * Trois de ses champs ne le sont pas — `light` (éclairage, LDB 74 l.43/56/58), `cover` et `opaque`
 * (couvert, LDB 14 l.72/81/86) : ce sont des concepts que le canon chiffre. L'exemption du dataset les
 * rendait muets ; ce script écrit la provenance de CHAQUE entrée qui en porte un, et le refine
 * `affinerEntree` (`src/data/schemas/defs/props.ts`) l'exige désormais à l'entrée.
 *
 * QUATRE VOLETS, tous sur `src/data/props.json` — un seul fichier écrit, donc un seul script (deux
 * migrations sur le même tableau obligeraient à raisonner l'ordre lexical, cf. `replay.mjs`).
 *
 * (1) RECALAGE de deux rayons INCOHÉRENTS avec les étalons du canon. Le canon chiffre trois lampes
 *     portatives : bougie 10 m, lanterne 20 m, lampe tempête 20 m (30 ciblée) — LDB 74 l.43/56/58.
 *     Ces rayons sont écrits en MÈTRES depuis #1507 (`light.radiusM`). Or `chandelier` portait 3 cases (un
 *     chandelier éclairait donc MOINS qu'une bougie seule) et `lampadaire` 5 (la moitié d'une lanterne
 *     de poing). Les deux prennent la valeur de l'étalon qu'ils PORTENT : 5 et 10.
 *
 * (2) CINQ ÉMETTEURS NEUFS. Cinq décors dont l'ART montre une flamme ou une lampe n'éclairaient rien
 *     (classes `warm` de leur def d'art, `src/gameIso/catalog/decor/defs/`), alors que cinq autres au
 *     même contenu éclairaient déjà. Ils reçoivent le rayon de l'étalon dont ils s'approchent le plus,
 *     nommé dans leur `maison`. Les lueurs DÉCORATIVES ou MAGIQUES (idole du Chaos, cercle runique,
 *     engin à malepierre) n'en reçoivent AUCUN : une lueur d'art n'est pas une source d'éclairage
 *     chiffrée par le canon, et lui en inventer un rayon serait inventer une règle.
 *
 * (3) FOYER DÉCLARÉ des sources VOLUMIQUES (`emet`, #1680 ligne 5). Une recette volumique qui éclaire
 *     déclare LAQUELLE de ses primitives est le foyer ; le rendu y pose la lampe au lieu de la lever
 *     d'une hauteur forfaitaire à l'aplomb de la case. Deux recettes sont concernées : le lit de
 *     braises de la cheminée et la coupelle centrale de l'applique.
 *
 * (4) PROVENANCE de toutes les entrées portant `light`, `cover` ou `opaque` : champ `maison`, une
 *     CHAÎNE (la raison en clair, `grammaire/document.ts`), jamais un objet ni un drapeau. Aucune ne
 *     reçoit `source` : aucun folio ne chiffre un tonneau ni un feu de camp — ce sont des
 *     extrapolations d'étalons, et le dire est exactement ce que `maison` sert à dire.
 *
 * ENTRÉES : `src/data/props.json` (seule donnée lue et écrite).
 *
 * MARQUEUR D'IDEMPOTENCE : la présence de `maison` sur l'entrée. Les quatre volets écrivent le même
 * jeu d'entrées et aucun ne peut aboutir sans le (4) — une entrée à `light`/`cover`/`opaque` SANS
 * `maison` est non migrée, avec `maison` elle l'est. Rejoué sur l'état final, le script
 * n'écrit rien : le no-op se décide sur les CARDINAUX des quatre volets, jamais sur une égalité à
 * l'octet du fichier entier.
 *
 * FAIL-FAST (porte de lecture, avant toute écriture) : racine non-tableau, forme non canonique,
 * cardinal d'entrées à règle inattendu, entrée à règle portant DÉJÀ `source` (arbitrage : ce script
 * n'écrase aucune provenance), `maison` non-chaîne, cible du recalage introuvable ou à une valeur
 * inattendue, émetteur neuf déjà pourvu de `light`, primitive `emet` introuvable dans sa recette,
 * entrée sans phrase de provenance prévue → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/props.json');


/** Champs dont la valeur est une RÈGLE, et non de l'art — la même liste que le refine de schéma. */
const CHAMPS_DE_REGLE = ['light', 'cover', 'opaque'];
const aUneRegle = (e) => CHAMPS_DE_REGLE.some((k) => e?.[k] !== undefined);

/** (1) Rayons RECALÉS sur l'étalon que le décor porte : `de` est la valeur attendue en entrée (porte
 *  d'identité — un rayon déjà retouché ailleurs fait sortir 1), `vers` celle du canon. Les DEUX sont
 *  en CASES : `rayonEnCases` (plus bas) ramène la donnée métrique de #1507 à cette unité. */
const RECALAGES = {
  chandelier: { de: 3, vers: 5 },
  lampadaire: { de: 5, vers: 10 },
};

/** (2) Émetteurs NEUFS : rayon en cases + ton. L'entrée ne doit porter AUCUN `light` en entrée. */
const EMETTEURS_NEUFS = {
  'applique-murale': { radiusTiles: 5, tone: 'chandelle' },
  'lustre-opera': { radiusTiles: 5, tone: 'chandelle' },
  'lanterne-de-poupe': { radiusTiles: 10, tone: 'lanterne' },
  'foyer-de-forge': { radiusTiles: 5 },
  marmite: { radiusTiles: 4 },
};

/** (3) FOYER d'une recette volumique : le RANG (0-indexé) de la primitive émettrice, et le matériau
 *  qu'elle doit porter — la seconde moitié est une porte d'identité : si la recette est réordonnée, le
 *  rang seul désignerait silencieusement une autre primitive. */
const FOYERS = {
  // Le lit de braises de l'âtre, seule primitive en « braises » de la recette.
  'cheminee-interieure': { rang: 7, material: 'braises' },
  // La coupelle CENTRALE de l'applique (la dernière des trois, et la plus haute : h = 1,98 m contre
  // 1,92 m pour les deux latérales) — trois bougies, mais une source ponctuelle n'a qu'un foyer.
  'applique-murale': { rang: 10, material: 'laiton-dore' },
};

/**
 * (4) La RAISON en clair de chaque entrée à règle. Une phrase PAR ENTRÉE, adaptée à l'objet : elle
 * nomme l'étalon dont la valeur est extrapolée, et pourquoi celui-là. Les étalons du COUVERT sont les
 * trois exemples que la table de difficulté imprime (LDB 14 l.72/81/86 : haie, barrière en bois, mur
 * de pierre) ; ceux de l'ÉCLAIRAGE les trois lampes que le canon chiffre (LDB 74 l.43/56/58 : bougie,
 * lanterne, lampe tempête). Une table n'est pas une haie : chaque phrase dit à quoi l'objet s'apparente.
 */
const RAISONS = {
  // ── ÉCLAIRAGE (LDB 74 l.43/56/58) — aucun folio ne chiffre un feu ni un luminaire de décor.
  'feu-camp':
    'rayon maison : aucun folio ne chiffre un feu de camp — calé sur l’étalon de la bougie (LDB 74 l.43, 10 m), le plus petit que le canon chiffre, un foyer ouvert n’éclairant pas moins qu’une chandelle',
  brasero:
    'rayon maison : aucun folio ne chiffre un brasero — un cran SOUS le feu de camp (8 m contre 10), la cuve n’ouvrant sa flamme que vers le haut',
  chandelier:
    'rayon maison : le chandelier PORTE des bougies — calé sur l’étalon de la bougie (LDB 74 l.43, 10 m) ; un chandelier n’est pas une bougie, d’où l’arbitrage plutôt que le folio',
  lampadaire:
    'rayon maison : le lampadaire PORTE une lanterne — calé sur l’étalon de la lanterne (LDB 74 l.58, 20 m) ; un lampadaire n’est pas une lanterne de poing, d’où l’arbitrage plutôt que le folio',
  'cheminee-interieure':
    'rayon maison : aucun folio ne chiffre un âtre — même étalon que le feu de camp (bougie, LDB 74 l.43, 10 m), c’est le même foyer ouvert. Couvert maison : un manteau d’âtre maçonné s’apparente au mur de pierre de l’étalon de couvert TOTAL (LDB 14 l.86), et il coupe la vue',
  'applique-murale':
    'rayon maison : l’applique PORTE trois bougies (def d’art : bras à bougies et flammes) — calé sur l’étalon de la bougie (LDB 74 l.43, 10 m), le canon ne chiffrant pas le nombre de mèches',
  'lustre-opera':
    'rayon maison : le lustre PORTE des bougies (def d’art : bras porte-bougies à flammes) — calé sur l’étalon de la bougie (LDB 74 l.43, 10 m), le canon ne chiffrant pas le nombre de mèches',
  'lanterne-de-poupe':
    'rayon maison : c’est une lanterne, vitrée et à cage de fer (def d’art) — calé sur l’étalon de la lanterne (LDB 74 l.58, 20 m) ; montée en poupe et non portée, d’où l’arbitrage plutôt que le folio',
  'foyer-de-forge':
    'rayon maison : cuve de charbons ardents (def d’art) — même étalon que le feu de camp (bougie, LDB 74 l.43, 10 m), c’est un lit de braises à ciel ouvert',
  marmite:
    'rayon maison : braises SOUS la marmite (def d’art), sans flamme dégagée — même cran que le brasero (8 m), le chaudron masquant une part du foyer',

  // ── COUVERT (LDB 14 l.72/81/86) — étalons : haie (imparfaite), barrière en bois (moyenne), mur de pierre (totale).
  cloture:
    'couvert maison : une clôture EST la barrière en bois de l’étalon de couvert MOYEN (LDB 14 l.81) — même objet, aucune extrapolation',
  statue:
    'couvert maison : un bloc de pierre taillée s’apparente au mur de pierre de l’étalon de couvert TOTAL (LDB 14 l.86), et il coupe la vue',
  fontaine:
    'couvert maison : une margelle maçonnée à hauteur de taille protège comme la barrière en bois de l’étalon MOYEN (LDB 14 l.81) — plus dure, mais plus basse',
  puits:
    'couvert maison : margelle de pierre à hauteur de taille — même arbitrage que la fontaine, l’étalon MOYEN de la barrière en bois (LDB 14 l.81)',
  arbre:
    'couvert maison : un tronc ne masque qu’une part du corps et le feuillage ne masque rien — l’étalon IMPARFAIT de la haie (LDB 14 l.72)',
  tonneau:
    'couvert maison : un fût de bois à hauteur de taille EST du bois plein comme la barrière de l’étalon MOYEN (LDB 14 l.81)',
  caisse:
    'couvert maison : une caisse de bois à hauteur de taille — même matière et même hauteur que la barrière de l’étalon MOYEN (LDB 14 l.81)',
  charrette:
    'couvert maison : un plateau et des ridelles de bois s’apparentent à la barrière en bois de l’étalon MOYEN (LDB 14 l.81)',
  'epave-carrosse':
    'couvert maison : une caisse de voiture éventrée reste une paroi de bois trouée — l’étalon MOYEN de la barrière en bois (LDB 14 l.81)',
  'etal-marche':
    'couvert maison : un plateau de bois sur tréteaux protège comme la barrière en bois de l’étalon MOYEN (LDB 14 l.81)',
  'tas-foin':
    'couvert maison : le foin arrête le regard mais pas un trait — l’étalon IMPARFAIT de la haie (LDB 14 l.72), dont il partage la nature végétale',
  'cheval-mort':
    'couvert maison : une carcasse au sol ne couvre qu’un corps à terre — l’étalon IMPARFAIT de la haie (LDB 14 l.72)',
  'comptoir-droit':
    'couvert maison : un comptoir de bois à hauteur de poitrine EST du bois plein comme la barrière de l’étalon MOYEN (LDB 14 l.81)',
  'comptoir-angle':
    'couvert maison : même objet que le comptoir droit, replié en angle — l’étalon MOYEN de la barrière en bois (LDB 14 l.81)',
  'arche-ruine':
    'couvert maison : un piédroit de maçonnerie EST le mur de pierre de l’étalon de couvert TOTAL (LDB 14 l.86), et il coupe la vue',
  buisson:
    'couvert maison : un buisson EST la haie de l’étalon de couvert IMPARFAIT (LDB 14 l.72) — même objet, aucune extrapolation',
  cabestan:
    'couvert maison : un fût de bois cerclé à hauteur de taille — l’étalon MOYEN de la barrière en bois (LDB 14 l.81)',
  cadavre:
    'couvert maison : un corps au sol ne couvre qu’un corps à terre — l’étalon IMPARFAIT de la haie (LDB 14 l.72)',
  champignon:
    'couvert maison : un chapeau charnu arrête le regard sans arrêter un trait — l’étalon IMPARFAIT de la haie (LDB 14 l.72), dont il partage la nature végétale',
  cocon:
    'couvert maison : une masse de soie dense à hauteur d’homme protège comme la barrière en bois de l’étalon MOYEN (LDB 14 l.81)',
  'crane-monstre':
    'couvert maison : une boîte crânienne de grande créature est une coque d’os pleine — l’étalon MOYEN de la barrière en bois (LDB 14 l.81)',
  'decor-flat':
    'couvert maison : châssis de décor peint pleine hauteur, il masque tout ce qui est derrière — l’étalon TOTAL du mur de pierre (LDB 14 l.86), et il coupe la vue',
  detritus:
    'couvert maison : un tas d’ordures bas et meuble — l’étalon IMPARFAIT de la haie (LDB 14 l.72)',
  gravats:
    'couvert maison : un amas de pierres de démolition à hauteur de taille — l’étalon MOYEN de la barrière en bois (LDB 14 l.81), en plus dur et plus bas',
  ossements:
    'couvert maison : un amoncellement d’os creux et bas — l’étalon IMPARFAIT de la haie (LDB 14 l.72)',
  paravent:
    'couvert maison : un panneau pleine hauteur masque tout le corps et la vue — l’étalon TOTAL du mur de pierre (LDB 14 l.86), en bien plus fragile',
  'portant-costumes':
    'couvert maison : des vêtements pendus laissent voir entre les pans — l’étalon IMPARFAIT de la haie (LDB 14 l.72)',
  roseaux:
    'couvert maison : une touffe de roseaux EST végétale et ajourée comme la haie de l’étalon IMPARFAIT (LDB 14 l.72)',
  'roue-dentee':
    'couvert maison : un bâti de bois et une roue pleine à hauteur de taille — l’étalon MOYEN de la barrière en bois (LDB 14 l.81)',
  terrier:
    'couvert maison : un bourrelet de terre à hauteur de taille au bord du trou — l’étalon MOYEN de la barrière en bois (LDB 14 l.81)',
};

/**
 * Rayon d'une entrée, rendu en CASES — l'unité dans laquelle les étalons de `RECALAGES` et
 * d'`EMETTEURS_NEUFS` sont écrits ci-dessus. Deux graphies peuvent se présenter : `light.radiusTiles`
 * (cases, la forme que ce script a écrite) et `light.radiusM` (mètres, la forme qu'a posée
 * `2026-09-02-1507-recettes-en-metres.mjs` en la multipliant par 2). Sans cette lecture des deux, le
 * rejeu de ce script sur l'arbre courant sortirait ROUGE sur sa propre écriture.
 */
const rayonEnCases = (e) => (e?.light?.radiusM !== undefined ? e.light.radiusM / 2 : e?.light?.radiusTiles);

const echecs = [];
const brut = fs.readFileSync(CIBLE, 'utf8');
const avant = JSON.parse(brut);

// ── PORTE DE LECTURE — forme, cardinal, cohérence des quatre volets. Rien n'est écrit ici.
{
  const ecarts = [];
  if (!Array.isArray(avant)) {
    console.error('src/data/props.json : racine non-TABLEAU — rien n’est écrit');
    process.exit(1);
  }
  if (JSON.stringify(avant, null, 2) !== brut) {
    console.error('src/data/props.json : FORME NON CANONIQUE (pas `JSON.stringify(doc, null, 2)`) — rien n’est écrit');
    process.exit(1);
  }
  const parId = new Map(avant.map((e) => [e?.id, e]));
  // FORME, jamais cardinal (#1812) : le catalogue de décor grandit, et un émetteur neuf doit se voir
  // poser sa provenance, pas faire sortir 1. Ce qui mord, c'est une entrée à règle SANS `maison`.
  const aRegleAvant = avant.filter(aUneRegle).length;
  if (!aRegleAvant) ecarts.push('aucune entrée à règle — périmètre déplacé');

  for (const e of avant) {
    if (!aUneRegle(e)) continue;
    if (e.source !== undefined) ecarts.push(`${e.id} : porte DÉJÀ \`source\` — ce script n’écrase aucune provenance`);
    if (e.maison !== undefined && typeof e.maison !== 'string') ecarts.push(`${e.id} : \`maison\` non-CHAÎNE (${typeof e.maison})`);
  }
  for (const [id, { de }] of Object.entries(RECALAGES)) {
    const e = parId.get(id);
    if (!e) ecarts.push(`${id} : entrée introuvable (recalage)`);
    else if (rayonEnCases(e) !== de && rayonEnCases(e) !== RECALAGES[id].vers)
      ecarts.push(`${id} : rayon ${rayonEnCases(e)} ∉ {${de} (à recaler), ${RECALAGES[id].vers} (déjà recalé)}`);
  }
  for (const id of Object.keys(EMETTEURS_NEUFS)) {
    const e = parId.get(id);
    if (!e) ecarts.push(`${id} : entrée introuvable (émetteur neuf)`);
    else if (e.light && typeof e.maison !== 'string')
      ecarts.push(`${id} : porte DÉJÀ \`light\` sans être migrée — arbitrage requis`);
  }
  for (const [id, { rang, material }] of Object.entries(FOYERS)) {
    const prims = parId.get(id)?.volume?.primitives;
    if (!prims) ecarts.push(`${id} : recette volumique introuvable (foyer)`);
    else if (!prims[rang]) ecarts.push(`${id} : primitive de rang ${rang} absente (${prims.length} primitive(s))`);
    else if (prims[rang].material !== material)
      ecarts.push(`${id} : primitive de rang ${rang} en « ${prims[rang].material} » ≠ « ${material} » — recette réordonnée`);
  }
  // Toute entrée à règle doit avoir sa phrase, et toute phrase doit servir : une raison orpheline est
  // une entrée disparue dont personne n'a vu partir la règle.
  const idsARegle = new Set([...avant.filter(aUneRegle).map((e) => e.id), ...Object.keys(EMETTEURS_NEUFS)]);
  for (const id of idsARegle) if (!RAISONS[id]) ecarts.push(`${id} : entrée à règle SANS phrase de provenance prévue`);
  for (const id of Object.keys(RAISONS)) if (!idsARegle.has(id)) ecarts.push(`${id} : phrase de provenance ORPHELINE (aucune entrée à règle)`);

  if (ecarts.length) {
    console.error(`ARBITRAGE REQUIS — rien n’est écrit (${ecarts.length}) :`);
    for (const m of ecarts) console.error(`  ${m}`);
    process.exit(1);
  }
}

let recales = 0;
let allumes = 0;
let foyers = 0;
let provenances = 0;

/** ORDRE DES CLÉS d'une entrée — celui du document, relevé sur l'arbre (ordre de première apparition
 *  des clés dans `props.json`), `maison` en queue avec les autres champs d'enveloppe. Écrire l'entrée
 *  par cet ordre plutôt que par insertion relative rend la place d'un champ NEUF (`light`, `maison`)
 *  indépendante de ce que l'entrée portait déjà : deux décors à même contenu sortent identiques. */
const ORDRE_DES_CLES = ['id', 'type', 'label', 'solid', 'light', 'cover', 'foot', 'opaque', 'volume', 'seatSlots', 'maison'];

/** L'entrée réécrite dans l'ordre du document. Toute clé hors liste sortirait en queue, dans son ordre
 *  d'entrée — mais la porte de lecture ne laisse pas passer d'entrée à clé inconnue : le schéma est
 *  strict (`document()` + `propsSchema`), et le typecheck du projet le tient. */
const ordonner = (e) => {
  const out = {};
  for (const k of ORDRE_DES_CLES) if (e[k] !== undefined) out[k] = e[k];
  for (const k of Object.keys(e)) if (!(k in out) && e[k] !== undefined) out[k] = e[k];
  return out;
};

const apres = avant.map((e) => {
  if (!e || typeof e !== 'object') return e;
  const neuf = EMETTEURS_NEUFS[e.id];
  const recalage = RECALAGES[e.id];
  const foyer = FOYERS[e.id];
  if (!aUneRegle(e) && !neuf) return e;

  const sortie = { ...e };
  // (1) RECALAGE du rayon sur l'étalon que le décor porte.
  if (recalage && sortie.light?.radiusTiles === recalage.de) {
    recales++;
    sortie.light = { ...sortie.light, radiusTiles: recalage.vers };
  }
  // (2) ÉMETTEUR NEUF.
  if (neuf && sortie.light === undefined) {
    allumes++;
    sortie.light = { radiusTiles: neuf.radiusTiles, ...(neuf.tone ? { tone: neuf.tone } : {}) };
  }
  // (3) FOYER déclaré de la recette volumique.
  if (foyer && !sortie.volume.primitives[foyer.rang].emet) {
    foyers++;
    sortie.volume = {
      ...sortie.volume,
      primitives: sortie.volume.primitives.map((p, i) => (i === foyer.rang ? { ...p, emet: true } : p)),
    };
  }
  // (4) PROVENANCE en clair.
  if (typeof sortie.maison !== 'string') {
    provenances++;
    sortie.maison = RAISONS[e.id];
  }
  return ordonner(sortie);
});

// NO-OP SÉMANTIQUE : ce script possède quatre gestes, et rien d'autre. Aucun geste à poser = rien
// à écrire, quel que soit l'ordre des clés du fichier — `ordonner` normalise l'enveloppe des entrées
// qu'il TOUCHE, et une égalité à l'octet ferait de cette normalisation une réécriture à elle seule.
if (recales + allumes + foyers + provenances === 0) {
  console.log(
    `src/data/props.json : no-op (${recales} recalage(s), ${allumes} émetteur(s) neuf(s), ${foyers} foyer(s), `
    + `${provenances} provenance(s) — ${avant.filter(aUneRegle).length} entrée(s) à règle, toutes pourvues de \`maison\`)`,
  );
  process.exit(0);
}

const sortieTexte = JSON.stringify(apres, null, 2);

fs.writeFileSync(CIBLE, sortieTexte, 'utf8');

// ── PREUVE post-écriture : même cardinal d'entrées et même ordre, cardinal d'entrées à règle attendu,
// provenance NON VIDE sur chacune, rayons recalés, foyers posés (un par recette au plus), et AUCUNE
// entrée sans règle n'a gagné de provenance (le script ne tague que ce qui porte une règle).
{
  const relu = JSON.parse(fs.readFileSync(CIBLE, 'utf8'));
  if (relu.length !== avant.length) echecs.push(`POST : ${relu.length} entrée(s) ≠ ${avant.length}`);
  for (let i = 0; i < relu.length; i++)
    if (relu[i].id !== avant[i].id) echecs.push(`POST [${i}] : id ${relu[i].id} ≠ ${avant[i].id}`);
  const aRegle = relu.filter(aUneRegle);
  if (aRegle.length !== avant.filter(aUneRegle).length) echecs.push(`POST : ${aRegle.length} entrée(s) à règle ≠ ${avant.filter(aUneRegle).length} lues`);
  for (const e of aRegle) {
    if (typeof e.maison !== 'string' || !e.maison) echecs.push(`POST ${e.id} : \`maison\` absente ou vide`);
    if (e.source !== undefined) echecs.push(`POST ${e.id} : \`source\` posée — ce script n’en pose aucune`);
  }
  for (const e of relu) {
    if (!aUneRegle(e) && e.maison !== undefined) echecs.push(`POST ${e.id} : provenance sur une entrée SANS règle`);
    const emet = (e.volume?.primitives ?? []).filter((p) => p.emet);
    if (emet.length > 1) echecs.push(`POST ${e.id} : ${emet.length} primitives « emet » — une source n’a qu’UN foyer`);
    if (emet.length && !e.light) echecs.push(`POST ${e.id} : primitive « emet » sans \`light\``);
    if (e.light && e.volume && !emet.length) echecs.push(`POST ${e.id} : \`light\` sur une recette volumique sans foyer déclaré`);
  }
  const parId = new Map(relu.map((e) => [e.id, e]));
  for (const [id, { vers }] of Object.entries(RECALAGES))
    if (rayonEnCases(parId.get(id)) !== vers) echecs.push(`POST ${id} : rayon ${rayonEnCases(parId.get(id))} ≠ ${vers}`);
  for (const [id, { radiusTiles }] of Object.entries(EMETTEURS_NEUFS))
    if (rayonEnCases(parId.get(id)) !== radiusTiles) echecs.push(`POST ${id} : rayon ${rayonEnCases(parId.get(id))} ≠ ${radiusTiles}`);
  for (const [id, { rang }] of Object.entries(FOYERS))
    if (!parId.get(id)?.volume?.primitives?.[rang]?.emet) echecs.push(`POST ${id} : primitive de rang ${rang} sans « emet »`);
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s) après écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

console.log(
  `src/data/props.json : ${recales} rayon(s) recalé(s) sur l’étalon du canon, ${allumes} émetteur(s) neuf(s), `
  + `${foyers} foyer(s) « emet » déclaré(s), ${provenances} provenance(s) \`maison\` écrite(s) — `
  + `${apres.filter(aUneRegle).length} entrée(s) à règle, toutes pourvues`,
);
