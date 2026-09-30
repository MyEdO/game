/**
 * Animations PAR CLASSE DE MANIEMENT (`handling.ts`) — PAS par Groupe de règles.
 *
 *  - `weaponRest(w)` : pose de base TOUJOURS appliquée (orientation de l'arme + PRISE 1/2
 *    mains). C'est elle qui fixe « comment l'arme est tenue » ; les armes à 2 mains (hampe,
 *    lourde, arc, arbalète, arme à feu) y ramènent la main GAUCHE sur l'arme. Calibrée pour
 *    être lisible en vue de FACE comme de PROFIL (donc appliquée dans tous les modes/vues).
 *  - `weaponAttackClip(w)` / `weaponParryClip(w)` : clips joués EN DELTA au-dessus du repos
 *    (le pas `REST` = {} revient au repos). Re-tunés pour rester cohérents avec l'orientation
 *    de `weaponRest`.
 *
 * Convention d'angle (cf. PART-CONTRACT) : os `arme` au repos 165° = pointe vers le BAS.
 * Delta négatif relève la pointe : -75 ≈ horizontale, -165 ≈ verticale (pointe en haut).
 */
import type { Pose } from '../poses';
import type { Clip, ClipStep } from './clips';
import { handlingClass, isRangedHandling, type Handling } from './handling';
import type { ArmeDeDessin, BouclierDeDessin, FormeDArme } from '../parts/equipment';

const REST: Pose = {};
const c = (steps: ClipStep[], onImpact?: number): Clip => ({ steps, onImpact });

// --- REPOS / PRISE par classe (toujours appliqué) --------------------------
// Les 2-mains (lourde2m/hampe/arc.../arme_feu) amènent la main gauche (epauleG/avantBrasG)
// sur l'arme : le rig 2D ne pouvant CENTRER l'arme (ancrée à la main droite), la prise se lit
// via un PORT DIAGONAL travers-du-corps. Valeurs calées au QC sur modèle (front + profil).
const RESTS: Record<Handling, Pose> = {
  lame1m: {}, // lame 1 main : pointe-bas au côté (repos squelette)
  escrime: { arme: -30, epauleD: 8 }, // pointe en avant, en garde basse
  lourde2m: { arme: -126, epauleD: 12, avantBrasD: 6, epauleG: 44, avantBrasG: 38 }, // greatsword, prise demi-épée
  hampe: { arme: -132, epauleD: 12, avantBrasD: 6, epauleG: 40, avantBrasG: 34 }, // hampe au port, 2 mains
  lance_cav: { arme: -150, epauleD: 6 }, // lance dressée verticale (1 main, à pied)
  fleau: {}, // tête articulée qui pend (repos squelette)
  parade: { arme: -40, epauleD: 10 }, // arme de main gauche présentée
  poings: {}, // poings au repos
  arc: { arme: -160, epauleD: 6 }, // arc vertical en main (2 mains à la décoche, pas au repos)
  arbalete: { arme: -110, epauleD: 18, avantBrasD: 10, epauleG: 36, avantBrasG: 30 }, // bercée bas-prêt, 2 mains
  arme_feu: { arme: -120, epauleD: 16, avantBrasD: 10, epauleG: 34, avantBrasG: 28 }, // portée en travers, 2 mains
  fronde: {}, // poche qui pend
  jet: { arme: -120 }, // arme de jet armée, pointe en avant-haut
  entraves: {}, // fouet/lasso enroulé qui pend
  explosif: {}, // tenu bas au côté
  cornes: {}, // arme naturelle de tête : rien en main
};

/** Pose de PRISE/orientation de l'arme — TOUJOURS appliquée (sous les clips). */
export function weaponRest(w?: FormeDArme): Pose {
  return w ? RESTS[handlingClass(w)] : {};
}

// --- ATTAQUE par classe (deltas AU-DESSUS du repos) ------------------------
const ATTACK: Record<Handling, Clip> = {
  // Lame 1 main : taille latérale.
  lame1m: c([
    { pose: { epauleD: -30, avantBrasD: -18, torse: -5 }, ms: 130, easing: 'easeOut' },
    { pose: { epauleD: 52, avantBrasD: 24, torse: 9, bassin: 4 }, ms: 90, easing: 'easeOutBack' },
    { pose: REST, ms: 200, easing: 'easeInOut' },
  ], 220),
  // Escrime : fente rapide en estoc (la pointe est déjà en avant au repos).
  escrime: c([
    { pose: { epauleD: -8, avantBrasD: -12, torse: -3 }, ms: 80, easing: 'easeOut' },
    { pose: { epauleD: 40, avantBrasD: 22, torse: 8, bassin: 7, arme: 10 }, ms: 80, easing: 'easeOutBack' },
    { pose: REST, ms: 170, easing: 'easeInOut' },
  ], 165),
  // Lourde 2 mains : lève TRÈS haut puis grand coup qui retombe lame en AVANT (les deux mains
  // suivent la poignée ; gros delta `arme` car le bras s'étend en abattant).
  lourde2m: c([
    { pose: { epauleD: -58, epauleG: -40, avantBrasD: -24, torse: -4, arme: -30 }, ms: 180, easing: 'easeOut' },
    { pose: { epauleD: 48, epauleG: 36, avantBrasD: 28, torse: 9, bassin: 4, arme: 95 }, ms: 100, easing: 'easeOutBack' },
    { pose: REST, ms: 240, easing: 'easeInOut' },
  ], 285),
  // Hampe : estoc — la hampe se ramène pointe en AVANT (l'os `arme` est relatif à la main qui
  // s'étend, d'où le gros delta), légère fente du buste (bassin discret pour éviter le penchant).
  hampe: c([
    { pose: { epauleD: -6, torse: -4, arme: -8 }, ms: 120, easing: 'easeOut' },
    { pose: { arme: 115, epauleD: 30, avantBrasD: 10, epauleG: -8, avantBrasG: -12, torse: 8, bassin: 4 }, ms: 110, easing: 'easeOutBack' },
    { pose: REST, ms: 210, easing: 'easeInOut' },
  ], 230),
  // Lance de cavalerie : on abaisse la lance pointe en AVANT (couchée) puis charge/estoc.
  lance_cav: c([
    { pose: { arme: 40, epauleD: 10, torse: -3 }, ms: 130, easing: 'easeOut' },
    { pose: { arme: 125, epauleD: 32, avantBrasD: 12, torse: 9, bassin: 4 }, ms: 110, easing: 'easeOutBack' },
    { pose: REST, ms: 210, easing: 'easeInOut' },
  ], 240),
  // Fléau : moulinet circulaire au-dessus de la tête.
  fleau: c([
    { pose: { epauleD: -70, avantBrasD: -44, torse: -5 }, ms: 170, easing: 'easeOut' },
    { pose: { epauleD: 56, avantBrasD: 38, torse: 9, bassin: 5 }, ms: 100, easing: 'easeOutBack' },
    { pose: REST, ms: 230, easing: 'easeInOut' },
  ], 270),
  // Parade : estoc court et bas (l'arme défensive pique en réplique).
  parade: c([
    { pose: { epauleD: -10, avantBrasD: -14 }, ms: 70, easing: 'easeOut' },
    { pose: { epauleD: 26, avantBrasD: 32, torse: 6, bassin: 3 }, ms: 70, easing: 'easeOut' },
    { pose: REST, ms: 150, easing: 'easeInOut' },
  ], 140),
  // Poings : double jab rapide (droite puis gauche).
  poings: c([
    { pose: { epauleD: -8, avantBrasD: -10 }, ms: 60, easing: 'easeOut' },
    { pose: { epauleD: 30, avantBrasD: 28, torse: 5 }, ms: 60, easing: 'easeOut' },
    { pose: { epauleG: -8, avantBrasG: -10 }, ms: 60, easing: 'easeOut' },
    { pose: { epauleG: 30, avantBrasG: 28 }, ms: 60, easing: 'easeOut' },
    { pose: REST, ms: 140, easing: 'easeInOut' },
  ], 120),
  // Arc : pousse l'arc (bras gauche), tire la corde (bras droit), maintien, décoche.
  arc: c([
    { pose: { epauleG: 42, avantBrasG: -6, epauleD: -38, avantBrasD: -28, torse: -4 }, ms: 200, easing: 'easeOut' },
    { pose: { epauleG: 44, epauleD: -44, avantBrasD: -34 }, ms: 120, easing: 'easeInOut' },
    { pose: { epauleG: 40, epauleD: -8, avantBrasD: 6 }, ms: 80, easing: 'easeOut' },
    { pose: REST, ms: 200, easing: 'easeInOut' },
  ], 330),
  // Arbalète : on relève à l'horizontale (visée), léger recul.
  arbalete: c([
    { pose: { arme: 30, epauleD: 40, epauleG: 12, avantBrasD: -10, torse: -3 }, ms: 160, easing: 'easeOut' },
    { pose: { arme: 28, epauleD: 38, torse: -6, tete: -3 }, ms: 70, easing: 'easeOut' },
    { pose: REST, ms: 190, easing: 'easeInOut' },
  ], 175),
  // Arme à feu : on épaule à l'horizontale, recul sec vers le haut (fumée = FX feedback).
  arme_feu: c([
    { pose: { arme: 45, epauleD: 48, epauleG: 6, avantBrasD: -8, torse: -3 }, ms: 170, easing: 'easeOut' },
    { pose: { arme: 38, epauleD: 32, avantBrasD: -12, torse: -9, tete: -6 }, ms: 80, easing: 'easeOutBack' },
    { pose: REST, ms: 210, easing: 'easeInOut' },
  ], 185),
  // Fronde : moulinet au-dessus puis lâcher en avant.
  fronde: c([
    { pose: { epauleD: -68, avantBrasD: -40, torse: -5 }, ms: 170, easing: 'easeOut' },
    { pose: { epauleD: 58, avantBrasD: 20, torse: 8 }, ms: 90, easing: 'easeOut' },
    { pose: REST, ms: 220, easing: 'easeInOut' },
  ], 250),
  // Jet (javelot/couteau/hache) : armé par-dessus l'épaule puis projection avant.
  jet: c([
    { pose: { epauleD: -46, avantBrasD: -26, torse: -4, arme: -15 }, ms: 140, easing: 'easeOut' },
    { pose: { epauleD: 48, avantBrasD: 18, torse: 10, bassin: 6, arme: 35 }, ms: 90, easing: 'easeOut' },
    { pose: REST, ms: 200, easing: 'easeInOut' },
  ], 240),
  // Entraves (fouet/lasso — et tentacule muté) : grand ARMÉ au-dessus de la tête, CLAQUEMENT
  // sec (le poignet casse, l'arme part en avant), puis SUIVI souple avant le retour — un fouet
  // ne s'arrête pas net au point d'impact.
  entraves: c([
    { pose: { epauleD: -78, avantBrasD: -52, torse: -6, arme: -16 }, ms: 170, easing: 'easeOut' },
    { pose: { epauleD: 58, avantBrasD: 44, torse: 9, bassin: 4, arme: 26 }, ms: 70, easing: 'easeOutBack' },
    { pose: { epauleD: 38, avantBrasD: 30, torse: 6, arme: 12 }, ms: 90, easing: 'easeOut' },
    { pose: REST, ms: 230, easing: 'easeInOut' },
  ], 240),
  // Explosif : lancer en cloche (revers bas puis projection).
  explosif: c([
    { pose: { epauleD: 18, avantBrasD: 30, torse: 6 }, ms: 140, easing: 'easeOut' },
    { pose: { epauleD: -30, avantBrasD: -10, torse: -4 }, ms: 110, easing: 'easeOut' },
    { pose: REST, ms: 200, easing: 'easeInOut' },
  ], 240),
  // Cornes (mutation Cornes asymétriques) : recul du buste puis COUP DE TÊTE projeté,
  // épaules ramenées — pas un coup de bras.
  cornes: c([
    { pose: { tete: -14, cou: -6, torse: -9, bassin: -3 }, ms: 150, easing: 'easeOut' },
    { pose: { tete: 26, cou: 12, torse: 16, bassin: 7, epauleD: 10, epauleG: 10 }, ms: 90, easing: 'easeOutBack' },
    { pose: REST, ms: 230, easing: 'easeInOut' },
  ], 240),
};

// Miroir G↔D d'un clip (sans les deltas `arme`, ancrée à la main droite). Les clips sont
// dessinés pour le bras d'ARME (droit) ; le geste se joue sur LE BRAS QUI TIENT L'ARME :
// une arme en MAIN GAUCHE (2e frappe du Maniement de deux armes) ou un MEMBRE GAUCHE muté
// (tentacule, qui remplace le bras gauche) joue le clip MIROITÉ.
const MIRROR_BONE: Record<string, string> = {
  epauleD: 'epauleG', epauleG: 'epauleD', avantBrasD: 'avantBrasG', avantBrasG: 'avantBrasD', mainD: 'mainG', mainG: 'mainD',
};
const mirrorPose = (p: Pose): Pose =>
  Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'arme').map(([k, v]) => [MIRROR_BONE[k] ?? k, v]));
const mirrorClip = (cl: Clip): Clip => ({ ...cl, steps: cl.steps.map((s) => ({ ...s, pose: mirrorPose(s.pose) })) });
/** L'attaque de cette arme se joue-t-elle sur le bras GAUCHE ? Routage PAR ID STABLE (kind
 *  `attackKind`, jamais le libellé) : main secondaire, ou tentacule (membre gauche muté). */
const leftHanded = (w: FormeDArme): boolean => w.hand === 'off' || w.attackKind === 'tentacules';

/** Geste d'attaque selon la classe de maniement (défaut : lame1m), MIROITÉ pour le bras gauche. */
export function weaponAttackClip(w?: FormeDArme): Clip {
  if (!w) return ATTACK.lame1m;
  const base = ATTACK[handlingClass(w)];
  return leftHanded(w) ? mirrorClip(base) : base;
}

// --- PARADES / gardes (deltas au-dessus du repos) --------------------------
const SHIELD_PARRY = c([
  { pose: { epauleG: -50, avantBrasG: -40, torse: 4 }, ms: 90, easing: 'easeOut' },
  { pose: REST, ms: 260, easing: 'easeInOut' },
]);
const SWORD_GUARD = c([
  { pose: { epauleD: -46, avantBrasD: -34, torse: 3 }, ms: 90, easing: 'easeOut' },
  { pose: REST, ms: 260, easing: 'easeInOut' },
]);
// Hampe / lourde / lance : blocage des DEUX bras, hampe relevée en travers.
const STAFF_BLOCK = c([
  { pose: { epauleG: -28, epauleD: -30, avantBrasG: -26, avantBrasD: -24, torse: 2, arme: 28 }, ms: 90, easing: 'easeOut' },
  { pose: REST, ms: 260, easing: 'easeInOut' },
]);
// Un tireur pris au corps-à-corps esquive plutôt qu'il ne pare.
const RANGED_FLINCH = c([
  { pose: { bassin: -14, torse: -9, tete: -5 }, ms: 110, easing: 'easeOut' },
  { pose: REST, ms: 220, easing: 'easeInOut' },
]);
// Escrime : parade par opposition POINTE EN AVANT (raccord avec l'estoc), pas un lever haut.
const FENCE_PARRY = c([
  { pose: { epauleD: 14, avantBrasD: -10, torse: -2, arme: -18 }, ms: 80, easing: 'easeOut' },
  { pose: REST, ms: 230, easing: 'easeInOut' },
]);
// Mains nues : on se COUVRE (les deux avant-bras remontent devant le visage).
const BARE_BLOCK = c([
  { pose: { avantBrasD: -34, avantBrasG: -34, tete: 3, torse: 2 }, ms: 90, easing: 'easeOut' },
  { pose: REST, ms: 240, easing: 'easeInOut' },
]);

const MELEE_TWO_HANDED = new Set<Handling>(['lourde2m', 'hampe', 'lance_cav']);

/** Geste de parade : bouclier > tireur (esquive) > 2-mains (blocage) > escrime/poings/garde.
 *  Comme l'attaque, le geste se joue sur LE BRAS QUI TIENT l'arme de parade : une main-gauche/
 *  brise-épée/2e arme (`hand:'off'`) pare du bras gauche (clip miroité). */
export function weaponParryClip(w?: FormeDArme, hasShield = false): Clip {
  if (hasShield) return SHIELD_PARRY; // déjà à gauche (bras de bouclier)
  if (!w) return SWORD_GUARD;
  const h = handlingClass(w);
  if (isRangedHandling(w)) return RANGED_FLINCH; // arc/arbalète/arme à feu/jet… esquivent
  if (MELEE_TWO_HANDED.has(h)) return STAFF_BLOCK; // les deux bras — pas de côté
  if (h === 'poings' || h === 'cornes') return BARE_BLOCK; // se couvre des deux avant-bras
  const clip = h === 'escrime' ? FENCE_PARRY : SWORD_GUARD; // lame1m, fléau, parade
  return leftHanded(w) ? mirrorClip(clip) : clip;
}

// --- CLIPS MONTÉS (deltas au-dessus de `mountedRest`, cf. rig/mountedRig.ts) ----------------
// En selle, la tenue d'arme N'EST PAS celle du fantassin (`mountedWeaponHold` : lance COUCHÉE
// −86, 1-main/2-mains/tir DRESSÉS −150) → les clips à pied sur-rotaient l'arme et, surtout,
// leurs deltas bassin/jambes faisaient basculer le corps assis (ancré à la selle par le bassin).
// Règle : un clip monté ne touche JAMAIS bassin/cuisse/tibia/pied — le geste vit dans le buste.
const SEATED_LOCKED = /^(bassin|cuisse|tibia|pied)/;
/** Variante ASSISE d'une pose : purge les deltas bassin/jambes. SOURCE UNIQUE du verrou d'assise —
 *  servie aussi bien aux clips montés qu'à la tenue d'arme AU REPOS d'un corps attablé, dont les
 *  jambes appartiennent à l'assise et non à l'arme. */
export const seatedPose = (p: Pose): Pose => Object.fromEntries(Object.entries(p).filter(([k]) => !SEATED_LOCKED.test(k)));
/** Variante ASSISE d'un clip : purge les deltas bassin/jambes (le cavalier reste en selle). */
export const seatedClip = (cl: Clip): Clip => ({ ...cl, steps: cl.steps.map((s) => ({ ...s, pose: seatedPose(s.pose) })) });

// CALIBRAGE MONTÉ (vérifié à la sonde FK, profil natif non-miroité) :
//  - angle MONDE de l'arme = tenue + (arme + epauleD + avantBrasD + torse), additif strict ;
//    repères : 90 ≈ pointe AVANT horizontale, 0 ≈ pointe haut, > 180 = pointe ARRIÈRE.
//  - le POING : epauleD POSITIF le tire en ARRIÈRE-haut, NÉGATIF le projette en AVANT
//    (idem torse : positif = recul du buste — cf. clip `hit`). Un coup monté = armé en
//    positif (on s'arme), frappe en NÉGATIF (on projette) + `arme` compensé vers la cible.
// Coup des DEUX mains depuis le port dressé (lourde 2-mains ET hampe montées : même tenue −150).
const MOUNTED_CHOP_2M = c([
  { pose: { arme: -60, epauleD: 16, epauleG: 12, torse: 6 }, ms: 160, easing: 'easeOut' }, // monde ≈ −9 : armé haut, poings reculés
  { pose: { arme: 142, epauleD: -30, epauleG: -22, avantBrasD: -10, torse: -8 }, ms: 100, easing: 'easeOutBack' }, // monde ≈ 123 : abat avant-bas, les 2 bras projetés
  { pose: REST, ms: 230, easing: 'easeInOut' },
], 260);
const MOUNTED_ATTACK: Partial<Record<Handling, Clip>> = {
  // CHARGE lance couchée : la lance est DÉJÀ en arrêt (−86, monde ≈ 101 horizontale) — pas de
  // moulinet : le poing recule (le corps se coile), puis PROJETTE la lance devant, buste couché
  // sur l'encolure ; `arme` compense le bras pour que la pointe RESTE en arrêt (~98-103 monde).
  lance_cav: c([
    { pose: { arme: -14, epauleD: 12, torse: 4, tete: -2 }, ms: 140, easing: 'easeOut' },
    { pose: { arme: 40, epauleD: -26, avantBrasD: -10, torse: -7, tete: 2 }, ms: 90, easing: 'easeOutBack' },
    { pose: REST, ms: 220, easing: 'easeInOut' },
  ], 230),
  // TAILLE à cheval : de la lame dressée (monde ≈ 27), armé haut-arrière puis grand arc qui
  // FAUCHE vers l'avant-bas (monde ≈ 127), poing et buste jetés en avant.
  lame1m: c([
    { pose: { arme: -60, epauleD: 18, avantBrasD: 6, torse: 6 }, ms: 140, easing: 'easeOut' }, // monde ≈ −3
    { pose: { arme: 152, epauleD: -32, avantBrasD: -12, torse: -8 }, ms: 90, easing: 'easeOutBack' }, // monde ≈ 127
    { pose: REST, ms: 220, easing: 'easeInOut' },
  ], 230),
  // Escrime : la pointe dressée PIQUE en estoc plongeant (monde ≈ 111), bras tendu en avant.
  escrime: c([
    { pose: { arme: -40, epauleD: 14, torse: 4 }, ms: 90, easing: 'easeOut' }, // monde ≈ 5
    { pose: { arme: 128, epauleD: -30, avantBrasD: -8, torse: -6 }, ms: 80, easing: 'easeOutBack' },
    { pose: REST, ms: 180, easing: 'easeInOut' },
  ], 170),
  lourde2m: MOUNTED_CHOP_2M,
  hampe: MOUNTED_CHOP_2M,
  // Arbalète/arme à feu : du port dressé (−150), on COUCHE l'arme en joue (∼horizontale), recul.
  arbalete: c([
    { pose: { arme: 64, epauleD: 34, epauleG: 14, avantBrasD: -6, torse: -3 }, ms: 170, easing: 'easeOut' },
    { pose: { arme: 60, epauleD: 30, torse: -6, tete: -3 }, ms: 70, easing: 'easeOut' },
    { pose: REST, ms: 200, easing: 'easeInOut' },
  ], 190),
  arme_feu: c([
    { pose: { arme: 70, epauleD: 40, epauleG: 10, avantBrasD: -6, torse: -3 }, ms: 170, easing: 'easeOut' },
    { pose: { arme: 58, epauleD: 28, avantBrasD: -10, torse: -8, tete: -5 }, ms: 80, easing: 'easeOutBack' },
    { pose: REST, ms: 200, easing: 'easeInOut' },
  ], 190),
};

/** Geste d'attaque EN SELLE : clip monté dédié, sinon le clip à pied assis (sans bassin/jambes).
 *  Comme à pied, le geste se joue sur le bras qui tient l'arme (miroir main gauche/tentacule). */
export function mountedAttackClip(w?: FormeDArme): Clip {
  const base = w && MOUNTED_ATTACK[handlingClass(w)];
  const clip = base ?? seatedClip(w ? ATTACK[handlingClass(w)] : ATTACK.lame1m);
  return w && leftHanded(w) ? mirrorClip(clip) : clip;
}

/** Garde EN SELLE : la parade à pied, assise (les parades vivent déjà dans les bras). */
export function mountedParryClip(w?: FormeDArme, hasShield = false): Clip {
  return seatedClip(weaponParryClip(w, hasShield));
}

/** True si l'arme se manie à distance (geste de tir/jet plutôt que de mêlée). */
export const isRangedFamily = isRangedHandling;

/** Bouclier présent dans l'équipement (pour le choix de parade). */
export function hasShieldEquipped(weapons: readonly ArmeDeDessin[], shield: BouclierDeDessin | undefined): boolean {
  return !!shield || weapons.some((w) => w.bouclier);
}
