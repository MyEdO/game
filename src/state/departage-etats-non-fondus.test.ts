import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { seedBattleRng, battleRng } from './battleRng';
import { setRule, resetRule } from '../engine/policy';
import { creditBourse } from './bourseFlow';
import { cascadeAppliers } from './cascade';
import { resultLine } from './rollSeam';
import { rollMerchantSkill, rollMerchantOpposition, type PortProfile } from '../engine/seaVoyage';
import { rollMerchantSkill as rollLandMerchantSkill } from '../engine/landCargo';
import { landBuyCargo } from './landMarketFlow';
import { d100 } from '../engine/dice';
import { evaluateTest } from '../engine/tests';
import { testValue, skillBaseValue } from '../engine/skills';
import { addCondition, COND } from '../engine/conditions';
import type { Possession } from '../engine/possession';
import type { CascadeStep } from './pendings';
import type { Combatant, SkillInstance } from '../engine/types';

/**
 * DÉPARTAGE d'un Marchandage OPPOSÉ sous ÉTAT (LDB 12 l.160, verbatim `12 - Tests.md` l.160 : « Si les
 * deux participants obtiennent le même DR, c'est le groupe avec la Compétence ou la Caractéristique la
 * plus élevée qui l'emporte »). La pénalité d'État (−10 d'Empoisonné, LDB 16, `etats.json`) est un
 * MODIFICATEUR : elle abaisse la CIBLE du Test, jamais la Compétence. Un héros Empoisonné dont la
 * Compétence dépasse celle du marchand doit donc l'emporter à DR égal — c'est ce que la base FONDUE
 * (`testValue`) volait au port et au marché terrestre.
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

const NUE = 45; // Niveau de Compétence en Marchandage (LDB 09 l.17)
const ETAT = -10; // pénalité d'Empoisonné aux Tests (LDB 16, `etats.json` passive testMod)

function setSkill(c: Combatant, skillId: string, advances: number): void {
  const ex = c.skills.find((s) => s.id === skillId);
  if (ex) ex.advances = advances;
  else c.skills.push({ id: skillId, advances } as SkillInstance);
}

/** Cale le Niveau de Compétence NU de `c` à EXACTEMENT `want`, puis l'Empoisonne. */
function marchandeurEmpoisonne(c: Combatant): Combatant {
  setSkill(c, 'marchandage', 0);
  setSkill(c, 'marchandage', NUE - skillBaseValue(c, 'marchandage'));
  addCondition(c, COND.empoisonne);
  return c;
}

const scene = { id: 'scene-P', label: 'Port', dimensions: { w: 2, h: 2 }, layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }], entities: [], dialogues: [], triggers: [] } as never;
const PORT: PortProfile = { taille: 4, richesse: 4, production: [] } as PortProfile;
const LOT_ENC = 40;

/** Port + navire + offre ; le lot est acheté EN ENTIER (aucun +DR de lot partiel, MDG 15 l.339-341). */
function setupPort(party: Combatant[]): void {
  set({
    party, scene,
    battle: null,
    worldMap: { id: 'm', nom: 'x', places: [{ id: 'P', label: 'Port', pos: { x: 0, y: 0 }, scene: 'scene-P', port: PORT }], routes: [] },
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [], lastVoyageMilles: 0 },
    port: { placeId: 'P', label: 'Port', port: structuredClone(PORT), freeEnc: 300, maxLoadEnc: 450, offers: [{ cargoId: 'bois', label: 'Bois', enc: LOT_ENC, basePrice: 10, surplus: false }] },
    journal: [],
    pendingCascade: null,
  } as never);
  creditBourse(get, set, party[0].id, { gold: 5000, silver: 0, brass: 0 });
}

/** Rejoue la séquence de tirages du Marchandage portuaire : la valeur du marchand (posée à
 *  l'ouverture de l'étape) puis son jet opposé (tiré par l'applier). */
function probePort(seed: number): { merchant: number; merchantSL: number } {
  seedBattleRng(seed);
  const rng = battleRng();
  const merchant = rollMerchantSkill(false, rng).value;
  const merchantSL = rollMerchantOpposition(merchant, rng).sl;
  return { merchant, merchantSL };
}

/** Cherche une graine DISCRIMINANTE : Compétence du marchand STRICTEMENT entre la valeur de Test
 *  Empoisonnée (`NUE + ETAT`) et la Compétence NUE — la seule fenêtre où le critère de départage se
 *  voit — et un dé de héros qui égalise les DR (`want` renseigne le dé à poser). */
function findSeed(probe: (s: number) => { merchant: number; merchantSL: number }, heroTarget: number): { seed: number; merchant: number; die: number; sl: number } {
  for (let seed = 1; seed <= 2000; seed++) {
    const { merchant, merchantSL } = probe(seed);
    if (merchant <= NUE + ETAT || merchant >= NUE) continue;
    for (let die = 1; die <= 99; die++) {
      if (die > heroTarget) continue; // le héros doit RÉUSSIR (un échec DR négatif ne prouve rien ici)
      if (evaluateTest(die, heroTarget).sl === merchantSL) return { seed, merchant, die, sl: merchantSL };
    }
  }
  throw new Error('aucune graine discriminante trouvée');
}

describe('#1153 L2 — PORT : l’État ne se fond plus dans la grandeur du départage (LDB 12 l.160)', () => {
  beforeEach(() => setRule('test-auto-bands', 'off'));
  afterEach(() => resetRule('test-auto-bands'));

  it('la porte du seam pose la Compétence NUE en `base` et laisse l’État dans la CIBLE', () => {
    const [leader] = makePregens();
    marchandeurEmpoisonne(leader);
    setupPort([leader]);
    seedBattleRng(1);
    get().portBuyCargo('bois', LOT_ENC);
    const step = get().pendingCascade!.participants[0] as CascadeStep;
    expect(testValue(leader, 'marchandage')).toBe(NUE + ETAT); // l'État pèse sur la valeur de Test…
    expect(step.base).toBe(NUE); // …mais PAS sur la Compétence (LDB 09 l.17)
    expect(step.target).toBe(NUE + ETAT); // CIBLE INVARIANTE : elle reste la valeur de Test fondue
  });

  it('ACHAT, DR égal : le marchandeur Empoisonné l’emporte par sa Compétence — remise, jamais surcoût', () => {
    const [leader] = makePregens();
    marchandeurEmpoisonne(leader);
    setupPort([leader]);
    const { seed, merchant, die, sl } = findSeed(probePort, NUE + ETAT);
    expect(merchant).toBeGreaterThan(NUE + ETAT); // la valeur de Test EMPOISONNÉE perdrait (le piège)
    expect(merchant).toBeLessThan(NUE); // …la Compétence NUE, elle, l'emporte (l.160)
    seedBattleRng(seed);
    get().portBuyCargo('bois', LOT_ENC);
    const opened = get().pendingCascade!.participants[0] as CascadeStep;
    expect(opened.meta?.merchantValue).toBe(merchant);
    const step = { ...opened, result: { roll: die, target: opened.target!, sl, success: true } } as CascadeStep;
    const out = cascadeAppliers['port-buy-bargain'].apply(get, set, step, leader, { steps: [step], index: 0 });
    const line = resultLine((out && 'consequences' in out ? out.consequences : undefined) ?? []);
    expect(line).toMatch(/remise de \d+ %/);
    expect(line).not.toMatch(/surcoût/);
  });
});

// ── Marché TERRESTRE (MSRC 13 l.127-131) : même départage, flux synchrone ────────────────────────

const LAND_CARRIER = 'convoi-test';
const convoiPossession = (ownerId: string): Possession =>
  ({ uid: LAND_CARRIER, ownerId, nature: 'vehicule', vehicleId: 'diligence', location: { kind: 'avec-le-groupe' }, items: [] }) as Possession;

function setupLand(): Combatant {
  const [leader] = makePregens();
  marchandeurEmpoisonne(leader);
  set({
    party: [leader], scene, battle: null, vessel: null,
    worldMap: null, possessions: [convoiPossession(leader.id)],
    landMarket: {
      placeId: 'L', label: 'Grünburg', market: { taille: 10, richesse: 4, produits: [] },
      offers: [{ cargoId: 'vin', label: 'Vin', enc: LOT_ENC, basePrice: 10, wine: false }],
    },
    journal: [],
    pendingCascade: null,
  } as never);
  creditBourse(get, set, leader.id, { gold: 5000, silver: 0, brass: 0 });
  return leader;
}

/** Rejoue la séquence de `landBuyCargo` : marchand 2d10+30 (l.129), puis les deux d100 opposés. */
function probeLandBuy(seed: number): { merchant: number; merchantSL: number; heroRoll: number } {
  seedBattleRng(seed);
  const rng = battleRng();
  const merchant = rollLandMerchantSkill(rng);
  const heroRoll = d100(rng);
  return { merchant, merchantSL: evaluateTest(d100(rng), merchant).sl, heroRoll };
}

const bargainLineOf = (): string => get().journal.find((l) => /Marchandage \(/.test(l)) ?? '';

describe('#1153 L2 — MARCHÉ TERRESTRE : l’État ne se fond plus dans la grandeur du départage', () => {
  beforeEach(() => setRule('test-auto-bands', 'off'));
  afterEach(() => resetRule('test-auto-bands'));

  it('ACHAT, DR égal : le marchandeur Empoisonné l’emporte par sa Compétence — remise, jamais surcoût', () => {
    // Ici le dé du héros est TIRÉ par le flux : on cherche la graine où il égalise déjà les DR.
    let found: { seed: number; merchant: number } | null = null;
    for (let seed = 1; seed <= 4000 && !found; seed++) {
      const p = probeLandBuy(seed);
      if (p.merchant <= NUE + ETAT || p.merchant >= NUE) continue;
      const hero = evaluateTest(p.heroRoll, NUE + ETAT);
      if (hero.success && hero.sl === p.merchantSL) found = { seed, merchant: p.merchant };
    }
    expect(found).not.toBeNull();
    const leader = setupLand();
    expect(testValue(leader, 'marchandage')).toBe(NUE + ETAT);
    expect(skillBaseValue(leader, 'marchandage')).toBe(NUE);
    expect(found!.merchant).toBeGreaterThan(NUE + ETAT);
    expect(found!.merchant).toBeLessThan(NUE);
    seedBattleRng(found!.seed);
    landBuyCargo(get, set, 'vin', LOT_ENC);
    expect(bargainLineOf()).toMatch(/remise de \d+ %/);
    expect(bargainLineOf()).not.toMatch(/surcoût/);
  });
});
