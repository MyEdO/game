/**
 * CharacterPreview — LA primitive d'aperçu « perso en pied » hors combat (roster, créateur,
 * fiche, marchand…). Rend le rig réel (`RigSprite`) : l'aperçu reflète EXACTEMENT le rendu jeu
 * (mêmes briques que tokenBodyKind, branche rig) — apparence d'état, équipement porté, tenue de
 * carrière, calques de mutations/blessures.
 *
 * Deux entrées exclusives :
 *  - bas niveau : `appearance` (+ `equip`/`career`/`overlays`) — créateur/éditeur, avant qu'un
 *    Combatant n'existe ;
 *  - haut niveau : `hero` (Combatant) — tout est dérivé via les briques canoniques
 *    (combatantAppearance/combatantOverlays/equipFromCombatant).
 *
 * AUCUN `<defs>` local : les dégradés fixes du rig (`defsGlobaux()`) sont montés UNE fois au niveau App
 * (GlobalSvgDefs). Tailles et ambiances en CSS (`.charprev`, components.css).
 */
import { memo, useMemo } from 'react';
import type { Combatant } from '../engine/types';
import { RigSprite, GROUND_Y, bodyHeight, rigComposition } from '../gameIso/rig/composeRig';
import { defaultAppearance, type Appearance } from '../gameIso/rig/appearance';
import { equipFromCombatant, type EquipCtx } from '../gameIso/rig/parts/equipment';
import { combatantAppearance, combatantOverlays } from '../gameIso/rig/parts/combatantVisuals';
import type { RigOverlay } from '../gameIso/rig/bones';
import type { Pose } from '../gameIso/rig/poses';
import type { View } from '../gameIso/rig/facing';

export type CharacterPreviewSize = 'xs' | 'sm' | 'md' | 'lg' | 'fill';
export type CharacterPreviewAmbiance = 'none' | 'panel' | 'parchment' | 'spotlight';

interface CommonProps {
  view?: View;
  pose?: Pose;
  mirror?: boolean;
  /** Hauteur du cadre : xs≈40px … lg≈190px ; `fill` = 100 % du conteneur. */
  size?: CharacterPreviewSize;
  /** Fond du cadre : `panel` (surface), `parchment`/`spotlight` (textures .tx-* d'ornaments.css). */
  ambiance?: CharacterPreviewAmbiance;
  /** Fraction de la hauteur du cadre `fill` occupée par le corps de gabarit (défaut `FILL_FRACTION`,
   *  0.88) — un consommateur en grille SERRÉE (cartes de race #431) peut demander un cadrage plus
   *  large (valeur plus basse) pour laisser respirer le visage plutôt que l'écraser au plein champ. */
  fillFraction?: number;
  /** TOISE COMMUNE d'une grille (cadre `fill`) : hauteur de corps de RÉFÉRENCE, dans les unités de
   *  `bodyHeight` — la figurine est alors cadrée à son ÉCHELLE VRAIE relative à cette toise (pieds
   *  sur la même ligne de sol), au lieu d'être normée à sa propre hauteur. L'appelant fournit la
   *  toise, typiquement `Math.max(...apparences.map(bodyHeight))` de sa grille : un halfling arrive
   *  alors à la ceinture de l'humain et l'ogre écrase sa tuile.
   *  Absent = normalisation PAR TUILE (défaut) — le bon cadrage quand les tuiles comparent des
   *  figurines de MÊME race (tuiles de carrière) : chacune remplit son cadre.
   *  Verdict user 2026-07-15 (#431, verbatim) : « ça ne permet pas de voir les différences de
   *  taille […] OK pour la carrière mais ici c'est un souci ». */
  scaleRef?: number;
  className?: string;
}
interface RawProps extends CommonProps {
  appearance: Appearance;
  equip?: EquipCtx;
  /** Id de garde-robe (tenue OU carrière) — la carrière d'un héros sert de tenue par défaut. */
  career?: string;
  overlays?: RigOverlay[];
  hero?: undefined;
}
interface HeroProps extends CommonProps {
  /** Sur-couche pratique : tout (apparence/équipement/tenue/calques) est dérivé du Combatant. */
  hero: Combatant;
  appearance?: undefined;
  equip?: undefined;
  career?: undefined;
  overlays?: undefined;
}
export type CharacterPreviewProps = RawProps | HeroProps;

const EMPTY_EQUIP: EquipCtx = { weapons: [], armour: [] };

/** viewBox statique de repli (repère de corps 120×150, pieds ancrés en y=150) — hors mode `fill`. */
const STATIC_BOX = '0 0 120 150';
/** Fraction de la hauteur du cadre `fill` occupée par le CORPS de gabarit (tête→pieds, #430 correctif
 *  « le modèle n'a pas grandi » puis « pourquoi le Ratier est plus petit que le Milicien, ce sont
 *  pourtant 2 humains » — la toise de normalisation est le GABARIT de la race, jamais la bbox rendue :
 *  un chapeau à plume ne doit PAS rétrécir le corps entier pour tenir dans le cadre). Le reste (12 %)
 *  = respiration au-dessus de la tête où les accessoires (plumes, cornes, capes) débordent librement —
 *  un extrême peut être clippé par l'enceinte (`overflow: hidden`), c'est acceptable. */
const FILL_FRACTION = 0.88;

const AMBIANCE_CLASS: Record<CharacterPreviewAmbiance, string> = {
  none: '',
  panel: 'charprev-amb-panel',
  parchment: 'charprev-amb-parchment tx-parchment',
  spotlight: 'charprev-amb-spotlight tx-ink',
};

function CharacterPreviewBase(props: CharacterPreviewProps) {
  const { view = 'front', pose, mirror = false, size = 'md', ambiance = 'none', fillFraction = FILL_FRACTION, scaleRef, className, hero } = props;
  // Dérivation « héros » = MÊMES briques que le rendu jeu (cf. tokenBodyKind, branche rig).
  const appearance = useMemo(
    () => (hero ? combatantAppearance(hero.appearance ?? defaultAppearance(hero), hero) : props.appearance),
    [hero, props.appearance],
  );
  const equip = useMemo(() => (hero ? equipFromCombatant(hero) : props.equip ?? EMPTY_EQUIP), [hero, props.equip]);
  const overlays = useMemo(() => (hero ? combatantOverlays(hero) : props.overlays), [hero, props.overlays]);
  const career = hero ? hero.career : props.career; // id de garde-robe (carrière), jamais un libellé
  // Composition mémoïsée sur le personnage, la vue et le sens ; l'élément sur la composition et la pose
  // (rendu en listes de 8-15) : mêmes entrées → même élément, React saute le sous-arbre.
  const comp = useMemo(() => rigComposition(appearance, equip, career, view, overlays, mirror), [appearance, equip, career, view, overlays, mirror]);
  const sprite = useMemo(() => <RigSprite comp={comp} pose={pose} />, [comp, pose]);
  const cls = ['charprev', `charprev-${size}`, AMBIANCE_CLASS[ambiance], className].filter(Boolean).join(' ');
  // Cadre `fill` (tuile plein-champ, #430) : viewBox resserré autour du CORPS DE GABARIT (pur,
  // `bodyHeight` — squelette race/carrure, jamais les accessoires) — pieds toujours ancrés en bas
  // (`groundSkeleton`, `GROUND_Y`), zoom UNIFORME (même aspect 120/150). Deux humains de gabarit
  // identique rendent donc à la MÊME hauteur de corps, coiffés d'une plume ou non.
  // La TOISE du cadrage est celle de la figurine (chacune remplit sa tuile) — sauf `scaleRef`, la
  // toise COMMUNE d'une grille (#431) : le viewBox devient alors le MÊME pour toutes les tuiles, et
  // chaque figurine n'y occupe que sa part RÉELLE, pieds sur la même ligne de sol.
  const viewBox = useMemo(() => {
    if (size !== 'fill') return STATIC_BOX;
    const toise = scaleRef && scaleRef > 0 ? scaleRef : bodyHeight(appearance);
    if (!(toise > 0)) return STATIC_BOX;
    const boxHeight = toise / fillFraction;
    const boxWidth = boxHeight * (120 / 150);
    return `${60 - boxWidth / 2} ${GROUND_Y - boxHeight} ${boxWidth} ${boxHeight}`;
  }, [size, appearance, fillFraction, scaleRef]);
  return (
    <div className={cls}>
      <svg className="charprev-svg" viewBox={viewBox} preserveAspectRatio="xMidYMax meet" aria-hidden="true">
        {sprite}
      </svg>
    </div>
  );
}

export const CharacterPreview = memo(CharacterPreviewBase);
