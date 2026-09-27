import type { Slot } from '../bones';
import { pickView, type Part, type PartArt } from './types';
import type { View } from '../facing';
import { toViewSet, splitBrasSvg, avantBrasBase, dominantCloth } from './derive';
import { cosmeticPart } from './cosmetic';
import { genericPart } from './generic';
import { tenueFor } from './career';
import { armourPart, armourMaterial, weaponPart, shieldPart, isShield, type EquipCtx } from './equipment';
import { ARMOUR, ARMOUR_PALETTES } from './armour';
import { CLAWFOOT, PLAINFOOT, HAND, MAIN_GRIFFUE, NECK } from './bodies/extremites';
import { tableDObjet, applyTokenMap } from '../palette';
import type { Sexe } from '../../../data/schemas/grammaire/valeurs';

/** Nu du PIED par ESPÈCE (#736 Lot 1) — repli quand aucune tenue/armure ne chausse la zone :
 *  civilisé lisse (défaut) ou monstrueux griffu (`race.extremites`/`perso.extremites`). */
const PIED_NU: Record<'lisses' | 'griffues', PartArt> = { lisses: PLAINFOOT, griffues: CLAWFOOT };

/** Nu de la MAIN par ESPÈCE (#736 Lot 3) — même principe que `PIED_NU` : civilisé (poing HAND,
 *  défaut) ou monstrueux griffu (`MAIN_GRIFFUE`). */
const MAIN_NUE: Record<'lisses' | 'griffues', PartArt> = { lisses: HAND, griffues: MAIN_GRIFFUE };

// Slots de corps résolus par la table de priorité GÉNÉRIQUE. Le membre supérieur (`bras`+`avantBras`)
// en est SORTI : il se résout comme une UNITÉ (l'avant-bras se DÉRIVE de l'art bras pleine longueur
// par découpe au coude, #633 D1) — cf. `resolveUpperLimb` plus bas.
const BODY_SLOTS: Slot[] = ['tete', 'torse', 'jambes'];

/** Applique la découpe au coude à CHAQUE VUE DÉCLARÉE d'un art `bras` pleine longueur (`side` = `haut`
 *  pour l'os épaule, `bas` pour l'os avant-bras rebasé). Une string = front-only (les vues absentes
 *  sont dérivées ensuite par `toViewSet`, déjà scindées au coude) ; un objet garde ses vues déclarées. */
function splitBrasArt(art: PartArt, side: 'haut' | 'bas'): PartArt {
  if (typeof art === 'string') return splitBrasSvg(art)[side];
  const out: { front: string; back?: string; profile?: string } = { front: splitBrasSvg(art.front)[side] };
  if (art.back != null) out.back = splitBrasSvg(art.back)[side];
  if (art.profile != null) out.profile = splitBrasSvg(art.profile)[side];
  return out;
}

const frontOf = (art: PartArt): string => (typeof art === 'string' ? art : art.front);

/** Vue `view` d'un art de DÉTAIL uniquement si la source la DÉCLARE (front toujours ; back/profile
 *  seulement s'ils sont présents) — sans FABRIQUER de silhouette (contrairement à `toViewSet`). Une vue
 *  non déclarée ⇒ '' : c'est la sous-couche de matière seule qui la couvre. */
function declaredView(art: PartArt, view: View): string {
  if (typeof art === 'string') return view === 'front' ? art : '';
  return art[view] ?? '';
}

/**
 * Résolution du MEMBRE SUPÉRIEUR (`bras`+`avantBras`) comme une UNITÉ (#633 D1).
 * BRAS : priorité override(→tenue.bras ?? générique) > armure > tenue.bras > générique. Un gagnant
 * d'ARMURE ou de `tenue.bras` est PLEINE LONGUEUR (épaule→poignet) → découpé au coude (`.haut`) ; le
 * générique est déjà court (épaule→coude) → laissé tel quel.
 * AVANT-BRAS : `tenue.avantBras` explicite prime (écoutille C, honoré tel quel) ; sinon, si le bras est
 * pleine longueur, une sous-couche de COUVERTURE (`avantBrasBase`) remplie de la MATIÈRE DOMINANTE du
 * bras gagnant (manche/armure) est peinte en 3 VUES, puis le DÉTAIL `.bas` de l'art bras est overlayé
 * PAR-DESSUS — mais UNIQUEMENT dans les vues que l'art `bras` source DÉCLARE (`declaredView`) : un art
 * front-only (cas ARMURE, string) n'a de détail QU'EN FRONT, ses back/profile = la sous-couche seule
 * (déjà correcte : acier pour la plaque, tissu pour la manche) — jamais un détail fabriqué par
 * `toViewSet` à partir du seul front, qui retomberait sur un fallback `@vet1` (l'incohérence front↔profil,
 * Lot 2c). Un art `bras` objet {front, back?, profile?} porte son propre `.bas` dans chaque vue déclarée.
 * Bras de chair (dominante `peau` : Nu/monstre) → l'avant-bras reste chair ; sinon le rect de peau dédié
 * `genericPart('avantBras')`. GAGNANT D'ARMURE (front-only) : la découpe ET la dérive de vues des DEUX
 * segments partent de l'art RAW de l'armure (`ARMOUR[mat].bras`, `@tokens` intacts) — ainsi
 * `dominantCloth`/les silhouettes dérivées voient `@metal` (pas le fallback `@vet1` d'un art déjà résolu
 * en hex, l'incohérence front↔profil du haut ET du bas, Lot 2c/2d) — PUIS `matterResolve` recolorie le
 * SVG FINAL des deux segments contre la palette de l'armure gagnante (le bras ne suit pas la palette du
 * porteur). Pour une TENUE, `matterResolve` est nul : les `@tokens` sont gardés et `composeRig` les résout
 * contre la palette du porteur.
 */
function resolveUpperLimb(
  tenue: ReturnType<typeof tenueFor>,
  equip: EquipCtx,
  overridden: boolean,
  boot: string,
  view: View,
): { bras: Part; avantBras: Part } {
  const brasTenue = tenue.bras;
  const armItem = overridden ? undefined : equip.armour.find((it) => armourPart(it, 'bras') != null);
  let matterArt: PartArt;                                        // art RAW porteur des tokens de matière
  let matterResolve: ((svg: string) => string) | null = null;   // recoloriage palette de l'armure gagnante
  let brasEstPleineLongueur: boolean;
  if (armItem) {
    const mat = armourMaterial(armItem);
    matterArt = ARMOUR[mat]?.bras ?? '';                         // tokens @metal/@cuir… intacts
    const map = tableDObjet([ARMOUR_PALETTES[mat] ?? {}], armItem.skin as Record<string, string> | undefined);
    matterResolve = (svg) => applyTokenMap(svg, map);
    brasEstPleineLongueur = true;
  } else {
    matterArt = brasTenue ?? genericPart('bras');
    brasEstPleineLongueur = brasTenue != null;
  }

  // BRAS HAUT : vues dérivées de l'art RAW (dominantCloth voit @metal/@cuir…), matière résolue au bout.
  const brasArt = brasEstPleineLongueur ? splitBrasArt(matterArt, 'haut') : matterArt;
  let brasSvg = toViewSet('bras', brasArt, { boot })[view];
  if (matterResolve) brasSvg = matterResolve(brasSvg);

  const avantTenue = tenue.avantBras;
  let avantSvg: string;
  if (avantTenue != null) {
    avantSvg = toViewSet('avantBras', avantTenue, { boot })[view];      // écoutille C : honoré tel quel
  } else if (brasEstPleineLongueur) {
    const base = avantBrasBase(dominantCloth(frontOf(matterArt)));      // couverture-matière (tokens RAW)
    const under = toViewSet('avantBras', base, { boot })[view];         // couverture en 3 vues, DERRIÈRE le détail
    const detail = declaredView(splitBrasArt(matterArt, 'bas'), view);  // détail .bas SEULEMENT si la vue est déclarée
    avantSvg = under + detail;
    if (matterResolve) avantSvg = matterResolve(avantSvg);              // matière d'armure résolue (tenue : tokens gardés)
  } else {
    avantSvg = toViewSet('avantBras', genericPart('avantBras'), { boot })[view];
  }

  return {
    bras: { svg: brasSvg },
    avantBras: { svg: avantSvg },
  };
}

/** Gagnant de la table de priorité pour une zone d'EXTRÉMITÉ (pied/main/cou), SANS repli : override
 *  éditeur (force la tenue, comme les slots de corps) > armure équipée > tenue. `undefined` = aucune
 *  source ne pilote la zone → l'appelant applique le repli d'espèce (extremites.ts). Miroir exact de
 *  la boucle `BODY_SLOTS`, hors `toViewSet` (ces parts restent en `pickView` direct, iso-rendu). */
function equipWinner(
  slot: Slot,
  overridden: boolean,
  equip: EquipCtx,
  tenueArt: PartArt | null | undefined,
): PartArt | null | undefined {
  if (overridden) return tenueArt;
  const armed = equip.armour.map((it) => armourPart(it, slot)).find((p) => p != null);
  return armed ?? tenueArt;
}

/**
 * Choisit une part par slot, par priorité :
 *   override éditeur > équipement porté > tenue de carrière > générique.
 * visage/cheveux : toujours (cosmétique espèce×sexe), variante via overrides/seed.
 * `view` choisit la vue (front/back/profile) de chaque part, avec fallback front.
 */
export function resolveParts(
  species: string,
  sex: Sexe,
  tenueKey: string | undefined,
  equip: EquipCtx,
  overrides: Partial<Record<Slot, number>>,
  seed: number,
  view: View = 'front',
  extremites: 'lisses' | 'griffues' = 'lisses',
): Record<Slot, Part | null> {
  const tenue = tenueFor(tenueKey);
  const out = {} as Record<Slot, Part | null>;
  const P = (art: PartArt | null | undefined): Part => ({ svg: pickView(art, view) });

  // Cosmétique (toujours). overrides priment, sinon variante dérivée du seed.
  out.visage = P(cosmeticPart('visage', species, sex, overrides.visage ?? seed % 2));
  out.cheveux = P(cosmeticPart('cheveux', species, sex, overrides.cheveux ?? (seed >> 2)));

  // Corps : PURE table de priorité (override → armure équipée → carrière → générique) → art `PartArt`
  // legacy, ENROBÉ en `ViewSet` TOTAL par le shim `toViewSet` (P1), qui matérialise les vues absentes
  // (silhouette dérivée, `derive.ts`) — plus AUCUNE branche par vue ni génération de silhouette ici.
  // `boot` = bas de jambe nu (@peau) quand la tenue ne chausse pas le pied (`tenue.pied` absent),
  // cuir sinon (#736 Lot 1).
  const boot = tenue.pied == null ? 'peau' : 'cuir';
  for (const slot of BODY_SLOTS) {
    const bslot = slot as 'torse' | 'jambes' | 'tete';
    const tenuePart = tenue[bslot];
    let art: PartArt | null | undefined;
    if (overrides[slot] != null) {
      art = tenuePart ?? genericPart(slot);
    } else {
      const armed = equip.armour.map((it) => armourPart(it, slot)).find((p) => p != null);
      art = armed ?? tenuePart ?? (slot === 'tete' ? '' : genericPart(slot));
    }
    out[slot] = { svg: toViewSet(bslot, art, { boot })[view] };
  }

  // Membre supérieur (#633 D1) résolu en UNITÉ : l'art `bras` authoré (armure/tenue) court épaule→
  // poignet et se DÉCOUPE au coude (`splitBrasSvg`) — le haut sert l'os épaule, le bas rebasé sert l'os
  // avant-bras. Le générique `bras` est DÉJÀ court (épaule→coude) : il ne se scinde pas et l'avant-bras
  // retombe alors sur son rect dédié `genericPart('avantBras')` (jamais le bas d'un art court = sliver).
  const upper = resolveUpperLimb(tenue, equip, overrides.bras != null, boot, view);
  out.bras = upper.bras;
  out.avantBras = upper.avantBras;

  // Pieds : même table de priorité que les slots de corps (override → armure → tenue → repli). Le
  // repli d'espèce = le Nu de l'ESPÈCE (`extremites`, lisse civilisé ou griffu monstrueux) —
  // aucune botte n'est plus un repli, une botte est TOUJOURS un habit porté (`tenue.pied`, #736 Lot 1).
  out.pied = P(equipWinner('pied', overrides.pied != null, equip, tenue.pied) ?? PIED_NU[extremites]);

  // Mains : même table de priorité, repli = Nu de l'ESPÈCE (poing HAND civilisé ou MAIN_GRIFFUE
  // monstrueux, #736 Lot 3) → agrippe l'arme/le bouclier, sinon l'arme « flotte » au bout de la manche ;
  // sous l'arme par z.
  out.main = P(equipWinner('main', overrides.main != null, equip, tenue.main) ?? MAIN_NUE[extremites]);

  // Cou : SURCOUCHE — NECK (chair d'espèce) TOUJOURS peint en sous-couche garantie (#633 P2), puis le
  // gagnant de la table (override → armure → tenue) peint PAR-DESSUS (col/gorgerin). Le cou nu reste
  // donc garanti même quand rien ne le pilote.
  const couGagnant = equipWinner('cou', overrides.cou != null, equip, tenue.cou);
  out.cou = { svg: pickView(NECK, view) + (couGagnant != null ? pickView(couGagnant, view) : '') };

  // Mains : arme principale (1re non-bouclier) à l'os `arme` ; main secondaire (os `bouclier`) =
  // bouclier si présent, sinon la 2e arme tenue (dual-wield non-bouclier : dague, main-gauche…) —
  // détectée par `hand:'off'`. Ainsi épée+bouclier ET épée+dague s'affichent (plus seulement la principale).
  const mainWeapon = equip.weapons.find((w) => !isShield(w));
  const offWeapon = equip.weapons.find((w) => w.hand === 'off' && !isShield(w) && w !== mainWeapon);
  out.arme = P(mainWeapon ? weaponPart(mainWeapon) : '');
  out.bouclier = P(equip.shield ? shieldPart(equip.shield) : offWeapon ? weaponPart(offWeapon) : '');

  return out;
}
