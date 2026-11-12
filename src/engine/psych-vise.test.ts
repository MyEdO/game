/**
 * `vise` : le seul prédicat de ciblage d'un Trait psy, et la lecture que chaque lecteur en fait (#3045).
 * Ce qui DÉCLENCHE lit ce que l'observateur PERÇOIT ; ce qui S'APPLIQUE à un membre lit son APPARTENANCE.
 * Fiches fabriquées ; les entrées de donnée sont choisies par leur forme, jamais par leur nom.
 */
import { describe, it, expect } from 'vitest';
import {
  vise, sousPeur, indiceDePeur, isAfflictionActive, targetedTrigger, targetCausedSourcesFor, psychImmuneToFrom,
  refreshDefendedPsych, sansPeurVs, sourceCombattant, type PsychAffliction, type PsychType,
} from './psychology';
import { psychDRAdjust } from './combat';
import { ciblePsy } from './psych/ciblage';
import { buildActorView } from './actorView';
import { socialPsychMod } from './skills';
import { groups, psychologies, talents, traits } from '../data';
import type { Combatant } from './types';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

const mk = (id: string, o: Partial<Combatant> = {}): Combatant => (blessuresSurLeProfil({
  id, label: id, kind: 'ennemi', advantage: 0, conditions: [], characteristics: {} as never, psychState: [], psychTraits: [],
  groups: [], weapons: [], armour: {} as never, skills: [], talents: [], movement: 4, wounds: blessuresDeBase(10), ...o,
}) as Combatant);

/** Un Trait qui confère un Groupe, porté DISSIMULÉ ou non. */
const traitAGroupe = traits.find((t) => t.capabilities?.grantGroups?.length);
const groupeDuTrait = traitAGroupe?.capabilities?.grantGroups?.[0] ?? '';
const porteur = (id: string, cache: boolean): Combatant => mk(id, { traits: [{ id: traitAGroupe!.id, ...(cache ? { hidden: true } : {}) }] });

/** Le porteur du Trait qui vise : ni lié, ni Engagé, sans Race. */
const OBS = mk('obs');

const entree = (pred: (p: (typeof psychologies)[number]) => boolean) => psychologies.find(pred);

describe('vise — un prédicat, deux lectures (#3045)', () => {
  it('précondition : un Trait de la donnée confère un Groupe', () => {
    expect(traitAGroupe).toBeDefined();
    expect(groupeDuTrait).not.toBe('');
  });

  it('un Groupe CACHÉ appartient au porteur sans être perçu', () => {
    const cache = sourceCombattant(porteur('p', true));
    expect(vise(ciblePsy.groupe(groupeDuTrait), cache, 'appartenance', OBS)).toBe(true);
    expect(vise(ciblePsy.groupe(groupeDuTrait), cache, 'percu', OBS)).toBe(false);
    const visible = sourceCombattant(porteur('p', false));
    expect(vise(ciblePsy.groupe(groupeDuTrait), visible, 'percu', OBS)).toBe(true);
  });

  it('un interlocuteur n’a que les Groupes que le Test lui décrit : les deux lectures s’y confondent', () => {
    const s = { genre: 'interlocuteur', groups: [groupeDuTrait] } as const;
    expect(vise(ciblePsy.groupe(groupeDuTrait), s, 'percu', OBS)).toBe(true);
    expect(vise(ciblePsy.groupe(groupeDuTrait), s, 'appartenance', OBS)).toBe(true);
    expect(vise(ciblePsy.groupe(groupeDuTrait), { genre: 'interlocuteur', groups: [] }, 'percu', OBS)).toBe(false);
  });

  it('un Groupe joker se résout par `groupMatch`, pour toute source', () => {
    const joker = groups.find((g) => g.matchesAll && !g.exceptGroups?.length);
    expect(joker).toBeDefined();
    expect(vise(ciblePsy.groupe(joker!.id), { genre: 'interlocuteur', groups: [] }, 'percu', OBS)).toBe(true);
    expect(vise(ciblePsy.groupe(joker!.id), sourceCombattant(mk('x')), 'appartenance', OBS)).toBe(true);
  });
});

describe('vise — l’étiquette d’un lieu (`Scene.groups`), source sans personne (#3045)', () => {
  const ordinaire = groups.find((g) => !g.matchesAll && !g.relatif && !g.inclut);
  const composite = groups.find((g) => g.inclut?.length);
  const etiquette = (porte: readonly string[]) => ({ genre: 'etiquette', id: 'lieu', label: 'Lieu', groups: porte }) as const;

  it('précondition : la donnée porte un Groupe ordinaire, un composite, un joker et un relatif', () => {
    expect([ordinaire, composite, groups.find((g) => g.matchesAll), groups.find((g) => g.relatif)].every(Boolean)).toBe(true);
  });

  it('visée par le Groupe qu’elle porte, et par un composite qui l’inclut, quelle que soit la lecture', () => {
    for (const lecture of ['appartenance', 'percu'] as const) {
      expect(vise(ciblePsy.groupe(ordinaire!.id), etiquette([ordinaire!.id]), lecture, OBS)).toBe(true);
      expect(vise(ciblePsy.groupe(composite!.id), etiquette([composite!.inclut![0]]), lecture, OBS)).toBe(true);
      expect(vise(ciblePsy.groupe(ordinaire!.id), etiquette([]), lecture, OBS)).toBe(false);
    }
  });

  it('refusée par chaque joker et chaque Groupe relatif', () => {
    for (const g of groups.filter((x) => x.matchesAll || x.relatif))
      for (const lecture of ['appartenance', 'percu'] as const)
        expect(vise(ciblePsy.groupe(g.id), etiquette([ordinaire!.id]), lecture, OBS), `${g.id} (${lecture})`).toBe(false);
  });

  it('jamais visée par un individu, fût-ce par son id', () => {
    expect(vise(ciblePsy.individu('lieu'), etiquette([ordinaire!.id]), 'percu', OBS)).toBe(false);
  });
});

describe('les lecteurs : déclencher lit le perçu, s’appliquer lit l’appartenance', () => {
  it('déclenchement d’un Trait ciblé (LDB 21 l.9) : un membre caché ne déclenche pas', () => {
    const d = entree((p) => !!p.cibles && !p.targetCauses && p.triggerOn !== 'threatened');
    expect(d).toBeDefined();
    const obs = mk('o', { psychTraits: [{ type: d!.id as PsychType, cible: ciblePsy.groupe(groupeDuTrait) }] });
    expect(targetedTrigger(obs, [sourceCombattant(porteur('p', true))])).toBeNull();
    expect(targetedTrigger(obs, [sourceCombattant(porteur('p', false))])?.sourceId).toBe('p');
  });

  it('objet d’une Phobie en combat (LDB 21 l.87) : seul ce que l’on voit est une source de Peur', () => {
    const d = entree((p) => !!p.targetCauses);
    expect(d).toBeDefined();
    const obs = mk('o', { psychTraits: [{ type: d!.id as PsychType, cible: ciblePsy.groupe(groupeDuTrait), indice: 1 }] });
    expect(targetCausedSourcesFor(obs, sourceCombattant(porteur('p', true)))).toEqual([]);
    expect(targetCausedSourcesFor(obs, sourceCombattant(porteur('p', false)))).not.toEqual([]);
  });

  it('+DR contre le groupe (LDB 21 l.41) : par appartenance, même caché', () => {
    const d = entree((p) => p.attackDR?.vs === 'group');
    expect(d).toBeDefined();
    const att = mk('a', { psychState: [{ type: d!.id as PsychType, cible: ciblePsy.groupe(groupeDuTrait), active: true }] });
    expect(psychDRAdjust(att, porteur('p', true))).toBe(d!.attackDR!.amount);
    expect(psychDRAdjust(att, mk('q'))).toBe(0);
  });

  it('immunité « causée par ceux de ce groupe » (LDB 21 l.41) : par appartenance, même caché', () => {
    const d = entree((p) => !!p.immuneToFromTarget?.length);
    expect(d).toBeDefined();
    const canal = d!.immuneToFromTarget![0];
    const self = mk('s', { psychState: [{ type: d!.id as PsychType, cible: ciblePsy.groupe(groupeDuTrait), active: true }] });
    expect(psychImmuneToFrom(self, sourceCombattant(porteur('p', true)), canal)).toBe(true);
    expect(psychImmuneToFrom(self, sourceCombattant(mk('q')), canal)).toBe(false);
  });

  it('défendre les êtres aimés (LDB 21 l.75) : un aimé caché reste à défendre', () => {
    const d = entree((p) => !!p.immuneWhileActive?.length);
    expect(d).toBeDefined();
    const self = mk('s', { psychState: [{ type: d!.id as PsychType, cible: ciblePsy.groupe(groupeDuTrait), active: true }] });
    expect(refreshDefendedPsych(self, [self, porteur('p', true)])).toBe(false);
    expect(self.psychState![0].active).toBe(true);
    expect(refreshDefendedPsych(self, [self])).toBe(true);
  });

  it('Sans Peur (Ennemi) face à l’ennemi RENCONTRÉ (LDB 10 l.1051) : un membre caché n’ouvre pas le Test allégé', () => {
    const talent = talents.find((t) => t.combat?.fearImmune);
    expect(talent).toBeDefined();
    const brave = mk('b', { talents: [{ talentId: talent!.id, spec: groupeDuTrait, times: 1 }] });
    expect(sansPeurVs(brave, sourceCombattant(porteur('p', false)))).toBe(true);
    expect(sansPeurVs(brave, sourceCombattant(porteur('p', true)))).toBe(false);
    expect(sansPeurVs(brave, sourceCombattant(mk('q')))).toBe(false);
  });

  it('malus social « contenu » (LDB 21 l.19, l.48) : contre les Groupes que le Test décrit', () => {
    const d = entree((p) => p.containedSocialMod != null);
    expect(d).toBeDefined();
    const tester = mk('t', { psychTraits: [{ type: d!.id as PsychType, cible: ciblePsy.groupe(groupeDuTrait) }] });
    expect(socialPsychMod(tester, [groupeDuTrait])).toBe(d!.containedSocialMod);
    expect(socialPsychMod(tester, [])).toBe(0);
  });
});

describe('sousPeur : une seule définition, aucun défaut d’Indice (LDB 21 l.25)', () => {
  const peur = (o: Partial<PsychAffliction>): PsychAffliction => ({ type: 'peur', sourceId: 'x', ...o });

  it('sujet à la Peur tant qu’elle n’est pas surmontée, quel que soit l’Indice', () => {
    expect(sousPeur(peur({ indice: 0 }))).toBe(true);
    expect(sousPeur(peur({}))).toBe(true);
    expect(sousPeur(peur({ indice: 2, calmeDR: 1 }))).toBe(true);
    expect(sousPeur(peur({ indice: 2, calmeDR: 0, surmontee: true }))).toBe(false);
  });

  it('l’activité d’une Peur est `sousPeur` ; une autre affliction n’est pas « sous Peur »', () => {
    for (const p of [peur({ indice: 0 }), peur({ indice: 3, surmontee: true })]) expect(isAfflictionActive(p)).toBe(sousPeur(p));
    expect(sousPeur({ type: 'haine', cible: ciblePsy.groupe(groupeDuTrait), active: true })).toBe(false);
  });

  it('la vue d’acteur des Conditions ne compte une Peur que sous `sousPeur`', () => {
    const vue = (psychState: PsychAffliction[]) => buildActorView(mk('v', { psychState }))!.psych;
    expect(vue([peur({ indice: 1 })])).toEqual(['peur']);
    expect(vue([peur({ indice: 1, surmontee: true })])).toEqual([]);
  });

  it('`indiceDePeur` est le seul lecteur de l’Indice : une Peur sans Indice vaut le plancher du Test étendu', () => {
    expect(indiceDePeur(peur({ indice: 3 }))).toBe(3);
    expect(indiceDePeur(peur({}))).toBe(0);
  });
});
