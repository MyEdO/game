/**
 * Registre des GABARITS CORPORELS — indirige le rendu d'une créature vers son plan corporel.
 * UNE machinerie (FK générique + palette + facing) ; chaque
 * plan apporte son squelette + ses anims (poses). TOUT est registry-driven : `bodyPlanById` dérive
 * le plan de l'espèce EXPLICITE du record via `creatures/defs/`, et la table PLANS est AUTO-ENREGISTRÉE depuis
 * `plans/defs/` — AJOUTER un gabarit = un module compose (BodyPlan exporté) + un `plans/defs/<id>.ts`
 * d'une ligne + des defs de créatures. ZÉRO édition de ce fichier.
 */
import type { BonePose } from './poses';
import type { ResolvedBone } from './composeRig';
import type { View } from './facing';
import type { Palette } from './palette';
import { asRigSpeciesId, type Appearance, type RigSpeciesId } from './appearance';
import type { EquipCtx } from './parts/equipment';
import { PLAN_LIST } from './plans/_registry.generated';
import { defById, speciesScale } from './creatures';
import { findCreatureById, findTrappingById, findVehicleById } from '../../data';
import { isSwarm } from '../../engine/traits/dispatch';
import { DEFAULT_RACE_ID } from './races';
import { diagOnce, diagSubject } from './devDiag';
import { eyesArtFromKeys } from './parts/eyes';
import type { EntityAppearance } from '../../engine/authoringAppearance';
import { fauteDEspece, estFormeDeNuee } from '../../data/schemas/grammaire/art';

/** Identifiant de gabarit — chaîne libre dérivée des `plans/defs/` (data-driven : chaque plan
 *  déclare son `id`). Le monolithique n'est PAS un BodyPlan (fallback legacy hors registre). */
export type BodyPlanId = string;

/** État des AILES d'un gabarit ailé : REPLIÉES le long du dos (repos) ou DÉPLOYÉES (vol/
 *  attaque/mort étalée). Décidé par l'animation (usePlanAnim) — l'art change, pas que l'angle. */
export type WingState = 'folded' | 'spread';

/** Options de résolution communes (le bipède lit appearance/equip/tenue ; tous lisent colors). */
export interface ResolveOpts {
  colors?: Palette;
  tenue?: string;
  appearance?: Appearance;
  equip?: EquipCtx;
  /** Gabarit AILÉ seulement : état des ailes (défaut 'folded' — une bête posée replie). */
  wings?: WingState;
  /** Yeux personnalisés (ARTS du catalogue, déjà résolus) — appliqués sur les ancres
   *  `data-eye` des têtes de gabarit (quad/ailé). Sans ancre → no-op. */
  eyes?: { G?: string; D?: string };
  /** Gabarit QUADRUPÈDE seulement : id d'un SET d'équipement du registre `quadruped/harnais`
   *  (sellerie…), apposé au canal `deco` par-dessus l'art de l'espèce. Les autres gabarits
   *  l'ignorent. */
  harnais?: string;
}

export interface BodyPlan {
  id: BodyPlanId;
  /** (espèce, vue, pose, opts) → os résolus (boîte 120×150, pieds au sol), triés z. */
  resolve(species: string, view: View, pose: BonePose, opts?: ResolveOpts): ResolvedBone[];
  speciesNames(): string[];
  restPose(): BonePose;
  walkPose(phase: number): BonePose;
  attackPose(phase: number): BonePose;
  deathPose(): BonePose;
  /** Pose d'attaque propre au TYPE d'attaque de créature (`AttackKind` : morsure, caudale, souffle…).
   *  `null`/absente → `attackPose` du plan. Un gabarit déclare ainsi son propre jeu de gestes, sans
   *  que l'animateur ait à connaître l'id du gabarit. */
  attackKindPose?(kind: string, phase: number): BonePose | null;
  /** RECUL d'impact (touché / attaque esquivée) à l'amplitude `k` (0..1). Absente → repli générique :
   *  l'INVERSE atténué du geste d'attaque du plan (retrait anatomiquement juste sans connaître ses os). */
  flinchPose?(k: number): BonePose;
  /** viewBox du DISQUE-PORTRAIT (vue du dessus / inspection / VsHeader) cadrant ce gabarit, dans le
   *  repère de corps 120×150. Absent → défaut générique créature (`CREATURE_BOX`, haut-avant). Un corps
   *  STATIQUE ANCRÉ AU SOL (engin de siège) occupe le BAS de la boîte → il cadre son PROPRE bloc, sinon
   *  le portrait est vide (l'art tombe sous le cadre haut-avant). */
  portraitBox?: string;
  /** Anim de repos jouée EN CONTINU par AnimatedPlanToken (battement d'ailes, ondulation de
   *  serpent/pieuvre, dodelinement d'oiseau, frémissement d'araignée). Absente → idle figé. */
  idlePose?(phase: number): BonePose;
  /** BOND (trait LDB 85) : démarche bondissante jouée à la place de walkPose quand le
   *  combattant a le trait — ramassé/détente cyclique. Absente → walkPose (repli). */
  leapPose?(phase: number): BonePose;
  hasView(species: string, view: View): boolean;
}

/** Table des gabarits DÉRIVÉE des fichiers `plans/defs/` (auto-enregistrés via le codegen) —
 *  sans registre central à éditer. Ajouter un gabarit = déposer `plans/defs/<id>.ts`. */
const PLANS: Record<string, BodyPlan> = Object.fromEntries(PLAN_LIST.map((p) => [p.id, p]));
export function planById(id: BodyPlanId): BodyPlan {
  return PLANS[id];
}

/**
 * Plan corporel d'un id de créature (RECORD). ENTIÈREMENT dérivé des `defs/` : chaque def
 * non-bipède porte son `plan` (gabarit rigué). Ajouter/router une créature = un fichier def, ZÉRO
 * édition ici. La résolution lit l'espèce EXPLICITE du record (`appearance.species`) — plus AUCUNE
 * devinette par libellé. Défaut = bipède Humain (record sans espèce).
 */
export function bodyPlanById(id: string): BodyPlanId {
  return resolveById(id).plan; // délègue au résolveur unique
}

/** Résolution de rendu d'un id de créature (RECORD) — = `resolveRender(undefined, traits du record, id)`.
 *  L'espèce vient de `appearance.species` du record ; sans espèce explicite → bipède Humain. */
export function resolveById(id: string): RenderResolution {
  return resolveRender(undefined, findCreatureById(id)?.traits, id);
}

/** Résout une ESPÈCE CANONIQUE connue (nom de def, lookup EXACT) → {kind,plan,species,scale}. Pour les
 *  OUTILS dev (galeries/QC) et tests qui partent d'un NOM D'ESPÈCE, jamais d'un id de record. Passe par
 *  la branche espèce-explicite (l'arg gagne) → EXACT-only, plus aucun match flou par libellé. */
export function resolveSpecies(species: string): RenderResolution {
  return resolveRender(species, undefined, species);
}

/** Opts de rendu de GABARIT portées par l'apparence d'un RECORD de créature (`creatures.json`) —
 *  pendant plan d'`enemyRigProfile` (bipède), consommé par TOUS les sites qui rendent un plan
 *  (tokens iso, POV, aperçu de Codex, galeries, goldens). Une seule précédence PAR CHAMP (même
 *  formule que `rigAppearance`, le pendant bipède) : apparence VIVANTE (`Combatant.appearanceOverride`,
 *  `SceneEntity.appearance`, apparence en cours d'édition) passée en `override` → record. Un `colors`
 *  d'override remplace donc l'objet `colors` ENTIER du record, il ne s'y fusionne pas.
 *  Les deux entrées portent la forme d'AUTHORING (`eyes` = clés du catalogue `EYE_OPTIONS`) — résolue
 *  en ARTS ici, une seule fois, pour tout le monde. PURE.
 *  `armurePortee` (2 records de plan : demigriffon-adulte, destrier-squelettique) relève du canal
 *  BIPÈDE (`synthArmour`) ; `ResolveOpts` ne le porte pas. */
export function planOptsForRecord(recordId: string | undefined, override?: EntityAppearance): ResolveOpts {
  const rec = recordId ? findCreatureById(recordId)?.appearance : undefined;
  return {
    colors: override?.colors ?? rec?.colors,
    eyes: eyesArtFromKeys(override?.eyes) ?? eyesArtFromKeys(rec?.eyes),
    harnais: override?.harnais ?? rec?.harnais,
  };
}

/** Résolution de rendu UNIFIÉE et 100% DATA-DRIVEN (de-POC P5/5d) : classe (rig/gabarit), id de
 *  gabarit, espèce canonique et échelle de token. Résout par la DONNÉE — espèce explicite (arg) →
 *  espèce du RECORD (`findCreatureById(id).appearance.species`) → bipède Humain. Trait Nuée → 'swarm'.
 *  PLUS aucun repli par libellé/nom d'auteur (le 3ᵉ arg ne sert qu'au record + match véhicule).
 *  3ᵉ arg = `id` de créature (scènes/spawn) ; une ESPÈCE explicite passe par le 1er arg (cf. resolveSpecies). */
export type RenderResolution =
  | {
    kind: 'rig';
    plan: 'biped';
    /** Espèce d'origine CODE : l'espèce d'auteur est jugée ici, en amont (`fauteDEspece`). */
    species: RigSpeciesId;
    scale: number;
    /** `species` est la race par DÉFAUT d'une donnée sans espèce (ni explicite, ni record, ni affût, ni véhicule). */
    repli?: true;
  }
  | { kind: 'plan'; plan: BodyPlanId; species: string; scale: number };

/** Corps d'ERREUR (`plans/defs/manquant.ts`) d'une espèce d'auteur que le rendu refuse, `faute` nommée. */
function especeManquante(espece: string, sujet: string | undefined, faute: string): RenderResolution {
  if (import.meta.env?.DEV) diagOnce(`bodyPlan:manquant:${sujet ?? diagSubject()}:${espece}`, () => console.error(`[bodyPlan] « ${sujet ?? (diagSubject() || '(sans réf)')} » : ${faute}`));
  return { kind: 'plan', plan: 'manquant', species: espece, scale: 1 };
}
export function resolveRender(species: string | undefined, traits: import('../../engine/statEntry').TraitList | undefined, idOrName: string | undefined): RenderResolution {
  // Véhicule À COQUE → gabarit routé par la PROPULSION (`hull.propulsion`), DATA-DRIVEN. Prioritaire (un
  // nom de véhicule ne tombe pas sur la résolution créature). Navire (mer/fleuve) : l'ID de véhicule pilote
  // la silhouette (art de coque `SHIP_ARTS`, id sans art dédié → repli VISIBLE `orientedArtOr`/#223),
  // l'échelle vient de la longueur (`ship.lengthM`). Terrestre (attelage) : gabarit `terrestre` — un
  // chariot ne peut PLUS retomber par accident sur la coque de navire.
  const veh = idOrName ? findVehicleById(idOrName) : undefined;
  if (veh?.hull) {
    const prop = veh.hull.propulsion;
    if (prop === 'maritime' || prop === 'fluvial')
      return { kind: 'plan', plan: 'navire', species: veh.id, scale: Math.max(0.7, Math.min(2.4, (veh.ship?.lengthM ?? 20) / 20)) };
    if (prop === 'terrestre')
      return { kind: 'plan', plan: 'terrestre', species: veh.id, scale: 0.9 };
    // Propulsion inconnue (JSON hors schéma) = erreur de DONNÉE, bruyante en dev — PAS un repli muet vers
    // la coque (un attelage rendu en bateau était le bug). On tombe dans la résolution générique (bipède,
    // visiblement faux) plutôt qu'un navire silencieux.
    // `?.` : bodyPlan est importé par les scripts tsx (galeries), où `import.meta.env` n'existe pas.
    if (import.meta.env?.DEV) diagOnce(`bodyPlan:propulsion:${idOrName}`, () => console.error(`[bodyPlan] véhicule « ${idOrName} » : propulsion « ${prop} » sans gabarit de rendu — donnée à corriger.`));
  }
  const rec = findCreatureById(idOrName);
  // Espèce d'AUTEUR (argument explicite ou `appearance.species` du record) : jugée contre le domaine de
  // saisie du schéma, jamais rendue en l'art d'une autre espèce.
  const resolved = species ?? rec?.appearance?.species;
  const faute = resolved === undefined ? null : fauteDEspece(resolved);
  if (resolved && faute) return especeManquante(resolved, idOrName, faute);
  // Nuée NON typée (aucune espèce de forme) → forme GÉNÉRIQUE (DEFAULT_FORM de composeSwarm via '').
  // Ce défaut vaut pour LA VOIE bodyPlan : `src/gameIso/usePlanAnim.ts:113` retombe, lui, sur la 1re
  // forme du registre (`species || plan.speciesNames()[0]`) — divergence latente consignée à #1537.
  const swarmSp = '';
  if (isSwarm(traits)) {
    // Même résolution que la branche bipède : espèce explicite → espèce du RECORD → défaut Nuée.
    // (Sans ça, une Nuée au record typé — « Nuée de squigs » → Squig — perdait son espèce.)
    const sp = resolved ?? swarmSp;
    return { kind: 'plan', plan: 'swarm', species: sp, scale: speciesScale(sp) };
  }
  // Résolution par la DONNÉE : espèce EXPLICITE (arg) → espèce du record, jamais un repli par libellé.
  if (resolved) {
    if (estFormeDeNuee(resolved)) return especeManquante(resolved, idOrName, `espèce « ${resolved} » : forme de nuée sans le trait Nuée — le personnage s'affiche en silhouette d'erreur.`);
    const d = defById(resolved);
    if (d && d.plan !== 'biped') return { kind: 'plan', plan: d.plan, species: resolved, scale: speciesScale(resolved) };
    return { kind: 'rig', plan: 'biped', species: asRigSpeciesId(resolved), scale: speciesScale(resolved) };
  }
  // Engin de siège : `idOrName` n'est PAS une créature mais un TRAPPING à art d'affût (`siegeRig`, ex.
  // 'baliste'/'canon-petit') → ce rig pilote la silhouette (plan 'engin'). L'apparence est DÉRIVÉE de la
  // ref : un emplacement servi (éditeur/scène) ou un affût-combattant n'a plus besoin d'`appearance.species`.
  if (!rec) {
    const siegeRig = idOrName ? findTrappingById(idOrName)?.siegeRig : undefined;
    if (siegeRig) {
      const d = defById(siegeRig);
      if (d && d.plan !== 'biped') return { kind: 'plan', plan: d.plan, species: siegeRig, scale: speciesScale(siegeRig) };
      if (import.meta.env?.DEV) diagOnce(`bodyPlan:siegeRig:${siegeRig}`, () => console.error(`[bodyPlan] affût « ${siegeRig} » : aucune def de rendu (plan non bipède) — l'engin serait dessiné en humanoïde ; def à ajouter dans creatures/defs.`));
      return { kind: 'rig', plan: 'biped', species: asRigSpeciesId(siegeRig), scale: speciesScale(siegeRig) };
    }
  }
  // Record sans espèce mais trait Nuée (les records Nuée, si le caller n'a pas passé les traits).
  if (isSwarm(rec?.traits)) return { kind: 'plan', plan: 'swarm', species: swarmSp, scale: speciesScale(swarmSp) };
  // Rien de résolu : ni espèce explicite, ni record, ni affût, ni véhicule = donnée MANQUANTE, bruyante
  // en dev (même patron que la branche « propulsion inconnue » de cette même fonction) — le rendu retombe sur la race par DÉFAUT
  // DÉCLARÉE en donnée (`speciesRace.json`), visiblement fausse, jamais une espèce inventée en code.
  const sujet = idOrName ?? diagSubject(); // sans réf, le sujet est celui posé par l'appelant (scène/entité)
  if (import.meta.env?.DEV) diagOnce(`bodyPlan:espece:${sujet}`, () => console.error(`[bodyPlan] « ${sujet || '(sans réf)'} » : aucune espèce résolue (ni Espèce explicite, ni record de créature) — donnée à corriger.`));
  return { kind: 'rig', plan: 'biped', species: asRigSpeciesId(DEFAULT_RACE_ID), scale: speciesScale(DEFAULT_RACE_ID), repli: true };
}
