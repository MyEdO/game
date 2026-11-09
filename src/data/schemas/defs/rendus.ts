/**
 * Schéma de `rendus.json` (#3771) : LE catalogue des rendus d'un coup ou d'une incantation, éditable. Chaque
 * phase (départ, impact, manque, parade) nomme un visuel du vocabulaire fermé que l'hôte sait dessiner et un son du
 * registre (`src/data/sons/defs`) ; le trajet nomme un projectile du même régime, sa vitesse et sa cloche. Un Groupe
 * d'arme, un objet, un Domaine désignent le leur par `rendu`.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { enumNomme, couleurHexSchema } from '../grammaire/valeurs';
import { ref } from '../grammaire/ref';

export const file = 'rendus.json';
export const famille = 'entite';

/** Les visuels d'une phase, que l'hôte dessine au point de la phase (bouche de l'arme, cible). */
export const visuelDEffetSchema = enumNomme({
  'eclair-de-bouche': 'Éclair de bouche et fumée',
  canalisation: 'Canalisation',
  etincelles: 'Étincelles',
  poussiere: 'Poussière',
  explosion: 'Explosion',
  'eclat-magique': 'Éclat magique',
  halo: 'Halo',
  'gerbe-de-flammes': 'Gerbe de flammes',
});
export type VisuelDEffet = z.infer<typeof visuelDEffetSchema>;

/** Les projectiles d'un trajet. */
export const projectileSchema = enumNomme({
  fleche: 'Flèche',
  carreau: 'Carreau',
  balle: 'Balle',
  boulet: 'Boulet',
  pierre: 'Pierre',
  'objet-lance': 'Objet lancé',
  'trait-magique': 'Trait magique',
  'jet-de-flammes': 'Jet de flammes',
});
export type Projectile = z.infer<typeof projectileSchema>;

const doc = document(
  'rendus',
  famille,
  {
    couleur: couleurHexSchema,
    departVisuel: visuelDEffetSchema.optional(),
    departSon: ref('son').optional(),
    projectile: projectileSchema.optional(),
    vitesseMs: z.number().gt(0).optional(),
    cloche: z.number().min(0).max(1).optional(),
    impactVisuel: visuelDEffetSchema.optional(),
    impactSon: ref('son').optional(),
    manqueVisuel: visuelDEffetSchema.optional(),
    manqueSon: ref('son').optional(),
    paradeVisuel: visuelDEffetSchema.optional(),
    paradeSon: ref('son').optional(),
  },
  {
    couleur: { label: 'Couleur', hint: 'Teinte `#rrggbb` des visuels du rendu, à défaut de celle du Domaine' },
    departVisuel: { label: 'Visuel du départ', hint: 'À l’attaquant ou au lanceur, au moment du coup' },
    departSon: { label: 'Son du départ', hint: 'À l’attaquant ou au lanceur, au moment du coup' },
    projectile: { label: 'Projectile', hint: 'Ce qui vole jusqu’à la cible ; aucun en mêlée' },
    vitesseMs: { label: 'Vitesse du projectile', hint: 'En mètres par seconde, avec le projectile' },
    cloche: { label: 'Cloche du projectile', hint: 'Hauteur de l’arc, en part de la distance, avec le projectile' },
    impactVisuel: { label: 'Visuel de l’impact', hint: 'Sur la cible touchée, ou celle d’une incantation réussie' },
    impactSon: { label: 'Son de l’impact', hint: 'Sur la cible touchée, ou celle d’une incantation réussie' },
    manqueVisuel: { label: 'Visuel du manque', hint: 'Au point visé, le coup manqué' },
    manqueSon: { label: 'Son du manque', hint: 'Au point visé, le coup manqué' },
    paradeVisuel: { label: 'Visuel de la parade', hint: 'Sur le défenseur, quand cette arme pare le coup' },
    paradeSon: { label: 'Son de la parade', hint: 'Sur le défenseur, quand cette arme pare le coup' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison: 'rendus visuels et sonores des coups et des incantations (#3771), vocabulaire d’APPARENCE — aucune conséquence de règle.',
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite', dataset: 'rendus' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
