import { describe, it, expect, vi } from 'vitest';
import { useGame } from './store';
import { openLandMarket, landSellCargo } from './landMarketFlow';
import { persistCarriersCargo } from './carriers';
import { seedBattleRng } from './battleRng';
import { createHero, skillCharacteristicById } from '../engine/character';
import { buildScene } from './mapSpec';
import { snapshotSave } from './saves';
import { toBrass } from '../engine/money';
import { partyMoneyTotal } from './bourseFlow';
import type { Combatant, SkillInstance } from '../engine/types';
import type { WorldMap } from './worldMap';
import type { LandMarketProfile, TradeRumour } from '../engine/landCargo';
import type { CargoLot } from '../engine/cargo';
import type { Possession } from '../engine/possession';

/**
 * COMMERCE TERRESTRE/FLUVIAL — rumeur CROSS-LIEU (MSRC 13 l.180) : la rumeur entendue au marché désigne
 * un AUTRE Lieu où le bien se vend au double. Board persistant `store.tradeRumours`, appliqué à la vente
 * au Lieu désigné (#99).
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

/** Draine une cascade influençable (héros piloté-humain → modale, #274) — même patron que les autres
 *  suites (`cascadeRoll`+`cascadeNext`, ex. `river-voyage-flow.test.ts`). */
function drainCascade(): void {
  let g = 0;
  while (get().pendingCascade && g++ < 50) {
    const p = get().pendingCascade!;
    const cur = p.participants[p.cursor];
    if (cur && cur.target != null && !cur.result) get().cascadeRoll(cur.id);
    else get().cascadeNext();
  }
}

function skill(c: Combatant, skillId: string, advances: number, spec?: string): void {
  const ex = c.skills.find((s) => s.id === skillId && (s.spec ?? null) === (spec ?? null));
  if (ex) ex.advances = Math.max(ex.advances, advances);
  else c.skills.push({ id: skillId, spec, characteristic: skillCharacteristicById(skillId), advances } as SkillInstance);
}

/** id du porteur de convoi (diligence, chargement 80) qui héberge le vrac du marchand. */
const CARRIER_ID = 'convoi-1';

/** Un marchand du groupe : Ragot + Marchandage élevés (Fel poussé) pour des Tests fiables sous graine.
 *  Le chariot de convoi (porteur réel de la cargaison, #327) est posé SÉPARÉMENT (Possession, SOCLE
 *  POSSESSIONS #617/#618) — `launchAtA` le pose après `loadProject` (le registre est vidé+re-semé au
 *  démarrage de scène, `startScene`/`seedStartingPossessions`). */
function trader(): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'marchand', label: 'Artur', motivation: 'x', seed: 11, id: 't-artur' });
  h.characteristics = { ...h.characteristics, Fel: 60 } as Combatant['characteristics'];
  skill(h, 'ragot', 60);
  skill(h, 'marchandage', 60);
  return h;
}

/** Possession véhicule de convoi (diligence, chargement 80) — SOURCE unique de la cargaison du marché. */
const convoi = (ownerId: string): Possession =>
  ({ uid: CARRIER_ID, ownerId, nature: 'vehicule', vehicleId: 'diligence', location: { kind: 'avec-le-groupe' }, items: [] });

const profile = (extra: Partial<LandMarketProfile> = {}): LandMarketProfile => ({ taille: 4, richesse: 4, produits: ['commerce', 'vin'], ...extra });

function tradeMap(): WorldMap {
  return {
    id: 'm', label: 'Le Reik',
    places: [
      { id: 'A', label: 'Grünburg', pos: { x: 0, y: 0 }, scene: 'marche-a', market: profile() },
      { id: 'B', label: 'Altdorf', pos: { x: 90, y: 0 }, scene: 'marche-b', market: profile() },
    ],
    routes: [],
  };
}

const marche = (id: string, label: string) => buildScene({ id, label, desc: '.', size: [8, 6], terrain: 'planches', heroStart: [2, 3] });

function launchAtA(): void {
  seedBattleRng(7);
  const g = get();
  const h = trader();
  g.setParty([h]);
  g.loadProject([marche('marche-a', 'Grünburg'), marche('marche-b', 'Altdorf')], 'marche-a', tradeMap());
  // trader() n'a pas de bourse → partyMoneyTotal = 0 ; le registre de possessions REMPLACE tout auto-semis
  // de dotation carrière (marchand niveau 1 porte une mule) par LE porteur déterministe du test.
  set({ landMarket: null, tradeRumours: [], journal: [], possessions: [convoi(h.id)] });
}

const lot: CargoLot = { cargoId: 'vin', enc: 40, basePriceGold: 10 };
const rumourB: TradeRumour = { placeId: 'B', biens: ['vin'], mult: 2, text: 'Le vin manque à Altdorf.', heardDay: 0 };

/** Vend le lot 0 à Altdorf (place B) avec le board donné et renvoie le gain en brass. */
function sellAtB(board: TradeRumour[]): number {
  launchAtA();
  set({
    landMarket: { placeId: 'B', label: 'Altdorf', market: profile(), offers: [] },
    tradeRumours: board,
    journal: [],
    ...persistCarriersCargo(get(), [{ carrierId: CARRIER_ID, cargo: [{ ...lot }] }]),
  });
  seedBattleRng(3);
  vi.useFakeTimers();
  landSellCargo(get, set, CARRIER_ID, 0);
  // Le dé d'acheteur est un dé de MONDE : le siège qui possède le monde le LANCE dans sa fenêtre
  // (#1426). La vente se conclut donc au geste, jamais à l'appel.
  let g = 0;
  while (get().pendingCascade && g++ < 5) {
    const p = get().pendingCascade!;
    get().cascadeRoll(p.participants[p.cursor].id);
    get().cascadeNext();
    vi.runAllTimers();
  }
  vi.useRealTimers();
  return toBrass(partyMoneyTotal(get));
}

describe('#99 — rumeur CROSS-LIEU appliquée à la vente au Lieu désigné (l.180)', () => {
  it('vendre le bien visé AU Lieu désigné rapporte le DOUBLE (même graine, seule la rumeur change)', () => {
    const withRumour = sellAtB([rumourB]);
    const without = sellAtB([]);
    expect(without).toBeGreaterThan(0);
    expect(withRumour).toBe(without * 2); // ×2 exact (l.180), tout le reste identique sous la même graine
  });

  it('la rumeur N\'EST PAS consommée par la vente (« autant qu\'ils le souhaitent », l.180)', () => {
    sellAtB([rumourB]);
    expect(get().tradeRumours).toHaveLength(1);
    expect(get().tradeRumours[0]).toMatchObject({ placeId: 'B', biens: ['vin'] });
  });

  it('une rumeur visant un AUTRE Lieu ne double PAS la vente ici', () => {
    const other: TradeRumour = { placeId: 'C', biens: ['vin'], mult: 2, text: 'x', heardDay: 0 };
    expect(sellAtB([other])).toBe(sellAtB([]));
  });
});

describe('#99 — génération au marché : la rumeur vise un AUTRE Lieu de la carte', () => {
  it('un Test de Ragot réussi au marché A ajoute au board une rumeur ciblant le Lieu B', () => {
    launchAtA();
    seedBattleRng(7);
    openLandMarket(get, set);
    // #1426 : les dés de l'étal s'offrent d'abord en FENÊTRE DE LOT (un siège tient le monde) ; ce qui
    // SUIT l'étal — le Test de Ragot — n'ouvre qu'à la validation.
    get().etalLotConfirm();
    // #274 : le Test de Ragot est surfacé par la porte (`openRoll`, hero-test, héros piloté-humain →
    // modale) — drainer comme un jet joueur normal.
    drainCascade();
    const board = get().tradeRumours;
    expect(board.length).toBe(1);
    expect(board[0].placeId).toBe('B'); // AUTRE Lieu à market (jamais le Lieu courant)
    expect(board[0].placeId).not.toBe('A');
    expect(board[0].mult).toBe(2);
    expect(board[0].biens.length).toBeGreaterThan(0);
  });
});

describe('#99 — persistance : le board survit à un round-trip de sauvegarde', () => {
  it('snapshotSave embarque tradeRumours (champ de l\'état initial)', () => {
    launchAtA();
    set({ tradeRumours: [rumourB] });
    const save = snapshotSave(get() as unknown as Record<string, unknown>, useGame.getInitialState() as unknown as Record<string, unknown>, '2512-01-01');
    expect(save.data.tradeRumours).toEqual([rumourB]);
  });
});
