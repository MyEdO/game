/**
 * Schéma de `weaponGroups.json` — registre des Groupes d'objet (armes/munitions/armures/inventaire),
 * miroir de `WeaponGroupData` (`src/data/index.ts`). La CHARGE de chaque `kind` (`chargeParDiscriminant`,
 * bornée au parse par `document()`) : un Groupe d'armure porte son `material` (exemptions de Magie des
 * Arcanes, LDB 46 l.150-152 ; VDM 02 l.169), sa `couche` et son `palierPA` ; un
 * Groupe d'arme sa `forme` et son `maniement`, son `combat` éventuel (SOURCE des pools
 * `weaponGroupsMelee`/`weaponGroupsRanged`, absent sur les Groupes de siège) ; une arme ou une munition à
 * poudre le marqueur `poudre`. `couche` et `palierPA` sont uniques parmi les Groupes d'armure.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { enumNomme, maniementSchema } from '../grammaire/valeurs';
import { qualityRefSchema } from '../grammaire/reference';
import { ref } from '../grammaire/ref';
import { RACINE_D_APPARENCE } from '../grammaire/sousListes';
import { tableTotale } from '../../../lib/tableTotale';

export const file = 'weaponGroups.json';
export const famille = 'entite';

const KINDS = { weapon: 'Groupe d’arme', ammo: 'Munitions', armour: 'Armure', inventory: 'Inventaire' } as const;

type Kind = keyof typeof KINDS;

/** CHARGE par `kind` (`espace.chargeParDiscriminant`) : seul le `kind` qui la déclare porte une clé. #3076 */
const chargeParDiscriminant: Readonly<Record<string, readonly string[]>> = tableTotale(Object.keys(KINDS) as Kind[], (kind) =>
  kind === 'armour' ? ['material', 'couche', 'palierPA'] : kind === 'weapon' ? ['combat', 'forme', 'maniement', 'poudre'] : kind === 'ammo' ? ['poudre'] : [],
);
/** Clés EXIGÉES de la charge (`espace.requisesParDiscriminant`). */
const requisesParDiscriminant: Readonly<Record<string, readonly string[]>> = tableTotale(Object.keys(KINDS) as Kind[], (kind) =>
  kind === 'armour' ? ['material', 'couche', 'palierPA'] : kind === 'weapon' ? ['forme', 'maniement'] : [],
);
/** Rangs d'un Groupe d'armure UNIQUES parmi les Groupes d'armure : deux couches égales laisseraient l'ordre
 *  d'inventaire trancher l'affichage, deux paliers égaux la matière d'une armure de statbloc. */
const RANGS_D_ARMURE = ['couche', 'palierPA'] as const;

const doc = document(
  'weaponGroups',
  famille,
  {
    kind: enumNomme(KINDS),
    material: z.enum(['metal', 'leather', 'chaos']).optional(),
    combat: z.enum(['melee', 'ranged']).optional(),
    /** Qualités COMMUNES à toute la famille, mergées par `resolveQualities` (LDB 62 l.137). */
    qualities: z.array(qualityRefSchema).optional(),
    /** Rang de couche d'un Groupe d'armure : la pièce de rang le plus haut s'affiche par-dessus. */
    couche: z.number().int().min(0).optional(),
    /** PA à partir desquels une armure de statbloc portée se dessine dans la matière du Groupe ; `null` :
     *  aucune armure de statbloc ne s'y dessine (#2948). */
    palierPA: z.number().int().min(0).nullable().optional(),
    /** Forme dessinée d'une arme du Groupe sans forme propre ; `null` : rien en main. */
    forme: ref('apparence', undefined, RACINE_D_APPARENCE).nullable().optional(),
    maniement: maniementSchema.optional(),
    /** LDB 62 l.99 ; LDB 62 l.129 */
    poudre: z.literal(true).optional(),
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
    couche: { label: 'Rang de couche (armure)', hint: 'La pièce d’armure de rang le plus haut s’affiche par-dessus les autres' },
    palierPA: { label: 'Palier de PA (armure)', hint: 'PA à partir desquels une armure de statbloc portée se dessine dans cette matière — vide : jamais' },
    forme: { label: 'Forme par défaut (arme)', hint: 'Forme dessinée d’une arme du Groupe sans forme propre — vide : rien en main' },
    maniement: { label: 'Maniement (arme)', hint: 'Animation d’une arme du Groupe dont la forme ne déclare pas de maniement' },
    poudre: { label: 'À poudre', hint: 'Arme ou munition à Poudre noire et d’Ingénierie' },
  },
  {
    codex: { keys: ['weaponGroups'] },
    edit: { dataset: 'weaponGroups' },
  },
  // `combat` : univers des sources `weaponGroupsMelee`/`weaponGroupsRanged` (`grammaire/sourcesDeSpecs.ts`) ;
  // `kind` : la sous-liste `armour`, type d'armure d'une pièce (`subType`, `defs/trappings.ts`) ;
  // `poudre` : la sous-liste des Groupes à poudre (`groupeAPoudre`, `src/engine/weaponGroup.ts`).
  {
    espace: { discriminant: ['combat', 'kind'], champDeCharge: 'kind', chargeParDiscriminant, requisesParDiscriminant, marqueurs: ['poudre'] },
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        const groupes = v as ({ id: string; kind: string } & Partial<Record<(typeof RANGS_D_ARMURE)[number], number | null>>)[];
        const armures = groupes.filter((g) => g.kind === 'armour');
        for (const rang of RANGS_D_ARMURE) {
          const vus = new Map<number, string>();
          groupes.forEach((g, i) => {
            const valeur = g[rang];
            if (g.kind !== 'armour' || valeur === undefined || valeur === null) return;
            const premier = vus.get(valeur);
            if (premier !== undefined)
              ctx.addIssue({ code: 'custom', path: [i, rang], message: `weaponGroups.json : « ${g.id} » et « ${premier} » portent le même ${rang} ${valeur} — il est unique parmi les Groupes d’armure.` });
            else vus.set(valeur, g.id);
          });
        }
        if (!armures.some((g) => g.palierPA === 0))
          ctx.addIssue({ code: 'custom', path: [], message: 'weaponGroups.json : aucun Groupe d’armure au palierPA 0 — une armure de statbloc portée n’aurait pas de matière.' });
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
