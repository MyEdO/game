/**
 * Activités d'interlude (LDB 23) : Revenus (LDB 08 l.105-120), Artisanat (Test étendu, matériaux
 * ¼ prix, achèvement → objet avec qualités), Opérations bancaires (invest/planque), blocages
 * d'événements par Classe.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { draineCascade } from './cascadeTestKit';
import { createHero } from '../engine/character';
import { makeRNG, roll } from '../engine/dice';
import { toBrass, fromBrass, priceToMoney, PA_PER_CO } from '../engine/money';
import { partyMoneyTotal, creditBourse } from './bourseFlow';
import { findTrappingById, findEffectTableById } from '../data';
import { findTableEntry, findTableEntryIndex } from '../engine/tables';
import { seedBattleRng } from './battleRng';
import type { PendingActivity } from './interludeFlow';
import { openRitualFocus } from './interludeFlow';
import { evaluateTest } from '../engine/tests';
import { DIFFICULTY_MODIFIERS } from '../engine/types';
import { testScene } from '../scenes/test-fixture';
// (les tests Apprentissage/commande utilisent les actions store et les données réelles)

describe('Activités d’interlude (LDB 23)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    const a = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', rng: makeRNG(1) });
    useGame.setState({ party: [a], battle: null, interlude: null, bank: [], pendingOrders: [], pendingActivity: null, journal: [] });
    useGame.getState().startScene(testScene);
    vi.clearAllTimers();
    creditBourse(useGame.getState, useGame.setState, useGame.getState().party[0].id, fromBrass(2000));
    useGame.getState().seedRng(13);
    useGame.getState().startInterlude(3);
    draineCascade(useGame.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function hero() { return useGame.getState().party[0]; }
  function st() { return useGame.getState().interlude!.perHero[hero().id]; }

  it('Revenus : modale → jet → Appliquer crédite revenueBrass (crédit DIFFÉRÉ, LDB 23 l.191) et consomme l’Activité', () => {
    // RAW : « Sur un succès, vous gagnez l'argent indiqué » (LDB 08 l.110) ; l'argent « vous est
    // seulement remis une fois que vous avez disposé de l'argent de votre dernière aventure » (LDB 23
    // l.191) → jamais dans `money`, seulement `revenueBrass`. Revenus maintient le Statut (l.193).
    // Neutralise un éventuel blocage d'événement pour CE test (on teste le flux, pas l'événement).
    const itl = useGame.getState().interlude!;
    itl.perHero[hero().id] = { ...st(), fx: undefined, left: 2 };
    useGame.setState({ interlude: { ...itl } });
    const moneyBefore = toBrass(partyMoneyTotal(useGame.getState));
    useGame.getState().interludeActivity(hero().id, 'revenus');
    const pa = useGame.getState().pendingActivity;
    expect(pa?.kind).toBe('catalog');
    expect(pa?.activityId).toBe('revenus');
    expect(pa?.difficulty).toBe('accessible'); // « Test Spectaculaire Accessible (+20) » (LDB 08 l.110) — Spectaculaire = Test à DR ordinaire (LDB 12 l.172), PAS étendu
    useGame.getState().activityRoll();
    // Force un succès propre (déterminisme du gain testé côté moteur).
    useGame.setState({ pendingActivity: { ...useGame.getState().pendingActivity!, roll: 1, success: true, sl: 2 } });
    useGame.getState().activityConfirm();
    expect(useGame.getState().pendingActivity).toBeNull();
    const after = st();
    expect(after.didRevenus).toBe(true);
    expect(after.left).toBe(1);
    expect(after.revenueBrass).toBeGreaterThan(0);
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(moneyBefore); // crédit DIFFÉRÉ : la bourse n'a pas bougé
  });

  it('Revenus bloqués par l’événement (classe ou *) : la modale ne s’ouvre pas', () => {
    const itl = useGame.getState().interlude!;
    itl.perHero[hero().id] = { ...st(), fx: { revenueBlockedClasses: ['*'] }, left: 2 };
    useGame.setState({ interlude: { ...itl } });
    useGame.getState().interludeActivity(hero().id, 'revenus');
    expect(useGame.getState().pendingActivity).toBeNull();
    expect(useGame.getState().journal.join('\n')).toMatch(/ne peut pas entreprendre Revenus/);
  });

  it('Artisanat : engager paie ¼ du prix (LDB 23 l.76) ; le Test étendu cumule ; l’achèvement crée l’objet qualifié', () => {
    // RAW l.76 : « les matières premières […] coûteront un quart du prix de l'équipement, et devront
    // être achetées avant le début de l'Activité » ; l.78 : « Test étendu de Métier » ; l.102 : « Chaque
    // Activité […] vous permet d'effectuer un lancer pour votre Test étendu ».
    const h = hero();
    h.skills.push({ id: 'metier', spec: 'Forgeron', characteristic: 'dexterite', advances: 10 });
    const itl0 = useGame.getState().interlude!;
    itl0.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    useGame.setState({ interlude: { ...itl0 } });
    const quarter = Math.max(1, Math.floor(toBrass(priceToMoney(findTrappingById('dague')!.price)) / 4));
    const before = toBrass(partyMoneyTotal(useGame.getState));
    useGame.getState().interludeCraftStart(h.id, 'dague', ['solide'], []);
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(before - quarter);
    expect(hero().craft?.trappingId).toBe('dague');
    // Lancer : on force l'achèvement (drBefore au seuil).
    useGame.getState().interludeActivity(h.id, 'craft');
    expect(useGame.getState().pendingActivity?.kind).toBe('catalog');
    expect(useGame.getState().pendingActivity?.activityId).toBe('craft');
    expect(useGame.getState().pendingActivity?.drTarget).toBeGreaterThan(0); // Test étendu : cible de DR peuplée
    useGame.getState().activityRoll();
    const pa = useGame.getState().pendingActivity!;
    useGame.setState({ pendingActivity: { ...pa, roll: 1, success: true, sl: Math.max(1, pa.drTarget ?? 1) , drBefore: pa.drTarget } });
    useGame.getState().activityConfirm();
    const after = st();
    expect(hero().craft).toBeUndefined();
    expect(after.left).toBe(2);
    const made = hero().items?.find((i) => i.label === 'Dague' && (i.qualities ?? []).some((q) => q.id === 'solide'));
    expect(made).toBeTruthy();
  });

  it('Rituel : `openRitualFocus` engage puis `resolveFocus` cumule le DR jusqu’au NI réduit de moitié, puis clôt (VDM 02 l.777) — Activité `blocked` au catalogue (#879), mécanisme exercé DIRECTEMENT (openRitualFocus + activityRoll/activityConfirm, hors de la porte fermée au joueur)', () => {
    const h = hero();
    h.skills.push({ id: 'focalisation', characteristic: 'force-mentale', advances: 10 });
    h.spells = ['graver-une-pierre-d-ogham']; // NI 50, aucun Domaine requis (`domains: []`)
    const itl = useGame.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    useGame.setState({ interlude: { ...itl } });
    const r = openRitualFocus(useGame.getState, useGame.setState, h, 'graver-une-pierre-d-ogham');
    expect(r).toBeDefined();
    expect(r!.extra.drTarget).toBe(25); // NI 50 réduit de moitié (arrondi sup.) en Activité
    expect(r!.extra.drBefore).toBe(0);
    expect(hero().ritual).toEqual({ spellId: 'graver-une-pierre-d-ogham', drDone: 0, drTarget: 25 });
    // `pendingActivity` reconstitué à la main (assemblage d'`openCatalogActivity`) : l'Activité est
    // `blocked` au catalogue, la porte `interludeActivity`/`openCatalogActivity` refuse désormais.
    useGame.setState({
      pendingActivity: {
        heroId: h.id, kind: 'catalog', activityId: 'accomplir-un-rituel',
        skillLabel: r!.skillLabel, skillValue: r!.skillValue,
        roll: null, target: 0, sl: 0, success: false,
        ...r!.extra, label: `Accomplir un Rituel — ${r!.extra.label}`,
      } as PendingActivity,
    });
    // Seed choisi pour que le PROCHAIN jet (`battleRng()`, consommé une fois par `resolveFocus`) soit
    // un échec net (marge ≥ 15) — preuve indépendante de l'aléa par défaut du fichier (seed 13).
    const effTarget = r!.skillValue + DIFFICULTY_MODIFIERS.intermediaire;
    let seed = 1;
    while (makeRNG(seed).int(1, 100) - effTarget < 15) seed++;
    seedBattleRng(seed);
    useGame.getState().activityRoll(); // exerce `resolveFocus` réel (branche `p.ritualSpell`, rollFlowSpecs.ts)
    const pa = useGame.getState().pendingActivity!;
    expect(pa.success).toBe(false);
    // Signature que seule `resolveFocus` produit : `FocusResult.dr` est CLAMPÉ ≥ 0 (`engine/magic.ts`) —
    // sur ce MÊME jet, `evaluateTest` (Test simple générique, sans `p.ritualSpell`) rend un DR négatif.
    expect(pa.sl).toBe(0);
    const generic = evaluateTest(pa.roll!, effTarget);
    expect(generic.sl).toBeLessThan(0);
    // Round partiel : force 10 DR (déterminisme du cumul testé côté moteur, comme l'Artisanat ci-dessus).
    // ⚠ 10 puis 20 DR forcés ci-dessous EXERCENT le cumul (`extendedTestStep`) — ce ne sont PAS des DR
    // représentatifs d'un Round réel (`resolveFocus` mesure ~1,39 DR de moyenne) : cette trajectoire de
    // 2 Rounds n'est pas jouable en l'état (#879).
    useGame.setState({ pendingActivity: { ...pa, sl: 10, success: true } });
    useGame.getState().activityConfirm();
    expect(hero().ritual).toEqual({ spellId: 'graver-une-pierre-d-ogham', drDone: 10, drTarget: 25 });
    expect(st().left).toBe(2);
    // 2e Round, sans re-préciser `spellId` : reprend le Rituel engagé (`h.ritual`), achève (10+20 ≥ 25).
    const r2 = openRitualFocus(useGame.getState, useGame.setState, h, undefined);
    expect(r2).toBeDefined();
    expect(r2!.extra.drBefore).toBe(10);
    useGame.setState({
      pendingActivity: {
        heroId: h.id, kind: 'catalog', activityId: 'accomplir-un-rituel',
        skillLabel: r2!.skillLabel, skillValue: r2!.skillValue,
        roll: null, target: 0, sl: 0, success: false,
        ...r2!.extra, label: `Accomplir un Rituel — ${r2!.extra.label}`,
      } as PendingActivity,
    });
    useGame.getState().activityRoll();
    useGame.setState({ pendingActivity: { ...useGame.getState().pendingActivity!, sl: 20, success: true } });
    useGame.getState().activityConfirm();
    expect(hero().ritual).toBeUndefined();
    expect(st().left).toBe(1);
    expect(useGame.getState().journal.join('\n')).toMatch(/achève le Rituel/);
  });

  it('Rituel au NI FORMULE (`cn: null`, #879 volet 2) : `openRitualFocus` refuse, non engageable en Activité', () => {
    const h = hero();
    h.spells = ['les-faux-croisees'];
    const itl = useGame.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    useGame.setState({ interlude: { ...itl } });
    const r = openRitualFocus(useGame.getState, useGame.setState, h, 'les-faux-croisees');
    expect(r).toBeUndefined();
    expect(useGame.getState().journal.join('\n')).toMatch(/Incantation indéterminé/);
    expect(st().left).toBe(3); // refus AVANT le jet — aucun créneau consommé
    expect(hero().ritual).toBeUndefined();
  });

  it('Rituel : Activité `blocked` au catalogue (#879) — fermée au joueur, `interludeActivity` refuse silencieusement', () => {
    const h = hero();
    h.skills.push({ id: 'focalisation', characteristic: 'force-mentale', advances: 10 });
    h.spells = ['graver-une-pierre-d-ogham'];
    const itl = useGame.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    useGame.setState({ interlude: { ...itl } });
    useGame.getState().interludeActivity(h.id, 'accomplir-un-rituel', { spellId: 'graver-une-pierre-d-ogham' });
    expect(useGame.getState().pendingActivity).toBeNull();
    expect(st().left).toBe(3); // porte fermée AVANT tout jet — aucun créneau consommé
    expect(hero().ritual).toBeUndefined();
  });

  it('Banque : invest interdit à l’échelon Bronze ; la planque débite et consomme l’Activité', () => {
    const itl = useGame.getState().interlude!;
    itl.perHero[hero().id] = { ...st(), fx: undefined, left: 2 };
    useGame.setState({ interlude: { ...itl } });
    hero().career = 'Agitateur'; // Pamphlétaire (niv.1) = Bronze 1 → invest refusé
    hero().careerLevel = 1;
    useGame.getState().interludeBank(hero().id, 'invest', 120);
    expect(useGame.getState().bank).toHaveLength(0);
    expect(useGame.getState().journal.join('\n')).toMatch(/échelons Or et Argent/);
    const before = toBrass(partyMoneyTotal(useGame.getState));
    useGame.getState().interludeBank(hero().id, 'stash', 120);
    expect(useGame.getState().bank).toHaveLength(1);
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(before - 120);
    expect(st().left).toBe(1);
  });

  it('Apprentissage particulier (LDB 23 l.66-72) : échec = PX et argent perdus « en vain » + acharnement +10 ; succès = Talent acquis', () => {
    // RAW l.68 : « dépensant en vain des PX et de l'argent » ; l.72 : « Tentez un Test Difficile (-20)
    // […] Sur un succès, vous avez appris le Talent. Sinon […] gagnez un modificateur de +10 pour
    // chaque tentative ratée ». Prix du tuteur (l.72) : « 2D10 pistoles d'argent par 100PX ».
    const h = hero();
    h.xp = 300;
    const itl = useGame.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    useGame.setState({ interlude: { ...itl } });
    creditBourse(useGame.getState, useGame.setState, h.id, fromBrass(5000));
    useGame.getState().interludeActivity(h.id, 'learn', { talentId: 'chanceux' }); // id STABLE du Talent
    const pa = useGame.getState().pendingActivity!;
    expect(pa.kind).toBe('catalog');
    expect(pa.activityId).toBe('learn');
    expect(pa.difficulty).toBe('difficile'); // « Test Difficile (-20) »
    expect(pa.xpCost).toBe(100);
    const moneyBefore = toBrass(partyMoneyTotal(useGame.getState));
    useGame.getState().activityRoll();
    // Échec forcé : PX/argent dépensés en vain, +10 cumulé.
    useGame.setState({ pendingActivity: { ...useGame.getState().pendingActivity!, roll: 99, success: false, sl: -2 } });
    useGame.getState().activityConfirm();
    expect(hero().xp).toBe(200);
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(moneyBefore - (pa.tutorBrass ?? 0)); // tuteur payé MÊME sur échec
    expect(st().learnFails?.['chanceux']).toBe(1); // clé = id stable
    expect(hero().talents.some((t) => t.talentId === 'chanceux')).toBe(false);
    // Seconde tentative : succès → Talent acquis (et le +10 d'acharnement s'ajoute à la valeur du Test).
    useGame.getState().interludeActivity(h.id, 'learn', { talentId: 'chanceux' });
    expect(useGame.getState().pendingActivity!.skillValue).toBeGreaterThan(pa.skillValue);
    useGame.getState().activityRoll();
    useGame.setState({ pendingActivity: { ...useGame.getState().pendingActivity!, roll: 1, success: true, sl: 1 } });
    useGame.getState().activityConfirm();
    expect(hero().talents.some((t) => t.talentId === 'chanceux')).toBe(true);
    expect(hero().xp).toBe(100);
  });

  it('Passer commande : objet du stock ordinaire refusé ; Exotique payé maintenant, livré à l’interlude SUIVANT', () => {
    const h = hero();
    const itl = useGame.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    useGame.setState({ interlude: { ...itl } });
    creditBourse(useGame.getState, useGame.setState, h.id, fromBrass(999999));
    useGame.getState().interludeOrder(h.id, 'dague'); // Commune → refus
    expect(useGame.getState().pendingOrders).toHaveLength(0);
    expect(useGame.getState().journal.join('\n')).toMatch(/s’achète chez un marchand|s'achète chez un marchand/);
    const exotic = findTrappingById('long-fusil-d-hochland'); // l'exemple du LDB (Exotique)
    if (!exotic || exotic.availability !== 'Exotique') return; // garde : données absentes → couvert par le refus ci-dessus
    useGame.getState().interludeOrder(h.id, exotic.id);
    expect(useGame.getState().pendingOrders).toEqual([{ heroId: h.id, trappingId: exotic.id }]);
    expect(st().left).toBe(2);
    // Clôture + nouvel interlude : la commande est livrée.
    useGame.getState().interludeEnd();
    useGame.getState().startInterlude(1);
    draineCascade(useGame.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    expect(hero().items?.some((i) => i.label === exotic.label)).toBe(true);
    expect(useGame.getState().pendingOrders).toHaveLength(0);
  });

  /** VDM 12 l.42 : le bâton enchanté « nécessite l'Activité Passer commande et coûte 15 CO », sans
   *  porter de Disponibilité — le chemin d'EXÉCUTION doit l'accepter, pas seulement le catalogue.
   *  Contre-épreuve hors commerce (sans prix) sur le même chemin. */
  it('Passer commande : bâton enchanté (sans Disponibilité, 15 CO) accepté ; hors commerce refusé', () => {
    const h = hero();
    const itl = useGame.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    useGame.setState({ interlude: { ...itl } });
    creditBourse(useGame.getState, useGame.setState, h.id, fromBrass(999999));
    const before = toBrass(partyMoneyTotal(useGame.getState));
    useGame.getState().interludeOrder(h.id, 'baton-enchante');
    expect(useGame.getState().pendingOrders).toEqual([{ heroId: h.id, trappingId: 'baton-enchante' }]);
    expect(before - toBrass(partyMoneyTotal(useGame.getState))).toBe(15 * PA_PER_CO);
    expect(st().left).toBe(2);
    for (const id of ['licence-de-guilde', 'arme-improvisee', 'mains-nues']) {
      useGame.getState().interludeOrder(h.id, id);
      expect(useGame.getState().pendingOrders, `${id} ne doit pas se commander`).toHaveLength(1);
    }
    expect(st().left).toBe(2); // aucun refus n'a consommé d'Activité
  });

  it('Banque : le retrait d’une planque rend l’argent (ou la perd sur 🎲 ≤ 10) et vide le dépôt', () => {
    const itl = useGame.getState().interlude!;
    itl.perHero[hero().id] = { ...st(), fx: undefined, left: 2 };
    useGame.setState({ interlude: { ...itl }, bank: [{ heroId: hero().id, kind: 'stash', brass: 240, rate: 0 }] });
    const before = toBrass(partyMoneyTotal(useGame.getState));
    useGame.getState().interludeWithdraw(0);
    expect(useGame.getState().bank).toHaveLength(0);
    const after = toBrass(partyMoneyTotal(useGame.getState));
    const journal = useGame.getState().journal.join('\n');
    if (after > before) expect(journal).toMatch(/récupère/);
    else expect(journal).toMatch(/découverte|perdus/);
  });

  // ── Identifier un artefact magique (ADE II 4 l.46-59) ─────────────────────────────────────
  function armArtefact(withSavoir = true) {
    const h = hero();
    if (withSavoir) h.skills.push({ id: 'savoir', spec: 'magie', characteristic: 'intelligence', advances: 10 });
    h.items = [...(h.items ?? []), { uid: 'art1', name: 'Épée ancienne', kind: 'melee', qualities: [{ id: 'de-plaies-atroces' }], enc: 1, equipped: false, identified: false } as never];
    const itl = useGame.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    useGame.setState({ interlude: { ...itl }, party: [...useGame.getState().party] });
  }
  const artefact = () => hero().items!.find((i) => i.uid === 'art1')!;
  const forceRoll = (roll: number, success: boolean, sl: number) => {
    useGame.getState().activityRoll();
    useGame.setState({ pendingActivity: { ...useGame.getState().pendingActivity!, roll, success, sl } });
    useGame.getState().activityConfirm();
  };

  it('Identifier : exige Savoir (Magie) acquis (« Pour d’autres sorciers », ADE II 4 l.41)', () => {
    armArtefact(false);
    useGame.getState().interludeActivity(hero().id, 'identify', { itemUid: 'art1' });
    expect(useGame.getState().pendingActivity).toBeNull();
    expect(useGame.getState().journal.join('\n')).toMatch(/Savoir \(Magie\)/);
  });

  it('Identifier : Test de Savoir (Magie) Intermédiaire (+0), Activité consommée (ADE II 4 l.41)', () => {
    armArtefact();
    useGame.getState().interludeActivity(hero().id, 'identify', { itemUid: 'art1' });
    const pa = useGame.getState().pendingActivity;
    expect(pa?.kind).toBe('catalog');
    expect(pa?.activityId).toBe('identify');
    expect(pa?.difficulty).toBe('intermediaire'); // « Savoir (Magie) Intermédiaire (+0) »
    forceRoll(5, true, 4);
    expect(st().left).toBe(2);
  });

  // ADE II 4 l.43-52 — table de DR complète (le POC collapsait ≥+4/≤+3 et IGNORAIT la ligne « 0 à +1 »).
  it('Identifier : Succès Impressionnant (+4 à +5) → identifié + « sait s’il a des Particularités »', () => {
    armArtefact();
    useGame.getState().interludeActivity(hero().id, 'identify', { itemUid: 'art1' });
    forceRoll(5, true, 4);
    expect(artefact().identified).toBe(true); // « le Personnage est capable d'identifier l'objet »
    expect(artefact().magicKnown).toBe(true); // « et sait s'il a des Particularités »
  });

  it('Identifier : Succès (+2 à +3) → identifié, Particularités visibles seulement (pas les cachées)', () => {
    armArtefact();
    useGame.getState().interludeActivity(hero().id, 'identify', { itemUid: 'art1' });
    forceRoll(20, true, 2);
    expect(artefact().identified).toBe(true); // RAW : tout succès identifie l'objet (correction du POC)
    expect(artefact().magicKnown).toBeFalsy(); // « il ne voit pas celles qui sont cachées »
  });

  it('Identifier : Succès Minime (0 à +1) → identifié ET découvre UNE Particularité cachée (ligne ignorée par le POC)', () => {
    armArtefact();
    useGame.getState().interludeActivity(hero().id, 'identify', { itemUid: 'art1' });
    forceRoll(41, true, 1); // DR +1 → Succès Minime
    expect(artefact().identified).toBe(true);
    expect(artefact().magicKnown).toBe(true); // « découvre une Particularité cachée »
  });

  it('Identifier : Échec (−2 à −3) → confond avec un objet similaire, AUCUNE fausse Particularité (ADE II 4 l.50)', () => {
    armArtefact();
    useGame.getState().interludeActivity(hero().id, 'identify', { itemUid: 'art1' });
    forceRoll(70, false, -2);
    expect(artefact().identified).toBe(false); // « confond l'artefact avec un type d'objet similaire »
    expect(artefact().suspectedQualities ?? []).toHaveLength(0); // pas de fausse Particularité avant −4 (≠ Échec Minime)
  });

  it('Identifier : Échec Impressionnant (−4 à −5) → UNE fausse Particularité soupçonnée', () => {
    armArtefact();
    useGame.getState().interludeActivity(hero().id, 'identify', { itemUid: 'art1' });
    forceRoll(88, false, -4);
    const suspected = artefact().suspectedQualities ?? [];
    expect(suspected).toHaveLength(1); // « soupçonne également que l'objet possède une Particularité qu'il n'a pas »
    expect(suspected).not.toContain('De plaies atroces'); // jamais une qualité RÉELLE de l'objet
    expect(artefact().identified).toBe(false); // « confond l'artefact avec un type d'objet similaire »
  });

  it('Identifier : Échec Stupéfiant (−6 ou moins) → AU MOINS DEUX fausses Particularités, purgées par une vraie révélation', () => {
    armArtefact();
    useGame.getState().interludeActivity(hero().id, 'identify', { itemUid: 'art1' });
    forceRoll(99, false, -6);
    const suspected = artefact().suspectedQualities ?? [];
    expect(suspected).toHaveLength(2); // « soupçonne également que l'objet possède au moins deux Particularités qu'il n'a pas »
    expect(suspected).not.toContain('De plaies atroces');
    expect(artefact().identified).toBe(false);
    // Une identification réussie ultérieure dissipe les fausses certitudes.
    useGame.getState().interludeActivity(hero().id, 'identify', { itemUid: 'art1' });
    forceRoll(3, true, 6);
    expect(artefact().identified).toBe(true);
    expect(artefact().suspectedQualities).toBeUndefined();
  });

  // Correction coordinateur (2b) : seam `onOwnTestFailed` du chemin JOUEUR HORS combat (Activité d'interlude).
  it('Crampes abdominales : rater une Activité d’interlude → État Sonné (MSRC 16 l.152, cas RAW cardinal)', () => {
    const h = hero();
    h.diseases = [{ id: 'colique', phase: 'active', symptoms: [{ symptomId: 'crampes-abdominales' }], minutesLeft: 1e5, durationMinutes: 1e5 }];
    const itl = useGame.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 2 }; // neutralise un éventuel blocage d'événement
    useGame.setState({ interlude: { ...itl }, party: [...useGame.getState().party] });
    useGame.getState().interludeActivity(h.id, 'revenus');
    useGame.getState().activityRoll();
    // Force un échec « normal ou pire » (DR ≤ −2) → palier 1 des Crampes = Sonné.
    useGame.setState({ pendingActivity: { ...useGame.getState().pendingActivity!, roll: 99, success: false, sl: -2 } });
    useGame.getState().activityConfirm();
    const after = useGame.getState().party.find((c) => c.id === h.id)!;
    expect(after.conditions.some((c) => c.id === 'sonne')).toBe(true);
  });

  // Correction coordinateur (6) : « un jet = une modale » vaut HORS combat — le FM de palier 2 d'un héros
  // s'ouvre en MODALE de jet scène (pendingTest), jamais inline. Ré-entrance tamponnée (noOwnTestFailed).
  it('Crampes DR ≤ −4 : le sous-Test de FM (palier 2) d’un HÉROS ouvre une MODALE de jet, pas un jet inline', () => {
    const h = hero();
    h.characteristics['force-mentale'] = 40;
    h.diseases = [{ id: 'colique', phase: 'active', symptoms: [{ symptomId: 'crampes-abdominales' }], minutesLeft: 1e5, durationMinutes: 1e5 }];
    const itl = useGame.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 2 };
    useGame.setState({ interlude: { ...itl }, party: [...useGame.getState().party], pendingTest: null });
    useGame.getState().interludeActivity(h.id, 'revenus');
    useGame.getState().activityRoll();
    useGame.setState({ pendingActivity: { ...useGame.getState().pendingActivity!, roll: 99, success: false, sl: -4 } });
    useGame.getState().activityConfirm();
    const pt = useGame.getState().pendingTest;
    expect(pt).toBeTruthy(); // le FM s'ouvre en MODALE (openSkillTest), pas résolu inline
    expect(pt!.skillId ?? pt!.char).toBe('force-mentale');
    expect(pt!.noOwnTestFailed).toBe(true); // garde de ré-entrance portée par la modale
    const h2 = useGame.getState().party.find((c) => c.id === h.id)!;
    expect(h2.conditions.some((c) => c.id === 'sonne')).toBe(true); // palier 1 (Sonné) inline
    expect(h2.conditions.some((c) => c.id === 'a-terre')).toBe(false); // palier 2 DIFFÉRÉ en modale (pas encore résolu)
  });

  // Bloquant 2 (`addNegativeSL` inerte, VDM 12 l.425 « ajoutez les degrés d'échec ») : le contexte
  // d'`applyOps` d'une bande d'issue d'Activité doit porter `sl`, sinon le modificateur reste à 0
  // et la rangée la plus sévère du Tableau des Catastrophes de brassage est inatteignable.
  it('Maladresse d’Activité (alchimie ordinaire, VDM 12 l.425) : les degrés d’échec atteignent une rangée PLUS SÉVÈRE', () => {
    const h = hero();
    const table = findEffectTableById('vdm-catastrophes-de-brassage');
    const seed = 4242;
    const die = roll(1, 10, makeRNG(seed)); // même tirage que consommera `rollTable`
    const rowNoSL = findTableEntry(table.rows, die);
    const rowWithSL = findTableEntry(table.rows, die + 3); // sl=-3 → |DR négatif| = 3
    expect(findTableEntryIndex(table.rows, die + 3)).toBeGreaterThan(findTableEntryIndex(table.rows, die));

    const basePending: PendingActivity = {
      kind: 'catalog', heroId: h.id, activityId: 'alchimie-ordinaire', label: 'Alchimie ordinaire',
      skillLabel: 'Métier (Alchimiste)', skillValue: 40, difficulty: 'intermediaire',
      roll: 99, target: 40, success: false, sl: 0,
    };
    const setupHero = () => {
      const itl = useGame.getState().interlude!;
      itl.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
      useGame.setState({ interlude: { ...itl }, party: [...useGame.getState().party], journal: [] });
    };

    setupHero();
    seedBattleRng(seed);
    useGame.setState({ pendingActivity: { ...basePending, sl: 0 } });
    useGame.getState().activityConfirm();
    expect(useGame.getState().journal.join('\n')).toContain(rowNoSL.label);

    setupHero();
    seedBattleRng(seed);
    useGame.setState({ pendingActivity: { ...basePending, sl: -3 } });
    useGame.getState().activityConfirm();
    expect(useGame.getState().journal.join('\n')).toContain(rowWithSL.label);
  });
});

/**
 * #1874 C0 — le FM de palier 2 des Crampes (MSRC 16) jusqu'à SA CONSÉQUENCE, par le VRAI déclencheur
 * (Activité d'interlude ratée), avec QUATRE héros dont le malade n'est PAS le premier du groupe : la
 * branche d'échec pose À Terre sur le MALADE, et sur lui seul. La donnée n'est pas touchée — sa feuille
 * ne déclare pas de `on`, c'est la REPRISE qui sait sur qui la branche d'un Test SUBI tombe.
 */
describe('#1874 C0 — Crampes abdominales hors combat : À Terre sur le MALADE, pas sur le groupe', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    const party = [1, 2, 3, 4].map((i) => ({
      ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: `H${i}`, rng: makeRNG(i) }),
      id: `h${i}`,
    }));
    useGame.setState({ party, battle: null, interlude: null, bank: [], pendingOrders: [], pendingActivity: null, pendingTest: null, journal: [] });
    useGame.getState().startScene(testScene);
    vi.clearAllTimers();
    useGame.getState().seedRng(13);
    useGame.getState().startInterlude(3);
    draineCascade(useGame.getState);
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('T6 — le malade est le 3ᵉ du groupe : lui seul tombe À Terre', () => {
    const malade = useGame.getState().party[2];
    expect(malade.id, 'le sujet ne doit JAMAIS être `party[0]`').toBe('h3');
    malade.diseases = [{ id: 'colique', phase: 'active', symptoms: [{ symptomId: 'crampes-abdominales' }], minutesLeft: 1e5, durationMinutes: 1e5 }];
    const itl = useGame.getState().interlude!;
    itl.perHero[malade.id] = { ...itl.perHero[malade.id], fx: undefined, left: 2 };
    useGame.setState({ interlude: { ...itl }, party: [...useGame.getState().party] });

    useGame.getState().interludeActivity(malade.id, 'revenus');
    useGame.getState().activityRoll();
    // Échec « désastreux » (DR ≤ −4) → palier 1 inline (Sonné) + palier 2 en MODALE (Force Mentale).
    useGame.setState({ pendingActivity: { ...useGame.getState().pendingActivity!, roll: 99, success: false, sl: -4 } });
    useGame.getState().activityConfirm();

    const pt = useGame.getState().pendingTest!;
    expect(pt.actorId, 'le FM de palier 2 se jette chez le malade').toBe('h3');
    const autresAvant = JSON.stringify(useGame.getState().party.filter((c) => c.id !== 'h3'));
    useGame.setState({ pendingTest: { ...pt, roll: 99, success: false, sl: -2 } });
    useGame.getState().resolveTest();

    const apres = useGame.getState().party;
    expect(apres.find((c) => c.id === 'h3')!.conditions.some((c) => c.id === 'a-terre'), 'À Terre sur le malade').toBe(true);
    expect(JSON.stringify(apres.filter((c) => c.id !== 'h3')), 'un camarade est tombé à la place du malade').toBe(autresAvant);
  });
});
