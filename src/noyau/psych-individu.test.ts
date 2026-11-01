/**
 * La Cible d'INDIVIDU d'un Trait psy : EDOC 11 l.648, LDB 21 l.75 ; #3045.
 * Une Cible `@id` vise le combattant de cet id et lui seul, de tout `kind`, à chaque lecteur.
 * Fiches fabriquées ; les entrées de donnée sont choisies par leur forme, jamais par leur nom.
 */
import { describe, it, expect } from 'vitest';
import {
  ciblesDePulsion, psychBranchOps, psychImmuneToFrom, sansCiblesPsyInconnues, targetedTrigger, vise, type PsychType,
} from '../engine/psychology';
import { psychDRAdjust } from '../engine/combat';
import { applyOps } from '../engine/ops';
import { socialPsychMod } from '../engine/skills';
import { encounterPsych } from '../engine/encounterPsych';
import { parsePsychTraits } from '../engine/psych/registry';
import { ciblePsy, identiteDeCiblage, libelleDeCible } from '../engine/psych/ciblage';
import { groups, psychologies, traits } from '../data';
import { traitInstanceSchema, traitPoseDeSceneSchema } from '../data/schemas/grammaire/reference';
import { gameOpSchema } from '../data/schemas/grammaire/mecanique';
import { routePerilSchema } from '../data/schemas/defs-scenes/worldmap';
import { projetDoc } from '../data/schemas/defs-scenes/projet';
import { adversairesDe, chooseEnemyAction, type EnemyTurnInput } from './monde/ai';
import { aiApproachPlan } from './combatFlow';
import { makeRNG } from '../engine/dice';
import { CHAR_KEYS } from '../engine/types';
import { tableTotale } from '../lib/tableTotale';
import { emptyScene, type Scene } from './monde/scene';
import { ficheDEntite, nomDIndividu } from './monde/sceneNpc';
import { presetDuNarratif } from './monde/resolveursDuNarratif';
import { validateScene } from './validateScene';
import type { Combatant, Weapon } from '../engine/types';
import { SCHEMA_DEFS } from '../data/schemas/_registry.generated';
import { readFileSync } from 'node:fs';
import { blessuresDeBase, blessuresSurLeProfil, profilDeTest } from '../engine/combattantDeTest.testkit';

/** Le texte brut des documents du catalogue, par chemin relatif (`../data/<file>`). */
const TEXTES_DU_CATALOGUE = import.meta.glob<string>('../data/*.json', { eager: true, query: '?raw', import: 'default' });

const MELEE: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
const mk = (id: string, kind: 'hero' | 'enemy', o: Partial<Combatant> = {}): Combatant => (blessuresSurLeProfil({
  id, label: id, kind, advantage: 0, conditions: [], characteristics: profilDeTest(), psychState: [], psychTraits: [],
  groups: [], weapons: [MELEE], armour: {} as never, skills: [], talents: [], movement: 4, wounds: blessuresDeBase(10), ...o,
}) as Combatant);

const groupe = groups.find((g) => !g.matchesAll)!;
/** Un type ciblé qui admet le Groupe et l'individu, et un qui n'admet que l'individu. */
const mixte = psychologies.find((p) => p.cibles?.includes('groupe') && p.cibles.includes('individu') && !p.targetCauses && p.triggerOn !== 'threatened');
const individuSeul = psychologies.find((p) => p.cibles?.length === 1 && p.cibles[0] === 'individu');
const pulsion = psychologies.find((p) => p.attackDR?.vs === 'group' && p.cibles?.includes('individu'));
const immunisant = psychologies.find((p) => p.immuneToFromTarget?.length && p.cibles?.includes('individu'));
const contenu = psychologies.find((p) => p.containedSocialMod != null && p.cibles?.includes('individu'));
/** Un Trait de statbloc qui porte un type de Cible `mixte`, et un qui porte `individuSeul`. */
const traitMixte = traits.find((t) => t.specsSource === 'ciblesPsy' && t.capabilities?.psychType === mixte?.id);
const traitIndividuSeul = traits.find((t) => t.specsSource === 'ciblesPsy' && t.capabilities?.psychType === individuSeul?.id);

describe('préconditions de forme', () => {
  it('la donnée a les entrées de chaque forme', () => {
    for (const x of [groupe, mixte, individuSeul, pulsion, immunisant, contenu, traitMixte, traitIndividuSeul]) expect(x).toBeDefined();
  });
});

describe('vise — un individu ne vise que le combattant de son id', () => {
  const cible = ciblePsy.individu('p');

  it('quelle que soit la lecture, et jamais un autre porteur des mêmes Groupes', () => {
    for (const lecture of ['appartenance', 'percu'] as const) {
      expect(vise(cible, { genre: 'combattant', c: mk('p', 'enemy', { groups: [groupe.id] }) }, lecture)).toBe(true);
      expect(vise(cible, { genre: 'combattant', c: mk('q', 'enemy', { groups: [groupe.id] }) }, lecture)).toBe(false);
    }
  });

  it('un interlocuteur, décrit par ses seuls Groupes, n’est jamais un individu', () => {
    expect(vise(cible, { genre: 'interlocuteur', groups: [groupe.id] }, 'percu')).toBe(false);
  });
});

describe('le combat : déclencheur, +1 DR, immunité', () => {
  it('le Trait se déclenche à la vue de l’individu, d’une seule instance, et non à celle d’un homonyme de Groupe', () => {
    const obs = mk('o', 'hero', { psychTraits: [{ type: mixte!.id as PsychType, cible: ciblePsy.individu('p') }] });
    expect(targetedTrigger(obs, [mk('q', 'enemy', { groups: [groupe.id] })])).toBeNull();
    const tt = targetedTrigger(obs, [mk('q', 'enemy'), mk('p', 'enemy')]);
    expect(tt).toMatchObject({ sourceId: 'p', cible: ciblePsy.individu('p') });
    obs.psychState = [{ type: tt!.type, cible: tt!.cible, sourceId: tt!.sourceId, active: true }];
    expect(targetedTrigger(obs, [mk('p', 'enemy')])).toBeNull();
  });

  it('deux individus, ou un individu et un Groupe, sont deux identités', () => {
    const ids = new Set([
      identiteDeCiblage(mixte!.id, ciblePsy.individu('p')),
      identiteDeCiblage(mixte!.id, ciblePsy.individu('q')),
      identiteDeCiblage(mixte!.id, ciblePsy.groupe(groupe.id)),
    ]);
    expect(ids.size).toBe(3);
  });

  it('+DR d’attaque contre l’individu seul (LDB 21 l.41)', () => {
    const att = mk('a', 'enemy', { psychState: [{ type: pulsion!.id as PsychType, cible: ciblePsy.individu('p'), active: true }] });
    expect(psychDRAdjust(att, mk('p', 'hero'))).toBe(pulsion!.attackDR!.amount);
    expect(psychDRAdjust(att, mk('q', 'hero'))).toBe(0);
  });

  it('immunité causée par l’individu seul (LDB 21 l.41)', () => {
    const canal = immunisant!.immuneToFromTarget![0];
    const self = mk('s', 'hero', { psychState: [{ type: immunisant!.id as PsychType, cible: ciblePsy.individu('p'), active: true }] });
    expect(psychImmuneToFrom(self, mk('p', 'enemy'), canal)).toBe(true);
    expect(psychImmuneToFrom(self, mk('q', 'enemy'), canal)).toBe(false);
  });

  it('malus social contenu : l’interlocuteur d’un Test social n’a pas d’id, un individu ne s’y applique pas', () => {
    const tester = mk('t', 'hero', { psychTraits: [{ type: contenu!.id as PsychType, cible: ciblePsy.individu('p') }] });
    expect(socialPsychMod(tester, [groupe.id])).toBe(0);
  });
});

describe('le statbloc de scène à `@id` (EDOC 11 l.648), jusqu’à la rencontre', () => {
  const pose = (arg: string) => ({ id: traitMixte!.id, arg });

  it('le catalogue refuse `@id` ; le statbloc de scène l’admet', () => {
    expect(traitInstanceSchema.safeParse(pose('@p')).success).toBe(false);
    expect(traitPoseDeSceneSchema.safeParse(pose('@p')).success).toBe(true);
    expect(traitPoseDeSceneSchema.safeParse(pose(groupe.id)).success).toBe(true);
  });

  it('un type qui n’admet que l’individu refuse un Groupe, dans les deux régimes', () => {
    const groupeSeul = { id: traitIndividuSeul!.id, arg: groupe.id };
    expect(traitInstanceSchema.safeParse(groupeSeul).success).toBe(false);
    expect(traitPoseDeSceneSchema.safeParse(groupeSeul).success).toBe(false);
    expect(traitPoseDeSceneSchema.safeParse({ id: traitIndividuSeul!.id, arg: '@p' }).success).toBe(true);
  });

  it('la fiche du PNJ porte la Cible d’individu, qui déclenche à la rencontre du personnage nommé', () => {
    expect(parsePsychTraits([pose('@p')]).psychTraits).toEqual([{ type: mixte!.id, cible: ciblePsy.individu('p') }]);
    const scene = emptyScene('s', 6, 6);
    scene.entities.push(
      { id: 'pnj', kind: 'personnage', pos: { x: 1, y: 1 }, statblock: { type: 'statblock', label: 'PNJ', char: {}, traits: [pose('@p')] } },
      { id: 'p', kind: 'personnage', pos: { x: 2, y: 1 }, statblock: { type: 'statblock', label: 'Nommé', char: {}, groups: [groupe.id] } },
    );
    const presetDe = presetDuNarratif(undefined);
    const pnj = ficheDEntite(scene.entities[0], presetDe);
    const nomme = ficheDEntite(scene.entities[1], presetDe);
    expect(encounterPsych(pnj, [nomme])).toMatchObject({ sourceId: 'p', cible: ciblePsy.individu('p') });
    expect(encounterPsych(pnj, [mk('autre', 'hero', { groups: [groupe.id] })])).toBeNull();
  });

  it('`validateScene` refuse un individu qu’aucun personnage de la scène ne porte', () => {
    const erreurs = (s: Scene) => validateScene([s]).filter((w) => w.level === 'error' && w.message.includes('Cible psy')).map((w) => w.refId ?? w.scope);
    const avec = (arg: string) => {
      const s = emptyScene('s', 6, 6);
      s.entities.push(
        { id: 'pnj', kind: 'personnage', pos: { x: 1, y: 1 }, statblock: { type: 'statblock', label: 'PNJ', char: {}, traits: [pose(arg)] } },
        { id: 'p', kind: 'personnage', pos: { x: 2, y: 1 }, statblock: { type: 'statblock', label: 'Nommé', char: {} } },
      );
      return s;
    };
    expect(erreurs(avec('@p'))).toEqual([]);
    expect(erreurs(avec('@absent'))).toEqual(['pnj']);
  });

  it('le Test de Calme qu’il déclenche pose l’affliction envers l’individu, et lui seul', () => {
    const obs = mk('o', 'hero', { psychTraits: parsePsychTraits([pose('@p')]).psychTraits });
    const tt = targetedTrigger(obs, [mk('p', 'enemy')])!;
    applyOps(obs, psychBranchOps({ kind: tt.type, sourceId: tt.sourceId, cible: tt.cible, indice: 0 }, { success: false }), { rng: makeRNG(1) });
    expect(obs.psychState).toMatchObject([{ type: mixte!.id, cible: ciblePsy.individu('p'), active: true }]);
  });
});

describe('l’op psy de donnée : sa Cible est un Groupe, dans tout document', () => {
  it('admet un Groupe, refuse un personnage, un `@id`, et un Groupe à un type d’individus seuls', () => {
    expect(gameOpSchema.safeParse({ op: 'grantPsychTrait', psychType: { id: mixte!.id }, cible: { id: groupe.id } }).success).toBe(true);
    for (const op of [
      { op: 'grantPsychTrait', psychType: { id: mixte!.id }, cible: { personnage: 'p' } },
      { op: 'beginPsych', type: { id: mixte!.id }, cible: { personnage: 'p' } },
      { op: 'grantPsychTrait', psychType: { id: mixte!.id }, cible: { id: '@p' } },
      { op: 'grantPsychTrait', psychType: { id: individuSeul!.id }, cible: { id: groupe.id } },
    ]) {
      const refus = gameOpSchema.safeParse(op);
      expect(refus.success).toBe(false);
      expect(refus.error?.issues.map((i) => i.path[0])).toContain('cible');
    }
  });

  /** La 1re op psy à Cible d'une valeur de donnée, à toute profondeur. */
  const opPsyACible = (noeud: unknown): Record<string, unknown> | undefined => {
    if (Array.isArray(noeud)) return noeud.map(opPsyACible).find((o) => o !== undefined);
    if (!noeud || typeof noeud !== 'object') return undefined;
    const o = noeud as Record<string, unknown>;
    if ((o.op === 'beginPsych' || o.op === 'grantPsychTrait') && o.cible !== undefined) return o;
    return Object.values(o).map(opPsyACible).find((x) => x !== undefined);
  };

  it('un document du catalogue refuse la Cible d’individu de ses ops', () => {
    const lus = SCHEMA_DEFS.flatMap((d) => {
      const texte = TEXTES_DU_CATALOGUE[`../data/${d.file}`];
      expect(texte, `${d.file} hors du catalogue`).toBeDefined();
      const donnee: unknown = JSON.parse(texte);
      return opPsyACible(donnee) ? [{ d, donnee, taille: JSON.stringify(donnee).length }] : [];
    }).sort((a, b) => a.taille - b.taille);
    expect(lus.length, 'aucun document du catalogue ne porte d’op psy à Cible').toBeGreaterThan(0);
    const { d, donnee } = lus[0];
    expect(d.schema.safeParse(donnee).success).toBe(true);
    opPsyACible(donnee)!.cible = { personnage: 'p' };
    const refus = d.schema.safeParse(donnee);
    expect(refus.success).toBe(false);
    expect(refus.error?.issues.map((i) => i.path[i.path.length - 1])).toContain('cible');
  });

  const statblocAvec = (arg: string) => ({ type: 'statblock', label: 'Chien', char: {}, traits: [{ id: traitMixte!.id, arg }] });

  it('le projet admet l’individu au statbloc de ses scènes, jamais à l’op', () => {
    const projet = JSON.parse(readFileSync(new URL('../scenes/arene/arene-projet.json', import.meta.url), 'utf8'));
    const [scene] = projet.scenes;
    const personnage = scene.entities[0].id;
    scene.entities.push({ id: 'pnj-cible', kind: 'personnage', pos: { x: 1, y: 1 }, statblock: statblocAvec(`@${personnage}`) });
    expect(projetDoc.schema.safeParse(projet).success).toBe(true);
    scene.triggers.push({ id: 'pose-cible', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: { kind: 'do', effect: { type: 'ops', on: 'party', ops: [{ op: 'grantPsychTrait', psychType: { id: mixte!.id }, cible: { personnage } }] } } });
    expect(projetDoc.schema.safeParse(projet).success).toBe(false);
  });

  it('une péripétie de route refuse la Cible d’individu, à l’op comme au statbloc', () => {
    const peril = (effect: unknown) => ({ label: 'Péril', chancePct: 10, effects: [effect] });
    const op = (cible: object) => ({ type: 'ops', ops: [{ op: 'grantPsychTrait', psychType: { id: mixte!.id }, cible }] });
    const possession = (arg: string) => ({ type: 'givePossession', nature: 'bete', ref: { custom: statblocAvec(arg) } });
    expect(routePerilSchema.safeParse(peril(op({ id: groupe.id }))).success).toBe(true);
    expect(routePerilSchema.safeParse(peril(op({ personnage: 'p' }))).success).toBe(false);
    expect(routePerilSchema.safeParse(peril(possession(groupe.id))).success).toBe(true);
    expect(routePerilSchema.safeParse(peril(possession('@p'))).success).toBe(false);
  });
});

describe('le vivier de l’IA : la pulsion vise l’individu, de tout `kind`', () => {
  const scene = emptyScene('scene-test', 12, 12);
  const input = (enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput => ({
    enemy, heroes, scene, blocked: new Set([...heroes, ...(extra.ciblesDePulsion ?? [])].map((h) => `${h.pos!.x},${h.pos!.y}`)), movement: enemy.movement, spells: [], ...extra,
  });

  it('`ciblesDePulsion` rend les combattants en action visés par une affliction active à pulsion, alliés compris', () => {
    const e = mk('e', 'enemy', { psychState: [{ type: pulsion!.id as PsychType, cible: ciblePsy.individu('allie'), active: true }] });
    const allie = mk('allie', 'enemy');
    const autre = mk('autre', 'enemy');
    expect(ciblesDePulsion(e, [e, allie, autre, mk('h', 'hero')]).map((c) => c.id)).toEqual(['allie']);
    expect(ciblesDePulsion(e, [{ ...allie, dead: true }])).toEqual([]);
    expect(ciblesDePulsion(mk('calme', 'enemy'), [allie])).toEqual([]);
  });

  it('un PNJ s’en prend au combattant de son propre `kind` que vise sa pulsion', () => {
    const e = mk('e', 'enemy', { pos: { x: 5, y: 5 }, psychState: [{ type: pulsion!.id as PsychType, cible: ciblePsy.individu('allie'), active: true }] });
    const heros = mk('h', 'hero', { pos: { x: 5, y: 4 }, wounds: blessuresDeBase(10, 1) });
    const allie = mk('allie', 'enemy', { pos: { x: 5, y: 6 } });
    const action = chooseEnemyAction(input(e, [heros], { ciblesDePulsion: [allie] }));
    const cible = (action as { targetId?: string; thenTargetId?: string }).targetId ?? (action as { thenTargetId?: string }).thenTargetId;
    expect(cible).toBe('allie');
  });
  it('`adversairesDe` : les héros, puis les cibles de pulsion placées, sans doublon', () => {
    const h = mk('h', 'hero', { pos: { x: 1, y: 1 } });
    const allie = mk('allie', 'enemy', { pos: { x: 2, y: 2 } });
    expect(adversairesDe({ heroes: [h], ciblesDePulsion: [allie, h, mk('sans-pos', 'enemy')] }).map((c) => c.id)).toEqual(['h', 'allie']);
  });

  it('`aiApproachPlan` juge la Charge au contact de la cible de pulsion, non du premier héros', () => {
    const characteristics = tableTotale(CHAR_KEYS, () => 30);
    const loin = emptyScene('s', 40, 40);
    const e = mk('e', 'enemy', { characteristics, pos: { x: 5, y: 5 }, psychState: [{ type: pulsion!.id as PsychType, cible: ciblePsy.individu('allie'), active: true }] });
    const allie = mk('allie', 'enemy', { characteristics, pos: { x: 5, y: 12 } });
    const h = mk('h', 'hero', { characteristics, pos: { x: 30, y: 30 } });
    const entree: EnemyTurnInput = { enemy: e, heroes: [h], ciblesDePulsion: [allie], scene: loin, blocked: new Set(['5,12', '30,30']), movement: 4, spells: [] };
    const r = aiApproachPlan(entree, e, chooseEnemyAction(entree), makeRNG(1));
    expect((r.plan as { thenTargetId?: string }).thenTargetId).toBe('allie');
    expect(r.ran).toBeNull();
  });
});

describe('le nom d’un individu, et la Cible persistée', () => {
  it('`nomDIndividu` lit le groupe, puis la bataille, puis les entités de la scène', () => {
    const scene = emptyScene('s', 4, 4);
    scene.entities.push({ id: 'pnj', kind: 'personnage', label: 'Nom de scène', pos: { x: 1, y: 1 }, ref: 'humain' });
    const nom = nomDIndividu({ party: [mk('h', 'hero', { label: 'Héros' })], battle: { combatants: [mk('c', 'enemy', { label: 'Combattant' })] } as never, scene, campaignNarratif: null });
    expect([nom('h'), nom('c'), nom('pnj'), nom('absent')]).toEqual(['Héros', 'Combattant', 'Nom de scène', undefined]);
    expect(libelleDeCible(ciblePsy.individu('pnj'), nom)).toBe('Nom de scène');
  });

  it('une Cible d’individu persistée n’est pas élaguée ; une chaîne qu’aucune Cible ne lit l’est', () => {
    const porteur = { psychTraits: [{ type: mixte!.id, cible: ciblePsy.individu('p') }, { type: mixte!.id, cible: '@' }] };
    expect(sansCiblesPsyInconnues(porteur).psychTraits).toEqual([{ type: mixte!.id, cible: ciblePsy.individu('p') }]);
  });
});
