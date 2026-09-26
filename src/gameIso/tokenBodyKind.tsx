import type { ReactNode } from 'react';
import type { ViewMode } from '../geometry/iso';
import type { Combatant } from '../engine/types';
import type { SceneEntity } from '../state/scene';
import { isOutOfAction } from '../engine/conditions';
import { AnimatedRigToken } from './AnimatedRigToken';
import { RigToken } from './RigToken';
import { AnimatedPlanToken } from './AnimatedPlanToken';
import { enemyRigProfile, entityRigProfileFor, rendersFromOwnInventory, refOf } from './rig/enemyProfile';
import { planById } from './rig/bodyPlan';
import { diagOnce, withDiagSubject } from './rig/devDiag';
import { structureAppearance } from './catalog/structures';
import { isStructure } from '../engine/structures';
import { findCreatureById, findTrappingById, findVehicleById } from '../data';
import { combatantRender, entityRender, sceneEntityForRender } from './sizeScale';
import { useGame } from '../state/store';
import { entitySprite } from './sprites';
import { resolveRig, RigSprite } from './rig/composeRig';
import { defaultAppearance, type Appearance } from './rig/appearance';
import { equipFromCombatant, type EquipCtx } from './rig/parts/equipment';
import { combatantAppearance, combatantOverlays } from './rig/parts/combatantVisuals';
import { groundStateOf } from './groundPose';
import type { RigOverlay } from './rig/bones';

/**
 * Sujet à rendre comme token. Discriminé : combattant (combat), entité de scène
 * (exploration/éditeur) ou leader de groupe (jeton du groupe en exploration).
 */
export type TokenSubject =
  | { kind: 'combatant'; combatant: Combatant }
  | { kind: 'sceneEntity'; ent: SceneEntity; enrolled?: boolean }
  | { kind: 'partyLeader'; leader: Combatant };

export interface TokenBody {
  /** Famille de CORPS montée. `bakedDeath` se dérive : `bodyKind !== 'sprite'`. */
  bodyKind: 'rig' | 'plan' | 'sprite';
  /** Le CORPS (nœud React) à déposer chez l'appelant (pion-disque de la carte, vignette, planche QC). */
  body: ReactNode;
  /** Multiplicateur de taille d'espèce (bipède/créature) — la base reste au site appelant. */
  speciesScale: number;
  /** viewBox (repère 120×150 du corps) cadrant le VISAGE pour un portrait (RigPortrait / disque top).
   *  Humanoïde = gros plan tête ; créature = haut-avant (la tête varie selon le gabarit). */
  portraitBox: string;
  /** Vue du dessus : ce sujet doit être rendu en disque-portrait centré (true) ou billboard ancré (false). */
  flat: boolean;
}

/** Gros plan VISAGE d'un humanoïde (tête centrée ~(60,46) dans la boîte 120×150). */
const FACE_BOX = '42 28 38 38';
/** Cadre PORTRAIT d'une créature non-bipède : haut-avant du corps (générique, raffinable par gabarit). */
const CREATURE_BOX = '22 14 80 80';
/** Cadre PORTRAIT d'un gabarit : sa propre boîte (`plan.portraitBox`) ou le défaut créature haut-avant.
 *  Un engin de siège (ancré au sol) cadre son bloc BAS, là où le défaut haut-avant ne montrerait que du vide. */
const planPortraitBox = (planId: string): string => planById(planId)?.portraitBox ?? CREATURE_BOX;
/** Cadre PORTRAIT d'une structure de siège (centré sur le bloc crénelé ci-dessous). */
const STRUCT_BOX = '26 38 68 68';
/** Corps d'une STRUCTURE de siège (porte/rempart) : bloc de pierre crénelé ferré aux couleurs de
 *  l'apparence partagée (`mur-en-pierre`, palette pierre unifiée du JSON) — JAMAIS un bipède. Sert au
 *  portrait d'inspection / VsHeader de la modale d'attaque (le jeton de CASE, lui, est supprimé : la
 *  fortification se rend sur son arête, cf. `builders/tokens`). */
const STRUCT_APP = structureAppearance('mur-en-pierre');
const STRUCT_BODY = (
  <g>
    <rect x={34} y={50} width={52} height={64} fill={STRUCT_APP.face} stroke={STRUCT_APP.band ?? STRUCT_APP.face} strokeWidth={2} />
    <rect x={34} y={66} width={52} height={5} fill={STRUCT_APP.band ?? STRUCT_APP.face} />
    <rect x={34} y={90} width={52} height={5} fill={STRUCT_APP.band ?? STRUCT_APP.face} />
    <rect x={34} y={44} width={12} height={8} fill={STRUCT_APP.cap ?? STRUCT_APP.face} />
    <rect x={54} y={44} width={12} height={8} fill={STRUCT_APP.cap ?? STRUCT_APP.face} />
    <rect x={74} y={44} width={12} height={8} fill={STRUCT_APP.cap ?? STRUCT_APP.face} />
  </g>
);

/**
 * Vue de face cadrée sur le VISAGE (top-mode). Résout le rig en vue `front` et cadre le viewBox sur
 * l'os `tete` RÉSOLU (centré sur LE visage de chaque race — Nain/Ogre/… quelle que soit sa taille).
 * Math PURE, partagée par le pion-disque de la carte (`stage/TokenChromeOverlay`) ET la vignette HUD
 * (`RigPortrait`).
 */
function faceFrame(appearance: Appearance, equip: EquipCtx, tenue: string | undefined, overlays: RigOverlay[]): { body: ReactNode; box: string } {
  const bones = resolveRig(appearance, equip, {}, tenue, 'front', overlays);
  const tete = bones.find((b) => b.id === 'tete');
  const m = tete?.matrix ?? [1, 0, 0, 1, 60, 54];
  const sy = tete?.scale[1] ?? 1;
  const cx = m[4];
  const cy = m[5] + 10 * sy; // le visage est dessiné SOUS l'origine de l'os tete (crâne) → on descend le cadre
  const S = 46 * Math.max(0.9, sy); // cadre proportionnel à la taille de la tête (Ogre > Nain)
  return {
    body: <RigSprite appearance={appearance} equip={equip} career={tenue} view="front" overlays={overlays} />,
    box: `${(cx - S / 2).toFixed(1)} ${(cy - S / 2).toFixed(1)} ${S.toFixed(1)} ${S.toFixed(1)}`,
  };
}

/**
 * CLASSIFIEUR UNIQUE : décide quel backend monter (rig humanoïde / plan non-bipède / sprite)
 * et produit le corps prêt à insérer : la résolution de gabarit/profil
 * (`isHero / enemyRigProfile / entityRigProfile / bodyPlanById`) vit ICI, jamais au site appelant.
 *
 * `view: 'top'` (vue du dessus) → les ACTEURS deviennent un disque-portrait (vue de face cadrée,
 * `flat: true`) ; le décor reste un billboard de face (`flat: false`). En iso, comportement inchangé.
 *
 * NE porte AUCUNE info de layout (ombre/anneau/dim/échelle de base/walking) : ça reste au site
 * appelant (surcouche de jetons, planches QC). Les deux moteurs d'animation (rig à clips vs plan rAF)
 * restent DEUX backends distincts (asymétrie essentielle : parade/sort/clips d'arme côté rig).
 */
export function tokenBodyKind(subject: TokenSubject, view: ViewMode = 'iso'): TokenBody {
  const top = view === 'top';

  if (subject.kind === 'combatant') {
    const c = subject.combatant;
    // Structure de siège (`bodyShape:'structure'`) : fortification inerte → bloc de pierre crénelé, JAMAIS
    // un bipède Humain (`resolveRender` retomberait là-dessus, faute d'espèce). Invariant du classifieur.
    if (isStructure(c)) return { bodyKind: 'plan', speciesScale: 1, portraitBox: STRUCT_BOX, flat: top, body: STRUCT_BODY };
    // Résolution de rendu UNIQUE par la DONNÉE (espèce explicite + trait Nuée), repli `creatureId`
    // (id STABLE posé au spawn, cf. Combatant.creatureId) : classe (rig humanoïde vs gabarit créature),
    // plan, espèce canonique, échelle. `kind==='hero'` est surchargé (PJ bipède OU acteur allié — cheval
    // libre compris) → on route par le PLAN CORPOREL. `c.name` (LABEL d'affichage, multilangue) n'est
    // PLUS jamais la clé de résolution — repli ultime seulement pour un statbloc d'auteur sans id de
    // catalogue (`creatureId` absent, ex. ennemi générique nommé).
    const r = combatantRender(c);
    if (r.kind === 'rig') {
      const prof = rendersFromOwnInventory(c) ? null : enemyRigProfile(c);
      if (top) {
        const appearance = combatantAppearance(prof?.appearance ?? c.appearance ?? defaultAppearance(c), c);
        const equip = prof?.equip ?? equipFromCombatant(c);
        const tenue = prof?.tenue ?? c.career; // garde-robe = tenue du profil, sinon id de carrière (Combatant.career)
        const f = faceFrame(appearance, equip, tenue, combatantOverlays(c));
        return { bodyKind: 'rig', speciesScale: r.scale, portraitBox: f.box, flat: true, body: f.body };
      }
      return { bodyKind: 'rig', speciesScale: r.scale, portraitBox: FACE_BOX, flat: false, body: <AnimatedRigToken combatant={c} profile={prof ?? undefined} pos={c.pos} /> };
    }
    return { bodyKind: 'plan', speciesScale: r.scale, portraitBox: planPortraitBox(r.plan), flat: top, body: <AnimatedPlanToken id={c.id} planId={r.plan} species={r.species} recordId={c.creatureId} override={c.appearanceOverride} dead={groundStateOf(c) === 'corpse' || isOutOfAction(c)} prone={groundStateOf(c) === 'prone'} pos={c.pos} /> };
  }

  // JETON DE GROUPE : le seul sujet qui n'existe QU'EN DISQUE-PORTRAIT. En iso, le groupe est dessiné
  // par le monde volumique (`sceneMeshes.partyActorPose` → billboard), pas par ce classifieur : son
  // unique producteur est la marque de chrome (`builders/tokenChrome`), consommée par `TokenDisc` en
  // vue du dessus. Le corps porte le visage du MENEUR ; son cap, lui, ne passe jamais par ici — il se
  // lit à la clé publiée par `partyTokenOf` (`PartyToken.capKey`).
  if (subject.kind === 'partyLeader') {
    const leader = subject.leader;
    const f = faceFrame(combatantAppearance(leader.appearance ?? defaultAppearance(leader), leader), equipFromCombatant(leader), leader.career, combatantOverlays(leader));
    return { bodyKind: 'rig', speciesScale: 1, portraitBox: f.box, flat: true, body: f.body };
  }

  // sceneEntity (exploration + éditeur) — la résolution du preset de PNJ nommé (#671) et celle du
  // rendu vivent dans `sizeScale.ts`, partagées avec la voie volumique.
  const ent: SceneEntity = sceneEntityForRender(subject.ent);
  const id = `e-${ent.id}`;
  const refName = refOf(ent);
  // Décor (`kind:'prop'`) : routé par la NATURE de l'entité, JAMAIS par essai de registres. Le
  // catalogue de décor (`propSvg`, via `entitySprite`) est la SEULE source — `resolveRender` (créature/
  // véhicule) n'est même pas appelé : un id de décor peut collisionner avec un id de véhicule/créature
  // homonyme (ex. `chaise` meuble de `props.json` vs chaise à porteurs de `vehicles.json`) sans jamais
  // se faire happer par ce registre.
  if (ent.kind === 'prop')
    return { bodyKind: 'sprite', speciesScale: 1, portraitBox: FACE_BOX, flat: false, body: <g dangerouslySetInnerHTML={{ __html: entitySprite(ent) }} /> };
  // SUJET des diagnostics de donnée : `<scène>/<idEntité>` — une entité sans réf n'a aucune identité dans
  // `resolveRender`, et les ids d'entité ne sont uniques QUE dans leur scène (deux « aubergiste »).
  const sujet = `${useGame.getState().scene?.id ?? ''}/${ent.id}`;
  // Résolution UNIQUE par la donnée (espèce explicite de l'entité + trait Nuée du record), par id.
  const r = withDiagSubject(sujet, () => entityRender(ent));
  // Garde DEV : un personnage dont la `ref` n'est PAS un id de créature valide ET sans espèce explicite
  // tombe silencieusement en bipède Humain (jamais une devinette par le nom). Signale l'apparence perdue.
  // Un engin de siège (ref = trapping à art d'affût `siegeRig`) est résolu via la ref → pas un défaut perdu.
  // Une coque de véhicule (ref = id `vehicles.json` à facette `hull`, ex. navire) est résolue via la
  // même ref (`resolveRender`, branche véhicule ci-dessus l.117) → pas non plus un défaut perdu (#224).
  if (import.meta.env.DEV && ent.kind === 'personnage' && ent.ref && !ent.appearance?.species && !findCreatureById(ent.ref) && !findTrappingById(ent.ref)?.siegeRig && !findVehicleById(ent.ref)?.hull)
    diagOnce(`tokenBodyKind:ref:${sujet}`, () => console.warn(`[tokenBodyKind] entité « ${ent.id} » : ref « ${ent.ref} » non résolue (pas un id de créature) et sans Espèce (rig) → bipède Humain par défaut. Choisis une Espèce (rig) ou une réf de créature valide.`));
  const prof = ent.kind === 'personnage' ? withDiagSubject(sujet, () => entityRigProfileFor(ent, subject.enrolled)) : null;
  if (prof) {
    if (top) {
      const f = faceFrame(prof.appearance, prof.equip, prof.tenue, []);
      return { bodyKind: 'rig', speciesScale: r.scale, portraitBox: f.box, flat: true, body: f.body };
    }
    return { bodyKind: 'rig', speciesScale: r.scale, portraitBox: FACE_BOX, flat: false, body: <RigToken id={id} appearance={prof.appearance} equip={prof.equip} career={prof.tenue} ambientAnim={ent.anim ?? ''} facing={ent.facing} pos={ent.pos} /> };
  }
  if (r.kind === 'plan') {
    // Socle unique `planOptsForRecord` (il résout aussi les clés d'yeux du catalogue en arts) :
    // précédence PAR CHAMP — l'apparence de l'entité prime sur celle du record (`refName`).
    return { bodyKind: 'plan', speciesScale: r.scale, portraitBox: planPortraitBox(r.plan), flat: top, body: <AnimatedPlanToken id={id} planId={r.plan} species={r.species} recordId={refName} override={ent.appearance} facing={ent.facing} pos={ent.pos} /> };
  }
  return { bodyKind: 'sprite', speciesScale: 1, portraitBox: FACE_BOX, flat: false, body: <g dangerouslySetInnerHTML={{ __html: entitySprite(ent) }} /> };
}
