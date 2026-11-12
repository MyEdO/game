// Types de la construction de l'hôte Godot : mêmes signatures que construire.mjs.

export function empaqueter(sortie: string | null): Promise<string>;

export function pontDuBundle(
  code: string,
  console: Console,
  stockage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): {
  appeler: (methode: string, json?: string | null) => string;
  resoudreLaPile(demande: string, rendre: (reponse: string) => void): void;
};
