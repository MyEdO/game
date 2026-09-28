/**
 * Schéma de `weaponGroups.json` — registre des Groupes d'objet (armes/munitions/armures/inventaire),
 * miroir de `WeaponGroupData` (`src/data/index.ts`). `material` : matériau d'armure typé
 * (exemptions de Magie des Arcanes, LDB 46 l.150-152 ; troisième exemption Sorcier du Chaos, VDM 02
 * l.169) — présent seulement sur `kind:'armour'`. `combat` : sous-ensemble melee/ranged (SOURCE des
 * pools `weaponGroupsMelee`/`weaponGroupsRanged`) — présent seulement sur `kind:'weapon'`/`'ammo'`
 * combattants (absent sur les Groupes de siège/inventaire).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { enumNomme } from '../grammaire/valeurs';
import { qualityRefSchema } from '../grammaire/reference';

export const file = 'weaponGroups.json';
export const famille = 'entite';

const doc = document(
  'weaponGroups',
  famille,
  {
    kind: enumNomme({ weapon: 'Groupe d’arme', ammo: 'Munitions', armour: 'Armure', inventory: 'Inventaire' }),
    material: z.enum(['metal', 'leather', 'chaos']).optional(),
    combat: z.enum(['melee', 'ranged']).optional(),
    /** Qualités COMMUNES à toute la famille, mergées par `resolveQualities` (LDB 62 l.137). */
    qualities: z.array(qualityRefSchema).optional(),
  },
  {
    kind: {
      label: 'Type de Groupe',
      hint: 'Arme, munition, armure ou inventaire',
    },
    material: {
      label: 'Matériau (armure)',
      hint: 'Matériau typé de l’armure (exemptions de Magie des Arcanes) — présent seulement sur les Groupes d’armure',
    },
    combat: {
      label: 'Registre de combat',
      hint: 'Mêlée ou distance — source des pools de spécialisation de Compétence',
    },
    qualities: { label: 'Qualités communes', hint: 'Qualités communes à toute la famille, fusionnées à celles de l’objet' },
  },
  {
    codex: { keys: ['weaponGroups'] },
    edit: { dataset: 'weaponGroups' },
  },
  // `combat` : univers des sources `weaponGroupsMelee`/`weaponGroupsRanged` (`grammaire/sourcesDeSpecs.ts`).
  { espace: { discriminant: 'combat' } },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
