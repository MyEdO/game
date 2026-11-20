/** LDB 08. */
import { ECHELONS_DE_STATUT, libelleDEchelon, libelleDuStatut, type Status } from './money';
import { rule } from './policy';
import { rollDice, type RNG } from './dice';
import { findTableEntry } from './tables';
import capricieuxJson from '../data/tableau-capricieux.json';
import reactionAuStatutJson from '../data/reaction-au-statut.json';
import { deDeTirageDe, rangeesDe, type RangeeDe } from '../data/rangees';
import type * as capricieux from '../data/schemas/defs/tableau-capricieux';
import type * as reactionAuStatut from '../data/schemas/defs/reaction-au-statut';
import { findCareerById, levelsForCareer } from '../data';
import { t } from '../i18n';
import type { FlowTest } from './flowCore';
import { RULE_REF } from './ruleRefs';
import type { ModLine } from './types';

/** Ce que lisent les Statuts d'un personnage : carrière, niveau, effets actifs (forme structurelle, que la
 *  Condition PARTY-level `status` de `flowCore.ts` partage avec `Combatant`). */
export interface PorteurDeStatut {
  career?: string;
  careerLevel?: number;
  activeEffects?: readonly { statusMod?: number }[];
}

/** Statut d'un personnage dont la carrière ou le niveau est introuvable dans la donnée. */
const STATUT_SANS_CARRIERE: Status = { tier: 'bronze', standing: 1 };

/** Statut de CARRIÈRE (`CareerLevelData.status` du niveau atteint), brique d'`actorStatus`. LDB 08 l.9 */
export function statutDeCarriere(c: PorteurDeStatut): Status {
  const levels = levelsForCareer(c.career ?? '');
  const lvl = findCareerById(c.career ?? '') ? levels[Math.max(0, (c.careerLevel ?? 1) - 1)] : undefined;
  return lvl ? lvl.status : STATUT_SANS_CARRIERE;
}

/** Le Statut `statut` décalé de `delta` Points de Standing ; vers le haut, sans changement d'Échelon.
 *  LDB 08 l.9, l.101 */
export function decalerLeStatut(statut: Status, delta: number): Status {
  if (delta >= 0) return { tier: statut.tier, standing: statut.standing + delta };
  let { tier, standing } = statut;
  for (let i = 0; i > delta && standing > 0; i--) {
    standing -= 1;
    const rang = ECHELONS_DE_STATUT.indexOf(tier);
    if (standing === 0 && rang > 0) {
      tier = ECHELONS_DE_STATUT[rang - 1];
      standing = 5;
    }
  }
  return { tier, standing };
}

/** Statut EFFECTIF : le Statut de carrière décalé de la SOMME des `statusMod` actifs. SEUL lecteur du
 *  Statut d'un personnage. LDB 08 l.101, LDB 23 l.234 */
export function actorStatus(c: PorteurDeStatut): Status {
  return decalerLeStatut(statutDeCarriere(c), (c.activeEffects ?? []).reduce((s, e) => s + (e.statusMod ?? 0), 0));
}

function ecartDEchelon(actor: Status, target: Status): number {
  return ECHELONS_DE_STATUT.indexOf(actor.tier) - ECHELONS_DE_STATUT.indexOf(target.tier);
}

/** LDB 08 l.9-11. */
function ecartDeStatut(actor: Status, target: Status): number {
  return ecartDEchelon(actor, target) || actor.standing - target.standing;
}

/** LDB 08 l.9-11. */
export function statusMeets(actual: Status, need: Status): boolean {
  return ecartDeStatut(actual, need) >= 0;
}

/** La table Capricieux VIVANTE (MSRC 15 l.149-159) — la collection que le Codex édite (`tableauCapricieux`, `data/overrides.ts`). */
type LigneDuCapricieux = RangeeDe<typeof capricieux>;
export const TABLE_DU_CAPRICIEUX: LigneDuCapricieux[] = rangeesDe<typeof capricieux>(capricieuxJson);
/** Le dé de la table Capricieux, lu sur sa table. */
export const deDuCapricieux = () => deDeTirageDe<typeof capricieux>(capricieuxJson);

/** Un tirage sur la table Capricieux (MSRC 15 l.151-159) : le jet et le modificateur de DR de sa rangée. PUR. */
export function tirerLeCapricieux(rng: RNG): { roll: number; dr: number } {
  const roll = rollDice(deDuCapricieux(), rng);
  return { roll, dr: findTableEntry(TABLE_DU_CAPRICIEUX, roll).dr };
}

/** La table de Réaction au Statut VIVANTE (LDB 08 l.38-46) — la collection que le Codex édite (`reactionAuStatut`). */
type LigneDeReactionAuStatut = RangeeDe<typeof reactionAuStatut>;
export const TABLE_DE_REACTION_AU_STATUT: LigneDeReactionAuStatut[] = rangeesDe<typeof reactionAuStatut>(reactionAuStatutJson);

/** L'issue d'un tirage de Réaction au Statut. */
export type IssueDeReaction = LigneDeReactionAuStatut['issue'];

/** Un tirage sur la table de Réaction au Statut (LDB 08 l.40-46) : l'issue de sa rangée. PUR. */
export function tirerLaReactionAuStatut(rng: RNG): IssueDeReaction {
  return findTableEntry(TABLE_DE_REACTION_AU_STATUT, rollDice(deDeTirageDe<typeof reactionAuStatut>(reactionAuStatutJson), rng)).issue;
}

type IdDeCompetence = NonNullable<FlowTest['skill']>['id'];
type AvisSurLeStatut = FlowTest['avisSurLeStatut'];
type ModDeBase = (actor: Status, target: Status, mendicite: boolean) => number;

const PAS_DU_STATUT = 10;

const MOD_DE_BASE_DU_STATUT = {
  /** LDB 08 l.57,63. */
  charme: (actor, target, mendicite) => {
    if (mendicite) return PAS_DU_STATUT;
    const ecart = rule('social-statut-meme-echelon') ? ecartDeStatut(actor, target) : ecartDEchelon(actor, target);
    return ecart === 0 ? 0 : Math.sign(ecart) * PAS_DU_STATUT;
  },
  /** LDB 08 l.73. */
  intimidation: (actor, target) => ecartDeStatut(actor, target) > 0 ? PAS_DU_STATUT : 0,
  /** LDB 08 l.77. */
  ragot: (actor, target) => ecartDEchelon(actor, target) === 0 ? 0 : -PAS_DU_STATUT,
  /** LDB 08 l.83. */
  commandement: (actor, target) => Math.max(0, ecartDEchelon(actor, target)) * PAS_DU_STATUT,
} satisfies Partial<Record<IdDeCompetence, ModDeBase>>;

type CompetenceDeStatut = keyof typeof MOD_DE_BASE_DU_STATUT;

export function estUneCompetenceDeStatut(id: IdDeCompetence | undefined): id is CompetenceDeStatut {
  return id !== undefined && Object.prototype.hasOwnProperty.call(MOD_DE_BASE_DU_STATUT, id);
}

/** LDB 08 l.44-46,59. */
const MOD_SOUS_LA_REACTION: Record<IssueDeReaction, (base: number, competence: CompetenceDeStatut, avis: AvisSurLeStatut) => number> = {
  'braver-le-statut': () => 0,
  'reactions-classiques': (base) => base,
  'opinions-extremes': (base, competence, avis) => {
    if (competence === 'charme') return base === 0 ? 0 : -base;
    const avisEffectif = avis ?? rule('social-opinions-extremes-avis-par-defaut');
    if (avisEffectif === 'favorable') return base + PAS_DU_STATUT;
    if (avisEffectif === 'hostile') return base - PAS_DU_STATUT;
    return base;
  },
};

/** LDB 08 l.46,57,59,63,73,77,83. */
export function ligneDeStatut(
  competence: CompetenceDeStatut,
  actor: Status,
  target: Status,
  { begging, reaction, avisSurLeStatut }: Pick<FlowTest, 'begging' | 'avisSurLeStatut'> & { reaction?: IssueDeReaction } = {},
): ModLine | undefined {
  const mendicite = competence === 'charme' && !!begging && rule('social-mendicite-statut')
    && actor.tier === 'bronze' && target.tier === 'argent';
  const base = MOD_DE_BASE_DU_STATUT[competence](actor, target, mendicite);
  const value = reaction ? MOD_SOUS_LA_REACTION[reaction](base, competence, avisSurLeStatut) : base;
  if (!value) return undefined;

  const ecart = ecartDeStatut(actor, target);
  const cmp = mendicite || ecart > 0 ? '>' : ecart < 0 ? '<' : '=';
  const side = actor.tier === target.tier
    ? `${libelleDuStatut(actor)}${cmp}${target.standing}`
    : `${libelleDEchelon(actor.tier)}${cmp}${libelleDEchelon(target.tier)}`;
  const label = t('social.statusMod', {
    beg: mendicite ? t('social.fragBegging') : '',
    side,
    sign: value > 0 ? '+' : '−',
    mod: Math.abs(value),
  });
  return { label, value, famille: 'jet', ref: RULE_REF.statut };
}
