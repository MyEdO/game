// ── Bloc NARRATIF d'un paquet de campagne (schema 3, #765) ──────────────────────────────────────
// Frontière RÉFÉRENCE vs NARRATIF (doctrine `game-campagne-json-portable-frontiere-reference-narratif`) :
// le narratif est EMBARQUÉ dans le JSON du projet (auto-suffisant, révélé seulement en jeu) et RÉFÉRENCE
// la règle globale (`src/data`) PAR ID — jamais copiée, jamais réinjectée dans `src/data` global. Cet
// invariant est GARDÉ par le schéma du document (`narratifSchema`, `src/data/schemas/defs-scenes/`),
// qui refuse toute collision d'id narratif ↔ id global.

import type { TrappingData, CreatureData } from '../data/index';
import type { EntityAppearance } from '../engine/authoringAppearance';
import type { SourceRef } from '../data/schemas/grammaire/valeurs';
import type { Condition } from '../engine/flowCore';
import { REGISTRES_NARRATIFS } from '../data/schemas/defs-scenes/registres-narratifs';

/** Un stade RÉVÉLABLE d'un indice : ce qui se dévoile à ce palier d'enquête — sa prose, le document
 *  qu'il croise, ou les deux (au moins l'un, `narratifSchema`). */
export interface IndiceStade {
  /** id STABLE du stade, unique DANS l'indice. */
  id: string;
  /** Prose révélée (verbatim source, règle stricte 5). */
  prose?: string;
  /** id d'un `DocumentNarratif` du même narratif (#679). */
  documentId?: string;
  source?: SourceRef;
}

/** Un document remis au joueur (#679) : prose VERBATIM (règle stricte 5, Markdown), servie par l'Effect
 *  `document { documentId }`. */
export interface DocumentNarratif {
  /** id STABLE, unique dans le narratif ET non-colluant avec un id global. */
  id: string;
  titre: string;
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
}

/** AMBIANCE d'un cadre de campagne (#717) — strate de matière lue par les tokens `--amb-*`
 *  (`styles/base.css`), portée en `data-ambiance` par la coquille d'écran. */
export type AmbianceCadre = 'veillee' | 'parchemin';

/** Ouverture CÉRÉMONIELLE du chapitre (#717) — titre, pitch VERBATIM (règle 5, rendu par `<Prose>`),
 *  ambiance. Absente du narratif = la campagne démarre directement sur sa scène d'entrée. */
export interface OuvertureBlock {
  surtitre?: string;
  titre: string;
  sousTitre?: string;
  /** Libellé d'AFFICHAGE du chapitre (doctrine du label) : aucune logique ne le lit, seul l'écran le rend. */
  chapitre?: string;
  /** Markdown VERBATIM de la source (règle stricte 5) — jamais une paraphrase. */
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
  documents: DocumentNarratif[];
  /** Cadre de campagne (#717) — l'ouverture cérémonielle du chapitre. Absente = démarrage direct. */
  ouverture?: OuvertureBlock;
  /** Cadre de campagne (#717) — la clôture du chapitre. Absente = le chapitre ne se ferme jamais. */
  cloture?: ClotureBlock;
}

/** Narratif vide — posé par `newProject` et par la migration 2→3 (`worldMap.ts`, `PROJECT_MIGRATIONS`) :
 *  une liste vide par registre (`REGISTRES_NARRATIFS`). */
export function emptyNarratif(): NarratifBlock {
  return Object.fromEntries(REGISTRES_NARRATIFS.map((r) => [r.cle, []])) as unknown as NarratifBlock;
}
