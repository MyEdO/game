/**
 * LE CŒUR DE L'HÔTE TEXTE (#2898, plan v3 étape 4) : le fichier de partie, son rejeu et le geste suivant, sans
 * écran ni disque. Le fichier (JSONL) est la vérité de la partie : un en-tête (`Entete`), puis une ligne par geste
 * appliqué (`Geste`). Le rejeu ouvre la partie de l'en-tête et lance son scénario (`ouvrirLaPartie`, le module commun
 * des hôtes), puis rejoue chaque ligne ; après chaque appel, l'hôte reprend tous les jetons programmés sur l'horloge
 * virtuelle du module commun (`horlogeVirtuelle`), jusqu'à ce qu'il n'en reste aucun. Un geste en erreur (validation, permission,
 * règle) n'est pas écrit. Une seule partie par contexte JS (`branchement.ts`) : un processus par appel.
 */
import type { Jeu, LigneDuJournal, Partie, ResultatDeLAppel } from '../noyau/index';
import { ErreurDeGeste, horlogeVirtuelle, nouvelEntete, ouvrirLaPartie, valider, type Entete, type TenueDesJetons } from '../hote/partie';
import { envoyerLIntention, intentionDuGeste, lireGeste, type Geste, type PistesDeLecture } from '../hote/geste';
import { estObjet } from '../hote/formes';
import { appelEcrit } from './outils';
import { tableTotale } from '../lib/tableTotale';

/** Les pistes de lecture de l'hôte texte : l'appel de `lire` qui montre la suite d'un refus. */
export const PISTES_DU_TEXTE: PistesDeLecture = {
  vue: ` (${appelEcrit('lire', { quoi: 'vue' })})`,
  offres: ` (${appelEcrit('lire', { quoi: 'offres', toutes: true })})`,
  offre: (id) => ` (${appelEcrit('lire', { quoi: 'offres', id })})`,
  verbe: (id) => ` (${appelEcrit('lire', { quoi: 'verbes', id })})`,
};

/** Le texte d'un fichier : l'en-tête, puis les gestes. */
export function lireLeFichier(texte: string): { entete: Entete; gestes: Geste[] } {
  const lignes = texte.split('\n').filter((l) => l.trim() !== '');
  valider(lignes.length > 0, `fichier de partie vide : ${appelEcrit('nouvelle')} d’abord`);
  const json = lignes.map((l, i) => {
    try {
      return JSON.parse(l) as unknown;
    } catch {
      throw new ErreurDeGeste('validation', `ligne ${i + 1} du fichier : JSON illisible`);
    }
  });
  const [tete, ...reste] = json;
  valider(estObjet(tete), 'en-tête : objet JSON attendu');
  const e = tete as Record<string, unknown>;
  const entete = nouvelEntete(String(e.scenario), { graine: e.graine as number, cadence: e.cadence as string, desFixes: e.desFixes === true, regles: estObjet(e.regles) ? e.regles : {} });
  return { entete, gestes: reste.map(lireGeste) };
}

/** La ligne écrite d'un en-tête ou d'un geste. */
export const ligneDuFichier = (v: Entete | Geste): string => `${JSON.stringify(v)}\n`;

/** Une ligne du journal de la partie, numérotée depuis le lancement, avec le pas qui l'a écrite (0 : le lancement)
 *  et l'acteur courant au moment de l'écriture. */
export interface LigneNumerotee {
  n: number;
  pas: number;
  ligne: LigneDuJournal;
  /** Écrite pendant une reprise de jeton (tour de l'IA, beat différé), et non par le geste lui-même. */
  differee: boolean;
}

/** Une partie rejouée : la partie ouverte, la tenue de ses jetons, le compte des ids de sa fabrique, son en-tête, ses
 *  gestes, son journal entier, et le nombre de jetons repris après chaque pas (0 : le lancement). */
export interface PartieRejouee {
  partie: Partie;
  jetons: TenueDesJetons;
  idsFabriques: () => number;
  entete: Entete;
  gestes: Geste[];
  journal: LigneNumerotee[];
  reprises: number[];
}

/** Absorbe le résultat d'un appel : ses lignes au journal, puis la reprise de tous ses jetons sur l'horloge virtuelle
 *  du module commun (`horlogeVirtuelle`), le nombre de reprises noté au pas. */
function absorber(r: PartieRejouee, resultat: ResultatDeLAppel, pas: number): void {
  const { jetons } = r;
  const lire = (res: ResultatDeLAppel, differee: boolean) => {
    for (const ligne of res.journal) r.journal.push({ n: r.journal.length, pas, ligne, differee });
    return jetons.programmes(res);
  };
  r.reprises[pas] = horlogeVirtuelle(lire(resultat, false), (id) => lire(jetons.reprendre(id), true));
}

/** Joue un geste sur la partie rejouée : l'intention contrôlée, envoyée, ses jetons repris. L'issue de la partie fait
 *  foi : `hors-allowlist` est une erreur de validation, `refusee` une erreur de permission ; un verbe qui lève est une
 *  erreur de validation. Rend les lignes de journal du geste. */
export function jouerUnGeste(r: PartieRejouee, geste: Geste): LigneNumerotee[] {
  const intention = intentionDuGeste(r.partie.etat(), geste, PISTES_DU_TEXTE);
  // Le moteur mute en place (combattants, scène) : l'empreinte se prend AVANT l'appel, jamais sur l'état d'avant relu après.
  const avant = r.partie.etat();
  const faitsAvant = empreinteDesFaits(avant);
  const refusAvant = avant.refus?.nonce;
  const resultat = envoyerLIntention(r.partie, intention);
  // Un geste a un effet s'il change les FAITS ou programme une suite ; un événement émis seul (`move_blocked`) informe.
  if (!resultat.evenements.some((e) => e.type === 'programme') && empreinteDesFaits(r.partie.etat()) === faitsAvant) {
    throw new ErreurDeGeste('regle', `${intention.type} sans effet${ceQueDitLeJeu(refusAvant, r.partie.etat(), resultat)}`);
  }
  const debut = r.journal.length;
  r.gestes.push(geste);
  absorber(r, resultat, r.gestes.length);
  return r.journal.slice(debut);
}

/** Rejoue un fichier : la partie ouverte sur l'en-tête, le scénario lancé, chaque geste rejoué. Une ligne qui ne se
 *  rejoue plus ferme la partie et lève, avec son rang (1 : l'en-tête, le lancement). */
export function rejouer(entete: Entete, gestes: readonly Geste[]): PartieRejouee {
  let r: PartieRejouee | null = null;
  let ligne = 1;
  try {
    const { partie, jetons, lancement, idsFabriques } = ouvrirLaPartie(entete);
    r = { partie, jetons, idsFabriques, entete, gestes: [], journal: [], reprises: [] };
    absorber(r, lancement, 0);
    for (const geste of gestes) {
      ligne++;
      jouerUnGeste(r, geste);
    }
    return r;
  } catch (erreur) {
    r?.partie.fermer();
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    throw new ErreurDeGeste('validation', `ligne ${ligne} du fichier ne se rejoue plus : ${message}`);
  }
}

/** L'empreinte de l'état : FNV-1a 32 bits de ses données (fonctions exclues, `Map` et `Set` par leurs entrées), pour
 *  comparer deux rejeux. */
export function empreinte(etat: object): string {
  const texte = JSON.stringify(etat, (_cle, v: unknown) => (typeof v === 'function' ? undefined : v instanceof Map || v instanceof Set ? [...v] : v));
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Les champs qui DISENT sans être un fait de jeu : le journal de la partie et le refus opposé au geste
 *  (`refusVisible.ts`). Un geste qui ne change qu'eux n'a rien changé à la partie. */
const PAROLE = ['journal', 'refus'] as const satisfies readonly (keyof Jeu)[];

/** L'empreinte des FAITS de l'état : l'état sans sa parole (`PAROLE`). */
const empreinteDesFaits = (etat: Jeu): string => empreinte({ ...etat, ...tableTotale(PAROLE, () => null) });

/** Ce que le jeu a dit d'un geste sans effet : le refus neuf, sinon les lignes du journal de la partie, sinon les événements
 *  informatifs émis (`move_blocked`). */
function ceQueDitLeJeu(refusAvant: string | undefined, apres: Jeu, resultat: ResultatDeLAppel): string {
  if (apres.refus && apres.refus.nonce !== refusAvant) return ` : ${apres.refus.texte}`;
  const dites = resultat.journal.flatMap((l) => (l.de === 'journal' ? [l.texte] : []));
  if (dites.length) return ` : ${dites.join(' ')}`;
  const emis = resultat.evenements.flatMap((e) => (e.type === 'emis' ? [e.evt] : []));
  return emis.length ? ` : ${[...new Set(emis)].join(', ')}` : '';
}
