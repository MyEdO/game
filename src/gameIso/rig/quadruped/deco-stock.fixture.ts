/**
 * STOCKS GELÉS du canal `deco` du gabarit quadrupède (#1082) — un seul DÉTECTEUR, deux gardes :
 * le CONTRAT (`quad-anchor-contract.test.ts` : une clé qui vise une vue sans art rougit, sauf le
 * stock ci-dessous) et les CLIQUETS (`quad-vues-ratchet.test.ts` : les plafonds ne peuvent que
 * décroître, la population applicable ne se blanchit pas).
 *
 * Un COUPLE s'écrit `<espèce> <vue> <clé deco>` : c'est l'unité de mesure de tout ce fichier.
 * Ce module est un FIXTURE de test (jamais importé par le rendu) : il vit sous `src/` pour lire
 * le registre réel des créatures, à l'image de `src/scenes/test-fixture.ts`.
 */
import { CREATURES } from '../creatures';
import { quadParts, quadDecoFragments, type QuadLayer } from './quadParts';
import type { QuadBoneId, QuadProps } from './quadSkeleton';
import type { View } from '../facing';

export const DECO_VIEWS: View[] = ['profile', 'front', 'back'];

/** Art d'un os, calques concaténés dans l'ordre du peintre (plan croissant, tri STABLE) : ce que
 *  le rendu peint pour cet os, tous plans confondus — mesure de test (le rendu, lui, émet un os
 *  RÉSOLU par plan distinct, cf. `composeQuad`). */
export const quadLayersSvg = (ls?: QuadLayer[]): string =>
  [...(ls ?? [])].sort((a, b) => (a.plan ?? 0) - (b.plan ?? 0)).map((l) => l.svg).join('');

/** Les defs quadrupèdes/ailées du registre (le dénominateur de toute mesure de ce module). */
export const quadDecoDefs = (): { id: string; quad: QuadProps }[] =>
  CREATURES.filter((c) => c.quad).map((c) => ({ id: c.id, quad: c.quad as QuadProps }));

export interface DecoCouples {
  /** Couples APPLICABLES : la clé vise cette vue (clé nue = les trois). */
  applicables: string[];
  /** Couples MORTS : l'os visé ne porte AUCUN art dans cette vue → le décor est perdu. */
  morts: string[];
  /** Couples VIVANTS dont au moins un fragment ne déclare pas son `plan` (défaut historique). */
  sansPlan: string[];
}

/** DÉTECTEUR UNIQUE des couples `deco`×os×vue, listes triées. */
export function quadDecoCouples(): DecoCouples {
  const applicables: string[] = [], morts: string[] = [], sansPlan: string[] = [];
  for (const { id, quad } of quadDecoDefs()) {
    if (!quad.deco) continue;
    for (const view of DECO_VIEWS) {
      const nu = quadParts({ ...quad, deco: undefined }, view);
      for (const [cle, val] of Object.entries(quad.deco)) {
        const [os, vue] = cle.split('#') as [QuadBoneId, View | undefined];
        if (!val || (vue && vue !== view)) continue;
        applicables.push(`${id} ${view} ${cle}`);
        if (!nu[os]) morts.push(`${id} ${view} ${cle}`);
        else if (quadDecoFragments(val).some((f) => f.plan == null)) sansPlan.push(`${id} ${view} ${cle}`);
      }
    }
  }
  return { applicables: applicables.sort(), morts: morts.sort(), sansPlan: sansPlan.sort() };
}

/**
 * Stock GELÉ des ART-DEFS qui portent leur PROPRE repère (mesuré le 2026-08-05 sur le périmètre
 * ÉLARGI : l'art de tête de TOUTES les defs du registre, `deco` ou non, + tout os visé par une clé
 * `deco`) : un `<g transform=…>` enveloppant l'art de la part que `quadAnchor` ne reproduit PAS —
 * un décor authoré sur les coordonnées de cet art atterrirait dans un autre repère. Une entrée
 * s'écrit `<espèce> <vue> <os>`, suivie du transform mesuré. Ne peut que rétrécir, et ne peut pas
 * contenir d'entrée périmée : toute def à repère propre absente d'ici rougit, toute entrée d'ici
 * qui ne diverge plus rougit aussi.
 *  · 19 des 20 entrées sont des ROTATIONS : un mouvement RIGIDE, donc l'unité de la part reste
 *    celle de l'os (le décor y arriverait tourné, jamais redimensionné). C'est le port de tête de
 *    profil, cuit dans l'art faute d'axe de squelette qui le porte.
 *  · `boeuf profile tete` est le SEUL à porter une ÉCHELLE (0,84) : l'art de tête y vaut 1,31
 *    quand son décor de tête vaudrait 1,56 — 19 % d'écart d'unité entre une part et son propre
 *    raccord (mesure du juge de design, #1082). C'est le cas à solder au lot B2.
 */
export const REPERES_ART_PROPRES_GELES = [
  'basilic profile tete',    // rotate(6)
  'blaireau profile tete',   // rotate(6)
  'boeuf profile tete',      // translate(2 5) rotate(6) scale(0.84)  ← seule ÉCHELLE du stock
  'chat-sauvage profile tete', // rotate(4)
  'cheval profile tete',     // rotate(8)
  'chien profile tete',      // rotate(6)
  'crapaud profile tete',    // rotate(2)
  'grand-cerf profile tete', // rotate(8)
  'griffon profile tete',    // rotate(5)
  'hippogriffe profile tete', // rotate(5)
  'lion-de-guerre-de-chrace profile tete', // rotate(6)
  'loup profile tete',       // rotate(4)
  'manticore profile tete',  // rotate(6)
  'ours profile tete',       // rotate(6)
  'pegase profile tete',     // rotate(8)
  'rat-geant profile tete',  // rotate(16)
  'rat-loup profile tete',   // rotate(16)
  'sanglier profile tete',   // rotate(10)
  'stegadon profile tete',   // rotate(8)
  'varghulf profile tete',   // rotate(16)
];
export const PLAFOND_REPERES_ART_PROPRES = REPERES_ART_PROPRES_GELES.length;

/**
 * Stock GELÉ des couples MORTS (mesuré le 2026-08-05). Deux voies de solde étaient ouvertes :
 * (a) réaffectation MÉCANIQUE à un os émis, (b) art de bout à créer. Les 12 relèvent de (b),
 * chacun pour la raison notée : leur art est authoré dans les COORDONNÉES et la SILHOUETTE du
 * profil (festons, bandes le long de l'axe du cou, dents de scie de la ligne de dos) — reporté
 * tel quel sur le tronc ou la tête vus de bout, il peindrait une vue de côté sur une vue de face.
 * Le solde appartient donc à la phase d'ART (P1b). Ne peut que rétrécir.
 */
export const DECOS_MORTS_GELES = [
  // (b) FANON bovin : festons vus de CÔTÉ, pendus de la gorge au poitrail — le fanon de face du
  // bœuf vit déjà, à part, dans son deco de tronc (`tronc#front`).
  'boeuf back encolure',
  'boeuf front encolure',
  // (b) TACK du cheval : harnais contre-transformé dans le repère du tronc de PROFIL (sangle de
  // poitrail vue de côté) — de bout il faut un art de sanglage frontal.
  'cheval back encolure',
  'cheval front encolure',
  // (b) GORGERIN + collier à pointes du chien : bande d'acier tracée le long de l'axe du cou de
  // profil, plaque à tête de mort décalée sur la gorge — de bout, un art de collier annulaire.
  'chien back encolure',
  'chien front encolure',
  // (b) FANON du grand cerf : frange de toison dentelée le long du DEVANT de l'encolure tendue
  // (pose de brame) — la pose elle-même est refigée de bout (quadSkeletonForView).
  'grand-cerf back encolure',
  'grand-cerf front encolure',
  // (b) COLLIER doré du pégase : bande clouée suivant la courbe de l'encolure arquée de profil.
  'pegase back encolure',
  'pegase front encolure',
  // (b) CRÊTE de soies du sanglier : dents de scie qui courent garrot→croupe le long de la ligne
  // de dos, contre-calculées sur le tronc de profil — de dos, une crête vue en enfilade.
  'sanglier back encolure',
  'sanglier front encolure',
];
export const PLAFOND_DECOS_MORTS = DECOS_MORTS_GELES.length;

/**
 * Population GELÉE (mesurée le 2026-08-05) : les 79 couples APPLICABLES, dénominateur du stock
 * des morts. Un couple ne quitte cette liste que par un art émis (solde réel).
 */
export const APPLICABLES_GELES = [
  'blaireau back tete#back',
  'blaireau front tete#front',
  'blaireau front tronc#front',
  'blaireau profile tete#profile',
  'blaireau profile tronc#profile',
  'boeuf back encolure',
  'boeuf back tete#back',
  'boeuf back tronc#back',
  'boeuf front encolure',
  'boeuf front tete#front',
  'boeuf front tronc#front',
  'boeuf profile encolure',
  'boeuf profile tete#profile',
  'boeuf profile tronc#profile',
  'cheval back encolure',
  'cheval back tete',
  'cheval front encolure',
  'cheval front tete',
  'cheval profile encolure',
  'cheval profile tete',
  'chien back encolure',
  'chien back tronc',
  'chien front encolure',
  'chien front tronc',
  'chien profile encolure',
  'chien profile tronc',
  'grand-cerf back encolure',
  'grand-cerf back tete',
  'grand-cerf front encolure',
  'grand-cerf front tete',
  'grand-cerf profile encolure',
  'grand-cerf profile tete',
  'grand-cerf profile tete#profile',
  'griffon back basAvD',
  'griffon back basAvG',
  'griffon back hautArD',
  'griffon back hautArG',
  'griffon back hautAvD',
  'griffon back hautAvG',
  'griffon front basAvD',
  'griffon front basAvG',
  'griffon front hautArD',
  'griffon front hautArG',
  'griffon front hautAvD',
  'griffon front hautAvG',
  'griffon profile basAvD',
  'griffon profile basAvG',
  'griffon profile hautArD',
  'griffon profile hautArG',
  'griffon profile hautAvD',
  'griffon profile hautAvG',
  'lion-de-guerre-de-chrace profile piedAvD#profile',
  'manticore back tete',
  'manticore front tete',
  'manticore profile queue#profile',
  'manticore profile tete',
  'pegase back encolure',
  'pegase front encolure',
  'pegase profile encolure',
  'preyton back tronc',
  'preyton front tronc',
  'preyton profile tronc',
  'rat-geant back tete',
  'rat-geant front tete',
  'rat-geant profile tete',
  'sanglier back encolure',
  'sanglier back tete#back',
  'sanglier front encolure',
  'sanglier front tete#front',
  'sanglier profile encolure',
  'sanglier profile tete#profile',
  'sanglier profile tronc#profile',
  'varghulf back aileD',
  'varghulf back aileG',
  'varghulf front aileD',
  'varghulf front aileG',
  'varghulf profile aileD',
  'varghulf profile aileG',
  'varghulf profile tronc#profile',
];

/**
 * Stock GELÉ des couples VIVANTS sans `plan` déclaré (mesuré le 2026-08-05, transition N2 de la
 * spec P1 v2) : le défaut « calque apposé par-dessus l'art de l'os » reste TOLÉRÉ sur l'existant,
 * mais il est COMPTÉ et son plafond ne peut que décroître. Un couple hors de cette liste doit
 * déclarer son plan — toute NOUVELLE def sans plan rougit.
 */
export const DECOS_SANS_PLAN_GELES = [
  'blaireau back tete#back',
  'blaireau front tete#front',
  'blaireau front tronc#front',
  'blaireau profile tete#profile',
  'blaireau profile tronc#profile',
  'cheval back tete',
  'cheval front tete',
  'cheval profile encolure',
  'cheval profile tete',
  'chien back tronc',
  'chien front tronc',
  'chien profile encolure',
  'chien profile tronc',
  'grand-cerf back tete',
  'grand-cerf front tete',
  'grand-cerf profile encolure',
  'grand-cerf profile tete',
  'grand-cerf profile tete#profile',
  'griffon back basAvD',
  'griffon back basAvG',
  'griffon back hautArD',
  'griffon back hautArG',
  'griffon back hautAvD',
  'griffon back hautAvG',
  'griffon front basAvD',
  'griffon front basAvG',
  'griffon front hautArD',
  'griffon front hautArG',
  'griffon front hautAvD',
  'griffon front hautAvG',
  'griffon profile basAvD',
  'griffon profile basAvG',
  'griffon profile hautArD',
  'griffon profile hautArG',
  'griffon profile hautAvD',
  'griffon profile hautAvG',
  'lion-de-guerre-de-chrace profile piedAvD#profile',
  'manticore back tete',
  'manticore front tete',
  'manticore profile queue#profile',
  'manticore profile tete',
  'pegase profile encolure',
  'preyton back tronc',
  'preyton front tronc',
  'preyton profile tronc',
  'rat-geant back tete',
  'rat-geant front tete',
  'rat-geant profile tete',
  'sanglier back tete#back',
  'sanglier front tete#front',
  'sanglier profile encolure',
  'sanglier profile tete#profile',
  'sanglier profile tronc#profile',
  'varghulf back aileD',
  'varghulf back aileG',
  'varghulf front aileD',
  'varghulf front aileG',
  'varghulf profile aileD',
  'varghulf profile aileG',
  'varghulf profile tronc#profile',
];
export const PLAFOND_DECOS_SANS_PLAN = DECOS_SANS_PLAN_GELES.length;
