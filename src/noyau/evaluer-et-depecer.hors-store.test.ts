/**
 * #3612 L2 — UN VERBE GÉNÉRAL PAR GESTE D'OBJET : `evaluerLObjet` évalue un objet porté comme une ligne d'un butin encore
 * en fenêtre (`butin`, `victoire`), et chaque refus se dit ; le dépeçage est le choix `victoire.depecer`, à l'hôte, parmi
 * les créatures que la victoire ouvre ; `approvisionnerLArme` refuse, et dit, une munition que le porteur de l'arme ne
 * porte pas, sans rien écrire. LDB 59 l.41, LDB 10 l.336, ZI 13.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resetRule, setRule } from '../engine/policy';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { Combatant, ItemInstance, Weapon } from '../engine/types';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';
import { createHero } from '../engine/character';
import { emptyScene } from './monde/scene';
import { initialNet, type BattleState } from './etat';
import { appraiseRefus, gameDay } from './merchantFlow';
import { reglageDuChoixDeFenetre } from './choixDeFenetre';
import { fenetreDuButin } from './fenetreDuButin';
import { intentAllowedFor } from './netOwnership';
import { appliquerLIntentionDUnSiege } from './intentionsDeSiege';
import { t } from '../i18n';
import { findCreatureById } from '../data';

let banc: Banc;
const g = () => banc.getState();
const dernier = () => g().journal[g().journal.length - 1];
beforeEach(() => { banc = ouvrirLeBanc(); });

function heros(id: string, p: Partial<Combatant> = {}): Combatant {
  return blessuresSurLeProfil({
    id, label: id.toUpperCase(), kind: 'heros',
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
  it('une ligne du butin hors combat (`butin`)', () => {
    banc.setState({ party: [heros('a')], pendingLoot: { title: 'Coffre', gear: [ligne('L0')] } } as never);
    g().evaluerLObjet('L0');
    expect(g().pendingAppraise?.gear).toEqual({ scope: 'butin', uid: 'L0' });
  });

  it('une ligne de l’écran de victoire (`victoire`)', () => {
    banc.setState({ party: [heros('a')], pendingVictory: victoire({ gear: [ligne('L0')] }) } as never);
    g().evaluerLObjet('L0', 'evaluation');
    expect(g().pendingAppraise?.gear).toEqual({ scope: 'victoire', uid: 'L0' });
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
    g().evaluerLObjet('L0', 'detection');
    expect([dernier(), g().pendingAppraise]).toEqual([t('mf.detectionDejaTentee', { label: 'Épée' }), null]);
  });

  it('l’Évaluation d’une ligne manquée ce jour, tant que court le délai maison (`marche-evaluation-delai-jours`)', () => {
    banc.setState({ party: [heros('a')], pendingLoot: { title: 'Coffre', gear: [ligne('L0', { appraiseTriedDay: gameDay(g()) })] } } as never);
    g().evaluerLObjet('L0');
    expect([dernier(), g().pendingAppraise]).toEqual([t('mf.evaluationARetenter', { label: 'Épée', jours: 1 }), null]);
  });
});

describe('après un échec d’Évaluation : nouvel essai à DR 0 (LDB 12 l.94), délai maison à DR négatif', () => {
  /** Évalue la ligne `L0` du butin, et valide le jet à `sl`, raté. */
  function manquer(sl: number) {
    banc.setState({ party: [heros('a')], pendingLoot: { title: 'Coffre', gear: [ligne('L0')] } } as never);
    g().evaluerLObjet('L0');
    banc.setState({ pendingAppraise: { ...g().pendingAppraise!, roll: 95, success: false, sl } });
    g().jetValider('evaluation');
  }
  const retenter = () => { g().evaluerLObjet('L0'); const ouverte = !!g().pendingAppraise; banc.setState({ pendingAppraise: null }); return ouverte; };
  afterEach(() => resetRule('marche-evaluation-delai-jours'));

  it('DR négatif : refusé jusqu’au lendemain, puis ouvert', () => {
    manquer(-2);
    expect([retenter(), dernier()]).toEqual([false, t('mf.evaluationARetenter', { label: 'Épée', jours: 1 })]);
    g().avancerLeTemps(24 * 60);
    expect(retenter()).toBe(true);
  });

  it('DR 0 : un nouvel essai, aussitôt', () => {
    manquer(0);
    expect(retenter()).toBe(true);
  });

  it('le délai se règle : 3 jours', () => {
    setRule('marche-evaluation-delai-jours', 3);
    manquer(-1);
    g().avancerLeTemps(24 * 60);
    expect([retenter(), dernier()]).toEqual([false, t('mf.evaluationARetenter', { label: 'Épée', jours: 2 })]);
    g().avancerLeTemps(2 * 24 * 60);
    expect(retenter()).toBe(true);
  });
});

describe('victory.depecer : le dépeçage est un choix de la victoire, à l’hôte (ZI 13)', () => {
  const ecran = () => victoire({ defeated: [{ label: 'Griffon', count: 1, creatureId: 'griffon' }, { label: 'Humain', count: 1, creatureId: 'humain' }] });

  it('l’hôte dépèce une créature que la victoire ouvre', () => {
    banc.setState({ party: [heros('a')], pendingVictory: ecran() } as never);
    g().fenetreChoisir('victoire', 'depecer', 'griffon');
    expect(g().pendingVictory?.harvested).toEqual(['griffon']);
  });

  it('dans l’état d’un invité, le choix est refusé, et le refus se dit', () => {
    banc.setState({ party: [heros('a')], pendingVictory: ecran() } as never);
    banc.setState({ net: { ...initialNet(), mode: 'invite' } });
    g().fenetreChoisir('victoire', 'depecer', 'griffon');
    expect([dernier(), g().pendingVictory?.harvested]).toEqual([t('choix.refus.hoteSeul'), []]);
  });

  it('une créature sans profil de récolte est hors de l’offre : refusée, et le refus se dit', () => {
    banc.setState({ party: [heros('a')], pendingVictory: ecran() } as never);
    g().fenetreChoisir('victoire', 'depecer', 'humain');
    expect([dernier(), g().pendingVictory?.harvested]).toEqual([t('choix.refus.valeur'), []]);
  });

  it('une créature déjà dépecée reste offerte, refusée avec sa raison, et le refus se dit', () => {
    banc.setState({ party: [heros('a')], pendingVictory: { ...ecran(), harvested: ['griffon'] } } as never);
    expect(reglageDuChoixDeFenetre(g(), 'victoire', 'depecer').valeurs).toEqual([{ valeur: 'griffon', libelle: 'Griffon', refus: t('eff.dejaDepecee') }]);
    g().fenetreChoisir('victoire', 'depecer', 'griffon');
    expect([dernier(), g().pendingVictory?.harvested]).toEqual([t('eff.dejaDepecee'), ['griffon']]);
  });
});

describe('victory.depecer : la récolte suit le DR du jet, et le récolteur sa meilleure Compétence admise (ZI 13 l.316)', () => {
  /** Dépèce `creatureId`, puis valide le jet ouvert à `roll` contre `target` : les pièces que reçoit la fenêtre du butin. */
  function recolter(creatureId: string, roll: number, target: number, h: Combatant = heros('a', { skills: [{ id: 'savoir', spec: 'betes-sauvages', characteristic: 'intelligence', advances: 10 }] as never })) {
    banc.setState({ party: [h], pendingVictory: victoire({ defeated: [{ label: 'X', count: 1, creatureId }] }) } as never);
    g().fenetreChoisir('victoire', 'depecer', creatureId);
    const pt = g().pendingTest!;
    const sl = Math.floor(target / 10) - Math.floor(roll / 10);
    banc.setState({ pendingTest: { ...pt, roll, target, success: roll <= target, sl } });
    g().jetValider('test');
    return (g().pendingLoot?.gear ?? []).map((l) => l.label);
  }
  const pieces = (creatureId: string, enc: number) => t('eff.pieceDeRecolte', { creature: findCreatureById(creatureId)!.label, enc });

  it('Énorme à −2 DR : 2 Enc', () => {
    expect(recolter('dragon-de-la-foret', 52, 30)).toEqual([pieces('dragon-de-la-foret', 2)]);
  });

  it('un échec à DR 0 : la pleine quantité', () => {
    expect(recolter('dragon-de-la-foret', 35, 30)).toEqual([pieces('dragon-de-la-foret', 8)]);
  });

  it('assez de Degrés d’échec : rien à prélever', () => {
    expect(recolter('griffon', 99, 30)).toEqual([]);
  });

  it('une créature venimeuse : le récolteur joue Métier (Empoisonneur), sa meilleure Compétence admise', () => {
    const empoisonneur = heros('a', { skills: [{ id: 'savoir', spec: 'betes-sauvages', characteristic: 'intelligence', advances: 5 }, { id: 'metier', spec: 'empoisonneur', characteristic: 'dexterite', advances: 30 }] as never });
    banc.setState({ party: [empoisonneur], pendingVictory: victoire({ defeated: [{ label: 'Vouivre', count: 1, creatureId: 'vouivre' }] }) } as never);
    g().fenetreChoisir('victoire', 'depecer', 'vouivre');
    expect(g().pendingTest?.sujet).toEqual({ skill: { id: 'metier', spec: 'empoisonneur' } });
  });
});

describe('coop à 3 sièges : évaluer et dépecer restent à l’hôte, refusés à l’invité par la route (`intentAllowedFor`)', () => {
  /** L'hôte au siège 0, un héros par siège. */
  const enCoop = (over: Record<string, unknown>) => {
    banc.setState({ party: [heros('a'), heros('b'), heros('c')], ...over } as never);
    banc.setState({ net: { ...initialNet(), mode: 'hote', mySeat: 0, ownership: { a: 0, b: 1, c: 2 }, slots: [0, 1, 2, 0], seatNames: { 0: 'Hôte', 1: 'B', 2: 'C' } } });
  };
  const PAR_SIEGE = [0, 1, 2] as const;

  it.each([
    ['une ligne du butin', () => enCoop({ pendingLoot: { title: 'Coffre', gear: [ligne('L0')] } }), ['L0']],
    ['sa Détection', () => enCoop({ party: [heros('a', DETECTEUR), heros('b'), heros('c')], pendingLoot: { title: 'Coffre', gear: [ligne('L0')] } }), ['L0', 'detection']],
    ['une ligne de la victoire', () => enCoop({ pendingVictory: victoire({ gear: [ligne('V0')] }) }), ['V0']],
  ] as const)('evaluerLObjet sur %s : l’invité hors de la liste, rien ne s’ouvre', (_cas, poser, args) => {
    const issues = PAR_SIEGE.map((siege) => {
      poser();
      return [intentAllowedFor(g(), siege, 'evaluerLObjet', [...args]), appliquerLIntentionDUnSiege(g, siege, 'evaluerLObjet', args), g().pendingAppraise];
    });
    expect(issues).toEqual([[true, 'hors-allowlist', null], [false, 'hors-allowlist', null], [false, 'hors-allowlist', null]]);
  });

  it('victory.depecer : l’hôte dépèce, chaque invité est refusé par la route', () => {
    const issues = PAR_SIEGE.map((siege) => {
      enCoop({ pendingVictory: victoire({ defeated: [{ label: 'Griffon', count: 1, creatureId: 'griffon' }] }) });
      const args = ['victoire', 'depecer', 'griffon'] as const;
      return [intentAllowedFor(g(), siege, 'fenetreChoisir', [...args]), appliquerLIntentionDUnSiege(g, siege, 'fenetreChoisir', args), g().pendingVictory?.harvested];
    });
    expect(issues).toEqual([[true, 'appliquee', ['griffon']], [false, 'refusee', []], [false, 'refusee', []]]);
  });
});

describe('la fenêtre du butin : chaque ligne porte le refus du geste qu’elle offre, `evaluerLObjet(uid)` au mode par défaut', () => {
  it('une ligne que seule la Détection ouvrirait est refusée par l’Évaluation, avec sa raison', () => {
    banc.setState({ party: [heros('a', { ...DETECTEUR, skills: [] })], pendingLoot: { title: 'Coffre', gear: [ligne('L0')] } } as never);
    expect(fenetreDuButin(g())?.evaluer?.options).toEqual([{ valeur: 'L0', libelle: 'Épée', refus: appraiseRefus(g().party) }]);
    expect(appraiseRefus(g().party), 'témoin : personne ne peut tenter l’Évaluation').not.toBeNull();
  });
});

describe('approvisionnerLArme : une munition que le porteur de l’arme ne porte pas est refusée, et dite, sans écriture', () => {
  const ranged = (c: Combatant): Weapon => c.weapons.find((w) => w.type === 'distance')!;
  function archer() {
    const H = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    H.weapons = [{ uid: 'w-arb', label: 'Arbalète', type: 'distance', damage: { plusBF: false, flat: 9 }, range: 60, qualities: [{ id: 'recharge', value: 1 }], subType: 'Arbalète', reload: 1 }];
    H.items = [{ uid: 'am1', label: 'Carreau', kind: 'ammo', qualities: [], enc: 0, equipped: false, subType: 'Arbalète', qty: 2 } as ItemInstance];
    ranged(H).ammoUid = 'am1';
    H.pos = { x: 0, y: 0 };
    const E: Combatant = JSON.parse(JSON.stringify(H));
    Object.assign(E, { id: 'enemy-0', label: 'Cible', kind: 'ennemi', pos: { x: 4, y: 0 } });
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
