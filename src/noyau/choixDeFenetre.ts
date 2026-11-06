/**
 * LE CHOIX D'UNE FENÊTRE (#3369) : un seul verbe, `fenetreChoisir(fenetre, axe, valeur)`, la fenêtre en argument. Chaque
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
import { libelleDeLaFermeture, libelleDuChoix, libelleDuLitteral } from './libelles';
import { fenetreDuRegistre, surfaceTientLaMain, type GesteDuJeu } from './modalArbiter';
import { plaiesNommees } from './medicFlow';
import { reponsesDuNoeud } from './dialogue';
import { refuserGesteDuSiege } from './refusVisible';
import type { Reglage, ValeurDuReglage } from './reglages';
import { refusDeChoixDePaie } from './shipCrew';
import { refusDePayerManann } from './seaVoyageFlow';
import { corruptionTarget } from './corruptionFlow';
import {
  VERBE_DE_CHOIX, declarationDuChoix, type AxeDe, type AxeDuChoix, type CorpsDesChoix, type FenetreAChoix, type OuvertsDuChoix,
} from './choixDesFenetres';

/** Le réglage de l'axe `axe` de la fenêtre `fenetre` : ses valeurs `valeurs`, chacune avec la raison qui la ferme, et
 *  sa valeur `courant`. */
const reglage = <F extends FenetreAChoix>(fenetre: F, axe: AxeDe<F>, valeurs: (s: Jeu) => readonly ValeurDuReglage[], courant: (s: Jeu) => ValeurDuReglage['valeur'] = () => null) => (s: Jeu): Reglage => ({
  geste: { verbe: VERBE_DE_CHOIX, fenetre, axe: axe as AxeDuChoix },
  libelle: libelleDuChoix(fenetre, axe),
  courant: courant(s),
  valeurs: [...valeurs(s)],
  bornes: null,
  note: null,
});

/** Une valeur ouverte, nommée `libelle`, que ferme `refus` (`null` : ouverte). */
const ouverte = (valeur: ValeurDuReglage['valeur'], libelle: string, refus: string | null = null): ValeurDuReglage => ({ valeur, libelle, refus });
/** Oui, puis non, tant que `ouvert` ; chacune fermée par la raison de `refus`. */
const ouiNon = (ouvert: (s: Jeu) => boolean, refus: (s: Jeu, v: boolean) => string | null = () => null) => (s: Jeu): ValeurDuReglage[] =>
  (ouvert(s) ? [true, false].map((v) => ouverte(v, garanti(libelleDuLitteral(v), String(v), 'libellé du booléen'), refus(s, v))) : []);

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
} as const satisfies OuvertsDuChoix;

/** Le réglage du choix `axe` de la fenêtre `fenetre` dans l'état `s` (`OUVERTS_DU_CHOIX`). */
export const reglageDuChoixDeFenetre = (s: Jeu, fenetre: FenetreAChoix, axe: AxeDuChoix): Reglage =>
  (OUVERTS_DU_CHOIX[fenetre] as Readonly<Record<string, (s: Jeu) => Reglage>>)[axe](s);

/** Les réglages des choix que nomment les gestes `gestes` d'une fenêtre (`fenetreChoisir`). */
export const reglagesDesChoix = (s: Jeu, gestes: readonly GesteDuJeu[]): Reglage[] =>
  gestes.flatMap((g) => (g.verbe === VERBE_DE_CHOIX && g.fenetre && g.axe ? [reglageDuChoixDeFenetre(s, g.fenetre as FenetreAChoix, g.axe)] : []));

/** Ce qui refuse le choix venu d'une frontière (JSON d'un hôte, intention d'un siège) : un choix que la fenêtre ne
 *  déclare pas, une fenêtre fermée, le choix de l'hôte dans l'état d'un invité, une valeur que l'état n'ouvre pas, ou la
 *  raison qui la ferme ; `null` : il se joue. */
export function refusDuChoix(s: Jeu, fenetre: unknown, axe: unknown, valeur: unknown): string | null {
  const declaration = declarationDuChoix(fenetre, axe);
  if (!declaration) return t('choix.refus.inconnu');
  if (!garanti(fenetreDuRegistre(fenetre), String(fenetre), 'fenêtre à choix').ouverte(s)) return t('choix.refus.fermee');
  if (declaration.qui === 'hote' && s.net.mode === 'guest') return t('choix.refus.hoteSeul');
  const lue = reglageDuChoixDeFenetre(s, fenetre as FenetreAChoix, axe as AxeDuChoix).valeurs?.find((v) => v.valeur === valeur);
  return lue ? lue.refus : t('choix.refus.valeur');
}

/** Le verbe de choix du noyau sur `get`/`set` : il refuse, et le dit, le choix que `refusDuChoix` refuse, sinon joue le
 *  corps de son axe (`corps`). */
export function creerChoixDeFenetre(get: Get, set: Set, corps: CorpsDesChoix): Pick<ActionsDuNoyau, 'fenetreChoisir'> {
  return {
    fenetreChoisir: (...[fenetre, axe, valeur]) => {
      const refus = refusDuChoix(get(), fenetre, axe, valeur);
      if (refus) { refuserGesteDuSiege(get, set, refus); return; }
      (corps[fenetre] as unknown as Readonly<Record<string, (v: unknown) => void>>)[axe](valeur);
    },
  };
}
