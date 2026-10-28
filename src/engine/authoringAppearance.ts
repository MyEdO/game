/**
 * Types d'APPARENCE — couche NEUTRE partagée : l'éditeur/scène (`state`) AUTHORE `EntityAppearance`, le
 * Combattant (`engine`) PORTE l'override brut (`Combatant.appearanceOverride`) et l'apparence résolue
 * (`Combatant.appearance`), le rig (`gameIso`) les RÉSOUT au rendu. Vivent ici (moteur) pour qu'aucun
 * consommateur n'inverse les couches (#187, #2884). Structurels purs (aucune valeur SVG/rendu) : les
 * valeurs et les arts résolus vivent dans `gameIso/rig`.
 */

import type { Sexe } from '../data/schemas/grammaire/valeurs';
import type { Slot as CleDePalette } from '../data/palette.types';
import type { GabaritId } from '../data/schemas/defs/gabarits';

/** Vocabulaire (marque NOMINALE, #406) : id RIG (slug d'espèce `species.json`, id de créature/race/
 *  véhicule/affût-de-siège) — jamais un `SpeciesData.label` (« Humains (Reiklander) »). UNE seule
 *  monnaie : un littéral `string` (dont un `.label`) n'est plus assignable à `Appearance.species`
 *  (échec STRUCTUREL). Deux producteurs sanctionnés : `rigSpeciesId` (pont rules→rig, `src/data/index.ts`)
 *  et `asRigSpeciesId` (validation d'un id déjà RIG, `gameIso/rig/appearance.ts`). */
export type RigSpeciesId = string & { readonly __rigSpeciesId: unique symbol };

/** Parts visuelles interchangeables du rig (os porteurs : `SLOT_BONES`, `gameIso/rig/bones.ts`). */
export type Slot =
  | 'visage' | 'cheveux' | 'cou'
  | 'tete' | 'bras' | 'avantBras' | 'torse' | 'jambes' | 'pied' | 'main'
  | 'arme' | 'bouclier';

/** Parts monstrueuses AUTHORÉES par slot (mutant modulaire : tête/bras choisis comme un PJ) — la forme
 *  de `entityAppearanceSchema.monster` (`data/schemas/grammaire/valeurs.ts`). Type structurel (pas
 *  d'import rendu) ; les valeurs valides sont offertes par l'éditeur. */
export interface MonsterPartsSel {
  tete?: string;       // 'chien' | 'lezard' | 'ogive' | 'minuscule' | …
  brasG?: string;      // 'tentacule' | 'griffe' | …
  brasD?: string;
  jambes?: string;     // 'chevre' | …
  cornes?: boolean;
  queue?: boolean;
  ailes?: boolean;     // ailes emplumées repliées dans le dos (harpie, démon ailé)
}

/** Sélection monstrueuse RÉSOLUE par slot (sur `Appearance.monster`) : la sélection authorée, plus les
 *  parts que posent les defs de créature. Tout est optionnel. Les lookups du rig
 *  (`gameIso/rig/parts/monstrous.ts`) tolèrent une clé inconnue (→ ignorée). */
export interface MonsterParts extends Omit<MonsterPartsSel, 'ailes'> {
  griffes?: boolean; // longues griffes aux mains (goule)
  verrues?: boolean; // peau verruqueuse + ventre pâle (troll) — casse l'aplat « blob »
  plaie?: boolean; // plaie de chair exposée (zombie)
  cape?: boolean; // col de cape dressé en éventail + crocs (vampire)
  membresRouges?: boolean; // bras/jambes rouge sang + stries au torse (démon bicolore)
  /** ailes repliées dans le dos — true = emplumées (harpie) ; 'cuir' = membrane (furie, démon). */
  ailes?: boolean | 'cuir';
}

/** Surcharge de couleur, par clé recoloriable de la palette du rig (`SLOTS`, `data/palette.types.ts`).
 *  Tout est optionnel. */
export type Palette = { [K in CleDePalette]?: string };

/** Override d'apparence (sinon seed dérivé de l'id). */
export interface EntityAppearance {
  seed?: number;
  /** Mutant modulaire : parts monstrueuses (rendu via le rig). */
  monster?: MonsterPartsSel;
  /** Personnalisation couleur (peau/cheveux/vêtements). */
  colors?: Palette;
  /** Coiffure / visage épinglés (rig) : slot → index. */
  parts?: { cheveux?: number; visage?: number };
  /** Surcharges cosmétiques (sinon dérivées du seed). */
  sex?: Sexe;
  build?: number;
  /** Espèce/race CHOISIE — découple l'apparence du nom (label/ref) : id RIG (`rigSpeciesVocab`, ex.
   *  `nain`, `halflings`), jamais un libellé (canonicalisée par `baseSpeciesOf`). Vide = dérivée du nom. */
  species?: string;
  /** Tenue CHOISIE — id STABLE de garde-robe (tenue ∪ carrière ∪ classe ∪ 'nu', jamais un libellé) :
   *  un PNJ porte n'importe quelle tenue (`mendiant`, `soldat`, `skaven`, `nu`…). Vide = dérivée du nom/espèce. */
  tenue?: string;
  /** Set d'ÉQUIPEMENT porté par une bête à gabarit quadrupède (ailés compris) — id STABLE d'un set
   *  du registre `gameIso/rig/quadruped/harnais` (sellerie, bât, barde). Deux formes distinctes :
   *  ABSENT = cette couche ne dit rien (sur un override d'instance, le record garde la main) ;
   *  `''` = NU explicite, qui gagne sur le record (déshabiller une monture harnachée par défaut). */
  harnais?: string;
  /** Armure de statblock (PA par localisation, sans inventaire) VISIBLE/portée — OPT-IN d'authoring
   *  (#774, #775) : le statblock de PA ne pilote pas l'apparence. Absent = les PA restent mécaniques
   *  PURS, aucun art d'armure synthétisé (`synthArmour`). */
  armurePortee?: boolean;
  /** Apparence des objets sans instance : id de trapping → référence au catalogue des apparences. */
  apparencesObjets?: Record<string, { id: string }>;
  /** Coiffure IMPOSÉE — id STABLE d'une coiffure (`hairstyles/defs`, jamais un index ni un libellé, #637).
   *  Vide = tirage sexe+ordre dérivé du seed. Hors du pool espèce×sexe : chevelure d'erreur visible au rendu. */
  hairstyle?: string;
  /** Yeux personnalisés (clés du catalogue `EYE_OPTIONS` : chat/caprin/reptilien/noir/rouge/
   *  verre) — remplacés EN PLACE sur l'orbite du visage. Vide = yeux normaux. */
  eyes?: { G?: string; D?: string };
  /** Traits de corps ADDITIFS — clés du catalogue d'éléments (`parts/elements.ts` : queue, cornes,
   *  oreilles-pointues, crocs, écailles…). N'importe quel PNJ peut en porter (perso. réutilisable). */
  features?: string[];
}

/** Descripteur d'apparence COSMÉTIQUE RÉSOLU (type pur ; l'engine ne le lit jamais). */
export interface Appearance {
  species: RigSpeciesId;
  gabarit?: GabaritId;                              // id de carrure résolu (sinon dérivé de l'espèce)
  sex: Sexe;
  build: number;                                   // 0..1
  legs?: number;                                   // multiplicateur de longueur de jambes (mutation Court sur pattes)
  faceFlip?: boolean;                              // visage retourné tête en bas (mutation Visage inversé)
  eyes?: { G?: string; D?: string };               // remplacement d'œil EN PLACE (art centré, cf. parts/eyes.ts)
  parts?: Partial<Record<Slot, number>>;           // overrides éditeur (index dans le pool par slot)
  hairstyle?: string;                              // coiffure IMPOSÉE par id stable (hairstyles/defs) — prime sur parts.cheveux/seed ; sinon tirage sexe+ordre
  monster?: MonsterParts;                          // parts monstrueux par slot (mutant modulaire)
  features?: string[];                             // CLÉS du catalogue d'éléments (parts/elements.ts) — traits ADDITIFS (queue, cornes, crocs…)
  colors?: Palette;                                // personnalisation couleur (peau/cheveux/vêtements)
  seed?: number;
}
