/**
 * LA DÉTERMINATION DANS UN JET (LDB 17 l.59) : l'immunité à la Psychologie que pose `depenserLaDetermination` frappe le
 * jet de son porteur encore ouvert — le malus psychologique du Test de scène (`PendingTest.psychMod`), sa rangée de
 * la bande de Psychologie (`BatchParticipant.immune`, `jetImmunise`). Ce module dit ce jet, le refus de l'immunité
 * qu'il fonde, et l'offre du verbe dans la fenêtre du jet (`fenetreDeDetermination`, lecteur PUR comme `fenetreDuButin`,
 * `reglages.ts`).
 */
import type { Jeu } from './etat';
import type { Combatant } from '../engine/types';
import type { OptionDeDetermination } from './combatSlice';
import type { ChoixNomme } from './reglages';
import type { IdDeCombattant } from './designations';
import { fenetreDuJeu, VERBES_DU_JET_PSY } from './combatAuto';
import { bandeCourante } from './rollFlowSpecs';
import { actorIn } from './monde/combatants';
import { refusDeDetermination } from '../engine/conditions';
import { libelleDeLaFermeture, libelleDuLitteral, libelleDuParametre } from './libelles';
import { garanti } from '../lib/garanti';
import { nomEnVue } from './visionDuGroupe';
import { t } from '../i18n';

const [DEPENSER] = VERBES_DU_JET_PSY;
const IMMUNITE = 'immuniserALaPsychologie' satisfies OptionDeDetermination;

/** Le jet du combattant `id` que joue l'étape ouverte — le Test de scène qu'il tient, sa rangée de la bande courante —,
 *  s'il est de Psychologie, et s'il est lancé ; `null` : aucun. */
function jetDuPorteur(s: Jeu, id: IdDeCombattant): { psy: boolean; lance: boolean } | null {
  const test = s.pendingTest;
  if (test?.actorId === id) return { psy: !!test.psychMod, lance: test.roll != null };
  const bande = bandeCourante(s);
  const rangee = bande?.participants?.find((p) => p.id === id);
  return bande && rangee ? { psy: !!(bande.psychologieDeCombat || bande.psychologieDeRencontre), lance: !!rangee.result } : null;
}

/** Le refus de l'immunité à la Psychologie de `porteur` (LDB 17 l.59) : pendant son jet, contre la Psychologie de ce
 *  jet et avant lui ; sa réserve (`refusDeDetermination`) ; hors de tout jet, hors combat, où les Rounds ne courent
 *  pas. `undefined` : ouverte. */
export function refusDImmunite(s: Jeu, porteur: Combatant): string | undefined {
  const jet = jetDuPorteur(s, porteur.id);
  if (jet?.lance) return libelleDeLaFermeture('jetLance');
  if (jet && !jet.psy) return t('cs.determinationSansMalusPsy');
  return refusDeDetermination(porteur) ?? (jet || s.battle ? undefined : t('cs.determinationHorsCombat'));
}

/** L'offre de la Détermination dans la fenêtre d'un jet où la Psychologie se joue : le porteur, chacun fermé par son
 *  refus (`refusDImmunite`), l'immunité pour seule option, sans État. */
export interface FenetreDeDetermination {
  porteur: ChoixNomme<IdDeCombattant>;
  option: ChoixNomme<OptionDeDetermination>;
  etat: ChoixNomme;
}

const libelle = (parametre: string): string => garanti(libelleDuParametre(DEPENSER, parametre), parametre, 'libellé de la dépense de Détermination');

/** La fenêtre de la Détermination quand l'étape d'un Test de scène ou d'une bande tient la main : ses porteurs sont le
 *  testeur, chaque rangée de la bande ; `null` hors d'elles. PUR. */
export function fenetreDeDetermination(s: Jeu): FenetreDeDetermination | null {
  const etape = fenetreDuJeu(s)?.etape;
  if (!etape) return null;
  const ids = etape.jet === 'test' ? [s.pendingTest?.actorId] : bandeCourante(s) === etape ? (etape.participants ?? []).filter((p) => p.interactive !== false).map((p) => p.id) : null;
  if (!ids) return null;
  const options = ids.flatMap((id) => {
    const c = id ? actorIn(s, id) : undefined;
    return c ? [{ valeur: c.id, libelle: garanti(nomEnVue(s, c.id), c.id, 'porteur de la Détermination'), refus: refusDImmunite(s, c) ?? null }] : [];
  });
  return {
    porteur: { geste: { verbe: DEPENSER }, parametre: 'combattantId', libelle: libelle('combattantId'), choisie: null, options },
    option: { geste: { verbe: DEPENSER }, parametre: 'option', libelle: libelle('option'), choisie: IMMUNITE, options: [{ valeur: IMMUNITE, libelle: garanti(libelleDuLitteral(IMMUNITE, 'option'), IMMUNITE, 'libellé de l’immunité') }] },
    etat: { geste: { verbe: DEPENSER }, parametre: 'etat', libelle: libelle('etat'), choisie: null, options: [{ valeur: null, libelle: t('valeur.aucun') }] },
  };
}
