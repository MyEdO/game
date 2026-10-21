/**
 * LA TABLE DE TEST DE L'HÔTE TEXTE (#2898 lot D) : l'hôte (`creerHote`) sur un disque en mémoire, et ses trois outils
 * appelés comme le serveur MCP les appelle, entrées validées comprises. Une partie par contexte JS : une table neuve
 * ferme la précédente, et `fermerLaTable` ferme la dernière.
 */
import { creerHote, type Disque, type EntreesDeLire, type EntreesDeNouvelle, type GesteDeLAgent, type Reponse } from './serveur';

/** Le nom de la partie d'une table. */
export const PARTIE = 'p';

let derniere: ReturnType<typeof creerHote> | null = null;

/** Ferme la partie de la dernière table. */
export function fermerLaTable(): void {
  derniere?.fermer();
  derniere = null;
}

/** Une réponse et ses lignes. */
const avecLignes = (r: Reponse) => ({ ...r, lignes: r.texte.split('\n') });

/** Une table : la partie `PARTIE` posée à `texte` (aucune sans lui), les trois outils, le fichier et ses verrous. */
export function table(texte?: string) {
  fermerLaTable();
  const fichiers = new Map<string, string>(texte === undefined ? [] : [[PARTIE, texte]]);
  const tenues = new Set<string>();
  const disque: Disque = {
    lire: (nom) => fichiers.get(nom) ?? null,
    ecrire: (nom, t) => void fichiers.set(nom, t),
    ajouter: (nom, t) => void fichiers.set(nom, (fichiers.get(nom) ?? '') + t),
    prendre: (nom) => (tenues.add(nom), null),
    rendre: (nom) => void tenues.delete(nom),
  };
  const hote = creerHote(disque);
  derniere = hote;
  return {
    hote,
    disque,
    nouvelle: (scenario: string, options: Omit<EntreesDeNouvelle, 'partie' | 'scenario'> = {}) => avecLignes(hote.nouvelle({ partie: PARTIE, scenario, ...options })),
    lire: (quoi: EntreesDeLire['quoi'], options: Omit<EntreesDeLire, 'quoi'> = {}) => avecLignes(hote.lire({ quoi, partie: PARTIE, ...options })),
    jouer: (...gestes: GesteDeLAgent[]) => avecLignes(hote.jouer({ gestes, partie: PARTIE })),
    fichier: () => fichiers.get(PARTIE) ?? '',
    tenues,
  };
}

/** Une partie neuve de `scenario` (graine 7), ses `gestes` joués un par un, chacun appliqué. */
export function partie(scenario: string, ...gestes: GesteDeLAgent[]) {
  const t = table();
  const n = t.nouvelle(scenario, { graine: 7 });
  if (n.erreur) throw new Error(n.texte);
  for (const g of gestes) {
    const r = t.jouer(g);
    if (r.erreur) throw new Error(`${JSON.stringify(g)} : ${r.texte}`);
  }
  return t;
}

/** Un verbe du noyau, ses arguments. */
export const verbe = (nom: string, ...args: unknown[]): GesteDeLAgent => ({ verbe: nom, args });
