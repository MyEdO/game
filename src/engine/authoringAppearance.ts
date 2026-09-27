/**
 * Types d'APPARENCE d'authoring (sélections cosmétiques) — couche NEUTRE partagée : l'éditeur/scène
 * (`state`) les AUTHORE, le Combattant (`engine`, `Combatant.appearanceOverride`) les PORTE bruts, le
 * rig (`gameIso`) les RÉSOUT au rendu. Vivent ici (moteur) pour qu'aucun consommateur n'inverse les
 * couches (#187 : `Combatant` n'a plus à référencer `state/scene` pour son override d'apparence).
 * Structurels purs (aucune valeur SVG/rendu) : les arts résolus vivent dans `gameIso/rig`.
 */

import type { Sexe } from '../data/schemas/grammaire/valeurs';

/** Parts monstrueuses par slot (mutant modulaire : tête/bras choisis comme un PJ).
 *  Type structurel (pas d'import rendu) ; les valeurs valides sont offertes par l'éditeur. */
export interface MonsterPartsSel {
  tete?: string;       // 'chien' | 'lezard' | 'ogive' | 'minuscule' | …
  brasG?: string;      // 'tentacule' | 'griffe' | …
  brasD?: string;
  jambes?: string;     // 'chevre' | …
  cornes?: boolean;
  queue?: boolean;
  ailes?: boolean;     // ailes emplumées repliées dans le dos (harpie, démon ailé)
}

/** Personnalisation couleur (emplacements sémantiques ; résolus par le rig). */
export interface ColorsSel {
  peau?: string;
  cheveux?: string;
  yeux?: string; // iris
  vet1?: string; // vêtement principal
  vet2?: string; // vêtement secondaire
  cuir?: string;
  metal?: string;
  corps?: string; // pelage/robe des créatures (gabarits non-humains)
  accent?: string; // détail vif (crête, marque)
}

/** Override d'apparence (sinon seed dérivé de l'id). */
export interface EntityAppearance {
  seed?: number;
  /** Mutant modulaire : parts monstrueuses (rendu via le rig). */
  monster?: MonsterPartsSel;
  /** Personnalisation couleur (peau/cheveux/vêtements). */
  colors?: ColorsSel;
  /** Coiffure / visage épinglés (rig) : slot → index. */
  parts?: { cheveux?: number; visage?: number };
  /** Surcharges cosmétiques (sinon dérivées du seed). */
  sex?: Sexe;
  build?: number;
  /** Espèce/race CHOISIE — découple l'apparence du nom (label/ref) : 'Nains', 'Halflings',
   *  'Elfes'… (canonicalisée par `baseSpeciesOf`). Vide = dérivée du nom. */
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
