/**
 * LE CHOIX D'UNE FENÊTRE (#3369) : un seul verbe, `fenetreChoisir(fenetre, axe, valeur, pid?)`, la fenêtre en argument, le
 * héros en dernier pour un choix de rangée. Chaque
 * choix se déclare à `ChoixDesFenetres` et `CHOIX_DES_FENETRES` (`choixDesFenetres.ts`) ; les valeurs que l'état lui
 * ouvre vivent dans la table totale `OUVERTS_DU_CHOIX`, que lisent le refus du verbe (`refusDuChoix`) et les hôtes du
 * noyau (`reglagesDesChoix`) ; son corps vit dans la table totale `CorpsDesChoix`, assemblée par `fabriquesDuNoyau.ts`.
 */
import { t } from '../i18n';
import { garanti } from '../lib/garanti';
import { fateSaveOptions } from '../engine/fortune';
import { isHealable } from '../engine/healing';
import { findMoraleFactor, payChoices } from '../engine/crewMorale';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { Jeu } from './etat';
import type { Get, Set } from './flowTypes';
import { DESIGNATIONS } from './designations';
import { libelleDeLaFermeture, libelleDuChoix, libelleDuLitteral, libelleDuParametre } from './libelles';
import { fenetreDuRegistre, surfaceTientLaMain, type GesteDuJeu } from './modalArbiter';
import { plaiesNommees } from './medicFlow';
import { reponsesDuNoeud } from './dialogue';
import { refuserGesteDuSiege } from './refusVisible';
import type { Reglage, ValeurDuReglage } from './reglages';
import { refusDeChoixDePaie } from './shipCrew';
import { refusDePayerManann } from './seaVoyageFlow';
import { corruptionTarget } from './corruptionFlow';
import { activityById } from '../engine/activities';
import { plafondDeMiseDOpportunite, plafondDePlanque, seaActivitiesCatalog, seaActivityBlocked, seaActivityRefus } from './seaActivities';
import { decidingSeat } from './netOwnership';
import { seatOwns } from './sieges';
import type { IdDeHeros } from './designations';
import { herosDeLaSeance, type AxeDuGroupe, type AxeDuHerosDeLaSeance } from './partyFlow';
import {
  VERBE_DE_CHOIX, declarationDuChoix, type AxeDe, type AxeDuChoix, type CorpsDesChoix, type FenetreAChoix, type OuvertsDuChoix,
} from './choixDesFenetres';

/** Le réglage de l'axe `axe` de la fenêtre `fenetre`, sur le héros `pid` d'un choix de rangée : ses valeurs `valeurs`,
 *  chacune avec la raison qui la ferme, et sa valeur `courant`. */
const reglage = <F extends FenetreAChoix>(fenetre: F, axe: AxeDe<F>, valeurs: (s: Jeu, pid: IdDeHeros | undefined) => readonly ValeurDuReglage[], courant: (s: Jeu, pid: IdDeHeros | undefined) => ValeurDuReglage['valeur'] = () => null) => (s: Jeu, pid: IdDeHeros | undefined): Reglage => ({
  geste: { verbe: VERBE_DE_CHOIX, fenetre, axe: axe as AxeDuChoix },
  libelle: libelleDuChoix(fenetre, axe),
  courant: courant(s, pid),
  valeurs: [...valeurs(s, pid)],
  bornes: null,
  note: null,
});

/** Le réglage de l'axe numérique `axe` de la fenêtre `fenetre`, sur le héros `pid` d'un choix de rangée : de 0 à la borne
 *  `max` (`null` : l'axe n'est pas ouvert), et sa valeur `courant` ; hors de toute rangée, la forme de l'axe le dit. */
const quantite = <F extends FenetreAChoix>(fenetre: F, axe: AxeDe<F>, max: (s: Jeu, pid: IdDeHeros) => number | null, courant: (s: Jeu, pid: IdDeHeros) => number) => (s: Jeu, pid: IdDeHeros | undefined): Reglage => {
  const base = { geste: { verbe: VERBE_DE_CHOIX, fenetre, axe: axe as AxeDuChoix }, libelle: libelleDuChoix(fenetre, axe), note: null };
  if (pid === undefined) return { ...base, courant: null, valeurs: null, bornes: null };
  const borne = max(s, pid);
  return borne === null
    ? { ...base, courant: null, valeurs: [], bornes: null }
    : { ...base, courant: courant(s, pid), valeurs: null, bornes: { min: 0, max: borne, pas: 1 } };
};

/** Le paramètre du verbe qui désigne le héros d'un choix de rangée. */
const PARAMETRE_DE_RANGEE = 'pid';

/** Une valeur ouverte, nommée `libelle`, que ferme `refus` (`null` : ouverte). */
const ouverte = (valeur: ValeurDuReglage['valeur'], libelle: string, refus: string | null = null): ValeurDuReglage => ({ valeur, libelle, refus });
/** Oui, puis non, tant que `ouvert` (sur le héros `pid` d'un choix de rangée) ; chacune fermée par la raison de `refus`. */
const ouiNon = (ouvert: (s: Jeu, pid: IdDeHeros | undefined) => boolean, refus: (s: Jeu, v: boolean) => string | null = () => null) => (s: Jeu, pid: IdDeHeros | undefined): ValeurDuReglage[] =>
  (ouvert(s, pid) ? [true, false].map((v) => ouverte(v, garanti(libelleDuLitteral(v), String(v), 'libellé du booléen'), refus(s, v))) : []);

/** Le héros `pid` de la semaine en mer : un héros du groupe qui tient encore une Activité (MDG 15 l.268). */
const herosDeLaSemaine = (s: Jeu, pid: IdDeHeros) => (s.pendingSeaActivities ? s.party.find((h) => h.id === pid && !h.dead && !h.outOfRencontre) : undefined);
/** Le choix du héros `pid` pour la semaine en mer, et l'Activité qu'il a choisie. */
const choixDuHeros = (s: Jeu, pid: IdDeHeros | undefined) => (pid === undefined ? undefined : s.pendingSeaActivities?.picks[pid] ?? undefined);
const activiteChoisie = (s: Jeu, pid: IdDeHeros) => {
  const id = choixDuHeros(s, pid)?.activityId;
  return id === undefined ? undefined : activityById(id);
};

/** La fin de séance ouverte, sur le héros `pid` d'une case de héros (hors de toute rangée : tout héros). */
const seanceOuverte = (s: Jeu, pid: IdDeHeros | undefined): boolean => !!s.finDeSeance && (pid === undefined || herosDeLaSeance(s).some((h) => h.id === pid));
/** La case `axe` du groupe de la fin de séance. */
const caseDuGroupe = (axe: AxeDuGroupe) => reglage('finDeSeance', axe, ouiNon(seanceOuverte), (s) => s.finDeSeance?.groupe[axe] ?? false);
/** La case `axe` du héros `pid` de la fin de séance. */
const caseDuHeros = (axe: AxeDuHerosDeLaSeance) => reglage('finDeSeance', axe, ouiNon(seanceOuverte), (s, pid) => (pid === undefined ? null : s.finDeSeance?.heros[pid]?.[axe] ?? false));

/** L'issue du Sauvetage par le Destin, dans l'ordre de la fenêtre : celles que sa source offre (`fateSaveOptions`), puis
 *  la mort acceptée. LDB 17 l.29-32 */
const ISSUES_DU_DESTIN = ['negate', 'survive', 'accept'] as const;

/** Les valeurs ouvertes de chaque choix, table TOTALE sur `ChoixDesFenetres`. */
export const OUVERTS_DU_CHOIX = {
  fateSave: {
    issue: reglage('fateSave', 'issue', (s) => {
      const p = s.pendingFateSave;
      const offertes = p ? fateSaveOptions(p.source) : [];
      return p ? ISSUES_DU_DESTIN.filter((v) => v === 'accept' || offertes.includes(v)).map((v) => ouverte(v, t(`valeur.issue.${v}`))) : [];
    }),
  },
  // LDB 17 l.67
  renounce: { renier: reglage('renounce', 'renier', ouiNon((s) => !!s.pendingRenounce, (s, renier) => (renier && (corruptionTarget(s, s.pendingRenounce?.heroId)?.resilience ?? 0) <= 0 ? libelleDeLaFermeture('sansResilience') : null))) },
  mountTarget: {
    cible: reglage('mountTarget', 'cible', (s) => DESIGNATIONS.IdDuCoupleMonte.lire(s).map((id) => ouverte(id, garanti(DESIGNATIONS.IdDuCoupleMonte.nom(s, id), id, 'couple monté')))),
  },
  council: {
    paie: reglage('council', 'paie', (s) => (s.pendingCouncil?.phase === 'choix'
      ? payChoices().map(({ factorId }) => ouverte(factorId, garanti(findMoraleFactor(factorId), factorId, 'choix de paie').label, refusDeChoixDePaie(s, factorId)))
      : [])),
  },
  manannPriest: { payer: reglage('manannPriest', 'payer', ouiNon((s) => !!s.pendingManannPriest, (s, payer) => (payer ? refusDePayerManann(s) : null))) },
  shoreLeave: { accorder: reglage('shoreLeave', 'accorder', ouiNon((s) => !!s.pendingShoreLeave)) },
  medic: {
    patient: reglage('medic', 'patient', (s) => {
      const verrou = s.pendingHeal || s.pendingSurgery || s.medic?.surgery ? libelleDeLaFermeture('soinEnCours') : null;
      return s.party.map((h) => ouverte(h.id, h.label, verrou ?? (isHealable(h) ? null : t('medic.patientSansSoin'))));
    }, (s) => s.medic?.patientId ?? null),
    abandon: reglage('medic', 'abandon', (s) => (s.medic?.surgery || s.pendingSurgery ? [ouverte(true, libelleDuChoix('medic', 'abandon'))] : [])),
    plaie: reglage('medic', 'plaie', (s) => plaiesNommees(s).map((p) => ouverte(p.uid, p.libelle)), (s) => s.medic?.surgery?.traumaUid ?? null),
  },
  // Sous une surface qui tient la main, la conversation est suspendue : la réponse n'y dit pas son refus.
  dialogue: { reponse: reglage('dialogue', 'reponse', (s) => reponsesDuNoeud(s).map((r) => ouverte(r.id, r.label, surfaceTientLaMain(s) ? null : r.refus ?? null))) },
  // EDO 02 l.91 : seuls les héros vivants se désignent.
  designationHeros: {
    heros: reglage('designationHeros', 'heros', (s) => (s.pendingDesignationHeros ? s.party.filter((h) => !h.dead).map((h) => ouverte(h.id, h.label)) : [])),
  },
  // MDG 15 l.268 : une Activité par héros, ou aucune ; fermée pour tous (`seaActivityBlocked`), ou pour ce héros seul
  // (`seaActivityRefus`, LDB 09 l.30). Hors de toute rangée, chaque Activité avec ce qui la ferme pour tous.
  seaActivities: {
    activite: reglage('seaActivities', 'activite', (s, pid) => {
      const hero = pid === undefined ? undefined : herosDeLaSemaine(s, pid);
      if (!s.pendingSeaActivities || (pid !== undefined && !hero)) return [];
      return [ouverte(null, t('valeur.activite.repos')), ...seaActivitiesCatalog().map((def) => ouverte(def.id, def.label, seaActivityBlocked(s, def) ?? (hero && seaActivityRefus(hero, def)) ?? null))];
    }, (s, pid) => choixDuHeros(s, pid)?.activityId ?? null),
    investir: quantite('seaActivities', 'investir', (s, pid) => (herosDeLaSemaine(s, pid) && activiteChoisie(s, pid)?.resolver === 'opportunityTrade' ? plafondDeMiseDOpportunite(s, pid) : null), (s, pid) => choixDuHeros(s, pid)?.investGold ?? 0),
    cacher: quantite('seaActivities', 'cacher', (s, pid) => {
      const hero = herosDeLaSemaine(s, pid);
      return hero && activiteChoisie(s, pid)?.resolver === 'seaChart' ? plafondDePlanque(s, hero) : null;
    }, (s, pid) => choixDuHeros(s, pid)?.stashGold ?? 0),
  },
  // LDB 05 l.793-841, LDB 17 l.81 : chaque case se coche ou se décoche jusqu'à la fin de la séance, par l'hôte.
  finDeSeance: {
    ambitionCourte: caseDuGroupe('ambitionCourte'),
    ambitionLongue: caseDuGroupe('ambitionLongue'),
    ambitionPersonnelleCourte: caseDuHeros('ambitionPersonnelleCourte'),
    ambitionPersonnelleLongue: caseDuHeros('ambitionPersonnelleLongue'),
    motivation: caseDuHeros('motivation'),
  },
} as const satisfies OuvertsDuChoix;

/** Le réglage du choix `axe` de la fenêtre `fenetre` dans l'état `s`, sur le héros `pid` d'un choix de rangée
 *  (`OUVERTS_DU_CHOIX`). */
export const reglageDuChoixDeFenetre = (s: Jeu, fenetre: FenetreAChoix, axe: AxeDuChoix, pid?: IdDeHeros): Reglage =>
  (OUVERTS_DU_CHOIX[fenetre] as Readonly<Record<string, (s: Jeu, pid: IdDeHeros | undefined) => Reglage>>)[axe](s, pid);

/** Un réglage ouvre-t-il une valeur ? */
const ouvreUneValeur = (r: Reglage): boolean => !!r.bornes || !!r.valeurs?.length;

/** Le réglage de la rangée (`pid`) du choix de rangée `axe` de la fenêtre `fenetre` : chaque héros du groupe auquel il
 *  ouvre une valeur. */
const reglageDeLaRangee = (s: Jeu, fenetre: FenetreAChoix, axe: AxeDuChoix): Reglage => ({
  geste: { verbe: VERBE_DE_CHOIX, fenetre, axe },
  parametre: PARAMETRE_DE_RANGEE,
  libelle: libelleDuParametre(VERBE_DE_CHOIX, PARAMETRE_DE_RANGEE),
  courant: null,
  valeurs: s.party.filter((h) => ouvreUneValeur(reglageDuChoixDeFenetre(s, fenetre, axe, h.id))).map((h) => ouverte(h.id, h.label)),
  bornes: null,
  note: null,
});

/** Les réglages des choix que nomment les gestes `gestes` d'une fenêtre (`fenetreChoisir`), hors de toute rangée, et pour
 *  un choix de rangée, celui de sa rangée (`reglageDeLaRangee`). */
export const reglagesDesChoix = (s: Jeu, gestes: readonly GesteDuJeu[]): Reglage[] =>
  gestes.flatMap((g) => {
    if (g.verbe !== VERBE_DE_CHOIX || !g.fenetre || !g.axe) return [];
    const fenetre = g.fenetre as FenetreAChoix;
    const deRangee = declarationDuChoix(fenetre, g.axe)?.portee === 'rangee';
    return [reglageDuChoixDeFenetre(s, fenetre, g.axe), ...(deRangee ? [reglageDeLaRangee(s, fenetre, g.axe)] : [])];
  });

/** La valeur `valeur` est-elle dans les bornes `bornes` d'un réglage ? */
const dansLesBornes = (valeur: unknown, bornes: NonNullable<Reglage['bornes']>): boolean =>
  typeof valeur === 'number' && Number.isInteger(valeur) && valeur >= bornes.min && valeur <= bornes.max;

/** Un choix de la semaine en mer d'un héros de la semaine que l'état n'ouvre plus (MDG 15 l.268) : son Activité fermée
 *  ou hors du catalogue, sa mise ou sa planque hors de ses bornes — l'état a changé depuis le choix (héros remplacé,
 *  bourse, cale). La validation de la semaine reste fermée jusqu'à ce qu'il se reprenne. */
export function semaineAReprendre(s: Jeu): boolean {
  return Object.keys(s.pendingSeaActivities?.picks ?? {}).some((pid) => herosDeLaSemaine(s, pid) && (['activite', 'investir', 'cacher'] as const).some((axe) => {
    const lu = reglageDuChoixDeFenetre(s, 'seaActivities', axe, pid);
    if (lu.bornes) return !dansLesBornes(lu.courant, lu.bornes);
    if (axe !== 'activite') return false;
    const lue = lu.valeurs?.find((v) => v.valeur === lu.courant);
    return !lue || lue.refus !== null;
  }));
}

/** Ce qui refuse le choix venu d'une frontière (JSON d'un hôte, intention d'un siège) : un choix que la fenêtre ne
 *  déclare pas, une fenêtre fermée, une rangée absente d'un choix de rangée, ou posée sur un choix de la fenêtre, le choix
 *  de l'hôte dans l'état d'un invité, le choix du héros d'un autre siège, une valeur que l'état n'ouvre pas ou hors de
 *  ses bornes, ou la raison qui la ferme ; `null` : il se joue. */
export function refusDuChoix(s: Jeu, fenetre: unknown, axe: unknown, valeur: unknown, pid?: unknown): string | null {
  const declaration = declarationDuChoix(fenetre, axe);
  if (!declaration) return t('choix.refus.inconnu');
  if (!garanti(fenetreDuRegistre(fenetre), String(fenetre), 'fenêtre à choix').ouverte(s)) return t('choix.refus.fermee');
  if ((typeof pid === 'string') !== (declaration.portee === 'rangee')) return t('choix.refus.rangee');
  if (declaration.qui === 'hote' && s.net.mode === 'guest') return t('choix.refus.hoteSeul');
  if (declaration.portee === 'rangee' && declaration.qui === 'proprietaire' && !seatOwns(s, decidingSeat(s), pid as IdDeHeros)) return t('choix.refus.autreSiege');
  const lu = reglageDuChoixDeFenetre(s, fenetre as FenetreAChoix, axe as AxeDuChoix, pid as IdDeHeros | undefined);
  if (lu.bornes) return dansLesBornes(valeur, lu.bornes) ? null : t('choix.refus.bornes');
  const lue = lu.valeurs?.find((v) => v.valeur === valeur);
  return lue ? lue.refus : t('choix.refus.valeur');
}

/** Le verbe de choix du noyau sur `get`/`set` : il refuse, et le dit, le choix que `refusDuChoix` refuse, sinon joue le
 *  corps de son axe (`corps`). */
export function creerChoixDeFenetre(get: Get, set: Set, corps: CorpsDesChoix): Pick<ActionsDuNoyau, 'fenetreChoisir'> {
  return {
    fenetreChoisir: (...[fenetre, axe, valeur, pid]) => {
      const refus = refusDuChoix(get(), fenetre, axe, valeur, pid);
      if (refus) { refuserGesteDuSiege(get, set, refus); return; }
      (corps[fenetre] as unknown as Readonly<Record<string, (v: unknown, pid: IdDeHeros | undefined) => void>>)[axe](valeur, pid);
    },
  };
}
