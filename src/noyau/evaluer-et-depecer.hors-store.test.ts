/**
 * #3612 L2 — UN VERBE GÉNÉRAL PAR GESTE D'OBJET : `evaluerLObjet` évalue un objet porté comme une ligne d'un butin encore
 * en fenêtre (`loot`, `victory`), et chaque refus se dit ; le dépeçage est le choix `victory.depecer`, à l'hôte, parmi
 * les créatures que la victoire ouvre ; `approvisionnerLArme` refuse, et dit, une munition que le porteur de l'arme ne
 * porte pas, sans rien écrire. LDB 59 l.41, LDB 10 l.336, ZI 13.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { Combatant, ItemInstance, Weapon } from '../engine/types';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';
import { createHero } from '../engine/character';
import { emptyScene } from './monde/scene';
import { initialNet, type BattleState } from './etat';
import { gameDay } from './merchantFlow';
import { t } from '../i18n';

let banc: Banc;
const g = () => banc.getState();
const dernier = () => g().journal[g().journal.length - 1];
beforeEach(() => { banc = ouvrirLeBanc(); });

function heros(id: string, p: Partial<Combatant> = {}): Combatant {
  return blessuresSurLeProfil({
    id, label: id.toUpperCase(), kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [{ id: 'evaluation', characteristic: 'intelligence', advances: 10 }], talents: [], fortune: 0, resilience: 0, items: [], pos: { x: 1, y: 1 }, ...p,
  }) as Combatant;
}

const DETECTEUR = { talents: [{ talentId: 'detection-d-artefact', times: 1 }] } as Partial<Combatant>;
/** Une ligne de butin non identifiée, et ce que ses tentatives ont déjà posé. */
const ligne = (uid: string, effet: Record<string, unknown> = {}) => ({ uid, label: 'Épée', magic: true, effect: { type: 'giveTrapping', trappingId: 'epee', identified: false, ...effet } });
const victoire = (over: Record<string, unknown> = {}) => ({ xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, gear: [], defeated: [], harvested: [], ...over });

describe('evaluerLObjet : un verbe pour l’objet porté et la ligne de butin en fenêtre', () => {
  it('une ligne du butin hors combat (`loot`)', () => {
    banc.setState({ party: [heros('a')], pendingLoot: { title: 'Coffre', gear: [ligne('L0')] } } as never);
    g().evaluerLObjet('L0');
    expect(g().pendingAppraise?.gear).toEqual({ scope: 'loot', uid: 'L0' });
  });

  it('une ligne de l’écran de victoire (`victory`)', () => {
    banc.setState({ party: [heros('a')], pendingVictory: victoire({ gear: [ligne('L0')] }) } as never);
    g().evaluerLObjet('L0', 'evaluate');
    expect(g().pendingAppraise?.gear).toEqual({ scope: 'victory', uid: 'L0' });
  });

  it('un objet porté par un héros, hors de toute fenêtre', () => {
    banc.setState({ party: [heros('a', { items: [{ uid: 'anneau', label: 'Anneau', kind: 'misc', qualities: [], enc: 0, equipped: false, identified: false } as ItemInstance] })] });
    g().evaluerLObjet('anneau');
    expect(g().pendingAppraise?.itemUid).toBe('anneau');
  });
});

describe('evaluerLObjet : chaque refus est dit, aucune évaluation ne s’ouvre', () => {
  it('un uid qui ne désigne ni un objet porté ni une ligne en fenêtre', () => {
    banc.setState({ party: [heros('a')], pendingLoot: { title: 'Coffre', gear: [ligne('L0')] } } as never);
    g().evaluerLObjet('L9');
    expect([dernier(), g().pendingAppraise]).toEqual([t('pf.objetSansPorteur'), null]);
  });

  it('la Détection d’une ligne déjà tentée par le seul détecteur (LDB 10 l.336)', () => {
    banc.setState({ party: [heros('a', DETECTEUR)], pendingLoot: { title: 'Coffre', gear: [ligne('L0', { detectTriedBy: ['a'] })] } } as never);
    g().evaluerLObjet('L0', 'detect');
    expect([dernier(), g().pendingAppraise]).toEqual([t('mf.detectDejaTentee', { label: 'Épée' }), null]);
  });

  it('l’Évaluation d’une ligne déjà manquée ce jour (LDB 12 l.94)', () => {
    banc.setState({ party: [heros('a')], pendingLoot: { title: 'Coffre', gear: [ligne('L0', { appraiseTriedDay: gameDay(g()) })] } } as never);
    g().evaluerLObjet('L0');
    expect([dernier(), g().pendingAppraise]).toEqual([t('mf.appraiseSameDay', { label: 'Épée' }), null]);
  });
});

describe('victory.depecer : le dépeçage est un choix de la victoire, à l’hôte (ZI 13)', () => {
  const ecran = () => victoire({ defeated: [{ label: 'Griffon', count: 1, creatureId: 'griffon' }, { label: 'Humain', count: 1, creatureId: 'humain' }] });

  it('l’hôte dépèce une créature que la victoire ouvre', () => {
    banc.setState({ party: [heros('a')], pendingVictory: ecran() } as never);
    g().fenetreChoisir('victory', 'depecer', 'griffon');
    expect(g().pendingVictory?.harvested).toEqual(['griffon']);
  });

  it('un invité est refusé, et le refus se dit', () => {
    banc.setState({ party: [heros('a')], pendingVictory: ecran(), net: { ...initialNet, mode: 'guest' } } as never);
    g().fenetreChoisir('victory', 'depecer', 'griffon');
    expect([dernier(), g().pendingVictory?.harvested]).toEqual([t('choix.refus.hoteSeul'), []]);
  });

  it('une créature hors de l’offre (sans profil de récolte, ou déjà dépecée) est refusée, et le refus se dit', () => {
    banc.setState({ party: [heros('a')], pendingVictory: { ...ecran(), harvested: ['griffon'] } } as never);
    g().fenetreChoisir('victory', 'depecer', 'humain');
    expect([dernier(), g().pendingVictory?.harvested]).toEqual([t('choix.refus.valeur'), ['griffon']]);
    g().fenetreChoisir('victory', 'depecer', 'griffon');
    expect([dernier(), g().pendingVictory?.harvested]).toEqual([t('choix.refus.valeur'), ['griffon']]);
  });
});

describe('approvisionnerLArme : une munition que le porteur de l’arme ne porte pas est refusée, et dite, sans écriture', () => {
  const ranged = (c: Combatant): Weapon => c.weapons.find((w) => w.type === 'ranged')!;
  function archer() {
    const H = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    H.weapons = [{ uid: 'w-arb', label: 'Arbalète', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 60, qualities: [{ id: 'recharge', value: 1 }], subType: 'Arbalète', reload: 1 }];
    H.items = [{ uid: 'am1', label: 'Carreau', kind: 'ammo', qualities: [], enc: 0, equipped: false, subType: 'Arbalète', qty: 2 } as ItemInstance];
    ranged(H).ammoUid = 'am1';
    H.pos = { x: 0, y: 0 };
    const E: Combatant = JSON.parse(JSON.stringify(H));
    Object.assign(E, { id: 'enemy-0', label: 'Cible', kind: 'enemy', pos: { x: 4, y: 0 } });
    E.items = [{ uid: 'am-e', label: 'Carreau perçant', kind: 'ammo', qualities: [], enc: 0, equipped: false, subType: 'Arbalète', qty: 3 } as ItemInstance];
    const battle: BattleState = {
      combatants: [H, E], order: [H.id, E.id], turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 99, movedPreAction: false, acted: false, log: [], over: null,
    };
    banc.setState({ party: [H], mode: 'battle', battle, scene: emptyScene('scene-test', 8, 8) });
    return H;
  }

  it.each([['la munition d’un autre combattant', 'am-e'], ['un id que rien ne porte', 'id-etranger']])('%s', (_cas, uid) => {
    const H = archer();
    g().approvisionnerLArme(uid);
    const h = g().battle!.combatants.find((c) => c.id === H.id)!;
    expect([g().refus?.texte, ranged(h).ammoUid]).toEqual([t('offre.sansCandidatDuContexte'), 'am1']);
  });
});
