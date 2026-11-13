/**
 * Résumeur d'ATELIER des ops mécaniques (`opSummary`) et de leurs `Formula` (`formulaSummary`),
 * réservé à `src/ui/editor/` (#495, #2724).
 */
import type { GameOp } from '../../../engine/ops';
import type { JsonFormula } from '../../../engine/miscast';
import type { DatasetKey } from '../../../data/overrides';
import { charAbr, conditionLabel, findCrewTestTypeById, psychologyLabel, qualityRefLabel, refLabel } from '../../../data';
import { cibleDeRef, libelleDePsy } from '../../../engine/psych/ciblage';
import { libelleDuTraitOctroye } from '../../../engine/psych/opsPsy';
import { findFallTable } from '../../../data/shipCriticals';
import { libelleDeValeur } from '../../../data/schemas/grammaire/meta';
import { chaosAlignSchema, contexteDeTestSchema, exposureLevelSchema } from '../../../data/schemas/grammaire/valeurs';
import { zoneShapeSchema } from '../../../data/schemas/grammaire/mecanique';
import { CHAR_LABELS } from '../../../engine/types';
import { formatDice, formatEffetSigne } from '../../../engine/dice';
import { deDeLaTableTiree } from '../../../engine/tables';
import { shipLocationLabel } from '../../../engine/shipCritical';
import { deElide } from '../../../i18n';
import { giveTrappingLabel } from '../../../engine/items';
import { formatWardSave, traitLisible } from '../../../engine/traits/dispatch';
import { traumaLabelOf } from '../../../engine/trauma';
import { ruleDef } from '../../../engine/policy';
import { terrainLabel } from '../../../noyau/monde/terrain';
import { dureePropre, plancher, traitOctroyeLisible } from '../../../noyau/codex/humanize';
import { coupeAuMot } from '../../../lib/coupeAuMot.mjs';
import { opMissingRefs } from '../../../data/refsDOp';
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
  if ('blessuresMax' in f) return 'B max';
  if ('tailleDuNavire' in f) return 'Taille du navire';
  if ('valeurCargaison' in f) return 'valeur de la cargaison';
  if ('tire' in f) return f.de === undefined ? `« ${f.tire} »` : `${formulaSummary(f.de)} (« ${f.tire} »)`;
  if ('sl' in f) return 'DR';
  if ('sinPoints' in f) return 'Points de Péché';
  if ('rule' in f) return ruleDef(f.rule)?.label ?? f.rule;
  if ('minimum' in f) return `${formulaSummary(f.of)} (min ${f.minimum})`;
  if ('parTranche' in f) return `${formulaSummary(f.of)} ÷ ${f.parTranche}`;
  if ('sum' in f) return f.sum.map(formulaSummary).join(' + ');
  if ('times' in f) return `${formulaSummary(f.times.of)} × ${formulaSummary(f.times.factor)}`;
  if ('dice' in f) return formatDice(f.dice);
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
    case 'condition': return [`${conditionLabel(o.id.id)}${o.value && o.value !== 1 ? ` ×${formulaSummary(o.value)}` : ''}${o.perRound ? '/Round' : ''}`, dureePropre(o)].filter(Boolean).join(', ');
    case 'removeCondition': return `${o.id ? conditionLabel(o.id.id) : '(au choix)'}`;
    case 'endPsych': return 'instance' in o ? 'cet état' : psychologyLabel(o.type.id);
    case 'beginPsych': return `${libelleDePsy(o.type.id, o.cible && cibleDeRef(o.cible))}${o.indice != null ? ` ${formulaSummary(o.indice)}` : ''}`;
    case 'sbBonus': return `+${o.amount} au Bonus de Force`;
    case 'incomingSpellDRMod': return `${typeof o.amount === 'number' && o.amount >= 0 ? '+' : ''}${formulaSummary(o.amount)} DR de Sort / point`;
    case 'charMod': return [`${o.mod >= 0 ? '+' : ''}${o.mod} ${CHAR_LABELS[o.characteristic]}`, plancher(o), dureePropre(o)].filter(Boolean).join(', ');
    case 'skillMod': return `${o.mod >= 0 ? '+' : ''}${o.mod} ${refLabel('skills', o.skill)}`;
    case 'skillDRBonus': return `+${formulaSummary(o.bonus)} DR ${o.skill ? refOuChoix('skills', o.skill, 'compétence') : o.testType ? (findCrewTestTypeById(o.testType.id)?.label ?? o.testType.id) : '— compétence ou test à choisir —'}`;
    case 'charDRBonus': return `+${formulaSummary(o.bonus)} DR ${CHAR_LABELS[o.characteristic]}`;
    case 'crewTestMod': return `${o.mod >= 0 ? '+' : ''}${o.mod} (Tests d’équipage)`;
    case 'fall': return `hauteur lue dans « ${findFallTable(o.hauteur.table.id)?.label ?? (o.hauteur.table.id || '— table à choisir —')} »`;
    case 'moveMod': return `${o.mod >= 0 ? '+' : ''}${o.mod} Mouvement`;
    // #3031 ; fiche `user-doctrine-ids-stables-labels-affichage`
    case 'offTerrainMod': return `hors ${terrainLabel(o.terrain.id)}${o.mSet != null ? ` : M ${o.mSet}` : ''}${o.testDR ? `, ${o.testDR} DR aux Tests` : ''}${o.suffocates ? ', suffoque' : ''}`;
    case 'attrMod': return `+${formulaSummary(o.mod)} ${({ wounds: 'Blessures', fortune: 'Chance', resolve: 'Détermination', fate: 'Destin', resilience: 'Résilience' } as const)[o.attr]}`;
    case 'ap': return `${typeof o.amount === 'number' && o.amount < 0 ? '' : '+'}${formulaSummary(o.amount)} PA${o.loc ? ` (${o.loc})` : ''}`;
    case 'testMod': return `${o.amount >= 0 ? '+' : ''}${o.amount} aux Tests${o.characteristic ? ` de ${CHAR_LABELS[o.characteristic]}` : ''}`;
    case 'ignoreStatePenalties': return 'ignore les pénalités d’État';
    case 'freeReroll': return 'relance gratuite';
    case 'critTwice': return 'deux lancers de Critique';
    case 'gainResource': return `${o.amount >= 0 ? '+' : '−'}${Math.abs(o.amount)} ${o.resource === 'fate' ? 'Destin' : 'Chance'}${o.temporary ? ' (temp.)' : ''}`;
    case 'corruption': return `${o.amount >= 0 ? '+' : ''}${o.amount}${o.align ? ` (${libelleDeValeur(chaosAlignSchema, o.align)})` : ''}`;
    case 'sinMod': return `${o.amount >= 0 ? '+' : ''}${o.amount}`;
    case 'corruptionExposure': return o.easeSteps != null ? `abri : −${o.easeSteps} cran(s) d’Influence` : `${libelleDeValeur(exposureLevelSchema, o.level ?? '')}${o.nature ? ` (${libelleDeLaNature(o.nature)})` : ''}`;
    case 'castPenalty': return `${o.blocked ? 'magie interdite' : o.maxZeroDR ? 'Prière plafonnée' : `${o.mod ?? 0} ${o.skill ? refOuChoix('skills', o.skill, 'compétence de magie') : 'toute magie'}`}`;
    case 'money': return `bourse${o.groupe ? ' du groupe' : ''} ${typeof o.montant.brass === 'number' && o.montant.brass < 0 ? '' : '+'}${formulaSummary(o.montant.brass)} sc`;
    case 'statusMod': return `Standing ${formulaSummary(o.amount)} (prochaine aventure)`;
    case 'grantReverseToken': return `inverser ${o.skill ? refOuChoix('skills', o.skill, 'compétence') : o.characteristic ? `un Test ${deElide(CHAR_LABELS[o.characteristic])}` : 'un Test (cible)'}${o.contexte ? ` ${libelleDeValeur(contexteDeTestSchema, o.contexte)}` : ''}${o.illimite ? ' (illimité)' : ''}`;
    case 'castWard': return `${o.mod >= 0 ? '+' : '−'}${Math.abs(o.mod)} Langue, rayon ${formulaSummary(o.radius)} m`;
    case 'arrowWard': return 'projectiles organiques détruits (ZdE du sort)';
    case 'domeWard': return `${formatWardSave({ kind: 'trait', id: o.trait.id }, o.trait.value === undefined ? '?' : formulaSummary(o.trait.value))} (ZdE du sort)`;
    case 'attackWardFM': return 'l’attaquer exige un Test de FM';
    case 'grantWeapon': return `${o.label} (Dégâts ${o.plusBF ? 'BF+' : ''}${formulaSummary(o.damage)})`;
    case 'grantNaturalWeapon': return `${o.label} (${o.plusBF !== false ? 'BF+' : ''}${formulaSummary(o.damage)})`;
    case 'grantTrait': return traitOctroyeLisible(o, formulaSummary);
    case 'removeTrait': return traitLisible(o.trait);
    case 'grantPsychTrait': return [libelleDuTraitOctroye(o), dureePropre(o)].filter(Boolean).join(', ');
    case 'grantTalent': return `${refLabel('talents', o.talent)}`;
    case 'deitySkillMod': return [
      `${o.mod >= 0 ? '+' : ''}${o.mod} ${o.pick === 'all' ? 'toutes Compétences du dieu' : '1 Compétence du dieu au hasard'}`,
      o.durationHours != null ? `${formulaSummary(o.durationHours)} heure(s)` : undefined,
      o.durationDays != null ? `${formulaSummary(o.durationDays)} jour(s)` : undefined,
    ].filter(Boolean).join(', ');
    case 'suppressTalents': return `${o.talents.map((x) => refLabel('talents', x)).join(', ')} suspendus ${formulaSummary(o.durationDays)} jour(s)`;
    case 'deityBan': return `${formulaSummary(o.durationDays)} jour(s)`;
    case 'prayerForAction': return `${formulaSummary(o.durationRounds)} Round(s)`;
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
    case 'testDAgir': return `Test de ${CHAR_LABELS[o.characteristic]} chaque Round pour agir`;
    case 'delayed': return `${o.ops.length} op(s) différée(s)${o.afterDuration ? ' (à la dissipation)' : ''}`;
    case 'preventInfection': return 'pas d’infection';
    case 'aideMedicale': return 'Aide Médicale';
    case 'cureCriticalWound': return `${o.count ?? 1} critique(s)`;
    case 'amputer': return `${o.sequels.map((id) => traumaLabelOf(id)).join(' + ') || 'aucune séquelle'}${o.unitesPerSL ? ' (+1 par DR)' : ''}`;
    case 'suppressPsych': return 'Traits psy. apaisés';
    case 'suffocate': return 'suffocation';
    case 'noBreath': return 'plus besoin de respirer';
    case 'noHunger': return 'plus besoin de manger';
    case 'weatherWard': return 'immunité aux intempéries';
    case 'damageArmour': return 'cuir −1 PA';
    case 'damageWornGear': return 'Armures et Armes −1';
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
    case 'rollTable': return `${'tableId' in o ? `table « ${o.tableId} »` : `${formatDice(deDeLaTableTiree(o))} → ${o.entries.length} rangée(s)`}${o.addNegativeSL ? ' (+|DR néga.|)' : ''}${o.extraRollsPerStep ? ` +${o.extraRollsPerStep} jet/pas Surinc. (Durée)` : ''}`;
    case 'rollMutation': return `mutation ← « ${o.table} »${o.duration === 'permanent' ? ' (perm.)' : ''}`;
    case 'narrative': return `${o.text ? `« ${coupeAuMot(o.text, 40)} »` : '(vide)'}${o.nombre !== undefined ? ` : ${formulaSummary(o.nombre)}` : ''}`;
    case 'shipMorale': return `Moral ${formatEffetSigne(o.delta)}`;
    case 'manann': return o.factorId !== undefined ? `facteur « ${refLabel('seaManannFactors', { id: o.factorId })} »` : `Humeur ${formatEffetSigne(o.delta)}`;
    case 'shipCritical': return `${formulaSummary(o.count)} Critique(s) — ${o.location === 'aleatoire' ? 'Localisation aléatoire' : shipLocationLabel(o.location)}${o.equipageEpargne ? ' · équipage épargné' : ''}`;
    case 'navireMod': return `${[o.m !== undefined ? `M ${o.m >= 0 ? '+' : ''}${o.m}` : '', o.manDR !== undefined ? `Man ${o.manDR >= 0 ? '+' : ''}${o.manDR} DR` : '', o.evite ? `évite ${o.evite.join(', ')}` : ''].filter(Boolean).join(', ')} ${o.jusqua === 'carenage' ? '→ carénage' : o.jusqua === 'evenementDeBord' ? '→ prochain événement' : `· ${formulaSummary(o.jusqua.jours)} j`}`;
    case 'meteoImposee': return `météo ${[...Object.values(o.meteo ?? {}), ...(o.ventInverse ? ['vent inversé'] : [])].join(', ')} · ${formulaSummary(o.jours)} j${o.aggravation ? ' (aggravation)' : ''}`;
    case 'cargaison': return o.perteAuDechargement !== undefined ? `−${formulaSummary(o.perteAuDechargement)} Enc au déchargement` : o.perduePct !== undefined ? `−${o.perduePct} % de la cargaison` : o.perdueEnc !== undefined ? `−${formulaSummary(o.perdueEnc)} Enc de cargaison` : `${formulaSummary(o.enc)} Enc de cargaison tirée`;
    case 'equipage': return o.perdusPct !== undefined ? `Équipage −${o.perdusPct} % des PNJ` : `Équipage ${formulaSummary(o.delta)}${o.role ? ` (${refLabel('crewRoles', o.role)})` : ''}${o.sansSolde ? ' · sans solde jusqu’au port' : ''}`;
    case 'provisions': return o.gateesPct !== undefined ? `${o.gateesPct} % des provisions gâtées` : o.rations !== undefined ? `+${formulaSummary(o.rations)} ration(s) de « ${refLabel('trappings', o.vivre)} »` : o.eauTonneaux !== undefined ? `+${formulaSummary(o.eauTonneaux)} tonneau(x) d’eau` : `+${formulaSummary(o.jours)} j de « ${refLabel('trappings', o.vivre)} »`;
    case 'perilDeMer': return o.collision !== undefined ? `Collision : ${o.collision.id}` : `Tourbillon : ${o.tourbillon.id}`;
    case 'navireHostile': return `${refLabel('vehicles', o.navire)} · ${o.equipage.nombre} × ${refLabel('creatures', o.equipage)}${o.exigence === 'fouille' ? ' · fouille' : ''}`;
    case 'infestation': return `${refLabel('crewTestTypes', o.crewTestType)} · ${o.drCible} DR`;
    case 'commission': return `colis livré contre ${formulaSummary(o.montant.brass)} sous de cuivre`;
    case 'constructeurDEscale': return `Constructeur de navires ${o.competence} · ${formulaSummary(o.duree)} j`;
    case 'rationsDEscale': return `ration-jour de vivres frais à ${formulaSummary(o.montant.brass)} sous de cuivre`;
    case 'attaquesSubies': return `${formatDice(o.nombre.dice)} attaque(s) de ${o.assaillant.statblock.label}`;
    case 'combatEnMer': return `Combat : ${o.adversaire.nombre} × ${refLabel('creatures', o.adversaire)}${o.repousseAPct !== undefined ? ` · repoussé à ${o.repousseAPct} %` : ''}${o.victoire ? ' · sur la victoire' : ''}`;
    default: return `${(o as GameOp).op}`;
  }
}
