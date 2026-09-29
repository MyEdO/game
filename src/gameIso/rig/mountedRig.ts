/**
 * MONTÉ — postures & tenues d'arme DÉDIÉES au cavalier (PAS la pose à pied surchargée). Un
 * cavalier ne se tient pas comme un fantassin : corps assis qui straddle la monture, rênes en
 * main GAUCHE, et l'arme tenue selon une logique montée (lance COUCHÉE vers l'avant, 1-main
 * dressée prête, hampe au port). PUR. Assemble le composite via composeComposite (tri par os).
 *
 * L'assise est DÉRIVÉE du dos réel de la monture (os `tronc`) → s'adapte à toute monture
 * (cheval/loup) et à toute vue (profil/face/dos) sans seatY codé en dur.
 */
import { composeComposite } from './composite';
import type { ResolvedBone, RigComposition } from './composeRig';
import { addPose, rotOf, type Pose } from './poses';
import type { View } from './facing';
import { apply, worldTransforms, type Matrix } from './kinematics';
import type { BoneId } from './bones';
import { handlingClass, type Handling } from './anim/handling';
import { seatedPose, weaponRest } from './anim/weaponClips';
import type { Weapon } from '../../engine/types';
import type { ResolveOpts } from './bodyPlan';
import { DEFAUT_HARNAIS_MONTE } from './quadruped/harnais';
import { QUAD_RIDER_Z } from './quadruped/quadZ';

const FAR_LEG = /(cuisse|tibia|pied)G$/; // de profil, G = côté LOINTAIN
const NEAR_LEG = /(cuisse|tibia|pied)D$/;

/** z d'un os du cavalier dans l'échelle de la monture quadrupède (table `QUAD_RIDER_Z`), selon la
 *  VUE : hors profil, les deux jambes sont du même côté de l'œil (elles straddlent le corps vu de
 *  bout) et passent donc au même plan. +z_natif*0.01 conserve l'ordre interne du cavalier (bras
 *  lointain derrière torse, etc.). */
export function riderZForQuad(view: View): (b: ResolvedBone) => number {
  const { corps, jambeProche, jambeLointaine } = QUAD_RIDER_Z[view];
  return (b) => (FAR_LEG.test(b.id) ? jambeLointaine : NEAR_LEG.test(b.id) ? jambeProche : corps) + b.z * 0.01;
}

// ── CORPS EN SELLE (sans arme), par vue ─────────────────────────────────────
// Assise en selle : bassin ancré au dos, cuisses écartées qui straddlent, genoux fléchis (`tibia`)
// et coudes légèrement pliés (`avantBras`) — chaîne FK complète cuisse→tibia→pied et
// épaule→avantBras→main, la main reste attachée au poignet. Le bras GAUCHE tient les rênes.
// Rig 2D : de FACE/DOS une rotation de torse penche de CÔTÉ → pas d'inclinaison hors profil ;
// et les jambes straddlent par angles MIROIR (G+/D−), sinon elles partent du même côté.
export function riderBodyPose(view: View): Pose {
  if (view === 'profile') {
    return { torse: 6, tete: -4, cuisseG: 16, cuisseD: 12, tibiaG: -8, tibiaD: -6, piedG: 2, piedD: 0, epauleG: -36, avantBrasG: -14, avantBrasD: -12 };
  }
  return { cuisseG: 10, cuisseD: -10, tibiaG: -5, tibiaD: 5, avantBrasG: -10, avantBrasD: -10 };
}

// ── CORPS ASSIS SUR UN SIÈGE (sans arme) ────────────────────────────────────
// Un siège n'est pas une selle : le corps n'enfourche rien, il POSE son bassin à la hauteur
// d'assise et sa cuisse sur le PLAN d'assise. Les angles ne sont donc pas posés à la main — ils se
// RÉSOLVENT depuis le squelette du corps et la hauteur d'assise (`drop`, en unités de la boîte de
// corps) : appui du bassin au siège, appui de la cheville au sol TANT QUE le tibia l'atteint. Une
// espèce courte sur un tabouret d'auberge n'y arrive pas : ses pieds PENDENT, et l'ancre du quad
// reste au sol (c'est la posture qui porte l'assise, jamais le point d'ancrage).

/** Buste d'un corps attablé — le port du haut du corps, commun aux trois vues (les jambes, elles,
 *  se résolvent). De profil le buste s'incline légèrement vers la table ; de face/dos une rotation
 *  de torse pencherait DE CÔTÉ (rig 2D), on n'y garde donc que les coudes. */
function seatedUpper(view: View): Pose {
  return view === 'profile'
    ? { torse: 6, tete: -4, avantBrasG: -14, avantBrasD: -12 }
    : { avantBrasG: -10, avantBrasD: -10 };
}

/** Les deux côtés d'une chaîne de jambe. */
const COTES = ['G', 'D'] as const;

/** Le corps SUR LEQUEL l'assise se résout : son squelette et les postures qui s'appliquent SOUS la
 *  pose de l'instant (`poseRig` : espèce puis vue). Sans elles, les angles résolus se compteraient
 *  depuis un repos que le rendu n'emploie jamais — et les pieds passeraient sous le sol. */
export type SeatedBody = Pick<RigComposition, 'sk' | 'speciesPose' | 'viewPose'>;

/** Repères VERTICAUX d'une jambe, mesurés sur le corps À SA POSTURE DE BASE : c'est d'eux que
 *  l'assise se déduit — jamais d'un nombre posé à la main. */
function reperes(b: SeatedBody, base: Pose) {
  const w = worldTransforms(b.sk, base);
  const y = (id: BoneId, dy = 0) => apply(w[id], { x: 0, y: dy }).y;
  const solY = Math.max(y('piedG', b.sk.piedG.length), y('piedD', b.sk.piedD.length));
  /** Angle MONDE d'un os au repos posé (somme des angles de sa chaîne + deltas de base). */
  const angle = (...ids: BoneId[]) => ids.reduce((a, id) => a + b.sk[id].angle + rotOf(base, id), 0);
  return { y, solY, angle };
}

/**
 * Jambes d'un corps ASSIS DE PROFIL : le BASSIN descend jusqu'à ce que la hanche soit à `drop`
 * au-dessus du sol ; la cuisse tourne vers l'AVANT de l'angle qui amène le genou juste au-dessus de
 * la cheville ; le tibia reprend la VERTICALE et le pied son appui de repos. Deux appuis (bassin au
 * siège, pied au sol), deux inconnues — la solution est fermée, pas un réglage à l'œil. Quand la
 * jambe est trop courte pour le siège, l'appui du sol tombe et la cuisse s'arrête au plan d'assise :
 * le tibia PEND à la verticale sous le genou.
 */
function seatedLegsProfile(b: SeatedBody, base: Pose, drop: number): Pose {
  const { y, solY, angle } = reperes(b, base);
  const ty = solY - drop - y('cuisseD');
  const out: Pose = { bassin: { ty } };
  for (const c of COTES) {
    const cuisse: BoneId = `cuisse${c}`, tibia: BoneId = `tibia${c}`, pied: BoneId = `pied${c}`;
    const hanche = y(cuisse) + ty;
    const cheville = y(pied);
    const genou = cheville - b.sk[tibia].length;
    // Part VERTICALE du fémur (hanche → genou) = cosinus de son angle MONDE, bornée aux DEUX bouts :
    // en haut par l'atteignable (−1, genou remonté au maximum) ; en bas par le PLAN D'ASSISE (0, cuisse
    // à l'HORIZONTALE) — un corps assis pose sa cuisse dessus. Sans cette seconde borne, une jambe
    // trop courte pour le siège replonge la cuisse à la verticale pour aller chercher le sol : le
    // corps redevient DEBOUT sur son tabouret. Passé la borne, le pied ne touche plus — il PEND.
    const cos = Math.max(-1, Math.min(0, (genou - hanche) / b.sk[cuisse].length));
    const theta = (Math.acos(cos) * 180) / Math.PI; // 0..180 : le genou part vers l'AVANT du profil
    out[cuisse] = theta - angle('bassin', cuisse);
    out[tibia] = -theta - angle(tibia);                        // tibia VERTICAL (angle monde 0)
    out[pied] = angle('bassin', cuisse, tibia);                // le pied garde son appui de repos
  }
  return out;
}

/**
 * Jambes d'un corps ASSIS VU DE FACE/DOS : la cuisse ne peut pas tourner vers l'œil, elle se
 * RACCOURCIT (`sy`) — le raccourci que la rotation 2D ne sait pas dire. L'échelle étant HÉRITÉE,
 * toute la jambe se raccourcit du même facteur ; le pied compense l'héritage (`sy` inverse) et garde
 * sa taille, si bien que sa pointe retombe exactement sur le sol — tant que le raccourci demandé tient
 * entre les deux bornes du squelette ; à la borne haute le pied PEND, comme en profil, et sous un
 * siège plus bas que deux semelles il s'enfonce de ce que le repli minimal lui laisse.
 */
function seatedLegsFront(b: SeatedBody, base: Pose, drop: number): Pose {
  const { y, solY } = reperes(b, base);
  const out: Pose = { bassin: { ty: solY - drop - y('cuisseD') } };
  for (const c of COTES) {
    const cuisse: BoneId = `cuisse${c}`, tibia: BoneId = `tibia${c}`, pied: BoneId = `pied${c}`;
    const hanche = y(cuisse), genou = y(tibia), cheville = y(pied);
    const semelle = y(pied, b.sk[pied].length) - cheville; // hauteur du PIED, hors raccourci
    const jambe = cheville - hanche;
    // La descente VISÉE de la jambe est celle qui pose la SEMELLE AU SOL (`drop − semelle`) : c'est
    // le SOL qui commande le raccourci. Elle se borne aux deux bouts, MESURÉE sur le squelette du
    // corps et jamais posée à la main. En HAUT par le TIBIA seul, MÊME borne qu'en profil dite dans
    // le canal du raccourci (cuisse posée sur le plan d'assise) — au-delà la jambe s'étirerait vers
    // un sol hors d'atteinte et le corps redeviendrait debout. En BAS par la hauteur de son propre
    // PIED : c'est le plancher de RENDABILITÉ du raccourci, car le pied compense l'héritage par un
    // `sy` inverse et cette compensation, composée aux rotations de la chaîne, cisaille d'autant plus
    // que le raccourci est petit (mesuré sur un humain : à k ≈ 0,001, la pointe part à 317 unités de
    // la cheville, dans une boîte large de 120). Sous un siège plus bas que deux semelles, aucune
    // pose frontale ne tient donc les deux appuis : la semelle s'enfonce de ce qui manque, au plus de
    // `2 × semelle − drop`.
    const visee = drop - semelle;
    const descente = Math.max(semelle, Math.min(cheville - genou, visee));
    const k = jambe !== 0 ? descente / jambe : 1;
    const echelle = k !== 0 ? k : 1; // pied sans épaisseur : rien à replier, la jambe reste entière
    out[cuisse] = { sy: echelle };
    out[pied] = { sy: 1 / echelle };
  }
  return out;
}

/**
 * Pose du CORPS ASSIS sur un siège, pour une vue, un squelette et une hauteur d'assise `drop`
 * (unités de la boîte de corps — cf. `boxUnitsPerM`). PURE.
 */
export function seatedBodyPose(view: View, body: SeatedBody, drop: number): Pose {
  const base = addPose(body.speciesPose, body.viewPose);
  const jambes = view === 'profile' ? seatedLegsProfile(body, base, drop) : seatedLegsFront(body, base, drop);
  return addPose(jambes, seatedUpper(view));
}

// ── TENUE D'ARME MONTÉE (remplace weaponRest à pied), par classe de maniement + vue ─────────
// Convention os `arme` : repos 165 = pointe BAS ; delta −75 ≈ horizontale (avant), −150 ≈ dressée.
function mountedWeaponHold(h: Handling, view: View): Pose {
  if (view === 'profile') {
    switch (h) {
      case 'lance_cav': return { arme: -86, epauleD: 18 };       // lance COUCHÉE vers l'avant (en arrêt)
      case 'hampe': case 'lourde2m': return { arme: -150, epauleD: 10, epauleG: 30 }; // hampe/2-mains au port
      case 'arc': case 'arbalete': case 'arme_feu': return { arme: -150, epauleD: 8 }; // à distance, dressé
      default: return { arme: -150, epauleD: 8 };                 // 1-main : épée DRESSÉE, prête
    }
  }
  // face/dos : armes dressées verticales (les coucher = vers l'écran, illisible).
  return { arme: -158, epauleD: 6 };
}

/** Pose complète du cavalier au repos monté = corps en selle + tenue d'arme, par vue. */
export function mountedRest(view: View, weapon?: Weapon): Pose {
  const h = weapon ? handlingClass(weapon) : 'lame1m';
  return addPose(riderBodyPose(view), mountedWeaponHold(h, view));
}

/**
 * Pose d'un corps ASSIS HORS MONTURE (figurant attablé) : le même corps assis, avec la tenue d'arme
 * AU REPOS du fantassin (`weaponRest`) — jamais une tenue montée, jamais un geste. La prise passe par
 * `seatedPose` : les jambes restent celles de l'assise, l'arme ne peut pas redéplier le corps.
 */
export function seatedRest(view: View, body: SeatedBody, drop: number, weapon?: Weapon): Pose {
  return addPose(seatedBodyPose(view, body, drop), seatedPose(weaponRest(weapon)));
}

export interface SeatOpts {
  view: View;
  /** échelle d'écran de la monture (celle du jeton porteur). */
  mountScale: number;
  /** échelle d'écran VOULUE du cavalier (assis). */
  riderScale: number;
  /** y du BASSIN dans la boîte du cavalier (ancre posée sur la selle). */
  pelvisY?: number;
  /** remontée fine au-dessus du dos (px boîte monture). */
  lift?: number;
}

// Point de SELLE dans le repère LOCAL de l'os `tronc` : haut du barillet (où s'assoit le bassin).
const SADDLE_LOCAL_Y = -15;

/**
 * Opts de rendu de la MONTURE d'un couple monté : celles de son record, déjà résolues
 * (`planOptsForRecord` — précédence par champ, override vivant → record), avec le set d'équipement
 * par DÉFAUT quand la donnée n'en déclare aucun. Ce défaut est une INFÉRENCE MAISON de rendu (#1128), tenue en donnée
 * éditable (`src/data/renduMonte.json`) : les listes de Possessions de carrière donnent la monture
 * « avec selle et harnais » (LDB 08 l.557, ADE I 07 l.48) ; aucune règle n'attache la sellerie au
 * fait d'être monté. Un `harnais: ''` authoré (nu explicite) est donc respecté tel quel. PURE.
 */
export function harnaisDeMonture(opts: ResolveOpts): ResolveOpts {
  return { ...opts, harnais: opts.harnais ?? DEFAUT_HARNAIS_MONTE };
}

/**
 * POSE du cavalier dans la boîte de la monture : échelle relative k + ancre de SELLE dérivée de l'os
 * `tronc` (haut du barillet) → s'adapte à toute monture et toute vue. Sa translation `y` est le HAUT
 * de la boîte 0..150 du cavalier ramené dans la boîte de la monture : négative, le composite déborde
 * par le haut de cette boîte (ce que la rasterisation doit savoir avant de dessiner).
 */
export function seatPlacement(mountBones: ResolvedBone[], opts: SeatOpts): Matrix {
  const { mountScale, riderScale, pelvisY = 96, lift = 4 } = opts;
  const k = riderScale / mountScale;
  const tronc = mountBones.find((b) => b.id === 'tronc') ?? mountBones[0];
  // haut du barillet en coords boîte monture (matrice de l'os × point local échellé par la part).
  const saddle = tronc ? apply(tronc.matrix, { x: 0, y: SADDLE_LOCAL_Y * tronc.scale[1] }) : { x: 60, y: 75 };
  return [k, 0, 0, k, saddle.x - 60 * k, saddle.y - lift - pelvisY * k];
}

/**
 * Assoit `riderBones` sur `mountBones` (tous deux boîte 120×150) → composite trié. Le cavalier est
 * ramené dans la boîte de la monture par `seatPlacement`.
 */
export function seatRiderOnMount(mountBones: ResolvedBone[], riderBones: ResolvedBone[], opts: SeatOpts): ResolvedBone[] {
  return composeComposite([
    { bones: mountBones, z: (b) => b.z },                                            // monture : z natif du gabarit
    { bones: riderBones, place: seatPlacement(mountBones, opts), z: riderZForQuad(opts.view) }, // cavalier : remappé + assis
  ]);
}
