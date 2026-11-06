/**
 * LE SOIN DÉCLARÉ (`pendingHeal`) : le Test que le soigneur jette et les Bandages qu'il engage (LDB 09 l.255-261 ;
 * LDB 74 l.41), lus à l'identique par l'ouverture, les réglages `heal.test`/`heal.bandages`, le résolveur
 * (`FLOWS.heal`, `jetConfirm('heal')`), l'annonce (`describeHeal`, `enjeuDuSoin`) et la fenêtre (`fenetreDuSoin`). PUR.
 */
import type { Combatant } from '../engine/types';
import type { SupportDetail } from '../engine/skills';
import { testValue } from '../engine/skills';
import {
  actePanse, difficulteDuSoin, IDS_DU_TEST_DE_SOIN, porteDesBandages, refusDuTestDeSoin, TESTS_DE_SOIN,
  type HealMode, type ParametresDeSoin, type TestDeSoin,
} from '../engine/healing';
import type { FlowStakeId } from '../data';
import { t } from '../i18n';
import type { Jeu } from './etat';
import type { PendingHeal } from './pendings';
import { gesteDuReglage, type ChoixNomme } from './reglages';
import { rollLine, type RollLineParts } from './rollSeam';
import { actorIn } from './monde/combatants';
import { libelleDeTest } from './jetsEnVue';
import { libelleDuReglage } from './libelles';
import { garanti } from '../lib/garanti';

/** Les paramètres déclarés du soin `ph`, que l'annonce et le résolveur lisent tous deux. */
export const parametresDuSoin = (ph: Pick<PendingHeal, 'test' | 'bandagesDe'>): ParametresDeSoin => ({ test: ph.test, bandages: ph.bandagesDe != null });

/** Valeur, Difficulté et ligne du Test de soin `test` d'un soigneur combattant ; Guérison : Soutien `support` fondu
 *  (LDB 12). Lu par l'ouverture en combat et par les réglages `heal.test`/`heal.mode`. */
export function jetDuSoigneur(soigneur: Combatant, test: TestDeSoin, mode: HealMode, support?: SupportDetail): { skillValue: number; difficulty: PendingHeal['difficulty']; ligne: RollLineParts } {
  const ids = IDS_DU_TEST_DE_SOIN[test];
  const soutien = test === 'guerison' ? support : undefined;
  const skillValue = testValue(soigneur, ids.skill, ids.char) + (soutien?.bonus ?? 0);
  const difficulty = difficulteDuSoin(test, mode);
  return { skillValue, difficulty, ligne: rollLine({ actor: soigneur, test: ids, difficulty, valeur: skillValue, soutien }) };
}

/** Pourquoi le héros `porteurId` ne peut engager ses Bandages dans le soin en cours (`porteurId` `null` : les retirer),
 *  `null` s'il le peut. La propriété (seul le siège du porteur déclare) est jugée par la route du réglage `heal.bandages`
 *  (`netOwnership`). VERDICT UNIQUE du geste et de la fenêtre. */
export function refusDesBandages(s: Pick<Jeu, 'pendingHeal' | 'battle' | 'party'>, porteurId: string | null): string | null {
  const ph = garanti(s.pendingHeal, porteurId ?? undefined, 'soin des Bandages');
  if (ph.roll != null) return t('heal.bandagesApresJet');
  if (porteurId == null) return ph.test === 'dexterite' ? t('heal.bandagesConditionDeLaDexterite') : null;
  if (!actePanse(ph.mode)) return t('heal.bandagesSansEffet');
  const porteur = actorIn(s as Jeu, porteurId);
  return porteur && porteDesBandages(porteur) ? null : t('heal.bandagesAbsents', { name: porteur?.label ?? porteurId });
}

/** Pourquoi le Test `test` est refusé au soin en cours, `null` s'il s'offre. VERDICT UNIQUE du réglage `heal.test` et de la fenêtre. */
export function refusDuTestDuSoin(s: Pick<Jeu, 'pendingHeal' | 'battle' | 'party'>, test: TestDeSoin): string | null {
  const ph = garanti(s.pendingHeal, test, 'soin du Test');
  if (ph.roll != null) return t('heal.testJetFait');
  return refusDuTestDeSoin(actorIn(s as Jeu, ph.healerId) ?? null, ph.mode, { test, bandages: ph.bandagesDe != null });
}

/** L'enjeu annoncé du soin `ph` : celui de son acte, décliné par Test et Bandages pour l'Hémorragie et les Blessures. */
export function enjeuDuSoin(ph: Pick<PendingHeal, 'mode' | 'test' | 'bandagesDe'>): FlowStakeId {
  if (ph.mode === 'bleed') return ph.test === 'dexterite' ? 'heal-bleed-dexterite' : ph.bandagesDe ? 'heal-bleed-bandages' : 'heal-bleed';
  if (ph.mode === 'wounds') return ph.bandagesDe ? 'heal-wounds-bandages' : 'heal-wounds';
  return ph.mode === 'trauma' ? 'heal-trauma' : 'heal-ammo';
}

/** La fenêtre du soin en données : le Test et les Bandages engagés (réglages `heal.test`, `heal.bandages`), chaque option
 *  avec sa raison de refus ; `null` sans soin en attente. Les porteurs offerts : les héros présents qui portent des
 *  Bandages. PUR. */
export function fenetreDuSoin(s: Jeu): { test: ChoixNomme<TestDeSoin>; bandages: ChoixNomme<string> | null } | null {
  const ph = s.pendingHeal;
  if (!ph) return null;
  const pool = (s.battle?.combatants ?? s.party).filter((c) => c.kind === 'hero');
  const porteurs = pool.filter((c) => porteDesBandages(c) || c.id === ph.bandagesDe);
  return {
    test: {
      geste: gesteDuReglage('heal', 'test'), libelle: libelleDuReglage('heal', 'test'), choisie: ph.test,
      options: TESTS_DE_SOIN.map((test) => ({ valeur: test, libelle: libelleDeTest(test), refus: test === ph.test ? null : refusDuTestDuSoin(s, test) })),
    },
    bandages: actePanse(ph.mode) && porteurs.length ? {
      geste: gesteDuReglage('heal', 'bandages'), libelle: libelleDuReglage('heal', 'bandages'), choisie: ph.bandagesDe,
      options: [
        { valeur: null, libelle: t('heal.sansBandages'), refus: ph.bandagesDe == null ? null : refusDesBandages(s, null) },
        ...porteurs.map((c) => ({ valeur: c.id, libelle: t('heal.bandagesDe', { name: c.label }), refus: c.id === ph.bandagesDe ? null : refusDesBandages(s, c.id) })),
      ],
    } : null,
  };
}
