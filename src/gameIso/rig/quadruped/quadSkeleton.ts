/**
 * Squelette du gabarit QUADRUPÈDE (cheval/loup/sanglier/chien/rat géant/ours).
 * Profil tourné à DROITE, boîte 120×150, pieds au sol (y≈150). Le miroir gauche et le
 * facing sont gérés au rendu. Réutilise la FK générique (kinematics.worldTransformsG).
 */
import { worldTransformsG, type FKBone } from '../kinematics';
import type { StoredPalette } from '../palette';
import type { View } from '../facing';
import { QUAD_Z } from './quadZ';
import type { QuadHeadId } from './heads/_registry.generated';
import type { QuadTailId } from './tails/_registry.generated';
import type { QuadManeId } from './manes/_registry.generated';

export type QuadBoneId =
  | 'tronc' | 'croupe' | 'encolure' | 'tete' | 'nuque' | 'queue'
  | 'aileD' | 'aileG' // gabarit AILÉ : paire d'ailes (membrane/plumes) sur le garrot
  | 'hautAvD' | 'basAvD' | 'piedAvD' | 'hautAvG' | 'basAvG' | 'piedAvG'
  | 'hautArD' | 'basArD' | 'piedArD' | 'hautArG' | 'basArG' | 'piedArG';

export interface QBone extends FKBone {
  length: number;
  thickness: number;
  z: number;
  /** Os de MEMBRE porteur (segment haut/bas d'une patte) : son épaisseur est mise à l'échelle du
   *  gabarit (bête trapue = pattes plus épaisses). Le pied, lui, garde sa largeur d'art. */
  limb?: boolean;
  /** Os de CORPS : prend la CARRURE de l'espèce (`QuadProps.girth`) en profondeur. */
  girth?: boolean;
}
export type QuadSkeleton = Record<QuadBoneId, QBone>;
export type QuadPose = Partial<Record<QuadBoneId, number>>;

/**
 * Fragment de DÉCOR posé sur un os : son `plan` est RELATIF au plan de l'os porteur (`QUAD_Z`),
 * borné à ±`QUAD_DECO_PLAN_MAX` — un fragment ne quitte jamais le voisinage de son os. `plan`
 * absent = calque apposé PAR-DESSUS l'art de l'os (le comportement du canal avant #1082 Lot 2,
 * compté par le stock gelé `DECOS_SANS_PLAN_GELES`). Un couple (os, vue) peut porter N fragments
 * de plans différents : la sangle qui fait le tour (un pan devant, un derrière), les cornes du
 * bœuf de dos (derrière le crâne) et son mufle (devant).
 */
export interface QuadDecoFragment { svg: string; plan?: number }
/** Décor d'un couple (os, vue) : SVG nu (sans plan déclaré) ou fragments à plans déclarés. */
export type QuadDecoValue = string | QuadDecoFragment[];

/** Caractère d'une espèce quadrupède (proportions + parts + couleurs par défaut). */
export type QuadBuild = 'equine' | 'canine' | 'suid' | 'rodent' | 'ursine' | 'feline' | 'draconic' | 'batracien' | 'bovin';
/** Tête = id du REGISTRE des defs (`heads/defs/<clé>.ts`, union générée) — le socle ne peut plus
 *  écrire `p.head === 'hydre'` : une tête N+1 est un fichier, jamais une branche (#1082 P2). */
export type QuadHead = QuadHeadId;
export type QuadFoot = 'sabot' | 'patte' | 'serre'; // serre = serres d'aigle (rapace)
/** Queue = id du REGISTRE des defs (`tails/defs/<clé>.ts`, union générée). */
export type QuadTail = QuadTailId;
/** Crinière = id du REGISTRE des defs (`manes/defs/<clé>.ts`, union générée) : crin couché (équin),
 *  hirsute (fourrure dressée — loup/sanglier), sans. */
export type QuadMane = QuadManeId;
export interface QuadProps {
  sl: number; // échelle globale (taille)
  build: QuadBuild; // SILHOUETTE du corps (équin level / canin svelte / suidé bossu / rongeur arqué / ursin massif / félin / draconique)
  girth: number; // carrure : profondeur/épaisseur du corps (×, vertical)
  bodyLen: number; // allongement du tronc/croupe
  neckLen: number; // longueur d'encolure
  /** Inclinaison de l'encolure (deg). 0 = encolure VERTICALE, gorge à l'aplomb du garrot ; NÉGATIF
   *  = encolure tendue vers l'AVANT et vers le BAS. Mesuré sur le bœuf au repos, en profil (points
   *  d'interface portés au monde) : garrot (85,1 · 77,5) fixe ; 0 → gorge (85,1 · 64,9) ;
   *  −40 → (93,2 · 67,9) ; −70 → (97,0 · 73,2). */
  neckAngle: number;
  legLen: number; // longueur des membres (hauteur sur pattes)
  head: QuadHead;
  tail: QuadTail;
  ears: 'courtes' | 'pointues' | 'rondes';
  foot: QuadFoot; // pied ARRIÈRE (et avant par défaut)
  frontFoot?: QuadFoot; // pied AVANT distinct (griffon : serres devant / pattes derrière)
  wings?: 'plumes' | 'membrane'; // gabarit AILÉ : ailes emplumées (rapace/pégase) ou membraneuses (dragon)
  wingSpan?: number; // envergure (× sur l'art des ailes, défaut 1 — dragon ample, demigriffon court)
  wingPose?: 'dressees' | 'deployees'; // ailes REPLIÉES portées DRESSÉES à demi-ouvertes (manticore) ; 'deployees' (membrane seulement) = PAIRE demi-ouverte lisible : panneaux pâles entre les doigts, aile lointaine basculée vers la queue montrant son envers clair (dragon, artwork LDB p.321) — défaut : couchées le long du dos
  wingLift?: number; // degrés de redressement SUPPLÉMENTAIRE des ailes pliées 'dressees' en plumes (+ = plus vertical ; défaut 0 — pégase, artwork LDB p.325)
  mane: QuadMane; // crinière d'encolure
  ridge?: 'epines' | 'epines-continues' | 'crete' | 'plaques' | 'sans'; // dorsale (défaut : 'epines' si draconic, sinon 'sans') — 'epines-continues' = rangée SERRÉE garrot→croupe (basilic)
  markings?: 'taches' | 'rayures' | 'balzanes' | 'sans'; // robe : taches/rayures de flanc, balzanes aux membres
  headgear?: 'bois' | 'cornes'; // coiffe de crâne : bois ramifiés (cerf) ou cornes courbées — défaut aucun
  /** Avant-train CONTRASTÉ de rapace (hippogriffe : moitié aigle / moitié cheval). Peint le
   *  manteau emplumé de poitrail/épaule et le haut des ANTÉRIEURS avec la famille d'AILE
   *  (@aile* — la moitié rapace est d'un seul plumage, cf. base custom `aile` ci-dessous), et
   *  les tarses/serres AVANT avec la famille custom `cuirAv`. Absent = robe unie (griffon). */
  foreCoat?: 'plumes';
  headScale?: number; // × sur l'art de tête (défaut 1)
  /** Tangage ADDITIF de l'os tête en PROFIL (deg, négatif = museau levé). Par défaut l'os tête
   *  compense neckAngle (rotation monde constante +10) → museau à l'horizontale quel que soit le
   *  port d'encolure ; un port de tête expressif (brame du grand cerf) le décale. Face/dos
   *  inchangés (quadSkeletonForView y force l'angle à 0). */
  headPitch?: number;
  tailLen?: number; // × sur l'art de queue (défaut 1)
  /** La crête du dos se PROLONGE sur la queue jusqu'à la pointe (hydre). Propriété de la BÊTE : la
   *  def de QUEUE la lit, aucune def de tête ne la décide. L'autre porte de la continuité est la
   *  dorsale `ridge: 'epines-continues'` (basilic), lue au même endroit. */
  tailCrest?: true;
  /** Décor PAR-OS propre à la créature (harnais doré du pégase — précédent : épave du crabe,
   *  `CrabProps.deco`) : SVG dans le repère de l'ART de l'os pour la vue (`quadAnchor`), posé en
   *  CALQUE sur cet os, uniquement là où l'os porte déjà un art dans la vue courante. L'ancre porte
   *  `headScale`, `tailLen`, `wingSpan`, l'agrandissement de tête en profil et le miroir de l'aile
   *  gauche vue de bout. `bodyLen`/`neckLen` restent CUITS dans les coordonnées de l'art de tronc
   *  et d'encolure (`barrel`/`neck`, quadParts.ts) : un décor de ces deux os s'authore à leurs
   *  valeurs d'espèce. Jetons de palette admis.
   *  Clé suffixée `#vue` = décor limité à cette vue (gueule de brame du grand cerf, dessinée
   *  pour la tête de PROFIL seulement) ; clé nue = toutes les vues où l'os a un art.
   *  Valeur = SVG nu (calque apposé PAR-DESSUS l'art de l'os) ou liste de FRAGMENTS déclarant
   *  chacun son `plan` (cf. `QuadDecoFragment`).
   *  VUE DE DOS, décor de TÊTE : l'art de tête y est scindé entre `tete` (crâne, au-dessus du
   *  tronc) et `nuque` (raccord, dessous), qui PARTAGENT le même repère (`quadAnchor`). La part
   *  d'un décor qui descend sous la ligne de coupe se déclare donc sur `nuque#back`, aux mêmes
   *  coordonnées — sur `tete#back` elle resterait entière au plan du crâne. */
  deco?: Partial<Record<QuadBoneId | `${QuadBoneId}#${'profile' | 'front' | 'back'}`, QuadDecoValue>>;
  /** Posture de REPOS propre à la créature en PROFIL (deltas additifs d'angle par os, même
   *  vocabulaire que QuadPose) : port habituel qui s'ajoute SOUS toute pose d'anim (lion de
   *  Chrace tapi prêt à bondir). Ignorée de face/dos (quadSkeletonForView y refige les angles). */
  stance?: QuadPose;
  /** Robe/pelage par défaut (corps/cheveux/cuir…). Base custom `aile` = teinte PROPRE des ailes
   *  (@aile/@aileO/@aileH — pégase : ailes brun/doré sur robe blanche) ; absente, les ailes
   *  suivent la famille `corps` (cf. resolveQuadFromProps). */
  stored: StoredPalette;
}

// La DATA des espèces (props + alias) vit dans `creatures/defs/<Nom>.ts` (un fichier
// par créature, auto-collectés). `quadSkeleton` ne garde que les TYPES + la mécanique de rendu.
// On RE-EXPORTE les tables dérivées pour que les consommateurs existants ne changent pas.
export { QUAD_SPECIES, quadSpeciesNames } from '../creatures';

/** Construit le squelette d'une espèce (profil tourné à droite, pieds ~y150). */
export function buildQuadSkeleton(p: QuadProps): QuadSkeleton {
  const bl = p.bodyLen, ll = p.legLen;
  const leg = (
    haut: QuadBoneId, bas: QuadBoneId, pied: QuadBoneId,
    parent: QuadBoneId, px: number, py: number, far: boolean, rear = false,
  ): Partial<QuadSkeleton> => {
    // ARRIÈRE-main angulée (cuisse portée en avant, JARRET cassé en arrière, canon qui revient
    // d'aplomb) — 4 pattes verticales parallèles = silhouette « table ». L'avant reste ~d'aplomb.
    const aHaut = rear ? (far ? -4 : -7) : far ? 3 : -1;
    const aBas = rear ? (far ? 13 : 16) : far ? 6 : 8;
    const aPied = rear ? -9 : far ? -5 : -7;
    return {
      [haut]: { parent, pivot: { x: px, y: py }, angle: aHaut, length: 30 * ll, thickness: 9, z: QUAD_Z[haut].profile, limb: true },
      [bas]: { parent: haut, pivot: { x: 0, y: 30 * ll }, angle: aBas, length: 22 * ll, thickness: 7, z: QUAD_Z[bas].profile, limb: true }, // pli de genou/jarret
      [pied]: { parent: bas, pivot: { x: 0, y: 22 * ll }, angle: aPied, length: 9, thickness: 7, z: QUAD_Z[pied].profile }, // sabot ramené à la verticale
    } as Partial<QuadSkeleton>;
  };
  const sk: Partial<QuadSkeleton> = {
    tronc: { parent: null, pivot: { x: 56, y: 82 }, angle: 0, length: 0, thickness: 26, z: QUAD_Z.tronc.profile, girth: true },
    croupe: { parent: 'tronc', pivot: { x: -28 * bl, y: -2 }, angle: 0, length: 0, thickness: 26, z: QUAD_Z.croupe.profile, girth: true },
    // Encolure penchée en AVANT (tête devant le poitrail, pas au-dessus = « fusionnée »).
    // neckAngle est stocké négatif (héritage) → on le négocie en avant via -neckAngle.
    encolure: { parent: 'tronc', pivot: { x: 28 * bl, y: -12 }, angle: -p.neckAngle, length: 30 * p.neckLen, thickness: 14, z: QUAD_Z.encolure.profile },
    tete: { parent: 'encolure', pivot: { x: 0, y: -30 * p.neckLen }, angle: 10 + p.neckAngle + (p.headPitch ?? 0), length: 18, thickness: 14, z: QUAD_Z.tete.profile },
    // `nuque` : os PORTÉ par la tête (même repère, pivot nul) qui reçoit le calque BAS de l'art de
    // tête — il n'existe que pour porter son propre plan de profondeur (cf. QUAD_Z.nuque).
    nuque: { parent: 'tete', pivot: { x: 0, y: 0 }, angle: 0, length: 0, thickness: 0, z: QUAD_Z.nuque.profile },
    queue: { parent: 'croupe', pivot: { x: -16, y: -6 }, angle: 42, length: 26, thickness: 6, z: QUAD_Z.queue.profile },
    ...leg('hautAvG', 'basAvG', 'piedAvG', 'tronc', 24 * bl + 6, 8, true),
    ...leg('hautArG', 'basArG', 'piedArG', 'croupe', -6 * bl + 6, 8, true, true),
    ...leg('hautAvD', 'basAvD', 'piedAvD', 'tronc', 24 * bl, 10, false),
    ...leg('hautArD', 'basArD', 'piedArD', 'croupe', -6 * bl, 10, false, true),
  };
  // Ailes (gabarit AILÉ) : attachées au garrot (haut-avant du tronc). aileD = aile PROCHE
  // (par-dessus le flanc), aileG = aile LOINTAINE (derrière le corps) — plans dans `QUAD_Z`. L'art
  // est dessiné librement dans le repère de l'os (comme la queue). Length/thickness 0 = os
  // d'attache (pas de FK de longueur). Angle de repos = aile à demi-repliée dressée vers l'arrière.
  if (p.wings) {
    sk.aileD = { parent: 'tronc', pivot: { x: 12 * bl, y: -15 }, angle: 0, length: 0, thickness: 0, z: QUAD_Z.aileD.profile };
    sk.aileG = { parent: 'tronc', pivot: { x: 9 * bl, y: -16 }, angle: 0, length: 0, thickness: 0, z: QUAD_Z.aileG.profile };
  }
  return sk as QuadSkeleton;
}

/**
 * Adapte le squelette à la VUE. Profil = tel quel (riche). Face/dos = corps vu de BOUT :
 * le tronc devient le hub central (poitrail en face / croupe de dos), les 4 pattes
 * straddlent l'axe (gauche/droite) et passent DERRIÈRE le corps (pieds dépassent en bas),
 * l'encolure se réduit en colonne verticale, la queue (dos) pend au centre. → vrai 8-dir.
 */
export function quadSkeletonForView(sk: QuadSkeleton, view: View): QuadSkeleton {
  if (view === 'profile') return sk;
  const front = view === 'front';
  const out = { ...sk } as QuadSkeleton;
  const neckL = sk.encolure.length * 0.26;
  out.croupe = { ...sk.croupe, pivot: { x: -2, y: -2 }, angle: 0, z: QUAD_Z.croupe[view] };
  // Encolure VERTICALE par le PIVOT (pas par rotation) : angle 0 → la tête monte droit au-
  // dessus du tronc ET reste à l'endroit (face au spectateur). Une rotation -90 ici déportait
  // la tête à gauche ET la faisait pivoter (« deux yeux empilés, museau à gauche »).
  out.encolure = { ...sk.encolure, pivot: { x: 0, y: -18 }, length: neckL, angle: 0, z: QUAD_Z.encolure[view] };
  out.tete = { ...sk.tete, pivot: { x: 0, y: -neckL - 4 }, angle: 0, z: QUAD_Z.tete[view] };
  out.nuque = { ...sk.nuque, angle: 0, z: QUAD_Z.nuque[view] };
  out.queue = { ...sk.queue, pivot: { x: 0, y: -6 }, angle: front ? 60 : 4, z: QUAD_Z.queue[view] };
  // pattes : straddle ±, segments droits, derrière le corps (la paire la plus proche de
  // l'œil selon la vue est devant : avant en face / arrière de dos).
  const set = (id: QuadBoneId, x: number) => {
    out[id] = { ...sk[id], pivot: { x, y: sk[id].pivot.y }, angle: 0, z: QUAD_Z[id][view] };
  };
  // La paire face à l'œil (avant en face / arrière de dos) est devant et SOUS le corps (les
  // antérieurs émergent du bréchet, pas écartés en tréteau) ; l'autre paire est resserrée et
  // derrière (profondeur) → on lit bien 4 pattes d'aplomb, pas 2 fusionnées ni un chevalet.
  // Écartements par vue ici ; plans de profondeur dans `QUAD_Z`.
  const wNear = 10, wFar = 4;
  set('hautAvD', front ? wNear : wFar); set('hautAvG', front ? -wNear : -wFar);
  set('hautArD', front ? wFar : wNear); set('hautArG', front ? -wFar : -wNear);
  for (const id of ['basAvD', 'basAvG', 'basArD', 'basArG', 'piedAvD', 'piedAvG', 'piedArD', 'piedArG'] as QuadBoneId[]) {
    out[id] = { ...sk[id], angle: 0, z: QUAD_Z[id][view] };
  }
  // Ailes de face/dos : DÉPLOYÉES de part et d'autre du corps (droite +x / gauche -x), derrière
  // le tronc (plans dans `QUAD_Z`) → silhouette d'oiseau de proie ailes ouvertes. Art symétrique
  // (miroir géré par la part front/back de l'aile elle-même).
  if (sk.aileD) {
    out.aileD = { ...sk.aileD, pivot: { x: 10, y: -15 }, angle: 0, z: QUAD_Z.aileD[view] };
    out.aileG = { ...sk.aileG, pivot: { x: -10, y: -15 }, angle: 0, z: QUAD_Z.aileG[view] };
  }
  return out;
}

/** Ancre le pied le plus bas au sol (y=floorY) en translatant le tronc. */
export function groundQuad(sk: QuadSkeleton, pose: QuadPose, floorY = 150): QuadSkeleton {
  const w = worldTransformsG(sk, pose);
  let footY = -Infinity;
  for (const id of ['piedAvD', 'piedAvG', 'piedArD', 'piedArG'] as QuadBoneId[]) {
    const m = w[id];
    const y = m[3] * sk[id].length + m[5];
    if (y > footY) footY = y;
  }
  const d = floorY - footY;
  if (Math.abs(d) < 0.01) return sk;
  return { ...sk, tronc: { ...sk.tronc, pivot: { x: sk.tronc.pivot.x, y: sk.tronc.pivot.y + d } } };
}
