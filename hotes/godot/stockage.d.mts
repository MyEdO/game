// Types du stockage du pont hors d'une page : mêmes signatures que stockage.mjs.

export function stockageDuProcessus(fichier: string | null): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
