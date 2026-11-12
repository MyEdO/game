/**
 * LA PARTIE HORS DE SA SCÈNE (#3009), commune aux hôtes du noyau : tant qu'aucune partie n'est en cours
 * (`partieEnCours`), chaque pré-tiré de la donnée en entité, avec le bouton qui le recrute, et chaque campagne du jeu
 * (`allBuiltinCampaigns`) en entité, avec le bouton qui la lance (`{ lancer }`) ; à tout moment, le bouton qui ouvre
 * ses sauvegardes (`{ sauvegardes }`) et celui qui quitte la partie (`{ quitter }`). Le noyau juge chaque refus.
 */
import { partieEnCours, pretiresOfferts, refusDeLancer, type Jeu as Partie } from '../noyau/index';
import { t } from '../i18n';
import { allBuiltinCampaigns } from '../scenes/campaign';
import { ligne, type Bouton, type Entite } from './elements';

/**
 * @contrat Vue
 * Les zones de la partie hors de sa scène : son groupe à composer et la campagne à lancer, vides dès qu'elle est en
 * cours (`partieEnCours`, surface du noyau), et le geste qui la quitte.
 */
export interface ZonesDeLaPartie {
  /**
   * chaque pré-tiré de la donnée en entité (`pretiresOfferts`, surface du noyau) : son nom, son espèce et sa carrière,
   * et « Recruter », dont le `jeu` est l'intention du noyau qui le recrute, refusé avec sa raison (groupe plein, héros
   * déjà au groupe).
   */
  'groupe.pretires': Entite[];
  /**
   * chaque campagne du jeu en entité : son nom, sa description, et « Lancer », dont le `jeu` `{ lancer }` porte l'id
   * que la méthode `lancer` reçoit, refusé avec la raison du noyau (`refusDeLancer` : groupe vide, siège invité à
   * pourvoir).
   */
  'groupe.campagnes': Entite[];
  /**
   * « Sauvegardes », dont le `jeu` `{ sauvegardes: true }` ouvre le panneau des sauvegardes (méthode `sauvegardes`),
   * puis « Quitter la partie », dont le `jeu` `{ quitter: true }` appelle la méthode `quitter`.
   */
  'partie.gestes': Bouton[];
}

/** Les zones de la partie `etat` hors de sa scène : le geste qui ouvre ses sauvegardes, celui qui la quitte, et,
 *  avant son lancement, son groupe à composer et la campagne à lancer. */
export function zonesDeLaPartie(etat: Pick<Partie, 'battle' | 'party' | 'net' | 'scene' | 'pendingCampaign'>): ZonesDeLaPartie {
  const gestes: Bouton[] = [
    { type: 'bouton', id: 'sauvegardes', libelle: t('ecran.partie.sauvegardes'), jeu: { sauvegardes: true }, presse: false, focus: false, refus: null },
    { type: 'bouton', id: 'quitter', libelle: t('ecran.partie.quitter'), jeu: { quitter: true }, presse: false, focus: false, refus: null },
  ];
  if (partieEnCours(etat)) return { 'groupe.pretires': [], 'groupe.campagnes': [], 'partie.gestes': gestes };
  const refus = refusDeLancer(etat);
  return {
    'partie.gestes': gestes,
    'groupe.pretires': pretiresOfferts(etat).map((p): Entite => {
      const recruter: Bouton = { type: 'bouton', id: `recruter/${p.id}`, libelle: t('ecran.groupe.recruter'), jeu: p.recrutement, presse: false, focus: false, refus: p.refus };
      return { type: 'entite', id: `pretire/${p.id}`, ton: 'neutre', nom: p.nom, elements: [ligne('fiche', [p.espece, p.carriere].filter((x) => x !== null).join(t('ecran.separateur'))), recruter] };
    }),
    'groupe.campagnes': allBuiltinCampaigns.map((c): Entite => {
      const lancer: Bouton = { type: 'bouton', id: `lancer/${c.id}`, libelle: t('ecran.groupe.lancer'), jeu: { lancer: c.id }, presse: false, focus: false, refus };
      return { type: 'entite', id: `campagne/${c.id}`, ton: 'neutre', nom: c.label, elements: [...(c.desc ? [ligne('desc', c.desc)] : []), lancer] };
    }),
  };
}
