/**
 * BATTEMENT DE FRAME du stage — le rythme UNIQUE de tout ce qui bouge la VUE hors des rendus React :
 * la marche qui glisse, le glisser-caméra, l'adoucissement d'un saut de focale.
 *
 * Ses abonnés sont les DEUX clients de la caméra — le groupe d'overlays SVG de la surcouche de
 * plateau, recalé par l'hôte (`stage/MondeDeCampagne`), et la caméra
 * three (`stage/GameStage3D`, qui s'y abonne de lui-même). Ils reposent leur vue dans le MÊME
 * battement, à partir de la MÊME valeur (`camAt` de l'hôte) : c'est tout l'objet du module, et la
 * raison pour laquelle il n'y a qu'un battement pour toutes les sources.
 *
 * Trois façons de le faire battre, jamais deux boucles concurrentes : `battreStageFrames` pour qui
 * tient déjà une horloge (la boucle de marche `fx/useWalkAnim`, un `pointermove` que le navigateur
 * cadence déjà à l'image), `demanderFrames`/`relacherFrames` pour ce qui n'en a aucune
 * (l'adoucissement de focale, le fondu de la découpe locale `stage/percage`, `useBattementContinu`
 * pour un motif qui dure), et `demanderUneImage` pour un geste PONCTUEL qui n'a besoin que d'être VU
 * (la relève d'une texture de billboard). La boucle de demande comme la demande ponctuelle CÈDENT le
 * pas à ce qui vient d'avoir lieu, mais PAS à
 * la même chose — cf. les deux horloges ci-dessous.
 *
 * Une image a DEUX temps : le PRÉLUDE avance la vue (`subscribeStagePrelude`), les abonnés la lisent
 * et reposent ce qu'ils tiennent. C'est ce qui ôte à l'ordre d'inscription le pouvoir de décider qui
 * voit quel angle.
 */
import { useEffect } from 'react';

/** Écart (ms) en deçà duquel deux battements sont la MÊME image. */
const MEME_IMAGE_MS = 4;

const abonnés = new Set<() => void>();
const préludes = new Set<(now: number) => void>();
const sources = new Set<unknown>();
/** DERNIÈRE IMAGE PEINTE, d'où qu'elle vienne (battement ou commit React qui redessine) : la BOUCLE y
 *  cède le pas, car elle ne demande qu'un REDESSIN — ce qui vient d'être peint l'est déjà. */
let dernierePeinteMs = -Infinity;
/** DERNIER BATTEMENT servi : la demande PONCTUELLE n'y cède qu'à lui. Elle porte une peinture NEUVE
 *  (une texture relevée que l'image précédente ne montrait pas) : un commit React qui vient de peindre
 *  ne l'a pas servie, et l'avaler laisserait le billboard sans son art jusqu'à la frame suivante. */
let derniereBattementMs = -Infinity;
let image = 0;
let imagePonctuelle = 0;

/** S'abonne au battement : une passe par image, tant qu'une source en demande. */
export function subscribeStageFrames(cb: () => void): () => void {
  abonnés.add(cb);
  return () => {
    abonnés.delete(cb);
  };
}

/**
 * PRÉLUDE du battement — ce qui AVANCE la vue de l'image, avant que quiconque ne la LISE. Le lacet
 * continu y vit (`state/stageYaw.avancerLacet`) : ses lecteurs sont des abonnés ordinaires — la passe
 * de dessin du canevas volumique (`stage/GameStage3D`) et la reprojection d'overlays de l'hôte
 * (`stage/MondeDeCampagne`) — et l'ordre d'inscription dans un `Set` ne saurait décider lequel des
 * deux voit l'angle de son image et lequel voit celui de la précédente.
 *
 * Un prélude POSE la vue, il ne la lit pas : rien de ce qui peint n'a sa place ici.
 */
export function subscribeStagePrelude(cb: (now: number) => void): () => void {
  préludes.add(cb);
  return () => {
    préludes.delete(cb);
  };
}

/** UN battement : la vue avance (préludes), puis chaque abonné repose ce qu'il tient hors de React. */
export function battreStageFrames(): void {
  derniereBattementMs = performance.now();
  dernierePeinteMs = derniereBattementMs;
  for (const cb of [...préludes]) cb(derniereBattementMs);
  for (const cb of [...abonnés]) cb();
}

/**
 * UNE IMAGE VIENT D'ÊTRE PEINTE hors du battement — un commit React qui redessine le stage. Seule
 * l'horloge des PEINTES la voit : la boucle ne repeindra pas cette même image (mesuré sans elle : 4
 * rendus dans l'image d'un commit).
 *
 * Elle ne bat AUCUN abonné, et n'en prive aucun : la passe que cède la boucle est un REDESSIN, et le
 * rendu React qui l'accompagne repose déjà les surcouches de la même caméra (l'hôte écrit
 * `stageCamStyle` sur le groupe de la surcouche et `setVisibleTileBounds` DANS son rendu).
 * Elle ne touche PAS l'horloge des battements : une demande PONCTUELLE porte une peinture neuve, et
 * un commit ne l'a pas servie.
 */
export function signalerImagePeinte(): void {
  dernierePeinteMs = performance.now();
}

function armer(): void {
  if (image || !sources.size || typeof requestAnimationFrame !== 'function') return;
  image = requestAnimationFrame(() => {
    image = 0;
    if (!sources.size) return;
    // La boucle ne demande qu'un REDESSIN : elle cède à toute image déjà peinte, commit compris.
    if (performance.now() - dernierePeinteMs > MEME_IMAGE_MS) battreStageFrames();
    armer();
  });
}

/** Demande un battement CONTINU au nom de `source` — une clé d'INSTANCE (symbole, réf), jamais un nom
 *  global : deux écrans montés ne doivent pas se relâcher les images l'un de l'autre. */
export function demanderFrames(source: unknown): void {
  sources.add(source);
  armer();
}

/** Retire `source` ; la boucle s'arrête quand plus personne n'en demande. */
export function relacherFrames(source: unknown): void {
  sources.delete(source);
  if (sources.size || !image) return;
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(image);
  image = 0;
}

/** Demande UNE image, au prochain rAF — COALESCÉE : N demandes dans la même image n'en valent qu'une
 *  (les N boards reposés au franchissement d'un cran obtiennent UN battement, #1376).
 *  Elle s'efface devant une boucle continue, qui sert déjà l'image, et devant un BATTEMENT qui vient
 *  d'avoir lieu — et devant lui SEUL : ce qu'elle demande à montrer est neuf, un commit React qui
 *  vient de repeindre l'ancienne image ne l'a pas servi (sans quoi la texture relevée dans les 4 ms
 *  d'un commit n'entre jamais en scène). */
export function demanderUneImage(): void {
  if (imagePonctuelle || sources.size || typeof requestAnimationFrame !== 'function') return;
  imagePonctuelle = requestAnimationFrame(() => {
    imagePonctuelle = 0;
    if (sources.size) return;
    if (performance.now() - derniereBattementMs > MEME_IMAGE_MS) battreStageFrames();
  });
}

/** Combien de SOURCES tiennent le battement en ce moment — lecture seule, pour les bancs : c'est la
 *  seule façon de voir qu'un motif a RELÂCHÉ ses images (une pompe qui a convergé) quand un autre
 *  motif de la même scène en demande encore (un corps animé, une averse). Le compte de rappels rAF ne
 *  le dirait pas : la boucle n'en arme qu'UN pour toutes les sources. */
export function sourcesDeFrames(): number {
  return sources.size;
}

/** ARDOISE NEUVE — outil de BANC. La suite partage ses modules (`isolate: false`) : un écran d'un
 *  autre fichier resté monté tiendrait encore des images, et la boucle armée sur SON `requestAnimationFrame`
 *  ne se réarmerait jamais sur celui du banc courant.
 *  PORTÉE : les sources, l'image armée et les deux horloges — JAMAIS les abonnés ni les préludes. Un
 *  abonnement se dénoue par la fonction rendue à l'inscription (le démontage de l'écran) ; un abonné
 *  qui survit à son écran est un défaut de cet écran, qu'une ardoise complaisante cacherait à tous les
 *  bancs. */
export function resetStageFrames(): void {
  sources.clear();
  if (image && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(image);
  image = 0;
  imagePonctuelle = 0;
  dernierePeinteMs = -Infinity;
  derniereBattementMs = -Infinity;
}

/** Tient le battement unique du stage tant que `actif`, sous une clé d'INSTANCE : deux écrans montés ne
 *  se relâchent pas les images l'un de l'autre, et un motif éteint rend les siennes. */
export function useBattementContinu(actif: boolean, nom: string): void {
  useEffect(() => {
    if (!actif) return;
    const source = Symbol(nom);
    demanderFrames(source);
    return () => relacherFrames(source);
  }, [actif, nom]);
}
