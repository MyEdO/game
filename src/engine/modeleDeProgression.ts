/**
 * Modèles de progression par PX : le héros porte sa clé (`Combatant.progression`, absent = `'4e'`), choisie par clé
 * comme `bodyShape` choisit sa table de localisation (`hitLocationByShape`) ; chaque modèle porte en DONNÉE ce qui
 * diverge, chaque lecteur garde un seul corps. LDB 07 ; LDB 23 l.66-72, l.132-136 ; CRB 018 l.19-27, l.67-73 ;
 * CRB 045 ; CRB 048 l.45, l.72, l.214-226
 */
import type { Combatant } from './types';

export type CleDeProgression = '4e' | '5e';

/** Critère du passage au niveau suivant de la carrière : complétion du niveau (LDB 07 l.124), ou cases cochées depuis
 *  l'entrée au niveau, `seuils[niveau - 1]` (CRB 048 l.45). `cout` : PX du passage. */
export type PassageDeNiveau =
  | { type: 'completion'; cout: number }
  | { type: 'cases'; seuils: readonly number[]; cout: number };

/** Prix du tuteur d'Entraînement avant le doublement d'une Compétence avancée : un tirage en sous de cuivre, ou le coût
 *  en PX de l'Augmentation en sous de cuivre. */
export type TuteurDEntrainement = { type: 'tirage'; des: number; faces: number } | { type: 'coutEnPx' };

export interface ModeleDeProgression {
  /** Points ajoutés à la valeur par Augmentation. */
  pas: number;
  /** Coût de la prochaine prise d'un Talent : `base + parPrise × prises déjà faites`. */
  coutDuTalent: { base: number; parPrise: number };
  /** Talents de carrière achetables : ceux du niveau courant, ou ceux des niveaux ≤ courant. */
  porteeDesTalents: 'niveau' | 'cumul';
  /** Augmentation hors carrière : coefficient du coût, et Compétences avancées ouvertes à la dépense de PX. */
  horsCarriere: { coefficient: number; competencesAvancees: boolean };
  passage: PassageDeNiveau;
  /** Changement de carrière : base selon le niveau courant validé ou non, surcoût d'une autre Classe, descente
   *  volontaire dans la même carrière. */
  changement: { complete: number; incomplet: number; autreClasse: number; descente: boolean };
  /** Les règles optionnelles `progression-mentor` et `progression-saut-de-niveau` s'appliquent-elles ? */
  reglesOptionnelles: boolean;
  /** Entraînement : tuteur, et coefficient de son prix pour une Compétence avancée. */
  entrainement: { tuteur: TuteurDEntrainement; avancee: number };
  /** Apprentissage d'un Talent hors carrière : Test, Talent absent seul, tuteur `des`d`faces` pistoles d'argent par
   *  tranche de `parTranche` PX du Talent (`null` : un seul tirage). */
  apprentissage: { test: boolean; premierNiveauSeul: boolean; tuteur: { des: number; faces: number; parTranche: number | null } };
}

export const MODELES_DE_PROGRESSION: Readonly<Record<CleDeProgression, ModeleDeProgression>> = {
  '4e': {
    pas: 1, // LDB 07 l.47
    coutDuTalent: { base: 100, parPrise: 100 }, // LDB 07 l.105
    porteeDesTalents: 'niveau', // LDB 07 l.103
    horsCarriere: { coefficient: 2, competencesAvancees: true }, // LDB 07 l.91
    passage: { type: 'completion', cout: 100 }, // LDB 07 l.118, l.124
    changement: { complete: 100, incomplet: 200, autreClasse: 100, descente: true }, // LDB 07 l.118, l.137, l.144
    reglesOptionnelles: true, // LDB 07 l.89, l.140
    entrainement: { tuteur: { type: 'tirage', des: 1, faces: 10 }, avancee: 2 }, // LDB 23 l.136
    apprentissage: { test: true, premierNiveauSeul: false, tuteur: { des: 2, faces: 10, parTranche: 100 } }, // LDB 23 l.66-72
  },
  '5e': {
    pas: 5, // CRB 014 l.21 ; CRB 045 l.15
    coutDuTalent: { base: 100, parPrise: 0 }, // CRB 045 l.60
    porteeDesTalents: 'cumul', // CRB 045 l.58
    horsCarriere: { coefficient: 2, competencesAvancees: false }, // CRB 018 l.69
    passage: { type: 'cases', seuils: [10, 12, 14], cout: 100 }, // CRB 048 l.45
    changement: { complete: 100, incomplet: 100, autreClasse: 100, descente: false }, // CRB 048 l.72
    reglesOptionnelles: false,
    entrainement: { tuteur: { type: 'coutEnPx' }, avancee: 2 }, // CRB 048 l.216
    apprentissage: { test: false, premierNiveauSeul: true, tuteur: { des: 4, faces: 10, parTranche: null } }, // CRB 048 l.224-226
  },
};

/** La clé du modèle de progression de `hero`. */
export const cleDeProgression = (hero: Pick<Combatant, 'progression'>): CleDeProgression => hero.progression ?? '4e';

/** Le modèle de progression de `hero`. */
export const modeleDe = (hero: Pick<Combatant, 'progression'>): ModeleDeProgression => MODELES_DE_PROGRESSION[cleDeProgression(hero)];
