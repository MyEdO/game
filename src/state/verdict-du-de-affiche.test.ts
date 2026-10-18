/**
 * #2692 — l'issue scellée est une fonction du dé AFFICHÉ : un dé fixé, avant comme après le jet, repasse
 * par la MÊME fonction de verdict que le jet (Marchandage LDB 59 l.43, Récupération d'État LDB 16 l.66,
 * Test de compétence et son seuil `requireSL`). Un Marchandage joué ne s'efface pas (LDB 17 l.17-25).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame, type PendingBargain } from './store';
import { withPreRollFixedDie } from './combatFlow';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS, type Scene } from './scene';
import type { Combatant } from '../engine/types';
import { t } from '../i18n';
import { bus, EVT } from './bus';
import { cascadeDeTest } from './cascadeTestKit';
import { setBourseBrass } from '../engine/bourse';

const get = () => useGame.getState();

const heros = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'h', label: 'H', name: 'H', kind: 'hero', resilience: 0, fortune: 0,
  characteristics: { sociabilite: 40, force: 40 }, skills: [], talents: [], weapons: [], items: [], conditions: [],
  wounds: { current: 10, max: 10 }, armour: {}, ...over,
} as unknown as Combatant);

/** Les d100 des prochains jets, dans l'ordre (patron `bargain-soutien-departage.test.ts`). */
function forceD100(...dice: number[]): void {
  const q = [...dice];
  vi.spyOn(Math, 'random').mockImplementation(() => ((q.shift() ?? 1) - 0.5) / 100);
}

/** Marchandage ouvert, pas encore lancé : le négociateur à 50, le marchand à 45. */
const ouvert = (): PendingBargain => ({
  playerId: 'h', playerName: 'H', contrepartie: { kind: 'marchand', mode: 'buy', titre: t('out.bargainTitreAchat') },
  opposant: { label: 'Armurier', valeur: 45 }, playerSkill: 50, playerBase: 50, negotiator: false,
  roll: null, merchantRoll: null, result: null,
});
const marchand = { entityId: 'm', archetype: 'armurier', settlement: 'village', resaleRate: 0.5, buyMarkup: 1, stock: [], cart: [], bargainLocked: false };

/** Lancer réel : le négociateur fait 50 (DR 0), le marchand 25 sur 45 (DR +2). */
function lancerContreMarchandA2(): void {
  useGame.setState({ party: [heros()], pendingBargain: ouvert(), merchant: marchand } as never);
  forceD100(50, 25);
  get().bargainRoll();
  vi.restoreAllMocks();
  expect(get().pendingBargain!.merchantRoll!.sl).toBe(2);
}

beforeEach(() => resetDesFixes());
afterEach(() => { resetDesFixes(); vi.restoreAllMocks(); });

describe('Marchandage — le dé fixé tranche', () => {
  it('APRÈS le jet : 1 puis 99 contre un marchand à +2 → le verdict porte le dé, gagné puis perdu', () => {
    setDesFixes(true);
    lancerContreMarchandA2();
    get().bargainSetForcedRoll(1);
    let pb = get().pendingBargain!;
    expect(pb.result!.attacker.roll).toBe(1);
    expect(pb.result!.attackerWins).toBe(true);
    get().bargainSetForcedRoll(99);
    pb = get().pendingBargain!;
    expect(pb.result!.attacker.roll).toBe(99);
    expect(pb.result!.attackerWins).toBe(false);
  });

  it('AVANT le jet (`withPreRollFixedDie`) : 1 puis 99 contre un marchand à +2', () => {
    setDesFixes(true);
    for (const [de, gagne] of [[1, true], [99, false]] as const) {
      useGame.setState({ party: [heros()], pendingBargain: ouvert() } as never);
      forceD100(50, 25);
      withPreRollFixedDie(get, useGame.setState, () => get().bargainRoll(), () => get().bargainSetForcedRoll(de));
      vi.restoreAllMocks();
      const pb = get().pendingBargain!;
      expect(pb.merchantRoll!.sl).toBe(2);
      expect(pb.roll!.roll).toBe(de);
      expect(pb.result!.attacker.roll).toBe(de);
      expect(pb.result!.attackerWins).toBe(gagne);
    }
  });

  it('« Conclure » scelle `{won, drNet}` conformes aux lignes affichées', () => {
    setDesFixes(true);
    lancerContreMarchandA2();
    get().bargainSetForcedRoll(70); // DR −2 contre +2
    const pb = get().pendingBargain!;
    expect([pb.roll!.sl, pb.merchantRoll!.sl]).toEqual([-2, 2]);
    get().bargainConfirm();
    expect(get().merchant!.bargainBuy).toEqual({ won: false, drNet: 4, negotiator: false });
  });
});

describe('Récupération d’État — le dé fixé tranche', () => {
  it('dé 5 contre une entrave à +3 → réussite, DR net 2', () => {
    setDesFixes(true);
    useGame.setState({
      party: [heros()],
      pendingStateRecovery: {
        actorId: 'h', actorName: 'H', state: 'empetre', skillLabel: 'Force', skillValue: 50, skillBase: 40, difficulty: 'intermediaire',
        opposition: { value: 50, base: 50 }, stacks: 1,
        roll: { roll: 88, target: 50, sl: -3, success: false, isDouble: true, base: 40 },
        opponentRoll: { roll: 20, target: 50, sl: 3, success: true, isDouble: false, base: 50 },
        netSL: 6, success: false,
      },
    } as never);
    get().recoverSetForcedRoll(5);
    const p = get().pendingStateRecovery!;
    expect(p.roll!.roll).toBe(5);
    expect(p.success).toBe(true);
    expect(p.netSL).toBe(2);
  });
});

describe('Test de compétence — le dé fixé tranche, seuil et Talents compris', () => {
  const test = (talents: Combatant['talents'] = []) => {
    useGame.setState({
      party: [heros({ talents })],
      pendingTest: {
        actorId: 'h', actorName: 'H', label: 'T', skillId: 'intimidation', skillValue: 45, difficulty: 'intermediaire', requireSL: 3,
        roll: 88, target: 45, sl: -4, success: false, jet: { roll: 88, target: 45, sl: -4, success: false, isDouble: true }, onSuccess: [], onFailure: [],
      },
    } as never);
    get().testSetForcedRoll(40);
    return get().pendingTest!;
  };

  it('`requireSL` 3 et dé 40 (DR 0) → échec', () => {
    setDesFixes(true);
    const p = test();
    expect(p.roll).toBe(40);
    expect(p.sl).toBe(0);
    expect(p.success).toBe(false);
  });

  it('Menaçant ×3 (LDB 10) ajoute ses DR au dé fixé : DR 3, seuil tenu → réussite', () => {
    setDesFixes(true);
    const p = test([{ talentId: 'menacant', times: 3 }] as Combatant['talents']);
    expect(p.roll).toBe(40);
    expect(p.sl).toBe(3);
    expect(p.success).toBe(true);
  });
});

describe('Test de compétence — l’outil compte dans le verdict affiché (LDB 60 l.22)', () => {
  it('outil Pratique, `requireSL` 1, dé 45 (DR 0) : la fenêtre montre DR 1 réussi, l’acquittement scelle la même issue', () => {
    setDesFixes(true);
    const outil = { uid: 'o1', label: 'Outil', kind: 'misc', qualities: [{ id: 'pratique' }] };
    useGame.setState({
      party: [heros({ items: [outil] as never })],
      pendingTest: {
        actorId: 'h', actorName: 'H', label: 'T', skillValue: 45, difficulty: 'intermediaire', requireSL: 1, itemUid: 'o1',
        roll: 88, target: 45, sl: -4, success: false, jet: { roll: 88, target: 45, sl: -4, success: false, isDouble: true }, onSuccess: [], onFailure: [],
      },
    } as never);
    get().testSetForcedRoll(45);
    const p = get().pendingTest!;
    expect([p.roll, p.sl, p.success]).toEqual([45, 1, true]);
    let scelle: { success: boolean; sl: number } | null = null;
    const off = bus.on(EVT.TEST_RESOLVED, (e: unknown) => { scelle = e as { success: boolean; sl: number }; });
    get().resolveTest();
    off();
    expect(scelle).toMatchObject({ success: true, sl: 1 });
  });
});

describe('Test de compétence — la Chance s’ajoute au jet brut posé (LDB 17 l.24 ; LDB 60 l.22)', () => {
  const chanceApres45 = (outil: boolean) => {
    setDesFixes(true);
    const items = outil ? [{ uid: 'o1', label: 'Outil', kind: 'misc', qualities: [{ id: 'pratique' }] }] : [];
    useGame.setState({
      party: [heros({ fortune: 1, items: items as never })],
      pendingTest: {
        actorId: 'h', actorName: 'H', label: 'T', skillValue: 45, difficulty: 'intermediaire', requireSL: 1, ...(outil ? { itemUid: 'o1' } : {}),
        roll: null, target: 45, sl: 0, success: false, jet: null, onSuccess: [], onFailure: [],
      },
    } as never);
    withPreRollFixedDie(get, useGame.setState, () => get().testRoll(), () => get().testSetForcedRoll(45));
    resetDesFixes();
    get().testBonusSL();
    return get().pendingTest!;
  };

  it('dé 45/45 (DR 0) puis +1 DR de Chance : DR 1 réussi, avec ou sans outil Pratique', () => {
    for (const outil of [false, true]) {
      const p = chanceApres45(outil);
      expect([p.roll, p.sl, p.success], outil ? 'Pratique ne joue que sur un Test raté' : 'sans outil').toEqual([45, 1, true]);
    }
  });
});

describe('ABS-3 — un Marchandage joué ne s’efface pas (LDB 17 l.17-25)', () => {
  const scene = {
    type: 'scene', id: 's', label: 'S', dimensions: { w: 4, h: 4 }, reliefDefaults: { ...DEFAULT_RELIEF_DEFAULTS }, roofDefaults: { ...DEFAULT_ROOF_DEFAULTS },
    layers: [{ z: 0, tiles: Array(16).fill('herbe') }], dialogues: [], triggers: [], encounters: [], flags: {},
    entities: [{ id: 'marchand', kind: 'personnage', pos: { x: 1, y: 1 }, merchant: { archetype: 'armurier' } }],
  } as unknown as Scene;
  const ouvrir = () => {
    useGame.setState({ scene, party: [heros()], merchant: null, pendingBargain: null, merchantStocks: {} } as never);
    get().openMerchant('marchand');
    get().startBargain('buy');
    expect(get().pendingBargain).not.toBeNull();
  };

  it('jet puis « Annuler » → l’issue est consignée, le Marchandage ne se relance plus', () => {
    ouvrir();
    get().bargainRoll();
    const r = get().pendingBargain!.result!;
    get().bargainCancel();
    expect(get().pendingBargain).toBeNull();
    expect(get().merchant!.bargainBuy).toEqual({ won: r.attackerWins, drNet: r.netSL, negotiator: false });
    get().startBargain('buy');
    expect(get().pendingBargain).toBeNull();
  });

  it('« Annuler » ne ferme que le Marchandage : une cascade en cours lui survit', () => {
    ouvrir();
    useGame.setState({ pendingCascade: cascadeDeTest([{ id: 's1', kind: 'test', actorId: 'h', target: 45, rollLabel: 'Test' }] as never) } as never);
    get().bargainCancel();
    expect(get().pendingBargain).toBeNull();
    expect(get().pendingCascade).not.toBeNull();
  });

  it('« Annuler » avant le jet → rien n’est consigné, le Marchandage reste ouvert à la visite', () => {
    ouvrir();
    get().bargainCancel();
    expect(get().pendingBargain).toBeNull();
    expect(get().merchant!.bargainBuy ?? null).toBeNull();
    get().startBargain('buy');
    expect(get().pendingBargain).not.toBeNull();
  });
});

/** LDB 59 l.43 ; #2547 c.6234640084. */
describe('Marchandage raté de beaucoup — refus pour la visite (LDB 59 l.43)', () => {
  const scene = {
    type: 'scene', id: 's', label: 'S', dimensions: { w: 4, h: 4 }, reliefDefaults: { ...DEFAULT_RELIEF_DEFAULTS }, roofDefaults: { ...DEFAULT_ROOF_DEFAULTS },
    layers: [{ z: 0, tiles: Array(16).fill('herbe') }], dialogues: [], triggers: [], encounters: [], flags: {},
    entities: [{ id: 'marchand', kind: 'personnage', pos: { x: 1, y: 1 }, merchant: { archetype: 'armurier' } }],
  } as unknown as Scene;
  /** Deux héros riches ; le négociateur `h` (Sociabilité 40) devance `h2` (20). */
  const armure = () => ({ uid: 'a', trappingId: 'chemise-de-mailles', label: 'Chemise de mailles', kind: 'armor', pa: 3, damageTaken: 2, qualities: [], enc: 1, equipped: true });
  const ouvrirEtRater = (mode: 'buy' | 'sell', seul = false, panier?: () => void) => {
    const h = heros({ items: [armure()] as never }); const h2 = heros({ id: 'h2', label: 'H2', name: 'H2', characteristics: { sociabilite: 20 }, items: [armure()] } as never);
    setBourseBrass(h, 24000); setBourseBrass(h2, 24000);
    useGame.setState({ scene, party: seul ? [h] : [h, h2], merchant: null, pendingBargain: null, merchantStocks: {}, refusDeVendeur: {} } as never);
    get().openMerchant('marchand');
    panier?.();
    get().startBargain(mode);
    expect(get().pendingBargain!.playerId).toBe('h');
    forceD100(100, 1);
    get().bargainRoll();
    vi.restoreAllMocks();
    const r = get().pendingBargain!.result!;
    expect(r.attackerWins).toBe(false);
    expect(r.netSL).toBeGreaterThanOrEqual(6);
    get().bargainConfirm();
  };
  const ligne = () => get().merchant!.stock.find((l) => l.qty > 0)!;

  it('achat perdu de 6 DR ou plus : le marchand refuse CE héros ; un autre héros achète', () => {
    ouvrirEtRater('buy');
    expect(get().refusDeVendeur.marchand).toEqual(['h']);
    const { id, qty } = ligne();
    get().buyItem(id, 'h');
    expect(get().merchant!.stock.find((l) => l.id === id)!.qty, 'le héros refusé n’achète pas').toBe(qty);
    get().buyItem(id, 'h2');
    expect(get().merchant!.stock.find((l) => l.id === id)!.qty, 'un autre héros achète').toBe(qty - 1);
  });

  it('vente perdue de 6 DR ou plus : aucun refus, le verdict reste celui de la vente', () => {
    ouvrirEtRater('sell');
    expect(get().refusDeVendeur.marchand).toEqual([]);
    const { id, qty } = ligne();
    get().buyItem(id, 'h');
    expect(get().merchant!.stock.find((l) => l.id === id)!.qty).toBe(qty - 1);
  });

  it('fermer puis rouvrir le marchand dans la scène : le refus tient', () => {
    ouvrirEtRater('buy');
    get().closeMerchant();
    get().openMerchant('marchand');
    const { id, qty } = ligne();
    get().buyItem(id, 'h');
    expect(get().merchant!.stock.find((l) => l.id === id)!.qty).toBe(qty);
  });

  it('la réparation est refusée au héros refusé, pas à un autre', () => {
    ouvrirEtRater('buy');
    get().repairItem('a', 'h');
    get().repairItem('a', 'h2');
    const degats = (id: string) => get().party.find((c) => c.id === id)!.items!.find((i) => i.uid === 'a')!.damageTaken;
    expect([degats('h'), degats('h2')]).toEqual([2, 0]);
  });

  it('groupe entièrement refusé : le panier ne se paie pas', () => {
    let id = '';
    ouvrirEtRater('buy', true, () => { id = ligne().id; get().addToCart(id); });
    const qty = get().merchant!.stock.find((l) => l.id === id)!.qty;
    expect(get().merchant!.cart).toEqual([{ id, qty: 1 }]);
    get().payCart();
    expect(get().journal[get().journal.length - 1], 'le refus est dit, pas une bourse vide').toBe(t('mf.refusVisite', { name: 'H' }));
    expect(get().merchant!.stock.find((l) => l.id === id)!.qty).toBe(qty);
    expect(get().merchant!.pendingDistribution ?? null).toBeNull();
  });

  it('l’Évaluation au comptoir est refusée au héros refusé', () => {
    ouvrirEtRater('buy');
    useGame.setState({ party: get().party.map((h) => (h.id === 'h' ? { ...h, items: [...(h.items ?? []), { uid: 'u', label: 'Anneau', kind: 'misc', identified: false } as never] } : h)), pendingAppraise: null } as never);
    get().appraiseItem('u', 'h');
    expect(get().pendingAppraise).toBeNull();
    expect(get().journal[get().journal.length - 1]).toBe(t('mf.refusVisite', { name: 'H' }));
  });
});
