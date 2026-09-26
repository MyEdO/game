/**
 * EMBRIGADEMENT — événement de port n°1 (MDG 15 l.245). Un autre navire enlève 2d10 marins ; on PEUT
 * les récupérer par une SÉQUENCE de Tests influençables : le groupe DÉCIDE d'abord de TENTER la
 * récupération ou de RENONCER (RAW « Vous pouvez les récupérer » — tenter est risqué : un échec coûte
 * 1d10 marins de plus), puis Ragot Intermédiaire (+0), puis — au CHOIX du joueur — rançon de 2d10 CO
 * OU Discrétion Complexe (−10). Un échec sur l'un des deux Tests coûte 1d10 marins de plus (l'autre
 * navire lève l'ancre).
 *
 * La perte de base (2d10) est PERSISTÉE sur `CampaignVessel.crewLost` par `applyVesselCrewLoss`
 * (plafonnée au nominal) AVANT d'ouvrir la séquence ; la récupération rappelle `applyVesselCrewLoss`
 * avec un delta NÉGATIF (premier appelant réel de ce recouvrement, #164). La séquence est une CASCADE
 * (`FLOWS.cascade`, régime des jets de voyage) : le JET de chaque étape est kind-agnostique (Test « +0 »
 * sur `target`, difficulté déjà fondue), la CONSÉQUENCE par `kind` vit dans les appliers ci-dessous.
 *
 * MDG 15 l.245 : « Si vous avez refusé la permission de faire relâche à terre à votre équipage, cet
 * événement n'a pas lieu. » — la relâche à terre n'est pas modélisée (#164) : l'événement se déclenche
 * donc toujours (aucune décision de relâche n'existe pour le désactiver).
 */
import type { Get, Set } from './flowTypes';
import type { BuiltCascadeStep } from './stepBrand';
import { registerCascadeApplier } from './cascade';
import { freeCons, monoStep, choiceStep, openChoice, type BandLigne } from './rollSeam';
import { applyVesselCrewLoss } from './shipCrew';
import { payFromGroup } from './bourseFlow';
import { partyAssisted } from '../engine/skills';
import { toMoney } from '../engine/money';
import { DIFFICULTY_LABELS, type Combatant, type Difficulty } from '../engine/types';
import { refLabel, voyageStakeRef } from '../data';
import { t } from '../i18n';
import { stepDetail } from './rollSeam';

const num = (v: unknown, d = 0): number => (typeof v === 'number' ? v : d);
const diff = (v: unknown, d: Difficulty): Difficulty => (typeof v === 'string' ? (v as Difficulty) : d);

/** Le MENEUR de l'enquête (Ragot soutenu, LDB 12) : il PORTE la décision de tenter — la porte de choix
 *  exige un porteur (`choiceStep`), et c'est ce meneur que la tentative engage. `null` = personne. */
const ragotLead = (get: Get) => partyAssisted(get().party.filter((h: Combatant) => !h.dead), 'ragot');

/** Sans meneur, il n'y a rien à tenter : la voie est close AVANT la décision (elle a seulement une issue). */
const SANS_MENEUR = 'Personne à bord ne peut mener l\'enquête : vos compagnons restent captifs.';

/** Ouvre la séquence de recouvrement d'un Embrigadement (MDG 15 l.245). Applique d'abord la perte de
 *  2d10 marins (persistée, plafonnée), puis — s'il reste des marins RÉELLEMENT enlevés — ouvre la
 *  cascade sur une DÉCISION opt-in (tenter/renoncer) avant tout Test. Dés déjà tirés par l'appelant. */
export function openEmbrigadementRecovery(
  get: Get, set: Set,
  r: { lost: number; ransomCO: number; extraLoss: number; gossipDiff: Difficulty; stealthDiff: Difficulty },
): void {
  const before = get().vessel?.crewLost ?? 0;
  for (const l of applyVesselCrewLoss(get, set, r.lost)) get().log(l);
  const recover = (get().vessel?.crewLost ?? 0) - before; // marins RÉELLEMENT enlevés (perte plafonnée au nominal)
  if (recover <= 0) return; // rien à récupérer
  const lead = ragotLead(get);
  if (!lead) { get().log([SANS_MENEUR]); return; }
  openChoice(get, set, {
    title: 'Embrigadement', icon: 'nav/dice', purpose: 'test',
    id: 'embrig-decision', kind: 'embrigadementDecision', actorId: lead.actor.id,
    label: t('step.embrigDecision', { n: recover }),
    options: [
      { key: 'tenter', label: t('opt.tenterRecuperation'), detail: 'Retrouver leur trace (Ragot) puis les libérer — un Test raté coûte 1d10 membres d\'équipage de plus.' },
      { key: 'renoncer', label: t('opt.renoncer'), detail: 'Accepter la perte sans risquer d\'autres membres d\'équipage.' },
    ],
    meta: { recover, ransomCO: r.ransomCO, extraLoss: r.extraLoss, gossipDiff: r.gossipDiff, stealthDiff: r.stealthDiff },
  });
}

/** Étape-jet Ragot Intermédiaire (MDG 15 l.245) : menée par le plus compétent (+ Soutien) — insérée
 *  quand le groupe choisit de TENTER la récupération. */
function ragotStep(
  // DÉCLARATION du jet : le meneur, sa valeur SOUTENUE et son Soutien — la ligne (base nue, chips,
  // cible ÉCRÊTÉE) et la possession sont posées par le mint.
  lead: { actor: Combatant; ligne: BandLigne },
  recover: number, ransomCO: number, extraLoss: number, gossipDiff: Difficulty, stealthDiff: Difficulty,
): BuiltCascadeStep | undefined {
  return monoStep({
    id: 'embrig-ragot', kind: 'embrigadementRagot', actor: lead.actor,
    icon: 'nav/dice',
    rollLabel: refLabel('skills', { id: 'ragot' }),
    difficulty: gossipDiff,
    stake: voyageStakeRef('embrigadementRagot'),
    ligne: lead.ligne,
    label: stepDetail(t('step.retrouverEquipage'), t('step.ragotDiff', { diff: DIFFICULTY_LABELS[gossipDiff] })),
    meta: { recover, ransomCO, extraLoss, stealthDiff },
  });
}

// Décision opt-in (MDG 15 l.245 « Vous POUVEZ les récupérer ») : TENTER (insère le Ragot, au risque de
// −1d10 marins sur un échec) ou RENONCER (encaisser la perte 2d10 sans risque supplémentaire).
registerCascadeApplier(
  'embrigadementDecision',
  (get, _set, step) => {
    if (step.chosen !== 'tenter') return { consequences: freeCons(['Vous renoncez à récupérer vos compagnons embrigadés.']) };
    // Le meneur est RE-RÉSOLU au moment dû (la décision peut avoir attendu : un mort, un Soutien de plus).
    const lead = ragotLead(get);
    if (!lead) return { consequences: freeCons([SANS_MENEUR]) };
    const st = ragotStep(
      { actor: lead.actor, ligne: { test: { skill: 'ragot' }, valeur: lead.value, soutien: lead.support } },
      num(step.meta?.recover), num(step.meta?.ransomCO), num(step.meta?.extraLoss),
      diff(step.meta?.gossipDiff, 'intermediaire'), diff(step.meta?.stealthDiff, 'complexe'),
    );
    return st ? { insert: [st] } : undefined;
  },
);

/** Étape « choix » : rançon (2d10 CO) OU Discrétion Complexe (−10) — insérée quand le Ragot réussit.
 *  `leadId` = le meneur du Ragot, qui vient de jouer : la libération est la suite de SA tentative, donc
 *  c'est lui qui porte la décision (la porte de choix exige un porteur). */
function liberationChoice(leadId: string, recover: number, ransomCO: number, extraLoss: number, stealthDiff: Difficulty): BuiltCascadeStep | undefined {
  return choiceStep({
    id: 'embrig-choix', kind: 'embrigadementChoix', icon: 'nav/dice', actorId: leadId,
    label: t('step.embrigChoix'),
    options: [
      { key: 'payer', label: t('opt.payerCO', { n: ransomCO }), detail: 'Racheter les marins embrigadés à l\'autre équipage.' },
      { key: 'discretion', label: t('opt.discretionDiff', { diff: DIFFICULTY_LABELS[stealthDiff] }), detail: 'Les libérer en douce (un échec coûte 1d10 marins de plus).' },
    ],
    meta: { recover, ransomCO, extraLoss, stealthDiff },
  });
}

// Ragot Intermédiaire (MDG 15 l.245) : réussite → CHOIX du joueur (insertion) ; échec → 1d10 marins de plus.
registerCascadeApplier(
  'embrigadementRagot',
  (get, set, step) => {
    if (!step.result) return;
    const recover = num(step.meta?.recover);
    const extraLoss = num(step.meta?.extraLoss);
    if (step.result.success) {
      const st = liberationChoice(step.actorId ?? '', recover, num(step.meta?.ransomCO), extraLoss, diff(step.meta?.stealthDiff, 'complexe'));
      return {
        consequences: freeCons(['Vous retrouvez la trace de vos compagnons embrigadés — reste à les libérer.']),
        ...(st ? { insert: [st] } : {}),
      };
    }
    return { consequences: freeCons(applyVesselCrewLoss(get, set, extraLoss)) }; // l'autre navire prend la mer (1d10 de plus)
  },
);

// Choix rançon/Discrétion (MDG 15 l.245) : la rançon LIBÈRE d'office (débit) ; la Discrétion ouvre un Test.
registerCascadeApplier(
  'embrigadementChoix',
  (get, set, step) => {
    const recover = num(step.meta?.recover);
    const extraLoss = num(step.meta?.extraLoss);
    if (step.chosen === 'payer') {
      const ransomCO = num(step.meta?.ransomCO);
      if (!payFromGroup(get, set, toMoney({ gold: ransomCO }), { purpose: 'rançon d\'équipage' }))
        return { consequences: freeCons([`La rançon de ${ransomCO} CO dépasse votre bourse : vos compagnons restent captifs.`]) };
      return { consequences: freeCons([`Rançon payée (${ransomCO} CO).`, ...applyVesselCrewLoss(get, set, -recover)]) };
    }
    // Discrétion : Test Complexe (−10) du plus discret — insertion d'une étape-jet.
    const stealthDiff = diff(step.meta?.stealthDiff, 'complexe');
    const lead = partyAssisted(get().party.filter((h) => !h.dead), 'discretion');
    if (!lead) return { consequences: freeCons(['Personne à bord n\'est assez discret pour tenter la libération.']) };
    const st = monoStep({
      id: 'embrig-discretion', kind: 'embrigadementDiscretion', actor: lead.actor,
      icon: 'nav/dice',
      rollLabel: refLabel('skills', { id: 'discretion' }),
      difficulty: stealthDiff,
      stake: voyageStakeRef('embrigadementDiscretion'),
      ligne: { test: { skill: 'discretion' }, valeur: lead.value, soutien: lead.support },
      label: stepDetail(t('step.libererEnDouce'), t('step.discretionDiff', { diff: DIFFICULTY_LABELS[stealthDiff] })),
      meta: { recover, extraLoss },
    });
    return st ? { insert: [st] } : undefined;
  },
);

// Discrétion Complexe (MDG 15 l.245) : réussite → marins récupérés ; échec → 1d10 marins de plus.
registerCascadeApplier(
  'embrigadementDiscretion',
  (get, set, step) => {
    if (!step.result) return;
    const recover = num(step.meta?.recover);
    if (step.result.success) return { consequences: freeCons(['Vos compagnons sont libérés dans l\'ombre.', ...applyVesselCrewLoss(get, set, -recover)]) };
    return { consequences: freeCons(applyVesselCrewLoss(get, set, num(step.meta?.extraLoss))) }; // repéré : le navire lève l'ancre (1d10 de plus)
  },
);
