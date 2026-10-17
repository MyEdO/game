/**
 * Migration #1680 ligne 16 — CAP D'IDENTITÉ des recettes volumiques de décor : `N` → `S`.
 *
 * Le repère d'auteur d'une recette (`PropData.volume`, `src/data/props.types.ts`) était le cap `N` ;
 * le défaut du monde pour une entité sans `facing` est `S` (`capVolumique`). Une recette sortait donc
 * en DEMI-TOUR à l'instance par défaut, et l'auteur devait tenir ce décalage de tête. Le cap
 * d'identité devient le défaut du monde : une recette s'authore telle qu'elle se voit à l'instance
 * SANS cap. La géométrie MONDE ne bouge pas — la recette tourne de 180° dans son repère local, et
 * `rotatePropLocal` retranche les 4 crans que `S` valait : les deux se compensent EXACTEMENT, à tous
 * les caps (contrat `src/gameIso/builders/propVolumes.test.ts`, « l’instance SANS cap rend la
 * géométrie AUTHORÉE »). Ce script est la moitié DONNÉE de ce changement de repère.
 *
 * NEUTRALITÉ DE RENDU, à sa juste portée : l'ENSEMBLE des faces monde est inchangé à tous les caps
 * (mesuré, 160 cellules recette × cap × matériau, 0 écart d'emprise). L'ORDRE des faces et de leurs
 * sommets, lui, CHANGE — la rotation renumérote les pans d'un cylindre et échange les joues d'un
 * prisme (88/88 cellules mesurées). Aucun consommateur ne dépend de cet ordre (la cuisson trie par
 * matériau et profondeur), mais les GOLDENS qui le figent se recalent : c'est le cas des quatre
 * snapshots de `src/gameIso/builders/propVolumes.test.ts`.
 *
 * CE QUI TOURNE, dans le repère local de chaque recette (180° autour de l'origine locale) :
 *  - `primitives[].center` : `x → −x`, `y → −y` (`h`, `size`, `radius`, `heightM` sont invariants) ;
 *  - `primitives[].slope` d'un prisme : `x+ ↔ x-`, `y+ ↔ y-` ;
 *  - `seatSlots[].anchor` et `seatSlots[].approach` : mêmes signes inversés ;
 *  - `seatSlots[].facing` : 4 crans de `DIR8_ORDER` (le demi-tour), 8 caps admis.
 *
 * SECOND VOLET, INDISSOCIABLE — les ids de place deviennent SANS CÔTÉ (`place-1`, `place-2`, …).
 * Les ids nommaient un point cardinal (`place-nord`) ou une main (`place-gauche`) : après le demi-tour
 * ci-dessus, `place-nord` est ancrée au SUD du repère que ce lot érige en vérité, et un id qui ment est
 * du poison. Le côté est PORTÉ par la géométrie (`anchor`, `facing`, `approach`) — il n'a rien à faire
 * dans une clé d'identité. Les deux volets vivent dans le MÊME script parce qu'ils écrivent le MÊME
 * tableau `seatSlots` : les séparer obligerait à raisonner l'ordre lexical de deux migrations sur un
 * même champ (cf. la chaîne `3i < 13 < 15b` en tête de `replay.mjs`).
 * PORTEUR TIERS : ce script ne convertit aucun document de scène — `Scene.seatAssignments` (clé
 * `propId → slotId`) n'a AUCUNE occurrence dans les documents committés (mesuré). Il reste UN porteur,
 * la SAUVEGARDE : `snapshotSave` (`src/state/saves.ts`) recopie le `state` entier, `state.scene`
 * comprise. Une save d'une autre forme est JETÉE avec un message (`FORMAT_SAVE`, #2404) plutôt
 * qu'élaguée en silence par `pruneSeatAssignments` (`src/state/store.ts`). Contrat :
 * `src/state/saves-flow.test.ts`.
 *
 * MARQUEURS D'IDEMPOTENCE — un par volet, chacun mesurable sur la FORME rendue : la clé d'ENVELOPPE
 * `capIdentite` en TÊTE de chaque `volume` pour la rotation, et la GRAPHIE `place-<n>` des ids de place
 * pour le renommage. Deux marqueurs plutôt qu'un seul : un volet ne peut pas se croire fait parce que
 * l'autre l'est.
 *
 * Sur le premier : la clé d'ENVELOPPE `capIdentite` en TÊTE de chaque `volume`. Une rotation
 * de 180° est son propre inverse : rejouée, elle rendrait la recette d'origine. Aucune forme
 * géométrique ne distingue donc « migré » de « pas migré », et le marqueur ne peut pas être implicite.
 * Il vit sur la RECETTE (et non sur le document : `props.json` est un TABLEAU d'entrées, il n'a pas
 * d'enveloppe de document où le poser) et il est LU PAR LE CONTRAT : `propVolumeRecipeSchema`
 * (`src/data/schemas/defs/props.ts`) le déclare `z.literal('S')` REQUIS et `PropVolumeRecipe`
 * (`src/data/props.types.ts`) le déclare au compilateur — une recette ne peut plus être écrite sans
 * dire dans quel repère elle l'est.
 *
 * ENTRÉES : `src/data/props.json` (seule donnée lue et écrite).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une recette qui porte déjà `capIdentite: 'S'` est reconnue
 * migrée ; rejoué sur l'état final, le script n'écrit rien et sort 0.
 * FAIL-FAST : cardinal de recettes inattendu (porte de lecture SEULE, avant toute écriture), racine
 * non-tableau, `capIdentite` présent mais DIVERGENT, mélange migré/non migré, `seatSlots` sur un
 * décor SANS recette (le repère de la place n'aurait plus de recette pour le porter), pente ou cap
 * inconnus → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT toute
 * écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/props.json');

/** Le cap d'identité posé par ce lot — la valeur du marqueur, et la seule que le schéma admette. */
const CAP_IDENTITE = 'S';

/**
 * Nombre de recettes ATTENDUES — mesuré sur l'arbre au moment de l'écriture (2026-09-02, 22 recettes).
 * Porte d'IDENTITÉ du périmètre : une recette ajoutée ou retirée depuis fait sortir 1 plutôt que
 * tourner un catalogue qui n'est plus celui qu'on a mesuré. Le cardinal des ENTRÉES de `props.json`
 * n'est pas la bonne mesure ici (ce script ne touche que les porteuses de `volume`) : il est gardé par
 * `2026-08-28-l1b-12a-entite-type.mjs`.
 */

/** Les 8 caps en ordre horaire — copie LOCALE de `DIR8_ORDER` (`src/state/dir8.ts`) : un script `.mjs`
 *  ne peut pas importer le module TS, et la liste est vérifiée contre lui par le typecheck du projet. */
const DIR8_ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
/** Demi-tour d'un cap : 4 crans de 45°. */
const demiTour = (dir) => DIR8_ORDER[(DIR8_ORDER.indexOf(dir) + 4) % 8];
/** Pente d'un prisme après demi-tour. */
const PENTE_OPPOSEE = { 'x+': 'x-', 'x-': 'x+', 'y+': 'y-', 'y-': 'y+' };
/** Les SIX ids de place à côté, dans l'ordre où leur meuble les déclare — la seule graphie ancienne
 *  admise. Le nouvel id est le RANG dans le tableau `seatSlots` de son meuble (`place-1`, `place-2`, …),
 *  donc rien à apparier : la position porte le numéro. */
const ANCIENS_IDS = ['place-nord', 'place-est', 'place-sud', 'place-ouest', 'place-gauche', 'place-droite'];

/** Opposé d'une coordonnée, sans zéro négatif. */
const oppose = (n) => (n === 0 ? 0 : -n);

const echecs = [];
const rapport = [];

const brut = fs.readFileSync(CIBLE, 'utf8');
const avant = JSON.parse(brut);

// PORTE DE LECTURE — cardinal, forme du fichier, cohérence du marqueur. Rien n'est écrit ici.
{
  if (!Array.isArray(avant)) {
    console.error('src/data/props.json : racine non-TABLEAU — rien n’est écrit');
    process.exit(1);
  }
  if (JSON.stringify(avant, null, 2) !== brut) {
    console.error('src/data/props.json : FORME NON CANONIQUE (pas `JSON.stringify(doc, null, 2)`) — rien n’est écrit');
    process.exit(1);
  }
  const recettes = avant.filter((e) => e && e.volume);
  const ecarts = [];
  // FORME, jamais cardinal (#1812) : le catalogue de décor grandit, un décor neuf doit se MIGRER.
  if (!recettes.length) ecarts.push('aucune recette de volume — périmètre déplacé');
  for (const e of avant) {
    if (e && e.seatSlots && !e.volume) ecarts.push(`${e.id} : \`seatSlots\` sans \`volume\` — repère de place sans recette`);
    if (!e || !e.volume) continue;
    if ('capIdentite' in e.volume && e.volume.capIdentite !== CAP_IDENTITE)
      ecarts.push(`${e.id} : \`capIdentite\` = ${JSON.stringify(e.volume.capIdentite)} ≠ ${JSON.stringify(CAP_IDENTITE)}`);
    for (const p of e.volume.primitives ?? [])
      if (p.kind === 'prism' && !(p.slope in PENTE_OPPOSEE)) ecarts.push(`${e.id} : pente inconnue « ${p.slope} »`);
    for (const s of e.seatSlots ?? [])
      if (!DIR8_ORDER.includes(s.facing)) ecarts.push(`${e.id}/${s.id} : cap inconnu « ${s.facing} »`);
  }
  // Volet RENOMMAGE : chaque id de place est soit ANCIEN (un côté), soit NOUVEAU (`place-<n>`) — jamais
  // une troisième graphie, et jamais un mélange dans un même meuble.
  for (const e of avant) {
    const ids = (e?.seatSlots ?? []).map((s) => s.id);
    if (!ids.length) continue;
    const inconnus = ids.filter((id) => !ANCIENS_IDS.includes(id) && !/^place-\d+$/.test(id));
    if (inconnus.length) ecarts.push(`${e.id} : id(s) de place hors graphie connue — ${inconnus.join(', ')}`);
    const neufs = ids.filter((id) => /^place-\d+$/.test(id)).length;
    if (neufs !== 0 && neufs !== ids.length) ecarts.push(`${e.id} : MÉLANGE d'ids de place anciens et neufs`);
    // DÉJÀ renommé : le rang doit Être le BON. Sans ce contrôle, un `place-9` glissé dans un tableau de
    // quatre passerait le rejeu en no-op — la porte ne verrait qu'une graphie valide.
    if (neufs === ids.length)
      ids.forEach((id, i) => {
        if (id !== `place-${i + 1}`) ecarts.push(`${e.id} : place de rang ${i + 1} nommée « ${id} » — un id de place porte son RANG`);
      });
  }
  const marques = recettes.filter((e) => 'capIdentite' in e.volume).length;
  if (marques !== 0 && marques !== recettes.length)
    ecarts.push(`MÉLANGE : ${marques} recette(s) marquée(s) sur ${recettes.length} — arbitrage requis`);
  if (ecarts.length) {
    console.error(`ARBITRAGE REQUIS — rien n’est écrit (${ecarts.length}) :`);
    for (const m of ecarts) console.error(`  ${m}`);
    process.exit(1);
  }
}

let tournees = 0;
let renommees = 0;
const apres = avant.map((e) => {
  if (!e || typeof e !== 'object') return e;
  // VOLET 1 — rotation de la recette, marqueur `capIdentite`.
  const aTourner = !!e.volume && !('capIdentite' in e.volume);
  // VOLET 2 — ids de place sans côté, marqueur = la graphie `place-<n>`.
  const aRenommer = (e.seatSlots ?? []).some((s) => ANCIENS_IDS.includes(s.id));
  if (!aTourner && !aRenommer) return e;
  if (aTourner) tournees++;
  if (aRenommer) renommees++;
  const volume = !e.volume ? undefined : aTourner ? {
    capIdentite: CAP_IDENTITE,
    primitives: (e.volume.primitives ?? []).map((p) => {
      const centre = { ...p.center, x: oppose(p.center.x), y: oppose(p.center.y) };
      const sortie = { ...p, center: centre };
      if (p.kind === 'prism') sortie.slope = PENTE_OPPOSEE[p.slope];
      return sortie;
    }),
  } : e.volume;
  const sortie = {};
  for (const [k, v] of Object.entries(e)) {
    if (k === 'volume') sortie.volume = volume;
    else if (k === 'seatSlots') sortie.seatSlots = v.map((s, i) => {
      // L'id devient le RANG (1-indexé) de la place dans le tableau de son meuble : la GÉOMÉTRIE
      // (`anchor`, `facing`, `approach`) porte le côté, la clé ne porte que l'identité.
      const id = aRenommer ? `place-${i + 1}` : s.id;
      if (!aTourner) return { ...s, id };
      return {
        ...s,
        id,
        anchor: { ...s.anchor, x: oppose(s.anchor.x), y: oppose(s.anchor.y) },
        facing: demiTour(s.facing),
        approach: { x: oppose(s.approach.x), y: oppose(s.approach.y) },
      };
    });
    else sortie[k] = v;
  }
  return sortie;
});

// NO-OP SÉMANTIQUE : ce script ne possède que la ROTATION des recettes et le RENOMMAGE des places.
// Aucun des deux à faire = rien à écrire, quel que soit l'ordre des clés ou le formatage du fichier.
if (tournees + renommees === 0) {
  console.log(`src/data/props.json : no-op (0 rotation, 0 renommage — ${avant.filter((e) => e && e.volume).length} recette(s) au cap d’identité ${CAP_IDENTITE}, ids de place sans côté)`);
  process.exit(0);
}

const sortie = JSON.stringify(apres, null, 2);

fs.writeFileSync(CIBLE, sortie, 'utf8');

// PREUVE post-écriture : même cardinal d'entrées, marqueur en TÊTE de chaque recette, la rotation est
// une INVOLUTION vérifiée (re-tourner la sortie rend la géométrie d'entrée, primitive par primitive et
// place par place), et le renommage est une BIJECTION DE RANG — la n-ième place reste la n-ième, seule
// sa clé change.
{
  const relu = JSON.parse(fs.readFileSync(CIBLE, 'utf8'));
  if (relu.length !== avant.length) echecs.push(`POST : ${relu.length} entrée(s) ≠ ${avant.length}`);
  for (let i = 0; i < relu.length; i++) {
    const d = relu[i];
    const a = avant[i];
    if (d.id !== a.id) echecs.push(`POST [${i}] : id ${d.id} ≠ ${a.id}`);
    // L'INVOLUTION ne se vérifie que sur ce que CE passage a tourné : une entrée déjà marquée n'a subi
    // que le renommage, et sa géométrie doit être restée IDENTIQUE.
    const tourne = !!a.volume && !('capIdentite' in a.volume);
    const revenir = (n) => (tourne ? oppose(n) : n);
    const revenirPente = (p) => (tourne ? PENTE_OPPOSEE[p] : p);
    const revenirCap = (c) => (tourne ? demiTour(c) : c);
    if (!d.volume) {
      if (a.volume) echecs.push(`POST ${d.id} : recette perdue`);
      continue;
    }
    for (let k = 0; k < (d.seatSlots ?? []).length; k++)
      if (d.seatSlots[k].id !== `place-${k + 1}`)
        echecs.push(`POST ${d.id} : place de rang ${k + 1} nommée « ${d.seatSlots[k].id} » — un id de place porte son RANG`);
    if (Object.keys(d.volume)[0] !== 'capIdentite') echecs.push(`POST ${d.id} : \`capIdentite\` n’est pas en tête de \`volume\``);
    if (d.volume.capIdentite !== CAP_IDENTITE) echecs.push(`POST ${d.id} : \`capIdentite\` ≠ ${JSON.stringify(CAP_IDENTITE)}`);
    const prims = d.volume.primitives;
    if (prims.length !== a.volume.primitives.length) echecs.push(`POST ${d.id} : ${prims.length} primitive(s) ≠ ${a.volume.primitives.length}`);
    for (let k = 0; k < prims.length; k++) {
      const p = prims[k];
      const q = a.volume.primitives[k];
      const retour = { ...p, center: { ...p.center, x: revenir(p.center.x), y: revenir(p.center.y) } };
      if (p.kind === 'prism') retour.slope = revenirPente(p.slope);
      if (JSON.stringify(retour) !== JSON.stringify(q))
        echecs.push(`POST ${d.id}[${k}] : la rotation n’est pas une involution (${JSON.stringify(retour)} ≠ ${JSON.stringify(q)})`);
    }
    for (let k = 0; k < (d.seatSlots ?? []).length; k++) {
      const s = d.seatSlots[k];
      const t = a.seatSlots[k];
      // L'id est REMIS à celui d'entrée : l'involution porte sur la GÉOMÉTRIE, le renommage est
      // vérifié séparément (bijection de rang, ci-dessus).
      const retour = {
        ...s,
        id: t.id,
        anchor: { ...s.anchor, x: revenir(s.anchor.x), y: revenir(s.anchor.y) },
        facing: revenirCap(s.facing),
        approach: { x: revenir(s.approach.x), y: revenir(s.approach.y) },
      };
      if (JSON.stringify(retour) !== JSON.stringify(t))
        echecs.push(`POST ${d.id}/${s.id} : la place n’est pas une involution (${JSON.stringify(retour)} ≠ ${JSON.stringify(t)})`);
    }
  }
  rapport.push(`src/data/props.json : ${tournees} recette(s) tournée(s) de 180°, marqueur \`capIdentite: "${CAP_IDENTITE}"\` posé ; ${renommees} meuble(s) aux ids de place SANS CÔTÉ`);
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s) après écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

for (const l of rapport) console.log(l);
