import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { resolveSurface, surfaceDesEtapes, buildBand, surfaceOf, tableStep, displayStep, type RollRequest } from './rollSeam';
import { actorIn } from './combatants';
import { runCascadeImmediate, lireDeEtape, tableStepDef, naturalRollForTableRow, rollTableStep, registerTableStep, startCascade, pushStep, registerCascadeApplier, suspendActiveCascade, poserCurseurCascade, stepReady } from './cascade';
import { fixtureText } from '../i18n/fixtureText';
import { makePregens } from '../data/pregens';
import { emptyScene, type Scene } from './scene';
import { campaignStart } from '../engine/clock';
import { setRule, resetRule } from '../engine/policy';
import { buildSeaPlan, runSeaDay } from './seaVoyageFlow';
import type { CascadeStep } from './pendings';
import { weather } from '../data';
import { weatherFromRoll, type Season } from '../engine/travelStages';
import { buildAuthorPerilSteps } from './authorPerils';
import { DE_NON_NOMME } from './etalLot';
import type { MapRoute } from './worldMap';
import { WORLD_STEP_OWNER, seatOwns, canFixDie } from './netOwnership';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import { setCadence, resetCadence } from '../engine/cadence';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { seedBattleRng, battleRng } from './battleRng';
import { landSellCargo, openLandMarket } from './landMarketFlow';
import { persistCarriersCargo } from './carriers';
import { createHero, skillCharacteristicById } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { buildScene } from './mapSpec';
import type { Combatant, SkillInstance } from '../engine/types';
import type { WorldMap } from './worldMap';
import type { LandMarketProfile } from '../engine/landCargo';
import type { CargoLot } from '../engine/cargo';
import type { Possession } from '../engine/possession';

/**
 * LE DÉ DE MONDE SOUS CONTRÔLE DU SIÈGE ENVIRONNEMENT (#1426).
 *
 * UN SEUL prédicat décide qu'un jet se joue dans une fenêtre : `rollSeam.surfaceOf`, keyé par le
 * PORTEUR. Le monde (`WORLD_STEP_OWNER`) est toujours tenu par un siège humain — le siège MJ s'il
 * existe, l'hôte sinon (`netOwnership.worldSeat`) — donc son dé se VOIT et se JOUE comme celui d'un
 * héros. L'option de confort « Dés fixés » n'entre pas dans cette surface : elle n'ajoute que la POSE
 * du dé (`canFixDie`). Seule la cadence déférée à un automate rend le monde muet.
 *
 * Ce que ces cas verrouillent, dans l'ordre où ils peuvent casser :
 *  1. la surface d'un jet de monde en solo — la fenêtre s'ouvre, option OFF comme ON ;
 *  2. la DOMINATION de la cadence auto, qui ne se renverse pas ;
 *  3. la coop — la fenêtre suit le siège MJ, jamais « l'hôte par défaut » ;
 *  4. la PARITÉ terre/mer du commerce (`landSellCargo`), passé par la porte ;
 *  5. le FLUX RNG, identique quelle que soit l'option de pose.
 */

const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

/** Une requête de jet de MONDE minimale — la forme exacte que monte `openWorldTest`. */
const requeteMonde = (): RollRequest => ({
  side: { worldSide: 'world' },
  actionLabel: 'Trouver un acheteur',
  test: {},
  difficulty: 'intermediaire',
});

describe('#1426 socle — un siège qui POSSÈDE le monde VOIT son dé (resolveSurface, côté worldSide)', () => {
  beforeEach(() => {
    resetDesFixes();
    resetCadence();
    set({ net: { ...get().net, mode: 'local', mySeat: 0, gmSeat: undefined } });
  });
  afterEach(() => { resetDesFixes(); resetCadence(); });

  it('le siège local possède le monde → M : il VOIT son dé, option de pose ÉTEINTE (elle ne gate que la POSE)', () => {
    expect(seatOwns(get(), 0, WORLD_STEP_OWNER), 'précondition : le siège 0 possède le monde en solo').toBe(true);
    expect(canFixDie(get(), WORLD_STEP_OWNER), 'option OFF : rien à poser').toBe(false);
    expect(resolveSurface(get, requeteMonde(), 'x'), 'et pourtant la fenêtre s’ouvre : posséder, c’est voir').toBe('M');
  });

  it('CONTRÔLE POSITIF — la surface d’un jet de monde est celle d’un jet de HÉROS, même montage', () => {
    const h = makePregens()[0];
    set({ party: [h], battle: null });
    const requeteHeros = (): RollRequest => ({
      side: { actorId: h.id }, actionLabel: 'Test de héros', test: {}, difficulty: 'intermediaire',
    });
    const series = (r: () => RollRequest) => {
      resetDesFixes(); resetCadence();
      const manuelOff = resolveSurface(get, r(), 'x');
      setDesFixes(true);
      const manuelOn = resolveSurface(get, r(), 'x');
      setCadence('rapide');
      const auto = resolveSurface(get, r(), 'x');
      resetDesFixes(); resetCadence();
      return { manuelOff, manuelOn, auto };
    };
    expect(series(requeteMonde), 'un porteur MONDE et un porteur HÉROS traversent le MÊME prédicat').toEqual(series(requeteHeros));
    expect(series(requeteMonde), 'et la série discrimine bien la cadence').toEqual({ manuelOff: 'M', manuelOn: 'M', auto: 'I' });
  });

  it('la cadence AUTO domine toujours : auto + option ON reste I (le précédent ne se renverse pas)', () => {
    setDesFixes(true);
    setCadence('rapide');
    expect(resolveSurface(get, requeteMonde(), 'x')).toBe('I');
  });

  /**
   * HÔTE-MJ (#1479) — le montage le plus courant hors coop dédiée : le siège 0 est à la fois l'hôte,
   * le MJ et le siège à qui les héros sont attribués (`net.ownership`). « Le siège MJ possède tous les
   * porteurs » y est VRAI pour un héros — et rendait donc V, la fenêtre « que le MJ voit et lance »,
   * là où c'est SON joueur qui doit la jouer. V ne se décide pas sur la POSSESSION seule mais sur la
   * ROUTE de possession (`conduitParLeSiegeDuMonde` : monde, ennemi de bac-à-sable).
   */
  it('HÔTE-MJ (`gmSeat` === siège du héros) : le héros garde SA fenêtre (M) ; le dé de MONDE, lui, rend V', () => {
    const h = makePregens()[0];
    set({ party: [h], battle: null });
    set({ net: { ...get().net, mode: 'host', mySeat: 0, gmSeat: 0, ownership: { [h.id]: 0 } } });
    expect(seatOwns(get(), 0, h.id), 'précondition : le siège MJ POSSÈDE bien ce héros').toBe(true);
    const requeteHeros = (): RollRequest => ({ side: { actorId: h.id }, actionLabel: 'Résistance', test: {}, difficulty: 'intermediaire' });
    expect(resolveSurface(get, requeteHeros(), 'x'), 'possédé par le siège MJ n’est pas CONDUIT par lui — le joueur roule son héros').toBe('M');
    const bande = buildBand(get, {
      id: 'b', kind: 'x', label: fixtureText('Bande'), difficulty: 'intermediaire',
      porteurs: [{ actor: h, ligne: { test: { skill: 'resistance', char: 'endurance' } } }],
    })!;
    expect(surfaceDesEtapes(get, [bande]), 'la SÉQUENCE répond comme la requête — même calcul').toBe('M');
    expect(resolveSurface(get, requeteMonde(), 'x'), 'CONTRÔLE : le dé de MONDE, même montage, revient au MJ').toBe('V');
    set({ net: { ...get().net, ownership: {} } });
  });

  it('coop AVEC siège MJ : V (le MJ voit/lance), et la possession du monde SUIT ce siège', () => {
    set({ net: { ...get().net, mode: 'host', mySeat: 0, gmSeat: 1 } });
    expect(resolveSurface(get, requeteMonde(), 'x')).toBe('V');
    expect(seatOwns(get(), 1, WORLD_STEP_OWNER), 'la fenêtre appartient au siège MJ').toBe(true);
    expect(seatOwns(get(), 0, WORLD_STEP_OWNER), 'et plus à l’hôte').toBe(false);
    setDesFixes(true);
    expect(resolveSurface(get, requeteMonde(), 'x'), 'l’option ne déplace pas une fenêtre déjà due au MJ').toBe('V');
  });

  /**
   * IL N'Y A PLUS DE CLASSE DE JET (#1479) — un Test SUBI (Scorbut, maladie, péril) est un Test : sa
   * surface se dérive de son PORTEUR, exactement comme celle d'un jet volontaire. Utilisateur
   * (2026-08-24) : « On a pas 36 types de jets différents dans l'application […] A partir du moment ou
   * je dois faire un jet, il doit apparaitre. Y'a pas de "classe spéciale" si je suis a l'initiative,
   * que je le subit, face a un adversaire ou face a ... une maladie ». Ce qui DIFFÈRE entre les deux
   * séries ci-dessous n'est donc pas la « classe » mais QUI TIENT le dé : le siège MJ tient le monde
   * (V), le joueur tient son héros (M).
   */
  it('un Test SUBI et un jet volontaire du MÊME porteur rendent la MÊME série (la classe a disparu)', () => {
    const h = makePregens()[0];
    set({ party: [h], battle: null });
    const requete = (side: RollRequest['side'], actionLabel: string) => (): RollRequest => ({ side, actionLabel, test: {}, difficulty: 'intermediaire' });
    const serie = (r: () => RollRequest) => {
      resetCadence();
      set({ net: { ...get().net, mode: 'local', mySeat: 0, gmSeat: undefined } });
      const solo = resolveSurface(get, r(), 'x');
      set({ net: { ...get().net, mode: 'host', mySeat: 0, gmSeat: 1 } });
      const mj = resolveSurface(get, r(), 'x');
      set({ net: { ...get().net, mode: 'local', mySeat: 0, gmSeat: undefined } });
      setCadence('rapide');
      const auto = resolveSurface(get, r(), 'x');
      resetCadence();
      return { solo, mj, auto };
    };
    const subiParHeros = serie(requete({ actorId: h.id }, 'Scorbut'));
    expect(subiParHeros, 'l’intitulé du jet ne change pas sa surface — seul le porteur la décide')
      .toEqual(serie(requete({ actorId: h.id }, 'Ragot')));
    expect(subiParHeros, 'un jet que le joueur doit faire APPARAÎT, subi ou non').toEqual({ solo: 'M', mj: 'M', auto: 'I' });
    // Et le PORTEUR discrimine bien : le dé du MONDE revient au siège MJ quand il existe (V).
    expect(serie(requeteMonde), 'le dé de monde va au siège qui le tient').toEqual({ solo: 'M', mj: 'V', auto: 'I' });
  });
});

/** Un ennemi minimal EN FILE — de quoi juger qui le TIENT, rien de plus. */
const ennemiDeSonde = (): Combatant =>
  ({ id: 'e-sonde', kind: 'enemy', name: 'Sonde', pos: { x: 0, y: 0 }, conditions: [], skills: [], wounds: { current: 5, max: 5 } } as unknown as Combatant);
const enFile = (cs: Combatant[]) => ({ combatants: cs, order: cs.map((c) => c.id), turn: 0, round: 1, log: [], over: null } as never);

/**
 * LA SURFACE SE JUGE SUR L'ID DU PORTEUR (#1426) — `surfaceOf` ne reçoit qu'un id, et la résolution de
 * cet id (`netOwnership.tenuParUnHumain`) décide seule. Deux vérités que cette résolution doit tenir,
 * et qu'une recherche « file de combat OU groupe » (`actorIn`) ou une lecture de possession brute
 * (`seatOwns`) rendraient fausses :
 *  - un héros du GROUPE resté hors de la file d'un combat ouvert reste tenu par son siège ;
 *  - un ennemi sans siège MJ est POSSÉDÉ par repli (l'hôte exécute pour l'automate qui le conduit) sans
 *    être TENU par un humain — son étape se résout d'office.
 */
describe('#1426 socle — la surface se juge sur l’ID du porteur (combat comme hors combat)', () => {
  beforeEach(() => {
    resetDesFixes();
    resetCadence();
    set({ net: { ...get().net, mode: 'local', mySeat: 0, gmSeat: undefined }, pendingCascade: null });
  });
  afterEach(() => { resetDesFixes(); resetCadence(); set({ battle: null }); });

  it('héros du GROUPE resté hors de la file d’un combat OUVERT : son siège le tient → surfacé', () => {
    const [h1, h2] = makePregens();
    set({ party: [h1!, h2!], battle: enFile([h1!, ennemiDeSonde()]) });
    expect(actorIn(get(), h2!.id), 'précondition : la recherche « file OU groupe » ne le trouve pas').toBeUndefined();
    expect(surfaceOf(get, h2!.id), 'il est pourtant dans le groupe, tenu par le siège 0').toBe(true);
  });

  it('ennemi sans siège MJ : possédé par REPLI, tenu par personne → d’office (et surfacé dès qu’un MJ siège)', () => {
    const e = ennemiDeSonde();
    set({ party: makePregens().slice(0, 1), battle: enFile([e]) });
    expect(seatOwns(get(), 0, e.id), 'le repli de possession rend vrai — c’est l’ACTION, pas la tenue du dé').toBe(true);
    expect(surfaceOf(get, e.id), 'aucun humain ne le tient : son étape se résout d’office').toBe(false);
    set({ net: { ...get().net, mode: 'host', mySeat: 0, gmSeat: 1 } });
    expect(surfaceOf(get, e.id), 'un siège MJ le tient : elle se surface').toBe(true);
  });

  it('porteur nommé mais INCONNU (mort, hors partie) : aucun siège → d’office', () => {
    set({ party: makePregens().slice(0, 1), battle: null });
    expect(surfaceOf(get, 'porteur-fantome')).toBe(false);
  });
});

// ── PARITÉ TERRE/MER du commerce : `landSellCargo` passe par `openWorldTest` ─────────────────────

function skill(c: Combatant, skillId: string, advances: number): void {
  const ex = c.skills.find((s) => s.id === skillId && s.spec == null);
  if (ex) ex.advances = Math.max(ex.advances, advances);
  else c.skills.push({ id: skillId, characteristic: skillCharacteristicById(skillId), advances } as SkillInstance);
}

const CARRIER_ID = 'convoi-1';
const profile = (extra: Partial<LandMarketProfile> = {}): LandMarketProfile => ({ taille: 4, richesse: 4, produits: ['commerce', 'vin'], ...extra });
const lot: CargoLot = { cargoId: 'vin', enc: 40, basePriceGold: 10 };
const marche = (id: string, label: string) => buildScene({ id, label, desc: '.', size: [8, 6], terrain: 'planches', heroStart: [2, 3] });

function carte(): WorldMap {
  return {
    id: 'm', label: 'Le Reik',
    places: [{ id: 'B', label: 'Altdorf', pos: { x: 0, y: 0 }, scene: 'marche-b', market: profile() }],
    routes: [],
  };
}

/** Marché ouvert à Altdorf, un lot de 40 Enc sur le convoi, option « Dés fixés » ACTIVE (le dé se pose). */
function marcheAvecLot(): void {
  seedBattleRng(7);
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'marchand', label: 'Artur', motivation: 'x', rng: makeRNG(11), id: 't-artur' });
  skill(h, 'marchandage', 60);
  get().setParty([h]);
  get().loadProject([marche('marche-b', 'Altdorf')], 'marche-b', carte());
  const convoi: Possession = { uid: CARRIER_ID, ownerId: h.id, nature: 'vehicule', vehicleId: 'diligence', location: { kind: 'avec-le-groupe' }, items: [] };
  set({
    landMarket: { placeId: 'B', label: 'Altdorf', market: profile(), offers: [] },
    tradeRumours: [], journal: [], pendingCascade: null, possessions: [convoi],
  });
  set(persistCarriersCargo(get(), [{ carrierId: CARRIER_ID, cargo: [{ ...lot }] }]));
}

/** Pose le dé de l'étape COURANTE puis valide — le geste exact qu'offre la fenêtre au siège du monde. */
function poser(roll: number): void {
  const p = get().pendingCascade!;
  const cur = p.participants[p.cursor];
  // Le geste de la rangée : LANCER puis SUBSTITUER (couple atomique, `withPreRollFixedDie`), enfin
  // valider — c'est la séquence exacte que produit le champ de dé fixé (`ui/forcedDieRow.ts`).
  get().cascadeRoll(cur.id);
  get().cascadeSetForcedRoll(cur.id, roll);
  get().cascadeNext();
  vi.runAllTimers();
}

/** Le geste SANS option de pose : « Lancer » puis valider — tout ce que la fenêtre offre alors. */
function lancer(): void {
  const p = get().pendingCascade!;
  const cur = p.participants[p.cursor];
  get().cascadeRoll(cur.id);
  get().cascadeNext();
  vi.runAllTimers();
}

/**
 * FLUX RNG — l'invariant que la surface ne doit PAS payer : l'ordre des dés consommés par la vente
 * (acheteur → marchand → Marchandage opposé) ne dépend NI de l'option de pose, NI de la fenêtre. Le
 * dé d'acheteur est un dé de MONDE : il se joue dans sa fenêtre (« Lancer ») au lieu de tomber en
 * silence, mais il tombe au MÊME rang — donc le MÊME gain sous la MÊME graine. Aucun autre test du
 * dépôt ne verrouille cet ordre pour le marché TERRESTRE : `land-market-flow.test.ts` compare des
 * gains ENTRE EUX (rumeur ×2), ce qu'un décalage de flux laisse passer intact.
 */
describe('#1426 — le flux RNG de la vente terrestre ne dépend pas de l’option de pose', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); resetDesFixes(); resetCadence(); set({ net: { ...get().net, mode: 'local', mySeat: 0, gmSeat: undefined } }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetDesFixes(); resetCadence(); });

  it('sous graine FIXE, la vente jouée AU LANCER rend un gain EXACT (un dé de plus/de moins le change)', () => {
    marcheAvecLot();
    resetDesFixes(); // `marcheAvecLot` ne pose rien : c'est le `beforeEach` qui décide de l'option
    seedBattleRng(3);
    landSellCargo(get, set, CARRIER_ID, 0);
    expect(get().pendingCascade, 'le siège du monde tient la fenêtre : elle s’ouvre même sans option de pose').toBeTruthy();
    lancer(); // 1ʳᵉ tentative : le dé se LANCE (aucune pose), c'est le geste sans option
    if (get().pendingCascade) lancer(); // 2ᵉ tentative (moitié du lot) quand la 1ʳᵉ rate
    const vente = get().journal.find((l) => l.includes('vendus'));
    expect(vente, 'la vente a bien eu lieu').toBeTruthy();
    // Valeur MESURÉE sur la graine 3 : elle ne vaut que par sa STABILITÉ — inverser deux tirages
    // (marchand avant acheteur, ou un dé consommé en trop) la déplace.
    // Graine 3 : le 1ᵉʳ dé d'acheteur RATE, le 2ᵉ passe sur la moitié du lot — donc la BRANCHE de
    // reprise est jouée, puis le marchand et le Marchandage tirent DERRIÈRE, dans cet ordre.
    expect(get().journal.some((l) => l.includes('la moitié (20 Enc) trouve preneur'))).toBe(true);
    expect(vente).toBe('20 Enc de Vin/Eau-de-vie vendus (mise à prix 105 % du base — Artur — Marchandage (77 vs 49) : +10 %.) : 231 CO.');
  });
});

describe('#1426 — « Trouver un acheteur » terrestre passe par la porte (MSRC 13 l.146, parité portFlow)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); resetDesFixes(); resetCadence(); setDesFixes(true); set({ net: { ...get().net, mode: 'local', mySeat: 0, gmSeat: undefined } }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetDesFixes(); resetCadence(); });

  it('le dé d’acheteur OUVRE une étape de MONDE (plus aucune résolution muette au journal)', () => {
    marcheAvecLot();
    landSellCargo(get, set, CARRIER_ID, 0);
    const p = get().pendingCascade;
    expect(p, 'la vente ouvre une fenêtre au lieu de trancher en silence').toBeTruthy();
    const step = p!.participants[p!.cursor];
    expect(step.kind).toBe('land-sell-buyer');
    expect(step.worldOwner, 'étape de MONDE : aucun acteur ne la porte, le sentinel la route au siège').toBe(true);
    expect(step.actorId).toBeUndefined();
    // La cible EST la Demande du Lieu (Taille 4 × 10 + 30 Commerce) — posée par le call-site en
    // `meta.baseValue`, jamais recalculée par la porte.
    expect(step.target).toBe(70);
  });

  it('1ʳᵉ tentative RÉUSSIE : la vente se conclut, SANS le message de moitié', () => {
    marcheAvecLot();
    landSellCargo(get, set, CARRIER_ID, 0);
    poser(1); // ≤ 70 → acheteur trouvé
    const j = get().journal.join('\n');
    expect(j).not.toContain('la moitié');
    expect(j).toContain('40 Enc de Vin/Eau-de-vie vendus'); // le lot ENTIER part
  });

  it('1ʳᵉ ratée → 2ᵉ tentative sur la MOITIÉ du lot, à la MÊME Demande (l.146 verbatim)', () => {
    marcheAvecLot();
    landSellCargo(get, set, CARRIER_ID, 0);
    poser(99); // > 70 → pas d'acheteur pour tout le lot
    const p = get().pendingCascade;
    expect(p, 'la 2ᵉ tentative est une SECONDE étape posable').toBeTruthy();
    const step = p!.participants[p!.cursor];
    expect(step.kind).toBe('land-sell-buyer');
    expect(step.target, '« lancez à nouveau le dé en l’opposant au nombre précédemment obtenu »').toBe(70);
    expect(step.meta?.sellEnc, 'la MOITIÉ du lot, pas la moitié de la Demande').toBe(20);
  });

  it('2ᵉ tentative RÉUSSIE : le message « la moitié trouve preneur » précède la ligne de vente', () => {
    marcheAvecLot();
    landSellCargo(get, set, CARRIER_ID, 0);
    poser(99);
    poser(1);
    const j = get().journal;
    const demi = j.findIndex((l) => l.includes('la moitié (20 Enc) trouve preneur'));
    const vente = j.findIndex((l) => l.includes('20 Enc de Vin/Eau-de-vie vendus'));
    expect(demi, 'le message de moitié est journalisé').toBeGreaterThanOrEqual(0);
    expect(vente).toBeGreaterThan(demi); // ordre de la résolution synchrone d'origine, préservé
  });

  it('les DEUX tentatives ratées : aucun acheteur, et la ligne NOMME la Demande visée', () => {
    marcheAvecLot();
    landSellCargo(get, set, CARRIER_ID, 0);
    poser(99);
    poser(99);
    expect(get().journal.join('\n')).toContain('aucun acheteur intéressé à Altdorf (Demande 70)');
    expect(get().pendingCascade).toBeNull();
  });
});

// ── Q1 : LE VERBE `stopSequence` ────────────────────────────────────────────────────────────────

/**
 * `stopSequence` — le verbe SYMÉTRIQUE d'`insert` que le contrat d'applier n'avait pas. Une boucle
 * `for (peril) { … break }` savait s'arrêter ; une SÉQUENCE d'étapes ne le savait pas, et c'est
 * précisément ce qui manquait pour transformer les périls d'auteur en dés posables sans changer le
 * flux RNG : sans troncature, les périls suivants rejoueraient leurs dés après le combat.
 */
describe('#1426 Q1 — `stopSequence` TRONQUE la séquence au goulot partagé (parité du `break`)', () => {
  beforeEach(() => {
    resetDesFixes(); resetCadence();
    set({ net: { ...get().net, mode: 'local', mySeat: 0, gmSeat: undefined }, suspendedCascades: [], pendingCascade: null, journal: [] });
  });
  afterEach(() => { resetDesFixes(); resetCadence(); });

  /** Route à 3 périls d'auteur À 100 % ; le rang `interrompt` porte un `startCombat`. */
  const routeAvecPerils = (interrompt: number): MapRoute => ({
    id: 'r1', a: 'A', b: 'B', km: 10, modes: ['pied'],
    perils: [0, 1, 2].map((i) => ({
      label: `P${i}`, chancePct: 100,
      effects: i === interrompt ? [{ type: 'startCombat' as const, encounter: 'enc-x' }] : [{ type: 'journal' as const, desc: `note ${i}` }],
    })),
  } as MapRoute);

  function planSur(route: MapRoute): void {
    set({
      worldMap: { id: 'm', nom: 'm', places: [], routes: [route] } as unknown as WorldMap,
      travelPlan: { routeId: 'r1', fromPlaceId: 'A', toPlaceId: 'B', mode: 'pied', hoursPerDay: 8, km: 10, kmDone: 0, interrupted: false } as never,
    });
  }

  it('le 1ᵉʳ péril qui INTERROMPT tronque : les suivants ne sont NI résolus NI préservés', () => {
    const route = routeAvecPerils(0);
    planSur(route);
    seedBattleRng(5);
    const steps = runCascadeImmediate(get, set, [...buildAuthorPerilSteps(route, 'B', 'voyage-mer')]);
    // UN seul dé tombé : la séquence est tronquée à l'étape courante (3 étapes construites, 1 gardée).
    expect(steps).toHaveLength(1);
    expect(steps[0].result?.roll).toBeGreaterThan(0);
    expect(get().travelPlan!.interrupted).toBe(true);
    // Et RIEN n'est mis de côté pour plus tard : un reste préservé rejouerait ses dés au retour.
    expect(get().suspendedCascades).toEqual([]);
    const j = get().journal.join('\n');
    expect(j).toContain('Péripétie : P0');
    expect(j).not.toContain('P1');
    expect(j).not.toContain('P2');
  });

  it('sans interruption, les TROIS périls se jouent : la troncature ne s’applique pas d’elle-même', () => {
    const route = routeAvecPerils(-1);
    planSur(route);
    seedBattleRng(5);
    const steps = runCascadeImmediate(get, set, [...buildAuthorPerilSteps(route, 'B', 'voyage-mer')]);
    expect(steps).toHaveLength(3);
    expect(get().travelPlan!.interrupted).toBe(false);
  });

  it('l’ORDRE d’authoring EST le flux RNG : permuter les périls change qui reçoit quel dé', () => {
    const des = (perils: MapRoute['perils']) => {
      const route = { ...routeAvecPerils(-1), perils } as MapRoute;
      planSur(route);
      set({ journal: [] });
      seedBattleRng(5);
      return runCascadeImmediate(get, set, [...buildAuthorPerilSteps(route, 'B', 'voyage-mer')])
        .map((s2) => ({ qui: String(s2.label), de: s2.result!.roll }));
    };
    const base = routeAvecPerils(-1).perils!;
    const direct = des(base);
    const permute = des([base[2], base[1], base[0]]);
    expect(direct).not.toEqual(permute);
    // Le FLUX de dés ne bouge pas (même graine, même nombre de tirages) — seuls leurs PORTEURS changent.
    expect(direct.map((x) => x.de)).toEqual(permute.map((x) => x.de));
    expect(direct.map((x) => x.qui)).toEqual([...permute.map((x) => x.qui)].reverse());
  });

  it('JOURNAL — un péril ÉVITÉ laisse SA ligne : 3 périls ratés = 3 lignes, aucune muselée', () => {
    const brut = routeAvecPerils(-1);
    const route = { ...brut, perils: brut.perils!.map((p2) => ({ ...p2, chancePct: 0 })) } as MapRoute;
    planSur(route);
    set({ journal: [] });
    seedBattleRng(5);
    runCascadeImmediate(get, set, [...buildAuthorPerilSteps(route, 'B', 'voyage-mer')]);
    const evites = get().journal.filter((l) => l.includes('Péripétie évitée'));
    expect(evites).toHaveLength(3);
    expect(get().journal.some((l) => l.includes('Péripétie : '))).toBe(false);
  });
});

// ── Q2 : ÉVALUATION « SEUIL PUR » ───────────────────────────────────────────────────────────────

/**
 * Un pourcentage RAW n'est pas un Test. Le RAW écrit « Lancez un d100 : si le résultat est inférieur
 * ou égal au chiffre final, un acheteur est trouvé » (MSRC 13 l.146) et « Lancez 1d100 et si le
 * résultat est inférieur ou égal au nombre visé » (MDG 15 l.362) — quand il veut un Test, il écrit
 * « Test de Ragot Complexe (–10) » trois lignes plus haut, sur la même page.
 *
 * Lu comme un Test, ce dé recevait deux règles que le RAW ne lui donne pas : les bandes automatiques
 * (LDB 12 l.28 — 01-05 réussit, 96-00 échoue quoi qu'il arrive) et l'écrêtage de la cible à 99.
 */
describe('#1426 Q2 — le pourcentage d’auteur se lit « dé ≤ nombre visé », et rien d’autre', () => {
  const faces = [...Array(100)].map((_, i) => i + 1);

  it('nombre visé 100 = 100 % : les 100 faces passent (en Test, 5 échoueraient d’office)', () => {
    expect(faces.filter((r) => lireDeEtape(r, 100, 'seuil').success)).toHaveLength(100);
    expect(faces.filter((r) => lireDeEtape(r, 100).success)).toHaveLength(95);
  });

  it('les bandes automatiques inventent des issues que le seuil ignore (nombre visé bas)', () => {
    const divergentes = faces.filter((r) => lireDeEtape(r, 2, 'seuil').success !== lireDeEtape(r, 2).success);
    expect(divergentes).toEqual([3, 4, 5]); // 01-05 réussit d'office EN TEST, pas sous 2 en seuil
  });

  it('AUCUN Degré de Réussite : un pourcentage n’en a pas (le Test, si)', () => {
    expect(lireDeEtape(11, 70, 'seuil').sl).toBe(0);
    expect(lireDeEtape(11, 70).sl).toBe(6);
  });

  it('la recherche d’acheteur ne parle JAMAIS de DR — ni sur l’étape jouée, ni au journal', () => {
    marcheAvecLot();
    resetDesFixes();
    seedBattleRng(3);
    vi.useFakeTimers();
    landSellCargo(get, set, CARRIER_ID, 0);
    // Le dé d'acheteur est un dé de MONDE : il se joue dans SA fenêtre (#1426). Ce que le joueur LIT
    // de ce dé, c'est donc l'étape (sa rangée + son dénouement), pas une ligne de journal.
    const jouees: CascadeStep[] = [];
    let g = 0;
    while (get().pendingCascade && g++ < 5) {
      const p = get().pendingCascade!;
      const cur = p.participants[p.cursor];
      get().cascadeRoll(cur.id);                                  // « Lancer » : le geste offert SANS option de pose
      jouees.push(get().pendingCascade!.participants[p.cursor]);  // l'étape AVEC son dé tombé
      get().cascadeNext();
      vi.runAllTimers();
    }
    vi.useRealTimers();
    const des = jouees.filter((st) => st.kind === 'land-sell-buyer');
    expect(des.length, 'le dé d’acheteur a bien été joué dans sa fenêtre').toBeGreaterThan(0);
    for (const st of des) {
      expect(st.evaluation, 'un pourcentage RAW n’est pas un Test').toBe('seuil');
      expect(st.result!.sl, 'et un seuil n’a aucun Degré de Réussite').toBe(0);
    }
    for (const l of get().journal) expect(l).not.toMatch(/\bDR\b/);
  });
});

// ── LES TABLES DE MONDE : la pose fonctionne sur chacune ─────────────────────────────────────────

/**
 * Une table de monde n'est utile que si le joueur peut y POSER un dé — et poser un dé n'a de sens que
 * si CHAQUE ligne de la table est atteignable. `naturalRollForTableRow` rend le dé NATUREL à saisir
 * pour viser une ligne, `mod` compris ; `null` = ligne hors d'atteinte.
 *
 * Le piège que ces cas ferment : la Météo a une table PAR SAISON. Si la saison avait été implémentée
 * comme un MODIFICATEUR sur une table unique, le décalage aurait rendu des lignes faussement
 * inatteignables (un `mod` de +30 tue les 30 premiers naturels). Ici la saison choisit la TABLE, donc
 * `mod` vaut 0 et les quatre saisons offrent toutes leurs lignes.
 */
describe('#1426 — la POSE fonctionne sur les tables de monde migrées', () => {
  it('Météo : les 4 saisons couvrent 1..100 sans trou ni chevauchement (table DÉRIVÉE de la donnée)', () => {
    for (const saison of weather) {
      const def = tableStepDef(`stage-weather-${saison.id}`)!;
      expect(def, `table de saison « ${saison.id} » enregistrée`).toBeTruthy();
      expect(def.rows[0].min).toBe(1);
      expect(def.rows[def.rows.length - 1].max).toBe(100);
      for (let i = 1; i < def.rows.length; i++) expect(def.rows[i].min).toBe(def.rows[i - 1].max + 1);
    }
  });

  it('Météo : CHAQUE ligne de CHAQUE saison est atteignable à la pose (aucun mod saisonnier)', () => {
    const inatteignables: string[] = [];
    for (const saison of weather) {
      const tableId = `stage-weather-${saison.id}`;
      const def = tableStepDef(tableId)!;
      for (const row of def.rows) {
        const nat = naturalRollForTableRow({ tableId, spec: { n: 1, sides: 100 } }, row);
        if (nat == null) inatteignables.push(`${tableId}/${row.id}`);
        else expect(weatherFromRoll(nat, saison.id as Season)).toBe(row.id); // le naturel proposé DONNE bien cette ligne
      }
    }
    expect(inatteignables, 'une ligne qu’aucun dé ne peut viser rend la pose menteuse').toEqual([]);
  });

  it('Météo : le dé POSÉ décide de la météo — la table et le résolveur d’origine s’accordent', () => {
    for (const saison of weather) {
      const tableId = `stage-weather-${saison.id}`;
      for (const face of [1, 25, 50, 75, 100]) {
        const r = rollTableStep({ tableId, spec: { n: 1, sides: 100 }, forcedRoll: face }, { int: () => face });
        expect(r.id).toBe(weatherFromRoll(face, saison.id as Season));
      }
    }
  });

  it('Événement de bord : l’Humeur de Manann DÉPLACE la fenêtre atteignable de la table (MDG 15 l.85)', () => {
    const def = tableStepDef('sea-board-events')!;
    expect(def, 'table des événements de bord enregistrée').toBeTruthy();
    // La table court de −9999 à +9999 : le d100 seul n'en atteint qu'une TRANCHE, et l'Humeur la
    // déplace. Une ligne est visable exactement quand sa plage croise [1+mod, 100+mod] — c'est le RAW
    // (une Humeur très haute rend le naufrage inatteignable, une très basse rend la manne impossible).
    const visable = (mod: number, id: string) => {
      const row = def.rows.find((r) => r.id === id)!;
      return naturalRollForTableRow({ tableId: 'sea-board-events', spec: { n: 1, sides: 100 }, ...(mod ? { mod } : {}) }, row) != null;
    };
    expect(visable(0, 'triton'), 'sans Humeur, les lignes très négatives sont hors du d100').toBe(false);
    expect(visable(-200, 'triton'), 'Humeur très basse : le triton devient atteignable').toBe(true);
    expect(visable(0, 'manne-de-manann'), 'sans Humeur, la manne est hors d’atteinte').toBe(false);
    expect(visable(200, 'manne-de-manann'), 'Humeur très haute : la manne s’ouvre').toBe(true);
    // Et à Humeur nulle, la tranche 1..100 offre bien des lignes à viser (la pose n'est pas morte).
    const offertes = def.rows.filter((r) => naturalRollForTableRow({ tableId: 'sea-board-events', spec: { n: 1, sides: 100 } }, r) != null);
    expect(offertes.length, 'au moins une ligne visable sans Humeur').toBeGreaterThan(0);
  });
});

// ── LA FENÊTRE DE LOT D'UN ÉTAL ─────────────────────────────────────────────────────────────────

/**
 * Les dés d'ouverture d'un étal (marchand présent, quantités, prix) sont des dés de MONDE, mais ils
 * ne forment pas une séquence : ils naissent tous ensemble, avant l'écran. D'où la fenêtre de LOT —
 * une rangée posable par dé, validée d'un bloc.
 *
 * Ce que ces cas verrouillent, dans l'ordre où ça peut casser :
 *  (a) option OFF : l'étal est celui d'avant, à l'octet — la fenêtre n'existe pas ;
 *  (b) poser un dé change l'offre correspondante ;
 *  (c) l'ordre des rangées EST l'ordre des dés (permuter = étal différent) ;
 *  (d) option ON + validation sans aucune pose : étal IDENTIQUE au OFF — la fenêtre ne change rien
 *      par sa seule existence.
 */
describe('#1426 — la fenêtre de LOT d’un étal (halle terrestre)', () => {
  beforeEach(() => {
    resetDesFixes(); resetCadence();
    set({ net: { ...get().net, mode: 'local', mySeat: 0, gmSeat: undefined }, pendingEtalLot: null, pendingCascade: null, journal: [] });
  });
  afterEach(() => { resetDesFixes(); resetCadence(); });

  /** Ouvre la halle sous graine fixe et rend l'étal produit (forme comparable à l'octet). */
  const etal = () => (get().landMarket?.offers ?? []).map((o) => `${o.cargoId}:${o.enc}:${o.basePrice}`);

  function halle(): void {
    marcheAvecLot();
    set({ landMarket: null, pendingEtalLot: null });
    seedBattleRng(9);
  }

  it('(a) option OFF : la fenêtre s’ouvre quand même — un siège tient le monde — mais AUCUN dé n’y est posable', () => {
    halle();
    resetDesFixes();
    openLandMarket(get, set);
    expect(get().pendingEtalLot, 'la fenêtre suit la SURFACE du monde, pas l’option de confort').toBeTruthy();
    expect(canFixDie(get(), WORLD_STEP_OWNER), 'option OFF : la pose n’est pas offerte').toBe(false);
    get().etalLotConfirm();
    expect(get().landMarket, 'l’étal existe après validation').toBeTruthy();
  });

  it('(a’) cadence AUTO — aucun siège à la manœuvre : plus de fenêtre, l’étal se génère d’un bloc', () => {
    halle();
    setDesFixes(true); // l’option ne rattrape rien : la cadence domine la surface
    setCadence('auto');
    openLandMarket(get, set);
    expect(get().pendingEtalLot, 'cadence auto : rien à montrer, rien à poser').toBeNull();
    expect(get().landMarket, 'l’étal existe').toBeTruthy();
  });

  it('(d) validation SANS aucune pose : l’étal est celui de la cadence AUTO, à l’identique (option OFF comme ON)', () => {
    halle();
    setDesFixes(true);
    setCadence('auto');
    openLandMarket(get, set);
    const sansFenetre = etal();

    for (const option of [false, true]) {
      halle();
      resetCadence();
      setDesFixes(option);
      openLandMarket(get, set);
      const lot = get().pendingEtalLot;
      expect(lot, 'la fenêtre de lot s’ouvre AVANT l’écran').toBeTruthy();
      expect(lot!.participants.length, 'un lot vide n’aurait rien à poser').toBeGreaterThan(0);
      get().etalLotConfirm();
      expect(get().pendingEtalLot, 'la validation referme la fenêtre').toBeNull();
      expect(etal(), `option ${option ? 'ON' : 'OFF'} : la fenêtre ne change RIEN par sa seule existence`).toEqual(sansFenetre);
    }
  });

  it('(b) poser un dé change l’étal — et seul le dé posé bouge', () => {
    halle();
    setDesFixes(true);
    openLandMarket(get, set);
    const avant = (() => { const g = get(); return g.pendingEtalLot!.participants.map((r) => r.value); })();
    // On pose le DERNIER dé (un prix/une quantité, jamais la présence du marchand) à une valeur
    // franchement différente : l'étal doit suivre.
    const parts0 = get().pendingEtalLot!.participants;
    const dernier = parts0[parts0.length - 1];
    const neuf = dernier.value === dernier.max ? dernier.min : dernier.max;
    get().etalLotSetForcedRoll(dernier.id, neuf);
    const apres = get().pendingEtalLot!.participants.map((r) => r.value);
    expect(apres[apres.length - 1], 'la valeur saisie est la valeur posée').toBe(neuf);
    expect(apres.slice(0, -1), 'aucun autre dé n’a bougé').toEqual(avant.slice(0, -1));
    get().etalLotConfirm();
    expect(get().landMarket, 'l’étal est ouvert après validation').toBeTruthy();
  });

  it('(c) l’ORDRE des rangées est l’ordre des dés : permuter deux valeurs change l’étal', () => {
    halle();
    setDesFixes(true);
    openLandMarket(get, set);
    const lot = get().pendingEtalLot!;
    // Il faut deux dés de valeurs DIFFÉRENTES pour que la permutation se voie.
    const paire = lot.participants.findIndex((r, i) => i > 0 && r.value !== lot.participants[i - 1].value);
    if (paire < 1) return; // graine dégénérée : rien à permuter, le cas ne dit rien
    get().etalLotConfirm();
    const direct = etal();

    halle();
    setDesFixes(true);
    openLandMarket(get, set);
    const l2 = get().pendingEtalLot!;
    const a = l2.participants[paire - 1];
    const b = l2.participants[paire];
    get().etalLotSetForcedRoll(a.id, b.value);
    get().etalLotSetForcedRoll(b.id, a.value);
    get().etalLotConfirm();
    expect(etal(), 'deux dés permutés ne peuvent pas rendre le même étal').not.toEqual(direct);
  });

  it('le lot NOMME chaque dé : un dé sans nom ne serait pas posable', () => {
    halle();
    setDesFixes(true);
    openLandMarket(get, set);
    for (const r of get().pendingEtalLot!.participants) {
      // Un libellé NON VIDE ne suffit pas : le repli du journal en fournirait un. Ce qu'on exige est
      // qu'AUCUN dé ne soit resté anonyme — poser un dé dont on ignore ce qu'il décide n'est pas poser.
      expect(r.label, 'un dé que le générateur n’a pas nommé n’est pas posable').not.toBe(DE_NON_NOMME);
      expect(r.label.length, 'chaque rangée dit ce que son dé décide').toBeGreaterThan(0);
      expect(r.max).toBeGreaterThan(0);
      expect(r.value).toBeGreaterThanOrEqual(r.min);
      expect(r.value).toBeLessThanOrEqual(r.max);
    }
  });
});

/**
 * UNE TABLE SE JOUE DANS SA FENÊTRE, QUEL QUE SOIT SON PORTEUR (#1426).
 *
 * Météo d'Étape (`travelFlow`) et Événement de bord (`seaVoyageFlow`) poussent une étape à TABLE de
 * MONDE. Elle est une ÉTAPE comme celle d'un héros : sa rangée s'affiche, le siège qui la POSSÈDE
 * lance (`CascadeModal`, branche `'table'`), et l'option « Dés fixés » n'ajoute que la POSE. Quand
 * aucun siège n'est à la manœuvre (`cadenceAuto`), le SEAM du pilote (`cascade.poserLeCurseur`, joué
 * par les quatre portes du curseur) la résout au RANG de l'étape — jamais au build — et
 * `advanceCascade` la franchit dans le même geste : une porte qui l'oublierait laisserait la séquence
 * plantée dessus, `cascadeNext` en no-op.
 */
const carteMonde: WorldMap = {
  id: 'cm', label: 'Reikland',
  places: [
    { id: 'pa', label: 'A', pos: { x: 20, y: 50 }, scene: 'monde-a' },
    { id: 'pb', label: 'B', pos: { x: 70, y: 40 }, scene: 'monde-b' },
  ],
  routes: [{ id: 'rt', a: 'pa', b: 'pb', km: 400, modes: ['pied'], perilDie: 0 }],
};
const carteMer: WorldMap = {
  id: 'cmer', label: 'Mer des Griffes',
  places: [
    { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'monde-a' },
    { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'monde-b', port: { taille: 3, richesse: 3, production: ['bois'] } },
  ],
  routes: [{ id: 'rmer', a: 'A', b: 'B', km: 550, modes: ['mer'], sea: true, seaHeading: 'est' }],
};
const scenePlate = (id: string): Scene => { const s = emptyScene(6, 6); s.id = id; s.label = id; return s; };

/** Siège local qui POSSÈDE le monde (solo : siège 0). L'OPTION de pose n'est PAS touchée ici : elle se
 *  pose AVANT l'ouverture de la journée — c'est à l'ouverture que le socle tranche. */
function siegeDuMonde(): void {
  set({ net: { ...get().net, mode: 'local', mySeat: 0, gmSeat: undefined } });
  expect(seatOwns(get(), 0, WORLD_STEP_OWNER), 'le siège local possède bien le monde').toBe(true);
}

/**
 * État d'un voyage TERRESTRE prêt à partir (règle « Voyage par Étapes » active, RNG ensemencé).
 *
 * LE RNG S'ENSEMENCE EN TÊTE, avant tout montage — un montage qui TIRE (la mer : `buildSeaPlan`
 * roule la météo du 1ᵉʳ jour) partirait sinon de l'état laissé par le fichier de test précédent, et
 * la mesure changerait selon les voisins qui tournent devant (suite `isolate:false`). Le bloc porte
 * son état COMPLET : il n'hérite de rien.
 */
function prepareJourTerrestre(seed: number): void {
  seedBattleRng(seed);
  siegeDuMonde();
  setRule('travel-etapes', true);
  set({ party: makePregens().slice(0, 3), gameTime: campaignStart(), travelPlan: null, pendingRest: null, pendingCascade: null, suspendedCascades: [], travelRecap: null, journal: [], battle: null });
  get().loadProject([scenePlate('monde-a'), scenePlate('monde-b')], 'monde-a', carteMonde);
  set({ gameTime: campaignStart() });
}
const ouvreJourTerrestre = (seed: number): void => { prepareJourTerrestre(seed); get().startTravel('rt', 'pied'); };

/** État d'une traversée dont le compteur d'événement de bord échoit AUJOURD'HUI (l'étape à table
 *  existe). RNG ensemencé EN TÊTE, pour la raison dite sur `prepareJourTerrestre` : `buildSeaPlan`
 *  TIRE la météo du 1ᵉʳ jour, et c'est elle qui décide du contenu de la journée (Affaler, Mal de mer
 *  de tempête…). */
function prepareJourMaritime(seed: number): void {
  seedBattleRng(seed);
  siegeDuMonde();
  set({
    party: makePregens().slice(0, 3),
    scene: scenePlate('monde-a') as never,
    battle: null, worldMap: carteMer, travelPlan: null, travelRecap: null,
    pendingCrewTest: null, pendingRest: null, pendingCascade: null, suspendedCascades: [],
    gameTime: 8 * 60, lastUpkeepDay: 0, journal: [],
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
  } as never);
  const plan = buildSeaPlan(get, 'rmer', 'A', 'B', carteMer.routes[0])!;
  set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysToEvent: 1, forcedEventId: undefined } } });
}
const ouvreJourMaritime = (seed: number): void => { prepareJourMaritime(seed); runSeaDay(get, set); };

/** L'étape SOUS LE CURSEUR (celle que la fenêtre montre), ou `undefined`. */
const etapeCourante = (): CascadeStep | undefined => {
  const p = get().pendingCascade;
  return p ? p.participants[p.cursor] : undefined;
};

/**
 * ENREGISTRE tous les tirages du RNG PARTAGÉ (`battleRng`, source unique) à partir de maintenant —
 * le FLUX lui-même, pas les résultats d'étapes : l'option de pose déplace des jets de héros de
 * l'inline vers la fenêtre (c'est son objet), une comparaison bâtie sur les seules étapes prendrait ce
 * changement de SURFACE pour un changement de FLUX. À installer APRÈS le dernier `seedBattleRng`
 * (réensemencer remplace l'objet RNG).
 */
function traceDesTirages(): number[] {
  const rng = battleRng() as { int: (min: number, max: number) => number };
  const brut = rng.int.bind(rng);
  const trace: number[] = [];
  rng.int = (min, max) => { const v = brut(min, max); trace.push(v); return v; };
  return trace;
}

/**
 * Pilote de test d'UNE JOURNÉE de voyage (la halte de nuit la clôt) — `pose:false` REFUSE de poser :
 * il tranche les choix, roule les jets et les bandes, mais n'appelle JAMAIS `cascadeTableRoll`. Une
 * journée qui se draine ainsi prouve que la table de MONDE a été résolue par le SOCLE, pas par un
 * geste. `pose:true` = le geste du joueur qui ne triche pas (il TIRE, il ne force aucune valeur).
 * Rend le `kind` de l'étape sur laquelle la séquence a BLOQUÉ (`undefined` = la journée est allée
 * au bout).
 */
function draineJour(pose: boolean, jusqua?: string, max = 200): string | undefined {
  for (let i = 0; i < max && get().pendingCascade && !get().pendingRest; i++) {
    const cur = etapeCourante();
    if (cur?.options && cur.chosen == null) get().cascadeChoose(cur.id, cur.defaultChoice ?? cur.options[0].key);
    else if (cur?.participants) { for (const part of cur.participants) if (!part.result) get().cascadeBatchRoll(part.id); }
    else if (pose && cur?.table && !cur.table.result) get().cascadeTableRoll(cur.id);
    else if (cur?.target != null && !cur.result) get().cascadeRoll(cur.id);
    const avant = get().pendingCascade;
    get().cascadeNext();
    if (get().pendingCascade === avant) return etapeCourante()?.kind; // no-op : la séquence est BLOQUÉE
    if (jusqua && cur?.kind === jusqua) return undefined;
  }
  return undefined;
}

/** Table de sonde : deux lignes, un d100 — de quoi observer le PILOTE, jamais une règle. */
const TABLE_SONDE = 'table-sonde-porteur';
function tableDeSonde(): void {
  registerTableStep(TABLE_SONDE, {
    label: fixtureText('Table de sonde'),
    die: 100,
    rows: [{ id: 'basse', min: 1, max: 50 }, { id: 'haute', min: 51, max: 100 }],
    lines: () => ['ligne de sonde'],
  });
}
/** Étape à TABLE portée par le MONDE (aucun acteur nommé). Le `kind` route l'applier de sonde. */
const etapeTableMonde = (id: string, kind = 'sonde-table'): CascadeStep => tableStep({
  id, kind, worldOwner: true,
  label: fixtureText('Table de monde'), table: { tableId: TABLE_SONDE, spec: { n: 1, sides: 100 } },
  stake: { key: { dataset: 'combat', kind: 'mutation' } },
})!;
/** Étape d'AFFICHAGE (rien à lancer) — `kind` libre : c'est lui qui route l'applier de sonde. */
const etapeAffichage = (id: string, kind = 'sonde-affichage'): CascadeStep =>
  displayStep({ id, kind, label: fixtureText('Étape muette'), worldOwner: true });

/** Assez d'étapes pour qu'un seul geste en franchisse une SUITE, et pour que la profondeur de pile
 *  ait le temps de dériver si le franchissement récursait (une frame par étape). */
const PAS_DE_CHARGE = 200;
/** Profondeur de pile relevée au COMMIT de chaque étape de charge, dans l'ordre des rangs. */
const profondeurs: number[] = [];
registerCascadeApplier('sonde-charge', () => {
  const limite = Error.stackTraceLimit;
  Error.stackTraceLimit = Infinity;
  profondeurs.push(new Error().stack!.split('\n').length);
  Error.stackTraceLimit = limite;
});

// ── LES PORTES DU CURSEUR : une seule, et elle tient la charge ───────────────────────────────

/** Le LITTÉRAL objet qui suit la position `depuis` (accolades équilibrées), ou `undefined` si la
 *  valeur n'en est pas un (appel de la porte, variable, `null`). */
function litteralApres(src: string, depuis: number): string | undefined {
  let i = depuis;
  while (i < src.length && /\s/.test(src[i]!)) i++;
  if (src[i] !== '{') return undefined;
  let prof = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') prof++;
    else if (src[j] === '}' && --prof === 0) return src.slice(i, j + 1);
  }
  return src.slice(i);
}

/** Les sites `fichier:ligne` qui publient un `pendingCascade` LITTÉRAL portant son propre `cursor:`. */
function sitesCurseurALaMain(): string[] {
  const pilote = 'src/state/cascade.ts';
  const fautifs: string[] = [];
  for (const { rel, text } of readCorpus(['src'])) {
    if (rel === pilote) continue;
    const re = /pendingCascade\s*:/g;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const bloc = litteralApres(text, m.index + m[0].length);
      if (bloc && /\bcursor\s*:/.test(bloc)) fautifs.push(`${rel}:${text.slice(0, m.index).split('\n').length}`);
    }
  }
  return fautifs;
}

/**
 * LE CURSEUR NE SE POSE QUE PAR LA PORTE (#1426).
 *
 * `cascade.poserLeCurseur` est le seam qui décide ce qui se passe quand le curseur ATTEINT une étape
 * (une table qu'aucun siège ne joue s'y résout d'office). Un site qui écrit `cursor:` à la main dans
 * `pendingCascade` court-circuite ce seam : la table reste non tirée, `stepReady` la refuse et
 * `cascadeNext` devient un no-op DÉFINITIF — la séquence est perdue avec le geste du joueur.
 *
 * Deux cas : la PORTE publique (`poserCurseurCascade`) fait le travail, et AUCUN site du store ne
 * l'écrit à la main (garde STRUCTURELLE, `src/state/*.ts` — un `cursor:` de plus la rougit).
 */
describe('#1426 — les portes du curseur', () => {
  beforeEach(() => { resetDesFixes(); resetCadence(); });
  afterEach(() => { resetDesFixes(); resetCadence(); set({ pendingCascade: null, suspendedCascades: [] }); });

  it('la PORTE publique pose le curseur ET résout la table qu’aucun siège ne joue', () => {
    setCadence('rapide');
    seedBattleRng(11);
    tableDeSonde();
    set({ party: makePregens().slice(0, 1), pendingCascade: null, suspendedCascades: [], battle: null });
    startCascade(get, set, {
      title: 'Portes', purpose: 'test',
      steps: [etapeAffichage('p0'), etapeTableMonde('p1')],
    });
    const casc = get().pendingCascade!;
    expect(casc.participants[1].table!.result, 'la table n’est pas tirée au BUILD').toBeUndefined();
    poserCurseurCascade(get, set, casc, 1);
    const apres = get().pendingCascade!;
    expect(apres.cursor).toBe(1);
    expect(apres.participants[1].table!.result, 'posé le curseur, le socle a tiré au RANG de l’étape').toBeTruthy();
    expect(stepReady(apres.participants[1]), 'et l’étape est franchissable : « Suivant » n’est pas un no-op').toBe(true);
  });

  /**
   * PÉRIMÈTRE : TOUT `src/**\/*.ts(x)` — récursif, tests exclus, et le PILOTE lui-même
   * (`state/cascade.ts`) exclu puisque la porte y vit. Le scan lit le LITTÉRAL entier qui suit
   * `pendingCascade:` (accolades équilibrées), pas la ligne : un `cursor:` posé une ligne plus bas que
   * le `pendingCascade: {` passait sous un scan ligne à ligne, et c'est la forme qu'un auteur écrit
   * naturellement dès que l'objet dépasse la marge.
   * ANGLE MORT du scan textuel : un objet monté en VARIABLE puis publié (`const suite = { ...p,
   * cursor: i }; set({ pendingCascade: suite })`) n'est pas vu — seule la forme littérale l'est.
   */
  it('GARDE STRUCTURELLE — aucun site de `src/**` n’écrit `cursor:` dans un littéral `pendingCascade` hors du pilote', () => {
    const fautifs = sitesCurseurALaMain();
    expect(fautifs, 'poser le curseur passe par `cascade.poserCurseurCascade`/`curseurPose` — sinon le seam du pilote est court-circuité').toEqual([]);
  });

  /**
   * Le sujet n'est pas un VOLUME, c'est la FORME du franchissement : `advanceCascade` enchaîne les
   * étapes résolues d'office par une BOUCLE, donc la profondeur de pile au commit d'une étape ne
   * dépend pas de son rang — une récursion y ajoute une frame par étape, et la séquence finit en
   * `RangeError`, cascade OUVERTE sur son curseur. La déviation se lit sur la PROFONDEUR dès la
   * deuxième étape ; par le seul volume il faut dépasser la pile, mesuré entre 9 000 et 12 800
   * étapes sur cet arbre (sonde du 2026-09-11, ~20 s pour 20 000 : le pas de commit est en O(n) du
   * nombre d'étapes). `PAS_DE_CHARGE` n'a donc à couvrir que la CLÔTURE d'une séquence qu'un seul
   * geste franchit.
   */
  it('CHARGE — les étapes résolues d’office se franchissent à profondeur de pile CONSTANTE, et la séquence se ferme', () => {
    setCadence('rapide');
    seedBattleRng(13);
    tableDeSonde();
    set({ party: makePregens().slice(0, 1), pendingCascade: null, suspendedCascades: [], battle: null });
    profondeurs.length = 0;
    const steps = [...Array(PAS_DE_CHARGE)].map((_, i) => etapeTableMonde(`charge-${i}`, 'sonde-charge'));
    startCascade(get, set, { title: 'Charge', purpose: 'test', steps });
    expect(get().pendingCascade!.participants[0].table!.result, 'la 1ʳᵉ est tirée à l’ouverture').toBeTruthy();
    get().cascadeNext(); // UN geste : le socle franchit toutes les suivantes
    expect(get().pendingCascade, 'la séquence est allée jusqu’à son dénouement').toBeNull();
    expect(profondeurs, 'chaque étape a été commitée une fois').toHaveLength(PAS_DE_CHARGE);
    const creuse = Math.min(...profondeurs);
    const profonde = Math.max(...profondeurs);
    expect(profonde - creuse, `la pile CROÎT avec le rang de l’étape (${creuse} → ${profonde} frames) : le franchissement n’est pas une boucle`).toBe(0);
  });
});

describe('#1426 LOT 1 — table sous le curseur : la fenêtre la joue, la cadence auto la résout', () => {
  beforeEach(() => { resetDesFixes(); resetCadence(); });
  afterEach(() => { resetDesFixes(); resetCadence(); resetRule('travel-etapes'); });

  it('(a) TERRE — cadence manuelle, option OFF : la Météo d’Étape ATTEND sa fenêtre, « Lancer » la franchit', () => {
    ouvreJourTerrestre(11);
    expect(get().pendingCascade?.purpose).toBe('travelDay');
    const meteo = get().pendingCascade!.participants[0];
    expect(meteo.kind).toBe('stageWeather');
    expect(meteo.worldOwner, 'aucun acteur ne la porte : le sentinel la route au siège').toBe(true);
    expect(meteo.table!.result, 'le socle ne tire pas à la place du siège qui possède le monde').toBeUndefined();
    expect(canFixDie(get(), undefined), 'option OFF : la POSE n’est pas offerte — seul « Lancer » l’est').toBe(false);
    expect(draineJour(false), 'sans geste, la séquence tient sur sa table (comme un jet de Critique)').toBe('stageWeather');
    expect(get().pendingRest, 'et la journée n’est pas allée à la halte').toBeFalsy();
    expect(draineJour(true), 'le « Lancer » de la fenêtre la franchit').toBeUndefined();
    expect(get().pendingRest, 'la journée va jusqu’à la halte de nuit').toBeTruthy();
    expect(get().journal.some((l) => l.includes('Météo')), 'la Météo d’Étape est au journal').toBe(true);
  });

  it('(a) MER — même contrat pour l’Événement de bord (le socle ne tire pas, la fenêtre lance)', () => {
    ouvreJourMaritime(4);
    const evt = get().pendingCascade!.participants.find((s) => s.kind === 'seaBoardEvent')!;
    expect(evt.worldOwner).toBe(true);
    expect(evt.table!.result).toBeUndefined();
    const arret = draineJour(false);
    expect(etapeCourante()!.table, `la séquence attend une table (étape « ${arret} »)`).toBeTruthy();
    expect(draineJour(true)).toBeUndefined();
    // Le jour CLOS déplace ses events dans sa carte de récap (`sea.events` repart à vide).
    expect(get().travelPlan!.log![0].events, 'l’événement de bord a été raconté').toHaveLength(1);
  });

  it('(b) option ON : la POSE s’AJOUTE au « Lancer » — le socle ne tire toujours pas', () => {
    setDesFixes(true);
    ouvreJourTerrestre(11);
    const meteo = get().pendingCascade!.participants[0];
    expect(meteo.kind).toBe('stageWeather');
    expect(canFixDie(get(), undefined), 'option ON + siège qui possède le monde : la pose est offerte').toBe(true);
    expect(meteo.table!.result, 'la pose ne tire pas non plus : c’est le joueur qui pose').toBeUndefined();
    const avant = get().pendingCascade;
    get().cascadeNext();
    expect(get().pendingCascade, 'aucune avancée tant que la table n’est pas tirée').toBe(avant);
    get().cascadeTableSetForcedRoll(meteo.id, 7);
    expect(etapeCourante()!.table!.result!.roll).toBe(7);
    get().cascadeNext();
    expect(get().pendingCascade!.cursor, 'la pose débloque la séquence').toBeGreaterThan(0);
  });

  it('(b) COOP — le siège MJ (distant) tient la fenêtre : l’hôte n’a PAS tiré à sa place', () => {
    setDesFixes(true);
    prepareJourTerrestre(11);
    set({ net: { ...get().net, mode: 'host', mySeat: 0, gmSeat: 1 } });
    expect(seatOwns(get(), 1, WORLD_STEP_OWNER), 'le monde appartient au siège MJ').toBe(true);
    expect(seatOwns(get(), 0, WORLD_STEP_OWNER), 'et plus à l’hôte').toBe(false);
    expect(canFixDie(get(), undefined), 'l’hôte ne pose pas le dé d’un siège qu’il ne tient pas').toBe(false);
    get().startTravel('rt', 'pied');
    const meteo = get().pendingCascade!.participants[0];
    expect(meteo.kind).toBe('stageWeather');
    expect(meteo.table!.result, 'la pose viendra de CE client : l’hôte attend').toBeUndefined();
    expect(draineJour(false), 'et rien ne franchit l’étape sans son geste').toBe('stageWeather');
  });

  it('(c) cadence AUTO — aucun siège à la manœuvre : le socle résout au rang de l’étape, sans geste', () => {
    setCadence('rapide');
    ouvreJourTerrestre(11);
    const meteo = get().pendingCascade!.participants[0];
    expect(meteo.table!.result, 'le socle l’a tirée quand le curseur s’y est posé').toBeTruthy();
    expect(draineJour(false), 'la journée entière se draine sans qu’un seul dé soit posé').toBeUndefined();
    expect(get().pendingRest).toBeTruthy();
  });

  it('(c) cadence AUTO — la table est FRANCHIE dans le même geste que l’étape qui la précède', () => {
    setCadence('rapide');
    seedBattleRng(3);
    tableDeSonde();
    set({ party: makePregens().slice(0, 1), pendingCascade: null, suspendedCascades: [], battle: null });
    startCascade(get, set, {
      title: 'Franchissement', purpose: 'test',
      steps: [etapeAffichage('av'), etapeTableMonde('t'), etapeAffichage('ap')],
    });
    expect(get().pendingCascade!.cursor).toBe(0);
    get().cascadeNext();
    expect(get().pendingCascade!.cursor, 'la table n’a pas retenu le curseur : franchie au même geste').toBe(2);
    expect(get().pendingCascade!.participants[1].table!.result, 'et elle porte bien son dé').toBeTruthy();
    set({ pendingCascade: null, suspendedCascades: [] });
  });

  it('(c) REPRISE — une séquence parquée qui revient SUR une table (cadence auto) avance encore', () => {
    setCadence('rapide');
    seedBattleRng(5);
    tableDeSonde();
    registerCascadeApplier('sonde-suspend', (g, s2) => { suspendActiveCascade(g, s2); });
    set({ party: makePregens().slice(0, 1), pendingCascade: null, suspendedCascades: [], battle: null });
    startCascade(get, set, {
      title: 'Reprise', purpose: 'test',
      steps: [etapeAffichage('sus', 'sonde-suspend'), etapeTableMonde('t2'), etapeAffichage('fin')],
    });
    // L'applier SUSPEND la séquence en plein vol ; la couture de CLÔTURE (`dispatchCascadeDone`,
    // combatSlice) la REPREND aussitôt — slot libre, hors combat : c'est la reprise du jeu réel.
    get().cascadeNext();
    expect(get().suspendedCascades, 'la pile est rendue').toHaveLength(0);
    expect(get().pendingCascade!.cursor, 'la reprise se pose SUR la table').toBe(1);
    expect(etapeCourante()!.table!.result, 'que le seam de reprise a résolue').toBeTruthy();
    get().cascadeNext();
    expect(get().pendingCascade!.cursor, 'et la séquence continue (jamais un no-op définitif)').toBe(2);
    set({ pendingCascade: null, suspendedCascades: [] });
  });

  it('(c) `pushStep` — une table APPENDUE sous le curseur (cadence auto) naît résolue', () => {
    setCadence('rapide');
    seedBattleRng(7);
    tableDeSonde();
    set({ party: makePregens().slice(0, 1), pendingCascade: null, suspendedCascades: [], battle: null });
    pushStep(set, etapeTableMonde('t3'), 'test');
    expect(get().pendingCascade!.cursor).toBe(0);
    expect(etapeCourante()!.table!.result, 'l’append est une porte du curseur comme les autres').toBeTruthy();
    set({ pendingCascade: null, suspendedCascades: [] });
  });

  it('(d) CONTRÔLE POSITIF — cadence manuelle : une table d’ACTEUR attend sa fenêtre, exactement comme celle du monde', () => {
    siegeDuMonde();
    seedBattleRng(3);
    tableDeSonde();
    const heros = makePregens()[0];
    set({ party: [heros], pendingCascade: null, suspendedCascades: [], battle: null });
    const etape = tableStep({
      id: 'ctrl-1', kind: 'ctrl-table', actorId: heros.id,
      label: fixtureText('Table d’acteur'), table: { tableId: TABLE_SONDE, spec: { n: 1, sides: 100 } },
      stake: { key: { dataset: 'combat', kind: 'mutation' } },
    })!;
    startCascade(get, set, { title: 'Contrôle', purpose: 'test', steps: [etape] });
    expect(etapeCourante()!.table!.result, 'une table d’ACTEUR reste à la main de son porteur').toBeUndefined();
    const avant = get().pendingCascade;
    get().cascadeNext();
    expect(get().pendingCascade, 'et elle continue de retenir la séquence').toBe(avant);
    set({ pendingCascade: null, suspendedCascades: [] });
  });

  it('(e) PARITÉ RNG terre — le FLUX de dés est le même, option OFF et option ON', () => {
    prepareJourTerrestre(23);
    const off = traceDesTirages();
    get().startTravel('rt', 'pied');
    const arretOff = draineJour(true);
    const offGele = [...off]; // la trace est VIVANTE : la geler avant que le second montage ne tire

    setDesFixes(true);
    prepareJourTerrestre(23);
    const on = traceDesTirages();
    get().startTravel('rt', 'pied');
    const arretOn = draineJour(true);
    expect({ arretOff, arretOn }, 'les deux journées vont jusqu’à la halte').toEqual({ arretOff: undefined, arretOn: undefined });
    expect(offGele.length, 'la journée a bien consommé des dés').toBeGreaterThan(3);
    expect([...on]).toEqual(offGele);
  });

  it('(e) PARITÉ RNG mer — idem sur la journée maritime', () => {
    prepareJourMaritime(6);
    const off = traceDesTirages();
    runSeaDay(get, set);
    const arretOff = draineJour(true);
    const offGele = [...off]; // la trace est VIVANTE : la geler avant que le second montage ne tire

    setDesFixes(true);
    prepareJourMaritime(6);
    const on = traceDesTirages();
    runSeaDay(get, set);
    const etape = get().pendingCascade!.participants.find((x) => x.kind === 'seaBoardEvent')!;
    expect(etape.table!.result, 'option ON : le socle laisse la main').toBeUndefined();
    const arretOn = draineJour(true);
    expect({ arretOff, arretOn }, 'les deux journées vont jusqu’à la halte').toEqual({ arretOff: undefined, arretOn: undefined });
    expect(offGele.length, 'la journée a bien consommé des dés').toBeGreaterThan(3);
    expect([...on]).toEqual(offGele);
  });
});
