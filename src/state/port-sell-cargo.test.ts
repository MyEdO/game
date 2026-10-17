import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { seedBattleRng, battleRng } from './battleRng';
import { setRule, resetRule } from '../engine/policy';
import { partyMoneyTotal, creditBourse } from './bourseFlow';
import type { PortProfile } from '../engine/seaVoyage';
import { cascadeAppliers } from './cascade';
import { resultLine } from './rollSeam';
import type { CascadeStep } from './pendings';
import type { Combatant, SkillInstance } from '../engine/types';

/**
 * VENTE au port (`portSellCargo`, dernier reliquat #275/#274) — la chaîne Ragot → acheteur →
 * Marchandage est désormais une CASCADE (`openRoll` par étape, enchaînée via `chainStep`,
 * `state/portFlow.ts`). Chaque test isole une branche via un `PortProfile`/parti CONTRÔLÉ (jamais un
 * `openPort` aléatoire) pour un déterminisme lisible.
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

const tick = () => new Promise<void>((r) => setTimeout(r, 0));
async function drain(): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const p = get().pendingCascade;
    if (p) {
      const cur = p.participants[p.cursor];
      if (cur && cur.target != null && !cur.result) get().cascadeRoll(cur.id);
      get().cascadeNext();
    }
    await tick();
  }
}

function setSkill(c: Combatant, skillId: string, advances: number): void {
  const ex = c.skills.find((s) => s.id === skillId);
  if (ex) ex.advances = advances;
  else c.skills.push({ id: skillId, advances } as SkillInstance);
}

/** Impose les PROCHAINS d100 du RNG PARTAGÉ (`battleRng`, source unique des dés) ; les autres tirages,
 *  et les d100 au-delà de la file, restent ceux de la graine. À poser APRÈS le dernier `seedBattleRng`. */
function imposeD100(...des: number[]): void {
  const rng = battleRng() as { int: (min: number, max: number) => number };
  const brut = rng.int.bind(rng);
  rng.int = (min, max) => (min === 1 && max === 100 && des.length ? des.shift()! : brut(min, max));
}

const scene = { id: 'scene-P', label: 'Port', dimensions: { w: 2, h: 2 }, layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }], entities: [], dialogues: [], triggers: [] } as never;

function setup(port: PortProfile, party: Combatant[], enc = 40): void {
  seedBattleRng(1);
  set({
    party, scene,
    battle: null,
    worldMap: { id: 'm', nom: 'x', places: [{ id: 'P', label: 'Port', pos: { x: 0, y: 0 }, scene: 'scene-P', port }], routes: [] },
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [{ cargoId: 'bois', enc, basePriceGold: 10 }], lastVoyageMilles: 0 },
    port: { placeId: 'P', label: 'Port', port: structuredClone(port), freeEnc: 0, maxLoadEnc: 0, offers: [] },
    journal: [],
    pendingCascade: null,
  } as never);
}

describe('portSellCargo — cascade Ragot → acheteur → Marchandage (#275/#274)', () => {
  // Bandes automatiques du d100 (LDB 12 l.28, 01-05 auto-succès / 96-00 auto-échec) OFF pour ces tests :
  // les cibles construites (0 ou ≥ 100) doivent trancher SEULES, sans les 10 % de rolls « forcés ».
  beforeEach(() => setRule('test-auto-bands', 'off'));
  afterEach(() => resetRule('test-auto-bands'));

  it('port producteur (Ragot requis), groupe VIDE → refus IMMÉDIAT (aucun candidat au Ragot), aucun jet', () => {
    setup({ taille: 4, richesse: 4, production: ['bois'] }, []);
    get().portSellCargo(0);
    expect(get().pendingCascade).toBeNull();
    expect(get().journal.some((l) => /ne trouve pas de camelot/.test(l))).toBe(true);
    expect(get().vessel!.cargo).toHaveLength(1); // rien vendu
  });

  it('port producteur, Ragot au plancher (skill 0) → le journal enchaîne exactement UN dénouement (succès ou échec du Ragot), jamais les deux', async () => {
    const hero = makePregens()[0];
    setSkill(hero, 'ragot', 0);
    setup({ taille: 4, richesse: 4, production: ['bois'] }, [hero]);
    get().portSellCargo(0);
    await drain();
    expect(get().pendingCascade).toBeNull();
    const j = get().journal.join('\n');
    const gossipOutcome = /Ragot.*échoue|acheteur potentiel est approché/.test(j);
    expect(gossipOutcome).toBe(true);
  });

  it('port SANS relation au bien (gossip nul), acheteur GARANTI (Taille énorme → cible ≥ 100), groupe VIDE (aucun marchandeur) → vente conclue au prix d’offre', async () => {
    // relation 'no-produce' (bois absent de production/surplus) : gossip=null, target=(taille+demande)×10.
    // Groupe VIDE = branche « aucun marchandeur » (seul un parti vide y mène : tout héros marchande à sa
    // Sociabilité de base). Sous SOCLE POSSESSIONS, un crédit de groupe (`distributeCredit`) sans héros
    // n'a AUCUN bénéficiaire : le revenu se prouve donc sur la LIGNE de vente (montant en CO, jamais 0 sc),
    // pas sur une bourse de groupe qui n'existe plus.
    setup({ taille: 10, richesse: 4, production: [] }, []);
    get().portSellCargo(0);
    await drain();
    expect(get().pendingCascade).toBeNull();
    expect(get().vessel!.cargo).toHaveLength(0); // lot ENTIER vendu
    expect(get().journal.some((l) => /vendus.*: (?!0 sc)\S/.test(l))).toBe(true); // revenu conclu (> 0)
    expect(get().journal.some((l) => /Aucun marchandeur — prix d’offre pris tel quel/.test(l))).toBe(true);
  });

  it('port SANS relation au bien, cible d’acheteur NULLE (Taille 0) → aucun marchand intéressé, cargaison intacte', async () => {
    setup({ taille: 0, richesse: 1, production: [] }, [], 40);
    seedBattleRng(2);
    get().portSellCargo(0);
    await drain();
    expect(get().pendingCascade).toBeNull();
    expect(get().vessel!.cargo).toHaveLength(1);
    expect(get().journal.some((l) => /aucun marchand intéressé/.test(l))).toBe(true);
  });

  it('1ʳᵉ recherche d’acheteur ratée (d100 > nombre visé), la 2ᵉ sur la moitié du lot au MÊME nombre visé trouve preneur (MDG 15 l.362)', async () => {
    const hero = makePregens()[0];
    setup({ taille: 5, richesse: 1, production: [] }, [hero]); // nombre visé 50 (MDG 15 l.362)
    imposeD100(51, 50);
    get().portSellCargo(0);
    await drain();
    expect(get().pendingCascade).toBeNull();
    expect(get().journal.some((l) => /la moitié \(20 Enc\) trouve preneur/.test(l))).toBe(true);
    expect(get().vessel!.cargo).toEqual([{ cargoId: 'bois', enc: 20, basePriceGold: 10 }]); // moitié vendue
  });

  it('port SANS relation au bien, marchandeur compétent (skill 90) → Marchandage joué, gain crédité et journalisé', async () => {
    const hero = makePregens()[0];
    setSkill(hero, 'marchandage', 90);
    setup({ taille: 10, richesse: 4, production: [] }, [hero]);
    const before = partyMoneyTotal(get).gold;
    get().portSellCargo(0);
    await drain();
    expect(get().pendingCascade).toBeNull();
    expect(get().vessel!.cargo).toHaveLength(0);
    expect(partyMoneyTotal(get).gold).toBeGreaterThan(before);
    expect(get().journal.some((l) => /Marchandage \(/.test(l))).toBe(true);
  });

  it('déterminisme seedé conservé : rejouer la MÊME graine + même parti produit le MÊME gain (byte-identique)', async () => {
    const hero = makePregens()[0];
    setSkill(hero, 'marchandage', 90);
    setup({ taille: 10, richesse: 4, production: [] }, [hero]);
    get().portSellCargo(0);
    await drain();
    const gainA = partyMoneyTotal(get).gold;

    const hero2 = makePregens()[0];
    setSkill(hero2, 'marchandage', 90);
    setup({ taille: 10, richesse: 4, production: [] }, [hero2]);
    get().portSellCargo(0);
    await drain();
    const gainB = partyMoneyTotal(get).gold;

    expect(gainB).toBe(gainA);
  });
});

/**
 * ACHAT au port (`portBuyCargo`, #266) — le Marchandage d'achat est SURFACÉ par la même cascade
 * `openRoll` (hero-test) que la vente, jamais résolu en silence. Chaque test contrôle l'offre + le parti.
 */
function setupBuy(party: Combatant[], offerEnc = 20, basePrice = 10): void {
  seedBattleRng(1);
  const port = { taille: 4, richesse: 4, production: [] as string[] } as PortProfile;
  set({
    party, scene,
    battle: null,
    worldMap: { id: 'm', nom: 'x', places: [{ id: 'P', label: 'Port', pos: { x: 0, y: 0 }, scene: 'scene-P', port }], routes: [] },
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [], lastVoyageMilles: 0 },
    port: { placeId: 'P', label: 'Port', port: structuredClone(port), freeEnc: 300, maxLoadEnc: 450, offers: [{ cargoId: 'bois', label: 'Bois', enc: offerEnc, basePrice, surplus: false }] },
    journal: [],
    pendingCascade: null,
  } as never);
  if (party.length) creditBourse(get, set, party[0].id, { gold: 5000, silver: 0, brass: 0 }); // bourse du groupe (SOCLE POSSESSIONS #531)
}

describe('portBuyCargo — Marchandage d’achat SURFACÉ par cascade openRoll (#266)', () => {
  beforeEach(() => setRule('test-auto-bands', 'off'));
  afterEach(() => resetRule('test-auto-bands'));

  it('groupe VIDE / sans bourse → aucun marchandeur (résolution synchrone, aucun jet) et achat refusé faute de fonds', () => {
    // Un parti vide ne mène pas seulement à « aucun marchandeur » (tout héros marchande à sa Sociabilité
    // de base : seul un parti vide y échappe) : sous SOCLE POSSESSIONS il n'a AUCUNE bourse, donc l'achat
    // de groupe (`payFromGroup`) est insolvable. La résolution reste SYNCHRONE (pas de cascade) et l'achat
    // est refusé — la cale intacte, la garde de solvabilité de `finalizePortBuy` journalisée.
    setupBuy([]);
    get().portBuyCargo('bois', 10);
    expect(get().pendingCascade).toBeNull(); // pas de marchandeur → pas de modale (résolution directe)
    expect(get().vessel!.cargo).toHaveLength(0); // insolvable → rien n'est embarqué
    expect(get().journal.some((l) => /Aucun marchandeur dans le groupe — prix plein/.test(l))).toBe(true);
    expect(get().journal.some((l) => /ne couvre pas/.test(l))).toBe(true); // garde de solvabilité de groupe
  });

  it('marchandeur présent → le Marchandage OUVRE une cascade (jet SURFACÉ, jamais silencieux)', () => {
    const hero = makePregens()[0];
    setSkill(hero, 'marchandage', 90);
    setupBuy([hero]);
    get().portBuyCargo('bois', 10);
    // Le Marchandage doit se résoudre dans la modale AVANT tout embarquement : cale intacte, cascade ouverte.
    expect(get().pendingCascade).not.toBeNull();
    expect(get().vessel!.cargo).toHaveLength(0);
  });

  it('marchandeur compétent (skill 90) → Marchandage joué, cargaison embarquée, remise journalisée', async () => {
    const hero = makePregens()[0];
    setSkill(hero, 'marchandage', 90);
    setupBuy([hero]);
    const before = partyMoneyTotal(get).gold;
    get().portBuyCargo('bois', 10);
    await drain();
    expect(get().pendingCascade).toBeNull();
    expect(get().vessel!.cargo).toHaveLength(1);
    expect(partyMoneyTotal(get).gold).toBeLessThan(before);
    expect(get().journal.some((l) => /Marchandage \(/.test(l))).toBe(true);
  });

  it('déterminisme seedé : rejouer la MÊME graine + même parti produit le MÊME coût', async () => {
    const hero = makePregens()[0];
    setSkill(hero, 'marchandage', 90);
    setupBuy([hero]);
    get().portBuyCargo('bois', 10);
    await drain();
    const spentA = 5000 - partyMoneyTotal(get).gold;

    const hero2 = makePregens()[0];
    setSkill(hero2, 'marchandage', 90);
    setupBuy([hero2]);
    get().portBuyCargo('bois', 10);
    await drain();
    const spentB = 5000 - partyMoneyTotal(get).gold;

    expect(spentB).toBe(spentA);
  });
});

/** Étape de Marchandage portuaire POSÉE par la porte (`portBuyCargo` → `openRoll`), jet du héros rendu (`sl`). */
function etapeMarchandage(hero: Combatant, kind: string, sl: number, success: boolean, meta: CascadeStep['meta']): CascadeStep {
  setupBuy([hero]);
  get().portBuyCargo('bois', 20);
  const posee = get().pendingCascade!.participants[0];
  set({ pendingCascade: null } as never);
  return { ...posee, id: kind, kind, meta, result: { roll: 50, target: 60, sl, success } };
}
const ligneDe = (kind: string, step: CascadeStep, actor: Combatant): string => {
  const out = cascadeAppliers[kind].apply(get, set, step, actor, { steps: [step], index: 0 });
  return resultLine((out && 'consequences' in out ? out.consequences : undefined) ?? []);
};

describe('Marchandage portuaire et Négociateur (MDG 15 l.335/385 → LDB 59 l.43, LDB 10 l.818 ; arbitrage #2547)', () => {
  beforeEach(() => setRule('test-auto-bands', 'off'));
  afterEach(() => resetRule('test-auto-bands'));

  it('achat : PJ Négociateur gagnant de 6 DR ou plus → remise de 30 %', () => {
    const hero = makePregens()[0];
    hero.talents = [...hero.talents, { talentId: 'negociateur', times: 1 }];
    const step = etapeMarchandage(hero, 'port-buy-bargain', 9, true, { cargoId: 'bois', want: 20, basePrice: 10, merchantValue: 40, merchantNegotiator: false, sellerDR: 0 });
    imposeD100(95); // le commerçant (40) rate : DR −5
    expect(ligneDe('port-buy-bargain', step, hero)).toMatch(/remise de 30 %/);
  });

  it('vente : l’acheteur Négociateur l’emporte de moins de 6 DR → le prix d’offre baisse de 20 %', () => {
    const hero = makePregens()[0];
    const step = etapeMarchandage(hero, 'port-sell-bargain', -3, false, { cargoIndex: 0, sellEnc: 20, offerPct: 100, merchantValue: 50, merchantNegotiator: true, sellerDR: 0 });
    setup({ taille: 4, richesse: 4, production: [] } as unknown as PortProfile, [hero]);
    imposeD100(40); // l’acheteur (50) réussit : DR +1
    expect(ligneDe('port-sell-bargain', step, hero)).toMatch(/: -20 %/);
  });
});
