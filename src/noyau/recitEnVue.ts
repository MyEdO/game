/**
 * LE RÉCIT DE VOYAGE EN VUE (#3328) — ce qu'un hôte montre du récit d'un trajet (`travelRecap`) : son issue (arrivée,
 * interruption, arrêt, embuscade en attente), la route faite, puis à l'arrivée la durée du voyage, sinon chaque journée
 * et ce qui s'y est passé, et ce qui permet de repartir. Lecteur PUR, lu par les hôtes du noyau (`hote/ecran.ts`).
 */
import type { Jeu } from './etat';
import { clockLabel } from '../engine/duration';
import { routeDistanceLabel, travelModeLabels } from '../engine/travel';
import { elision, t } from '../i18n';
import { fenetreDuJeu } from './combatAuto';

/** Une journée de route : sa longueur et sa durée dites, et ce qui s'y est passé. */
export interface JourneeEnVue { libelle: string; lignes: string[] }

/** Le récit en vue : son issue, son titre, la route faite, la durée du voyage arrivé, les journées d'un voyage qui
 *  n'est pas arrivé, et ce qui permet d'en repartir. */
export interface RecitEnVue {
  issue: 'arrivee' | 'interruption' | 'arret' | 'embuscade';
  titre: string;
  route: string;
  duree: string | null;
  journees: JourneeEnVue[];
  suite: string | null;
}

const TITRE = { arrivee: 'trm.titreArrivee', interruption: 'trm.titreInterrompu', arret: 'trm.titreArret', embuscade: 'trm.titreEmbuscade' } as const;
const SUITE = { arrivee: null, interruption: 'trm.piedInterrompu', arret: 'trm.piedSurcharge', embuscade: 'trm.piedEmbuscade' } as const;

/** Le récit du trajet que le groupe vient de faire, quand il tient la main (`fenetreDuJeu`) ; `null` sinon. PUR. */
export function recitEnVue(s: Jeu): RecitEnVue | null {
  const r = s.travelRecap;
  if (!r || fenetreDuJeu(s)?.cle !== 'recitDeVoyage') return null;
  const mer = r.mode === 'mer';
  const issue = r.then ? 'embuscade' : r.status === 'arrived' ? 'arrivee' : r.status === 'interrupted' ? 'interruption' : 'arret';
  const reste = Math.max(0, Math.round(r.km - r.kmDone));
  const route = [
    t('trm.route', { de: elision('de', r.fromLabel), depart: r.fromLabel, vers: r.toLabel, distance: routeDistanceLabel(r.km, mer), mode: travelModeLabels()[r.mode].toLowerCase() }),
    ...(r.status === 'arrived' ? [] : [reste > 0 ? t('trm.restants', { distance: routeDistanceLabel(reste, mer) }) : t('trm.auxPortes', { lieu: r.toLabel })]),
  ].join(t('ecran.separateur'));
  const duree = r.status === 'arrived' && r.dureeMin ? clockLabel(r.dureeMin, { exact: true }) : undefined;
  return {
    issue,
    titre: t(TITRE[issue], { lieu: r.toLabel }),
    route,
    duree: duree ? t('trm.dureeVoyage', { duree }) : null,
    journees: r.status === 'arrived' ? [] : r.days.map((d, i) => ({
      libelle: t('trm.jour', { n: i + 1, distance: routeDistanceLabel(d.kmTo - d.kmFrom, mer), heures: Math.round(d.hours) }),
      lignes: d.lines.map((l) => l.text),
    })),
    suite: SUITE[issue] && t(SUITE[issue]),
  };
}
