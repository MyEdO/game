import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { seedBattleRng, battleRng } from './battleRng';
import { setRule, resetRule } from '../engine/policy';
import { creditBourse } from './bourseFlow';
import { cascadeAppliers } from './cascade';
import { resultLine } from './rollSeam';
import { emptyScene } from './scene';
import { rollMerchantOpposition, type PortProfile } from '../engine/seaVoyage';
import { rollMerchantSkill as rollLandMerchantSkill } from '../engine/landCargo';
import { landBuyCargo, landSellCargo } from './landMarketFlow';
import { persistCarriersCargo } from './carriers';
import { draineCascadeDifferee } from './cascadeTestKit';
import { createHero } from '../engine/character';
import { d100, makeRNG } from '../engine/dice';
import { evaluateTest } from '../engine/tests';
import { testValue } from '../engine/skills';
import type { Possession } from '../engine/possession';
import type { CascadeStep } from './pendings';
import type { Combatant, SkillInstance } from '../engine/types';

/**
 * DÉPARTAGE d'un Marchandage OPPOSÉ soutenu (LDB 12) — le Soutien est un MODIFICATEUR du Test
 * (l.189-190 : « Chaque Personnage qui apporte son soutien octroie un bonus de +10 au Test ») ; ce
 * qui départage à DR ÉGAL est la Compétence NUE (l.160 : « c'est le groupe avec la Compétence ou la
 * Caractéristique la plus élevée qui l'emporte »). La porte du seam POSE cette valeur nue dans
 * `step.base` (`rollSeam.buildMonoStep` → `skillBaseValue`, `LDB 09 l.17`) : les appliers portuaires
 * la lisent telle quelle, plus rien à défaire.
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

function setSkill(c: Combatant, skillId: string, advances: number): void {
  const ex = c.skills.find((s) => s.id === skillId);
  if (ex) ex.advances = advances;
  else c.skills.push({ id: skillId, advances } as SkillInstance);
}

/** Cale la Compétence de `c` à EXACTEMENT `want` (les avances absorbent la Caractéristique du pregen). */
function tuneSkill(c: Combatant, skillId: string, want: number): void {
  setSkill(c, skillId, 0);
  setSkill(c, skillId, want - testValue(c, skillId));
}

const scene = { id: 'scene-P', label: 'Port', dimensions: { w: 2, h: 2 }, layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }], entities: [], dialogues: [], triggers: [] } as never;
const PORT: PortProfile = { taille: 4, richesse: 4, production: [] } as PortProfile;

/** Port + navire + offre, avec un parti donné (bourse créditée pour l'achat). */
function setupPort(party: Combatant[]): void {
  seedBattleRng(1);
  set({
    party, scene,
    battle: null,
    worldMap: { id: 'm', nom: 'x', places: [{ id: 'P', label: 'Port', pos: { x: 0, y: 0 }, scene: 'scene-P', port: PORT }], routes: [] },
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [{ cargoId: 'bois', enc: 40, basePriceGold: 10 }], lastVoyageMilles: 0 },
    port: { placeId: 'P', label: 'Port', port: PORT, freeEnc: 300, maxLoadEnc: 450, offers: [{ cargoId: 'bois', label: 'Bois', enc: 40, basePrice: 10, surplus: false }] },
    journal: [],
    pendingCascade: null,
  } as never);
  if (party.length) creditBourse(get, set, party[0].id, { gold: 5000, silver: 0, brass: 0 });
}

/** Meneur à `nue` en Marchandage + un soutien éligible (≥ 1 Augmentation, LDB 12 l.195) plus faible. */
function pairAvecSoutien(nue = 45): { leader: Combatant; helper: Combatant } {
  const [leader, helper] = makePregens();
  tuneSkill(leader, 'marchandage', nue);
  tuneSkill(helper, 'marchandage', 20);
  return { leader, helper };
}

/** Le jet du marchand tel que l'applier le tirera (même graine, même appel) — sert à caler le DR du
 *  héros sur celui du marchand : l'égalité de DR est la SEULE situation où le départage se voit. */
function probeMerchantSL(seed: number, merchantValue: number): number {
  seedBattleRng(seed);
  const sl = rollMerchantOpposition(merchantValue, battleRng()).sl;
  seedBattleRng(seed);
  return sl;
}

/** Étape de cascade telle que `rollSeam.buildMonoStep` la construit pour un Test de groupe SOUTENU :
 *  `base` = Niveau de Compétence NU du meneur, `mods` = la ligne de Soutien, cible SOUTENUE. */
function soutenuStep(kind: string, actorId: string, helperId: string, sl: number, meta: Record<string, unknown>): CascadeStep {
  return {
    id: kind, kind, actorId,
    label: 'Marchandage', rollLabel: 'Marchandage',
    base: 45, mods: [{ label: 'Soutien', value: 10, by: [{ id: helperId }] }],
    target: 55,
    result: { roll: 30, target: 55, sl, success: true },
    meta,
  } as CascadeStep;
}

/** Vend le lot 0 du convoi et JOUE la fenêtre du dé d'acheteur (dé de MONDE, #1426), puis les
 *  maillons différés que sa conséquence enchaîne (mise à prix, Marchandage opposé). */
function vendLotTerrestre(): void {
  vi.useFakeTimers();
  landSellCargo(get, set, LAND_CARRIER, 0);
  draineCascadeDifferee(get, () => vi.runAllTimers());
  vi.useRealTimers();
}

describe('Marchandage PORTUAIRE soutenu : le Soutien ne départage pas (LDB 12 l.160 / l.189-190)', () => {
  beforeEach(() => setRule('test-auto-bands', 'off'));
  afterEach(() => resetRule('test-auto-bands'));

  it('CÂBLAGE : la porte du seam pose la Compétence NUE en `step.base`, le Soutien en ligne de mod', () => {
    const { leader, helper } = pairAvecSoutien();
    setupPort([leader, helper]);
    get().portBuyCargo('bois', 20);
    const step = get().pendingCascade!.participants[0] as CascadeStep;
    expect(step.kind).toBe('port-buy-bargain');
    expect(step.base).toBe(45); // Niveau de Compétence NU (LDB 09 l.17) — la grandeur du départage (l.160)
    expect(step.mods?.[0]).toMatchObject({ label: 'Soutien', value: 10 }); // 1 soutien éligible (l.189-190)
    expect(step.target).toBe(55); // …compris dans la CIBLE, là où le RAW le met
  });

  it('ACHAT, DR égal : la Compétence NUE du meneur (45) perd contre le marchand (50) — surcoût, jamais remise', () => {
    const { leader, helper } = pairAvecSoutien();
    setupPort([leader, helper]);
    const sl = probeMerchantSL(11, 50);
    const step = soutenuStep('port-buy-bargain', leader.id, helper.id, sl, { cargoId: 'bois', want: 20, basePrice: 10, merchantValue: 50, merchantNegotiator: false, sellerDR: 0 });
    const out = cascadeAppliers['port-buy-bargain'].apply(get, set, step, leader, { steps: [step], index: 0 });
    const line = resultLine((out && 'consequences' in out ? out.consequences : undefined) ?? []);
    expect(line).toMatch(/surcoût de \d+ %/);
    expect(line).not.toMatch(/remise/);
  });

  it('VENTE, DR égal : la Compétence NUE du vendeur PJ (45) perd contre l’acheteur (50) — le prix BAISSE', () => {
    const { leader, helper } = pairAvecSoutien();
    setupPort([leader, helper]);
    const sl = probeMerchantSL(11, 50);
    const step = soutenuStep('port-sell-bargain', leader.id, helper.id, sl, { cargoIndex: 0, sellEnc: 20, offerPct: 100, merchantValue: 50, merchantNegotiator: false, sellerDR: 0 });
    const out = cascadeAppliers['port-sell-bargain'].apply(get, set, step, leader, { steps: [step], index: 0 });
    const line = resultLine((out && 'consequences' in out ? out.consequences : undefined) ?? []);
    expect(line).toMatch(/Marchandage \(.*\) : -\d+ %/);
  });
});

// ── Marché TERRESTRE (MSRC 13 l.127-131 / l.133-160) : même départage, flux synchrone ────────────

/** Bonus de Soutien visé sur le marché terrestre : 2 soutiens éligibles (LDB 12 l.189-190). */
const SOUTIEN_TERRESTRE = 20;

interface LandProbe { merchant: number; heroRoll: number; merchantRoll: number }

/** Rejoue la séquence de tirages de `landBuyCargo` (marchand 2d10+30, puis les deux d100 opposés). */
function probeLandBuy(seed: number): LandProbe {
  seedBattleRng(seed);
  const rng = battleRng();
  const merchant = rollLandMerchantSkill(rng);
  return { merchant, heroRoll: d100(rng), merchantRoll: d100(rng) };
}

/** Idem pour `landSellCargo` — un d100 de recherche d'acheteur précède le marchand. */
function probeLandSell(seed: number): LandProbe {
  seedBattleRng(seed);
  const rng = battleRng();
  d100(rng); // acheteur (Demande ≥ 100 dans ces tests → trouvé au 1ᵉʳ jet)
  const merchant = rollLandMerchantSkill(rng);
  return { merchant, heroRoll: d100(rng), merchantRoll: d100(rng) };
}

/** 1ʳᵉ graine où le Marchandage tombe à DR ÉGAL, la Compétence NUE du meneur SOUS celle du marchand et
 *  sa valeur SOUTENUE au-dessus : la seule configuration où le critère de départage se voit. */
function findTie(probe: (s: number) => LandProbe): { seed: number; nue: number; merchant: number } {
  for (let seed = 1; seed <= 800; seed++) {
    const p = probe(seed);
    for (let nue = 30; nue < p.merchant; nue++) {
      if (nue + SOUTIEN_TERRESTRE <= p.merchant) continue;
      if (evaluateTest(p.heroRoll, nue + SOUTIEN_TERRESTRE).sl === evaluateTest(p.merchantRoll, p.merchant).sl) return { seed, nue, merchant: p.merchant };
    }
  }
  throw new Error('aucune graine de DR égal trouvée');
}

const LAND_CARRIER = 'convoi-test';
const convoiPossession = (ownerId: string): Possession =>
  ({ uid: LAND_CARRIER, ownerId, nature: 'vehicule', vehicleId: 'diligence', location: { kind: 'avec-le-groupe' }, items: [] }) as Possession;

/** Marché terrestre ouvert, un convoi porteur, un meneur à `nue` en Marchandage + 2 soutiens éligibles. */
function setupLand(nue: number): Combatant {
  const mk = (id: string, fel: number): Combatant => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'marchand', label: id, motivation: 'x', rng: makeRNG(11), id });
    h.characteristics = { ...h.characteristics, Fel: fel } as Combatant['characteristics'];
    return h;
  };
  const leader = mk('meneur', 30);
  tuneSkill(leader, 'marchandage', nue);
  const helpers = [mk('soutien-1', 20), mk('soutien-2', 20)];
  for (const h of helpers) setSkill(h, 'marchandage', 1); // Augmentation minimale exigée (LDB 12 l.195)
  set({
    party: [leader, ...helpers], scene, battle: null, vessel: null,
    worldMap: null, possessions: [convoiPossession(leader.id)],
    landMarket: {
      placeId: 'L', label: 'Grünburg', market: { taille: 10, richesse: 4, produits: [] },
      offers: [{ cargoId: 'vin', label: 'Vin', enc: 40, basePrice: 10, wine: false }],
    },
    journal: [],
    pendingCascade: null,
  } as never);
  creditBourse(get, set, leader.id, { gold: 5000, silver: 0, brass: 0 });
  return leader;
}

const bargainLineOf = (): string => get().journal.find((l) => /Marchandage \(/.test(l)) ?? '';

describe('Marchandage TERRESTRE soutenu : `resolveOpposed` est le seul juge (MSRC 13 l.127)', () => {
  beforeEach(() => setRule('test-auto-bands', 'off'));
  afterEach(() => resetRule('test-auto-bands'));

  it('ACHAT, DR égal : Compétence NUE sous celle du marchand → surcoût, alors que la valeur SOUTENUE la dépasse', () => {
    const { seed, nue, merchant } = findTie(probeLandBuy);
    expect(nue).toBeLessThan(merchant); // Compétence nue PERDANTE
    expect(nue + SOUTIEN_TERRESTRE).toBeGreaterThan(merchant); // valeur SOUTENUE gagnante (le piège)
    const leader = setupLand(nue);
    expect(testValue(leader, 'marchandage')).toBe(nue);
    seedBattleRng(seed);
    landBuyCargo(get, set, 'vin', 40);
    expect(bargainLineOf()).toMatch(/surcoût de \d+ %/);
    expect(bargainLineOf()).not.toMatch(/remise/);
  });

  it('VENTE, DR égal : Compétence NUE sous celle de l’acheteur → le prix BAISSE', () => {
    const { seed, nue, merchant } = findTie(probeLandSell);
    expect(nue).toBeLessThan(merchant);
    expect(nue + SOUTIEN_TERRESTRE).toBeGreaterThan(merchant);
    expect(testValue(setupLand(nue), 'marchandage')).toBe(nue);
    set(persistCarriersCargo(get(), [{ carrierId: LAND_CARRIER, cargo: [{ cargoId: 'vin', enc: 40, basePriceGold: 10 }] }]));
    seedBattleRng(seed);
    vendLotTerrestre();
    expect(bargainLineOf()).toMatch(/Marchandage \(.*\) : -\d+ %/);
  });
});

// ── Marchand AMBULANT (LDB 59 l.43) : flux `bargain` de `rollFlowSpecs` ──────────────────────────

/** Marchandage de l'armurier ambulant (Marchandage 45) ouvert sur un groupe donné. */
function setupAmbulant(party: Combatant[]): void {
  const sc = emptyScene(4, 4); sc.id = 'm';
  sc.entities.push({ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, merchant: { archetype: 'armurier' } } as never);
  set({ party, scene: sc, merchant: null, merchantStocks: {}, journal: [], pendingCascade: null, pendingBargain: null } as never);
  get().openMerchant('pnj');
}

/** Impose la SÉQUENCE de d100 du flux (`rollTest` y tire sur `defaultRNG`, adossé à `Math.random`). */
function forceD100(...dice: number[]): void {
  const q = [...dice];
  vi.spyOn(Math, 'random').mockImplementation(() => ((q.shift() ?? 1) - 0.5) / 100);
}

/** Meneur nu à 40 + 1 soutien (+10, fondu à 50) face à l'armurier à 45, DR ÉGAL des deux côtés. */
function marchanderEgalite(): void {
  const { leader, helper } = pairAvecSoutien(40);
  setupAmbulant([leader, helper]);
  get().startBargain('buy');
  forceD100(30, 20); // joueur 30 sur cible 50 → DR 2 ; marchand 20 sur cible 45 → DR 2
  get().bargainRoll();
}

describe('Marchandage AMBULANT soutenu : le Soutien ne départage pas (LDB 12 l.160 / l.189-190)', () => {
  beforeEach(() => setRule('test-auto-bands', 'off'));
  afterEach(() => { resetRule('test-auto-bands'); vi.restoreAllMocks(); });

  it('CÂBLAGE : `startBargain` fond le Soutien dans `playerSkill` et en porte le détail (`support`)', () => {
    const { leader, helper } = pairAvecSoutien(40);
    setupAmbulant([leader, helper]);
    get().startBargain('buy');
    const pb = get().pendingBargain!;
    expect(pb.support?.bonus).toBe(10); // 1 soutien éligible (l.189-190)
    expect(pb.playerSkill).toBe(50); // 40 (Compétence) + 10 (Soutien) — FONDU par `partyAssisted`
    expect(pb.merchantValue).toBe(45); // armurier.bargainSkill
  });

  it('DR égal : la Compétence NUE (40) perd contre le marchand (45) — la valeur SOUTENUE (50) ne vole pas la victoire', () => {
    marchanderEgalite();
    const pb = get().pendingBargain!;
    expect([pb.roll!.roll, pb.merchantRoll!.roll]).toEqual([30, 20]); // dés imposés
    expect(pb.roll!.sl).toBe(pb.merchantRoll!.sl); // sans égalité de DR, le départage ne se voit pas
    expect(pb.roll!.target).toBe(50); // le Soutien reste un MODIFICATEUR du Test (l.189-190)
    expect(pb.roll!.base).toBe(40); // …mais la grandeur qui départage est la Compétence NUE (l.160)
    expect(pb.result!.decidedBy).toBe('valeur');
    expect(pb.result!.attackerWins).toBe(false);
  });

  it('CONSÉQUENCE : le marchandage conclu est PERDU — la visite ne porte aucune remise', () => {
    marchanderEgalite();
    get().bargainConfirm();
    expect(get().merchant!.bargainBuy!.won).toBe(false);
  });
});
