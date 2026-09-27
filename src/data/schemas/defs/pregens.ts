/**
 * Schéma de `pregens.json` — dérivé du contenu RÉEL (8 entrées, script d'inventaire) et de
 * `PregenDef` (`src/data/pregens.ts`). Personnages pré-tirés APP-OWNED (flavor : motivation,
 * ambitions LDB 05 l.730-736) ; la fabrique (`src/data/pregens.ts`, #421) construit par `createHero`,
 * le moteur de création du créateur joueur — `species`/`career`, `careerTalent` et
 * `pettySpells` (ids stables) sont les seuls choix AUTHORÉS, le reste suit la recette RAW seedée.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { idDe, refOuSpec } from '../grammaire/ref';
import { sexeSchema } from '../grammaire/valeurs';

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
    seed: z.number(),
    motivation: z.string(),
    /** Ambitions à court/long terme (LDB 05 l.730-736) — flavor du pré-tiré. */
    ambitionShort: z.string().optional(),
    ambitionLong: z.string().optional(),
    /** Âge (LDB 05 étape 6) — absent sur toutes les entrées observées (pas de tirage moteur côté pré-tiré). */
    age: z.number().optional(),
    /** Talent de carrière CHOISI : id de `talents.json`, et id de sa spécialisation s'il en porte une
     *  (`refOuSpec('talent')`) — sans lui, `createHero` prend la 1ʳᵉ entrée du Niveau. */
    careerTalent: refOuSpec('talent').optional(),
    /** Sorts de Magie mineure choisis : ids de `spells.json`, famille `mineure` (`idDe('spell', 'mineure')`) — n'a
     *  de sens que si `careerTalent` porte le Talent Magie mineure ; complétés au quota BFM exact par
     *  `pregens.ts` (LDB 10 l.714), jamais un remplacement des sorts authorés. */
    pettySpells: z.array(idDe('spell', 'mineure')).optional(),
    /** Id de trapping (catalogue) résolvant l'emplacement `{wildcard:'arme'}` de la carrière
     *  (construct de choix d'équipement) — aucune des 8 entrées actuelles n'a un tel slot au Niveau 1. */
    weaponChoice: idDe('trapping').optional(),
    /** Sexe visuel (cosmétique). Défaut 'M'. */
    sex: sexeSchema.optional(),
    /** Morphologie 0..1 (cosmétique). Défaut 0.5. */
    build: z.number().optional(),
  },
  {
    species: { label: 'Espèce', hint: 'Espèce du pré-tiré, prise au catalogue des espèces' },
    career: { label: 'Carrière', hint: 'Carrière du pré-tiré, prise au catalogue des carrières' },
    seed: { label: 'Graine de tirage', hint: 'Graine stable qui rejoue à l’identique tous les tirages du pré-tiré' },
    motivation: { label: 'Motivation', hint: 'Motivation du personnage (texte d’auteur)' },
    ambitionShort: { label: 'Ambition à court terme', hint: 'Ambition à court terme affichée sur la fiche' },
    ambitionLong: { label: 'Ambition à long terme', hint: 'Ambition à long terme affichée sur la fiche' },
    age: { label: 'Âge', hint: 'Âge du pré-tiré ; absent sur toutes les entrées observées' },
    careerTalent: { label: 'Talent de carrière choisi', hint: 'Talent de Niveau choisi ; sans lui, le premier de la liste est pris' },
    pettySpells: { label: 'Sorts de Magie mineure', hint: 'Sorts mineurs choisis, complétés au quota par le générateur' },
    weaponChoice: { label: 'Arme choisie', hint: 'Objet qui résout un choix d’arme d’équipement de départ' },
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
