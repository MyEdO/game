/**
 * INTERFACES du gabarit quadrupède — les cinq lignes d'ARTICULATION où deux parts se rencontrent,
 * nommées une fois pour toutes : `gorge` (tête↔encolure), `garrot` (encolure↔tronc), `epaule`
 * (tronc↔antérieur proche), `hanche` (croupe↔postérieur proche), `naissanceQueue` (croupe↔queue).
 * Ce sont des lignes de CINÉMATIQUE : chacune est un PIVOT du squelette, l'endroit où l'os voisin
 * s'attache et tourne. Une ligne d'ART (ganache, arête d'omoplate, pli de flanc…) n'en est jamais
 * une : elle se déclare en DÉCALAGE EXPLICITE depuis un de ces pivots (`artLine`), dans le repère
 * de l'os propriétaire — jamais en littéral de coordonnée, qui redeviendrait une constante
 * d'espèce (cf. la dispersion de 25,3 u mesurée ci-dessous).
 *
 * POURQUOI un module : sans lui, chaque art et chaque garde re-dérive « où finit l'encolure » à
 * partir des littéraux du squelette, et les copies divergent. Mesure du juge de design (#1082) :
 * projetées au monde sur les 25 espèces, ces lignes se dispersent de 25,3 u et le signe même de
 * l'écart « bas de ganache − base d'encolure » CHANGE (blaireau −52,8, varghulf +16,5) — AUCUNE
 * constante de ligne n'est définissable. Une interface est donc une FONCTION de l'espèce.
 *
 * REPÈRE — chaque interface est rendue dans le repère LOCAL de son os PROPRIÉTAIRE (`os`), celui
 * dans lequel l'art de cet os est dessiné : c'est le repère qu'un artiste a sous la main quand il
 * dessine la part. Le passage au monde est le transform de cet os (`worldTransformsG`), multiplié
 * par l'échelle d'os (`composeQuad` : `headScale` sur la tête, carrure sur le corps, épaisseur sur
 * les membres) — ce module ne le fait pas à sa place.
 *
 * AUCUN LITTÉRAL du squelette n'est recopié ici : les points sont LUS sur le squelette construit
 * (`buildQuadSkeleton` / `quadSkeletonForView`), donc les pivots RÉELS. Un déplacement d'attache
 * dans le squelette déplace l'interface, sans retouche de ce fichier.
 *
 * CAS DÉCLARÉS
 *  · Encolure quasi NULLE (crapaud, `neckLen` 0,06 → encolure de 1,8 u) : `gorge` et `garrot`
 *    existent et se confondent presque. C'est une donnée, pas un défaut : le module ne corrige
 *    rien, il rend la géométrie réelle.
 *  · Clusters MULTI-COUS (hydre, chimère, déchiqueteur) : leur art de profil est mono-pièce, porté
 *    par l'os `encolure` (`QuadHeadDef.bone.profile === 'encolure'`). La rencontre tête↔encolure
 *    n'existe alors PAS comme couture — `gorge` vaut `null` dans cette vue. Exemption
 *    STRUCTURELLE, lue sur la def : jamais une liste d'espèces.
 */
import { buildQuadSkeleton, quadSkeletonForView, type QuadBoneId, type QuadProps, type QuadSkeleton } from './quadSkeleton';
import { quadHeadDef, quadHeadBone } from './heads';
import type { View } from '../facing';

/** Une ligne d'interface, dans le repère LOCAL de son os propriétaire. */
export interface QuadInterface {
  /** Os PROPRIÉTAIRE : le repère dans lequel `x`/`y` s'entendent. */
  os: QuadBoneId;
  /** Os VOISIN, celui que la part propriétaire doit recouvrir à cette ligne. */
  voisin: QuadBoneId;
  x: number;
  y: number;
  /** Épaisseur déclarée de l'os propriétaire (u de son repère) — largeur de référence de la ligne. */
  epaisseur: number;
  /** Épaisseur déclarée de l'os voisin — c'est d'ELLE que se déduit un seuil de recouvrement. */
  epaisseurVoisin: number;
}

export type QuadInterfaceId = 'gorge' | 'garrot' | 'epaule' | 'hanche' | 'naissanceQueue';
/** `gorge` est `null` là où la couture tête↔encolure n'existe pas (cluster multi-cous). */
export type QuadInterfaces = { gorge: QuadInterface | null } & Record<Exclude<QuadInterfaceId, 'gorge'>, QuadInterface>;

/** Interface au PIVOT d'un os : la jonction que le squelette déclare lui-même. */
const auPivot = (sk: QuadSkeleton, os: QuadBoneId, voisin: QuadBoneId): QuadInterface => ({
  os,
  voisin,
  x: sk[voisin].pivot.x,
  y: sk[voisin].pivot.y,
  epaisseur: sk[os].thickness,
  epaisseurVoisin: sk[voisin].thickness,
});

/**
 * Les cinq interfaces d'une espèce pour une vue. PUR (aucune lecture de registre d'espèces : la
 * fonction ne connaît que les props qu'on lui donne).
 */
export function quadInterfaces(p: QuadProps, view: View = 'profile'): QuadInterfaces {
  const sk = quadSkeletonForView(buildQuadSkeleton(p), view);
  // GORGE — repère de la TÊTE. L'os `tete` pivote SUR la jonction tête↔cou : la gorge est donc
  // l'origine du repère de tête, et l'encolure est l'os que l'art de tête doit y recouvrir.
  const teteSurEncolure = quadHeadBone(quadHeadDef(p.head), view) === 'encolure';
  const gorge: QuadInterface | null = teteSurEncolure ? null : {
    os: 'tete', voisin: 'encolure', x: 0, y: 0,
    epaisseur: sk.tete.thickness, epaisseurVoisin: sk.encolure.thickness,
  };
  // GARROT — repère de l'ENCOLURE. L'os `encolure` pivote sur le garrot : sa base est l'origine
  // de son repère, et le tronc est l'os qu'elle doit y recouvrir.
  const garrot: QuadInterface = {
    os: 'encolure', voisin: 'tronc', x: 0, y: 0,
    epaisseur: sk.encolure.thickness, epaisseurVoisin: sk.tronc.thickness,
  };
  return {
    gorge,
    garrot,
    // ÉPAULE — repère du TRONC, au pivot de l'antérieur PROCHE (`hautAvD`, celui que l'œil voit
    // par-dessus le flanc en profil) : c'est le squelette qui déclare où le membre s'attache.
    epaule: auPivot(sk, 'tronc', 'hautAvD'),
    // HANCHE — repère de la CROUPE, au pivot du postérieur PROCHE (`hautArD`).
    hanche: auPivot(sk, 'croupe', 'hautArD'),
    // NAISSANCE DE QUEUE — repère de la CROUPE, au pivot de la queue.
    naissanceQueue: auPivot(sk, 'croupe', 'queue'),
  };
}

/** Ligne d'ART : un point du repère d'un os, dérivé d'une articulation. Pas d'épaisseur ni d'os
 *  voisin — rien ne s'y attache, c'est un repère de dessin. */
export interface QuadArtLine { os: QuadBoneId; x: number; y: number }

/**
 * Ligne d'ART déclarée en DÉCALAGE depuis une articulation, dans le repère de l'os propriétaire de
 * celle-ci (`base.os`). Le décalage est un littéral d'ARTISTE, assumé comme tel ; le point d'appui,
 * lui, reste une fonction de l'espèce — l'art suit donc le squelette d'une espèce à l'autre sans
 * qu'aucune coordonnée d'espèce ne soit recopiée.
 */
export const artLine = (base: QuadInterface, dx: number, dy: number): QuadArtLine =>
  ({ os: base.os, x: base.x + dx, y: base.y + dy });
