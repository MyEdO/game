// Types du processus du pont : mêmes signatures que processus.mjs.

export const PONT: string;

export const API_DU_NAVIGATEUR: readonly string[];

export const HORS_DU_PROCESSUS: Readonly<Record<string, { lectures: number; garde: string }>>;

export function ecartsDesLectures(
  lectures: Readonly<Record<string, number>>,
  api: readonly string[],
  horsDuProcessus: Readonly<Record<string, { lectures: number; garde: string }>>,
): string[];

export const BORNE_DE_SORTIE_MS: number;

export interface PontDuBundle {
  appeler: (methode: string, json?: string | null) => string;
  appelerEnOctets: (methode: string, json?: string | null) => string;
  octets: () => ArrayBuffer | null;
  resoudreLaPile(demande: string, rendre: (reponse: string) => void): void;
}

export function pontDuBundle(
  code: string,
  console: Console,
  stockage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): PontDuBundle;

export function tenirLeTuyau(code: string, serveur: { url: string; fermer: () => void }): Promise<void>;

export function servirLeCanal(
  pont: PontDuBundle,
  serveur: { url: string; fermer: () => void },
  canal: { entree: NodeJS.ReadableStream; sortie: NodeJS.WritableStream },
  methodes?: Record<string, (json: string | null) => string>,
): Promise<void>;
