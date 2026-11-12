/**
 * LE REPOS EN VUE (#3328) — ce qu'un hôte montre de la nuit à régler (`repos`, LDB 66) : la nuit, son lieu et sa durée,
 * le temps qu'il fait, puis chaque dormeur, son couchage et sa pitance parmi ce que le lieu lui offre, chacun écrit en
 * choix de la fenêtre (`fenetreChoisir('repos', …)`, `OUVERTS_DU_CHOIX`), et ce qui l'attend cette nuit ; enfin la note
 * de la halte et la bourse qui la paie.
 * Lecteur PUR, lu par les hôtes du noyau (`hote/ecran.ts`).
 */
import type { Jeu } from './etat';
import type { GesteDuNoyau } from './actionsDuNoyau';
import type { Combatant } from '../engine/types';
import { exposureShelterFromTent, exposureTestCount } from '../engine/exposure';
import { refusDeRecuperation } from '../engine/rest';
import { formatMoney, toBrass } from '../engine/money';
import { fenetreDuJeu } from './combatAuto';
import { activeExposureSeverity, nuitDispenseeParPleinAir } from './combatFlow';
import { nightTitle, noteDAubergeCouverte, restCost, toitDeLaNuit, type ToitDeLaNuit } from './restFlow';
import { reglageDuChoixDeFenetre } from './choixDeFenetre';
import { VERBE_DE_CHOIX, type AxeDe } from './choixDesFenetres';
import { totalDesBourses } from './bourseFlow';
import { libelleDuChoix } from './libelles';
import { t } from '../i18n';

/** Un choix d'un dormeur : son nom, puis chaque valeur que le lieu lui offre, le geste qui la prend et si c'est la sienne. */
export interface ChoixDeRepos { libelle: string; valeurs: { libelle: string; geste: GesteDuNoyau; choisie: boolean }[] }

/** Un dormeur : son couchage, sa pitance, et ce qui l'attend cette nuit. */
export interface DormeurEnVue { id: string; couchage: ChoixDeRepos; pitance: ChoixDeRepos; alertes: string[] }

/** La nuit à régler : son titre, son toit, le temps qu'il fait (`null` : clément), ses dormeurs, et sa note (`null` :
 *  gratuite), couverte ou non par les bourses du groupe. */
export interface ReposEnVue {
  nuit: string;
  toit: ToitDeLaNuit;
  temps: { texte: string; alerte: boolean } | null;
  dormeurs: DormeurEnVue[];
  note: { texte: string; couverte: boolean } | null;
}

/** Le choix `axe` du dormeur `h`, parmi ce que la nuit lui ouvre (`OUVERTS_DU_CHOIX`). */
function choix(s: Jeu, h: Combatant, axe: AxeDe<'repos'>): ChoixDeRepos {
  const r = reglageDuChoixDeFenetre(s, 'repos', axe, h.id);
  return {
    libelle: libelleDuChoix('repos', axe),
    valeurs: (r.valeurs ?? []).map((v) => ({ libelle: v.libelle, geste: { verbe: VERBE_DE_CHOIX, args: ['repos', axe, v.valeur, h.id] }, choisie: v.valeur === r.courant })),
  };
}

/** Le temps de la nuit : le Plein air qui en dispense, sinon le mauvais temps et la tente qui en abrite. */
function tempsDeLaNuit(s: Jeu): ReposEnVue['temps'] {
  if (nuitDispenseeParPleinAir(() => s)) return { texte: t('rf.pleinAirDispense'), alerte: false };
  const severite = activeExposureSeverity(() => s);
  if (severite === 'clement') return null;
  const abri = exposureShelterFromTent(s.party);
  return { texte: [t(severite === 'extreme' ? 'rf.tempsDeChien' : 'rf.mauvaisTemps'), ...(abri ? [t('rf.tenteAbrite')] : [])].join(' — '), alerte: true };
}

/** La nuit à régler, `null` hors de la fenêtre du repos. PUR. */
export function reposEnVue(s: Jeu): ReposEnVue | null {
  const p = s.pendingRest;
  if (!p || fenetreDuJeu(s)?.cle !== 'repos') return null;
  const expositions = exposureTestCount(activeExposureSeverity(() => s), exposureShelterFromTent(s.party));
  const cout = restCost(p, s.party);
  return {
    nuit: [`${nightTitle(p, s.party)} — ${p.lieu}`, ...(p.days > 1 ? [t('rf.nuits', { n: p.days })] : []), ...(p.quality === 'pietre' ? [t('rf.pietre')] : [])].join(' · '),
    toit: toitDeLaNuit(p, s.party),
    temps: tempsDeLaNuit(s),
    dormeurs: s.party.filter((h) => !h.dead && p.perHero[h.id]).map((h) => {
      const { lodging, food } = p.perHero[h.id];
      return {
        id: h.id,
        couchage: choix(s, h, 'couchage'),
        pitance: choix(s, h, 'pitance'),
        alertes: [
          refusDeRecuperation(h),
          food === 'rien' ? t('rf.ventreVide') : null,
          lodging === 'dehors' && expositions > 0 ? t('rf.expositions', { n: expositions }) : null,
        ].filter((a): a is string => a !== null),
      };
    }),
    note: toBrass(cout) > 0 ? { texte: t('rf.note', { cout: formatMoney(cout), bourse: formatMoney(totalDesBourses(s.party)) }), couverte: noteDAubergeCouverte(s) } : null,
  };
}
