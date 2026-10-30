/**
 * Écran « Entre deux aventures » refondu (LOT 6) : bandeau de SYNTHÈSE persistant (vignettes héros
 * + pips d'Activités + bourse du groupe, les 3 phases), volets homogènes au gabarit `ActivityPane`
 * (pied FIXE : pré-jet visible AVANT « Entreprendre »), clôture récapitulative confirmée (M3).
 * Rendu statique : le store SSR sert l'état initial, d'où le seam (même pattern que WorldMapView).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useGame } from '../state/store';
import { draineCascade, poseSurDeNonTombe } from '../noyau/cascade.testkit';
import { createHero } from '../engine/character';
import { fromBrass, toBrass } from '../engine/money';
import { partyMoneyTotal, distributeCredit, debitBourse } from '../noyau/bourseFlow';
import { bourseOf } from '../engine/bourse';
import { testScene } from '../scenes/test-fixture';
import { interludeCatalog } from '../noyau/interludeFlow';
import { refusDeRevenus, refusDOuvertureDActivite } from '../noyau/verdictsDInterlude';
import { setRule, resetRule } from '../engine/policy';
import { interludeEventFor } from '../data/interludeEvents';
import { InterludeScreen, type InterludeSeam } from './InterludeScreen';
import { ciblePsy } from '../engine/psych/ciblage';
import { ACTIVITIES, activityById, craftCatalog, craftSpecOf, entrainementOptions, learnableTalents, metierOf, orderCatalog } from '../engine/activities';
import careers from '../data/careers.json';
import { findTrappingById } from '../data';
import type { Combatant } from '../engine/types';
import { avecActivite } from '../engine/activiteMer.testkit';
import { testValue } from '../engine/skills';

/** Texte NU d'un rendu statique : balises retirées, entités HTML de React décodées — pour confronter
 *  un texte de DONNÉE (apostrophes comprises) au markup rendu. */
const mdToPlain = (html: string) => html
  .replace(/<[^>]*>/g, '')
  .replace(/&#x27;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');

/** La raison accessible rendue sous l'id `id`, ou `undefined`. */
const raisonDId = (html: string, id: string) => mdToPlain(html.match(new RegExp(`id="${id}">([^<]*)</p>`))?.[1] ?? '') || undefined;
/** La balise du bouton d'entrée `key` FERMÉE (liée à sa raison), ou `undefined`. */
const entreeFermee = (html: string, key: string) => html.match(new RegExp(`<button[^>]*aria-describedby="interlude-act-${key}-reason"[^>]*>`))?.[0];
/** La raison accessible de l'entrée `key`, ou `undefined` si elle est ouverte. */
const raisonDe = (html: string, key: string) => raisonDId(html, `interlude-act-${key}-reason`);

function buildSeam(weeks = 3, groupe?: Combatant[]): InterludeSeam {
  const a = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Vétéran', seed: 1601 });
  a.xp = 300;
  const b = createHero({ speciesId: 'nains', careerId: 'artisan', label: 'Forgeron', seed: 1602 });
  if (!b.skills.some((s) => s.id === 'metier')) b.skills.push({ id: 'metier', spec: 'forgeron', characteristic: 'dexterite', advances: 10 });
  useGame.setState({ party: groupe ?? [a, b], battle: null, interlude: null, bank: [], pendingOrders: [], journal: [] });
  useGame.getState().startScene(testScene());
  vi.clearAllTimers();
  useGame.setState({ screen: 'interlude' });
  distributeCredit(useGame.getState, useGame.setState, fromBrass(5000)); // richesse de départ répartie sur les bourses perso (#531)
  useGame.getState().seedRng(7);
  useGame.getState().startInterlude(weeks);
  draineCascade(useGame.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
  const s = useGame.getState();
  return { interlude: s.interlude!, party: s.party, money: partyMoneyTotal(useGame.getState), bank: s.bank, pendingOrders: s.pendingOrders };
}

describe('InterludeScreen — refonte LOT 6', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('ouvre sur la phase Événements : d100 raconté par héros + CTA vers les Activités', () => {
    const seam = buildSeam();
    const html = renderToStaticMarkup(<InterludeScreen seam={seam} />);
    expect(html).toContain('Entre deux aventures');
    expect(html).toContain('Vétéran');
    expect(html).toContain('Événement'); // hint de phase
    expect(html).toContain('Passer aux Activités');
    expect(html).not.toContain('Clore'); // pas de clôture sur la phase d'intro
  });

  it('phase « tirage » (#942 L7) : le héros dont le dé n’est pas posé ATTEND — ni plantage, ni dé menteur, ni Activités ouvertes', () => {
    const seam = buildSeam();
    // Le dé du 1ᵉʳ héros (celui dont le volet d'Activités s'ouvre par défaut) n'est pas tombé : la
    // pose se fait dans la fenêtre de séquence (`CascadeModal`), l'écran d'interlude n'offre rien.
    const [a, b] = seam.party;
    const attente: InterludeSeam = {
      ...seam,
      interlude: {
        ...seam.interlude,
        phase: 'tirage',
        perHero: { ...seam.interlude.perHero, [a.id]: { ...seam.interlude.perHero[a.id], eventRoll: undefined, fx: undefined } },
      },
    };
    const html = renderToStaticMarkup(<InterludeScreen seam={attente} />);
    expect(html).toContain('Le dé n’est pas encore tombé');
    expect(html).toContain(a.label);
    // Le héros DÉJÀ tiré garde sa carte scellée : l'attente est PAR héros.
    expect(html).toContain(interludeEventFor(seam.interlude.perHero[b.id].eventRoll!).label);
    // Le passage aux Activités est fermé tant qu'un dé manque (raison LISIBLE, pas un bouton mort).
    expect(html).toContain('interlude-draw-pending');
    expect(html).toMatch(/1 dé d’Événement à poser/);
    // La carte de la fiche du héros en attente ne prétend AUCUN jet (pas de « 0 — »).
    const activites = renderToStaticMarkup(<InterludeScreen seam={{ ...attente, phase: 'activities' }} />);
    expect(activites).toContain('Événement de la période : dé à poser.');
    expect(activites).not.toMatch(/0 — /);
  });

  it('bandeau de SYNTHÈSE persistant : vignettes héros (pips ●○) + bourse du groupe, dès la phase Événements', () => {
    const seam = buildSeam();
    const html = renderToStaticMarkup(<InterludeScreen seam={seam} />);
    expect(html).toContain('interlude-synth'); // le bandeau
    expect(html).toContain('●'); // pips d'Activités restantes DANS le bandeau (phase 1 incluse)
    expect(html).toContain('interlude-synth-purse'); // bourse du groupe (impact des événements visible)
    expect(html).toContain('Vétéran');
    expect(html).toContain('Forgeron');
  });

  it('Activités : UN héros à la fois (Tabs) + maître-détail (liste des Activités) + clôture pour l’hôte', () => {
    const seam = buildSeam();
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, phase: 'activities' }} />);
    // plus AUCUNE saisie de libellé exact héritée du POC
    expect(html).not.toContain('nom exact');
    expect(html).toContain('tab-btn'); // Tabs (primitive UNIQUE) — les onglets SÉLECTIONNENT le héros (#330)
    expect(html.match(/interlude-hero panel/g)?.length).toBe(1); // UN SEUL volet de héros rendu à la fois
    expect(html).toContain('master-detail-list'); // gabarit MasterDetail (liste GAUCHE + détail CENTRE)
    expect(html).toContain('Revenus'); // Revenus est un volet comme les autres (gabarit commun)
    expect(html).toContain('Artisanat');
    expect(html).toContain('Apprentissage');
    expect(html).toContain('Commande');
    expect(html).toContain('Banque');
    expect(html).toContain('Identifier');
    expect(html).toContain('●'); // pips (bandeau)
    expect(html).toContain('Clore l&#x27;interlude…');
  });

  it('pied FIXE du volet : le PRÉ-JET (compétence + Difficulté) est visible AVANT « Entreprendre » (Revenus)', () => {
    const seam = buildSeam();
    const hero = seam.party[0]; // Vétéran
    const html = renderToStaticMarkup(
      <InterludeScreen seam={{ ...seam, phase: 'activities', openPane: { heroId: hero.id, pane: 'revenus' } }} />,
    );
    expect(html).toContain('master-detail-list'); // maître-détail (#330) : liste GAUCHE + détail CENTRE
    expect(html).toContain('activity-pane-desc'); // la description VERBATIM `<Prose>` (`desc` de activities.json)
    expect(html).toContain('Cette Activité englobe'); // desc de Revenus — EXISTAIT en donnée, jamais affichée avant #330
    expect(html).toContain('activity-pane-foot'); // le pied du gabarit
    expect(html).toContain('rm-roll pending'); // la ligne de pré-jet (PendingRollLine)
    expect(html).toContain('Accessible'); // la Difficulté du Test de Revenus (LDB 08)
    expect(html).toContain('Entreprendre');
  });

  it('pied FIXE d’une Activité du CATALOGUE : compétence en chip + Difficulté avant « Entreprendre » (Convalescence)', () => {
    const seam = buildSeam();
    useGame.setState({ worldMap: null });
    const catalog = interludeCatalog(useGame.getState());
    const hero = seam.party[0];
    const html = renderToStaticMarkup(
      <InterludeScreen seam={{ ...seam, phase: 'activities', catalog, openPane: { heroId: hero.id, pane: 'convalescence' } }} />,
    );
    expect(html).toContain('master-detail-list'); // maître-détail (#330)
    expect(html).toContain('activity-pane-foot');
    expect(html).toContain('Calme'); // la compétence du Test (chip Codex)
    expect(html).toContain('Très Difficile'); // la Difficulté, sur la LIGNE du pré-jet (#1072)
    expect(html).toContain('Entreprendre');
  });

  /**
   * Recette 2026-09-06, trouvaille n°3 — MENSONGE D'AFFORDANCE : le pré-jet du catalogue annonçait la
   * cible NUE, sans les `testMods` de situation que le flux applique ensuite (`openCatalogActivity`,
   * `noyau/interludeFlow.ts`) — le joueur engageait son Activité sur un chiffre faux. Les DEUX surfaces
   * lisent le même pré-jet (`preJetDActivite`, `noyau/verdictsDInterlude.ts`).
   *
   * MUTATION : retirer `pj.mods` du `testPending` de `prejetDuVolet` (`InterludeScreen.tsx`) — le libellé
   * « Discours » disparaît du markup et la cible remonte à la valeur nue : les deux `expect` tombent.
   */
  it('pré-jet du catalogue = la CIBLE RÉELLE : les `testMods` de situation y sont (Mendier, LDB 09 l.97)', () => {
    const seam = buildSeam();
    useGame.setState({ worldMap: null });
    const catalog = interludeCatalog(useGame.getState());
    const hero = seam.party[0];
    const base = testValue(hero, 'charme'); // Mendier : Test de Charme (LDB 09 l.97)
    const voir = () => renderToStaticMarkup(
      <InterludeScreen seam={{ ...seam, phase: 'activities', catalog, openPane: { heroId: hero.id, pane: 'mendier' } }} />,
    );

    // TÉMOIN : discours neutre (défaut 0) — aucune ligne de mod à l'écran.
    const neutre = voir();
    expect(neutre).toContain('rm-roll pending');
    expect(neutre).not.toContain('Discours');

    setRule('mendier-discours', -20);
    const html = voir();
    expect(html, 'le terme de discours est NOMMÉ au catalogue').toContain('Discours');
    expect(mdToPlain(html), `cible réelle = ${base} − 20`).toContain(String(base - 20));
    resetRule('mendier-discours');
  });

  it('activité SANS jet (Banque) : formule/coût dans le même pied, sans ligne de pré-jet', () => {
    const seam = buildSeam();
    const hero = seam.party[0];
    const html = renderToStaticMarkup(
      <InterludeScreen seam={{ ...seam, phase: 'activities', openPane: { heroId: hero.id, pane: 'bank' } }} />,
    );
    expect(html).toContain('master-detail-list'); // maître-détail (#330)
    expect(html).toContain('activity-pane-foot');
    expect(html).not.toContain('rm-roll pending'); // pas de Test : dépôt direct
    expect(html).toContain('Sans jet');
    expect(html).toContain('Investir');
    expect(html).toContain('Planquer');
  });

  it('Z3b (#1117 L3) : le volet DIT ce que le jet met en jeu, texte pris à la DONNÉE de l’Activité', () => {
    const seam = buildSeam();
    const hero = seam.party[0];
    const html = renderToStaticMarkup(
      <InterludeScreen seam={{ ...seam, phase: 'activities', openPane: { heroId: hero.id, pane: 'revenus' } }} />,
    );
    expect(html).toContain('rm-stake'); // la primitive d'enjeu (StakeNote), au pied du volet
    // Le TEXTE vient de `activities.json` (`ActivityDef.stake`), jamais d'un littéral de l'écran :
    // on le relit dans la donnée et on l'exige à l'écran (un renommage au Codex suit l'affichage).
    const attendu = ACTIVITIES.find((a) => a.id === 'revenus')!.stake!;
    expect(attendu).toBeTruthy();
    expect(mdToPlain(html)).toContain(attendu);
  });

  it('Z3b (#1117 L3) : une Activité SANS Test n’affiche AUCUNE zone d’enjeu (pas de zone muette)', () => {
    const seam = buildSeam();
    const hero = seam.party[0];
    const html = renderToStaticMarkup(
      <InterludeScreen seam={{ ...seam, phase: 'activities', openPane: { heroId: hero.id, pane: 'bank' } }} />,
    );
    expect(html).not.toContain('rm-stake');
  });

  it('clôture : le Standing retenu se nomme par le libellé de l’Activité qui l’a produit', () => {
    const seam = buildSeam(2);
    const hero = seam.party[0];
    const interlude = { ...seam.interlude, perHero: { ...seam.interlude.perHero, [hero.id]: { ...seam.interlude.perHero[hero.id], closeOps: [{ ops: [{ op: 'statusMod' as const, amount: 1 }], ctx: { label: 'Faire jaser la cour' } }] } } };
    const html = mdToPlain(renderToStaticMarkup(<InterludeScreen seam={{ ...seam, interlude, phase: 'closing' }} />));
    expect(html).toContain('Vétéran : Standing +1 pour la prochaine aventure (Faire jaser la cour).');
  });

  it('clôture : récapitulatif confirmé (argent gaspillé annoncé, temps qui passe)', () => {
    const seam = buildSeam(2);
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, phase: 'closing' }} />);
    expect(html).toContain('Clore l&#x27;interlude ?');
    expect(html).toContain('Argent à gaspiller');
    expect(html).toContain('14 jours');
    expect(html).toContain('Pas encore'); // annulable
  });
});

describe('InterludeScreen — coop (audit M7) : chacun mène SES héros', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it('invité : ses héros actifs, ceux des autres en lecture seule (propriétaire affiché), pas de « Clore »', () => {
    const seam = buildSeam(2);
    const [a, b] = seam.party; // a = Vétéran, b = Forgeron
    const html = renderToStaticMarkup(
      <InterludeScreen seam={{
        ...seam,
        phase: 'activities',
        net: { mode: 'guest', mySeat: 1, ownership: { [a.id]: 0, [b.id]: 1 }, seatNames: { 0: 'Hôte', 1: 'Moi' } },
      }} />,
    );
    expect(html).toContain('interlude-owner'); // le héros de l'hôte porte son propriétaire (vignette + carte)
    expect(html).toContain('Hôte');
    expect(html).toContain('Mené par Hôte'); // … et ses volets sont désactivés (title)
    expect(html).not.toContain('Clore l&#x27;interlude…'); // la clôture appartient à l'hôte
    expect(html).toContain('L&#x27;hôte clôt l&#x27;interlude');
  });

  it('hôte : tout est actif chez lui, le héros de l’invité est en lecture seule', () => {
    const seam = buildSeam(2);
    const [a, b] = seam.party;
    const html = renderToStaticMarkup(
      <InterludeScreen seam={{
        ...seam,
        phase: 'activities',
        net: { mode: 'host', mySeat: 0, ownership: { [a.id]: 0, [b.id]: 1 }, seatNames: { 0: 'Hôte', 1: 'Antoine' } },
      }} />,
    );
    expect(html).toContain('Antoine');
    expect(html).toContain('interlude-owner');
    expect(html).toContain('Clore l&#x27;interlude…');
  });
});

describe('InterludeScreen — catalogue d’Activités data-driven (ADE II + ACE Annexe I, gate `where`)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('hors d’Altdorf : la Convalescence (ADE II, sans gate) est proposée, pas les Activités d’ACE', () => {
    const seam = buildSeam();
    useGame.setState({ worldMap: null });
    const catalog = interludeCatalog(useGame.getState());
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, phase: 'activities', catalog }} />);
    expect(html).toContain('Convalescence');
    expect(html).not.toContain('Pénitence');
    expect(html).not.toContain('Mécénat');
  });

  it('à Altdorf (place de la carte liée à la scène courante) : les Activités d’ACE apparaissent', () => {
    const seam = buildSeam();
    useGame.setState({ worldMap: { id: 'w', label: 'W', places: [{ id: 'altdorf', label: 'Altdorf', pos: { x: 0, y: 0 }, scene: testScene().id }], routes: [] } });
    const catalog = interludeCatalog(useGame.getState());
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, phase: 'activities', catalog }} />);
    expect(html).toContain('Convalescence');
    expect(html).toContain('Pénitence');
    expect(html).toContain('Entraînement avec une arme inhabituelle');
    expect(html).toContain('Tester des objets magiques');
    expect(html).toContain('Recherche universitaire');
    expect(html).not.toContain('Mécénat…'); // pas un volet héros : variante d'Opération bancaire (volet Banque)
  });
});

describe('InterludeScreen — refonte visuelle #257 (coquille dédiée, masthead orné, chronique)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('coquille dédiée à texture d’ambiance + masthead orné doré (plus de .menu-card partagé)', () => {
    const seam = buildSeam();
    const html = renderToStaticMarkup(<InterludeScreen seam={seam} />);
    expect(html).toContain('interlude-shell'); // coquille propre à l’interlude
    expect(html).toContain('tx-ink'); // texture d’ambiance chartée
    expect(html).toContain('ornate-frame'); // OrnateFrame du masthead (identité de cérémonie)
    expect(html).toContain('display-title'); // grand titre gothique, matière PARTAGÉE (components.css)
    expect(html).not.toContain('menu-card'); // découplé de l’écran voisin en refonte
  });

  it('filet de phase (RuleDivider labellisé) : « nouvelles » en Événements, « Activités » ensuite', () => {
    const seam = buildSeam();
    const events = renderToStaticMarkup(<InterludeScreen seam={seam} />);
    expect(events).toContain('Les nouvelles de la période');
    const acts = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, phase: 'activities' }} />);
    expect(acts).toContain('Les Activités du groupe');
  });

  it('phase Événements : chronique sur parchemin + sceau de cire portant le d100', () => {
    const seam = buildSeam();
    const html = renderToStaticMarkup(<InterludeScreen seam={seam} />);
    expect(html).toContain('parchment-card'); // récit enluminé par héros (primitive ParchmentCard)
    expect(html).toContain('tx-parchment'); // parchemin (récit dark-ink)
    expect(html).toContain('parchment-seal'); // sceau du d100
    expect(html).toContain('parchment-card-title'); // titre d’événement en font-display
  });

  it('zéro emoji dans les affordances de clôture (charte)', () => {
    const seam = buildSeam(2);
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, phase: 'activities' }} />);
    expect(html).not.toMatch(/💸|⏳/);
  });
});

describe("InterludeScreen -- libelles i18n Phase D", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("affiche le titre, le hint d'evenements et le CTA Passer aux Activites", () => {
    const seam = buildSeam();
    const html = renderToStaticMarkup(<InterludeScreen seam={seam} />);
    expect(html).toContain("Entre deux aventures");
    expect(html).toContain("Pendant que le groupe souffle");
    expect(html).toContain("Passer aux Activités →");
  });

  it("phase activites : bouton Clore l'interlude visible pour l'hote", () => {
    const seam = buildSeam(2);
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, phase: "activities" }} />);
    expect(html).toMatch(/Clore l\S*interlude\S*/);
  });

  it("phase closing : titre recapitulatif et boutons de confirmation", () => {
    const seam = buildSeam(2);
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, phase: "closing" }} />);
    expect(html).toMatch(/Clore l\S*interlude \?/);
    expect(html).toContain("Pas encore");
  });

  it("invite : message d'attente hote visible", () => {
    const seam = buildSeam(2);
    const [a, b] = seam.party;
    const html = renderToStaticMarkup(
      <InterludeScreen seam={{
        ...seam,
        phase: "activities",
        net: { mode: "guest", mySeat: 1, ownership: { [a.id]: 0, [b.id]: 1 }, seatNames: { 0: "Hote", 1: "Moi" } },
      }} />,
    );
    expect(html).toMatch(/L\S*h\S*te cl\S*t l\S*interlude/);
  });
});

describe('InterludeScreen — Punchausen (AA 12 l.45-49) : le volet et le flux JOUENT la MÊME voie', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("pré-jet du volet = Divertissement (Narration) Intermédiaire (voie la plus favorable) — la modale du flux joue la MÊME Compétence, à la MÊME Difficulté", () => {
    const seam = buildSeam();
    useGame.setState({ worldMap: null });
    // Force l'égalité de valeur BRUTE (« pour un héros sans avance », Charme et Divertissement
    // retombent tous deux sur la Caractéristique Sociabilité) — sans quoi une sélection par VALEUR
    // (le bug corrigé) choisirait encore Divertissement par coïncidence sur ce tirage de héros.
    const hero = { ...seam.party[0], skills: seam.party[0].skills.filter((k) => k.id !== 'charme' && k.id !== 'divertissement') };
    const party = [hero, seam.party[1]];
    useGame.setState({ party });
    const catalog = interludeCatalog(useGame.getState());
    const html = renderToStaticMarkup(
      <InterludeScreen seam={{ ...seam, party, phase: 'activities', catalog, openPane: { heroId: hero.id, pane: 'punchausen' } }} />,
    );
    // Le `desc` verbatim de la source cite « Charme Complexe (–10) » (règle 5) : on vérifie la
    // DIFFICULTÉ RENDUE sur la ligne du pré-jet retenu (#1072), pas une occurrence n'importe où.
    // La zone est lue en TEXTE : la Difficulté est un déclencheur Codex (libellé + glyphe), son
    // balisage n'est pas le contrat.
    const zones = [...html.matchAll(/class="rm-roll-diff">(.*?)<\/span><\/span>/g)].map((m) => m[1].replace(/<[^>]*>/g, ''));
    expect(zones, 'Divertissement, voie retenue — et PAS la voie Charme (−10)').toEqual(['Intermédiaire (+0)']);

    useGame.getState().interludeActivity(hero.id, 'punchausen');
    const pa = useGame.getState().pendingActivity!;
    expect(pa.chosenSkill).toBe('divertissement'); // même voie que le volet
    expect(pa.difficulty).toBe('intermediaire');
  });
});

describe('InterludeScreen — préparation de bataille : « Entreprendre » suit `peutTenter` (LDB 09 l.30)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  /** Volet Planification du Vétéran, bataille en attente de préparation (budget de l'interlude). */
  function voletPlanification(savoirGuerre: number): string {
    const seam = buildSeam();
    const party = seam.party.map((h, i) => (i === 0
      ? { ...h, skills: [...h.skills.filter((s) => s.id !== 'savoir'), { id: 'savoir', spec: 'guerre', characteristic: 'intelligence' as const, advances: savoirGuerre }] }
      : h));
    useGame.setState({ party });
    useGame.getState().startMassBattle({ allyMight: 50, enemyMight: 55, plannedRounds: 3 });
    const s = useGame.getState();
    const catalog = interludeCatalog(s);
    return renderToStaticMarkup(
      <InterludeScreen seam={{ ...seam, party, phase: 'activities', catalog, massBattle: s.massBattle, openPane: { heroId: party[0].id, pane: 'planification' } }} />,
    );
  }

  it('sans Augmentation en Savoir (Guerre) : le volet DIT pourquoi, l’action est fermée, aucun pré-jet', () => {
    const html = voletPlanification(0);
    expect(mdToPlain(html)).toContain('Aucun Personnage désigné (Vétéran) ne peut tenter « Planification ».');
    expect(html).toMatch(/aria-label="Entreprendre Planification"[^>]*aria-disabled="true"|aria-disabled="true"[^>]*aria-label="Entreprendre Planification"/);
    expect(html).not.toContain('rm-roll pending');
  });

  it('avec Savoir (Guerre) : l’action est offerte, avec son pré-jet', () => {
    const html = voletPlanification(5);
    expect(mdToPlain(html)).not.toContain('ne peut tenter');
    expect(html).not.toMatch(/aria-label="Entreprendre Planification"[^>]*aria-disabled="true"|aria-disabled="true"[^>]*aria-label="Entreprendre Planification"/);
    expect(html).toContain('rm-roll pending');
  });
});

describe('InterludeScreen — l’entrée d’Activité lit le verdict du noyau (`refusDActivite`, #3059 S1)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });


  it('sans Activité restante : les entrées qui en consomment disent la raison du noyau, l’engagement d’Artisanat reste ouvert', () => {
    const seam = buildSeam(1);
    const hero = seam.party[0]; // Vétéran
    for (let i = 0; i < 3 && useGame.getState().interlude!.perHero[hero.id].left > 0; i++) useGame.getState().interludeBank(hero.id, 'stash', 10);
    const s = useGame.getState();
    expect(s.interlude!.perHero[hero.id].left, 'témoin : plus aucune Activité').toBe(0);
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, interlude: s.interlude!, party: s.party, bank: s.bank, phase: 'activities' }} />);
    for (const key of ['revenus', 'learn', 'order', 'bank', 'identify', 'entrainement']) {
      expect(raisonDe(html, key), key).toBe('Vétéran n’a plus d’Activité d’interlude.');
    }
    expect(raisonDe(html, 'craft'), 'engager un Artisanat ne consomme pas d’Activité').toBeUndefined();
    expect(entreeFermee(html, 'revenus')).toContain('aria-disabled="true"');
    // Retirer une planque ne consomme pas d'Activité (`refusDeRetrait`) : le bouton reste ouvert.
    expect(s.bank[0]?.kind, 'témoin : une planque est déposée').toBe('stash');
    expect(html).toMatch(/<button(?![^>]*aria-disabled)[^>]*aria-label="Retirer le dépôt de Vétéran"/);
    expect(html).not.toContain('id="interlude-bank-withdraw-0-reason"');
  });

  it('pendant le tirage : toutes les entrées, engagement d’Artisanat compris, disent le tirage en attente', () => {
    const seam = buildSeam();
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, interlude: { ...seam.interlude, phase: 'tirage' }, phase: 'activities' }} />);
    for (const key of ['revenus', 'craft', 'bank']) {
      expect(raisonDe(html, key), key).toBe('Vétéran ne peut rien entreprendre tant que les Événements de la période ne sont pas tirés.');
    }
  });
});

describe('InterludeScreen — Revenus bloqués par l’Événement : entrée et volet lisent `refusDeRevenus` (#3059 S3)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  /** Un Larron (roublard, Voleur N2) et un Vétéran (guerrier) dont l'Événement est « Répression du crime » (d100 20). */
  function apresLaRepression(): InterludeSeam {
    const larron = createHero({ speciesId: 'humains-reiklander', careerId: 'voleur', label: 'Larron', seed: 1701 });
    larron.careerLevel = 2; // Voleur N2 : Bronze 3
    const veteran = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Vétéran', seed: 1601 });
    useGame.setState({ party: [larron, veteran], battle: null, interlude: null, bank: [], pendingOrders: [], journal: [] });
    useGame.getState().startScene(testScene());
    vi.clearAllTimers();
    useGame.setState({ screen: 'interlude' });
    useGame.getState().seedRng(7);
    useGame.getState().startInterlude(1);
    draineCascade(useGame.getState, 200, poseSurDeNonTombe(20));
    const s = useGame.getState();
    return { interlude: s.interlude!, party: s.party, money: partyMoneyTotal(useGame.getState), bank: s.bank, pendingOrders: s.pendingOrders, phase: 'activities' };
  }

  it('l’entrée et le volet du roublard (Bronze 3) disent la raison du noyau et se ferment ; le volet dit la formule de ses 3 Standings', () => {
    const seam = apresLaRepression();
    const larron = seam.party[0];
    const raison = refusDeRevenus(useGame.getState(), larron.id);
    expect(raison).toBe('Larron ne peut pas entreprendre Revenus (événement : Répression du crime).');
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, openPane: { heroId: larron.id, pane: 'revenus' } }} />);
    expect(raisonDId(html, 'interlude-revenus-go-reason'), 'le volet').toBe(raison);
    expect(html).toMatch(/<button[^>]*aria-disabled="true"[^>]*aria-describedby="interlude-revenus-go-reason"|<button[^>]*aria-describedby="interlude-revenus-go-reason"[^>]*aria-disabled="true"/);
    const liste = renderToStaticMarkup(<InterludeScreen seam={seam} />);
    expect(raisonDe(liste, 'revenus'), 'l’entrée de liste').toBe(raison);
    expect(entreeFermee(liste, 'revenus')).toContain('aria-disabled="true"');
    expect(mdToPlain(html)).toContain('Succès : 6d10 sous de cuivre');
  });

  it('la chronique : la puce du roublard porte `blocageDeRevenus`, celle du guerrier les LIBELLÉS des Classes bloquées', () => {
    const seam = apresLaRepression();
    const html = mdToPlain(renderToStaticMarkup(<InterludeScreen seam={{ ...seam, phase: 'events' }} />));
    expect(html).toContain('Larron ne peut pas entreprendre Revenus (événement : Répression du crime).');
    expect(html).toContain('Revenus bloqués pour : Roublards');
  });
});

describe('InterludeScreen — abordabilité (#3059 S4) : chaque volet payant lit le verdict du noyau', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  /** Le seam relu sur le store, après un geste de mise en place. */
  const relu = (seam: InterludeSeam): InterludeSeam => {
    const s = useGame.getState();
    return { ...seam, interlude: s.interlude!, party: s.party, bank: s.bank, phase: 'activities' };
  };
  /** Vide la bourse du héros par la couture de débit. */
  const viderLaBourse = (heroId: string) => {
    const h = useGame.getState().party.find((x) => x.id === heroId)!;
    expect(debitBourse(useGame.getState, useGame.setState, heroId, bourseOf(h)), 'témoin : bourse vidée').toBe(true);
  };
  /** La raison que le geste dit au journal. */
  const raisonDuGeste = (geste: () => void): string[] => {
    const avant = useGame.getState().journal.length;
    geste();
    return useGame.getState().journal.slice(avant);
  };
  /** L'action du volet `paneId` est fermée et liée à sa bannière. */
  const lieeALaBanniere = (html: string, paneId: string) =>
    expect(html.match(/<button[^>]*>/g)?.some((b) => b.includes('aria-disabled="true"') && b.includes(`aria-describedby="${paneId}-blocked"`)), paneId).toBe(true);

  it('Apprentissage : PX insuffisants, la bannière dit la raison du geste', () => {
    const seam = buildSeam();
    const hero = seam.party[0];
    useGame.getState().party[0].xp = 50;
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...relu(seam), openPane: { heroId: hero.id, pane: 'learn', choix: 'chanceux' } }} />);
    expect(raisonDId(html, 'pane-learn-blocked')).toBe('Vétéran : PX insuffisants (100).');
    lieeALaBanniere(html, 'pane-learn');
    expect(raisonDuGeste(() => useGame.getState().interludeActivity(hero.id, 'learn', { talentId: 'chanceux' }))).toEqual(['Vétéran : PX insuffisants (100).']);
  });

  it('Entraînement : bourse sous le tuteur le moins cher, même raison au volet et au geste', () => {
    const seam = buildSeam();
    const hero = seam.party[0];
    viderLaBourse(hero.id);
    const opt = entrainementOptions(useGame.getState().party[0]).find((o) => o.kind === 'characteristic')!;
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...relu(seam), openPane: { heroId: hero.id, pane: 'entrainement', choix: `${opt.kind}|${opt.id}|` } }} />);
    expect(raisonDId(html, 'pane-entrainement-blocked')).toBe('Vétéran : la bourse ne couvre même pas le tuteur le moins cher (1 sc).');
    lieeALaBanniere(html, 'pane-entrainement');
    expect(raisonDuGeste(() => useGame.getState().interludeEntrainement(hero.id, opt.kind, opt.id, opt.spec))).toEqual([raisonDId(html, 'pane-entrainement-blocked')]);
  });

  it('Commande : prix hors de la bourse, même raison au volet et au geste', () => {
    const seam = buildSeam();
    const hero = seam.party[0];
    viderLaBourse(hero.id);
    const objet = orderCatalog()[0];
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...relu(seam), openPane: { heroId: hero.id, pane: 'order', choix: objet.id } }} />);
    const banniere = raisonDId(html, 'pane-order-blocked');
    expect(banniere).toMatch(/^Commande trop chère \(.+\)\.$/);
    lieeALaBanniere(html, 'pane-order');
    expect(raisonDuGeste(() => useGame.getState().interludeOrder(hero.id, objet.id))).toEqual([banniere]);
  });

  it('Artisanat : matériaux hors de la bourse, même raison au volet et au geste', () => {
    const seam = buildSeam();
    const forgeron = seam.party[1];
    viderLaBourse(forgeron.id);
    const ouvrage = craftCatalog()[0];
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...relu(seam), openPane: { heroId: forgeron.id, pane: 'craft', choix: ouvrage.id } }} />);
    const banniere = raisonDId(html, 'pane-craft-start-blocked');
    expect(banniere).toMatch(/^Matériaux trop chers \(.+\) pour la bourse de Forgeron\.$/);
    lieeALaBanniere(html, 'pane-craft-start');
    expect(raisonDuGeste(() => useGame.getState().interludeCraftStart(forgeron.id, ouvrage.id, [], []))).toEqual([banniere]);
  });

  it('Banque, Bronze à la bourse courte : chaque dépôt dit SON refus, comme son geste', () => {
    const seam = buildSeam();
    const forgeron = seam.party[1];
    viderLaBourse(forgeron.id);
    const catalog = ACTIVITIES.filter((a) => a.resolver === 'mecenat');
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...relu(seam), catalog, openPane: { heroId: forgeron.id, pane: 'bank' } }} />);
    expect(raisonDId(html, 'pane-bank-blocked'), 'la bannière : la bourse').toBe('La bourse de Forgeron ne couvre pas ce dépôt.');
    expect(raisonDId(html, 'interlude-bank-invest-reason'), 'Investir : le Statut').toBe('Forgeron : investir en banque exige le Statut Argent ou Or.');
    expect(raisonDId(html, 'interlude-bank-mecenat-reason'), 'Mécénat : le lieu').toBe('Le Mécénat ne se pratique pas ici.');
    expect(raisonDuGeste(() => useGame.getState().interludeBank(forgeron.id, 'invest', 120))).toEqual(['Forgeron : investir en banque exige le Statut Argent ou Or.']);
    expect(raisonDuGeste(() => useGame.getState().interludeBank(forgeron.id, 'stash', 120))).toEqual(['La bourse de Forgeron ne couvre pas ce dépôt.']);
    expect(raisonDuGeste(() => useGame.getState().interludeBank(forgeron.id, 'mecenat', 120))).toEqual(['Le Mécénat ne se pratique pas ici.']);
  });

  it('Banque : l’investissement Bronze dit la raison du noyau ; le dépôt prévu est celui que rabote l’Événement', () => {
    const seam = buildSeam();
    const forgeron = seam.party[1];
    const itl = useGame.getState().interlude!;
    itl.perHero[forgeron.id] = { ...itl.perHero[forgeron.id], fx: { bankPct: -20 } };
    useGame.setState({ interlude: { ...itl } });
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...relu(seam), openPane: { heroId: forgeron.id, pane: 'bank' } }} />);
    expect(raisonDId(html, 'interlude-bank-invest-reason')).toBe('Forgeron : investir en banque exige le Statut Argent ou Or.');
    expect(mdToPlain(html)).toContain('dépôt prévu : 8/–');
    const avant = useGame.getState().bank.length;
    const bourse = () => toBrass(bourseOf(useGame.getState().party.find((h) => h.id === forgeron.id)!));
    const bourseAvant = bourse();
    useGame.getState().interludeBank(forgeron.id, 'stash', 120);
    expect(useGame.getState().bank.slice(avant).map((d) => d.brass), 'le geste dépose ce que le volet annonce').toEqual([96]);
    expect(bourseAvant - bourse(), 'la bourse paie le montant saisi').toBe(120);
  });
});

describe('InterludeScreen — catalogue (#3059 S5) : chaque volet lit les cibles et le refus du geste', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  /** Le seam relu sur le store, à Altdorf, le volet `pane` du Vétéran ouvert. */
  const aAltdorf = (seam: InterludeSeam, pane: string, extra: Partial<InterludeSeam> = {}): InterludeSeam => {
    useGame.setState({ worldMap: { id: 'w', label: 'W', places: [{ id: 'altdorf', label: 'Altdorf', pos: { x: 0, y: 0 }, scene: testScene().id }], routes: [] } });
    const s = useGame.getState();
    return { ...seam, interlude: s.interlude!, party: s.party, bank: s.bank, phase: 'activities', catalog: interludeCatalog(s), lieu: { scene: s.scene, worldMap: s.worldMap }, massBattle: s.massBattle, openPane: { heroId: s.party[0].id, pane }, ...extra };
  };
  const raisonDuGeste = (geste: () => void): string[] => {
    const avant = useGame.getState().journal.length;
    geste();
    return useGame.getState().journal.slice(avant);
  };
  const fermeeEtLiee = (html: string, paneId: string) =>
    expect(html.match(/<button[^>]*>/g)?.some((b) => b.includes('aria-disabled="true"') && b.includes(`aria-describedby="${paneId}-blocked"`)), paneId).toBe(true);

  it('Pénitence sans Péché : la bannière dit le refus du geste', () => {
    const seam = buildSeam();
    // La Pénitence se tente (LDB 09 l.30) : le Vétéran a appris la Prière.
    useGame.setState((s) => ({ party: s.party.map((h, i) => (i === 0 ? { ...h, skills: [...h.skills, { id: 'priere', characteristic: 'sociabilite' as const, advances: 5 }] } : h)) }));
    const html = renderToStaticMarkup(<InterludeScreen seam={aAltdorf(seam, 'penitence')} />);
    const raison = 'Vétéran n’a aucun Point de Péché à expier. Pénitence ne lui apporterait rien en cas de réussite.';
    expect(raisonDId(html, 'pane-catalog-penitence-blocked')).toBe(raison);
    fermeeEtLiee(html, 'pane-catalog-penitence');
    expect(raisonDuGeste(() => useGame.getState().interludeActivity(seam.party[0].id, 'penitence'))).toEqual([raison]);
  });

  it('Tester des objets magiques sans objet : même raison au volet et au geste', () => {
    const seam = buildSeam();
    const html = renderToStaticMarkup(<InterludeScreen seam={aAltdorf(seam, 'tester-objets-magiques')} />);
    const raison = 'Aucun objet non identifié dans le sac de Vétéran.';
    expect(raisonDId(html, 'pane-catalog-tester-objets-magiques-blocked')).toBe(raison);
    fermeeEtLiee(html, 'pane-catalog-tester-objets-magiques');
    expect(raisonDuGeste(() => useGame.getState().interludeActivity(seam.party[0].id, 'tester-objets-magiques'))).toEqual([raison]);
  });

  it('Convalescence : la liste du volet porte chaque INSTANCE de Trait psychologique du héros, l’action est offerte', () => {
    const seam = buildSeam();
    const h = useGame.getState().party[0];
    h.psychTraits = [{ type: 'frenesie' }, { type: 'haine', cible: ciblePsy.groupe('nain') }, { type: 'haine', cible: ciblePsy.groupe('elfe') }];
    useGame.setState({ party: [...useGame.getState().party] });
    const html = renderToStaticMarkup(<InterludeScreen seam={aAltdorf(seam, 'convalescence')} />);
    const liste = html.match(/<select[^>]*aria-label="Trait psychologique à éliminer"[^>]*>(.*?)<\/select>/)?.[1] ?? '';
    expect([...liste.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map((m) => [m[1], m[2]])).toEqual([['frenesie', 'Frénésie'], ['haine|nain', 'Haine (Nain)'], ['haine|elfe', 'Haine (Elfe)']]);
    const bouton = html.match(/<button[^>]*aria-label="Entreprendre Convalescence"[^>]*>/)?.[0];
    expect(bouton, 'l’action est offerte').toMatch(/^<button(?![^>]*aria-disabled)/);
  });

  it('retrait de Mécénat hors d’Altdorf : le bouton et le geste disent le même refus', () => {
    const seam = buildSeam();
    const heroId = seam.party[0].id;
    aAltdorf(seam, 'bank');
    useGame.getState().interludeBank(heroId, 'mecenat', 1200);
    expect(useGame.getState().bank.map((d) => d.kind), 'témoin : dépôt de Mécénat à Altdorf').toEqual(['mecenat']);
    useGame.setState({ worldMap: { id: 'w', label: 'W', places: [{ id: 'ubersreik', label: 'Ubersreik', pos: { x: 0, y: 0 }, scene: testScene().id }], routes: [] } });
    const s = useGame.getState();
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, interlude: s.interlude!, party: s.party, bank: s.bank, phase: 'activities', lieu: { scene: s.scene, worldMap: s.worldMap } }} />);
    const raison = 'Mécénat n\'est praticable qu\'en un lieu précis — pas ici.';
    expect(raisonDId(html, 'interlude-bank-withdraw-0-reason')).toBe(raison);
    expect(raisonDuGeste(() => useGame.getState().interludeWithdraw(0))).toEqual([raison]);
  });

  it('arme inhabituelle : la liste du volet ne porte que les armes à maîtriser', () => {
    const seam = buildSeam();
    const h = useGame.getState().party[0];
    h.items = [...(h.items ?? []),
      { uid: 'arme-1', trappingId: 'couteau-de-harald', label: 'Couteau de Harald', kind: 'melee', qualities: [], enc: 0, equipped: false, requiresMastery: true } as never,
      { uid: 'armure-1', trappingId: 'armure-etrange', label: 'Armure étrange', kind: 'armour', qualities: [], enc: 0, equipped: false, requiresMastery: true } as never];
    useGame.setState({ party: [...useGame.getState().party] });
    const html = renderToStaticMarkup(<InterludeScreen seam={aAltdorf(seam, 'entrainement-arme-inhabituelle')} />);
    const liste = html.match(/<select[^>]*aria-label="Arme à maîtriser"[^>]*>(.*?)<\/select>/)?.[1] ?? '';
    expect([...liste.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map((m) => [m[1], m[2]])).toEqual([['arme-1', 'Couteau de Harald']]);
    const bouton = html.match(/<button[^>]*aria-label="Entreprendre Entraînement avec une arme inhabituelle"[^>]*>/)?.[0];
    expect(bouton, 'l’action est offerte sur l’arme').toMatch(/^<button(?![^>]*aria-disabled)/);
  });

  it('Faveur Importante : la bannière dit le refus du geste, sans citation de livre', () => {
    const seam = buildSeam();
    const heroId = seam.party[0].id;
    const favors = [{ id: 'favor-1', heroId, level: 'importante' as const, owedTo: 'Un comte', desc: 'Un service', progress: 0 }];
    useGame.setState({ favors });
    const html = renderToStaticMarkup(<InterludeScreen seam={aAltdorf(seam, 'favor-settle', { favors })} />);
    const raison = 'Une Faveur Importante ne s’acquitte pas par des Activités : elle se joue en aventure.';
    expect(raisonDId(html, 'pane-favor-blocked')).toBe(raison);
    fermeeEtLiee(html, 'pane-favor');
    expect(raisonDuGeste(() => useGame.getState().favorSettle(heroId, 'favor-1'))).toEqual([raison]);
  });

  it('Soutien d’une préparation : la note est la décision du noyau (`interlude-assist-costs-activity`)', () => {
    const note = (cout: boolean) => {
      setRule('interlude-assist-costs-activity', cout);
      try {
        const seam = buildSeam();
        useGame.getState().startMassBattle({ allyMight: 50, enemyMight: 55, plannedRounds: 3 });
        return mdToPlain(renderToStaticMarkup(<InterludeScreen seam={aAltdorf(seam, 'planification')} />));
      } finally { resetRule('interlude-assist-costs-activity'); }
    };
    expect(note(false)).toContain('Les autres PJ peuvent prêter leur Soutien, gratuitement.');
    expect(note(true)).toContain('Les autres PJ peuvent prêter leur Soutien — chacun y dépense un créneau.');
  });

  it('préparation déjà faite : la bannière dit le refus du geste', () => {
    const seam = buildSeam();
    const heroId = seam.party[0].id;
    useGame.getState().startMassBattle({ allyMight: 50, enemyMight: 55, plannedRounds: 3 });
    useGame.getState().massBattleActivity('inspire', heroId);
    useGame.setState({ pendingActivity: { ...useGame.getState().pendingActivity!, roll: 20, success: true, sl: 2 } });
    useGame.getState().activityConfirm();
    expect(useGame.getState().massBattle?.activitiesDone, 'témoin : le Discours est fait').toContain('inspire');
    const html = renderToStaticMarkup(<InterludeScreen seam={aAltdorf(seam, 'inspire')} />);
    const raison = 'Déjà réalisée cette bataille (Activité non répétable).';
    expect(raisonDId(html, 'pane-prep-inspire-blocked')).toBe(raison);
    fermeeEtLiee(html, 'pane-prep-inspire');
    expect(raisonDuGeste(() => useGame.getState().massBattleActivity('inspire', heroId))).toEqual([raison]);
  });
});


/** Le texte du pré-jet du volet ouvert, ses lignes de modificateur comprises, jusqu'à son action. */
const ligneDePreJet = (html: string) => mdToPlain(html.slice(html.indexOf('rm-roll pending'))).split('Entreprendre')[0];

describe('InterludeScreen — chaque volet affiche le pré-jet du noyau (#3059 S6)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('Planification soutenue : Savoir (Guerre) 46, Soutien +10, cible 56 — celle du jet posé (LDB 12 l.187-200)', () => {
    const seam = buildSeam();
    const party = seam.party.map((h, i) => ({ ...h, skills: [...h.skills.filter((s) => s.id !== 'savoir'), { id: 'savoir', spec: 'guerre', characteristic: 'intelligence' as const, advances: i === 0 ? 10 : 5 }] }));
    useGame.setState({ party });
    useGame.getState().startMassBattle({ allyMight: 50, enemyMight: 55, plannedRounds: 3 });
    useGame.getState().setMassBattleHero('planification', party.map((h) => h.id));
    const s = useGame.getState();
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, party, phase: 'activities', catalog: interludeCatalog(s), massBattle: s.massBattle, openPane: { heroId: party[0].id, pane: 'planification' } }} />);
    expect(ligneDePreJet(html)).toContain('46 +10 = 56');
    expect(ligneDePreJet(html)).toContain('Soutien');
    useGame.getState().massBattleActivity('planification', party[0].id);
    expect(useGame.getState().pendingActivity!.target).toBe(56);
  });

  it('Apprentissage d’un Exténué : la ligne nomme l’État : Sociabilité nue 36, Exténué −10, cible 6 (LDB 16 l.90)', () => {
    const seam = buildSeam();
    const party = [{ ...seam.party[0], conditions: [{ id: 'extenue' as const, value: 1 }] }, seam.party[1]];
    useGame.setState({ party });
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, party, phase: 'activities', openPane: { heroId: party[0].id, pane: 'learn', choix: 'chanceux' } }} />);
    expect(ligneDePreJet(html)).toContain('36 −30 = 6');
    expect(ligneDePreJet(html)).toContain('−10 Exténué');
    useGame.getState().interludeActivity(party[0].id, 'learn', { talentId: 'chanceux' });
    expect(useGame.getState().pendingActivity!.skillValue).toBe(26);
  });

  it('Revenus éditée avec un modificateur de situation : le volet dédié le nomme et l’applique (LDB 09 l.97)', () => {
    const revenus = { ...activityById('revenus')!, testMods: [{ mod: -10, label: 'Mauvaise saison' }] };
    avecActivite(revenus, () => {
      const seam = buildSeam();
      const html = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, phase: 'activities', openPane: { heroId: seam.party[0].id, pane: 'revenus' } }} />);
      expect(ligneDePreJet(html)).toContain('Mauvaise saison');
      expect(ligneDePreJet(html)).toContain('= 52');
    });
  });
});

describe('InterludeScreen — la porte de chaque volet dédié est celle du geste (`refusDOuvertureDActivite`, #3059 S6)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  const CARRIERES = (careers as { id: string }[]).map((c) => c.id);
  /** Variantes : 0 valide, 1 Inconscient (LDB 16 l.113 : il ne peut tenter aucun Test). */
  it.each(CARRIERES.flatMap((c) => [0, 1].map((n) => [c, n] as const)))('%s, variante %s : Revenus, ouvrage en cours, Apprentissage', (careerId, n) => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId, label: careerId, seed: 3000 + CARRIERES.indexOf(careerId) });
    h.xp = 2000;
    if (n === 1) h.conditions = [{ id: 'inconscient', value: 1 }];
    const seam = buildSeam(3, [h]);
    const voir = (pane: string, choix?: string) => {
      const s = useGame.getState();
      return renderToStaticMarkup(<InterludeScreen seam={{ ...seam, interlude: s.interlude!, party: s.party, phase: 'activities', openPane: { heroId: h.id, pane, ...(choix ? { choix } : {}) } }} />);
    };
    const geste = (id: string, cibles = {}) => refusDOuvertureDActivite(useGame.getState(), h.id, activityById(id)!, cibles) ?? undefined;
    // L'entrée de la liste se lit volet FERMÉ : une entrée ouverte reste refermable, sans raison.
    expect(raisonDe(voir('bank'), 'revenus'), 'Revenus').toBe(geste('revenus'));
    const talent = learnableTalents(useGame.getState().party[0])[0];
    if (talent) expect(raisonDId(voir('learn', talent.id), 'pane-learn-blocked'), 'Apprentissage').toBe(geste('learn', { talentId: talent.id }));
    const ouvrage = craftCatalog().find((o) => { const t = findTrappingById(o.id); return t && craftSpecOf(t); });
    if (n === 0 && metierOf(useGame.getState().party[0]) && ouvrage) {
      useGame.getState().interludeCraftStart(h.id, ouvrage.id, [], []);
      if (useGame.getState().party[0].craft) expect(raisonDe(voir('bank'), 'craft'), 'ouvrage en cours').toBe(geste('craft'));
    }
  });
});
