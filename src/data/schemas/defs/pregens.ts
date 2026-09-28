/**
 * Schéma de `pregens.json` — `PregenDef` (`src/data/pregens.ts`). Personnages pré-tirés APP-OWNED (flavor :
 * motivation, ambitions LDB 05 l.730-736) ; la fabrique (`src/data/pregens.ts`, #421) construit par
 * `createHero`, le moteur de création du créateur joueur. L'auteur tranche `species`/`career` et les choix
 * de création qu’il porte (`CHOIX_DES_PRETIRES`, pris dans `champsDeChoix`) ; un choix absent prend le défaut de
 * `createHero`, un tirage suit la graine `seed`.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { idDe } from '../grammaire/ref';
import { champsDeChoix, metaDesChoix } from '../grammaire/choixDeCreation';
import type { ChoixDeCreation } from '../../../engine/character';
import { sexeSchema } from '../grammaire/valeurs';
import { tableTotale } from '../../../lib/tableTotale';

/** Les clés de choix que `pregens.json` PORTE : une clé de plus s'ajoute ici et dans la donnée. */
const CHOIX_DES_PRETIRES = ['seed', 'careerTalent', 'speciesTalentChoices', 'pettySpells'] as const satisfies readonly (keyof ChoixDeCreation)[];
export type ChoixDesPretires = (typeof CHOIX_DES_PRETIRES)[number];
const desPretires = <T extends Record<ChoixDesPretires, unknown>>(table: T): Pick<T, ChoixDesPretires> =>
  tableTotale(CHOIX_DES_PRETIRES, (k) => table[k]);

export const file = 'pregens.json';
export const famille = 'entite';

const doc = document(
  'pregens',
  famille,
  {
    /** `id` STABLE de l'espèce (`idDe('species')`). */
    species: idDe('species'),
    /** `id` STABLE de la carrière (`idDe('career')`). */
    career: idDe('career'),
    ...desPretires(champsDeChoix),
    motivation: z.string(),
    /** Ambitions à court/long terme (LDB 05 l.730-736) — flavor du pré-tiré. */
    ambitionShort: z.string().optional(),
    ambitionLong: z.string().optional(),
    /** Âge (LDB 05 étape 6) — absent sur toutes les entrées observées (pas de tirage moteur côté pré-tiré). */
    age: z.number().optional(),
    /** Sexe visuel (cosmétique). Défaut 'M'. */
    sex: sexeSchema.optional(),
    /** Morphologie 0..1 (cosmétique). Défaut 0.5. */
    build: z.number().optional(),
  },
  {
    species: { label: 'Espèce', hint: 'Espèce du pré-tiré, prise au catalogue des espèces' },
    career: { label: 'Carrière', hint: 'Carrière du pré-tiré, prise au catalogue des carrières' },
    ...desPretires(metaDesChoix),
    motivation: { label: 'Motivation', hint: 'Motivation du personnage (texte d’auteur)' },
    ambitionShort: { label: 'Ambition à court terme', hint: 'Ambition à court terme affichée sur la fiche' },
    ambitionLong: { label: 'Ambition à long terme', hint: 'Ambition à long terme affichée sur la fiche' },
    age: { label: 'Âge', hint: 'Âge du pré-tiré ; absent sur toutes les entrées observées' },
    sex: { label: 'Sexe', hint: 'Sexe visuel du pré-tiré (cosmétique)' },
    build: { label: 'Morphologie', hint: 'Corpulence visuelle du pré-tiré (cosmétique)' },
  },
  {
    codex: { keys: ['pregens'] },
    edit: { dataset: 'pregens' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
