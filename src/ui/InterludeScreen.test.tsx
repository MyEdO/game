/**
 * Écran « Entre deux aventures » refondu (LOT 6) : bandeau de SYNTHÈSE persistant (vignettes héros
 * + pips d'Activités + bourse du groupe, les 3 phases), volets homogènes au gabarit `ActivityPane`
 * (pied FIXE : pré-jet visible AVANT « Entreprendre »), clôture récapitulative confirmée (M3).
 * Rendu statique : le store SSR sert l'état initial, d'où le seam (même pattern que WorldMapView).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useGame } from '../state/store';
import { draineCascade } from '../state/cascadeTestKit';
import { createHero } from '../engine/character';
import { fromBrass } from '../engine/money';
import { partyMoneyTotal, distributeCredit } from '../state/bourseFlow';
import { testScene } from '../scenes/test-fixture';
import { interludeCatalog, bestActivitySkill } from '../state/interludeFlow';
import { setRule, resetRule } from '../engine/policy';
import { interludeEventFor } from '../data/interludeEvents';
import { InterludeScreen, type InterludeSeam } from './InterludeScreen';
import { ACTIVITIES } from '../engine/activities';

/** Texte NU d'un rendu statique : balises retirées, entités HTML de React décodées — pour confronter
 *  un texte de DONNÉE (apostrophes comprises) au markup rendu. */
const mdToPlain = (html: string) => html
  .replace(/<[^>]*>/g, '')
  .replace(/&#x27;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');

function buildSeam(weeks = 3): InterludeSeam {
  const a = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Vétéran', seed: 1601 });
  a.xp = 300;
  const b = createHero({ speciesId: 'nains', careerId: 'artisan', label: 'Forgeron', seed: 1602 });
  if (!b.skills.some((s) => s.id === 'metier')) b.skills.push({ id: 'metier', spec: 'Forgeron', characteristic: 'dexterite', advances: 10 });
  useGame.setState({ party: [a, b], battle: null, interlude: null, bank: [], pendingOrders: [], journal: [] });
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
    expect(html).toMatch(/\d ×/); // la formule de Revenus (« N × 2d10 sous »…)
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
    expect(html).toContain('Très difficile'); // la Difficulté, sur la LIGNE du pré-jet (#1072)
    expect(html).toContain('Entreprendre');
  });

  /**
   * Recette 2026-09-06, trouvaille n°3 — MENSONGE D'AFFORDANCE : le pré-jet du catalogue annonçait la
   * cible NUE, sans les `testMods` de situation que le flux applique ensuite (`openCatalogActivity`,
   * `state/interludeFlow.ts`) — le joueur engageait son Activité sur un chiffre faux. Les DEUX surfaces
   * composent désormais les mêmes sources : `activityTestMod` → `activityModLines`.
   *
   * MUTATION : retirer `modsSituation` du `testPending` d'`InterludeScreen.tsx` — le libellé
   * « Discours » disparaît du markup et la cible remonte à la valeur nue : les deux `expect` tombent.
   */
  it('pré-jet du catalogue = la CIBLE RÉELLE : les `testMods` de situation y sont (Mendier, LDB 09 l.97)', () => {
    const seam = buildSeam();
    useGame.setState({ worldMap: null });
    const catalog = interludeCatalog(useGame.getState());
    const hero = seam.party[0];
    const def = ACTIVITIES.find((a) => a.id === 'mendier')!;
    const base = bestActivitySkill(hero, def)!.value;
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
