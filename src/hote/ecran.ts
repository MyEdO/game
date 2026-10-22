/**
 * L'ÉCRAN D'UN HÔTE QUI DESSINE LA PARTIE (#2928), commun aux hôtes qui la montrent au joueur : le panneau du combat
 * (le round et le tour, la fiche de l'actif, l'issue du combat, le titre du journal), le libellé de chaque offre de la
 * barre, et ce que l'aperçu du premier clic coûte. Chaque texte vient du catalogue (`t()`) et des lecteurs du noyau ;
 * l'hôte n'écrit aucun libellé, et le joueur ne lit aucun id.
 */
import { ACTIONS, conditionLabel } from '../noyau/index';
import { t } from '../i18n';
import { garanti } from '../lib/garanti';
import type { Projection } from './projection';

/** Le panneau du combat, en lignes prêtes à écrire. `raison` : pourquoi la barre est fermée, `null` quand elle est
 *  ouverte ou qu'une fenêtre tient la main (la fenêtre le dit). `offres` : le libellé de chaque offre, par son id. */
export interface PanneauDuCombat {
  tour: string;
  fiche: string[];
  raison: string | null;
  apercu: string | null;
  fin: string | null;
  journal: string;
  offres: Record<string, string>;
}

type Combat = NonNullable<Projection['combat']>;

/** La fiche de l'actif : son nom, ses Blessures, son Avantage, son Mouvement, son Action, ses États. */
function fiche(actif: NonNullable<Combat['actif']>): string[] {
  const etats = actif.etats.map((e) => t('ecran.etat', { etat: conditionLabel(e.id), n: e.valeur }));
  return [
    actif.nom,
    t('ecran.blessures', { courant: actif.pb[0], max: actif.pb[1] }),
    t('ecran.avantage', { n: actif.avantage }),
    t('ecran.mouvement', { restant: actif.mouvement[0], total: actif.mouvement[1] }),
    t('ecran.action', { etat: t(`ecran.action.${actif.action}`) }),
    t('ecran.etats', { liste: etats.length ? etats.join(', ') : t('ecran.etats.aucun') }),
  ];
}

/** Ce que l'aperçu du premier clic dit : le Mouvement qu'il coûte, ou le second clic qui le confirme. */
const apercuDe = (a: Combat['apercu']): string | null => (a ? (a.cout !== null ? t('ecran.apercu', { cout: a.cout }) : t('ecran.apercu.cible')) : null);

/** Le libellé de chaque offre, par son id (`ACTIONS`), son coût dit. */
const libellesDesOffres = (offres: NonNullable<Combat['offres']>['liste']): Record<string, string> =>
  Object.fromEntries(offres.map((o) => {
    const libelle = garanti(ACTIONS.find((a) => a.id === o.id)?.label, o.id, 'libellé de l’offre');
    return [o.id, o.cout === null ? libelle : t('ecran.offre', { libelle, cout: o.cout })];
  }));

/** Le panneau du combat de la projection `p` ; `null` hors combat. */
export function panneauDuCombat(p: Projection): PanneauDuCombat | null {
  const c = p.combat;
  if (!c) return null;
  return {
    tour: t('ecran.tour', { round: c.round, tour: c.tour, tours: c.tours }),
    fiche: c.actif ? fiche(c.actif) : [],
    raison: p.fenetre ? null : c.barre.raison,
    apercu: apercuDe(c.apercu),
    fin: c.fin ? t('ecran.fin', { issue: t(`ecran.fin.${c.fin}`) }) : null,
    journal: t('ecran.journal'),
    offres: libellesDesOffres(c.offres?.liste ?? []),
  };
}
