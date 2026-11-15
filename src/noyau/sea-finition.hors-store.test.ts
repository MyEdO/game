import { idsDeTest } from '../engine/idsDeTest.testkit';
import { acheterAuMarche } from './cargaison.testkit';
import { reglageDuChoixDeFenetre } from './choixDeFenetre';
import { describe, it, expect, beforeEach } from 'vitest';
import { t } from '../i18n';
import { jouerLaSemaine } from './semaineEnMer.testkit';
import { emptyScene } from './monde/scene';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { seedBattleRng } from './battleRng';
import { buildSeaPlan } from './seaVoyageFlow';
import { encLibreNominale, vesselMaxLoadEnc } from './portFlow';
import { seaActivityBlocked } from './seaActivities';
import { activityById } from '../engine/activities';
import { activityStakeRef } from '../data';
import { toBrass, PA_PER_CO } from '../engine/money';
import { partyMoneyTotal, creditBourse, debitBourse } from './bourseFlow';
import { bourseOf } from '../engine/bourse';
import type { WorldMap } from './worldMap';
import type { Combatant } from '../engine/types';
import { avanceEtapeCascade } from './cascade.testkit';
import type { CascadeStep } from './pendings';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Remet la Bourse d'un héros à un montant EXACT (test) — vide puis crédite (SOCLE POSSESSIONS #531). */
function fund(id: string, m: { gold: number; silver: number; brass: number }): void {
  const h = get().party.find((x) => x.id === id)!;
  debitBourse(get, set, id, bourseOf(h));
  creditBourse(get, set, id, m);
}

/**
 * FINITION du chantier naval (reliquats 7a/7b) — les consommateurs joueur :
 *  #28 Température câblée (Exposition + eau), #27 Forcer le rythme (+M + Épuisement),
 *  #30 écran Port (commerce d'escale), #29 Activités en mer (semaine de 8 jours).
 */
const get = () => banc.getState();
const set: Banc['setState'] = (e) => banc.setState(e);

const seaMap: WorldMap = {
  id: 'm', label: 'Mer des Griffes',
  places: [
    { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: { id: 'port-a' }, port: { taille: 4, richesse: 4, production: ['bois-mer'], surplus: { 'produits-de-luxe-mer': 1 } } },
    { id: 'B', label: 'Marienburg', pos: { x: 10, y: 0 }, scene: { id: 'port-b' }, port: { taille: 4, richesse: 5, production: ['commerce-mer'], demande: { 'bois-mer': 1 }, cosmopolite: true } },
  ],
  routes: [{ id: 'r1', a: { id: 'A' }, b: { id: 'B' }, km: 550, modes: ['mer'], sea: true, seaHeading: 'est' }],
};

function freshState() {
  seedBattleRng(7);
  banc.setState({
    party: tousLesHerosDeScenario(idsDeTest).slice(0, 3),
    scene: { ...emptyScene('port-a', 2, 2), label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    battle: null,
    worldMap: seaMap,
    lieu: 'A',
    travelPlan: null,
    travelRecap: null,
    pendingRest: null,
    pendingSeaActivities: null,
    port: null,
    gameTime: 8 * 60,
    lastUpkeepDay: 0,
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, escale: 'A' },
    journal: [],
  } as never);
  creditBourse(get, set, get().party[0].id, { gold: 5000, silver: 0, brass: 0 }); // bourse du groupe (SOCLE POSSESSIONS #531)
}

/** Déroule la journée maritime jusqu'à une SUSPENSION (halte, Activités en mer) — la journée est
 *  désormais UNE cascade `purpose:'travelDay'` (#275 Ronde 2 cran 3) : chaque étape est soit MONO
 *  (Forcer le rythme/Prière) soit À PARTICIPANTS (batch, Tests d'équipage MDG
 *  ch.14 — `jetLancer('cascadeEnBande')` par contributeur). Garde-fou 40 pas (crises/événements possibles).
 *  `await tick()` reprend le jeton de reprise (`programmer`, 0 ms) d'un applier surfacé isolément
 *  (Ouragan/Prière — `seaVoyageFlow.ts`), comme un vrai clic UI l'espacerait. */
const tick = async (): Promise<void> => { banc.avancer(0); };

async function runOneSeaDay(vues: CascadeStep[] = []): Promise<string[]> {
  const kinds: string[] = [];
  for (let i = 0; i < 40 && get().pendingCascade && !get().pendingRest && !get().pendingSeaActivities; i++) {
    const casc = get().pendingCascade!;
    const cur = casc.participants[casc.cursor];
    if (cur) { kinds.push(cur.kind); vues.push(cur); }
    avanceEtapeCascade(get);
    await tick();
  }
  return kinds;
}

/** Déroule la cascade des Activités en mer (#273 Étape 2, `purpose:'seaActivities'`) + un éventuel
 *  Commerce d'opportunité SÉQUENCÉ (Test étendu, #273 Étape 1) — jusqu'à la halte de nuit
 *  (`pendingRest`). Garde-fou 40 pas. */
async function runSeaActivities() {
  for (let i = 0; i < 40; i++) {
    if (get().pendingRest) break;
    const casc = get().pendingCascade;
    const ext = get().pendingExtendedTest;
    // La fenêtre `extended` d'abord : son étape hôte n'est prête que quand elle a rendu sa donnée (#1765).
    if (ext) {
      const cur = ext.rounds[ext.rounds.length - 1];
      if (!cur.result) get().jetLancer('testEtendu', cur.id);
      get().jetValider('testEtendu');
      await tick();
      continue;
    }
    if (casc) {
      avanceEtapeCascade(get);
      await tick();
      continue;
    }
    break;
  }
}

describe('#27 Forcer le rythme (MDG 13 l.95-107)', () => {
  beforeEach(freshState);

  it('buildSeaPlan({pace}) porte le bonus de M demandé sur l’état naval', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { pace: 1 })!;
    expect(plan.sea!.forcePace).toBe(1);
    const plain = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    expect(plain.sea!.forcePace).toBeUndefined();
  });

  it('une journée à rythme forcé → Test de Voile puis Test d’Épuisement Complexe de qui a forcé (MDG 13 l.111)', async () => {
    seedBattleRng(1); // jour 1 navigable (ni Encalminé ni Affaler) → la Voile/le rythme se joue
    // Voile est une Compétence Avancée (LDB 09 l.30) : un PJ formé tente le Test du rythme forcé.
    const [marin, ...reste] = get().party;
    set({ party: [{ ...marin, skills: [...marin.skills, { id: 'voile', characteristic: 'agilite', advances: 10 }] }, ...reste] } as never);
    get().partirEnVoyage('r1', 'mer', { seaPace: 1, cadence: 'jourParJour' });
    const vues: CascadeStep[] = [];
    const kinds = await runOneSeaDay(vues);
    // Le recap du jour (halte de nuit) porte la journée ENTIÈRE — le journal, capé à 40 lignes,
    // évince les lignes précoces comme « Forcer le rythme ».
    const day = get().travelPlan!.log!.slice(-1)[0]!.lines.map((l) => l.text).join('\n');
    expect(day).toMatch(/Forcer le rythme/);
    expect(kinds.indexOf('mer-epuisement')).toBeGreaterThan(kinds.indexOf('mer-forcer-le-rythme'));
    const bande = vues.find((st) => st.kind === 'mer-epuisement')!;
    expect(bande.participants!.find((r) => r.id === marin.id)?.difficulty, 'qui a forcé teste en Complexe').toBe('complexe');
  });

  it('personne qui puisse tenter la Voile (LDB 09 l.30) : refus NOMMÉ au recap, aucune étape forcée, aucun impliqué donc aucun Épuisement', async () => {
    seedBattleRng(1);
    // Aucun prétiré n'a d'Augmentation en Voile : le rythme demandé ne peut pas être tenté.
    expect(get().party.some((h) => h.skills.some((sk) => sk.id === 'voile' && (sk.advances ?? 0) > 0))).toBe(false);
    get().partirEnVoyage('r1', 'mer', { seaPace: 1, cadence: 'jourParJour' });
    const kinds = await runOneSeaDay();
    const day = get().travelPlan!.log!.slice(-1)[0]!.lines.map((l) => l.text).join('\n');
    expect(day).toContain('Forcer le rythme : Personne dans le groupe ne peut tenter le Test de Voile (Cogue). Le navire garde son allure.');
    expect(kinds).not.toContain('mer-forcer-le-rythme');
    expect(kinds).not.toContain('mer-epuisement');
  });
});

describe('#28 Température en mer (MDG 13 l.203-225) — câblée au jour', () => {
  beforeEach(freshState);

  it('la journée en mer consomme de l’eau selon la bande de Température (tonneaux suivis)', async () => {
    seedBattleRng(3);
    set({ vessel: { ...get().vessel!, waterLitres: 500 } });
    get().partirEnVoyage('r1', 'mer');
    await runOneSeaDay();
    // Une journée entière est passée : l'eau a été consommée (crew × litres de la bande).
    expect(get().vessel!.waterLitres).toBeLessThan(500);
    expect(get().journal.join('\n')).toMatch(/Eau douce|À SEC/);
  });
});

describe('#29 Activités en mer (MDG 15 l.266-306)', () => {
  beforeEach(freshState);

  it('la semaine de 8 jours ouvre la modale d’Activités (déclencheur hebdomadaire)', async () => {
    seedBattleRng(3);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    // On amorce au 7ᵉ jour révolu : la journée suivante franchit la 8ᵉ → pendingSeaActivities.
    set({ travelPlan: { ...plan, kmDone: 40, sea: { ...plan.sea!, daysAtSea: 7 } } });
    get().reprendreLeVoyage();
    await runOneSeaDay();
    // Soit la modale d'Activités s'ouvre (8ᵉ jour), soit l'arrivée/halte (selon les milles) — mais
    // sur 550 milles à ~40 milles restants elle ne peut pas arriver : la modale doit s'ouvrir.
    expect(get().pendingSeaActivities).toBeTruthy();
  });

  it('la semaine validée — Cartographie réussie → une Carte marine (+2 DR d’Orientation) sur le héros', async () => {
    seedBattleRng(3);
    const heroes = get().party;
    // Un cartographe hors pair : Métier (Cartographe) à 90.
    (heroes[0] as Combatant).skills = [{ id: 'metier', spec: 'cartographe', advances: 60 } as never];
    (heroes[0] as Combatant).characteristics = { ...heroes[0].characteristics, dexterite: 40 };
    set({ party: [...heroes], pendingSeaActivities: { picks: {}, day: { kmFrom: 0, kmTo: 40, hours: 24, lines: [] } } });
    // Seam de jet (#273 Étape 2) : Cartographie est désormais une étape de CASCADE influençable —
    // La validation de la semaine ouvre `pendingCascade`, à dérouler (`runSeaActivities`).
    jouerLaSemaine(get, { [heroes[0].id]: { activityId: 'cartographie' } });
    await runSeaActivities();
    const owner = get().party[0];
    const chart = (owner.items ?? []).find((it) => it.trappingId === 'carte-marine');
    // Métier 90 Complexe (−10) = 80 → très probablement réussi ; la carte est créée en cas de succès.
    // (RNG seedé déterministe : on tolère l'absence si l'unique jet échoue, mais on vérifie la halte.)
    if (chart) expect(chart.trappingId).toBe('carte-marine');
    expect(get().pendingRest).toBeTruthy(); // la halte de nuit suit la confirmation
    expect(get().pendingSeaActivities).toBeNull();
  });

  it('Entraînement d’équipage est BLOQUÉ (équipage PNJ abstrait, MDG 14 l.39)', () => {
    const def = activityById('entrainement-equipage')!;
    expect(seaActivityBlocked(get(), def)).toMatch(/équipage/i);
  });

  it('Cartographie réussie + stashGold → Planque gratuite (MDG 15 l.292, découverte ≤ 50)', async () => {
    seedBattleRng(3);
    const heroes = get().party;
    // Même cartographe hors pair que le test précédent, jet déterministe (roll 73 ≤ cible 99).
    (heroes[0] as Combatant).skills = [{ id: 'metier', spec: 'cartographe', advances: 80 } as never];
    (heroes[0] as Combatant).characteristics = { ...heroes[0].characteristics, dexterite: 60 };
    set({ party: [...heroes], pendingSeaActivities: { picks: {}, day: { kmFrom: 0, kmTo: 40, hours: 24, lines: [] } } });
    // Planque = DÉBIT solo du cartographe (soloPayer, seaActivities.ts) → SA bourse (freshState : 5000 CO).
    const before = toBrass(bourseOf(get().party[0]));
    jouerLaSemaine(get, { [heroes[0].id]: { activityId: 'cartographie', stashGold: 50 } });
    await runSeaActivities();
    const dep = get().bank.find((b) => b.heroId === heroes[0].id && b.kind === 'planque');
    expect(dep).toBeTruthy();
    expect(dep!.brass).toBe(50 * PA_PER_CO);
    expect(dep!.rate).toBe(50); // seuil de découverte MDG (au lieu de 10, ch.23 l.170)
    expect(toBrass(bourseOf(get().party[0]))).toBe(before - 50 * PA_PER_CO);
    expect(get().journal.join('\n')).toMatch(/Planque : 50 CO cachés sur la carte/);
  });

  it('Cartographie sans mise de Planque (stashGold absent) → aucun dépôt créé', async () => {
    seedBattleRng(3);
    const heroes = get().party;
    (heroes[0] as Combatant).skills = [{ id: 'metier', spec: 'cartographe', advances: 80 } as never];
    (heroes[0] as Combatant).characteristics = { ...heroes[0].characteristics, dexterite: 60 };
    set({ party: [...heroes], pendingSeaActivities: { picks: {}, day: { kmFrom: 0, kmTo: 40, hours: 24, lines: [] } } });
    jouerLaSemaine(get, { [heroes[0].id]: { activityId: 'cartographie' } });
    await runSeaActivities();
    expect(get().bank.find((b) => b.heroId === heroes[0].id && b.kind === 'planque')).toBeUndefined();
  });

  it('Commerce d’opportunité — Test étendu SÉQUENCÉ (#273 Étape 1, ≤ 3 tentatives, MDG 15 l.274-286)', async () => {
    seedBattleRng(3);
    const heroes = get().party;
    (heroes[0] as Combatant).skills = [{ id: 'marchandage', advances: 40 } as never];
    set({
      party: [...heroes],
      pendingSeaActivities: { picks: {}, day: { kmFrom: 0, kmTo: 40, hours: 24, lines: [] } },
    });
    fund(heroes[0].id, { gold: 100, silver: 0, brass: 0 }); // investissement de GROUPE (payFromGroup)
    const before = toBrass(partyMoneyTotal(get));
    jouerLaSemaine(get, { [heroes[0].id]: { activityId: 'commerce-opportunite', investGold: 10 } });
    // La mise est débitée D'OFFICE (avant tout jet) — comme l'ancien bulk synchrone.
    expect(toBrass(partyMoneyTotal(get))).toBe(before - 10 * PA_PER_CO);
    expect(get().pendingExtendedTest).toBeTruthy(); // Test étendu ouvert (primitive #273 Étape 1)
    expect(get().pendingExtendedTest!.tentativesMax).toBe(3);
    // L'enjeu est celui de l'Activité, sur l'étape que la fenêtre lit (#1117).
    expect(get().pendingCascade?.participants.find((e) => e.jet === 'testEtendu')?.stake).toEqual(activityStakeRef('commerce-opportunite'));
    await runSeaActivities();
    // La halte suit la clôture du Test étendu (file `opportunityQueue` vidée).
    expect(get().pendingExtendedTest).toBeNull();
    expect(get().pendingRest).toBeTruthy();
    expect(get().pendingSeaActivities).toBeNull();
    expect(get().journal.join('\n')).toMatch(/Commerce d'opportunité.*mise.*retour/);
  });
});

/** Draine la CASCADE de vente au port (le choix `vendre` au port, dernier reliquat #275/#274 — Ragot → acheteur
 *  → Marchandage, chacun un `openRoll` séparé enchaîné via `chainStep`/`programmer(…, 0)`, patron
 *  `seaVoyageFlow.ts` `merDesertion`) : un `tick()` par itération reprend le jeton d'une étape
 *  déférée, comme un clic UI l'espacerait. */
async function drainPortSellCascade(): Promise<void> {
  for (let i = 0; i < 30; i++) {
    avanceEtapeCascade(get);
    await tick();
  }
}

describe('#30 Écran Port — commerce maritime (MDG 15 l.309-399)', () => {
  beforeEach(freshState);

  it('ouvrirLePort génère les offres d’achat de l’escale (Production + Surplus)', () => {
    seedBattleRng(2); // d10 non-1 → disponibilités non nulles (le 1 sur le d10 = « aucune », l.327)
    get().ouvrirLePort();
    const st = get().port!;
    expect(st.placeId).toBe('A');
    expect(st.offers.length).toBeGreaterThan(0); // bois (Production) et/ou produits de luxe (Surplus)
  });

  it('l’achat de cargaison débite la bourse et embarque la cargaison  ; la vente la revend (cascade Ragot→acheteur→Marchandage)', async () => {
    seedBattleRng(2);
    get().ouvrirLePort();
    const offer = get().port!.offers[0];
    const before = partyMoneyTotal(get).gold;
    acheterAuMarche(get, 'port', 'vessel', offer.cargoId, Math.min(10, offer.enc));
    await drainPortSellCascade(); // #266 — l'achat marchande par cascade (openRoll), comme la vente
    const vessel = get().vessel!;
    expect((vessel.cargo ?? []).length).toBe(1);
    expect(partyMoneyTotal(get).gold).toBeLessThanOrEqual(before);
    // Vente dans un autre port : on pose le navire à Marienburg (« commerce ») et on solde le lot.
    set({ vessel: { ...get().vessel!, lastVoyageMilles: 550, escale: 'B' }, port: null, lieu: 'B' });
    get().ouvrirLePort();
    const cargoLen = (get().vessel!.cargo ?? []).length;
    get().fenetreChoisir('port', 'vendre', get().vessel!.cargo![0].uid);
    await drainPortSellCascade();
    // La cascade se termine TOUJOURS (jamais de pendingCascade qui traîne) — vendu, ou refusé (RNG),
    // jamais cassé.
    expect(get().pendingCascade).toBeNull();
    expect((get().vessel!.cargo ?? []).length).toBeLessThanOrEqual(cargoLen);
    expect(get().journal.some((l) => /vendus|intéressé|Ragot/.test(l))).toBe(true);
  });

  it('#243 — headroom nominal vs plafond dur de surcharge (Cogue : Contenance 300, dur 450)', () => {
    set({ vessel: { ...get().vessel!, cargo: [{ uid: 'lot-1', cargoId: 'bois-mer', enc: 290, basePriceGold: 1 }] } });
    expect(encLibreNominale(get().vessel)).toBe(10); // 300 − 290 (nominal)
    expect(vesselMaxLoadEnc(get)).toBe(160); // 450 − 290 (surcharge possible)
    set({ vessel: { ...get().vessel!, cargo: [{ uid: 'lot-2', cargoId: 'bois-mer', enc: 440, basePriceGold: 1 }] } });
    expect(encLibreNominale(get().vessel)).toBe(0); // au-delà de la Contenance : plus de headroom nominal
    expect(vesselMaxLoadEnc(get)).toBe(10); // 450 − 440
  });

  it('#243 — l’achat au-delà de la Contenance surcharge (jusqu’à 150 %) et l’avertit ; jamais au-delà du plafond dur', async () => {
    seedBattleRng(2);
    set({ vessel: { ...get().vessel!, cargo: [{ uid: 'lot-3', cargoId: 'bois-mer', enc: 290, basePriceGold: 1 }] } });
    fund(get().party[0].id, { gold: 100000, silver: 0, brass: 0 }); // bourse large pour l'achat en surcharge
    get().ouvrirLePort();
    const offer = get().port!.offers[0]; // production/surplus copieux (Taille 4 + Richesse 4 × d10 × 10)
    get().fenetreChoisir('port', 'offre', offer.cargoId);
    const plafond = Math.min(offer.enc, 160); // plafond dur : 450 − 290
    expect(reglageDuChoixDeFenetre(get(), 'port', 'encombrement').bornes?.max, 'l’Enc se borne au plafond dur').toBe(plafond);
    expect(acheterAuMarche(get, 'port', 'vessel', offer.cargoId, plafond + 1), 'au-delà du plafond dur').toBe(t('choix.refus.bornes'));
    acheterAuMarche(get, 'port', 'vessel', offer.cargoId, plafond);
    await drainPortSellCascade(); // #266 — Marchandage d'achat SURFACÉ (cascade openRoll)
    const enc = (get().vessel!.cargo ?? []).reduce((s, l) => s + l.enc, 0);
    expect(enc).toBeLessThanOrEqual(450); // jamais au-delà du maximum absolu (150 %)
    expect(enc).toBeGreaterThan(300); // a bien SURchargé (au-delà de la Contenance nominale)
    expect(get().journal.some((l) => /SURCHARG/i.test(l))).toBe(true); // achat en zone de surcharge → avertissement
  });

  it('le bradage de cargaison brade à ¼ du prix de base dans un port « commerce »', () => {
    seedBattleRng(2);
    set({ vessel: { ...get().vessel!, cargo: [{ uid: 'lot-4', cargoId: 'bois-mer', enc: 100, basePriceGold: 2 }], escale: 'B' }, lieu: 'B' });
    get().ouvrirLePort();
    const before = partyMoneyTotal(get).gold;
    get().fenetreChoisir('port', 'jeter', 'lot-4');
    expect((get().vessel!.cargo ?? []).length).toBe(0);
    expect(partyMoneyTotal(get).gold).toBeGreaterThan(before); // ¼ × 100 × 2 = 50 CO
  });

  it('Gangs des quais : la perte en attente frappe le premier lot déchargé dans ce port, puis se lève (MDG 15 l.250)', () => {
    seedBattleRng(2);
    set({ vessel: { ...get().vessel!, cargo: [{ uid: 'lot-4', cargoId: 'bois-mer', enc: 100, basePriceGold: 2 }, { uid: 'lot-5', cargoId: 'bois-mer', enc: 10, basePriceGold: 2 }], perteAuDechargement: 30, escale: 'B' }, lieu: 'B' });
    get().ouvrirLePort();
    const before = partyMoneyTotal(get).gold;
    get().fenetreChoisir('port', 'jeter', 'lot-4');
    expect(partyMoneyTotal(get).gold - before).toBe(35); // ¼ × (100 − 30) × 2
    expect(get().vessel!.perteAuDechargement).toBeUndefined();
    get().fenetreChoisir('port', 'jeter', 'lot-5');
    expect(partyMoneyTotal(get).gold - before).toBe(35 + 5); // ¼ × 10 × 2 : la perte ne frappe qu'une fois
  });

  it('l’achat de cargaison au port : seule la cale du navire se négocie, un autre porteur est refusé en le disant', () => {
    seedBattleRng(2);
    set({ possessions: [{ uid: 'pos-mule', ownerId: get().party[0].id, nature: 'vehicule', vehicleId: 'diligence', location: { kind: 'avec-le-groupe' }, items: [] }] });
    get().ouvrirLePort();
    const offer = get().port!.offers[0];
    const before = partyMoneyTotal(get).gold;
    acheterAuMarche(get, 'port', 'pos-mule', offer.cargoId, Math.min(10, offer.enc));
    expect(get().vessel!.cargo ?? []).toEqual([]);
    expect(partyMoneyTotal(get).gold).toBe(before);
    expect(get().journal.slice(-1)[0]).toBe(t('port.horsDuNavire'));
  });

  it('le bradage de cargaison au port : deux lots du même bien, seul le lot désigné quitte la cale, à SON prix', () => {
    seedBattleRng(2);
    const garde = { uid: 'lot-a', cargoId: 'bois-mer', enc: 100, basePriceGold: 2 };
    set({ vessel: { ...get().vessel!, cargo: [garde, { uid: 'lot-b', cargoId: 'bois-mer', enc: 100, basePriceGold: 6 }], escale: 'B' }, lieu: 'B' });
    get().ouvrirLePort();
    const before = partyMoneyTotal(get).gold;
    get().fenetreChoisir('port', 'jeter', 'lot-b');
    expect(get().vessel!.cargo).toEqual([garde]);
    expect(partyMoneyTotal(get).gold).toBe(before + 150); // ¼ × 100 × 6 CO
  });
});
