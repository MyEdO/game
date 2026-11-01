/**
 * LES GATES DU CATALOGUE D'ACTIVITÉS, sans store (#3059 S5) : une Activité dont la cible manque ou sort de sa
 * liste (objet à tester, arme inhabituelle, sort, Trait psychologique), dont la réussite n'aurait rien à
 * changer (Pénitence sans Péché), qui ne s'ouvre pas par le catalogue (Entraînement), une Faveur Importante,
 * une préparation de bataille déjà faite ou un retrait de Mécénat hors d'Altdorf sont refusés, ET le disent ;
 * aucune Activité consommée, aucun jet en attente. Aucune Activité d'interlude n'est MUETTE.
 * ACE 12 l.13-55, ADE II 09 l.33, LDB 23 l.147-151, ADE II 8 l.67
 */
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { draineCascade } from './cascade.testkit';
import { emptyScene } from './monde/scene';
import { createHero } from '../engine/character';
import { withBourseMoney } from '../engine/bourse';
import { ACTIVITIES } from '../engine/activities';
import { learnableSpells } from '../engine/grimoire';
import { spells } from '../data';
import { refusDeRetrait, refusDOuvertureDActivite } from './verdictsDInterlude';
import type { Combatant, ItemInstance } from '../engine/types';
import type { Favor } from '../engine/favor';
import type { PsychTrait } from '../engine/psychology';
import { ciblePsy } from '../engine/psych/ciblage';
import { applyOps } from '../engine/ops';
import { makeRNG } from '../engine/dice';
import type { WorldMap } from './worldMap';

const SCENE = { ...emptyScene('altdorf-centre', 2, 2), label: 'Altdorf', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] };
const carte = (lieu: string): WorldMap => ({ id: 'w', label: 'Monde', places: [{ id: lieu, label: lieu, pos: { x: 0, y: 0 }, scene: SCENE.id }], routes: [] });

/** Une armure qui se dit « inhabituelle » : la donnée le permet à tout objet, la maîtrise ne vise que les armes. */
const ARMURE_INHABITUELLE = { uid: 'armure-1', trappingId: 'armure-etrange', label: 'Armure étrange', kind: 'armour', qualities: [], enc: 0, equipped: false, requiresMastery: true } as unknown as ItemInstance;
const COUTEAU_DE_HARALD = { uid: 'arme-1', trappingId: 'couteau-de-harald', label: 'Couteau de Harald', kind: 'melee', qualities: [], enc: 0, equipped: false, requiresMastery: true } as unknown as ItemInstance;
const AMULETTE = { uid: 'art-1', label: 'Amulette étrange', kind: 'trapping', qualities: [], enc: 0, equipped: false, identified: false } as unknown as ItemInstance;

interface Fiche { items?: ItemInstance[]; psychTraits?: PsychTrait[]; magie?: { talent: string; spec: string; sorts: string[] }; competences?: Combatant['skills'] }

/** Un banc au lieu `lieu` (Altdorf par défaut), dés d'Événement posés, dont le Vétéran porte `fiche` et doit `favors`. */
function auLieu(fiche: Fiche = {}, favors: (heroId: string) => Favor[] = () => [], lieu = 'altdorf'): { banc: Banc; heroId: string } {
  const h = withBourseMoney(createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Vétéran', seed: 1601 }), { gold: 20, silver: 0, brass: 0 });
  h.items = [...(h.items ?? []), ...(fiche.items ?? [])];
  if (fiche.psychTraits) h.psychTraits = fiche.psychTraits;
  h.skills.push(...(fiche.competences ?? []));
  if (fiche.magie) {
    h.talents.push({ talentId: fiche.magie.talent, spec: fiche.magie.spec, times: 1 } as never);
    h.spells = fiche.magie.sorts;
  }
  const banc = ouvrirLeBanc({ graine: 7, desFixes: false, etat: { party: [h], scene: SCENE, worldMap: carte(lieu), favors: favors(h.id) } });
  banc.actions.startInterlude(3);
  draineCascade(banc.getState);
  expect(banc.getState().interlude?.phase, 'témoin : le tirage est dénoué').toBe('activities');
  expect(banc.getState().interlude?.perHero[h.id].left, 'témoin : une Activité reste').toBeGreaterThan(0);
  return { banc, heroId: h.id };
}

/** L'empreinte de ce qu'un geste refusé ne doit pas changer. */
const empreinte = (banc: Banc) => {
  const s = banc.getState();
  return JSON.stringify([s.interlude, s.pendingActivity, s.favors, s.bank, s.massBattle?.activitiesDone, s.party.map((h) => [h.items, h.sinPoints, h.psychTraits])]);
};

/** Joue `geste`, vérifie que rien n'a changé ni n'attend : les lignes qu'il a dites. */
function refuse(banc: Banc, geste: () => void): string[] {
  const avant = empreinte(banc);
  const journal = banc.getState().journal.length;
  geste();
  expect(empreinte(banc), 'Activité consommée, jet en attente ou fiche changée').toBe(avant);
  expect(banc.getState().pendingActivity).toBeNull();
  return banc.getState().journal.slice(journal);
}

const heros = (banc: Banc, heroId: string): Combatant => banc.getState().party.find((h) => h.id === heroId)!;

/** Lance le jet ouvert, le pose (`success`, `sl`), puis le confirme. */
function confirmer(banc: Banc, success: boolean, sl: number): void {
  banc.actions.activityRoll();
  banc.setState((s) => ({ pendingActivity: { ...s.pendingActivity!, roll: success ? 10 : 95, success, sl } }));
  banc.actions.activityConfirm();
}

describe('Catalogue — aucune Activité d’interlude n’est muette', () => {
  const INTERLUDE = ACTIVITIES.filter((d) => d.contexts.includes('interlude'));
  it.each(INTERLUDE.map((d) => [d.id, d] as const))('%s : ouverte comme le verdict le dit, ou refusée par sa raison, sans Activité consommée', (_id, def) => {
    const { banc, heroId } = auLieu();
    const verdict = refusDOuvertureDActivite(banc.getState(), heroId, def);
    const left = banc.getState().interlude!.perHero[heroId].left;
    const journal = banc.getState().journal.length;
    banc.actions.interludeActivity(heroId, def.id);
    const s = banc.getState();
    expect(s.interlude!.perHero[heroId].left, 'ouvrir ne consomme rien').toBe(left);
    if (verdict == null) expect(s.pendingActivity?.activityId, 'le verdict ouvre, le geste ouvre').toBe(def.id);
    else {
      expect(s.pendingActivity, 'le verdict refuse, le geste refuse').toBeNull();
      expect(s.journal.slice(journal)).toEqual([verdict]);
    }
  });
});

describe('Catalogue — cible absente ou hors de sa liste', () => {
  it('Entraînement par le catalogue : refusé et dit (il s’entreprend par son volet)', () => {
    const { banc, heroId } = auLieu();
    expect(refuse(banc, () => banc.actions.interludeActivity(heroId, 'entrainement')))
      .toEqual(['Entraînement ne s’entreprend pas depuis le catalogue d’Activités, mais par son volet dédié.']);
  });

  it('Tester des objets magiques sans objet non identifié : refusé et dit', () => {
    const { banc, heroId } = auLieu();
    expect(refuse(banc, () => banc.actions.interludeActivity(heroId, 'tester-objets-magiques'))).toEqual(['Aucun objet non identifié dans le sac de Vétéran.']);
  });

  it('Tester des objets magiques sur un objet hors de la liste : refusé et dit', () => {
    const { banc, heroId } = auLieu({ items: [AMULETTE, COUTEAU_DE_HARALD] });
    expect(refuse(banc, () => banc.actions.interludeActivity(heroId, 'tester-objets-magiques', { itemUid: 'arme-1' })))
      .toEqual(['Vétéran : choisir un objet non identifié du sac.']);
  });

  it('maîtrise d’un objet qui n’est pas une arme : aucune arme à maîtriser, refusé et dit', () => {
    const { banc, heroId } = auLieu({ items: [ARMURE_INHABITUELLE] });
    expect(refuse(banc, () => banc.actions.interludeActivity(heroId, 'entrainement-arme-inhabituelle', { itemUid: 'armure-1' })))
      .toEqual(['Aucune arme inhabituelle à maîtriser dans le sac de Vétéran.']);
  });

  it('maîtrise visant l’armure quand une arme est à maîtriser : refusé et dit', () => {
    const { banc, heroId } = auLieu({ items: [COUTEAU_DE_HARALD, ARMURE_INHABITUELLE] });
    expect(refuse(banc, () => banc.actions.interludeActivity(heroId, 'entrainement-arme-inhabituelle', { itemUid: 'armure-1' })))
      .toEqual(['Vétéran : choisir une arme inhabituelle non maîtrisée du sac.']);
  });

  it('Recherche universitaire sans sort payant à mémoriser : refusé et dit', () => {
    const { banc, heroId } = auLieu();
    expect(refuse(banc, () => banc.actions.interludeActivity(heroId, 'recherche-universitaire')))
      .toEqual(['Vétéran n’a aucun sort à mémoriser (Talent de lanceur et sort payant requis).']);
  });

  it('Recherche universitaire sur un sort hors de la liste : refusé et dit', () => {
    const feu = spells.filter((sp) => sp.family === 'arcane' && sp.subType === 'Feu').map((sp) => sp.id);
    const { banc, heroId } = auLieu({ magie: { talent: 'magie-des-arcanes', spec: 'feu', sorts: feu.slice(0, 4) } });
    expect(learnableSpells(heros(banc, heroId)).some((x) => x.cost > 0), 'témoin : un sort payant est à mémoriser').toBe(true);
    expect(refuse(banc, () => banc.actions.interludeActivity(heroId, 'recherche-universitaire', { spellId: 'sort-inexistant' })))
      .toEqual(['Vétéran : choisir un sort payant à mémoriser.']);
  });
});

describe('Catalogue — réussite sans objet', () => {
  it('Pénitence sans Point de Péché : refusée et dite', () => {
    const { banc, heroId } = auLieu({ competences: [{ id: 'priere', characteristic: 'sociabilite', advances: 5 }] as Combatant['skills'] });
    expect(refuse(banc, () => banc.actions.interludeActivity(heroId, 'penitence')))
      .toEqual(['Vétéran n’a aucun Point de Péché à expier. Pénitence ne lui apporterait rien en cas de réussite.']);
  });
});

describe('Convalescence — le Trait psychologique est une cible choisie (ADE II 09 l.33)', () => {
  const TRAITS: PsychTrait[] = [{ type: 'frenesie' }, { type: 'peur' }];

  it('sans Trait psychologique : refusée et dite', () => {
    const { banc, heroId } = auLieu();
    expect(refuse(banc, () => banc.actions.interludeActivity(heroId, 'convalescence'))).toEqual(['Vétéran n’a aucun Trait psychologique à éliminer.']);
  });

  it('Trait non porté : refusée et dite', () => {
    const { banc, heroId } = auLieu({ psychTraits: TRAITS });
    expect(refuse(banc, () => banc.actions.interludeActivity(heroId, 'convalescence', { traitPsy: { type: 'haine' } })))
      .toEqual(['Vétéran : choisir un Trait psychologique porté.']);
  });

  it('réussite : élimine le Trait CHOISI, pas le premier porté', () => {
    const { banc, heroId } = auLieu({ psychTraits: TRAITS });
    banc.actions.interludeActivity(heroId, 'convalescence', { traitPsy: { type: 'peur' } });
    expect(banc.getState().pendingActivity?.activityId, 'témoin : le jet s’ouvre').toBe('convalescence');
    confirmer(banc, true, 1);
    expect(heros(banc, heroId).psychTraits).toEqual([{ type: 'frenesie' }]);
  });

  it('deux Haines à Cibles différentes : le joueur choisit l’INSTANCE, la Haine (Elfe) part, la Haine (Nain) reste', () => {
    const haines: PsychTrait[] = [{ type: 'haine', cible: ciblePsy.groupe('nain') }, { type: 'haine', cible: ciblePsy.groupe('elfe') }];
    const { banc, heroId } = auLieu({ psychTraits: haines });
    banc.actions.interludeActivity(heroId, 'convalescence', { traitPsy: { type: 'haine', cible: { id: 'elfe' } } });
    expect(banc.getState().pendingActivity?.activityId, 'témoin : le jet s’ouvre').toBe('convalescence');
    confirmer(banc, true, 1);
    expect(heros(banc, heroId).psychTraits).toEqual([{ type: 'haine', cible: 'nain' }]);
  });

  it('Trait choisi disparu avant la confirmation : la réussite ne retire AUCUN autre Trait, et le dit', () => {
    const { banc, heroId } = auLieu({ psychTraits: TRAITS });
    banc.actions.interludeActivity(heroId, 'convalescence', { traitPsy: { type: 'peur' } });
    expect(banc.getState().pendingActivity?.activityId, 'témoin : le jet s’ouvre').toBe('convalescence');
    const h = heros(banc, heroId);
    applyOps(h, [{ op: 'removePsychTrait', psychType: { id: 'peur' } }], { rng: makeRNG(1) }); // la Peur part entre l'ouverture et la confirmation
    banc.setState((s) => ({ party: [...s.party] }));
    const avant = banc.getState().journal.length;
    confirmer(banc, true, 1);
    expect(heros(banc, heroId).psychTraits, 'la Frénésie, non choisie, reste').toEqual([{ type: 'frenesie' }]);
    expect(banc.getState().journal.slice(avant)).toContain("Vétéran n'a aucun Trait psychologique à retirer.");
  });

  it('échec : la fiche du héros reste telle quelle, l’Activité est consommée', () => {
    const { banc, heroId } = auLieu({ psychTraits: TRAITS });
    banc.actions.interludeActivity(heroId, 'convalescence', { traitPsy: { type: 'peur' } });
    const avant = heros(banc, heroId);
    const fiche = JSON.stringify([avant.psychTraits, avant.activeEffects]);
    const left = banc.getState().interlude!.perHero[heroId].left;
    confirmer(banc, false, -2);
    const h = heros(banc, heroId);
    expect(JSON.stringify([h.psychTraits, h.activeEffects])).toBe(fiche);
    expect(banc.getState().interlude!.perHero[heroId].left).toBe(left - 1);
  });
});

describe('Faveur Importante', () => {
  it('ne s’acquitte pas par une Activité : refusée et dite, Faveur et Activité intactes', () => {
    const { banc, heroId } = auLieu({}, (id) => [{ id: 'favor-1', heroId: id, level: 'importante', owedTo: 'Un comte', desc: 'Un service', progress: 0 }]);
    expect(refuse(banc, () => banc.actions.favorSettle(heroId, 'favor-1')))
      .toEqual(['Une Faveur Importante ne s’acquitte pas par des Activités : elle se joue en aventure.']);
  });
});

describe('Préparation de bataille', () => {
  it('déjà faite : refusée et dite, rien en attente', () => {
    const { banc, heroId } = auLieu();
    banc.actions.startMassBattle({ allyMight: 50, enemyMight: 55, plannedRounds: 3 });
    banc.actions.massBattleActivity('inspire', heroId);
    expect(banc.getState().pendingActivity?.activityId, 'témoin : le Discours s’ouvre').toBe('inspire');
    banc.setState((s) => ({ pendingActivity: { ...s.pendingActivity!, roll: 20, success: true, sl: 2 } }));
    banc.actions.activityConfirm();
    expect(banc.getState().massBattle?.activitiesDone, 'témoin : le Discours est fait').toContain('inspire');
    expect(refuse(banc, () => banc.actions.massBattleActivity('inspire', heroId))).toEqual(['Déjà réalisée cette bataille (Activité non répétable).']);
  });
});

describe('Mécénat — le retrait s’ouvre comme son Activité (ACE 12 l.47-49)', () => {
  it('hors d’Altdorf : l’écran et le geste disent le même refus, rien n’est soldé', () => {
    const { banc, heroId } = auLieu();
    banc.actions.interludeBank(heroId, 'mecenat', 1200);
    expect(banc.getState().bank.map((d) => d.kind), 'témoin : le dépôt de Mécénat est fait à Altdorf').toEqual(['mecenat']);
    banc.setState(() => ({ worldMap: carte('ubersreik') }));
    const ecran = refusDeRetrait(banc.getState(), 0);
    expect(ecran).toBe('Mécénat n\'est praticable qu\'en un lieu précis — pas ici.');
    expect(refuse(banc, () => banc.actions.interludeWithdraw(0))).toEqual([ecran]);
  });
});
