/**
 * LE REPOS EN VUE (#3328, #4574) — ce qu'un hôte montre de la nuit à régler (`repos`, LDB 66), en données : son lieu, son
 * toit, ses nuits et sa qualité, le temps qu'il fait, puis chaque dormeur, son couchage et sa pitance parmi ce que le
 * lieu lui offre, chacun écrit en choix de la fenêtre (`fenetreChoisir('repos', …)`, `OUVERTS_DU_CHOIX`), et ce qui
 * l'attend cette nuit ; enfin la note de la halte et la bourse qui la paie. Lecteur PUR, lu par la projection des hôtes
 * (`hote/projection.ts`).
 */
import type { Jeu } from './etat';
import type { GesteDuNoyau } from './actionsDuNoyau';
import type { Combatant } from '../engine/types';
import type { PlayerText } from '../i18n/playerText';
import { exposureShelterFromTent, exposureTestCount, type ExposureSeverity } from '../engine/exposure';
import { refusDeRecuperation, type MotifDeRefusDeRecuperation } from '../engine/rest';
import { toBrass, type Money } from '../engine/money';
import { fenetreDuJeu } from './combatAuto';
import { activeExposureSeverity, nuitDispenseeParPleinAir } from './combatFlow';
import { couchagesDeLaNuit, noteDAubergeCouverte, restCost, toitDeLaNuit, type CouchageDeLaNuit, type ToitDeLaNuit } from './restFlow';
import { reglageDuChoixDeFenetre } from './choixDeFenetre';
import { VERBE_DE_CHOIX, type AxeDe } from './choixDesFenetres';
import { totalDesBourses } from './bourseFlow';
import { libelleDuChoix } from './libelles';
import { nomDuLieu } from './worldMap';
import type { QualiteDeRepos } from '../data/schemas/grammaire/valeurs';
import type { ValeurDuReglage } from './reglages';

/** Une valeur d'un choix d'un dormeur : son id, son libellé (une chambre nomme ceux qui y dorment avec lui), le geste qui
 *  la prend, si c'est la sienne et la raison qui la ferme. */
interface ValeurDeRepos { valeur: ValeurDuReglage['valeur']; libelle: string; geste: GesteDuNoyau; choisie: boolean; refus: string | null }

/** Un choix d'un dormeur : son nom, puis chaque valeur que le lieu lui offre. */
interface ChoixDeRepos<V extends ValeurDeRepos = ValeurDeRepos> { libelle: string; valeurs: V[] }

/** Ce qui attend un dormeur cette nuit : le repos qui ne lui rend aucune Blessure et son motif, le ventre vide, les Tests
 *  d'Exposition qu'il passera dehors. */
type AlerteDuDormeur = { genre: 'refusDeRecuperation'; motif: MotifDeRefusDeRecuperation } | { genre: 'ventreVide' } | { genre: 'expositions'; n: number };

/** Un dormeur : son couchage (chaque chambre offerte en données, `null` hors chambre), sa pitance, et ce qui l'attend
 *  cette nuit. */
interface DormeurEnVue {
  id: string;
  couchage: ChoixDeRepos<ValeurDeRepos & Pick<CouchageDeLaNuit, 'chambre'>>;
  pitance: ChoixDeRepos;
  alertes: AlerteDuDormeur[];
}

/** La nuit à régler : son lieu (un nom, ou la route d'une halte par les ids et les noms de ses deux extrémités), son
 *  toit, ses nuits et sa qualité ; le temps qu'il fait (sa sévérité, le Plein air qui en dispense, la tente qui en
 *  abrite) ; ses dormeurs ; sa note (`null` : gratuite), la bourse du groupe et si elle la couvre. */
export interface ReposEnVue {
  lieu: { nom: PlayerText } | { route: { de: string; vers: string; deNom: PlayerText; versNom: PlayerText } };
  toit: ToitDeLaNuit;
  nuits: number;
  qualite: QualiteDeRepos;
  temps: { severite: ExposureSeverity; pleinAir: boolean; abrite: boolean };
  dormeurs: DormeurEnVue[];
  note: { cout: Money; bourse: Money; couverte: boolean } | null;
}

/** Le choix `axe` du dormeur `h`, parmi ce que la nuit lui ouvre (`OUVERTS_DU_CHOIX`). */
function choix(s: Jeu, h: Combatant, axe: AxeDe<'repos'>): ChoixDeRepos {
  const r = reglageDuChoixDeFenetre(s, 'repos', axe, h.id);
  return {
    libelle: libelleDuChoix('repos', axe),
    valeurs: (r.valeurs ?? []).map((v) => ({ valeur: v.valeur, libelle: v.libelle, geste: { verbe: VERBE_DE_CHOIX, args: ['repos', axe, v.valeur, h.id] }, choisie: v.valeur === r.courant, refus: v.refus })),
  };
}

/** La nuit à régler, `null` hors de la fenêtre du repos. PUR. */
export function reposEnVue(s: Jeu): ReposEnVue | null {
  const p = s.pendingRest;
  if (!p || fenetreDuJeu(s)?.cle !== 'repos') return null;
  const severite = activeExposureSeverity(() => s);
  const abrite = exposureShelterFromTent(s.party);
  const expositions = exposureTestCount(severite, abrite);
  const cout = restCost(p, s.party);
  const nom = (id: string) => nomDuLieu(s.worldMap, id);
  return {
    lieu: 'nom' in p.lieu ? { nom: p.lieu.nom } : { route: { ...p.lieu.route, deNom: nom(p.lieu.route.de), versNom: nom(p.lieu.route.vers) } },
    toit: toitDeLaNuit(p, s.party),
    nuits: p.days,
    qualite: p.quality,
    temps: { severite, pleinAir: nuitDispenseeParPleinAir(() => s), abrite },
    dormeurs: s.party.filter((h) => !h.dead && p.perHero[h.id]).map((h) => {
      const { lodging, food } = p.perHero[h.id];
      const chambres = new Map<ValeurDuReglage['valeur'], CouchageDeLaNuit['chambre']>(couchagesDeLaNuit(p, s.party, h.id).map((c) => [c.id, c.chambre]));
      const couchage = choix(s, h, 'couchage');
      const motif = refusDeRecuperation(h);
      return {
        id: h.id,
        couchage: { ...couchage, valeurs: couchage.valeurs.map((v) => ({ ...v, chambre: chambres.get(v.valeur) ?? null })) },
        pitance: choix(s, h, 'pitance'),
        alertes: [
          ...(motif ? [{ genre: 'refusDeRecuperation', motif } as const] : []),
          ...(food === 'rien' ? [{ genre: 'ventreVide' } as const] : []),
          ...(lodging === 'dehors' && expositions > 0 ? [{ genre: 'expositions', n: expositions } as const] : []),
        ],
      };
    }),
    note: toBrass(cout) > 0 ? { cout, bourse: totalDesBourses(s.party), couverte: noteDAubergeCouverte(s) } : null,
  };
}
