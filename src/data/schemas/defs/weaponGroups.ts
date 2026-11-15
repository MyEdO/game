/**
 * Schéma de `weaponGroups.json`, miroir de `WeaponGroupData` (`src/data/index.ts`).
 * `document()` valide les charges discriminées par `kind` ; `combat` fournit les pools de spécialisation.
 * LDB 46 l.150-152 ; VDM 02 l.169 ; LDB 62 l.99/129.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { enumNomme, genreDArmeSchema, maniementSchema, matiereDArmureSchema, palierSchema } from '../grammaire/valeurs';
import { manieAussiSchema, qualityRefSchema } from '../grammaire/reference';
import { ref } from '../grammaire/ref';

export const file = 'weaponGroups.json';
export const famille = 'entite';

const KINDS = { weapon: 'Groupe d’arme', ammo: 'Munitions', armour: 'Armure', inventory: 'Inventaire' } as const;

type Kind = keyof typeof KINDS;

/** CHARGE par `kind` (`espace.chargeParDiscriminant`) : seul le `kind` qui la déclare porte une clé. #3076 */
const chargeParDiscriminant = {
  weapon: ['combat', 'maniement', 'rendu', 'poudre', 'siege', 'manieAussi'],
  ammo: ['poudre'],
  armour: ['material', 'couche', 'seuil', 'teinte'],
  inventory: [],
} as const satisfies Record<Kind, readonly string[]>;
/** Clés EXIGÉES de la charge (`espace.requisesParDiscriminant`). */
const requisesParDiscriminant = {
  weapon: ['maniement'],
  ammo: [],
  armour: ['material', 'couche'],
  inventory: [],
} as const satisfies { readonly [K in Kind]: readonly (typeof chargeParDiscriminant)[K][number][] };
/** Rangs d'un Groupe d'armure UNIQUES parmi les Groupes d'armure : deux couches égales laisseraient l'ordre
 *  d'inventaire trancher l'affichage, deux paliers égaux la matière d'une armure de statbloc. */
const RANGS_D_ARMURE = ['couche', 'seuil'] as const;

const doc = document(
  'weaponGroups',
  famille,
  {
    kind: enumNomme(KINDS),
    material: matiereDArmureSchema.optional(),
    combat: genreDArmeSchema.optional(),
    /** Qualités COMMUNES à toute la famille, mergées par `resolveQualities` (LDB 62 l.137). */
    qualities: z.array(qualityRefSchema).optional(),
    /** Rang de couche d'un Groupe d'armure : la pièce de rang le plus haut s'affiche par-dessus. */
    couche: z.number().int().min(0).optional(),
    /** PALIER (`palierSchema`) de PA d'une armure de statbloc portée : à partir de `seuil` PA, elle est de la matière du
     *  Groupe ; absent, aucune armure de statbloc n'en est (#2948, #3456). */
    ...palierSchema.partial().shape,
    /** Teinte d'une pièce d'armure du Groupe, à défaut de la sienne (#3456). */
    teinte: ref('material', undefined, 'objet').optional(),
    maniement: maniementSchema.optional(),
    /** #3771 */
    rendu: ref('rendu').optional(),
    /** LDB 62 l.99 ; LDB 62 l.129 */
    poudre: z.literal(true).optional(),
    /** AA 10 l.136 */
    siege: z.literal(true).optional(),
    /** AA 08 l.194 */
    manieAussi: manieAussiSchema.optional(),
  },
  {
    kind: {
      label: 'Type de Groupe',
      hint: 'Arme, munition, armure ou inventaire',
    },
    material: {
      label: 'Matériau (armure)',
      hint: 'Matériau typé de l’armure (Perforante, Domaines des Cieux et du Métal, exemptions de Magie des Arcanes) — présent seulement sur les Groupes d’armure',
    },
    combat: {
      label: 'Registre de combat',
      hint: 'Mêlée ou distance — source des pools de spécialisation de Compétence',
    },
    qualities: { label: 'Qualités communes', hint: 'Qualités communes à toute la famille, fusionnées à celles de l’objet' },
    couche: { label: 'Rang de couche (armure)', hint: 'Deux armures portées qui revêtent une même pièce : celle de rang le plus haut la donne' },
    seuil: { label: 'Palier de PA (armure)', hint: 'PA à partir desquels une armure de statbloc portée est de cette matière, et en prend la teinte — vide : jamais' },
    teinte: { label: 'Teinte (armure)', hint: 'Teinte d’objet que prend une pièce d’armure du Groupe, à défaut de la sienne' },
    maniement: { label: 'Maniement (arme)', hint: 'Animation d’une arme du Groupe dont la forme ne déclare pas de maniement' },
    rendu: { label: 'Rendu du coup (arme)', hint: 'Rendu visuel et sonore d’une arme du Groupe (`rendus.json`), à défaut du sien' },
    poudre: { label: 'À poudre', hint: 'Arme ou munition à Poudre noire et d’Ingénierie' },
    siege: { label: 'Engins de siège', hint: 'Les objets du Groupe sont des engins de siège, posés en combat et servis par une équipe' },
    manieAussi: { label: 'Armes aussi maniées en', hint: 'Par Groupe de Corps à corps qui manie aussi toute arme du Groupe : ses Atouts et Défauts, ses mains, à pied seulement' },
  },
  {
    codex: { keys: ['weaponGroups'] },
    edit: { dataset: 'weaponGroups' },
  },
  // `combat` : univers des sources `weaponGroupsMelee`/`weaponGroupsRanged` (`grammaire/sourcesDeSpecs.ts`) ;
  // `kind` : la sous-liste `armour`, type d'armure d'une pièce (`subType`, `defs/trappings.ts`) ;
  // `poudre` : la sous-liste des Groupes à poudre (`groupeAPoudre`, `src/engine/weaponGroup.ts`) ;
  // `siege` : la sous-liste des Groupes d'engins de siège (`groupeDeSiege`, `src/data/index.ts`).
  {
    espace: { discriminant: ['combat', 'kind'], champDeCharge: 'kind', chargeParDiscriminant, requisesParDiscriminant, marqueurs: ['poudre', 'siege'] },
    affinerEntree: (entree) => entree.refine((g: { seuil?: number }) => g.seuil === undefined || g.seuil >= 0, { path: ['seuil'], message: 'le palier de PA d’un Groupe d’armure est ≥ 0' }),
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
        if (!armures.some((g) => g.seuil === 0))
          ctx.addIssue({ code: 'custom', path: [], message: 'weaponGroups.json : aucun Groupe d’armure au seuil 0 — une armure de statbloc portée n’aurait pas de matière.' });
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
