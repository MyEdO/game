/**
 * LA CRÉATION D'UN HÉROS À L'ÉCRAN D'UN HÔTE (#3328) : le bouton qui l'ouvre ou la ferme, puis la page ouverte, une à
 * la fois (`pagesDeCreation`) : son titre et son rang, ses rubriques en éléments (`rubriquesDeLaPage`), ses gestes
 * (la page précédente, la suivante refusée tant que la page ne se quitte pas, l'engagement à la dernière). La
 * création est un état de l'hôte (`CreationOuverte`) que ses gestes changent (`apresLaCreation`) ; seul l'engagement
 * touche la partie.
 */
import {
  apresLeGeste,
  pagesDeCreation,
  refusDeLaPage,
  refusDEngagement,
  refusDUnNouveauHeros,
  rubriquesDeLaPage,
  type Jeu as Partie,
  type RubriqueDeCreation,
} from '../noyau/index';
import { t } from '../i18n';
import { jsonCanonique } from '../lib/jsonCanonique.mjs';
import {
  ligne,
  resume,
  type Bouton,
  type Choix,
  type CreationOuverte,
  type Element,
  type GesteDeLaCreation,
  type Jet,
  type Ligne,
  type Puce,
} from './elements';

/** Les options au plus d'un choix montré en rangée ; au-delà, en liste. */
const RANGEE_AU_PLUS = 11;

const bouton = (id: string, libelle: string, creation: GesteDeLaCreation | null, refus: string | null = null, presse = false, focus = false): Bouton => ({
  type: 'bouton', id, libelle, jeu: { creation }, presse, focus, refus,
});

/** Une rubrique de la page en élément : un geste en bouton, un jet tombé, un choix en rangée ou en liste (chaque option
 *  un bouton, la choisie pressée), une valeur en puce, son détail résumé (`resume`). */
function element(r: RubriqueDeCreation): Element {
  switch (r.genre) {
    case 'geste': return bouton(r.id, r.libelle, r.geste, r.refus, r.presse);
    case 'jet': return { type: 'jet', id: r.id, ton: 'neutre', qui: null, libelle: r.libelle, cible: null, resultat: r.resultat, dr: null, verdict: null, modificateurs: [], detail: r.detail } satisfies Jet;
    case 'choix': return {
      type: r.options.length > RANGEE_AU_PLUS ? 'liste' : 'choix', id: r.id, ton: 'neutre', libelle: r.libelle, focus: false, refus: null,
      valeurs: r.options.map((o, i) => bouton(`${r.id}/${i}`, o.libelle, o.geste, o.refus, o.choisie)),
    } satisfies Choix;
    case 'valeur': return { type: 'puce', id: r.id, ton: 'neutre', libelle: r.libelle, valeur: r.valeur, detail: resume(r.detail) } satisfies Puce;
  }
}

/**
 * @contrat Vue
 * Les zones de la création : le bouton qui l'ouvre ou la ferme, puis la création ouverte (`rubriquesDeLaPage`, surface
 * du noyau).
 */
export interface ZonesDeLaCreation {
  /**
   * « Nouveau héros », qui ouvre la création, refusé quand le groupe n'accueille aucun héros (`refusDUnNouveauHeros`),
   * pressé quand elle est ouverte, qu'il ferme.
   */
  'groupe.gestes': Bouton[];
  /** la page et son rang parmi les pages. */
  'creation.titre': Ligne[];
  /**
   * chaque rubrique de la page : un geste en bouton, qui tire ou bascule ; un jet tombé ; un choix en rangée, en liste
   * au-delà de onze options, chaque option un bouton, la choisie pressée, refusée avec sa raison ; une valeur en puce,
   * sa description au détail.
   */
  'creation.corps': Element[];
  /**
   * la page précédente, puis la suivante, refusée avec la raison de la page et en focus quand elle se joue, ou à la
   * dernière page l'engagement, refusé avec la raison de l'engagement.
   */
  'creation.gestes': Bouton[];
}

/** Les zones de la création `c` dans la partie `etat` : le bouton qui l'ouvre, refusé quand le groupe n'accueille aucun
 *  héros nouveau (`refusDUnNouveauHeros`), ou qui la ferme, pressé ; puis sa page ouverte, son titre et son rang, ses
 *  rubriques, ses gestes : la précédente, la suivante, refusée par `refusDeLaPage`, et à la dernière l'engagement,
 *  refusé par `refusDEngagement`, en focus. Sans création, ses zones sont vides. */
export function zonesDeLaCreation(etat: Pick<Partie, 'battle' | 'party' | 'net'>, c: CreationOuverte | null): ZonesDeLaCreation {
  const creer = bouton('creation', t('ecran.creation.creer'), c ? null : { geste: 'ouvrir', args: [] }, c ? null : refusDUnNouveauHeros(etat), c !== null);
  if (!c) return { 'groupe.gestes': [creer], 'creation.titre': [], 'creation.corps': [], 'creation.gestes': [] };
  const pages = pagesDeCreation();
  const rang = pages.indexOf(c.page);
  const precedente = pages[rang - 1];
  const suivante = pages[rang + 1];
  const refus = suivante ? refusDeLaPage(c.brouillon, c.page) : refusDEngagement(etat, c.brouillon);
  return {
    'groupe.gestes': [creer],
    'creation.titre': [ligne('page', t('ecran.creation.page', { page: t(`crea.page.${c.page}`), rang: rang + 1, total: pages.length }))],
    'creation.corps': rubriquesDeLaPage(c.brouillon, c.page).map(element),
    'creation.gestes': [
      ...(precedente ? [bouton('precedente', t('ecran.creation.precedent'), { geste: 'page', args: [precedente] })] : []),
      suivante
        ? bouton('suivante', t('ecran.creation.suivant'), { geste: 'page', args: [suivante] }, refus, false, refus === null)
        : bouton('engager', t('ecran.creation.engager'), { geste: 'engager', args: [] }, refus, false, refus === null),
    ],
  };
}

/** La création `c` après le geste `g`, qui n'est ni son ouverture ni son engagement : une page, ou un geste du
 *  brouillon. */
export const apresLaCreation = (c: CreationOuverte, g: Exclude<GesteDeLaCreation, { geste: 'ouvrir' | 'engager' }>): CreationOuverte =>
  g.geste === 'page' ? { ...c, page: g.args[0] } : { ...c, brouillon: apresLeGeste(c.brouillon, g) };

/** Le bouton des zones `z` qui joue le geste de la création `creation`, égal en profondeur (`jsonCanonique`) ;
 *  `undefined` quand l'écran n'en offre aucun. */
export function boutonDeLaCreation(z: ZonesDeLaCreation, creation: unknown): Bouton | undefined {
  const cle = jsonCanonique({ creation });
  return [...z['groupe.gestes'], ...z['creation.gestes'], ...z['creation.corps'].flatMap((e) => (e.type === 'bouton' ? [e] : e.type === 'choix' || e.type === 'liste' ? e.valeurs : []))]
    .find((b) => jsonCanonique(b.jeu) === cle);
}
