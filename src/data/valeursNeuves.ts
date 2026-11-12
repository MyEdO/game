/**
 * VALEURS NEUVES DE L'ATELIER (#3059) qui ne lisent que les schémas et la donnée : la Condition
 * convertie à un type (`recast`), le report de type d'un bloc (`convertTo`, `memoriser`), les blocs neufs d'un Flow
 * authoré (`noeudTestNeuf`, `blocNeuf`), le statbloc personnalisé neuf (`emptyStatblock`) et celui copié d'une créature
 * (`statblockDeLaCreature`). Le défaut d'une union fermée est son PREMIER membre, lu au
 * schéma. Les fabriques qui lisent le moteur ou le monde vivent au noyau (`noyau/valeursNeuves.ts`).
 */
import { EMPTY_FLOW, type Condition, type FlowTestNode } from '../engine/flowCore';
import type { CustomStatblock } from '../engine/statblock';
import { semencesDeScene, type CreatureData } from './index';
import type { Effect, Flow } from './schemas/defs-scenes/effets';
import { actorRefSchema, partyWhoSchema, startleCauseSchema } from './schemas/grammaire/mecanique';
import { adresseUnPassage, hitLocationSchema } from './schemas/grammaire/valeurs';

/** La Condition « Toujours » : l'absence de condition d'un `when`. */
export const CONDITION_TOUJOURS: Condition = { kind: 'always' };

/** Acteur d'une Condition neuve : le premier de `actorRefSchema`. */
const ACTEUR = actorRefSchema.options[0];
/** Héros visé par une Condition de groupe neuve : le premier de `partyWhoSchema`. */
const HEROS = partyWhoSchema.options[0];

/** Préserve le travail en CHANGEANT de type : composer (ET/OU/NON) ENVELOPPE la condition courante. */
export function recast(cond: Condition, kind: Condition['kind']): Condition {
  switch (kind) {
    case 'always': return CONDITION_TOUJOURS;
    case 'flag': return { kind: 'flag', expr: cond.kind === 'flag' ? cond.expr : '' };
    case 'time': return { kind: 'time', window: cond.kind === 'time' ? cond.window : {} };
    case 'hasItem': return { kind: 'hasItem', trappingId: cond.kind === 'hasItem' ? cond.trappingId : '' };
    case 'money': return { kind: 'money', atLeast: cond.kind === 'money' ? cond.atLeast : { gold: 1 } };
    case 'partyDead': return { kind: 'partyDead', who: cond.kind === 'partyDead' ? cond.who : HEROS };
    case 'etat': return cond.kind === 'etat' ? cond : { kind: 'etat', etat: '' };
    case 'compare': return cond.kind === 'compare' ? cond : { kind: 'compare', subject: { who: ACTEUR, field: 'woundsCurrent' }, op: '>=', value: 1 };
    case 'slThreshold': return cond.kind === 'slThreshold' ? cond : { kind: 'slThreshold', op: '>=', value: 6 };
    case 'location': return { kind: 'location', is: cond.kind === 'location' ? cond.is : hitLocationSchema.options[0] };
    case 'attackKind': return { kind: 'attackKind', is: cond.kind === 'attackKind' ? cond.is : 'morsure' };
    case 'startleCause': return { kind: 'startleCause', is: cond.kind === 'startleCause' ? cond.is : startleCauseSchema.options[0] };
    case 'woundsDealt': return cond.kind === 'woundsDealt' ? cond : { kind: 'woundsDealt', op: '>', value: 0 };
    case 'engagedAdvantageGap': return cond.kind === 'engagedAdvantageGap' ? cond : { kind: 'engagedAdvantageGap', op: '>', value: 0 };
    case 'engagedAdvantageLead': return cond.kind === 'engagedAdvantageLead' ? cond : { kind: 'engagedAdvantageLead', op: '>', value: 0 };
    case 'foeInLoS': return { kind: 'foeInLoS' };
    case 'cibleEnVue': return cond.kind === 'cibleEnVue' ? cond : { kind: 'cibleEnVue' };
    case 'visiblePassive': return cond.kind === 'visiblePassive' ? cond : { kind: 'visiblePassive', who: ACTEUR };
    case 'hiddenFromFoes': return { kind: 'hiddenFromFoes' };
    case 'engaged': return { kind: 'engaged' };
    case 'crewTest': return { kind: 'crewTest' };
    case 'roundDeCombat': return { kind: 'roundDeCombat' };
    case 'nearestFoe': return cond.kind === 'nearestFoe' ? cond : { kind: 'nearestFoe', op: '<=', value: 3 };
    case 'capability': return cond.kind === 'capability' ? cond : { kind: 'capability', who: ACTEUR, id: 'braveheart', op: '>=', value: 1 };
    case 'relation': return cond.kind === 'relation' ? cond : { kind: 'relation', who: ACTEUR, is: 'adversaire' };
    case 'has': return cond.kind === 'has' ? cond : { kind: 'has', who: ACTEUR, what: 'group', value: '' };
    case 'casterChaosDomain': return cond.kind === 'casterChaosDomain' ? cond : { kind: 'casterChaosDomain', is: 'nurgle' };
    case 'skill': return cond.kind === 'skill' ? cond : { kind: 'skill', id: '', who: HEROS };
    case 'talent': return cond.kind === 'talent' ? cond : { kind: 'talent', id: '', who: HEROS };
    case 'career': return cond.kind === 'career' ? cond : { kind: 'career', id: '', who: HEROS };
    case 'species': return cond.kind === 'species' ? cond : { kind: 'species', id: '', who: HEROS };
    case 'status': return cond.kind === 'status' ? cond : { kind: 'status', atLeast: 'Bronze 1', who: HEROS };
    case 'all': return { kind: 'all', of: cond.kind === 'all' || cond.kind === 'any' ? cond.of : cond.kind === 'always' ? [] : [cond] };
    case 'any': return { kind: 'any', of: cond.kind === 'all' || cond.kind === 'any' ? cond.of : cond.kind === 'always' ? [] : [cond] };
    case 'not': return { kind: 'not', of: cond.kind === 'not' ? cond.of : cond };
  }
}

/** `desc` ATTACHÉE à l'adresse (`descRef`) que la mémoire retient, vue d'un `bloc` dont le type ne
 *  déclare pas `descRef` : `convertTo` ne la lui reporte pas, `memoriser` ne la lui fait céder qu'à un
 *  texte non vide. */
const descAttachee = (key: string, bloc: object, memoire: Record<string, unknown>): boolean =>
  key === 'desc' && adresseUnPassage(memoire.descRef) && !('descRef' in bloc);

/** Report des valeurs connues sur un bloc NEUF : le type visé décide des champs qui existent, la
 *  mémoire fournit leurs valeurs. Le discriminant reste celui du type visé. Pure, donc vérifiable
 *  sans navigateur. */
export function convertTo<T extends object>(fresh: T, memoire: Record<string, unknown>, discriminant: string): T {
  const out: Record<string, unknown> = { ...(fresh as Record<string, unknown>) };
  for (const key of Object.keys(out)) {
    if (key === discriminant || descAttachee(key, out, memoire)) continue;
    if (memoire[key] !== undefined) out[key] = memoire[key];
  }
  return out as T;
}

/** Mémoire de la rangée après le bloc `value` : ses champs remplacent ceux retenus. Une `desc` attachée
 *  (`descAttachee`) n'est remplacée que par une chaîne non vide, qui retire alors `descRef` de la mémoire.
 *  Pure. */
export function memoriser(memoire: Record<string, unknown>, value: object): Record<string, unknown> {
  const out = { ...memoire };
  for (const [key, v] of Object.entries(value)) {
    if (!descAttachee(key, value, memoire)) out[key] = v;
    else if (typeof v === 'string' && v !== '') {
      out[key] = v;
      delete out.descRef;
    }
  }
  return out;
}

/** Statbloc personnalisé NEUF (humain de base), au libellé de la fiche qui le porte (sans nom : celui de
 *  la semence, `semences-de-scene.json › profil`). Blessures NON fixées → dérivées par la formule de
 *  Taille au spawn (LDB 85 ; `B` rempli = surcharge). */
export function emptyStatblock(label = semencesDeScene.profil): CustomStatblock {
  return { type: 'statblock', label, char: { M: 4 } };
}

/** Statbloc personnalisé COPIÉ de la créature `c` du Bestiaire : son libellé, ses Caractéristiques, ses Traits posés, ses
 *  Compétences, Talents et sorts, par id. */
export function statblockDeLaCreature(c: CreatureData): CustomStatblock {
  const char: CustomStatblock['char'] = {};
  for (const [k, v] of Object.entries(c.char)) if (typeof v === 'number') (char as Record<string, number>)[k] = v;
  return {
    type: 'statblock', label: c.label, char, traits: c.traits,
    ...(c.skills.length ? { skills: c.skills } : {}),
    ...(c.talents.length ? { talents: c.talents } : {}),
    ...(c.spells.length ? { spells: c.spells } : {}),
  };
}

/** Nœud `test` NEUF : la compétence est la seule saisie laissée à l'auteur (sentinelle vide). */
export const noeudTestNeuf = (): FlowTestNode<Effect> => ({ kind: 'test', test: { skill: { id: '' }, difficulty: 'intermediaire' }, reussite: EMPTY_FLOW, echec: EMPTY_FLOW });

/** Bloc NEUF du menu « + Bloc » d'un Flow : condition, test de compétence ou choix du joueur. */
export function blocNeuf(kind: Exclude<Flow['kind'], 'sequence' | 'effet'>): Flow {
  switch (kind) {
    case 'si': return { kind: 'si', condition: { kind: 'flag', expr: '' }, alors: EMPTY_FLOW };
    case 'test': return noeudTestNeuf();
    case 'choix': return { kind: 'choix', invite: '', oui: EMPTY_FLOW };
  }
}
