/**
 * Schéma de `voyage-stakes.json` — ENJEU d'un `kind` d'étape de cascade de VOYAGE (fluvial/maritime,
 * #1117). Jumeau de `night-stakes.json`, PAS le même contrat de contenu (c'est pourquoi les deux
 * datasets ne fusionnent pas) :
 *  - `night-stakes.stake` est un VERBATIM figé de la Source (règle 5), recollable tel quel ;
 *  - `voyage-stakes.template` est un GABARIT de descripteur MÉCANIQUE : ses trous `{nom}` reçoivent
 *    les valeurs CALCULÉES par le flux au moment de l'étape (km de dérive, % de vent, Rounds, Dégâts).
 * Mélanger les deux sous une même clé ferait cohabiter « ne jamais interpoler » et « toujours
 * interpoler » — un même libellé pour deux natures.
 * Le texte reste éditable au Codex (catégorie « Enjeux — cascade de voyage »).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'voyage-stakes.json';
export const famille = 'entite';

const doc = document(
  'voyage-stakes',
  famille,
  {
    /** `kind` de l'étape de cascade servie (clé de consommation, `voyageStake`) — distinct de l'`id`. */
    kind: z.string(),
    /** Gabarit du descripteur mécanique — trous `{nom}` remplis par le flux (valeurs calculées). */
    template: z.string(),
    /** FOYER de la règle derrière cette étape — la règle est à UN CLIC depuis l'enjeu (#1117).
     *  Absent = aucune fiche ne couvre encore ce `kind`. */
    rule: z.string().optional(),
    /** Catégorie Codex du foyer (`'regles'` par défaut, `'skills'`, `'etats'`…) — même contrat que
     *  `flow-stakes`/`combat-stakes` : le renvoi vise l'entité qui PORTE déjà la règle (la Compétence
     *  jetée, l'État subi), `regles.json` n'étant que le foyer des règles de cadre. */
    ruleCategory: z.string().optional(),
  },
  {
    kind: { label: 'Type d’étape', hint: 'Étape de la cascade de voyage servie' },
    template: {
      label: 'Gabarit du texte',
      // Les ACCOLADES restent hors du répertoire des libellés (garde `libelles-guard`) : ce sont des
      // signes de code, et les admettre laisserait passer une interpolation à l’écran. Le trou
      // nommé se DIT donc en français plutôt qu’il ne se montre.
      hint: 'Descripteur mécanique dont les trous nommés sont remplis par les valeurs calculées au moment de l’étape',
    },
    rule: {
      label: 'Règle associée',
      hint: 'Entité qui porte la règle derrière l’étape (Compétence/État/Talent, ou fiche de règles-cadre)',
    },
    ruleCategory: {
      label: 'Catégorie de la règle',
      hint: 'Catégorie Codex de l’entité qui porte la règle (regles par défaut, skills, etats…)',
    },
  },
  {
    codex: { keys: ['voyageStakes'] },
    edit: { none: 'exposé au Codex en LECTURE seule — aucune clé de `CodexEdit.CATEGORY_DATASET` ne le route vers un formulaire d’atelier', dataset: 'voyageStakes' },
  },
  { exiges: ['source'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
