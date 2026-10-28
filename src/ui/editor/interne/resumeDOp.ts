/**
 * Résumeur d'ATELIER des ops mécaniques (`opSummary`) et de leurs `Formula` (`formulaSummary`),
 * réservé à `src/ui/editor/` (#495, #2724).
 */
import type { GameOp } from '../../../engine/ops';
import type { JsonFormula } from '../../../engine/miscast';
import type { DatasetKey } from '../../../data/overrides';
import { charAbr, conditionLabel, findCrewTestTypeById, psychologyLabel, qualityRefLabel, refLabel } from '../../../data';
import { ciblePsyLue, libelleDeCible } from '../../../engine/psych/ciblage';
import { traitOctroye } from '../../../engine/psych/opsPsy';
import { findFallTable } from '../../../data/shipCriticals';
import { libelleDeValeur } from '../../../data/schemas/grammaire/meta';
import { chaosAlignSchema, deDeTableSchema, exposureLevelSchema } from '../../../data/schemas/grammaire/valeurs';
import { zoneShapeSchema } from '../../../data/schemas/grammaire/mecanique';
import { CHAR_LABELS } from '../../../engine/types';
import { giveTrappingLabel } from '../../../engine/items';
import { formatTrait, formatWardSave } from '../../../engine/traits/dispatch';
import { traumaLabelOf } from '../../../engine/trauma';
import { ruleDef } from '../../../engine/policy';
import { terrainLabel } from '../../../noyau/monde/terrain';
import { dureePropre, plancher, traitOctroyeLisible } from '../../compendium/humanize';
import { coupeAuMot } from '../../../lib/coupeAuMot.mjs';
import { opMissingRefs } from '../refsDOp';
import { libelleDeLaNature } from './libelleDeLaNature';

/** Résumé court d'une Formula (lecture sans perte dans les résumés d'op). */
export function formulaSummary(f: JsonFormula | undefined): string {
  if (f == null) return '0';
  if (typeof f === 'number') return String(f);
  if ('bonusOf' in f) return `B${charAbr(f.bonusOf)}`;
  if ('charOf' in f) return charAbr(f.charOf);
  if ('rolled' in f) return 'dé';
  if ('indiceOf' in f) return 'Indice';
  if ('stacks' in f) return 'pions';
  if ('engagedAdvantageGap' in f) return 'écart d’Avantage';
  if ('woundsDealt' in f) return 'PB infligés';
  if ('sl' in f) return 'DR';
  if ('sinPoints' in f) return 'Points de Péché';
  if ('rule' in f) return ruleDef(f.rule)?.label ?? f.rule;
  if ('minimum' in f) return `${formulaSummary(f.of)} (min ${f.minimum})`;
  if ('sum' in f) return f.sum.map(formulaSummary).join(' + ');
  if ('times' in f) return `${formulaSummary(f.times.of)} × ${formulaSummary(f.times.factor)}`;
  if ('dice' in f) return `${f.dice.n}d${f.dice.sides}${f.dice.plus ? `+${f.dice.plus}` : ''}`;
  throw new Error(`formulaSummary : terme de Formula hors grammaire (${JSON.stringify(f)})`);
}

/** Libellé d'une réf PRÉSENTE dans une op : id vide = choix non fait, jamais un libellé vide. Le sens
 *  d'une réf ABSENTE appartient à l'op, testé par l'appelant. Précédent : `fall`, « — table à choisir — ». */
function refOuChoix(category: DatasetKey, ref: { id: string; spec?: string }, quoi: string): string {
  return ref.id ? refLabel(category, ref) : `— ${quoi} à choisir —`;
}

export function opSummary(o: GameOp): string {
  // Une op dont la réf REQUISE n'est pas élue n'a pas de résumé à donner : elle porte son état, et la
  // rangée affiche la raison détaillée (`opsMissingRefs`).
  if (opMissingRefs(o).length) return '(à compléter)';
  switch (o.op) {
    case 'wounds': return `${formulaSummary(o.amount)} Blessure(s)`;
    case 'heal': return `+${formulaSummary(o.amount)} PB`;
    case 'healCaster': return `+${formulaSummary(o.amount)} PB au lanceur`;
    case 'condition': return [`${conditionLabel(o.id)}${o.value && o.value !== 1 ? ` ×${formulaSummary(o.value)}` : ''}${o.perRound ? '/Round' : ''}`, dureePropre(o)].filter(Boolean).join(', ');
    case 'removeCondition': return `${o.id ? conditionLabel(o.id) : '(au choix)'}`;
    case 'endPsych': return psychologyLabel(o.type.id);
    case 'beginPsych': return `${psychologyLabel(o.type.id)}${o.cible ? ` (${libelleDeCible(ciblePsyLue(o.cible))})` : ''}${o.indice != null ? ` ${formulaSummary(o.indice)}` : ''}`;
    case 'sbBonus': return `+${o.amount} BF aux Dégâts`;
    case 'incomingSpellDRMod': return `${typeof o.amount === 'number' && o.amount >= 0 ? '+' : ''}${formulaSummary(o.amount)} DR de Sort / point`;
    case 'charMod': return [`${o.mod >= 0 ? '+' : ''}${o.mod} ${CHAR_LABELS[o.char]}`, plancher(o), dureePropre(o)].filter(Boolean).join(', ');
    case 'skillMod': return `${o.mod >= 0 ? '+' : ''}${o.mod} ${refLabel('skills', o.skill)}`;
    case 'skillDRBonus': return `+${formulaSummary(o.bonus)} DR ${o.skill ? refOuChoix('skills', o.skill, 'compétence') : o.testType ? (findCrewTestTypeById(o.testType)?.label ?? o.testType) : '— compétence ou test à choisir —'}`;
    case 'charDRBonus': return `+${formulaSummary(o.bonus)} DR ${CHAR_LABELS[o.char]}`;
    case 'crewTestMod': return `${o.mod >= 0 ? '+' : ''}${o.mod} (Tests d’équipage)`;
    case 'fall': return `hauteur lue dans « ${findFallTable(o.hauteur.table.id)?.label ?? (o.hauteur.table.id || '— table à choisir —')} »`;
    case 'moveMod': return `${o.mod >= 0 ? '+' : ''}${o.mod} Mouvement`;
    // #3031 ; fiche `user-doctrine-ids-stables-labels-affichage`
    case 'offTerrainMod': return `hors ${terrainLabel(o.terrain)}${o.mSet != null ? ` : M ${o.mSet}` : ''}${o.testDR ? `, ${o.testDR} DR aux Tests` : ''}${o.suffocates ? ', suffoque' : ''}`;
    case 'attrMod': return `+${formulaSummary(o.mod)} ${({ wounds: 'Blessures', fortune: 'Chance', resolve: 'Détermination', fate: 'Destin', resilience: 'Résilience' } as const)[o.attr]}`;
    case 'ap': return `${typeof o.amount === 'number' && o.amount < 0 ? '' : '+'}${formulaSummary(o.amount)} PA${o.loc ? ` (${o.loc})` : ''}`;
    case 'testMod': return `${o.amount >= 0 ? '+' : ''}${o.amount} aux Tests${o.char ? ` de ${CHAR_LABELS[o.char]}` : ''}`;
    case 'ignoreStatePenalties': return 'ignore les pénalités d’État';
    case 'freeReroll': return 'relance gratuite';
    case 'critTwice': return 'deux lancers de Critique';
    case 'gainResource': return `${o.amount >= 0 ? '+' : '−'}${Math.abs(o.amount)} ${o.resource === 'fate' ? 'Destin' : 'Chance'}${o.temporary ? ' (temp.)' : ''}`;
    case 'corruption': return `${o.amount >= 0 ? '+' : ''}${o.amount}${o.align ? ` (${libelleDeValeur(chaosAlignSchema, o.align)})` : ''}`;
    case 'sinMod': return `${o.amount >= 0 ? '+' : ''}${o.amount}`;
    case 'corruptionExposure': return o.easeSteps != null ? `abri : −${o.easeSteps} cran(s) d’Influence` : `${libelleDeValeur(exposureLevelSchema, o.level ?? '')}${o.nature ? ` (${libelleDeLaNature(o.nature)})` : ''}`;
    case 'castPenalty': return `${o.blocked ? 'magie interdite' : o.maxZeroDR ? 'Prière plafonnée' : `${o.mod ?? 0} ${o.skill ? refOuChoix('skills', o.skill, 'compétence de magie') : 'toute magie'}`}`;
    case 'money': return `bourse ${typeof o.montant.brass === 'number' && o.montant.brass < 0 ? '' : '+'}${formulaSummary(o.montant.brass)} sc`;
    case 'statusMod': return `Standing ${formulaSummary(o.amount)} (prochaine aventure)`;
    case 'grantReverseToken': return `inverser ${o.skill ? refOuChoix('skills', o.skill, 'compétence') : 'un Test (cible)'}`;
    case 'castWard': return `${o.mod >= 0 ? '+' : '−'}${Math.abs(o.mod)} Langue, rayon ${formulaSummary(o.radius)} m`;
    case 'arrowWard': return 'projectiles organiques détruits (ZdE du sort)';
    case 'domeWard': return `${formatWardSave({ kind: 'trait', id: o.trait.id }, o.trait.value === undefined ? '?' : formulaSummary(o.trait.value))} (ZdE du sort)`;
    case 'attackWardFM': return 'l’attaquer exige un Test de FM';
    case 'grantWeapon': return `${o.label} (Dégâts ${o.plusBF ? 'BF+' : ''}${formulaSummary(o.damage)})`;
    case 'grantNaturalWeapon': return `${o.label} (${o.plusBF !== false ? 'BF+' : ''}${formulaSummary(o.damage)})`;
    case 'grantTrait': return traitOctroyeLisible(o, formulaSummary);
    case 'removeTrait': return formatTrait(o.trait);
    case 'grantPsychTrait': {
      const { type, cible } = traitOctroye(o);
      return `${psychologyLabel(type)}${cible !== undefined ? ` (${libelleDeCible(cible)})` : ''}`;
    }
    case 'grantTalent': return `${refLabel('talents', o.talent)}`;
    case 'grantCareerSkill': return `${refLabel('skills', o.skill)}`;
    case 'grantCareerTalent': return `${refLabel('talents', o.talent)}`;
    case 'augmentWeapon': return `${[
      ...(o.addQualities ?? []).map((id) => qualityRefLabel({ id })),
      o.damageBonus != null ? `+${formulaSummary(o.damageBonus)} Dégâts` : '',
      ...(o.removeQualities ?? []).map((id: string) => `−${qualityRefLabel({ id })}`),
      o.removeType === 'atout' ? 'perd ses Atouts' : o.removeType === 'defaut' ? 'perd ses Défauts' : '',
      o.suppressEnchants ? 'enchantements annulés' : '',
      o.passive?.length ? 'maniement altéré' : '',
    ].filter(Boolean).join(', ') || '(vide)'}`;
    case 'cureDisease': return `${o.count ?? 1} maladie(s)`;
    case 'reduceDiseaseDays': return `−${o.dice ? `${o.dice.n}d${o.dice.sides}` : (o.days ?? 1)} jour(s)${o.disease != null ? ` (${refOuChoix('maladies', { id: o.disease }, 'maladie')})` : ''}`;
    case 'diseaseTestMod': return `${o.amount >= 0 ? '+' : ''}${o.amount} aux Tests de maladie${o.diseases?.length ? ` (${o.diseases.map((d) => refOuChoix('maladies', { id: d }, 'maladie')).join(', ')})` : ''}`;
    case 'suppressSymptom': return `${refLabel('symptoms', { id: o.symptomId })} suspendu`;
    case 'aggravateSymptom': return `${refLabel('symptoms', { id: o.symptomId })} → ${o.severity} (${refLabel('maladies', { id: o.disease })})`;
    case 'attenuateSymptom': return `${refLabel('symptoms', { id: o.symptomId })} → échelon inférieur (${refLabel('maladies', { id: o.disease })})`;
    case 'grantSymptom': return `+ ${refLabel('symptoms', { id: o.symptomId })} (${refLabel('maladies', { id: o.disease })})`;
    case 'actGate': return `Test de ${CHAR_LABELS[o.char]} chaque Round pour agir`;
    case 'delayed': return `${o.ops.length} op(s) différée(s)${o.afterDuration ? ' (à la dissipation)' : ''}`;
    case 'preventInfection': return 'pas d’infection';
    case 'cureCriticalWound': return `${o.count ?? 1} critique(s)`;
    case 'amputer': return `${o.sequels.map((id) => traumaLabelOf(id)).join(' + ') || 'aucune séquelle'}${o.unitesPerSL ? ' (+1 par DR)' : ''}`;
    case 'suppressPsych': return 'Traits psy. apaisés';
    case 'suffocate': return 'suffocation';
    case 'noBreath': return 'plus besoin de respirer';
    case 'noHunger': return 'plus besoin de manger';
    case 'weatherWard': return 'immunité aux intempéries';
    case 'damageArmour': return 'cuir −1 PA';
    case 'reduceToZero': return 'Blessures à 0';
    case 'banish': return 'retirée du jeu';
    case 'martyr': return 'reçoit les Dégâts';
    case 'giveTrapping': return `${o.count && o.count > 1 ? `${o.count}× ` : ''}${giveTrappingLabel(o)}`;
    case 'perRound': return `${o.ops.length} op(s) chaque Round`;
    case 'summon': return `${formulaSummary(o.count)}× ${o.ref}${o.allyOfCaster === false ? ' (hostile)' : ''}`;
    case 'scheduleRespawn': return `${o.ref} dans ${formulaSummary(o.delayDays)} j${o.cancelFlag ? ` (sauf « ${o.cancelFlag} »)` : ''}`;
    case 'zone': return `${libelleDeValeur(zoneShapeSchema, o.shape)} ${formulaSummary((o.shape === 'wall' ? o.lengthMeters : o.radiusMeters) ?? 2)} m`;
    case 'push': return `${formulaSummary(o.meters)} m`;
    case 'teleport': return `${formulaSummary(o.meters)} m${o.perSL ? ` (+${formulaSummary(o.perSL.metersFormula)}/${o.perSL.every} DR)` : ''}`;
    case 'chain': return `${formulaSummary(o.maxBounces)} rebond(s), saut ${formulaSummary(o.hopMeters)} m`;
    case 'polymorph': return `${o.ref}`;
    case 'transform': return `« ${o.tag} » (${o.ops.length} effet(s)${o.morphRef ? `, apparence ${o.morphRef}` : ''})`;
    case 'endTransform': return `« ${o.tag} »`;
    case 'lifeSteal': return `${o.num}/${o.den} des Dégâts`;
    case 'loseTurn': return 'saute le tour';
    case 'removeShipPoste': return 'retire un poste de navire';
    case 'rollThreshold': return `1d${o.sides} → ${o.thresholds.length} palier(s)`;
    case 'rollTable': return `${'tableId' in o ? `table « ${o.tableId} »` : `${libelleDeValeur(deDeTableSchema, o.die)} → ${o.rows.length} rangée(s)`}${o.addNegativeSL ? ' (+|DR néga.|)' : ''}${o.extraRollsPerStep ? ` +${o.extraRollsPerStep} jet/pas Surinc. (Durée)` : ''}`;
    case 'rollMutation': return `mutation ← « ${o.table} »${o.duration === 'permanent' ? ' (perm.)' : ''}`;
    case 'narrative': return o.text ? `« ${coupeAuMot(o.text, 40)} »` : '(vide)';
    default: return `${(o as GameOp).op}`;
  }
}
