import { BONE_IDS, SLOT_BONES, SLOT_LAYER, splitPartBehind, type BoneId, type Skeleton, type Slot, type RigOverlay } from './bones';
import { memoByRef } from '../../state/sceneMemo';
import { baseSkeleton, applyBuild, referenceSkeleton, groundSkeleton, profileNarrow, baseSpeciesOf } from './skeletons';
import { bipedDef } from './creatures';
import { gabaritById } from './gabarits';
import { raceById, racePalette } from './races';
import type { RaceFeature } from './races';
import { worldTransforms, toSvg, apply, type Matrix } from './kinematics';
import { addPose, type Pose } from './poses';
import type { Appearance } from './appearance';
import { resolveParts } from './parts/resolve';
import { hairIndexById } from './parts/cosmetic';
import { applyEyes, eyesArtFromKeys } from './parts/eyes';
import { feat as catalogFeatures, featureMorpho } from './parts/elements';
import { pickView } from './parts/types';
import { appendageArt } from './parts/appendages';
import { monsterInjection } from './parts/monstrous';
import { HEADS, ARMS, LEGS } from './parts/monster';
import { buildTokenMap, applyTokenMap } from './palette';
import { tenueOverlaysFor, couchesDuRig } from './parts/career';
import type { EquipCtx } from './parts/equipment';
import { dorsalOverlays } from './parts/dorsal';
import { CAPES } from './parts/capes';
import type { View } from './facing';
import { VIEW_POSE } from './viewPose';

/** Convertit une RaceFeature en part d'os.
 *  'bone' (défaut) = telle quelle : l'os l'échelonne automatiquement via son transform scale.
 *  'fixed' = enveloppe d'échelle inverse pour annuler l'échelle de l'os (taille constante). */
export function featureToPart(f: RaceFeature, boneScale: [number, number], view: View): { svg: string; layer: number } {
  const layer = f.layer ?? 50;
  // Appendice (cornes/queue) = art MULTI-VUES du registre, résolu par vue via pickView (comme têtes/
  // tenues) ; sinon art brut 1-vue. Un seul mécanisme de résolution partout.
  const raw = f.appendage ? pickView(appendageArt(f.appendage), view) : f.svg;
  if (f.scale === 'fixed' && (Math.abs(boneScale[0] - 1) > 1e-4 || Math.abs(boneScale[1] - 1) > 1e-4)) {
    const inv = `<g transform="scale(${(1 / boneScale[0]).toFixed(4)},${(1 / boneScale[1]).toFixed(4)})">${raw}</g>`;
    return { svg: inv, layer };
  }
  return { svg: raw, layer };
}

export interface ResolvedBone {
  id: string; // BoneId (bipède) OU os d'un autre gabarit (quadrupède…) — forme partagée cross-plan
  matrix: Matrix;
  /** échelle de rendu de la part (thickness/réf, length/réf) — morpho + gabarit d'espèce. */
  scale: [number, number];
  z: number;
  parts: { svg: string; layer: number; mirror?: boolean }[];
}

/** Squelette de GABARIT ancré au sol (pieds y=150) pour une apparence — race/carrure/carrure morpho,
 *  AVANT tenue/équipement/accessoires. Facteur commun à `resolveRig` et `bodyHeadTopY` (#430 correctif
 *  « toise de normalisation = le gabarit, pas la bbox rendue accessoires compris »). PUR. */
function groundedBodySkeleton(appearance: Appearance) {
  // Race de rendu : le def bipède de l'espèce peut IMPOSER sa race (Vermine de choc → Skaven,
  // Fimir → Fimir…) ; sinon heuristique de nom (variantes régionales → espèce de base).
  const bDef = bipedDef(appearance.species);
  const race = raceById(bDef?.race ?? baseSpeciesOf(appearance.species));
  // Difformités MORPHO posées en apparence (appearance.features → catalogue) : carrure/jambes/visage
  // retourné cumulés ici → l'aperçu éditeur et les PNJ authorés reflètent la morpho, comme les calques.
  // (Pour un combattant, la morpho de SES mutations est déjà repliée dans l'apparence par
  // combatantAppearance, via des clés HORS appearance.features → aucune double application.)
  const fm = featureMorpho(appearance.features ?? []);
  const morphoBuild = Math.min(1, Math.max(0, appearance.build + fm.dBuild));
  const legsMult = (appearance.legs ?? 1) * fm.legsMult;
  // appearance.gabarit explicite = remplacement COMPLET de la carrure ; le gabaritOverride
  // de la race (réglé pour son gabarit par défaut) ne s'applique PAS dans ce cas.
  let gDef = appearance.gabarit
    ? gabaritById(appearance.gabarit)
    : { ...gabaritById(race.gabarit), ...(race.gabaritOverride ?? {}) };
  // Mutation morpho « Court sur pattes » : multiplicateur de jambes composé sur le gabarit.
  if (legsMult !== 1) gDef = { ...gDef, legs: gDef.legs * legsMult };
  return { sk: groundSkeleton(applyBuild(baseSkeleton(gDef, appearance.sex), morphoBuild)), race, fm, bDef };
}

/** Sommet de tête (y le plus petit) du squelette de GABARIT, pieds ancrés à y=150 — indépendant de
 *  tout accessoire/coiffe/arme (#430 correctif : deux humains rendent à la MÊME hauteur de CORPS,
 *  qu'ils portent une plume ou non — la toise de normalisation vient du gabarit, jamais de la bbox
 *  rendue). PUR, aucune mesure DOM. */
export function bodyHeadTopY(appearance: Appearance): number {
  const { sk } = groundedBodySkeleton(appearance);
  const world = worldTransforms(sk, {});
  return apply(world.tete, { x: 0, y: -sk.tete.length }).y;
}

/** Sol du repère de corps (`groundSkeleton`, skeletons.ts) — les pieds y sont toujours ancrés. */
export const GROUND_Y = 150;

/** LA TOISE d'une apparence : hauteur du CORPS de gabarit, des pieds (`GROUND_Y`) au sommet de tête
 *  (`bodyHeadTopY` — accessoires exclus). Unités du repère de corps, comparables d'une race à
 *  l'autre : c'est la donnée qui dit qu'un ogre est deux fois plus haut qu'un halfling. Brique de la
 *  toise COMMUNE d'une grille à échelle vraie (`CharacterPreview.scaleRef`, #431) :
 *  `Math.max(...apparences.map(bodyHeight))`. PUR, aucune mesure DOM. */
export function bodyHeight(appearance: Appearance): number {
  return GROUND_Y - bodyHeadTopY(appearance);
}

/** Clé de la toise : les SEULS champs d'apparence que `groundedBodySkeleton` lit (espèce, difformités
 *  morpho, carrure, jambes, sexe, gabarit explicite). Deux apparences de même clé ont la même toise. */
function toiseKey(a: Appearance): string {
  return `${a.species}|${a.sex}|${a.build}|${a.legs ?? 1}|${a.gabarit ?? ''}|${(a.features ?? []).join(',')}`;
}
const TOP_FRAC = new Map<string, number>();

/** La toise d'une apparence RAPPORTÉE À SA BOÎTE (`GROUND_Y`) : 1 = un corps qui remplit la boîte
 *  120×150 de bas en haut, 0,55 = un halfling qui n'en occupe que la moitié basse. C'est le nombre
 *  qui dit OÙ est la tête DESSINÉE dans le cadre, quelle que soit la voie de rendu qui l'affiche —
 *  le quad texturé (`billboardMath`) et l'ancrage du chrome (`chromeHeadPx`) la lisent tous deux.
 *  Borné à 1 : le fragment est rasterisé dans un `viewBox="0 0 120 150"` (`svgTexture`), un corps
 *  dessiné au-dessus du cadre y est coupé. Mémoïsé sur `toiseKey` (appelé par frame et par jeton). */
export function bodyTopFrac(appearance: Appearance): number {
  const k = toiseKey(appearance);
  const hit = TOP_FRAC.get(k);
  if (hit !== undefined) return hit;
  const v = Math.min(1, bodyHeight(appearance) / GROUND_Y);
  TOP_FRAC.set(k, v);
  return v;
}

/**
 * COMPOSITION d'un rig : tout ce qui décrit le personnage et NE dépend PAS de l'instant — squelette,
 * parts résolues, palette appliquée, échelles, profondeurs, ordre du peintre. Seule la POSE change
 * d'une image à l'autre ; elle n'entre donc pas ici. `poseRig` en dérive les matrices par image.
 */
export interface RigComposition {
  /** Squelette du personnage, vue déjà appliquée (profil = corps étroit) — origine de la FK. */
  sk: Skeleton;
  /** Posture de repos d'ESPÈCE et posture de VUE : sommées à la pose de l'image, dans cet ordre. */
  speciesPose: Pose;
  viewPose: Pose;
  /** Os composés, DÉJÀ triés z croissant (peintre) — tout d'un `ResolvedBone` sauf sa matrice. */
  order: { id: BoneId; scale: [number, number]; z: number; parts: ResolvedBone['parts'] }[];
}

/** Aucun calque — réf STABLE : un `[]` frais par appel serait une clé de composition neuve à chaque image. */
const NO_OVERLAYS: RigOverlay[] = [];

function buildComposition(
  appearance: Appearance,
  equip: EquipCtx,
  tenue: string | undefined,
  view: View,
  overlays: RigOverlay[],
  mirror: boolean,
): RigComposition {
  const { sk: groundedSk, race, fm, bDef } = groundedBodySkeleton(appearance);
  const faceFlip = appearance.faceFlip || fm.faceFlip;
  let sk = groundedSk;
  if (view === 'profile') sk = profileNarrow(sk); // corps étroit de profil (membres sur l'axe)
  // De profil, le swing du bras DROIT (porteur de l'arme) éloigne la main → l'arme barre le
  // torse. Quand une arme de MÊLÉE est tenue, on annule ce swing pour que le bras pende au
  // côté (l'arme tombe à la verticale). Mêlée seulement : le distance garde sa pose de visée.
  let viewPose = VIEW_POSE[view];
  if (view === 'profile' && equip.weapons?.some((w) => w.type === 'melee')) {
    viewPose = addPose(viewPose, { epauleD: 8, avantBrasD: 6 }); // bras porteur LÉGÈREMENT en avant → arme visible au côté (base profil = -4)
  }
  // Posture de repos PAR ESPÈCE (ex. skaven voûté : torse penché + tête basse). UNIQUEMENT
  // en PROFIL : une rotation du torse en 2D = penché EN AVANT de profil (correct), mais de
  // FACE/DOS elle tilterait tout le corps DE CÔTÉ (« penche à droite »). De face/dos on reste
  // droit (un dos voûté ne se montre pas pile de face en 2D).
  const speciesPose = view === 'profile' ? race.pose ?? {} : {};
  // Coiffure IMPOSÉE par id (`appearance.hairstyle`, #637) : résolue en index de pool ICI (seam qui tient
  // l'apparence) et injectée en override `cheveux` — prime sur parts.cheveux/seed. Fail-fast si l'id est
  // introuvable (hairIndexById). Sinon, override d'index / tirage sexe+ordre inchangés.
  const partOverrides = appearance.hairstyle != null
    ? { ...appearance.parts, cheveux: hairIndexById(appearance.species, appearance.sex, appearance.hairstyle) }
    : (appearance.parts ?? {});
  // Nu du PIED (#736 Lot 1) : `perso.extremites` (créature non-canonique repliée sur une race
  // partagée, ex. Géant/Liche → Humain) prime sur le défaut de la RACE — même résolution que le
  // corps nu (bDef/race déjà résolus ci-dessus par `groundedBodySkeleton`).
  const extremites = bDef?.perso?.extremites ?? race.extremites ?? 'lisses';
  const parts = resolveParts(appearance.species, appearance.sex, tenue, equip, partOverrides, appearance.seed ?? 1, view, extremites);
  // Yeux personnalisés (œil de verre, Œil énorme, yeux d'animaux…) : remplacés EN PLACE
  // sur l'orbite marquée du visage (cf. parts/eyes.ts — no-op sans marqueur). Les yeux de
  // RACE (Vampire rougeoyant) servent de défaut, l'apparence (mutation/blessure) prime.
  // race.eyes = CLÉS du catalogue d'yeux (résolues en art ici) ; appearance.eyes = art déjà résolu en amont.
  const eyes = race.eyes || appearance.eyes ? { ...eyesArtFromKeys(race.eyes), ...appearance.eyes } : undefined;
  if (eyes && parts.visage?.svg) parts.visage = { svg: applyEyes(parts.visage.svg, eyes) };

  // Échelle de rendu par os = (thickness/réf, length/réf). Os de longueur/épaisseur
  // nulle (arme/bouclier) : hérite du parent. N'affecte PAS la FK (positions des joints).
  const REF = referenceSkeleton();
  const scaleOf = {} as Record<BoneId, [number, number]>;
  for (const id of BONE_IDS) {
    const b = sk[id];
    const r = REF[id];
    const par: [number, number] = b.parent ? scaleOf[b.parent] : [1, 1];
    if (r.thickness <= 0.001 && r.length <= 0.001) {
      // os d'attache (arme/bouclier) : échelle UNIFORME du parent → l'arme ne s'étire pas.
      const u = (par[0] + par[1]) / 2;
      scaleOf[id] = [u, u];
    } else {
      const sx = r.thickness > 0.001 ? b.thickness / r.thickness : par[0];
      const sy = r.length > 0.001 ? b.length / r.length : par[1];
      scaleOf[id] = [sx, sy];
    }
  }

  const boneParts: Record<BoneId, ResolvedBone['parts']> = {} as Record<BoneId, ResolvedBone['parts']>;
  for (const id of BONE_IDS) boneParts[id] = [];
  // Calques à PLAN dédié dans le tri du peintre (ailes, chutes de chevelure) : z propre, dans le
  // repère de l'os hôte — remplis par le dépliage des parts ET par la file d'overlays plus bas.
  const planeExtras: { bone: BoneId; svg: string; z: number }[] = [];

  // Un vampire (monster.cape) garde la robe de carrière mais PAS le couvre-chef de cour
  // (le chapeau de Noble faisait une « couronne » rouge) : on saute le slot `tete` (le
  // visage + les cheveux lissés restent, via leurs propres slots).
  const dropHeadgear = !!appearance.monster?.cape || !!race.dropHeadgear;
  // perso.monster du creature-def = override COMPLET de la race (parts structurelles sautées).
  const hasPersoMonster = !!appearance.monster && Object.keys(appearance.monster).length > 0;
  // Tête de RACE (rat, orc…) — surchargeable par le def créature (perso.head : tête de
  // vache/poulet de la basse-cour SANS perdre queue/fourrure de race). Remplace visage/
  // cheveux mais PAS la coiffe de tenue — un skaven casqué garde sa tête de rat SOUS le
  // casque (corps nu et tenue = axes séparés).
  const raceHeadKey = hasPersoMonster ? undefined : (bDef?.perso?.head ?? race.head);
  const raceHead = raceHeadKey ? HEADS[raceHeadKey] : undefined;
  for (const slot of Object.keys(SLOT_BONES) as Slot[]) {
    if (slot === 'tete' && dropHeadgear) continue;
    if ((slot === 'visage' || slot === 'cheveux') && raceHead) continue;
    const part = parts[slot];
    if (!part || !part.svg) continue;
    // Composantes pliées de la part (chevelure, cf. bones.ts) : `behind` = masse qui épouse le
    // crâne, layer −2 (derrière la part de visage, même sémantique que RigOverlay.behind) ;
    // `drop` = chute qui DÉPASSE la tête, routée sur le PLAN dorsal (cf. parts/dorsal.ts) :
    // fond de face (derrière tout le corps), avant de dos (sur le dos), layer −2 de profil
    // (racine ancrée au crâne, peinte sur le bord du dos).
    const { drop, behind, main } = splitPartBehind(part.svg);
    // Visage inversé (mutation LDB 19) : le VRAI visage du personnage est retourné tête en bas
    // (flip vertical au centre du visage, y≈7) — cheveux et crâne restent en place.
    const svg = slot === 'visage' && faceFlip
      ? `<g transform="translate(0,14) scale(1,-1)">${main}</g>`
      : main;
    SLOT_BONES[slot].forEach((bid, idx) => {
      // Le 2e os d'une paire est miroité POUR LA SYMÉTRIE DE FACE/DOS. En PROFIL c'est
      // faux : les deux pieds/jambes/bras regardent dans la même direction (pas en miroir)
      // — sinon le pied arrière pointe à l'envers (« chaussures vers l'intérieur »).
      const mirror = idx === 1 && view !== 'profile';
      if (drop) {
        if (view === 'profile') boneParts[bid].push({ svg: drop, layer: -2, mirror });
        else planeExtras.push({ bone: bid, svg: drop, z: view === 'front' ? -10 : 99 });
      }
      if (behind) boneParts[bid].push({ svg: behind, layer: -2, mirror });
      boneParts[bid].push({ svg, layer: SLOT_LAYER[slot], mirror });
    });
  }

  // Parties structurelles de RACE (tête/jambes/bras monstrueux + features) — sautées si
  // appearance.monster est défini (perso.monster du creature-def = override COMPLET de la
  // race, ex. Démonette qui hérite du Démon mais a sa propre config sans tête de Khorne).
  // Symétrie avec l'ancien race.monster : un perso.monster non-vide remplaçait intégralement
  // le race.monster (opérateur ??), donc les parts de la race n'étaient jamais injectées.
  if (!hasPersoMonster) {
    // Tête de RACE (ex. Orc) : poussée SOUS la coiffe de tenue (layer 0 < coiffe 2) —
    // visage/cheveux ont déjà été sautés au remplissage des slots ci-dessus.
    if (raceHead) boneParts['tete'].push({ svg: pickView(raceHead, view), layer: 0 });
    // Membres monstrueux de RACE (REMPLACENT l'os) : jambes de chèvre (Minotaure)…
    if (race.legs) {
      const l = LEGS[race.legs];
      if (l) { boneParts['cuisseG'] = [{ svg: pickView(l, view), layer: 5 }]; boneParts['cuisseD'] = [{ svg: pickView(l, view), layer: 5 }]; }
    }
    if (race.armG) { const a = ARMS[race.armG]; if (a) boneParts['epauleG'] = [{ svg: pickView(a, view), layer: 5 }]; }
    if (race.armD) { const a = ARMS[race.armD]; if (a) boneParts['epauleD'] = [{ svg: pickView(a, view), layer: 5 }]; }
  }

  // Parts MONSTRUEUSES (mutant modulaire / perso créature) : les REMPLACEMENTS d'os (tête
  // monstrueuse → efface visage/cheveux ; bras G/D → membre asymétrique) sont appliqués ici ;
  // leurs CALQUES rejoignent la file commune ci-dessous — UN SEUL traitement pour l'éditeur
  // (monster) et le reste (mutations/blessures/traits), aucune divergence possible.
  const queue: RigOverlay[] = [];
  if (appearance.monster) {
    const inj = monsterInjection(appearance.monster, view);
    for (const [bone, part] of Object.entries(inj.replace) as [BoneId, import('./parts/types').PartArt][])
      boneParts[bone] = [{ svg: pickView(part, view), layer: 5 }];
    queue.push(...inj.overlays);
  }
  // Cape portée (emplacement Cape — cosmétique) : appendice dorsal accroché au torse, mêmes
  // règles de profondeur que les ailes. Suit l'EquipCtx → visible partout (token, portraits…).
  if (equip.cape) queue.push(...dorsalOverlays('torse', CAPES.voyage));
  // Calques asymétriques DE TENUE (pauldron/fourrure débordant une SEULE épaule) — même file
  // que cape/monstre/instance, résolus par id de garde-robe (tenueOverlaysFor, career.ts).
  queue.push(...tenueOverlaysFor(tenue));
  queue.push(...overlays);

  // Calques cosmétiques (mutations, blessures, traits, parts monstrueuses…) dans le repère de
  // leur os. `view` limite à une vue (groin/langue de face) ; `behind` passe SOUS la part
  // (cornes, halo) ; `replace` substitue la part de l'os (bras → tentacule, svg vide = efface) ;
  // `plane` extrait le calque du z de l'os hôte (ailes : derrière/devant TOUT le corps).
  for (const ov of queue) {
    if (ov.view && ov.view !== view) continue;
    // Appendice (cornes/queue) = art MULTI-VUES du registre, résolu par vue — même mécanisme que
    // featureToPart, pour que TOUT chemin d'overlay (état/combat inclus) soit multi-vues.
    const ovSvg = ov.appendage ? pickView(appendageArt(ov.appendage), view) : ov.svg;
    if (ov.plane) {
      if (ovSvg) planeExtras.push({ bone: ov.bone, svg: ovSvg, z: ov.plane === 'fond' ? -10 : 99 });
      continue;
    }
    if (ov.replace) { boneParts[ov.bone] = ovSvg ? [{ svg: ovSvg, layer: 5 }] : []; continue; }
    if (!ovSvg) continue;
    boneParts[ov.bone].push({ svg: ovSvg, layer: ov.behind ? -2 : 99 });
  }

  // Traits de corps de RACE (cornes, queue, crocs, verrues…). Injectés AVANT la résolution
  // de palette pour que leurs tokens @peau/@metal soient appliqués comme le reste.
  // Sautés si appearance.monster (perso complet) — idem race.head/legs ci-dessus.
  if (!hasPersoMonster) {
    for (const feat of race.features ?? []) {
      if (feat.view && feat.view !== view) continue;   // feature limitée à une vue (ex. crocs front)
      const part = featureToPart(feat, scaleOf[feat.bone], view);
      boneParts[feat.bone].push({ svg: part.svg, layer: part.layer });
    }
  }
  // Traits propres à CETTE créature (perso.features du def) — ADDITIFS par-dessus la race,
  // jamais sautés : l'outil « race partagée + extra » (cornes du Prophète gris sur tête de rat)
  // sans basculer dans l'override complet perso.monster.
  for (const feat of bDef?.perso?.features ?? []) {
    if (feat.view && feat.view !== view) continue;
    const part = featureToPart(feat, scaleOf[feat.bone], view);
    boneParts[feat.bone].push({ svg: part.svg, layer: part.layer });
  }
  // Traits ADDITIFS d'INSTANCE — `appearance.features` (clés du catalogue) : n'importe quel PNJ pioche
  // des éléments réutilisables (queue, cornes, crocs… ET difformités : tentacule, bouche…) par-dessus
  // sa race/def, EN APPARENCE PURE (sans trait/talent). Applique le calque COMPLET : remplacement de
  // membre (`replace`), arrière-plan (`behind`) ou calque échelonné (`scale`) — comme une mutation.
  for (const f of catalogFeatures(...(appearance.features ?? []))) {
    if (f.view && f.view !== view) continue;
    if (f.replace) { boneParts[f.bone] = f.svg ? [{ svg: f.svg, layer: 5 }] : []; continue; }
    if (f.scale) { const part = featureToPart(f, scaleOf[f.bone], view); boneParts[f.bone].push({ svg: part.svg, layer: part.layer }); }
    else boneParts[f.bone].push({ svg: f.svg, layer: f.behind ? -2 : 99 });
  }

  // PROFIL — un seul bras NU (#633). De côté, un humain ne montre que le bras PROCHE (epauleD,
  // z=8 > torse) au flanc ; le bras LOIN (chaîne epauleG, z=4 < torse) est derrière le corps. Le torse
  // l'occulte là où ils se recouvrent, mais l'avant-bras/main pendent SOUS l'ourlet et redessinaient
  // une 2ᵉ silhouette (« doubles bras » au zoom). On drop donc la chaîne du bras loin en profil —
  // MAIS seulement s'il ne TIENT rien : quand la main gauche porte un bouclier ou une arme secondaire
  // (dual-wield `hand:'off'`), l'os `bouclier` (parent mainG) est rempli → sinon l'accessoire flotte à
  // la hanche sans bras qui le tienne. Bras loin ÉQUIPÉ = conservé (un bras-bouclier/armé en profil est
  // correct, pas un doublon parasite). Front/dos INCHANGÉS (symétriques, deux bras).
  if (view === 'profile' && boneParts['bouclier'].length === 0) {
    for (const id of ['epauleG', 'avantBrasG', 'mainG'] as BoneId[]) boneParts[id] = [];
  }

  // PALETTE : résout les jetons de clé de palette de chaque part. Couches (#1903 D3) : défaut <
  // espèce < tenue < surcharges du joueur (appearance.colors). La peau greffée par la tête
  // (SKIN_FROM_HEAD) est une valeur de la couche ESPÈCE, posée seulement quand l'espèce n'a pas de
  // peau (ex. un Humain à tête de lézard) : une espèce qui a la sienne (Skaven, Orc, Goule…) la garde.
  const speciesPalette = racePalette(race.id, appearance.sex);
  const SKIN_FROM_HEAD: Record<string, string> = {
    lezard: '#5d7a42', chien: '#6e4a2c', rat: '#6e4a2e',
  };
  const skinHeadKey = appearance.monster?.tete ?? bDef?.perso?.head ?? race.head; // greffe de peau depuis la tête (monster, def OU race)
  const headSkin = speciesPalette.peau == null && skinHeadKey ? SKIN_FROM_HEAD[skinHeadKey] : undefined;
  const espece = headSkin ? { ...speciesPalette, peau: headSkin } : speciesPalette;
  // Sous tout : les jetons des parts SYSTÈME du pied (botte/griffes — dessinées par resolve, pas par
  // la tenue) viennent de la couche défaut. `couchesDuRig` est la SEULE construction de
  // l'empilage (#426).
  const tmap = buildTokenMap(couchesDuRig(espece, tenue), appearance.colors);
  for (const id of BONE_IDS) boneParts[id] = boneParts[id].map((p) => ({ ...p, svg: applyTokenMap(p.svg, tmap) }));

  // Profondeur en PROFIL, par COUCHES : ARME DU FOND ← (recouverte par) le HÉROS ← (recouverte par) l'ARME
  // DEVANT. Seules les armes sont re-z-ées (le corps garde son ordre normal entre les deux) : l'arme du fond
  // passe SOUS tout le héros (le bouclier, plus grand que la main, dépasse derrière sans être imprimé dessus) ;
  // l'arme avant passe AU-DESSUS de tout. Quelle main est au fond dépend du sens (mirror) : main directrice
  // (droite=arme) près face-à-droite / loin face-à-gauche ; main gauche (bouclier/2e arme) l'inverse.
  const zOverride: Partial<Record<BoneId, number>> = {};
  // Mains SOUS l'avant-bras : à z égal, le tri stable peignait la main PAR-DESSUS l'art de bras
  // (BONE_IDS liste avantBrasX avant mainX) → poing-disque posé SUR la manche, tangent même à
  // trou nul. La main passe juste SOUS l'os d'AVANT-BRAS (#633 D1 : c'est lui qui porte désormais
  // l'art au poignet) du MÊME côté : toute manche (ou bras nu) qui atteint le poignet recouvre le
  // haut du poing/poignet (chevauchement franc). Relations conservées : G reste sous torse
  // (4→3.5 < 5) et sous bouclier, D reste devant torse (8→7.5 > 5), l'arme (z=9, ou re-z de profil
  // ci-dessous) reste devant la main qui la tient.
  zOverride.mainG = sk.avantBrasG.z - 0.5;
  zOverride.mainD = sk.avantBrasD.z - 0.5;
  // La profondeur proche/lointain des JAMBES (cuisseD z=6 > torse 5, skeletons.ts) n'a de sens que
  // de PROFIL (jambe proche devant le corps). De face/dos, la vue est symétrique : la jambe droite
  // s'aligne sur le z de la gauche (sous le torse), sinon elle s'imprime PAR-DESSUS l'ourlet de la
  // tenue (jambe « détachée » du corps, #633 P3). Les bras gardent leur asymétrie (le bras armé
  // passe DEVANT le corps quand une anim le fait traverser — jamais le cas d'une jambe).
  if (view !== 'profile') {
    zOverride.cuisseD = sk.cuisseG.z;
    zOverride.tibiaD = sk.tibiaG.z;
    zOverride.piedD = sk.piedG.z;
  }
  if (view === 'profile') {
    zOverride.arme = mirror ? -2 : 99; // arme = main droite (directrice)
    zOverride.bouclier = mirror ? 99 : -2; // bouclier / 2e arme = main gauche
  }

  const order = BONE_IDS
    .map((id) => ({ id, scale: scaleOf[id], z: zOverride[id] ?? sk[id].z, parts: boneParts[id].sort((a, b) => a.layer - b.layer) }))
    .filter((b) => b.parts.length > 0);
  // Calques à PLAN dédié (ailes…) : entrée z propre, dans le repère (matrice/échelle) de l'os hôte.
  for (const p of planeExtras) {
    order.push({ id: p.bone, scale: scaleOf[p.bone], z: p.z, parts: [{ svg: applyTokenMap(p.svg, tmap), layer: 0 }] });
  }
  return { sk, speciesPose, viewPose, order: order.sort((a, b) => a.z - b.z) };
}

/**
 * Composition MÉMOÏSÉE par identité de référence (`memoByRef`, le patron canonique du dépôt).
 * Clé = l'identité du PERSONNAGE : son apparence, son équipement et ses calques d'état (chacun une
 * réf — toute mutation réelle en produit une nouvelle, donc rien à invalider à la main), puis la
 * garde-robe, la vue et le sens, qui sont des scalaires. Une blessure, une mutation, un changement
 * de tenue, d'arme ou de direction change donc la clé et recompose ; une simple image d'animation,
 * non. Le sous-cache par variante meurt avec l'apparence qui le porte.
 */
const compositionCache = memoByRef((_appearance: Appearance) =>
  memoByRef((_equip: EquipCtx) =>
    memoByRef((_overlays: RigOverlay[]) => new Map<string, RigComposition>())));

export function rigComposition(
  appearance: Appearance,
  equip: EquipCtx,
  tenue?: string,
  view: View = 'front',
  overlays: RigOverlay[] = NO_OVERLAYS,
  mirror = false,
): RigComposition {
  const variants = compositionCache(appearance)(equip)(overlays);
  const key = `${tenue ?? ''} ${view} ${mirror ? 1 : 0}`;
  let comp = variants.get(key);
  if (comp === undefined) {
    comp = buildComposition(appearance, equip, tenue, view, overlays, mirror);
    variants.set(key, comp);
  }
  return comp;
}

/** Une COMPOSITION + la pose de l'instant → os résolus, triés z croissant (peintre). PUR.
 *  Seul travail réellement par-image : la FK (`worldTransforms`) sur le squelette composé. */
export function poseRig(comp: RigComposition, pose: Pose): ResolvedBone[] {
  const world = worldTransforms(comp.sk, addPose(comp.speciesPose, addPose(comp.viewPose, pose)));
  return comp.order.map((b) => ({ id: b.id, matrix: world[b.id], scale: b.scale, z: b.z, parts: b.parts }));
}

/** (apparence, équipement, pose, tenue?) → os résolus, triés z croissant (peintre). PUR. */
export function resolveRig(
  appearance: Appearance,
  equip: EquipCtx,
  pose: Pose,
  tenue?: string,
  view: View = 'front',
  overlays: RigOverlay[] = NO_OVERLAYS,
  mirror = false,
): ResolvedBone[] {
  return poseRig(rigComposition(appearance, equip, tenue, view, overlays, mirror), pose);
}

/** Composant : un <g data-bone> par os, transformable individuellement (anim C / postures D). */
export function RigSprite({ appearance, equip, pose = {}, career, view = 'front', overlays, mirror = false }: {
  appearance: Appearance;
  equip: EquipCtx;
  pose?: Pose;
  /** Id de garde-robe (tenue OU carrière) — la carrière de jeu d'un héros sert de tenue par défaut. */
  career?: string;
  view?: View;
  overlays?: RigOverlay[];
  /** Regarde à gauche (le token applique le flip horizontal) → profondeur de profil inversée. */
  mirror?: boolean;
}): JSX.Element {
  const bones = resolveRig(appearance, equip, pose, career, view, overlays ?? NO_OVERLAYS, mirror);
  return (
    <g className="rig">
      {bones.map((b) => (
        <g key={`${b.id}.${b.z}`} data-bone={b.id} transform={toSvg(b.matrix)}>
          <g transform={`scale(${b.scale[0].toFixed(4)},${b.scale[1].toFixed(4)})`}>
            {b.parts.map((p, i) =>
              p.mirror ? (
                <g key={i} transform="scale(-1,1)" dangerouslySetInnerHTML={{ __html: p.svg }} />
              ) : (
                <g key={i} dangerouslySetInnerHTML={{ __html: p.svg }} />
              ),
            )}
          </g>
        </g>
      ))}
    </g>
  );
}
