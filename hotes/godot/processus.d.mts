// Types du processus du pont : mêmes signatures que processus.mjs.

export const PONT: string;

export const API_DU_NAVIGATEUR: readonly string[];

export function pontDuBundle(
  code: string,
  console: Console,
  stockage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): {
  appeler: (methode: string, json?: string | null) => string;
  resoudreLaPile(demande: string, rendre: (reponse: string) => void): void;
};

export function tenirLeTuyau(code: string, serveur: { url: string; fermer: () => void }): Promise<void>;
