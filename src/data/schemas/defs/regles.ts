/**
 * Schéma de `regles.json` — catalogue des PROCÉDURES / OPTIONS de jeu (Sombre Pacte, modes
 * d'attaque/défense, Empoignade, Focalisation étendue…) dont la prose est ADRESSÉE au passage du
 * `Source/` (`descRef`, #1887). Consommé par le Codex (`registry.ts`, catégorie `regles`) et routé en
 * tooltip `CodexRef`.
 *
 * ZÉRO champ hors enveloppe : une règle EST son identité, sa prose et son folio — la prose (`desc` ou
 * `descRef`, `exiges: ['desc']`) et la `source` sont EXIGÉES (`options.exiges`).
 */
import { document } from '../grammaire/document';

export const file = 'regles.json';
export const famille = 'entite';

const doc = document(
  'regles',
  famille,
  {},
  {},
  {
    codex: { keys: ['regles'] },
    edit: { none: 'exposé au Codex en LECTURE seule — aucune clé de `CodexEdit.CATEGORY_DATASET` ne le route vers un formulaire d’atelier' },
  },
  {
    exiges: ['desc', 'source'],
    /** Une règle qui n'est qu'une ligne ou une case de table adresse le TABLEAU ENTIER : fiche
     *  `user-doctrine-regle-ligne-de-tableau-adresse-le-tableau-entier`, utilisateur, 2026-09-28 :
     *  « Le tableau entier (Recommandé) ». */
    fragmentsAdmis: ['blocs'],
    /** Un registre de RENVOIS au livre, sans prose : #1887, utilisateur, 2026-09-22 : « régles a pour but de
     *  faire référence aux endroits dans le livre qui concerne le modification/enjeu via un lien et non un
     *  texte verbatine comme aujourd'hui ». */
    porteursDeProse: ['descRef'],
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
