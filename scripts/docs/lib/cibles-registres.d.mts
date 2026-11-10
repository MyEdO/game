// Types des cibles du générateur de registres — mêmes exports que cibles-registres.mjs.

/** Un registre généré : le dossier de ses définitions, sa sortie et la forme de ses entrées. */
export interface Registre {
  readonly dir: string;
  readonly out: string;
  readonly exportName?: string;
  readonly arrayName: string;
  readonly type: string;
  readonly typeFrom: string;
  readonly importDir?: string;
  readonly idUnion?: { readonly typeName: string; readonly field: string; readonly out?: string };
  readonly vocabulaire?: { readonly nom: string; readonly id: string; readonly libelle: string };
  readonly fields?: readonly string[];
  readonly optionalFields?: readonly string[];
  readonly constFields?: Readonly<Record<string, string>>;
}

export const REGISTRIES: readonly Registre[];
export const SORTIES_DES_ESPACES: { readonly ids: string; readonly cles: string; readonly racines: string };
export const SORTIE_VOCABULAIRES_D_ART: string;
export const SORTIES: readonly string[];
export const SORTIE_FORMATS: string;
export const SORTIE_VERBES: string;
export const SORTIE_NOMS_DE_PARAMETRE: string;
export const SORTIE_COMBATTANTS_DE_L_ETAT: string;
