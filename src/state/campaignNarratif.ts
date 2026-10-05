// ── Bloc NARRATIF d'un paquet de campagne (#765) ────────────────────────────────────────────────
// Frontière RÉFÉRENCE vs NARRATIF (doctrine `game-campagne-json-portable-frontiere-reference-narratif`) :
// le narratif est EMBARQUÉ dans le JSON du projet (auto-suffisant, révélé seulement en jeu) et RÉFÉRENCE
// la règle globale (`src/data`) PAR ID — jamais copiée, jamais réinjectée dans `src/data` global. Cet
// invariant est GARDÉ par le schéma du document (`narratifSchema`, `src/data/schemas/defs-scenes/`),
// qui refuse toute collision d'id narratif ↔ id global.

import type { TrappingData, CreatureData } from '../data/index';
import type { EntityAppearance } from '../engine/authoringAppearance';
import type { SourceRef } from '../data/schemas/grammaire/valeurs';
import type { Condition } from '../engine/flowCore';
import type { z } from 'zod';
import type { ecartSchema } from '../data/schemas/defs-scenes/narratif';

/** Un stade RÉVÉLABLE d'un indice : la prose qui se dévoile à ce palier d'enquête (`indiceStadeSchema`). */
export interface IndiceStade {
  /** id STABLE du stade, unique DANS l'indice. */
  id: string;
  prose: string;
  source?: SourceRef;
}

/** Un indice ou une rumeur d'une affaire — révélé par stades. */
export interface Indice {
  /** id STABLE, unique dans le narratif ET non-colluant avec un id global. */
  id: string;
  /** id de l'`Affaire` à laquelle l'indice se rattache. */
  affaireId: string;
  kind: 'indice' | 'rumeur';
  titre: string;
  /** Stades révélables (au moins un). */
  stades: IndiceStade[];
  /** Autres indices (ids) que celui-ci recoupe/débloque. */
  refs?: string[];
  /** Entrées de fiche de dossier de chapitre couvertes (`couvreSchema`, #2290). */
  couvre?: string[];
}

/** Une affaire (fil d'enquête) de la campagne. */
export interface Affaire {
  id: string;
  titre: string;
  desc?: string;
}

/** Un PNJ pré-composé de la campagne : soit une créature globale surchargée (`base` = id global), soit
 *  un profil ad hoc embarqué (`profil`). L'apparence réutilise la structure UNIQUE `EntityAppearance`. */
export interface PresetPnj {
  id: string;
  /** id d'une créature GLOBALE (`findCreatureById`) servant de base — surchargée par `profil`/`apparence`. */
  base?: string;
  profil?: Partial<CreatureData>;
  apparence?: EntityAppearance;
  /** id d'illustration (registre d'art), affichage seul. */
  portrait?: string;
  source?: SourceRef;
  /** Entrées de fiche de dossier de chapitre couvertes (`couvreSchema`, #2290). */
  couvre?: string[];
}

/** Entrée de fiche de dossier de chapitre écartée par l'adaptation, avec son motif (`ecartSchema`, #2290). */
export type EcartDeFiche = z.infer<typeof ecartSchema>;

/** AMBIANCE d'un cadre de campagne (#717) — strate de matière lue par les tokens `--amb-*`
 *  (`styles/base.css`), portée en `data-ambiance` par la coquille d'écran. */
export type AmbianceCadre = 'veillee' | 'parchemin';

/** Ouverture CÉRÉMONIELLE du chapitre (#717) — titre, pitch (rendu par `<Prose>`), ambiance. Absente
 *  du narratif = la campagne démarre directement sur sa scène d'entrée. */
export interface OuvertureBlock {
  surtitre?: string;
  titre: string;
  sousTitre?: string;
  /** Libellé d'AFFICHAGE du chapitre (doctrine du label) : aucune logique ne le lit, seul l'écran le rend. */
  chapitre?: string;
  /** Markdown (`ouvertureSchema`). */
  pitch: string;
  source?: SourceRef;
  /** Défaut `veillee`. */
  ambiance?: AmbianceCadre;
}

/** CLÔTURE du chapitre (#717) — le fait de DONNÉE qui dit « le chapitre se ferme ». `when` réutilise
 *  l'algèbre `Condition` (même vocabulaire que `MapPlace.when`), évaluée au contexte hors combat. */
export interface ClotureBlock {
  when: Condition;
  titre: string;
  sousTitre?: string;
}

/** Le bloc narratif au NIVEAU PROJET (frère de `scenes`/`worldMap`), jamais per-scène. `objets` réutilise
 *  le schéma `TrappingData` global (mêmes champs), sans jamais entrer dans `src/data` global. */
export interface NarratifBlock {
  affaires: Affaire[];
  indices: Indice[];
  presetsPnj: PresetPnj[];
  objets: TrappingData[];
  /** Cadre de campagne (#717) — l'ouverture cérémonielle du chapitre. Absente = démarrage direct. */
  ouverture?: OuvertureBlock;
  /** Cadre de campagne (#717) — la clôture du chapitre. Absente = le chapitre ne se ferme jamais. */
  cloture?: ClotureBlock;
  /** Entrées de fiche de dossier de chapitre écartées par l'adaptation (#2290), une par entrée. */
  ecartes?: EcartDeFiche[];
}

/** Narratif vide — posé par `newProject`. */
export function emptyNarratif(): NarratifBlock {
  return { affaires: [], indices: [], presetsPnj: [], objets: [] };
}
