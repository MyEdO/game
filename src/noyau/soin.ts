/**
 * LE SOIN DÉCLARÉ (`pendingHeal`) : le Test que le soigneur jette et les Bandages qu'il engage (LDB 09 l.255-261 ;
 * LDB 74 l.41), lus à l'identique par l'ouverture, les réglages `soins.test`/`soins.bandages`, le résolveur
 * (`FLOWS.soins`, `jetValider('soins')`), l'annonce (`describeHeal`, `enjeuDuSoin`) et la fenêtre (`fenetreDuSoin`). PUR.
 */
import type { Combatant } from '../engine/types';
import type { SupportDetail } from '../engine/skills';
import { testValue } from '../engine/skills';
import {
  actePanse, difficulteDuSoin, HEAL_MODES, IDS_DU_TEST_DE_SOIN, porteDesBandages, raisonDeModeDeSoinEnCombat, refusDuTestDeSoin, TESTS_DE_SOIN,
  type HealMode, type ParametresDeSoin, type TestDeSoin,
} from '../engine/healing';
import { flowStakeRef, type StakeRef } from '../data';
import { t } from '../i18n';
import type { Jeu } from './etat';
import type { PendingHeal } from './pendings';
import { gesteDuReglage, type ChoixNomme } from './reglages';
import { rollLine, type RollLineParts } from './ligneDeJet';
import { actorIn } from './monde/combatants';
import { libelleDeTest } from './jetsEnVue';
import { libelleDuReglage } from './libelles';
import { garanti } from '../lib/garanti';
import { cibleDeLOperation, estOperation, HEAL_STAKE, refusDeLActeALInfirmerie } from './acteDeSoin';
import { nomDe } from '../engine/nom';

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
  return porteur && porteDesBandages(porteur) ? null : t('heal.bandagesAbsents', { name: porteur?.label ?? porteurId });
}

/** Pourquoi le Test `test` est refusé au soin en cours, `null` s'il s'offre. VERDICT UNIQUE du réglage `soins.test` et de la fenêtre. */
export function refusDuTestDuSoin(s: Pick<Jeu, 'pendingHeal' | 'battle' | 'party'>, test: TestDeSoin): string | null {
  const ph = garanti(s.pendingHeal, test, 'soin du Test');
  if (ph.roll != null) return t('heal.testJetFait');
  return refusDuTestDeSoin(actorIn(s as Jeu, ph.healerId) ?? null, ph.mode, { test, bandages: ph.bandagesDe != null });
}

/** Pourquoi l'acte `mode` est refusé au soin en cours, `null` s'il s'offre : en combat, le patient
 *  (`raisonDeModeDeSoinEnCombat`) puis le Test déclaré (`refusDuTestDeSoin`) ; hors combat, l'infirmerie
 *  (`refusDeLActeALInfirmerie`). VERDICT UNIQUE du réglage `soins.mode`, de son lancer et de la fenêtre. */
export function refusDuModeDuSoin(s: Pick<Jeu, 'pendingHeal' | 'pendingSurgery' | 'medic' | 'battle' | 'party'>, mode: HealMode): string | null {
  const ph = garanti(s.pendingHeal, mode, 'soin de l’acte');
  if (ph.roll != null) return t('heal.testJetFait');
  if (!s.battle) return refusDeLActeALInfirmerie(s, mode);
  const patient = garanti(actorIn(s as Jeu, ph.targetId), ph.targetId, 'patient du soin');
  return raisonDeModeDeSoinEnCombat(patient, mode) ?? refusDuTestDeSoin(actorIn(s as Jeu, ph.healerId) ?? null, mode, parametresDuSoin(ph));
}

/** L'enjeu annoncé du soin `ph` : celui de son acte, décliné par Test et Bandages pour l'Hémorragie et les Blessures ;
 *  le brouillon d'une opération, celui de l'opération qu'il arme, à sa cible de DR (`cibleDeLOperation`). */
export function enjeuDuSoin(s: Pick<Jeu, 'party'>, ph: Pick<PendingHeal, 'mode' | 'test' | 'bandagesDe' | 'targetId' | 'plaie'>): StakeRef {
  if (estOperation(ph.mode)) return flowStakeRef(HEAL_STAKE[ph.mode], { values: { drCible: cibleDeLOperation(s, ph, ph.mode) } });
  if (ph.mode === 'hemorragie') return flowStakeRef(ph.test === 'dexterite' ? 'soin-hemorragie-dexterite' : ph.bandagesDe ? 'soin-hemorragie-bandages' : 'soin-hemorragie');
  if (ph.mode === 'blessures') return flowStakeRef(ph.bandagesDe ? 'soin-blessures-bandages' : 'soin-blessures');
  return flowStakeRef(HEAL_STAKE[ph.mode]);
}

/** La fenêtre du soin en données : le patient, l'acte, le Test et les Bandages engagés (réglages
 *  `soins.mode`, `soins.test`, `soins.bandages`), chaque option avec sa raison de refus ; `null` sans soin en attente. Les
 *  porteurs offerts : les héros présents qui portent des Bandages. PUR. */
export function fenetreDuSoin(s: Jeu): { patientId: string; mode: ChoixNomme<HealMode>; test: ChoixNomme<TestDeSoin>; bandages: ChoixNomme<string> | null } | null {
  const ph = s.pendingHeal;
  if (!ph) return null;
  const pool = (s.battle?.combatants ?? s.party).filter((c) => c.kind === 'heros');
  const porteurs = pool.filter((c) => porteDesBandages(c) || c.id === ph.bandagesDe);
  return {
    patientId: ph.targetId,
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
