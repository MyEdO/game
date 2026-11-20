/**
 * L'OFFRE DES RÉGLAGES DE L'INCANTATION EN ATTENTE (#3328, #3368) : dans sa phase, un réglage de `pendingCast` ne s'offre
 * que là où il change le Sort, au siège qui pilote le lanceur (`DeclarationDuReglage.offre`, `REGLAGES_DU_JET.cast`). Lu
 * par le verbe qui règle un jet (`fermetureDuReglage`), par la fenêtre qui tient la main (`fermeturesDeLaFenetre`) et
 * par la fenêtre d'incantation (`fenetreDIncantation`).
 */
import type { Jeu } from './etat';
import type { FermetureDuJet } from './rollFlowFactory';
import type { ReglageDu } from './reglagesDuJet';
import { actorIn } from './monde/combatants';
import { aiDriven, influencesLocally } from './netOwnership';
import { findSpellById, type SpellData } from '../data/index';
import { choixDeCampSchema } from '../data/schemas/grammaire/mecanique';
import { castInfoIsPrayer } from '../engine/magic';
import { spellEffectOps, type Condition } from '../engine/flowCore';
import { conjureFormOptions } from '../engine/conjuredWeapons';
import { spellHasOvercastTableRoll } from '../engine/overcast';
import { rule } from '../engine/policy';
import { t } from '../i18n';

/** Modes de ciblage édités pour une Zone d'Effet. */
export function choixDeCiblesDuSort(cible: SpellData['target']) {
  const choix = cible?.kind === 'area' ? cible.choixDeCibles : undefined;
  if (!choix) return [];
  return choixDeCampSchema.options.map((id) => ({
    id,
    label: t(`incantation.choixDeCibles.${id}`),
    affects: choix[id],
  }));
}

/** Options désignables de l'incantation en combat. */
export function choixDeCiblesEnAttente(s: Jeu) {
  const pc = s.pendingCast;
  return s.battle && pc?.zone ? choixDeCiblesDuSort(findSpellById(pc.spellId)?.target ?? null) : [];
}

/** L'option retenue pour le lancement, la première par défaut. */
export function choixDeCiblesRetenu(options: ReturnType<typeof choixDeCiblesDuSort>, id?: string) {
  return options.find((option) => option.id === id) ?? options[0];
}

/** Le filtre de la Zone d'Effet et celui de l'option retenue. */
export function filtreDeCiblesDuSort(cible: SpellData['target'], choix?: string): Condition | undefined {
  if (cible?.kind !== 'area') return undefined;
  const filtreDuChoix = choixDeCiblesRetenu(choixDeCiblesDuSort(cible), choix)?.affects;
  if (cible.affects && filtreDuChoix) return { kind: 'all', of: [cible.affects, filtreDuChoix] };
  return filtreDuChoix ?? cible.affects;
}

/** Les réglages de l'incantation qu'une offre ferme. */
export type ReglageOffertDeLIncantation = Extract<
  ReglageDu<'incantation'>, 'effetCritique' | 'formeConjuree' | 'choixDeCibles' | 'discret' | 'jetsDeTable'
>;

/** Ce qui ferme le réglage `reglage` de l'incantation en attente là où il ne change rien au Sort ou que le moteur règle
 *  seul (`nonOffert`), et au siège qui ne pilote pas le lanceur (`rangeeTemoin`) ; `null` : il s'offre. Sans
 *  incantation, aucun ne s'offre. */
export function offreDeLIncantation(s: Jeu, reglage: ReglageOffertDeLIncantation): FermetureDuJet | null {
  const pc = s.pendingCast;
  const sort = pc && findSpellById(pc.spellId);
  const lanceur = pc && actorIn(s, pc.casterId);
  if (!pc || !sort || !lanceur) return 'nonOffert';
  const jet = pc.result;
  // Le moteur règle seul le lanceur qu'il conduit (`aiDriven`) ; le réglage offert se refuse au siège qui ne pilote pas
  // le lanceur (`influencesLocally`) : la possession tranche, jamais le genre du lanceur.
  const ici = (offert: boolean): FermetureDuJet | null => (!offert || aiDriven(s, lanceur) ? 'nonOffert' : influencesLocally(s, lanceur.id) ? null : 'rangeeTemoin');
  const ops = spellEffectOps(sort.effects);
  const offert = {
    // LDB 46 l.26-32
    effetCritique: () => !!jet?.isCritical && !castInfoIsPrayer(sort),
    // LDB 47
    formeConjuree: () => ops.some((o) => o.op === 'grantWeapon' && o.chooseForm) && conjureFormOptions(lanceur).length > 0,
    choixDeCibles: () => choixDeCiblesEnAttente(s).length > 0,
    // LDB 40 l.42
    discret: () => castInfoIsPrayer(sort) && !!rule('priere-conviction'),
    // EDOC 13 l.276
    jetsDeTable: () => !!jet?.cast && (pc.overcast?.duration ?? 0) > 0 && spellHasOvercastTableRoll(ops),
  } satisfies Record<ReglageOffertDeLIncantation, () => boolean>;
  return ici(offert[reglage]());
}
