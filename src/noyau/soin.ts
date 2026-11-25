/**
 * LE SOIN DÉCLARÉ (`pendingHeal`) : le soigneur, le Test qu'il jette et les Bandages qu'il engage (LDB 09 l.255-261 ;
 * LDB 74 l.41 ; LDB 12), lus à l'identique par l'ouverture, les réglages `soins.soigneur`/`soins.test`/`soins.bandages`, le résolveur
 * (`FLOWS.soins`, `jetValider('soins')`), l'annonce (`describeHeal`) et la fenêtre (`fenetreDuSoin`). PUR.
 */
import type { Combatant } from '../engine/types';
import type { SupportDetail } from '../engine/skills';
import { peutTenter, testValue } from '../engine/skills';
import {
  actePanse, difficulteDuSoin, HEAL_MODES, HEAL_SKILL, IDS_DU_TEST_DE_SOIN, porteDesBandages, raisonDeModeDeSoinEnCombat, refusDuTestDeSoin, TESTS_DE_SOIN,
  type HealMode, type ParametresDeSoin, type TestDeSoin,
} from '../engine/healing';
import { t } from '../i18n';
import type { Jeu } from './etat';
import type { PendingHeal } from './pendings';
import type { IdDeHeros } from './designations';
import { gesteDuReglage, type ChoixNomme } from './reglages';
import { rollLine, type RollLineParts } from './ligneDeJet';
import { actorIn } from './monde/combatants';
import { libelleDeTest } from './jetsEnVue';
import { libelleDuReglage } from './libelles';
import { garanti } from '../lib/garanti';
import { refusDeLActeALInfirmerie } from './acteDeSoin';
import { nomDe, nomOuAbsence } from '../engine/nom';

/** Les paramètres déclarés du soin `ph`, que l'annonce et le résolveur lisent tous deux. */
export const parametresDuSoin = (ph: Pick<PendingHeal, 'test' | 'bandagesDe'>): ParametresDeSoin => ({ test: ph.test, bandages: ph.bandagesDe != null });

/** Valeur, Difficulté et ligne du Test de soin `test` d'un soigneur combattant ; Guérison : Soutien `support` fondu
 *  (LDB 12). Lu par l'ouverture en combat et par les réglages `soins.test`/`soins.mode`. */
export function jetDuSoigneur(soigneur: Combatant, test: TestDeSoin, mode: HealMode, support?: SupportDetail): { skillValue: number; difficulty: PendingHeal['difficulty']; ligne: RollLineParts } {
  const ids = IDS_DU_TEST_DE_SOIN[test];
  const soutien = test === 'guerison' ? support : undefined;
  const skillValue = testValue(soigneur, ids) + (soutien?.bonus ?? 0);
  const difficulty = difficulteDuSoin(test, mode);
  return { skillValue, difficulty, ligne: rollLine({ actor: soigneur, test: ids, difficulty, valeur: skillValue, soutien }) };
}

/** Pourquoi le héros `porteurId` ne peut engager ses Bandages dans le soin en cours (`porteurId` `null` : les retirer),
 *  `null` s'il le peut. La propriété (seul le siège du porteur déclare) est jugée par la route du réglage `soins.bandages`
 *  (`netOwnership`). VERDICT UNIQUE du geste et de la fenêtre. */
export function refusDesBandages(s: Pick<Jeu, 'pendingHeal' | 'battle' | 'party'>, porteurId: string | null): string | null {
  const ph = garanti(s.pendingHeal, porteurId ?? undefined, 'soin des Bandages');
  if (ph.roll != null) return t('heal.bandagesApresJet');
  if (porteurId == null) return ph.test === 'dexterite' ? t('heal.bandagesConditionDeLaDexterite') : null;
  if (!actePanse(ph.mode)) return t('heal.bandagesSansEffet');
  const porteur = actorIn(s as Jeu, porteurId);
  return porteur && porteDesBandages(porteur) ? null : t('heal.bandagesAbsents', { name: nomOuAbsence(porteur, 'combattant', porteurId) });
}

/** Le patient du soin en cours. */
const patientDuSoin = (s: Pick<Jeu, 'battle' | 'party'>, ph: PendingHeal): Combatant => garanti(actorIn(s as Jeu, ph.targetId), ph.targetId, 'patient du soin');

/** Pourquoi le Test `test` est refusé au soin en cours, `null` s'il s'offre. VERDICT UNIQUE du réglage `soins.test` et de la fenêtre. */
export function refusDuTestDuSoin(s: Pick<Jeu, 'pendingHeal' | 'battle' | 'party'>, test: TestDeSoin): string | null {
  const ph = garanti(s.pendingHeal, test, 'soin du Test');
  if (ph.roll != null) return t('heal.testJetFait');
  return refusDuTestDeSoin(actorIn(s as Jeu, ph.healerId) ?? null, ph.mode, { test, bandages: ph.bandagesDe != null }, patientDuSoin(s, ph));
}

/** Pourquoi le héros `soigneurId` ne peut pas prendre le soin en cours, `null` s'il le peut : seuls les héros soignent
 *  à l'infirmerie, avant le jet, hors d'une opération armée (son chirurgien est figé) ; et il doit pouvoir tenter l'acte
 *  (`refusDeLActeALInfirmerie`). VERDICT UNIQUE du réglage `soins.soigneur` et de la fenêtre. */
export function refusDuSoigneur(s: Pick<Jeu, 'pendingHeal' | 'pendingSurgery' | 'medic' | 'battle' | 'party'>, soigneurId: IdDeHeros): string | null {
  const ph = garanti(s.pendingHeal, soigneurId, 'soin du soigneur');
  if (ph.roll != null) return t('heal.testJetFait');
  if (s.battle || !s.medic) return t('heal.soigneurEnCombat');
  if (s.medic.npc) return t('medic.soigneurPnj', { pnj: s.medic.npc.label });
  if (s.medic.surgery) return t('medic.operationEnCours');
  return refusDeLActeALInfirmerie({ ...s, medic: { ...s.medic, soigneurId } }, ph.mode);
}

/** Pourquoi l'acte `mode` est refusé au soin en cours, `null` s'il s'offre : en combat, le patient
 *  (`raisonDeModeDeSoinEnCombat`) puis le Test déclaré (`refusDuTestDeSoin`) ; hors combat, l'infirmerie
 *  (`refusDeLActeALInfirmerie`). VERDICT UNIQUE du réglage `soins.mode`, de son lancer et de la fenêtre. */
export function refusDuModeDuSoin(s: Pick<Jeu, 'pendingHeal' | 'pendingSurgery' | 'medic' | 'battle' | 'party'>, mode: HealMode): string | null {
  const ph = garanti(s.pendingHeal, mode, 'soin de l’acte');
  if (ph.roll != null) return t('heal.testJetFait');
  if (!s.battle) return refusDeLActeALInfirmerie(s, mode);
  const patient = patientDuSoin(s, ph);
  return raisonDeModeDeSoinEnCombat(patient, mode) ?? refusDuTestDeSoin(actorIn(s as Jeu, ph.healerId) ?? null, mode, parametresDuSoin(ph), patient);
}

/** La fenêtre du soin en données : le patient, le soigneur, l'acte, le Test et les Bandages engagés (réglages
 *  `soins.soigneur`, `soins.mode`, `soins.test`, `soins.bandages`), chaque option avec sa raison de refus ; `null` sans
 *  soin en attente. Les soigneurs offerts : à l'infirmerie sans PNJ, les héros qui peuvent tenter la Guérison ; les
 *  porteurs offerts : les héros présents qui portent des Bandages. PUR. */
export function fenetreDuSoin(s: Jeu): { patientId: string; soigneur: ChoixNomme<IdDeHeros> | null; mode: ChoixNomme<HealMode>; test: ChoixNomme<TestDeSoin>; bandages: ChoixNomme<string> | null } | null {
  const ph = s.pendingHeal;
  if (!ph) return null;
  const pool = (s.battle?.combatants ?? s.party).filter((c) => c.kind === 'heros');
  const porteurs = pool.filter((c) => porteDesBandages(c) || c.id === ph.bandagesDe);
  const soigneurs = s.battle || !s.medic || s.medic.npc ? [] : s.party.filter((h) => peutTenter(h, { skill: { id: HEAL_SKILL } }));
  return {
    patientId: ph.targetId,
    soigneur: soigneurs.length ? {
      geste: gesteDuReglage('soins', 'soigneur'), libelle: libelleDuReglage('soins', 'soigneur'), choisie: ph.healerId,
      options: soigneurs.map((h) => ({ valeur: h.id, libelle: nomDe(h), refus: h.id === ph.healerId ? null : refusDuSoigneur(s, h.id) })),
    } : null,
    mode: {
      geste: gesteDuReglage('soins', 'mode'), libelle: libelleDuReglage('soins', 'mode'), choisie: ph.mode,
      options: HEAL_MODES.map((mode) => ({ valeur: mode, libelle: t(`valeur.${mode}`), refus: refusDuModeDuSoin(s, mode) })),
    },
    test: {
      geste: gesteDuReglage('soins', 'test'), libelle: libelleDuReglage('soins', 'test'), choisie: ph.test,
      options: TESTS_DE_SOIN.map((test) => ({ valeur: test, libelle: libelleDeTest(test), refus: test === ph.test ? null : refusDuTestDuSoin(s, test) })),
    },
    bandages: actePanse(ph.mode) && porteurs.length ? {
      geste: gesteDuReglage('soins', 'bandages'), libelle: libelleDuReglage('soins', 'bandages'), choisie: ph.bandagesDe,
      options: [
        { valeur: null, libelle: t('heal.sansBandages'), refus: ph.bandagesDe == null ? null : refusDesBandages(s, null) },
        ...porteurs.map((c) => ({ valeur: c.id, libelle: t('heal.bandagesDe', { name: nomDe(c) }), refus: c.id === ph.bandagesDe ? null : refusDesBandages(s, c.id) })),
      ],
    } : null,
  };
}
