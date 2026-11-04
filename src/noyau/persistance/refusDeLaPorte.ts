import { IMPORT_FORME_DEPOT } from './bibliotheque';
import { exigerUnRefus, PROJET_AUTRE_FORMAT, SCENE_AUTRE_FORMAT, type CauseDeRefus } from '../worldMap';
import { cheminLisible, type Faute, type SegmentDeLieu } from '../../data/schemas/validate';
import { t } from '../../i18n';

/** Un refus RENDU : `message` en mots du joueur ou de l'auteur, `detail` = le rapport technique,
 *  replié sous le message quand le message ne le reprend pas. */
export type RefusRendu = { message: string; detail?: string };

/**
 * Les gestes qui font passer un document par la porte du projet (`parseProject`, et
 * `parseSceneDeProjet` pour la reprise d'une sauvegarde locale), chacun avec le VERBE de son
 * refus, ce qu'il dit d'un document SANS NOM, le TERME du document d'un autre format
 * (`autreFormat`), la PHRASE de chaque cause hors schéma (`causes`), et la CONSÉQUENCE qu'il
 * ÉNONCE. Un geste qui RELIT une donnée persistée (ouverture, import, reprise) n'en énonce aucune (`null`) : son verbe la dit déjà ; son message tient
 * en une phrase, le verbe et la cause, la faute reste au détail. Un geste qui valide l'état EN COURS
 * de l'auteur énonce ce que son refus empêche et NOMME la faute (#2404). UNE table : ces chaînes
 * ne sont pas libres, un appelant ne peut pas les désaccorder — « Import refusé : ce projet ne
 * pourrait plus être rouvert » serait faux, rien n'ayant jamais été ouvert ni écrit.
 */
const PROJET_SANS_NOM = 'ce projet n’a pas de nom';

/** Ce qu'un refus HORS SCHÉMA dit à l'auteur, par CAUSE, selon ce que le geste LIT : le rapport
 *  technique reste en détail. `IMPORT_FORME_DEPOT` ne vaut que pour un geste qui lit un FICHIER ;
 *  ailleurs, la cause se dit sous le terme de l'autre format (#2404). */
type PhrasesDeCause = Readonly<Record<Exclude<CauseDeRefus, 'schema'>, string>>;
const PROJET_EN_MEMOIRE: PhrasesDeCause = {
  'prose-non-materialisee': `${PROJET_AUTRE_FORMAT}.`,
  entree: 'Sa scène de départ n’existe pas dans le projet.',
};
const FICHIER_DE_PROJET: PhrasesDeCause = { ...PROJET_EN_MEMOIRE, 'prose-non-materialisee': IMPORT_FORME_DEPOT };
const SAUVEGARDE_LOCALE: PhrasesDeCause = { 'prose-non-materialisee': `${SCENE_AUTRE_FORMAT}.`, entree: `${SCENE_AUTRE_FORMAT}.` };

const GESTES_DE_PORTE = {
  ouverture: { verbe: 'Ouverture refusée', consequence: null, sansNom: PROJET_SANS_NOM, autreFormat: PROJET_AUTRE_FORMAT, causes: PROJET_EN_MEMOIRE },
  enregistrement: { verbe: 'Enregistrement refusé', consequence: 'ce projet ne pourrait plus être rouvert', sansNom: PROJET_SANS_NOM, autreFormat: PROJET_AUTRE_FORMAT, causes: PROJET_EN_MEMOIRE },
  export: { verbe: 'Export refusé', consequence: 'ce fichier ne pourrait plus être rouvert', sansNom: PROJET_SANS_NOM, autreFormat: PROJET_AUTRE_FORMAT, causes: PROJET_EN_MEMOIRE },
  import: { verbe: 'Import refusé', consequence: null, sansNom: PROJET_SANS_NOM, autreFormat: PROJET_AUTRE_FORMAT, causes: FICHIER_DE_PROJET },
  test: { verbe: 'Mise à l’essai refusée', consequence: 'ce projet ne pourrait pas être joué', sansNom: PROJET_SANS_NOM, autreFormat: PROJET_AUTRE_FORMAT, causes: PROJET_EN_MEMOIRE },
  reprise: { verbe: 'Restauration refusée', consequence: null, sansNom: 'cette sauvegarde locale n’a pas de nom', autreFormat: SCENE_AUTRE_FORMAT, causes: SAUVEGARDE_LOCALE },
} as const;

/** Geste dont la porte du document peut opposer un refus — union FERMÉE. */
export type GesteDePorte = keyof typeof GESTES_DE_PORTE;

/** Une faute SANS NOM : elle porte sur `id` ou `label` à la racine du document — aucun réglage de
 *  contenu ne sauvera le projet. credo.md:7, 1ʳᵉ phrase. */
const estSansNom = (f: Faute): boolean => f.chemin.length === 1 && (f.chemin[0] === 'id' || f.chemin[0] === 'label');

/** Le lieu d'une faute en mots d'AUTEUR : le champ RACINE sous son LIBELLÉ de document
 *  (`projetDoc.meta`), chaque élément à clé par son libellé (sa clé à défaut). */
function lieuDAuteur(lieu: readonly SegmentDeLieu[]): string {
  return cheminLisible(lieu, element => element.libelle ?? element.cle);
}

/**
 * Traduit en refus d'ÉCRAN le refus que la porte oppose à un geste — UN traducteur pour tous les
 * gestes, qui lit la CAUSE et les fautes (`ProjetRefuse`), jamais le texte du rapport. Un document
 * fautif à sa RACINE et un projet SANS NOM se disent en mots d'auteur, comme la faute d'un geste qui ne
 * la nomme pas (conséquence `null`). Sinon, ce que l'auteur doit savoir tient en deux faits : la CONSÉQUENCE du refus, et OÙ est la première
 * faute ; les suivantes sont COMPTÉES. Le rapport de la porte reste en `detail` dès que le message
 * ne le reprend pas. Toute autre erreur n'est pas un refus de la porte : elle remonte telle quelle.
 */
export function refusDeLaPorteDuProjet(erreur: unknown, geste: GesteDePorte): RefusRendu {
  exigerUnRefus(erreur);
  const { verbe, consequence, sansNom, autreFormat: terme, causes } = GESTES_DE_PORTE[geste];
  const phrase = (cause: string): string =>
    consequence === null ? `${verbe} : ${cause.charAt(0).toLocaleLowerCase('fr') + cause.slice(1)}` : `${verbe} : ${consequence}. ${cause}`;
  if (erreur.cause !== 'schema') {
    return { message: phrase(causes[erreur.cause]), detail: erreur.message };
  }
  const autreFormat = { message: phrase(`${terme}.`), detail: erreur.message };
  if (erreur.fautes.some((f) => f.chemin.length === 0)) return autreFormat;
  if (erreur.fautes.some(estSansNom)) return { message: `${verbe} : ${sansNom}.`, detail: erreur.message };
  if (consequence === null) return autreFormat;
  const [premiere, ...autres] = erreur.fautes;
  const suite = autres.length > 0 ? ` ${t('projet.refus.autresFautes', { n: autres.length, s: autres.length > 1 ? 's' : '' })}` : '';
  // Une phrase reprend en MAJUSCULE après le point : `lieuDAuteur` rend un fragment (« Scènes … »),
  // il est donc INTRODUIT au lieu d'être recollé nu derrière la ponctuation.
  const message = `${verbe} : ${consequence}. Faute : ${lieuDAuteur(premiere.lieu)} — ${premiere.message}${suite}`;
  return autres.length > 0 ? { message, detail: erreur.message } : { message };
}

/** Refus d'un geste HORS de la porte (fichier qui n'est pas du JSON, groupe vide) : le verbe vient
 *  de la même table, le `motif` dit ce qui manque. */
export function refusMotive(geste: GesteDePorte, motif: string): RefusRendu {
  return { message: `${GESTES_DE_PORTE[geste].verbe} : ${motif}.` };
}
