/**
 * LAMPES PONCTUELLES de l'écran de jeu volumique (#1245, lot L1) — les FLAQUES que les sources de
 * lumière de la scène (`state/visionState.ts` → `sceneLightSources`) posent dans le monde. Module PUR
 * à part de `GameStage3D`, au même titre que `stageLights.ts` (l'ambiante et le soleil) : l'écran
 * MONTE ce que cette passe décide, il ne décide rien lui-même.
 *
 * POOL FIXE, et c'est STRUCTUREL. Le compte de lampes montées entre dans la clé de cache de programme
 * de three (`numPointLights`, `getProgramCacheKeyParameters` — mesuré dans `three.module.js` 0.185.1,
 * et le test épingle la ligne) : le faire varier RECOMPILE tous les matériaux du monde (76 sur l'arène).
 * Donc : `createPointLightPool` monte un budget FIXE une fois pour toutes, et `applyPointLights`
 * bouge seulement l'INTENSITÉ, la position et la portée. Une lampe éteinte a une intensité de 0 —
 * jamais `visible = false`, qui la retirerait de la passe de lumière (`WebGLRenderer.projectObject`
 * ignore un objet invisible) et ferait donc exactement varier le compte que l'on fige.
 *
 * `decay = 0` : l'atténuation physique en 1/d² n'a rien à voir avec la mécanique du jeu, qui dégrade
 * linéairement jusqu'à son rayon (`state/vision.ts` `falloff`). Ce que `distance` fait, en revanche,
 * est exactement ce qu'on veut : three coupe la contribution par `pow2(saturate(1 − pow4(d/distance)))`,
 * donc RIEN au-delà de `radiusTiles × mpt` — la flaque ne déborde jamais du rayon RAW de la source.
 *
 * TON (#1245, L4) : tout ce qui relève de l'APPARENCE d'une source — sa couleur, sa part d'intensité,
 * son vacillement — vit en DONNÉE (`src/data/lightTones.json`) et se résout ICI, au bord du rendu
 * (`resolveTone`). Le moteur ne connaît d'une source que son RAYON (LDB 74) ; un ton forgé change donc
 * ce que l'écran montre sans une ligne de code. Le ton MODULE le calage anti-saturation, il ne le
 * remplace pas : `intensity` est un facteur ≤ 1 de `FLAME_INTENSITY`, et le vacillement ne fait que
 * RETRANCHER (`flickerFactor` ∈ ]0,1]) — rien ne passe au-dessus de la marge que ce calage protège.
 *
 * ÉCARTS CONSIGNÉS (visuels seulement — le champ mécanique, lui, reste la vérité de jeu) :
 *  - three ADDITIONNE les contributions là où `computeLightField` les combine par MAX — d'où
 *    l'intensité CALÉE sous la saturation (`FLAME_INTENSITY`) : sans tone mapping, deux flaques qui
 *    se recouvrent écrêteraient en aplat blanc ;
 *  - les flaques ne sont pas coupées par les murs (le champ mécanique, lui, le sait) ;
 *  - la lampe est levée de `FLAME_LIFT_M` au-dessus du sol (une lampe posée AU sol n'éclairerait pas
 *    le sol : sa direction y est rasante, donc `dotNL` nul) — la flaque au sol est donc un peu plus
 *    courte que le rayon RAW, jamais plus longue ;
 *  - la COULEUR d'un ton ne peint que le monde lambertien : l'exposition d'un billboard est un
 *    SCALAIRE (`billboardExposure`, la normale d'un quad est l'axe caméra), donc un personnage au pied
 *    d'un brasero s'éclaircit et bat avec lui, mais ne s'y teinte pas. Le porter en RGB demanderait
 *    d'ouvrir le contrat de `billboardMaterial` (une couleur, plus une luminance) ;
 *  - BORD DE FLAQUE (mesuré 2026-08-10, L4) : ce qui se lit comme un bord net n'est PAS la fenêtre de
 *    coupure de three. Sur un brasero (rayon 4, mpt 2, palier nuit), le gradient de luminance culmine
 *    à 0,2016/m à 0,70 m du foyer et tombe à 0,0022/m au rayon — la coupure `pow4`, étant élevée au
 *    carré, arrive à dérivée NULLE. Le même profil calculé SANS elle garde un gradient max de
 *    0,2009/m au même endroit (−0,3 %) : le bord vient du `dotNL` d'une flamme à `FLAME_LIFT_M` = 1 m,
 *    dont le cœur clair n'a que 1,72 m de demi-largeur (3,09 m à 2 m de lift). Un exposant en donnée
 *    du ton n'y changerait donc rien — et serait de toute façon hors d'atteinte : le `pow4` est écrit
 *    dans le chunk `getDistanceAttenuation` de three, pas ici. Adoucir demande de rouvrir la HAUTEUR
 *    de flamme (calage L1 du profil de flaque), pas d'ajouter un champ.
 */
import * as THREE from 'three';
import { findLightLevelById, findLightToneById, DEFAULT_LIGHT_TONE_ID, type LightToneDef } from '../../data';
import { heightAt, type Scene } from '../../state/scene';
import type { LightSource } from '../../state/vision';
import { ambianceLuminance } from '../catalog/ambiance';
import { LIGHT_COLOR } from '../backends/webgl/sceneMeshes';

/** Nombre de lampes ponctuelles montées EN PERMANENCE. Budget mesuré sur la population réelle : 3
 *  sources sur le terrain d'entraînement, ≤ 12 sur le hub de l'arène (#1245). Au-delà, ce sont les
 *  sources POSÉES qui passent (cf. `pointLightWrites`). */
export const POINT_LIGHT_BUDGET = 12;

/** Hauteur (m) par DÉFAUT d'une flamme au-dessus du sol de sa case — le foyer d'un émetteur qui n'a
 *  AUCUNE primitive déclarée : un billboard (dont le dessin n'a pas de volume monde où pointer) ou une
 *  lampe PORTÉE (dont le foyer est une main, pas une recette). Un décor VOLUMIQUE, lui, déclare sa
 *  primitive émettrice (`PropPrimitive.emet`) et sa source est posée à SON centre (`LightSource.foyer`,
 *  `state/vision.ts`) : ce sont deux valeurs d'UN paramètre, pas deux régimes. Apparence, aucune règle. */
export const FLAME_LIFT_M = 1;

/** Luminance VISÉE au foyer d'UNE flaque au palier `nuit` (part d'albédo, `ambianceLum` comprise). En
 *  dessous de 1 par CONSTRUCTION : three ADDITIONNE les contributions et ce canevas n'a aucun tone
 *  mapping — deux flaques qui se chevauchent, sinon, écrêtent en aplat blanc. La marge laissée est ce
 *  qu'une seconde flaque peut ajouter au même point sans saturer. */
export const FOYER_NUIT_CIBLE = 0.85;

/** Luminance du palier `nuit` — le plancher que les flaques COMPLÈTENT (`stageLights.ts` :
 *  `ambianceLuminance` du scalaire de `lightLevels.json`), lu en donnée et jamais recopié. */
const AMBIANCE_NUIT = ambianceLuminance(findLightLevelById('nuit')!.scalar);

/** Part d'albédo qu'une flaque rend à son foyer AVANT extinction par l'ambiance (l'intensité écrite
 *  vaut `FLAME_INTENSITY × π × extinction` : le facteur `π` est la conversion du lambertien de three,
 *  `BRDF_Lambert` portant le `RECIPROCAL_PI` — la même qu'à l'ambiante de `stageLights.ts`).
 *
 *  CALÉE, pas choisie : au foyer d'une source (`flaquePart` y culmine à ~1), la luminance du sol vaut
 *  `ambianceLum + FLAME_INTENSITY × (1 − ambianceLum)`, qu'on veut à `FOYER_NUIT_CIBLE` au palier
 *  `nuit`. MESURE (`stage-flaques.test.tsx`, profil épinglé) : 0,7769 → foyer de nuit 0,8497 sur un
 *  plancher d'ambiance de 0,3276 ; foyer le plus haut des cinq paliers 0,9542 (`couvert`) ; point le
 *  plus clair des scènes livrées 0,9592 (arène zone 4, l'aplomb d'un brasero dans la flaque de son
 *  voisin) — aucun recouvrement écrêté. */
export const FLAME_INTENSITY = (FOYER_NUIT_CIBLE - AMBIANCE_NUIT) / (1 - AMBIANCE_NUIT);

/** Part d'albédo qu'une flaque rend à une surface horizontale située `dM` mètres à l'horizontale de
 *  l'aplomb de sa flamme et `liftM` mètres SOUS elle, pour une portée `distanceM` et une extinction
 *  donnée. DÉFINITION UNIQUE — celle des chunks de three, mesurés (`stage-flaques.test.tsx`) :
 *  `dotNL` (la surface regarde en l'air, la flamme est `liftM` plus haut) × la fenêtre de coupure
 *  `pow2(saturate(1 − pow4(L/D)))`, avec `L` la distance RÉELLE à la flamme. C'est par elle que le
 *  profil d'une flaque se mesure, jamais à vue.
 *
 *  `liftM` vaut `FLAME_LIFT_M` par défaut : le sol de la case de la source, le cas du monde. Une
 *  flamme au NIVEAU de la surface (`liftM` nul) ou EN DESSOUS (négatif) ne lui rend rien — `dotNL`
 *  est saturé à 0 dans three comme ici, et c'est pourquoi le sol d'un étage au-dessus d'une torche
 *  reste noir. */
export function flaquePart(dM: number, distanceM: number, extinction: number, liftM: number = FLAME_LIFT_M): number {
  if (distanceM <= 0) return 0;
  const L = Math.hypot(dM, liftM);
  if (L <= 0) return 0;
  const dotNL = Math.max(0, liftM) / L;
  const coupure = Math.min(1, Math.max(0, 1 - Math.pow(L / distanceM, 4)));
  return FLAME_INTENSITY * extinction * dotNL * coupure * coupure;
}

/** Luminance du sol sous une flaque : le palier d'ambiance PLUS ce que la flaque y ajoute — la somme
 *  que three fait réellement (contributions ADDITIVES, aucun tone mapping). */
export function flaqueLuminance(ambianceLum: number, dM: number, distanceM: number): number {
  return ambianceLum + flaquePart(dM, distanceM, extinctionDe(ambianceLum));
}

/** Ce qu'il reste à allumer sous le palier d'ambiance : 1 en ténèbres, 0 en plein jour. */
export function extinctionDe(ambianceLum: number): number {
  return Math.min(1, Math.max(0, 1 - ambianceLum));
}

/** Une lampe TELLE QU'ELLE ÉCLAIRE à l'instant de la frame — la surface exacte que `THREE.PointLight`
 *  offre, et rien de plus : c'est la lampe MONTÉE qu'on interroge (donc déjà glissée avec son porteur,
 *  `stage/boardPose.ts`), jamais la table qui l'a écrite. */
export interface LitLamp {
  position: { x: number; y: number; z: number };
  intensity: number;
  distance: number;
}

/**
 * EXPOSITION d'un BILLBOARD (#1245, L3) — ce qui remplace l'exposition GLOBALE de la frame sur un quad
 * de personnage. Un billboard n'a pas de normale exploitable (`billboardMaterial`, `boardPose.ts`) :
 * aucune lampe ponctuelle ne l'atteint par le chemin lambertien de three, si bien qu'un héros au pied
 * d'un brasero restait exactement aussi clair qu'à vingt mètres — le sol s'allumait, les personnages non.
 *
 * La flaque qu'un personnage reçoit est celle de SA CASE, par la MÊME définition que le sol
 * (`flaquePart`, la loi mesurée sur les chunks de three), et non le dégradé linéaire du champ mécanique
 * (`state/vision.ts` `falloff`) : deux lois donneraient deux flaques à l'écran, et un héros au bord
 * serait plus clair que la case sous ses pieds. Elle S'AJOUTE à l'exposition de la frame exactement
 * comme elle s'ajoute au palier d'ambiance pour le sol (`flaqueLuminance`) — three additionne les
 * contributions. Le plafond à 1 est celui de l'écran : au-delà, le rendu du sol écrête lui aussi.
 *
 * La distance à la lampe est celle des TROIS axes : l'ancre est aux PIEDS du sujet, donc à la hauteur
 * du sol de sa case, et la flamme est `liftM = lampe.y − ancre.y` au-dessus d'elle — exactement
 * `FLAME_LIFT_M` quand les deux partagent l'étage. Un sujet posté AU-DESSUS de la flamme reçoit ce
 * que reçoit le sol sur lequel il se tient : rien (`dotNL` saturé à 0).
 *
 * L'extinction de la frame se RELIT sur la lampe (`intensity / (FLAME_INTENSITY × π)`) : la lampe montée
 * est la seule vérité de ce qui éclaire, et une lampe éteinte (intensité 0) ne contribue à rien.
 *
 * RÉSIDUS CONSIGNÉS (mêmes classes que l'ombre portée du billboard) :
 *  - la lumière reçue est OMNIDIRECTIONNELLE — le quad n'a pas de côté, un personnage éclairé de dos
 *    l'est comme de face ;
 *  - la flaque est prise à l'ANCRE, donc au pied : la tête d'un sujet reçoit ce que reçoivent ses
 *    bottes, un quad ne se dégrade pas sur sa hauteur ;
 *  - les flaques ne sont pas coupées par les murs (l'écart de l'en-tête, ici aussi).
 */
export function billboardExposure(
  anchor: { x: number; y: number; z: number },
  lamps: readonly LitLamp[],
  surfaceLuminance: number,
): number {
  let part = 0;
  for (const l of lamps) {
    if (l.intensity <= 0 || l.distance <= 0) continue;
    const dM = Math.hypot(anchor.x - l.position.x, anchor.z - l.position.z);
    part += flaquePart(dM, l.distance, l.intensity / (FLAME_INTENSITY * Math.PI), l.position.y - anchor.y);
  }
  return Math.min(1, surfaceLuminance + part);
}

/**
 * TON d'une source (#1245, L4) — l'APPARENCE en donnée (`src/data/lightTones.json`), résolue ICI et
 * nulle part ailleurs : c'est le BORD du rendu. Le moteur ne connaît d'une source que son rayon
 * (LDB 74) ; un ton ne change aucun champ de lumière, aucune visibilité, aucun jet.
 *
 * `tone` absent = `flamme` : une source de feu — le cas du monde — n'a AUCUNE donnée à porter.
 * Un id hors catalogue retombe sur le défaut et se signale UNE fois (même politique que
 * `weaponFromId` : lookup exact, warn hors catalogue — jamais un repli muet).
 */
const TONS_INCONNUS = new Set<string>();
export function resolveTone(id: string | undefined): LightToneDef {
  const défaut = findLightToneById(DEFAULT_LIGHT_TONE_ID)!;
  if (!id) return défaut;
  const ton = findLightToneById(id);
  if (ton) return ton;
  if (!TONS_INCONNUS.has(id)) {
    TONS_INCONNUS.add(id);
    console.warn(`stagePointLights: ton de lumière « ${id} » hors catalogue (lightTones.json) — ${DEFAULT_LIGHT_TONE_ID} servi.`);
  }
  return défaut;
}

/** Couleur d'un ton en entier three (`#rrggbb` → 0xrrggbb) — la forme que `Color.setHex` attend. */
export const toneHex = (ton: LightToneDef): number => parseInt(ton.color.slice(1), 16);

/** Nombre d'or : le rapport des DEUX fréquences du bruit de vacillement. Irrationnel, donc la somme
 *  des deux sinus ne se répète jamais à l'œil — un seul sinus donnerait un clignotant de phare. */
const PHI = 1.618033988749895;

/** Hachage FNV-1a 32 bits d'un id de source : la GRAINE du vacillement. Deux braséros voisins
 *  vacillent donc en désordre, et CHACUN reproduit la même série d'une session à l'autre. */
function graine(srcId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < srcId.length; i++) {
    h ^= srcId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * VACILLEMENT (#1245, L4) — le facteur par lequel l'intensité d'une lampe est multipliée à l'instant
 * `tSec`, pour une source `srcId`. DÉTERMINISTE par construction : deux sinus de fréquences
 * incommensurables (`hz` et `hz × PHI`), déphasés par le hachage de l'id — aucun `Math.random`, donc
 * la même seconde de jeu rend deux fois la même image, et deux clients d'une partie coop voient le
 * MÊME feu.
 *
 * BORNÉ PAR LE HAUT À 1, et c'est structurel : le facteur RETRANCHE (`1 − amplitude × bruit`, bruit
 * dans [0,1]). Une flamme ne dépasse donc JAMAIS le calage anti-saturation `FLAME_INTENSITY` — sans
 * quoi le vacillement écrêterait en aplat blanc exactement ce que ce calage existe pour éviter.
 * Plancher : `1 − amplitude`, soit ≥ 0,5 par la borne du schéma.
 */
export function flickerFactor(srcId: string, tSec: number, flicker?: { amplitude: number; hz: number }): number {
  if (!flicker || flicker.amplitude <= 0) return 1;
  const h = graine(srcId);
  const φ1 = (h & 0xffff) / 0x10000;
  const φ2 = (h >>> 16) / 0x10000;
  const bruit = (2 + Math.sin(2 * Math.PI * (flicker.hz * tSec + φ1)) + Math.sin(2 * Math.PI * (flicker.hz * PHI * tSec + φ2))) / 4;
  return 1 - flicker.amplitude * bruit;
}

/** Ce qu'une frame écrit sur UNE lampe du pool — la décision, avant tout objet three. */
export interface PointLightWrite {
  /** Porteur de la source (`LightSource.srcId`) : la couture par laquelle une lampe suivra son sujet. */
  srcId?: string;
  /** Position MONDE (mètres, repère three : x = colonne, y = hauteur, z = ligne). */
  x: number;
  y: number;
  z: number;
  /** Intensité three AU REPOS (0 = éteinte) — le calage anti-saturation multiplié par la part
   *  d'intensité du TON. Le vacillement de l'instant s'y applique dans la boucle (`applyFlicker`),
   *  jamais ici : cette table vit une passe entière, la flamme bat à la frame. */
  intensity: number;
  /** Portée : `radiusTiles × mpt` — la flaque s'annule au rayon RAW de la source. */
  distance: number;
  /** Couleur du TON (0xrrggbb) — l'apparence, en donnée. */
  color: number;
  /** Vacillement du TON, quand il en a un. Absent = lampe STABLE (lanterne, lueur magique). */
  flicker?: { amplitude: number; hz: number };
}

/** Le POOL, monté une fois pour toutes. Toutes les lampes naissent éteintes (`intensity` 0) et
 *  VISIBLES : c'est l'intensité qui les allume, jamais leur présence. */
export function createPointLightPool(budget: number = POINT_LIGHT_BUDGET): THREE.PointLight[] {
  const pool: THREE.PointLight[] = [];
  for (let i = 0; i < budget; i++) {
    const lampe = new THREE.PointLight(LIGHT_COLOR, 0, 0, 0);
    // Une ombre par lampe ponctuelle = une carte cubique de plus à cuire par frame, et un second
    // compte dans la clé de programme (`numPointLightShadows`). Le monde a déjà celle du soleil.
    lampe.castShadow = false;
    pool.push(lampe);
  }
  return pool;
}

/** Ce que la frame écrit sur le POOL, INDEX PAR INDEX : `slots[i]` va sur `pool[i]`, `null` = lampe
 *  éteinte. La longueur vaut toujours le budget — c'est la table d'occupation, pas une liste. */
export type PointLightSlots = readonly (PointLightWrite | null)[];

/** Clé de SLOT d'une source : son porteur. Une source sans porteur nommé (`LightSource.srcId` absent)
 *  retombe sur une clé commune — elle garde alors son slot tant qu'elle est seule de son espèce. */
const SANS_PORTEUR = '(sans porteur)';
const cléDe = (s: { srcId?: string }): string => s.srcId ?? SANS_PORTEUR;

/**
 * DÉCISION d'une frame : ce que chaque source de lumière de la scène écrit sur une lampe du pool.
 * `ambianceLum` = la luminance du palier (`stageLights` : le complément du voile de nuit de la voie
 * affine) — l'intensité la COMPLÈTE, si bien qu'à midi (`ambianceLum` 1) les flaques s'éteignent d'
 * elles-mêmes, sans porte par nom : une lampe à pleine intensité sous le soleil ne serait pas
 * invisible, elle ferait une tache BLANCHE (aucun tone mapping sur ce canevas).
 *
 * SLOT STABLE. Une source garde SON index de lampe tant qu'elle vit (`prev` = la table de la frame
 * précédente, relue par porteur) : sans cela, l'ordre des sources décide du slot, et une lampe saute
 * de sujet en sujet dès qu'une source apparaît ou meurt — ce qui, au glissement de la marche
 * (lot L2), fait sauter la flaque elle-même. Une source qui meurt LIBÈRE son slot sans déplacer les
 * autres ; une nouvelle prend le premier slot libre.
 *
 * BUDGET SATURÉ : les sources POSÉES passent d'abord (le décor de la scène : brasero, torche murale),
 * les PORTÉES remplissent le reste. Trier par rayon éteindrait les braséros d'une salle à l'arrivée
 * d'un groupe à lanternes (rayon 10 > rayon 4) — le décor ne clignote pas parce qu'on entre.
 */
export function pointLightWrites(
  sources: readonly LightSource[],
  opts: { scene: Scene; mpt: number; ambianceLum: number; budget?: number; prev?: PointLightSlots },
): PointLightSlots {
  const budget = opts.budget ?? POINT_LIGHT_BUDGET;
  const extinction = extinctionDe(opts.ambianceLum);
  const slotPrécédent = new Map<string, number>();
  opts.prev?.forEach((w, i) => { if (w && i < budget) slotPrécédent.set(cléDe(w), i); });

  const slots: (PointLightWrite | null)[] = new Array(budget).fill(null);
  const àPlacer: PointLightWrite[] = [];
  const posées = sources.filter((s) => !s.carried);
  const portées = sources.filter((s) => s.carried);
  for (const s of [...posées, ...portées].slice(0, budget)) {
    const z = s.z ?? 0;
    // Le TON MODULE le calage, il ne le remplace pas : `intensity` du ton est un facteur ≤ 1 de
    // `FLAME_INTENSITY` — une lanterne est plus pâle qu'un feu, aucune source n'est plus forte que
    // ce que la marge anti-saturation autorise.
    const ton = resolveTone(s.tone);
    // FOYER : le décor volumique qui déclare sa primitive émettrice pose sa lampe à SON centre — même
    // repère et même échelle que la géométrie cuite (`x`/`y` en cases × `mpt`, `h` en mètres au-dessus
    // du sol de la case, cf. `backends/webgl/worldTris:gpToWorld` et `builders/propVolumes`). Sans
    // foyer, la hauteur par défaut à l'aplomb de la case.
    const w: PointLightWrite = {
      srcId: s.srcId,
      x: (s.pos.x + (s.foyer?.x ?? 0)) * opts.mpt,
      y: heightAt(opts.scene, s.pos.x, s.pos.y, z) + (s.foyer?.h ?? FLAME_LIFT_M),
      z: (s.pos.y + (s.foyer?.y ?? 0)) * opts.mpt,
      intensity: FLAME_INTENSITY * Math.PI * extinction * ton.intensity,
      distance: s.radiusTiles * opts.mpt,
      color: toneHex(ton),
      flicker: ton.flicker,
    };
    const tenu = slotPrécédent.get(cléDe(w));
    if (tenu !== undefined && slots[tenu] === null) slots[tenu] = w;
    else àPlacer.push(w);
  }
  let libre = 0;
  for (const w of àPlacer) {
    while (libre < budget && slots[libre] !== null) libre++;
    if (libre >= budget) break;
    slots[libre] = w;
  }
  return slots;
}

/** Applique la table au POOL, index par index : `null` éteint la lampe. Ni ajout, ni retrait, ni
 *  `visible` — le compte monté ne bouge pas d'un cran (cf. l'en-tête). L'intensité posée est celle
 *  du REPOS ; la frame la fait battre par `applyFlicker`. */
export function applyPointLights(pool: readonly THREE.PointLight[], slots: PointLightSlots): void {
  for (let i = 0; i < pool.length; i++) {
    const lampe = pool[i];
    const w = slots[i];
    if (!w) {
      lampe.intensity = 0;
      continue;
    }
    lampe.position.set(w.x, w.y, w.z);
    lampe.distance = w.distance;
    lampe.intensity = w.intensity;
    lampe.color.setHex(w.color);
  }
}

/**
 * VACILLEMENT de la frame (#1245, L4) : l'intensité de l'instant, écrite sur les lampes MONTÉES. À
 * appeler dans la boucle de dessin, AVANT la passe de pose — l'exposition d'un billboard relit la
 * lampe (`billboardExposure`), si bien que le personnage au pied du braséro bat avec lui SANS second
 * calcul : une seule vérité de l'intensité de l'instant, celle que three va rendre.
 *
 * Une lampe ÉTEINTE ou sans `flicker` n'est pas même touchée — pas une écriture, donc pas une frame
 * de travail : la lanterne et la lueur magique ne bougent pas d'un cran, et de jour, quand toutes les
 * flaques sont retombées à 0, cette passe ne fait plus rien du tout.
 */
export function applyFlicker(pool: readonly THREE.PointLight[], slots: PointLightSlots, tSec: number): void {
  for (let i = 0; i < pool.length; i++) {
    const w = slots[i];
    if (!w?.flicker || w.intensity <= 0) continue;
    pool[i].intensity = w.intensity * flickerFactor(cléDe(w), tSec, w.flicker);
  }
}

/** Y a-t-il, dans cette table, au moins UNE lampe allumée qui vacille ? C'est la seule condition qui
 *  justifie une boucle de rendu permanente : sans flamme à l'écran, la frame ne se rejoue qu'aux
 *  rendus du stage, comme avant ce lot. */
export function hasFlicker(slots: PointLightSlots): boolean {
  return slots.some((w) => !!w?.flicker && w.intensity > 0);
}
