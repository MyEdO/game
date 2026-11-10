/**
 * LE GESTE D'UN HÔTE DU NOYAU (#2928), commun à l'hôte texte
 * (`src/hoteTexte/`) et aux hôtes externes (`hotes/`) : un geste écrit en JSON (un verbe de la partie, celui qu'une offre
 * déclare compris, #3610), sa lecture, le contrôle de son verbe et de ses arguments contre ses paramètres (`formes.ts`,
 * `verbes.generated.ts`), son intention contrôlée, et l'issue de son envoi traduite en catégorie d'erreur. Chaque
 * refus nomme ce que l'état offre ; l'hôte y joint ses pistes de lecture (`PistesDeLecture`), là où son auteur lit la suite.
 */
import {
  DESIGNATIONS, VERBE_DE_CHOIX, VERBE_DE_REGLAGE, cleDuGeste, argsAvecIntentionLocale, etatDeLaBarre, fenetreDuJeu, porteurParId,
  quiTientLaMain, siegeDe, type Intention, type Jeu, type Offre, type Partie, type ResultatDeLAppel,
} from '../noyau/index';
import { estObjet } from '../lib/objet.mjs';
import { lireALaForme, signature, type Designes, type Forme, type ParametreDeVerbe } from './formes';
import { ErreurDeGeste, valider } from './partie';
import { offresDeLaBarreOuverte } from './projection';
import { CHOIX, FORMES, REGLAGES, VERBES } from './verbes.generated';

/** Un geste écrit : un verbe de la partie et ses arguments, joué au nom d'un siège s'il est posé. Une offre de l'actif se
 *  joue par le verbe qu'elle déclare (`Offre.geste`). */
export interface Geste { type: string; args: unknown[]; siege?: number }

/** Les pistes de lecture d'un hôte, jointes au refus d'un geste : où lire la vue, la signature d'un verbe. Chacune est le
 *  texte qui suit le message, vide pour un hôte qui n'en a pas (`SANS_PISTE`). */
export interface PistesDeLecture {
  vue: string;
  verbe: (id: string) => string;
}

/** Les pistes d'un hôte qui n'en joint aucune. */
export const SANS_PISTE: PistesDeLecture = { vue: '', verbe: () => '' };

/** Lit un geste écrit (un objet JSON), ou lève une erreur de validation. */
export function lireGeste(v: unknown): Geste {
  valider(estObjet(v), 'un geste est un objet JSON');
  const g = v as Record<string, unknown>;
  valider(typeof g.type === 'string', 'jouer : un nom d’action du noyau');
  valider(Array.isArray(g.args), 'jouer : les arguments sont un tableau JSON');
  valider(g.siege === undefined || Number.isInteger(g.siege), 'jouer : le siège est un entier');
  return g.siege === undefined ? { type: g.type as string, args: g.args as unknown[] } : { type: g.type as string, args: g.args as unknown[], siege: g.siege as number };
}

/** Ce que l'état désigne, lu par la table du noyau (`DESIGNATIONS`). */
const designesDe = (etat: Jeu): Designes => (cle) =>
  cle in DESIGNATIONS ? DESIGNATIONS[cle as keyof typeof DESIGNATIONS].lire(etat) : undefined;

const aLaCle = (table: object, cle: unknown): cle is string => typeof cle === 'string' && Object.prototype.hasOwnProperty.call(table, cle);

/** Les verbes dont la valeur suit l'axe que nomment leurs deux premiers arguments : la forme de la valeur de chaque axe
 *  par clé (`REGLAGES`, `CHOIX`), et les mots qui nomment la clé et l'axe dans un refus. */
const VERBES_A_AXES: Readonly<Record<string, { formes: Readonly<Record<string, Readonly<Record<string, Forme>>>>; cle: string; axe: string }>> = {
  [VERBE_DE_REGLAGE]: { formes: REGLAGES, cle: 'un flux réglé', axe: 'un réglage du flux' },
  [VERBE_DE_CHOIX]: { formes: CHOIX, cle: 'une fenêtre à choix', axe: 'un choix de la fenêtre' },
};

/** Les paramètres de l'axe `axe` de la clé `cle` du verbe à axes `verbe` (`VERBES_A_AXES` : le réglage d'un flux de jet,
 *  le choix d'une fenêtre) : ceux du verbe, la clé et l'axe en littéraux, la valeur à la forme de l'axe ; `null` : la clé
 *  ne déclare pas cet axe. */
export function parametresDeLAxe(verbe: string, cle: unknown, axe: unknown): readonly ParametreDeVerbe[] | null {
  const { formes } = VERBES_A_AXES[verbe];
  if (!aLaCle(formes, cle) || !aLaCle(formes[cle], axe)) return null;
  const parPosition: readonly Forme[] = [{ genre: 'litteral', valeur: cle }, { genre: 'litteral', valeur: axe }, formes[cle][axe]];
  return VERBES[verbe].map((p, i) => (parPosition[i] ? { ...p, forme: parPosition[i] } : p));
}

/** Les paramètres d'un appel du verbe `verbe` : ceux du verbe, et, pour un verbe à axes (`VERBES_A_AXES`), ceux de
 *  l'axe que ses deux premiers arguments nomment (`parametresDeLAxe`) ; une clé ou un axe que la partie ne déclare pas
 *  lève une erreur de validation qui nomme ceux qu'elle déclare. */
function parametresDeLAppel(verbe: string, args: readonly unknown[], parametres: readonly ParametreDeVerbe[]): readonly ParametreDeVerbe[] {
  const aAxes = VERBES_A_AXES[verbe];
  if (!aAxes) return parametres;
  const [cle, axe] = args;
  if (!aLaCle(aAxes.formes, cle)) throw new ErreurDeGeste('validation', `${verbe} : ${JSON.stringify(cle)} n’est pas ${aAxes.cle} (${Object.keys(aAxes.formes).join(', ')})`);
  const deLAxe = parametresDeLAxe(verbe, cle, axe);
  if (!deLAxe) throw new ErreurDeGeste('validation', `${verbe} : ${JSON.stringify(axe)} n’est pas ${aAxes.axe} ${cle} (${Object.keys(aAxes.formes[cle]).join(', ')})`);
  return deLAxe;
}

/** Les arguments d'un verbe, lus à leurs paramètres (`lireALaForme`) : un id que l'état ne désigne pas lève une erreur
 *  de validation qui nomme les ids valides, `null` omet un paramètre optionnel, un argument de forme fausse, en trop ou manquant lève une erreur de validation. */
export function argumentsDuVerbe(etat: Jeu, verbe: string, args: readonly unknown[], parametres: readonly ParametreDeVerbe[]): unknown[] {
  valider(args.length <= parametres.length, `${verbe} : ${parametres.length} argument(s) au plus (${signature(verbe, parametres)})`);
  for (const p of parametres.slice(args.length)) valider(p.optionnel, `${verbe} : l’argument ${p.nom} manque (${signature(verbe, parametres)})`);
  return args.map((brut, i) => {
    const p = parametres[i];
    // JSON n'a pas d'`undefined` : `null` omet un paramètre optionnel, pour en poser un suivant.
    if (brut === null && p.optionnel) return brut;
    const lu = lireALaForme(brut, p.forme, p.nom, designesDe(etat), FORMES);
    if ('ecart' in lu) throw new ErreurDeGeste('validation', `${verbe} : ${lu.ecart} (${signature(verbe, parametres)})`);
    return lu.valeur;
  });
}

/** Les verbes voisins d'un nom inconnu nommés dans le refus, au plus. */
const VOISINS_AU_PLUS = 8;

/** Le geste d'un verbe, ses arguments contrôlés contre le type du verbe (`VERBES`, `argumentsDuVerbe`), ceux d'un réglage
 *  de jet ou d'un choix de fenêtre contre la forme de sa valeur (`parametresDeLAppel`) ; les arguments
 *  absents sont un tableau vide. Un verbe inconnu se refuse avec ceux de la fenêtre qui tient la main et ses voisins de
 *  nom. */
export function gesteDuVerbe(etat: Jeu, v: { type: unknown; args?: unknown; siege?: unknown }, pistes: PistesDeLecture): Geste {
  valider(typeof v.type === 'string', 'jouer : un nom d’action du noyau');
  const verbe = v.type as string;
  const parametres = Object.prototype.hasOwnProperty.call(VERBES, verbe) ? VERBES[verbe] : null;
  if (!parametres) {
    const m = verbe.toLowerCase();
    const voisins = Object.keys(VERBES).filter((x) => x.toLowerCase().includes(m) || m.includes(x.toLowerCase())).slice(0, VOISINS_AU_PLUS);
    const fenetre = fenetreDuJeu(etat);
    const dits = [
      ...(fenetre?.gestes.length ? [`gestes de la fenêtre ${fenetre.cle} : ${fenetre.gestes.map(cleDuGeste).join(', ')}`] : []),
      ...(voisins.length ? [`voisins : ${voisins.join(', ')}`] : []),
    ];
    throw new ErreurDeGeste('validation', `verbe inconnu : ${verbe}${dits.length ? ` ; ${dits.join(' ; ')}` : ''}${pistes.verbe(verbe)}`);
  }
  const geste = lireGeste({ type: verbe, args: v.args ?? [], siege: v.siege });
  return { ...geste, args: argumentsDuVerbe(etat, geste.type, geste.args, parametresDeLAppel(geste.type, geste.args, parametres)) };
}

/** Les offres de l'actif (`offresDeLActif`), ou l'erreur de règle qui dit pourquoi la barre n'est pas ouverte
 *  (`etatDeLaBarre`, le verdict que lit aussi la console). */
export function offresDeLaBarre(etat: Jeu, pistes: PistesDeLecture): Offre[] {
  const barre = etatDeLaBarre(etat);
  if (barre.forme !== 'ouverte') throw new ErreurDeGeste('regle', `aucune offre : ${barre.raison}${pistes.vue}`);
  return offresDeLaBarreOuverte(etat, barre);
}

/** L'intention d'un geste, son verbe contrôlé contre `VERBES` (`gesteDuVerbe`). Un verbe joué au nom d'un siège joint le
 *  l'intention armée que ce siège voit (`argsAvecIntentionLocale`), comme le client du web la joint à son intention. Le
 *  verbe juge le geste : un verbe de la barre, par le refus de son geste (`refusDuGeste`). */
export function intentionDuGeste(etat: Jeu, geste: Geste): Intention {
  if (geste.siege === undefined) return { type: geste.type, args: geste.args } as Intention;
  return { type: geste.type, args: argsAvecIntentionLocale(() => etat, geste.type, geste.args), siege: geste.siege } as Intention;
}

/** Qui tient la main (`quiTientLaMain`) et le siège qui le joue (`siegeDe`) : ce qui rendrait le geste permis. */
function laMain(etat: Jeu): string {
  const main = quiTientLaMain(etat);
  if (main === '*') return 'la fenêtre est à tous les sièges';
  const nom = main && porteurParId(etat, main)?.label;
  return `la main est à ${nom ?? main ?? 'l’hôte'}, siège ${siegeDe(etat, main)}`;
}

/** Envoie l'intention à la partie. L'issue de la partie fait foi : `hors-allowlist` est une erreur de validation,
 *  `refusee` une erreur de permission ; un verbe qui lève est une erreur de validation. */
export function envoyerLIntention(partie: Partie, intention: Intention): ResultatDeLAppel {
  const avant = partie.etat();
  let resultat: ResultatDeLAppel;
  try {
    resultat = partie.envoyer(intention);
  } catch (erreur) {
    throw new ErreurDeGeste('validation', `${intention.type} a levé : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
  }
  if (resultat.issue === 'hors-allowlist') throw new ErreurDeGeste('validation', `${intention.type} hors de l’allowlist d’un siège`);
  if (resultat.issue === 'refusee') throw new ErreurDeGeste('permission', `${intention.type} refusée au siège ${intention.siege === undefined ? '—' : String(intention.siege)} : ${laMain(avant)}`);
  return resultat;
}
