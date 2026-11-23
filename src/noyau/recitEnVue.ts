/**
 * LE RÉCIT DE VOYAGE EN VUE (#3328, #4574) — ce qu'un hôte montre du récit d'un trajet (`travelRecap`), en données :
 * son issue (arrivée, interruption, arrêt, embuscade en attente), ses lieux et sa route, son mode, sa distance et ce
 * qui en reste, la durée du voyage arrivé et chaque journée du segment (`journeeEnVue`). Lecteur PUR, lu par la
 * projection des hôtes (`hote/projection.ts`).
 */
import type { Jeu } from './etat';
import { distanceDeRoute, type Distance } from '../engine/travel';
import { fenetreDuJeu } from './combatAuto';
import { modeEnVue, type ModeEnVue } from './carteEnVue';
import { journeeEnVue, type JourneeEnVue } from './voyageEnVue';
import { nomDuLieu } from './worldMap';

/** Le récit en vue : son issue ; `depart`, `arrivee` et `route` par leur id, `de` et `vers` les noms des deux lieux ;
 *  `distance` du trajet et `reste`, la distance exacte qui reste (`null` à l'arrivée), en km (`runTravelDays`) ;
 *  `dureeMin`, la durée du voyage arrivé en minutes de jeu (`null` hors d'une arrivée) ; `journees`, chaque journée du
 *  segment. */
export interface RecitEnVue {
  issue: 'arrivee' | 'interruption' | 'arret' | 'embuscade';
  depart: string; arrivee: string; route: string; de: string; vers: string;
  mode: ModeEnVue;
  distance: Distance; reste: Distance | null; dureeMin: number | null;
  journees: JourneeEnVue[];
}

/** Le récit du trajet que le groupe vient de faire, quand il tient la main (`fenetreDuJeu`) ; `null` sinon. PUR. */
export function recitEnVue(s: Jeu): RecitEnVue | null {
  const r = s.travelRecap;
  if (!r || fenetreDuJeu(s)?.cle !== 'recitDeVoyage') return null;
  const nom = (id: string) => nomDuLieu(s.worldMap, id);
  const arrive = r.status === 'arrived';
  return {
    issue: r.then ? 'embuscade' : arrive ? 'arrivee' : r.status === 'interrupted' ? 'interruption' : 'arret',
    depart: r.depart, arrivee: r.arrivee, route: r.route, de: nom(r.depart), vers: nom(r.arrivee),
    mode: modeEnVue(r.mode),
    distance: distanceDeRoute(r.km, false),
    reste: arrive ? null : distanceDeRoute(Math.max(0, r.km - r.kmDone), false),
    dureeMin: r.dureeMin ?? null,
    journees: r.days.map(journeeEnVue),
  };
}
