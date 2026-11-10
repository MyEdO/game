/**
 * Activités d'interlude (LDB 23) : Revenus (LDB 08 l.105-120), Artisanat (Test étendu, matériaux
 * ¼ prix, achèvement → objet avec qualités), Opérations bancaires (invest/planque), blocages
 * d'événements par Classe.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { draineCascade } from './cascade.testkit';
import { createHero } from '../engine/character';
import { makeRNG, roll } from '../engine/dice';
import { toBrass, fromBrass, priceToMoney, PA_PER_CO } from '../engine/money';
import { partyMoneyTotal, creditBourse } from './bourseFlow';
import { findTrappingById, findEffectTableById } from '../data';
import { findTableEntry, findTableEntryIndex } from '../engine/tables';
import { seedBattleRng } from './battleRng';
import type { PendingActivity } from './interludeFlow';
import { openRitualFocus } from './interludeFlow';
import { preJetDActivite } from './verdictsDInterlude';
import { activityById } from '../engine/activities';
import { evaluateTest } from '../engine/tests';
import { DIFFICULTY_MODIFIERS } from '../engine/types';
import { testScene } from '../scenes/test-fixture';
import { t } from '../i18n';
import { pratiquer } from './interlude.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
// (les tests Apprentissage/commande utilisent les actions du noyau et les données réelles)

describe('Activités d’interlude (LDB 23)', () => {
  beforeEach(() => {
    const a = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    banc.setState({ party: [a] });
    banc.getState().lancerLaScene(testScene());
    creditBourse(banc.getState, banc.setState, banc.getState().party[0].id, fromBrass(2000));
    banc.getState().ensemencerLeTirage(13);
    banc.getState().ouvrirLInterlude(3);
    draineCascade(banc.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
  });

  function hero() { return banc.getState().party[0]; }
  function st() { return banc.getState().interlude!.perHero[hero().id]; }

  it('Revenus : modale → jet → Appliquer crédite revenueBrass (crédit DIFFÉRÉ, LDB 23 l.191) et consomme l’Activité', () => {
    // RAW : « Sur un succès, vous gagnez l'argent indiqué » (LDB 08 l.110) ; l'argent « vous est
    // seulement remis une fois que vous avez disposé de l'argent de votre dernière aventure » (LDB 23
    // l.191) → jamais dans `money`, seulement `revenueBrass`. Revenus maintient le Statut (l.193).
    // Neutralise un éventuel blocage d'événement pour CE test (on teste le flux, pas l'événement).
    const itl = banc.getState().interlude!;
    itl.perHero[hero().id] = { ...st(), fx: undefined, left: 2 };
    banc.setState({ interlude: { ...itl } });
    const moneyBefore = toBrass(partyMoneyTotal(banc.getState));
    pratiquer(banc.getState, hero().id, 'revenus');
    const pa = banc.getState().pendingActivity;
    expect(pa?.kind).toBe('catalog');
    expect(pa?.activityId).toBe('revenus');
    expect(pa?.difficulty).toBe('accessible'); // « Test Spectaculaire Accessible (+20) » (LDB 08 l.110) — Spectaculaire = Test à DR ordinaire (LDB 12 l.172), PAS étendu
    banc.getState().jetLancer('activite');
    // Force un succès propre (déterminisme du gain testé côté moteur).
    banc.setState({ pendingActivity: { ...banc.getState().pendingActivity!, roll: 1, success: true, sl: 2 } });
    banc.getState().jetValider('activite');
    expect(banc.getState().pendingActivity).toBeNull();
    const after = st();
    expect(after.didRevenus).toBe(true);
    expect(after.left).toBe(1);
    expect(after.revenueBrass).toBeGreaterThan(0);
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(moneyBefore); // crédit DIFFÉRÉ : la bourse n'a pas bougé
  });

  it('Revenus bloqués par l’événement (classe ou *) : la modale ne s’ouvre pas', () => {
    const itl = banc.getState().interlude!;
    itl.perHero[hero().id] = { ...st(), fx: { revenueBlockedClasses: ['*'] }, left: 2 };
    banc.setState({ interlude: { ...itl } });
    pratiquer(banc.getState, hero().id, 'revenus');
    expect(banc.getState().pendingActivity).toBeNull();
    expect(banc.getState().journal.join('\n')).toMatch(/ne peut pas entreprendre Revenus/);
  });

  it('Artisanat : engager paie ¼ du prix (LDB 23 l.76) ; le Test étendu cumule ; l’achèvement crée l’objet qualifié', () => {
    // RAW l.76 : « les matières premières […] coûteront un quart du prix de l'équipement, et devront
    // être achetées avant le début de l'Activité » ; l.78 : « Test étendu de Métier » ; l.102 : « Chaque
    // Activité […] vous permet d'effectuer un lancer pour votre Test étendu ».
    const h = hero();
    h.skills.push({ id: 'metier', spec: 'forgeron', characteristic: 'dexterite', advances: 10 });
    const itl0 = banc.getState().interlude!;
    itl0.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    banc.setState({ interlude: { ...itl0 } });
    const quarter = Math.max(1, Math.floor(toBrass(priceToMoney(findTrappingById('dague')!.price)) / 4));
    const before = toBrass(partyMoneyTotal(banc.getState));
    pratiquer(banc.getState, h.id, 'craft', { ouvrage: 'dague', qualites: ['solide'] });
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(before - quarter);
    expect(hero().craft?.trappingId).toBe('dague');
    // Lancer : on force l'achèvement (drBefore au seuil).
    pratiquer(banc.getState, h.id, 'craft');
    expect(banc.getState().pendingActivity?.kind).toBe('catalog');
    expect(banc.getState().pendingActivity?.activityId).toBe('craft');
    expect(banc.getState().pendingActivity?.drTarget).toBeGreaterThan(0); // Test étendu : cible de DR peuplée
    banc.getState().jetLancer('activite');
    const pa = banc.getState().pendingActivity!;
    banc.setState({ pendingActivity: { ...pa, roll: 1, success: true, sl: Math.max(1, pa.drTarget ?? 1) , drBefore: pa.drTarget } });
    banc.getState().jetValider('activite');
    const after = st();
    expect(hero().craft).toBeUndefined();
    expect(after.left).toBe(2);
    const made = hero().items?.find((i) => i.label === 'Dague' && (i.qualities ?? []).some((q) => q.id === 'solide'));
    expect(made).toBeTruthy();
  });

  it('Rituel : `openRitualFocus` engage puis `resolveFocus` cumule le DR jusqu’au NI réduit de moitié, puis clôt (VDM 02 l.777) — Activité `blocked` au catalogue (#879), mécanisme exercé DIRECTEMENT (openRitualFocus + jetLancer@activite/jetValider@activite, hors de la porte fermée au joueur)', () => {
    const h = hero();
    h.skills.push({ id: 'focalisation', characteristic: 'force-mentale', advances: 10 });
    h.spells = ['graver-une-pierre-d-ogham']; // NI 50, aucun Domaine requis (`domains: []`)
    const itl = banc.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    banc.setState({ interlude: { ...itl } });
    const r = openRitualFocus(banc.getState, banc.setState, h, 'graver-une-pierre-d-ogham');
    // Pré-jet du Rituel engagé : la voie de Focalisation que le geste poserait.
    const focus = () => preJetDActivite(banc.getState(), h.id, activityById('accomplir-un-rituel')!)!;
    expect(r).toBeDefined();
    expect(r!.drTarget).toBe(25); // NI 50 réduit de moitié (arrondi sup.) en Activité
    expect(r!.drBefore).toBe(0);
    expect(hero().ritual).toEqual({ spellId: 'graver-une-pierre-d-ogham', drDone: 0, drTarget: 25 });
    // `pendingActivity` reconstitué à la main (assemblage d'`openCatalogActivity`) : l'Activité est
    // `blocked` au catalogue, le choix `interlude.activite` refuse.
    banc.setState({
      pendingActivity: {
        heroId: h.id, kind: 'catalog', activityId: 'accomplir-un-rituel',
        skillLabel: 'Focalisation', skillValue: focus().value, difficulty: focus().difficulty,
        roll: null, target: 0, sl: 0, success: false,
        ...r!, label: `Accomplir un Rituel — ${r!.label}`,
      } as PendingActivity,
    });
    // Seed choisi pour que le PROCHAIN jet (`battleRng()`, consommé une fois par `resolveFocus`) soit
    // un échec net (marge ≥ 15) — preuve indépendante de l'aléa par défaut du fichier (seed 13).
    const effTarget = focus().value + DIFFICULTY_MODIFIERS.intermediaire;
    let seed = 1;
    while (makeRNG(seed).int(1, 100) - effTarget < 15) seed++;
    seedBattleRng(seed);
    banc.getState().jetLancer('activite'); // exerce `resolveFocus` réel (branche `p.ritualSpell`, rollFlowSpecs.ts)
    const pa = banc.getState().pendingActivity!;
    expect(pa.success).toBe(false);
    // Un Round raté d'un Test étendu cumule son DR NÉGATIF (LDB 12 l.174) : le Rituel l'emporte au cumul.
    const generic = evaluateTest(pa.roll!, effTarget);
    expect(generic.sl).toBeLessThan(0);
    expect(pa.sl).toBe(generic.sl);
    // Round partiel : force 10 DR (déterminisme du cumul testé côté moteur, comme l'Artisanat ci-dessus).
    // ⚠ 10 puis 20 DR forcés ci-dessous EXERCENT le cumul (`extendedTestStep`) — ce ne sont PAS des DR
    // représentatifs d'un Round réel (`resolveFocus` mesure ~1,39 DR de moyenne) : cette trajectoire de
    // 2 Rounds n'est pas jouable en l'état (#879).
    banc.setState({ pendingActivity: { ...pa, sl: 10, success: true } });
    banc.getState().jetValider('activite');
    expect(hero().ritual).toEqual({ spellId: 'graver-une-pierre-d-ogham', drDone: 10, drTarget: 25 });
    expect(st().left).toBe(2);
    // 2e Round, sans re-préciser `spellId` : reprend le Rituel engagé (`h.ritual`), achève (10+20 ≥ 25).
    const r2 = openRitualFocus(banc.getState, banc.setState, h, undefined);
    expect(r2).toBeDefined();
    expect(r2!.drBefore).toBe(10);
    banc.setState({
      pendingActivity: {
        heroId: h.id, kind: 'catalog', activityId: 'accomplir-un-rituel',
        skillLabel: 'Focalisation', skillValue: focus().value, difficulty: focus().difficulty,
        roll: null, target: 0, sl: 0, success: false,
        ...r2!, label: `Accomplir un Rituel — ${r2!.label}`,
      } as PendingActivity,
    });
    banc.getState().jetLancer('activite');
    banc.setState({ pendingActivity: { ...banc.getState().pendingActivity!, sl: 20, success: true } });
    banc.getState().jetValider('activite');
    expect(hero().ritual).toBeUndefined();
    expect(st().left).toBe(1);
    expect(banc.getState().journal.join('\n')).toMatch(/achève le Rituel/);
  });

  it('Rituel au NI FORMULE (`cn: null`, #879 volet 2) : `openRitualFocus` refuse, non engageable en Activité', () => {
    const h = hero();
    h.spells = ['les-faux-croisees'];
    const itl = banc.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    banc.setState({ interlude: { ...itl } });
    const r = openRitualFocus(banc.getState, banc.setState, h, 'les-faux-croisees');
    expect(r).toBeUndefined();
    expect(banc.getState().journal.join('\n')).toMatch(/Incantation indéterminé/);
    expect(st().left).toBe(3); // refus AVANT le jet — aucun créneau consommé
    expect(hero().ritual).toBeUndefined();
  });

  it('Rituel : Activité `blocked` au catalogue (#879) — fermée au joueur, le choix de l’Activité la refuse', () => {
    const h = hero();
    h.skills.push({ id: 'focalisation', characteristic: 'force-mentale', advances: 10 });
    h.spells = ['graver-une-pierre-d-ogham'];
    const itl = banc.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    banc.setState({ interlude: { ...itl } });
    pratiquer(banc.getState, h.id, 'accomplir-un-rituel', { spellId: 'graver-une-pierre-d-ogham' });
    expect(banc.getState().pendingActivity).toBeNull();
    expect(st().left).toBe(3); // porte fermée AVANT tout jet — aucun créneau consommé
    expect(hero().ritual).toBeUndefined();
  });

  it('Banque : invest interdit à l’échelon Bronze ; la planque débite et consomme l’Activité', () => {
    const itl = banc.getState().interlude!;
    itl.perHero[hero().id] = { ...st(), fx: undefined, left: 2 };
    banc.setState({ interlude: { ...itl } });
    hero().career = 'Agitateur'; // Pamphlétaire (niv.1) = Bronze 1 → invest refusé
    hero().careerLevel = 1;
    banc.getState().deposerALaBanque(hero().id, 'investir', 120);
    expect(banc.getState().bank).toHaveLength(0);
    expect(banc.getState().journal.join('\n')).toMatch(/investir en banque exige le Statut Argent ou Or/);
    const before = toBrass(partyMoneyTotal(banc.getState));
    banc.getState().deposerALaBanque(hero().id, 'planque', 120);
    expect(banc.getState().bank).toHaveLength(1);
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(before - 120);
    expect(st().left).toBe(1);
  });

  it('Banque, placement (LDB 23 l.168) : l’Indice choisi s’applique ; absent, il se tire au d10 de la graine ; hors placement ou hors 1-10, refusé et dit', () => {
    const itl = banc.getState().interlude!;
    itl.perHero[hero().id] = { ...st(), fx: undefined, left: 6 };
    banc.setState({ interlude: { ...itl } });
    const indices = () => banc.getState().bank.map((d) => d.rate);
    banc.getState().deposerALaBanque(hero().id, 'investir', 120, 1);
    banc.getState().deposerALaBanque(hero().id, 'investir', 120, 10);
    expect(indices()).toEqual([1, 10]);
    banc.getState().ensemencerLeTirage(5);
    banc.getState().deposerALaBanque(hero().id, 'investir', 120);
    banc.getState().ensemencerLeTirage(5);
    banc.getState().deposerALaBanque(hero().id, 'investir', 120);
    const [, , tire, retire] = indices();
    expect([tire >= 1 && tire <= 10, retire]).toEqual([true, tire]);
    banc.getState().deposerALaBanque(hero().id, 'planque', 120, 3);
    expect([indices().length, banc.getState().journal.slice(-1)[0]]).toEqual([4, t('if.bankIndiceHorsPlacement')]);
    banc.getState().deposerALaBanque(hero().id, 'investir', 120, 11 as never);
    expect([indices().length, banc.getState().journal.slice(-1)[0]]).toEqual([4, t('if.bankIndiceHorsBornes', { indice: 11 })]);
    expect(st().left).toBe(2);
  });

  it('Apprentissage particulier (LDB 23 l.66-72) : échec = PX et argent perdus « en vain » + acharnement +10 ; succès = Talent acquis', () => {
    // RAW l.68 : « dépensant en vain des PX et de l'argent » ; l.72 : « Tentez un Test Difficile (-20)
    // […] Sur un succès, vous avez appris le Talent. Sinon […] gagnez un modificateur de +10 pour
    // chaque tentative ratée ». Prix du tuteur (l.72) : « 2D10 pistoles d'argent par 100PX ».
    const h = hero();
    h.xp = 300;
    const itl = banc.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    banc.setState({ interlude: { ...itl } });
    creditBourse(banc.getState, banc.setState, h.id, fromBrass(5000));
    pratiquer(banc.getState, h.id, 'learn', { talentId: 'chanceux' }); // id STABLE du Talent
    const pa = banc.getState().pendingActivity!;
    expect(pa.kind).toBe('catalog');
    expect(pa.activityId).toBe('learn');
    expect(pa.difficulty).toBe('difficile'); // « Test Difficile (-20) »
    expect(pa.xpCost).toBe(100);
    const moneyBefore = toBrass(partyMoneyTotal(banc.getState));
    banc.getState().jetLancer('activite');
    // Échec forcé : PX/argent dépensés en vain, +10 cumulé.
    banc.setState({ pendingActivity: { ...banc.getState().pendingActivity!, roll: 99, success: false, sl: -2 } });
    banc.getState().jetValider('activite');
    expect(hero().xp).toBe(200);
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(moneyBefore - (pa.tutorBrass ?? 0)); // tuteur payé MÊME sur échec
    expect(st().learnFails?.['chanceux']).toBe(1); // clé = id stable
    expect(hero().talents.some((t) => t.talentId === 'chanceux')).toBe(false);
    // Seconde tentative : succès → Talent acquis ; l'acharnement est un modificateur du Test (LDB 23 l.72).
    pratiquer(banc.getState, h.id, 'learn', { talentId: 'chanceux' });
    const reprise = banc.getState().pendingActivity!;
    expect([reprise.skillValue, reprise.mod, reprise.modLabel]).toEqual([pa.skillValue, 10, 'Acharnement']);
    banc.getState().jetLancer('activite');
    banc.setState({ pendingActivity: { ...banc.getState().pendingActivity!, roll: 1, success: true, sl: 1 } });
    banc.getState().jetValider('activite');
    expect(hero().talents.some((t) => t.talentId === 'chanceux')).toBe(true);
    expect(hero().xp).toBe(100);
  });

  it('Apprentissage particulier : le Test se jette sur la valeur de Test, États compris (LDB 16 l.125)', () => {
    const h = hero();
    h.xp = 300;
    const itl = banc.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    banc.setState({ interlude: { ...itl } });
    creditBourse(banc.getState, banc.setState, h.id, fromBrass(5000));
    pratiquer(banc.getState, h.id, 'learn', { talentId: 'chanceux' });
    const sansEtat = banc.getState().pendingActivity!.skillValue;
    banc.setState({ pendingActivity: null });
    hero().conditions = [{ id: 'sonne', value: 3 }];
    pratiquer(banc.getState, h.id, 'learn', { talentId: 'chanceux' });
    expect(banc.getState().pendingActivity!.skillValue, 'Sonné ×3 : −30').toBe(sansEtat - 30);
  });

  it('Recherche de savoir sans Savoir avancé : Intelligence Complexe, sur la valeur de Test, États compris (LDB 16 l.125)', () => {
    const h = hero();
    h.skills = h.skills.filter((k) => k.id !== 'savoir');
    const itl = banc.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    banc.setState({ interlude: { ...itl } });
    pratiquer(banc.getState, h.id, 'recherche-de-savoir');
    const pa = banc.getState().pendingActivity!;
    expect(pa.difficulty, 'Complexe, un cran plus dur hors Classe Lettres (`classGate` de l’Activité)').toBe('difficile');
    banc.setState({ pendingActivity: null });
    hero().conditions = [{ id: 'sonne', value: 3 }];
    pratiquer(banc.getState, h.id, 'recherche-de-savoir');
    expect(banc.getState().pendingActivity!.skillValue, 'Sonné ×3 : −30').toBe(pa.skillValue - 30);
  });

  it('Passer commande : objet du stock ordinaire refusé ; Exotique payé maintenant, livré à l’interlude SUIVANT', () => {
    const h = hero();
    const itl = banc.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    banc.setState({ interlude: { ...itl } });
    creditBourse(banc.getState, banc.setState, h.id, fromBrass(999999));
    banc.getState().commanderLObjet(h.id, 'dague'); // Commune → refus
    expect(banc.getState().pendingOrders).toHaveLength(0);
    expect(banc.getState().journal.join('\n')).toMatch(/s’achète chez un marchand|s'achète chez un marchand/);
    const exotic = findTrappingById('long-fusil-d-hochland'); // l'exemple du LDB (Exotique)
    if (!exotic || exotic.availability !== 'exotique') return; // garde : données absentes → couvert par le refus ci-dessus
    banc.getState().commanderLObjet(h.id, exotic.id);
    expect(banc.getState().pendingOrders).toEqual([{ heroId: h.id, trappingId: exotic.id }]);
    expect(st().left).toBe(2);
    // Clôture + nouvel interlude : la commande est livrée.
    banc.getState().fenetreValider('interlude');
    banc.getState().ouvrirLInterlude(1);
    draineCascade(banc.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    expect(hero().items?.some((i) => i.label === exotic.label)).toBe(true);
    expect(banc.getState().pendingOrders).toHaveLength(0);
  });

  /** VDM 12 l.42 : le bâton enchanté « nécessite l'Activité Passer commande et coûte 15 CO », sans
   *  porter de Disponibilité — le chemin d'EXÉCUTION doit l'accepter, pas seulement le catalogue.
   *  Contre-épreuve hors commerce (sans prix) sur le même chemin. */
  it('Passer commande : bâton enchanté (sans Disponibilité, 15 CO) accepté ; hors commerce refusé', () => {
    const h = hero();
    const itl = banc.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    banc.setState({ interlude: { ...itl } });
    creditBourse(banc.getState, banc.setState, h.id, fromBrass(999999));
    const before = toBrass(partyMoneyTotal(banc.getState));
    banc.getState().commanderLObjet(h.id, 'baton-enchante');
    expect(banc.getState().pendingOrders).toEqual([{ heroId: h.id, trappingId: 'baton-enchante' }]);
    expect(before - toBrass(partyMoneyTotal(banc.getState))).toBe(15 * PA_PER_CO);
    expect(st().left).toBe(2);
    for (const id of ['licence-de-guilde', 'arme-improvisee', 'mains-nues']) {
      banc.getState().commanderLObjet(h.id, id);
      expect(banc.getState().pendingOrders, `${id} ne doit pas se commander`).toHaveLength(1);
    }
    expect(st().left).toBe(2); // aucun refus n'a consommé d'Activité
  });

  it('Banque : le retrait d’une planque rend l’argent (ou la perd sur 🎲 ≤ 10) et vide le dépôt', () => {
    const itl = banc.getState().interlude!;
    itl.perHero[hero().id] = { ...st(), fx: undefined, left: 2 };
    banc.setState({ interlude: { ...itl }, bank: [{ uid: 'depot-1', heroId: hero().id, kind: 'planque', brass: 240, rate: 0 }] });
    const before = toBrass(partyMoneyTotal(banc.getState));
    banc.getState().retirerDeLaBanque('depot-1');
    expect(banc.getState().bank).toHaveLength(0);
    const after = toBrass(partyMoneyTotal(banc.getState));
    const journal = banc.getState().journal.join('\n');
    if (after > before) expect(journal).toMatch(/récupère/);
    else expect(journal).toMatch(/découverte|perdus/);
  });

  // ── Identifier un artefact magique (ADE II 4 l.46-59) ─────────────────────────────────────
  function armArtefact(withSavoir = true) {
    const h = hero();
    if (withSavoir) h.skills.push({ id: 'savoir', spec: 'magie', characteristic: 'intelligence', advances: 10 });
    h.items = [...(h.items ?? []), { uid: 'art1', name: 'Épée ancienne', kind: 'melee', qualities: [{ id: 'de-plaies-atroces' }], enc: 1, equipped: false, identified: false } as never];
    const itl = banc.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    banc.setState({ interlude: { ...itl }, party: [...banc.getState().party] });
  }
  const artefact = () => hero().items!.find((i) => i.uid === 'art1')!;
  const forceRoll = (roll: number, success: boolean, sl: number) => {
    banc.getState().jetLancer('activite');
    banc.setState({ pendingActivity: { ...banc.getState().pendingActivity!, roll, success, sl } });
    banc.getState().jetValider('activite');
  };

  it('Identifier : exige Savoir (Magie) acquis (« Pour d’autres sorciers », ADE II 4 l.41)', () => {
    armArtefact(false);
    pratiquer(banc.getState, hero().id, 'identify', { itemUid: 'art1' });
    expect(banc.getState().pendingActivity).toBeNull();
    expect(banc.getState().journal.join('\n')).toMatch(/Savoir \(Magie\)/);
  });

  it('Identifier : Test de Savoir (Magie) Intermédiaire (+0), Activité consommée (ADE II 4 l.41)', () => {
    armArtefact();
    pratiquer(banc.getState, hero().id, 'identify', { itemUid: 'art1' });
    const pa = banc.getState().pendingActivity;
    expect(pa?.kind).toBe('catalog');
    expect(pa?.activityId).toBe('identify');
    expect(pa?.difficulty).toBe('intermediaire'); // « Savoir (Magie) Intermédiaire (+0) »
    forceRoll(5, true, 4);
    expect(st().left).toBe(2);
  });

  // ADE II 4 l.43-52 — table de DR complète (le POC collapsait ≥+4/≤+3 et IGNORAIT la ligne « 0 à +1 »).
  it('Identifier : Succès Impressionnant (+4 à +5) → identifié + « sait s’il a des Particularités »', () => {
    armArtefact();
    pratiquer(banc.getState, hero().id, 'identify', { itemUid: 'art1' });
    forceRoll(5, true, 4);
    expect(artefact().identified).toBe(true); // « le Personnage est capable d'identifier l'objet »
    expect(artefact().magicKnown).toBe(true); // « et sait s'il a des Particularités »
  });

  it('Identifier : Succès (+2 à +3) → identifié, Particularités visibles seulement (pas les cachées)', () => {
    armArtefact();
    pratiquer(banc.getState, hero().id, 'identify', { itemUid: 'art1' });
    forceRoll(20, true, 2);
    expect(artefact().identified).toBe(true); // RAW : tout succès identifie l'objet (correction du POC)
    expect(artefact().magicKnown).toBeFalsy(); // « il ne voit pas celles qui sont cachées »
  });

  it('Identifier : Succès Minime (0 à +1) → identifié ET découvre UNE Particularité cachée (ligne ignorée par le POC)', () => {
    armArtefact();
    pratiquer(banc.getState, hero().id, 'identify', { itemUid: 'art1' });
    forceRoll(41, true, 1); // DR +1 → Succès Minime
    expect(artefact().identified).toBe(true);
    expect(artefact().magicKnown).toBe(true); // « découvre une Particularité cachée »
  });

  it('Identifier : Échec (−2 à −3) → confond avec un objet similaire, AUCUNE fausse Particularité (ADE II 4 l.50)', () => {
    armArtefact();
    pratiquer(banc.getState, hero().id, 'identify', { itemUid: 'art1' });
    forceRoll(70, false, -2);
    expect(artefact().identified).toBe(false); // « confond l'artefact avec un type d'objet similaire »
    expect(artefact().suspectedQualities ?? []).toHaveLength(0); // pas de fausse Particularité avant −4 (≠ Échec Minime)
  });

  it('Identifier : Échec Impressionnant (−4 à −5) → UNE fausse Particularité soupçonnée', () => {
    armArtefact();
    pratiquer(banc.getState, hero().id, 'identify', { itemUid: 'art1' });
    forceRoll(88, false, -4);
    const suspected = artefact().suspectedQualities ?? [];
    expect(suspected).toHaveLength(1); // « soupçonne également que l'objet possède une Particularité qu'il n'a pas »
    expect(suspected).not.toContain('De plaies atroces'); // jamais une qualité RÉELLE de l'objet
    expect(artefact().identified).toBe(false); // « confond l'artefact avec un type d'objet similaire »
  });

  it('Identifier : Échec Stupéfiant (−6 ou moins) → AU MOINS DEUX fausses Particularités, purgées par une vraie révélation', () => {
    armArtefact();
    pratiquer(banc.getState, hero().id, 'identify', { itemUid: 'art1' });
    forceRoll(99, false, -6);
    const suspected = artefact().suspectedQualities ?? [];
    expect(suspected).toHaveLength(2); // « soupçonne également que l'objet possède au moins deux Particularités qu'il n'a pas »
    expect(suspected).not.toContain('De plaies atroces');
    expect(artefact().identified).toBe(false);
    // Une identification réussie ultérieure dissipe les fausses certitudes.
    pratiquer(banc.getState, hero().id, 'identify', { itemUid: 'art1' });
    forceRoll(3, true, 6);
    expect(artefact().identified).toBe(true);
    expect(artefact().suspectedQualities).toBeUndefined();
  });

  // Correction coordinateur (2b) : seam `onOwnTestFailed` du chemin JOUEUR HORS combat (Activité d'interlude).
  it('Crampes abdominales : rater une Activité d’interlude → État Sonné (MSRC 16 l.152, cas RAW cardinal)', () => {
    const h = hero();
    h.diseases = [{ id: 'colique', phase: 'active', symptoms: [{ symptomId: 'crampes-abdominales' }], minutesLeft: 1e5, durationMinutes: 1e5 }];
    const itl = banc.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 2 }; // neutralise un éventuel blocage d'événement
    banc.setState({ interlude: { ...itl }, party: [...banc.getState().party] });
    pratiquer(banc.getState, h.id, 'revenus');
    banc.getState().jetLancer('activite');
    // Force un échec « normal ou pire » (DR ≤ −2) → palier 1 des Crampes = Sonné.
    banc.setState({ pendingActivity: { ...banc.getState().pendingActivity!, roll: 99, success: false, sl: -2 } });
    banc.getState().jetValider('activite');
    const after = banc.getState().party.find((c) => c.id === h.id)!;
    expect(after.conditions.some((c) => c.id === 'sonne')).toBe(true);
  });

  // Correction coordinateur (6) : « un jet = une modale » vaut HORS combat — le FM de palier 2 d'un héros
  // s'ouvre en MODALE de jet scène (pendingTest), jamais inline. Ré-entrance tamponnée (noOwnTestFailed).
  it('Crampes DR ≤ −4 : le sous-Test de FM (palier 2) d’un HÉROS ouvre une MODALE de jet, pas un jet inline', () => {
    const h = hero();
    h.characteristics['force-mentale'] = 40;
    h.diseases = [{ id: 'colique', phase: 'active', symptoms: [{ symptomId: 'crampes-abdominales' }], minutesLeft: 1e5, durationMinutes: 1e5 }];
    const itl = banc.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 2 };
    banc.setState({ interlude: { ...itl }, party: [...banc.getState().party], pendingTest: null });
    pratiquer(banc.getState, h.id, 'revenus');
    banc.getState().jetLancer('activite');
    banc.setState({ pendingActivity: { ...banc.getState().pendingActivity!, roll: 99, success: false, sl: -4 } });
    banc.getState().jetValider('activite');
    const pt = banc.getState().pendingTest;
    expect(pt).toBeTruthy(); // le FM s'ouvre en MODALE (openSkillTest), pas résolu inline
    expect(pt!.sujet?.skill?.id ?? pt!.sujet?.characteristic).toBe('force-mentale');
    expect(pt!.noOwnTestFailed).toBe(true); // garde de ré-entrance portée par la modale
    const h2 = banc.getState().party.find((c) => c.id === h.id)!;
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
    const rowNoSL = findTableEntry(table.entries, die);
    const rowWithSL = findTableEntry(table.entries, die + 3); // sl=-3 → |DR négatif| = 3
    expect(findTableEntryIndex(table.entries, die + 3)).toBeGreaterThan(findTableEntryIndex(table.entries, die));

    const basePending: PendingActivity = {
      kind: 'catalog', heroId: h.id, activityId: 'alchimie-ordinaire', label: 'Alchimie ordinaire',
      skillLabel: 'Métier (Alchimiste)', skillValue: 40, difficulty: 'intermediaire', ligne: { base: 40, mods: [], target: 40, difficulty: 'intermediaire' },
      roll: 99, target: 40, success: false, sl: 0,
    };
    const setupHero = () => {
      const itl = banc.getState().interlude!;
      itl.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
      banc.setState({ interlude: { ...itl }, party: [...banc.getState().party], journal: [] });
    };

    setupHero();
    seedBattleRng(seed);
    banc.setState({ pendingActivity: { ...basePending, sl: 0 } });
    banc.getState().jetValider('activite');
    expect(banc.getState().journal.join('\n')).toContain(rowNoSL.label);

    setupHero();
    seedBattleRng(seed);
    banc.setState({ pendingActivity: { ...basePending, sl: -3 } });
    banc.getState().jetValider('activite');
    expect(banc.getState().journal.join('\n')).toContain(rowWithSL.label);
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
    const party = [1, 2, 3, 4].map((i) => ({
      ...createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: `H${i}`, seed: i }),
      id: `h${i}`,
    }));
    banc.setState({ party });
    banc.getState().lancerLaScene(testScene());
    banc.getState().ensemencerLeTirage(13);
    banc.getState().ouvrirLInterlude(3);
    draineCascade(banc.getState);
  });

  it('T6 — le malade est le 3ᵉ du groupe : lui seul tombe À Terre', () => {
    const malade = banc.getState().party[2];
    expect(malade.id, 'le sujet ne doit JAMAIS être `party[0]`').toBe('h3');
    malade.diseases = [{ id: 'colique', phase: 'active', symptoms: [{ symptomId: 'crampes-abdominales' }], minutesLeft: 1e5, durationMinutes: 1e5 }];
    const itl = banc.getState().interlude!;
    // Période sans Événement : un Événement de groupe tiré par un camarade vaudrait aussi pour le malade.
    for (const id of Object.keys(itl.perHero)) itl.perHero[id] = { ...itl.perHero[id], fx: undefined };
    itl.perHero[malade.id] = { ...itl.perHero[malade.id], left: 2 };
    banc.setState({ interlude: { ...itl }, party: [...banc.getState().party] });

    pratiquer(banc.getState, malade.id, 'revenus');
    banc.getState().jetLancer('activite');
    // Échec « désastreux » (DR ≤ −4) → palier 1 inline (Sonné) + palier 2 en MODALE (Force Mentale).
    banc.setState({ pendingActivity: { ...banc.getState().pendingActivity!, roll: 99, success: false, sl: -4 } });
    banc.getState().jetValider('activite');

    const pt = banc.getState().pendingTest!;
    expect(pt.actorId, 'le FM de palier 2 se jette chez le malade').toBe('h3');
    const autresAvant = JSON.stringify(banc.getState().party.filter((c) => c.id !== 'h3'));
    banc.setState({ pendingTest: { ...pt, roll: 99, success: false, sl: -2 } });
    banc.getState().jetValider('test');

    const apres = banc.getState().party;
    expect(apres.find((c) => c.id === 'h3')!.conditions.some((c) => c.id === 'a-terre'), 'À Terre sur le malade').toBe(true);
    expect(JSON.stringify(apres.filter((c) => c.id !== 'h3')), 'un camarade est tombé à la place du malade').toBe(autresAvant);
  });
});
