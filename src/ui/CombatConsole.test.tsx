// @vitest-environment jsdom
/**
 * CONSOLE DE COMBAT — contrats de GÉOMÉTRIE de l'arche (spec HUD combat §1c-bis) : la niche d'États
 * (rack d'alvéoles réservées) et les deux gouttières sont DESSINÉES quoi qu'il arrive. Montée pour de
 * vrai (`createRoot`/`act`) sur le VRAI store et de VRAIS héros (`createHero`) — aucun module mocké.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame, movementRemaining, type BattleState } from '../state/store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { contractDisease } from '../engine/disease';
import { syncDerivedConditions, stacks } from '../engine/conditions';
import type { Combatant, ConditionInstance, ItemInstance, ShipPoste, Weapon } from '../engine/types';
import { itemFromTrappingById, recomputeLoadout, loadoutLabel, loadedAmmo, selectedAmmo, loadWeapon } from '../engine/items';
import { weaponLoaded } from '../engine/weaponLoad';
import { t } from '../i18n';
import { visibleFocusables } from './Modal';
import { sousLayoutJsdom } from './layoutJsdom.testkit';
import { hotbar } from '../state/hotbarBridge';
import { regles, findQualityById, findActionById, findConditionById, findVehicleById, ACTIONS, etats, type ActionDef } from '../data/index';
import { ActiveModal } from './ActiveModal';
import { vehicleCombatant } from '../engine/vehicle';
import { actionGate, ACTION_CANDIDATES, REMEDES } from '../state/actionRegistry';
import { emptyScene } from '../state/scene';
import { mdToText } from './Prose';
import { CombatConsole } from './CombatConsole';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { baseSection, mediaBlock } from '../../scripts/guards/lib/cssCouches.mjs';
import { hpColor, ENEMY_TINT } from '../gameIso/teamColors';
import { srgbToLinear } from '../gameIso/shade';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function hero(id: string, label: string): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label, rng: makeRNG(7) });
  h.id = id;
  h.pos = { x: 5, y: 5 };
  return h;
}

function foe(id: string, x: number, y: number): Combatant {
  const e = hero(id, `Rat ${id}`);
  e.kind = 'enemy';
  e.pos = { x, y };
  return e;
}

let host: HTMLDivElement;
let root: Root;

/** Combat en cours : la console se monte sur le store réel. `turn` désigne l'acteur ACTIF dans
 *  l'ordre (`0` = le héros `h`, `1+` = les adversaires) — le tour adverse est un cas de contrat. */
function monter(h: Combatant, opts: { foes?: Combatant[]; runBudget?: number; turn?: number; action?: string } = {}) {
  const foes = opts.foes ?? [];
  const order = [h.id, ...foes.map((f) => f.id)];
  // Le `setState` passe par `act` : une console déjà montée est abonnée au store, le changement de
  // tour est donc une mise à jour React comme une autre.
  act(() => {
    useGame.setState({
      party: [h],
      battle: {
        combatants: [h, ...foes], order, baseOrder: order, turn: opts.turn ?? 0, round: 1,
        action: opts.action ?? null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
        acted: false, runBudget: opts.runBudget ?? 4, log: [], over: null,
      } as unknown as BattleState,
    });
  });
  act(() => { root.render(<CombatConsole />); });
  return host.innerHTML;
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ battle: null });
});

/** SURVOL d'une alvéole : ouvre le popover `CodexRef` (mode `wrap`) qui l'enveloppe et rend son contenu.
 *  Le popover vit en PORTAL sur `document.body` (hors du `host`) — c'est là qu'on le lit. `mouseover` est
 *  l'événement dont React DÉRIVE `onMouseEnter` (même voie qu'un vrai survol). */
function survol(dataCell: string) {
  const cell = host.querySelector(`[data-cell="${dataCell}"]`);
  if (!cell) throw new Error(`alvéole « ${dataCell} » absente`);
  const enveloppe = cell.closest('.codex-ref');
  if (!enveloppe) throw new Error(`alvéole « ${dataCell} » sans foyer de règle (aucun CodexRef)`);
  // Un popover déjà ouvert (survol précédent) vit dans le MÊME portal : Échap le referme — sans quoi on
  // relirait le voisin (mesuré : « Charge » lu à la place de « Recharge »).
  act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  act(() => { enveloppe.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
  const pop = document.body.querySelector('.codex-pop[role="tooltip"]');
  if (!pop) throw new Error(`aucun popover ouvert au survol de « ${dataCell} »`);
  return {
    title: pop.querySelector('.codex-pop-title')?.textContent ?? null,
    body: pop.querySelector('.codex-pop-body')?.textContent ?? null,
    /** La PORTE vers la fiche complète (le popover borne son corps, cf. `truncate` dans `CodexRef`). */
    porte: pop.querySelector('.codex-pop-open')?.textContent ?? null,
    source: pop.querySelector('.codex-src')?.textContent ?? null,
    /** La RAISON DU REFUS, quand la case est fermée : elle vit ICI et nulle part ailleurs à l'écran. */
    refus: pop.querySelector("[data-refus]")?.textContent ?? null,
  };
}

/** RAISON DE REFUS lue AU SURVOL d'un contrôle quelconque (alvéole, chip de munition) — arbitrage user
 *  2026-08-24 : « Je n'ai jamais validé ces "textes" impossible a lire sous le nom des capacités […] ».
 *  Le contrôle est enveloppé par l'infobulle partagée (`CodexRef refus`, mode `wrap`) ; `mouseover` est
 *  l'événement dont React dérive `onMouseEnter`. Rend `null` si aucune infobulle ne s'ouvre. */
function refusAuSurvol(el: Element): string | null {
  const enveloppe = el.closest('.codex-ref');
  if (!enveloppe) return null;
  act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  act(() => { enveloppe.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
  return document.body.querySelector('.codex-pop[role="tooltip"] [data-refus]')?.textContent ?? null;
}

/** … et AU FOCUS RÉEL : c'est le chemin du CLAVIER et de la MANETTE (le pad déplace le focus DOM,
 *  `useGamepad`), qui ne survolent rien. On appelle `el.focus()` — jamais un événement forgé : un
 *  `<button disabled>` ne prendrait PAS le focus, et un `focusin` fabriqué masquerait exactement ce
 *  défaut. Le contrôle doit devenir l'élément actif, sinon la sonde échoue ici. */
function refusAuFocus(el: HTMLElement): string | null {
  act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  act(() => { el.focus(); });
  expect(document.activeElement, 'le contrôle refusé n’a pas pris le focus (`disabled` ?)').toBe(el);
  return document.body.querySelector('.codex-pop[role="tooltip"] [data-refus]')?.textContent ?? null;
}

/** TAP au doigt : ni survol ni focus préalable — le clic sur un contrôle REFUSÉ montre sa raison. */
function refusAuTap(el: HTMLElement): string | null {
  act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  return document.body.querySelector('.codex-pop[role="tooltip"] [data-refus]')?.textContent ?? null;
}

/** Le pointeur QUITTE le contrôle : l'infobulle meurt (le pont de survol différé, quand le popover
 *  porte une porte vers la fiche, est laissé s'écouler). Rend l'infobulle survivante, ou `null`. */
function quitterRefus(el: Element): Element | null {
  const enveloppe = el.closest('.codex-ref')!;
  vi.useFakeTimers();
  try {
    act(() => { enveloppe.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })); });
    act(() => { vi.advanceTimersByTime(400); });
  } finally {
    vi.useRealTimers();
  }
  return document.body.querySelector('.codex-pop[role="tooltip"]');
}

/** Une alvéole FERMÉE, dans les DEUX écritures : `disabled` HTML (maquette muette, rien à atteindre)
 *  ou `aria-disabled` (elle PORTE une raison, donc elle reste focalisable — clavier, manette, doigt). */
const estFermee = (b: HTMLButtonElement) => b.disabled || b.getAttribute('aria-disabled') === 'true';

/** TEXTE VISIBLE d'un nœud : son contenu MOINS les copies HORS ÉCRAN (`.hors-ecran`, cibles des
 *  `aria-describedby`). C'est la mesure de « la case reste propre » : aucune raison gravée à l'écran. */
function texteVisible(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  for (const n of [...clone.querySelectorAll('.hors-ecran')]) n.remove();
  return clone.textContent ?? '';
}

/** Le VERBATIM d'une donnée tel que le popover le rend : prose démarquée (`mdToText`) puis bornée par la
 *  primitive. On ne recopie AUCUN texte de règle — on applique au contenu de la donnée la même
 *  transformation que `CodexRef`, et on compare. La fiche complète reste derrière « Ouvrir la fiche ». */
function verbatimAttendu(desc: string): string {
  const t = mdToText(desc);
  return t.length > 400 ? `${t.slice(0, 400).trimEnd()}…` : t;
}

/** Le rack d'États de l'arche seul (le bandeau/les tuiles ne sont pas montés ici). */
function niche() {
  return host.querySelector('.cc-arch .ptile-states[data-reserve]');
}

describe('CombatConsole — arche', () => {
  it('dessine la niche d’États même quand le héros n’en porte AUCUN : 4 alvéoles réservées', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h);
    const rack = niche();
    expect(rack).not.toBeNull();
    expect(rack!.querySelectorAll('.pt-state, .pt-void').length).toBe(4);
    expect(rack!.querySelectorAll('.pt-state').length).toBe(0);
  });

  it('peuple la niche d’icônes + INDICE chiffré par État, sans changer le compte d’alvéoles', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [
      { id: 'hemorragique', value: 3 },
      { id: 'assourdi', value: 2 },
      { id: 'empetre', value: 1 },
    ] as ConditionInstance[];
    monter(h);
    const rack = niche()!;
    expect(rack.querySelectorAll('.pt-state, .pt-void').length).toBe(4);
    expect(rack.querySelectorAll('.pt-state').length).toBe(3);
    // Le rang des alvéoles suit la sévérité (`summarizeEffects`) — c'est le CHIFFRE de chacune qui
    // est le contrat ici, pas son rang : la comparaison est triée.
    expect([...rack.querySelectorAll('.pt-n')].map((n) => n.textContent).sort()).toEqual(['1', '2', '3']);
  });

  // Chrome d'état de l'arche (spec §1c) : Assailli ×N est un ÉTAT du porteur — il vit dans la MÊME
  // niche, pas dans une rangée de chips à part.
  it('fait entrer les États de SITUATION (Assailli ×N) dans le même rack', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h, { foes: [foe('e1', 5, 6), foe('e2', 6, 5)] });
    const rack = niche()!;
    expect(rack.querySelectorAll('.pt-state').length).toBe(1);
    expect(rack.querySelector('.pt-n')!.textContent).toBe('2');
    expect(rack.querySelectorAll('.pt-state, .pt-void').length).toBe(4);
  });

  /**
   * Un geste d'État FERMÉ reste un CONTRÔLE qui dit POURQUOI — arbitrage user 2026-08-24 (verbatim) :
   * « Je n'ai jamais validé ces "textes" impossible a lire sous le nom des capacités, même Rogue
   * Trader qui est notre interface de départ n'a pas un tel comportement. » : la raison vit au
   * survol/focus/tap et dans le NOM ACCESSIBLE, jamais inline, et jamais un bouton muet.
   * Cas : l'Exténué du Malaise (LDB 20 l.188, verbatim : « Gagnez un État *Exténué* dont vous ne
   * pourrez vous défaire qu'une fois votre maladie guérie. ») — `raisonRefusDetermination` le refuse.
   */
  it('une pastille dont la Détermination est REFUSÉE reste atteignable et porte sa raison', () => {
    const h = hero('h1', 'Gunnar');
    h.resolve = 2; // la réserve n'est PAS la cause du refus
    h.conditions = [];
    h.diseases = [contractDisease('pneumonie', makeRNG(3))!];
    syncDerivedConditions(h);
    expect(stacks(h, 'extenue'), 'témoin : le Malaise porte bien son Exténué').toBe(1);
    monter(h);
    const rack = niche()!;
    const bouton = [...rack.querySelectorAll('button.pt-state')].find((b) => (b.getAttribute('aria-label') ?? '').includes('Exténué')) as HTMLButtonElement | undefined;
    expect(bouton, 'la pastille de l’Exténué n’offre plus aucun contrôle').toBeTruthy();
    expect(bouton!.disabled, 'un contrôle dont la raison est à ATTEINDRE ne porte jamais `disabled`').toBe(false);
    expect(bouton!.getAttribute('aria-disabled'), 'le refus n’est pas annoncé').toBe('true');
    expect(bouton!.getAttribute('aria-label'), 'le nom accessible ne porte pas la raison du refus').toMatch(/Malaise|guérie|maladie/i);
  });

  // Géométrie IMMUABLE : une ressource à zéro ne supprime pas sa gouttière (héros Empêtré = Mouvement 0).
  it('garde les DEUX gouttières dessinées à 0 Mouvement, socle lisible', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [{ id: 'empetre', value: 1 }] as ConditionInstance[];
    monter(h, { runBudget: 0 });
    expect(host.querySelectorAll('.cc-gutter-action').length).toBe(1);
    const move = host.querySelector('.cc-gutter-move');
    expect(move).not.toBeNull();
    expect(move!.querySelector('.cc-socle')!.textContent).toBe('0MOUV.');
    expect(move!.querySelectorAll('.cc-gutter-rail > i').length).toBe(0);
  });

  // Planche USER 2026-08-17 : le socle porte la VALEUR COURANTE et, dessous, le LIBELLÉ de sa
  // ressource (« 3 / MOUV. », « 1 / ACTION ») — le maximum se lit aux crans du rail, jamais deux fois.
  it('socle = valeur courante + libellé de la ressource, sans « N/M »', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h);
    const battle = useGame.getState().battle!;
    // Le Mouvement restant vient du moteur (`movementRemaining`), il n'est pas forcé par le test.
    const reste = movementRemaining(battle, h);
    expect(reste).toBeGreaterThan(0);
    const move = host.querySelector('.cc-gutter-move')!;
    const action = host.querySelector('.cc-gutter-action')!;
    const socleMove = move.querySelector('.cc-socle')!;
    const socleAction = action.querySelector('.cc-socle')!;
    expect(socleMove.querySelector('i')!.textContent).toBe('MOUV.');
    expect(socleAction.querySelector('i')!.textContent).toBe('ACTION');
    // La valeur est le TEXTE du badge, libellé retiré : aucun « / » (le max vit aux crans).
    expect(socleMove.textContent!.replace('MOUV.', '')).toBe(String(reste));
    expect(socleAction.textContent!.replace('ACTION', '')).toBe('1');
    expect(socleMove.textContent).not.toContain('/');
    expect(socleAction.textContent).not.toContain('/');
    // … et les crans, eux, disent bien le maximum (aucun Mouvement dépensé ici).
    expect(move.querySelectorAll('.cc-gutter-rail > i').length).toBe(reste);
    expect(action.querySelectorAll('.cc-gutter-rail > i').length).toBe(1);
  });

  // Planche USER 2026-08-17 : MOUVEMENT à GAUCHE du portrait, ACTION à DROITE, niche d'États au
  // flanc droit — l'ordre de lecture de l'arche est un contrat, pas un hasard de composition.
  it('place la gouttière Mouvement à GAUCHE du portrait et l’Action à DROITE, États au flanc droit', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h);
    const body = host.querySelector('.cc-arch-body')!;
    const rangs = [...body.children].map((el) =>
      el.classList.contains('cc-gutter-move') ? 'move'
      : el.classList.contains('cc-gutter-action') ? 'action'
      : el.classList.contains('ptile-states') ? 'etats'
      : el.querySelector('.ptile') ? 'portrait'
      : 'autre',
    );
    expect(rangs).toEqual(['move', 'portrait', 'action', 'etats']);
  });

  // Planche USER 2026-08-17 : Blessures en BARRE PLEINE LARGEUR sous le corps de l'arche, valeur
  // NOMMÉE (« 9 / 9 BLESSURES ») — et une seule écriture de la donnée (le portrait n'en porte plus).
  it('rend les Blessures en barre nommée sous le corps, une seule fois', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    h.wounds = { current: 9, max: 9 };
    monter(h);
    const arch = host.querySelector('.cc-arch')!;
    const barres = arch.querySelectorAll('.life-bar');
    expect(barres.length).toBe(1);
    expect(barres[0].parentElement).toBe(arch);
    expect(barres[0].querySelector('.life-bar__value')!.textContent).toBe('9 / 9 BLESSURES');
    expect(barres[0].querySelector('[role="meter"]')!.getAttribute('aria-valuenow')).toBe('9');
    // La barre se pose APRÈS le corps (portrait + gouttières) et AVANT le nom gravé.
    const ordre = [...arch.children];
    expect(ordre.indexOf(arch.querySelector('.cc-arch-body')!)).toBeLessThan(ordre.indexOf(barres[0]));
    expect(ordre.indexOf(barres[0])).toBeLessThan(ordre.indexOf(arch.querySelector('.cc-arch-name')!));
  });

  // Au tour d'un adversaire, la console change de FORME — elle ne rend plus de cases du tout
  // (`.claude/memory/user-arbitrage-tour-adverse-console-spectatrice-jamais-pont-entier.md`,
  // 2026-08-24, qui porte le verbatim et sa référence RT). Le comportement mesuré ici SUPPLANTE
  // celui que ce contrat verrouillait (spec zone 7 : « mêmes cases, inertes »).
  it('tour d’un ENNEMI : plus une case ni une bande — l’ARCHE SEULE, PV en teinte hostile', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    const e = foe('e1', 9, 9);
    e.conditions = [{ id: 'hemorragique', value: 2 }] as ConditionInstance[];
    e.wounds = { current: 7, max: 12 };

    monter(h, { foes: [e] });
    expect(host.querySelector('.combat-console')!.getAttribute('data-forme')).toBe('complete');
    expect(host.querySelectorAll('.cc-cell').length, 'témoin : le pont complet a ses cases').toBeGreaterThan(0);

    monter(h, { foes: [e], turn: 1 });
    expect(host.querySelector('.combat-console')!.getAttribute('data-forme')).toBe('spectatrice');
    // Les RÉGIONS de la bande meurent — c'est-à-dire les « barres gauche et droite » que l'arbitrage
    // du 2026-09-20 refuse (verbatim : « sans les barres gauche et droite pour les ennemies »).
    for (const mort of ['.cc-cell', '.cc-bay', '.cc-sets', '.cc-quick', '.cc-grid', '.cc-conduit', '.cc-corner']) {
      expect(host.querySelectorAll(mort).length, `${mort} survit au tour de l’adversaire`).toBe(0);
    }
    // Ce qui RESTE est l'arche, la même que celle du héros, SEULE dans la bande : elle dit qui joue
    // — son nom, ses jauges du tour, son rack d'États, et ses Blessures RÉELLES (aucun masquage) en
    // teinte hostile, la couleur d'équipe du jeu (`teintesJeu`), jamais un rouge recopié.
    const arche = host.querySelector('.cc-arch')!;
    expect(host.querySelectorAll('.cc-arch').length).toBe(1);
    expect([...host.querySelector('.cc-dock')!.children], 'la bande porte autre chose que l’arche').toEqual([arche]);
    expect(arche.querySelector('.cc-arch-name')!.textContent).toBe('Rat e1');
    expect(arche.querySelector('.life-bar__value')!.textContent).toBe('7 / 12 BLESSURES');
    expect(parseColor((arche.querySelector('.life-bar__fill') as HTMLElement).style.getPropertyValue('--life-color'))).toEqual(parseColor(ENEMY_TINT));
    expect(arche.querySelectorAll('.pt-state').length).toBe(1);
    expect(arche.querySelector('.pt-n')!.textContent).toBe('2');
    // Les deux goutttières du tour restent lisibles (décision d'ingénierie 2026-09-20 : aucune
    // information adverse n'est masquée ici, `InspectPanel` montre déjà les PB d'un adversaire)…
    expect(arche.querySelectorAll('.cc-gutter').length).toBe(2);
    // … mais AUCUN geste : ni annulation de déplacement, ni retrait d'État — on regarde. (Les
    // déclencheurs de FICHE de règle restent : lire une règle n'est pas agir.)
    expect(arche.querySelectorAll('[data-action], [data-cell]').length, 'un geste survit à la forme spectatrice').toBe(0);
  });
});

// ── SONDES PIXEL du juge vision (2026-08-17) promues en contrats ────────────────────────────────
// Aucune sonde DOM ne voyait ces défauts : ils vivent dans les COULEURS et les BOÎTES déclarées.
// On les juge donc là où ils sont décidés — le CSS — en recomposant les couleurs comme le fait le
// moteur de rendu (résolution des tokens `:root`, alpha composité sur son fond) et en mesurant le
// contraste WCAG 2.x. Seuil 3:1 pour un ÉLÉMENT graphique (frontière de cran), 4,5:1 pour un TEXTE.
// ANGLE MORT DÉCLARÉ : ces contrats jugent les couleurs DÉCLARÉES, pas les pixels d'un rendu — un
// défaut né d'une superposition non déclarée ici (ombre portée, filtre) leur échappe ; la capture
// reste le juge de dernier ressort.
// L'environnement jsdom ne fournit pas d'`import.meta.url` de schéma `file:` : les modules CSS se
// lisent depuis la racine du projet (racine de la suite Vitest).
const STYLES = join(process.cwd(), 'src', 'ui', 'styles');
const readCss = (f: string) => readFileSync(join(STYLES, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const CC_CSS = readCss('combat-console.css');
const CHIPS_CSS = readCss('state-chips.css');
const BASE_CSS = readCss('base.css');
const CC_BASE = baseSection(CC_CSS);
/** Couche PARTAGÉE : la MATIÈRE de la bande (nappe, liseré) vit dans la peau `.skin-pont`
 *  (components.css), posée à côté de `.combat-console` et de `.cc-arch` — une seule définition pour
 *  le pont de combat, son fronton et le pont d'exploration. */
const COMPONENTS_BASE = baseSection(readCss('components.css'));
const CHIPS_BASE = baseSection(CHIPS_CSS);
const DOCK_BASE = baseSection(readCss('party-dock.css'));
const STRIP_BASE = baseSection(readCss('initiative-strip.css'));
const BANNER_BASE = baseSection(readCss('combat-banner.css'));
/** Module d'ÉCRAN du HUD : c'est lui qui POSE le pont — la grille du plateau et ses deux rangées
 *  (#1848). Le pont n'a plus d'ancrage propre : son placement se lit ici. */
const HUD_BASE = baseSection(readCss('hud.css'));

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/* `mediaBlock` (corps d'une tranche) et `baseSection` (la feuille privée de ses tranches) : UNE
   définition partagée, `scripts/guards/lib/cssCouches.mjs` — `src/ui/ui-ratchets.test.ts` lit les
   mêmes tranches avec les mêmes fonctions. Une règle de BASE est la loi à toute largeur : c'est là
   que se jugent les couleurs (les tranches ne règlent que la densité). */

/** Déclarations de LA règle au sélecteur exact (normalisé) — une seule, sinon la sonde ment. */
function ruleOf(css: string, selector: string): string {
  const hits = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((b) => norm(b[1]) === norm(selector));
  expect(hits.length, `règle « ${selector} » : ${hits.length} occurrence(s), attendu 1`).toBe(1);
  return hits[0][2];
}

/** Valeur déclarée d'une propriété (la DERNIÈRE gagne, comme en cascade). */
function decl(block: string, prop: string): string | null {
  const all = [...block.matchAll(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'gi'))];
  return all.length ? norm(all[all.length - 1][1]) : null;
}

/**
 * CENTRAGE d'une boîte hors flux — l'idiome, nommé UNE fois : ancrage à la moitié du parent, puis
 * recul de sa PROPRE moitié. Les contrats disent « centrée », jamais « left: 50% » : recopié dans
 * chaque `it`, ce couple de littéraux gèle l'interface sans rien garder de plus
 * (`docs/charte-ui.md` § « Où se garde un contrat CSS »).
 */
function centrage(bloc: string): 'les deux axes' | 'axe X' | 'axe Y' | 'aucun' {
  const t = (decl(bloc, 'transform') ?? '').replace(/\s+/g, '');
  const couple = /^translate\(([^,)]+)(?:,([^)]+))?\)$/.exec(t);
  const tx = /^translateX\(([^)]+)\)$/.exec(t)?.[1] ?? couple?.[1] ?? null;
  const ty = /^translateY\(([^)]+)\)$/.exec(t)?.[1] ?? couple?.[2] ?? null;
  const moitie = (v: string | null | undefined) => v?.trim() === '50%';
  const x = moitie(decl(bloc, 'left')) && tx === '-50%';
  const y = moitie(decl(bloc, 'top')) && ty === '-50%';
  return x && y ? 'les deux axes' : x ? 'axe X' : y ? 'axe Y' : 'aucun';
}

const racine = () => ruleOf(CC_BASE, ':root');

/**
 * ÉVALUE une longueur CSS déclarée (`px`, `vw`, `vh`, `calc`, `clamp`, `min`, `max`, `var`) à un
 * viewport donné, en résolvant les `var(--x)` par le `:root` du module. C'est l'instrument des
 * contrats de GRANDEUR : on juge la LOI déclarée (un rapport, un ordre, un budget), jamais le TEXTE
 * d'une formule — une formule réécrite sans changer le rendu ne doit rien casser.
 */
function evalLen(expr: string, vw: number, vh: number, depth = 0): number {
  if (depth > 8) throw new Error(`résolution de variables trop profonde : ${expr}`);
  let e = expr.trim();
  // 1) variables du module
  for (let i = 0; i < 8 && e.includes('var('); i++) {
    e = e.replace(/var\((--[\w-]+)\)/g, (_m, nom: string) => {
      const v = decl(racine(), nom);
      if (!v) throw new Error(`variable ${nom} absente du :root de combat-console.css`);
      return `(${String(evalLen(v, vw, vh, depth + 1))}px)`;
    });
  }
  // 2) fonctions CSS → JS
  e = e.replace(/\bclamp\(/g, 'CLAMP(').replace(/\bmin\(/g, 'Math.min(').replace(/\bmax\(/g, 'Math.max(').replace(/\bcalc\(/g, '(');
  // 3) unités
  e = e.replace(/(-?[\d.]+)vw/g, (_m, n: string) => String((Number(n) * vw) / 100))
    .replace(/(-?[\d.]+)vh/g, (_m, n: string) => String((Number(n) * vh) / 100))
    .replace(/(-?[\d.]+)px/g, '$1');
  if (/[a-zA-Z_$]/.test(e.replace(/CLAMP|Math\.min|Math\.max/g, ''))) throw new Error(`unité/fonction non gérée : ${expr} → ${e}`);
  const CLAMP = (lo: number, v: number, hi: number) => Math.min(Math.max(v, lo), hi);
  return Function('CLAMP', 'Math', `"use strict"; return (${e});`)(CLAMP, Math) as number;
}

function token(name: string): string {
  const m = new RegExp(`${name}:\\s*([^;]+);`).exec(BASE_CSS);
  expect(m, `token ${name} absent de base.css`).not.toBeNull();
  return m![1].trim();
}

/**
 * Évalue une longueur DÉCLARÉE (`calc(a + b - c)`, somme de termes en px, de `var(--x)` et de `100%`)
 * dans un environnement de valeurs. Sert à COMPARER deux bornes exprimées dans les mêmes tokens : les
 * chiffres injectés sont arbitraires, seule leur relation est jugée.
 */
function pxCalc(value: string, env: Record<string, number>): number {
  const inner = /^calc\((.*)\)$/.exec(norm(value))?.[1] ?? norm(value);
  let total = 0;
  let signe = 1;
  for (const jeton of inner.split(/\s+/)) {
    if (jeton === '+') { signe = 1; continue; }
    if (jeton === '-') { signe = -1; continue; }
    const nom = /^var\((--[a-z0-9-]+)\)$/.exec(jeton)?.[1] ?? jeton;
    const val = nom in env ? env[nom] : parseFloat(jeton);
    expect(Number.isFinite(val), `terme « ${jeton} » non résolu dans « ${value} »`).toBe(true);
    total += signe * val;
    signe = 1;
  }
  return total;
}

type RGBA = [number, number, number, number];

function parseColor(v: string): RGBA {
  const t = v.trim();
  if (t.startsWith('var(')) return parseColor(token(t.slice(4, t.indexOf(')')).trim()));
  if (t.startsWith('#')) {
    const h = t.slice(1);
    const w = h.length <= 4 ? 1 : 2;
    const at = (i: number) => parseInt(w === 1 ? h[i] + h[i] : h.slice(i * 2, i * 2 + 2), 16);
    return [at(0), at(1), at(2), h.length === 4 || h.length === 8 ? at(3) / 255 : 1];
  }
  const m = /rgba?\(([^)]*)\)/.exec(t);
  expect(m, `couleur non reconnue : ${v}`).not.toBeNull();
  const parts = m![1].split(/[,\s/]+/).filter(Boolean).map(Number);
  return [parts[0], parts[1], parts[2], parts[3] ?? 1];
}

/** Toutes les couleurs d'une valeur (un dégradé en porte plusieurs — chaque arrêt est un fond réel). */
function colorsIn(value: string): RGBA[] {
  return [...value.matchAll(/var\(--[\w-]+\)|#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)].map((m) => parseColor(m[0]));
}

/** Couleur d'un raccourci `border` (`1px solid <couleur>`). */
const borderColorOf = (block: string, prop = 'border') => colorsIn(decl(block, prop)!).slice(-1)[0];

const lum = (c: RGBA) => 0.2126 * srgbToLinear(c[0]) + 0.7152 * srgbToLinear(c[1]) + 0.0722 * srgbToLinear(c[2]);
/** Composition alpha (le moteur peint le premier SUR le second). */
const over = (fg: RGBA, bg: RGBA): RGBA => [fg[0] * fg[3] + bg[0] * (1 - fg[3]), fg[1] * fg[3] + bg[1] * (1 - fg[3]), fg[2] * fg[3] + bg[2] * (1 - fg[3]), 1];
function contrast(fg: RGBA, bg: RGBA): number {
  const a = lum(over(fg, bg));
  const b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
/** Contraste le PIRE d'une encre contre tous les fonds possibles (arrêts de dégradé compris). */
const worst = (fg: RGBA, bgs: RGBA[]) => Math.min(...bgs.map((bg) => contrast(fg, bg)));

describe('CombatConsole — micro-rendu (sondes pixel du juge vision, 2026-08-17)', () => {
  // A-1 / C-3 : « le max se lit aux crans » du socle SUPPOSE des crans visibles. Filet blanc à 0,14
  // d'alpha sur un rail presque noir = ΔL 1 mesuré sur 70px : à 0/N, un tube lisse.
  it('A-1 — le filet d’un cran de gouttière se lit sur le fond du rail, à vide comme plein', () => {
    const rail = ruleOf(CC_BASE, '.cc-gutter-rail');
    const fonds = colorsIn(decl(rail, 'background')!);
    expect(fonds.length).toBeGreaterThanOrEqual(2);
    const cran = ruleOf(CC_BASE, '.cc-gutter-rail > i');
    const bordVide = borderColorOf(cran);
    const fondVide = parseColor(decl(cran, 'background')!);
    // Le filet contre le CREUX du rail (chacun de ses arrêts) et contre le fond du cran lui-même.
    expect(worst(bordVide, [...fonds, fondVide])).toBeGreaterThanOrEqual(3);

    // Cran PLEIN : son filet sépare deux crans voisins (sinon la colonne se fond en tube).
    const plein = ruleOf(CC_BASE, '.cc-gutter-rail > i.on');
    const bordPlein = parseColor(decl(plein, 'border-color')!);
    for (const jauge of ['--gauge-action', '--gauge-move']) {
      expect(contrast(bordPlein, parseColor(token(jauge)))).toBeGreaterThanOrEqual(3);
    }
    // … et aucun halo EXTERNE ne comble l'écart entre deux crans (c'est ce qui les fondait).
    expect(decl(plein, 'box-shadow') ?? 'none').toMatch(/^(inset|none)/);
  });

  // A-4 : « MOUV. »/« ACTION » à 7px — 4,14:1 mesuré au pic, sous le seuil de texte.
  it('A-4 — l’encre des socles tient 4,5:1 sur la plaque du socle, valeur comme libellé', () => {
    const socle = ruleOf(CC_BASE, '.cc-socle');
    const arche = parseColor(token('--cc-arch-mid'));
    const plaque = colorsIn(decl(socle, 'background')!).map((c) => over(c, arche));
    const libelle = parseColor(decl(ruleOf(CC_BASE, '.cc-socle > i'), 'color')!);
    expect(worst(libelle, plaque)).toBeGreaterThanOrEqual(4.5);
    for (const jauge of ['--gauge-action', '--gauge-move']) {
      expect(worst(parseColor(token(jauge)), plaque)).toBeGreaterThanOrEqual(4.5);
    }
  });

  // B-4 : chiffre blanc sur le vert de `hpColor` — 1,88:1 mesuré. La valeur prend sa PLAQUE, et son
  // corps passe en monospace (« BLESSURES » en fonte display rendait « BŁESSURES »).
  it('B-4 — la valeur de la barre de Blessures tient 4,5:1 sur TOUTES les teintes de hpColor, en mono', () => {
    const val = ruleOf(CC_BASE, '.combat-console .cc-arch > [data-overlay] > span');
    expect(decl(val, 'font')).toMatch(/monospace/);
    expect(val).not.toContain('--font-display');
    // La carte du BANDEAU porte la même donnée sur la même primitive : même traitement, même seuil.
    const tuile = ruleOf(DOCK_BASE, '.party-dock .ptile [data-overlay] > span');
    for (const bloc of [val, tuile]) {
      const fond = decl(bloc, 'background');
      const ink = parseColor(decl(bloc, 'color')!);
      const bgs = [1, 0.7, 0.5, 0.2, 0].map((r) => {
        const piste = parseColor(hpColor(r));
        return fond ? over(parseColor(fond), piste) : piste;
      });
      expect(worst(ink, bgs)).toBeGreaterThanOrEqual(4.5);
    }
    // Sans plaque déclarée, l'encre se juge À MÊME le remplissage de la piste — c'est le défaut
    // mesuré (blanc sur le vert de `hpColor`, 1,88:1) ; avec plaque, elle se juge sur la plaque
    // composée sur ce même remplissage.
    const fondVal = decl(val, 'background');
    const plaque = fondVal ? parseColor(fondVal) : null;
    const encre = parseColor(decl(val, 'color')!);
    // Les teintes RÉELLES de la barre viennent du moteur (`hpColor`), aucune valeur recopiée ici.
    const fonds = [1, 0.7, 0.5, 0.2, 0].map((r) => {
      const piste = parseColor(hpColor(r));
      return plaque ? over(plaque, piste) : piste;
    });
    expect(worst(encre, fonds)).toBeGreaterThanOrEqual(4.5);
  });

  // A-2 : la plaque de l'indice mangeait le filet de son alvéole (8/16 rangées du bord droit).
  it('A-2 — l’indice d’État se loge DANS l’alvéole, sans mordre son cadre', () => {
    const n = ruleOf(CHIPS_BASE, '.ptile-states[data-reserve] .pt-n');
    expect(decl(n, 'position')).toBe('absolute');
    for (const cote of ['top', 'right', 'bottom', 'left']) {
      const v = decl(n, cote);
      if (v) expect(parseFloat(v), `.pt-n ${cote}: ${v} déborde la boîte`).toBeGreaterThanOrEqual(0);
    }
  });

  it('A-3 — le glyphe occupe son alvéole et l’indice porte sa propre pastille', () => {
    const svg = ruleOf(CHIPS_BASE, '.ptile-states[data-reserve] .pt-state svg');
    // Le glyphe laisse le filet de l'alvéole, PAS DAVANTAGE (à −4px il tombait à 11px dans 15) : une
    // RELATION à la taille d'alvéole, évaluée — la valeur du côté ne regarde pas ce test.
    const alvPx = parseFloat(decl(ruleOf(CHIPS_BASE, '.ptile-states[data-reserve]'), '--alv')!);
    for (const p of ['width', 'height']) {
      const g = pxCalc(decl(svg, p)!, { '--alv': alvPx });
      expect(g, `glyphe ${p} = ${g} dans une alvéole de ${alvPx}`).toBeLessThan(alvPx);
      expect(alvPx - g, `le glyphe ne laisse que le filet (${alvPx - g}px)`).toBeLessThanOrEqual(alvPx / 5);
    }
    const n = ruleOf(CHIPS_BASE, '.ptile-states[data-reserve] .pt-n');
    const pastille = parseColor(decl(n, 'background')!);
    expect(pastille[3]).toBe(1);
    expect(contrast(parseColor(decl(n, 'color')!), pastille)).toBeGreaterThanOrEqual(4.5); // norme: WCAG 2.x, 4,5:1 pour un TEXTE
    // … et la pastille se DÉTACHE du fond de l'alvéole (sinon elle se lit comme un trait du glyphe).
    const alv = ruleOf(CHIPS_BASE, '.ptile-states[data-reserve] .pt-state, .ptile-states[data-reserve] .pt-void');
    const fondAlv = colorsIn(decl(alv, 'background')!).map((c) => over(c, parseColor(token('--cc-brass-cell-hi'))));
    expect(worst(pastille, fondAlv)).toBeGreaterThanOrEqual(3);
  });

  it('B-6 — l’alvéole VIDE est opaque et cerclée, d’un cran SOUS l’alvéole portée', () => {
    const alv = ruleOf(CHIPS_BASE, '.ptile-states[data-reserve] .pt-state, .ptile-states[data-reserve] .pt-void');
    const vide = ruleOf(CHIPS_BASE, '.ptile-states[data-reserve] .pt-void');
    // La HACHURE de la carte du bandeau : c'est elle qui passait au travers d'une alvéole translucide.
    const hachure = colorsIn(decl(ruleOf(DOCK_BASE, '.party-dock .ptile-wrap'), 'background')!);
    const fondVide = colorsIn(decl(vide, 'background')!);
    for (const c of fondVide) expect(c[3]).toBe(1);
    const ratioVide = worst(parseColor(decl(vide, 'border-color')!), fondVide);
    expect(ratioVide).toBeGreaterThanOrEqual(3);
    // Alvéole PORTÉE : filet plus présent que celui du vide (hiérarchie vide < plein).
    const fondPlein = colorsIn(decl(alv, 'background')!).flatMap((c) => hachure.map((h) => over(c, h)));
    const ratioPlein = worst(borderColorOf(alv), fondPlein);
    expect(ratioPlein).toBeGreaterThanOrEqual(3);
    expect(ratioPlein).toBeGreaterThan(ratioVide);
  });

  // B-7 : la pastille-BOUTON (slot `action` de `StateChips`) portait un commentaire annonçant son
  // style… suivi d'AUCUNE règle : à l'écran elle était le jumeau exact de l'informative.
  it('B-7 — la pastille ACTIONNABLE se distingue de l’informative (affordance visible)', () => {
    const info = ruleOf(CHIPS_BASE, '.ptile-states[data-reserve] .pt-state, .ptile-states[data-reserve] .pt-void');
    const bouton = ruleOf(CHIPS_BASE, '.ptile-states[data-reserve] .pt-state.btn');
    // L'informative garde le laiton de RUBRIQUE ; la bouton prend un filet d'un AUTRE laiton.
    expect(decl(info, 'border')).toMatch(/--atelier-brass-rubric/);
    const filet = decl(bouton, 'border-color');
    expect(filet, 'la pastille-bouton n’a pas de filet propre').toBeTruthy();
    expect(filet).not.toMatch(/--atelier-brass-rubric/);
    // … et elle se DÉTACHE du fond de l'alvéole (le filet doit se voir, pas seulement exister).
    const fondAlv = colorsIn(decl(info, 'background')!).map((c) => over(c, parseColor(token('--cc-brass-cell-hi'))));
    expect(worst(parseColor(token(filet!.replace(/^var\(|\)$/g, ''))), fondAlv)).toBeGreaterThanOrEqual(3);
    expect(decl(bouton, 'box-shadow'), 'aucune lueur intérieure').toBeTruthy();
    expect(decl(bouton, 'cursor')).toBe('pointer');
  });

  // B-8 : `.btn.btn-nu` (base.css) annule `min-height`/`min-width` et, PLUS SPÉCIFIQUE que le
  // plancher global `@media (pointer: coarse) .btn`, il l'écrase — cible mesurée 15 × 15px au doigt.
  it('B-8 — la pastille ACTIONNABLE garde le plancher tactile (≥ 40px) que la variante NUE annule', () => {
    const nu = ruleOf(baseSection(BASE_CSS), '.btn.btn-nu');
    expect(parseFloat(decl(nu, 'min-height')!), 'la variante nue ne remet plus le plancher à 0 ?').toBe(0);
    // L'alvéole reste PETITE À L'ŒIL : c'est sa ZONE DE CONTACT qui porte le calibre — relation, pas
    // une taille d'alvéole épinglée.
    const alv = ruleOf(CHIPS_BASE, '.ptile-states[data-reserve]');
    const coarse = mediaBlock(CHIPS_CSS, '@media (pointer: coarse)');
    const cible = ruleOf(coarse, '.ptile-states[data-reserve] .pt-state.btn::after');
    expect(decl(cible, 'position')).toBe('absolute');
    for (const d of ['width', 'height']) {
      expect(parseFloat(decl(cible, d)!), `cible tactile ${d}`).toBeGreaterThanOrEqual(40); // norme: cible tactile au doigt (WCAG 2.5.5 / charte 44px)
      expect(parseFloat(decl(alv, '--alv')!), `l’alvéole dépasse sa propre zone de contact (${d})`).toBeLessThan(parseFloat(decl(cible, d)!));
    }
    // … CENTRÉE sur l'alvéole, qui doit donc être le repère positionné de la zone.
    expect(centrage(cible), 'la zone de contact n’est pas centrée sur son alvéole').toBe('les deux axes');
    const boite = ruleOf(CHIPS_BASE, '.ptile-states[data-reserve] .pt-state, .ptile-states[data-reserve] .pt-void');
    expect(decl(boite, 'position')).toBe('relative');
  });

  // C-1 : à 360 le portrait de l'arche n'avait PAS DE VISAGE — la BOÎTE rétrécit (style inline de la
  // primitive repris à la main), le DESSIN restait à 72px et se cadrait « slice » sur son coin.
  it('C-1 — toute boîte de portrait redimensionnée remet son dessin à l’échelle', () => {
    // La composition compacte redimensionne bien la boîte — par la VARIABLE de portrait, une seule
    // source pour les trois boîtes (tuile, face, dessin), au lieu de trois littéraux `!important`.
    const at560 = mediaBlock(CC_CSS, '@media (max-width: 560px)');
    // La composition compacte RÉTRÉCIT le portrait : relation à la valeur de base.
    const portraitBase = evalLen(decl(ruleOf(CC_BASE, ':root'), '--cc-portrait')!, 360, 640);
    expect(evalLen(decl(ruleOf(at560, ':root'), '--cc-portrait')!, 360, 640)).toBeLessThan(portraitBase);
    const boites = ruleOf(CC_BASE, '.cc-arch .ptile, .cc-arch .ptile-face, .cc-arch .rig-portrait');
    expect(decl(boites, 'width')).toBe('var(--cc-portrait) !important');
    const svg = ruleOf(CC_BASE, '.cc-arch .rig-portrait > svg');
    expect(decl(svg, 'width')).toBe('100%');
    expect(decl(svg, 'height')).toBe('100%');
  });

  // C-2 : anneau de camp + contour d'équipe concentriques = « cadre dans un cadre » (doctrine FigTile).
  it('C-2 — UN SEUL anneau de camp sur le portrait de l’arche', () => {
    const dessin = ruleOf(CC_BASE, '.cc-arch .ptile-face .rig-portrait');
    expect(decl(dessin, 'border-width')).toBe('0');
    expect(CC_CSS).not.toMatch(/\.cc-arch \.rig-portrait\s*\{[^}]*border-style/);
    // … et c'est bien la tuile qui porte le camp, une seule fois, dans le DOM monté.
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h, { foes: [foe('e1', 9, 9)] });
    const arch = host.querySelector('.cc-arch')!;
    expect(arch.querySelectorAll('.team-ally, .team-enemy').length).toBe(1);
    expect(arch.querySelector('.ptile')!.classList.contains('team-ally')).toBe(true);
    // … et au tour de l'adversaire (forme SPECTATRICE, arbitrage 2026-08-24), l'arche seule porte le
    // camp au même endroit : une seule fois, sur la tuile.
    monter(h, { foes: [foe('e1', 9, 9)], turn: 1 });
    const seule = host.querySelector('.cc-arch')!;
    expect(seule.querySelectorAll('.team-ally, .team-enemy').length).toBe(1);
    expect(seule.querySelector('.ptile')!.classList.contains('team-enemy')).toBe(true);
  });

  // C-4 (R-M2) : « Mouve… », « Déter… » + « 3 » orphelin à 360 — la boîte à deux lignes ne pose son
  // ellipse que sur la DERNIÈRE ; un mot plus large que l'alvéole était tranché EN PLEIN GLYPHE.
  it('C-4 — le libellé d’alvéole s’ellipse, jamais coupé dans un mot', () => {
    const at560 = mediaBlock(CC_CSS, '@media (max-width: 560px)');
    const lbl = ruleOf(at560, '.cc-lbl');
    expect(decl(lbl, 'white-space')).toBe('nowrap');
    expect(decl(lbl, 'text-overflow')).toBe('ellipsis');
    // Une seule ligne : c'est `nowrap` qui l'impose — le moteur pose alors l'ellipse à la frontière
    // d'un glyphe, jamais dedans.
    // … et JAMAIS par la casse d'un mot (R-M2), sur aucun libellé de la console.
    expect(CC_CSS).not.toMatch(/overflow-wrap:\s*(anywhere|break-word)/);
    expect(CC_CSS).not.toMatch(/word-break:\s*break-all/);
    // Le libellé complet reste le NOM ACCESSIBLE de l'alvéole (`aria-label`) : l'infobulle native est
    // proscrite (cf. `console-no-title-only.test.ts`), l'ellipse ne doit pas pour autant amputer
    // l'information. (Une case VIDE ne porte aucun libellé : elle ne nomme aucune capacité.)
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h);
    const cases = [...host.querySelectorAll('.cc-grid-right .cc-cell:not(.cc-empty)')].filter((c) => c.querySelector('.cc-lbl'));
    expect(cases.length).toBeGreaterThan(0);
    for (const cell of cases) {
      expect(cell.getAttribute('aria-label'), `alvéole sans nom accessible : ${cell.textContent}`).toBeTruthy();
      expect(cell.getAttribute('title'), 'infobulle native proscrite sur une alvéole').toBeNull();
    }
  });
});

// ── ASSEMBLAGE : LA CONSOLE EST UN OBJET (spec §1c-ter) ─────────────────────────────────────────
// Arbitrage user 2026-08-17 (verbatim) : « Tu garde le même défaut remonte que la maquette était
// sensé mettre en évidence: tes blocs sont tous déconnecté ». Le défaut ne vit pas DANS les zones,
// il vit ENTRE elles — d'où trois contrats de STRUCTURE, jugés sur le DOM monté et sur les boîtes
// déclarées (la sonde pixel « aucun terrain sous le bord haut du pont » reste au juge de recette).
describe('CombatConsole — assemblage : UN PONT, pas des blocs', () => {
  it('P-1 — UN élément-pont unique, de bord à bord, porte les QUATRE régions de console', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h);
    const ponts = host.querySelectorAll('.combat-console');
    expect(ponts.length).toBe(1);
    const pont = ponts[0];
    // La console n'a plus rien à côté d'elle : les quatre régions sont DEDANS.
    expect([...host.children]).toEqual([pont]);
    for (const zone of ['.cc-bay-left', '.cc-arch', '.cc-bay-right', '.cc-corner']) {
      const el = host.querySelector(zone);
      expect(el, `région ${zone} absente`).not.toBeNull();
      expect(pont.contains(el!) && el !== pont, `région ${zone} hors du pont`).toBe(true);
    }
    // … et la bande va d'un bord à l'autre, opaque : entre deux régions il y a du PONT, jamais du
    // terrain (c'est ce que la sonde pixel de recette mesure à l'écran).
    // LE PONT EST EN FLUX (#1848) : sa racine ne porte AUCUNE ancre — elle est la rangée basse de la
    // grille du plateau, et son rembourrage haut lui fait valoir son EMPREINTE (saillie du fronton
    // comprise). C'est cette structure qui retire à toute surface basse la hauteur du pont à lire.
    const bande = ruleOf(CC_BASE, '.combat-console');
    for (const cote of ['left', 'right', 'bottom']) expect(decl(bande, cote), cote).toBeNull();
    expect(decl(bande, 'padding-top')).toBe('var(--cc-saillie)');
    expect(decl(ruleOf(HUD_BASE, '.stage'), 'display')).toBe('grid');
    // La RANGÉE dit tout : le plateau a une rangée de monde puis une rangée DE PONT, dimensionnée sur
    // le pont (`auto`) ; le pont occupe la DERNIÈRE, et les surfaces en flot (`.stage-flot`) vivent
    // dans une rangée STRICTEMENT au-dessus. C'est cette relation — pas un nombre — qui retire à toute
    // surface basse la hauteur du pont à lire : si les deux partageaient une rangée, le recouvrement
    // reviendrait le lendemain.
    const pistes = decl(ruleOf(HUD_BASE, '.stage'), 'grid-template-rows')!.trim().split(/\s+/);
    const rangeeDe = (sel: string) => Number(decl(ruleOf(HUD_BASE, sel), 'grid-area')!.split('/')[0].trim());
    expect(rangeeDe('.stage > .combat-console, .stage > .exploration-dock'), 'le pont n’est pas dans la DERNIÈRE rangée')
      .toBe(pistes.length);
    expect(pistes[pistes.length - 1], 'la rangée du pont ne se dimensionne pas sur lui').toBe('auto');
    expect(rangeeDe('.stage > .stage-flot'), 'les surfaces en flot partagent la rangée du pont')
      .toBeLessThan(rangeeDe('.stage > .combat-console, .stage > .exploration-dock'));
    // La MATIÈRE de la bande est la peau `.skin-pont`, que la BANDE POSE (la racine, elle, ne peint
    // rien) : la nappe et le liseré se lisent donc là, une seule fois pour les trois boîtes de pont.
    expect(host.querySelector('.cc-dock')!.classList.contains('skin-pont'), 'la bande POSE la peau').toBe(true);
    expect(pont.classList.contains('skin-pont'), 'l’empreinte du pont ne peint rien').toBe(false);
    const peau = ruleOf(COMPONENTS_BASE, '.skin-pont');
    expect(decl(peau, 'background-image')).toMatch(/linear-gradient/);
    expect(parseColor(decl(peau, 'background-color')!)[3]).toBe(1);
    // LISERÉ HAUT continu (planche : `[0,873,1920,8]`) — porté par la bande elle-même, donc entier.
    expect(decl(peau, 'border-top')).toBeTruthy();
  });

  it('P-2 — le bandeau de phase est SUPERPOSÉ : le pont a le même flux avec et sans lui', () => {
    // #1349 : en flux, `.cc-phase` comprimait la console de 17px au tour de l'ennemi.
    const phase = ruleOf(CC_BASE, '.cc-phase');
    expect(decl(phase, 'position')).toBe('absolute');
    expect(decl(phase, 'bottom')).toBeTruthy();
    // Ce que le pont MESURE, ce sont ses enfants EN FLUX : un enfant déclaré absolu n'en est pas.
    const enFlux = () =>
      [...host.querySelector('.combat-console')!.children]
        .filter((el) => !(el.classList.contains('cc-phase') && decl(phase, 'position') === 'absolute'))
        .map((el) => el.className);

    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    const e = foe('e1', 9, 9);
    monter(h, { foes: [e] });
    expect(host.querySelectorAll('.cc-phase').length).toBe(0);
    const auHeros = enFlux();
    const casesHeros = host.querySelectorAll('.cc-cell').length;

    // Un INTERLUDE de ciblage fait naître le bandeau SUR le tour du joueur : le pont garde alors
    // exactement le même flux et le même compte de cases (loi 1) — c'est ce que ce contrat mesure.
    // (Le tour de l'adversaire, lui, change de FORME depuis l'arbitrage 2026-08-24 : il ne peut plus
    // servir de témoin de géométrie constante.)
    monter(h, { foes: [e], action: 'battery' });
    expect(host.querySelectorAll('.cc-phase').length).toBe(1);
    expect(enFlux()).toEqual(auHeros);
    expect(host.querySelectorAll('.cc-cell').length).toBe(casesHeros);
    // La hauteur du pont ne dépend pas non plus de l'ACTEUR : la rangée du matériel n'est montée
    // que si l'acteur a de quoi commuter (mesuré à l'écran : 219,3 → 202,3px de pont quand le Loup
    // prenait la main), d'où une hauteur DÉCLARÉE sur la travée, keyée sur le côté d'alvéole (voir D-1
    // pour le contrat complet : hauteur FIXE, pas un plancher).
    const haut = decl(ruleOf(CC_BASE, '.cc-bay-left'), 'height');
    expect(haut, 'la travée gauche ne déclare AUCUNE hauteur').toBeTruthy();
    expect(decl(ruleOf(CC_BASE, ':root'), '--cc-bay-h')!).toMatch(/var\(--cc-cell-h\)/);
  });

  it('P-3 — l’arche est le FRONTON du pont : même matière, aucune couture, DANS le pont', () => {
    const arche = ruleOf(CC_BASE, '.cc-arch');
    const peau = ruleOf(COMPONENTS_BASE, '.skin-pont');
    // Même nappe, ancrée au BAS des deux boîtes : de part et d'autre de la jonction, le bois a la
    // même teinte — il n'y a donc aucune couture à voir. Vrai PAR CONSTRUCTION : les deux boîtes
    // posent la MÊME peau, et aucune des deux ne redéclare la nappe.
    for (const p of ['background-image', 'background-size', 'background-position', 'background-color']) {
      expect(decl(arche, p), `${p} redéclarée par l’arche`).toBeNull();
      expect(decl(ruleOf(CC_BASE, '.combat-console'), p), `${p} redéclarée par le pont`).toBeNull();
      expect(decl(peau, p), `${p} portée par la peau`).toBeTruthy();
    }
    expect(decl(peau, 'background-position')).toBe('var(--pont-pos, bottom)');
    // Aucun filet à la jonction : ni bordure basse, ni bordure de flanc (seul le liseré haut reste).
    // Les trois côtés se remettent à zéro UN À UN — un `border: 0` effacerait le liseré de la peau.
    for (const c of ['border-right', 'border-bottom', 'border-left']) expect(decl(arche, c), c).toBe('0');
    expect(decl(arche, 'border-top'), 'le liseré de l’arche est celui de la peau').toBeNull();
    expect(decl(peau, 'border-top')).toMatch(/var\(--pont-liseret\)/);
    // Elle S'ÉLÈVE au-dessus du liseré au lieu d'être posée devant (planche : 811 vs 863) : elle
    // remonte EXACTEMENT de la hauteur de fronton déclarée — relation évaluée, pas un texte de calc.
    const fronton = parseFloat(decl(ruleOf(CC_BASE, ':root'), '--cc-fronton')!);
    expect(fronton).toBeGreaterThan(0);
    expect(evalLen(decl(arche, 'margin-top')!, 1920, 1080), 'l’arche ne s’élève pas de son fronton').toBe(-fronton);
    // … et structurellement, elle est DANS le pont, jamais une soeur flottante.
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h);
    const pont = host.querySelector('.combat-console')!;
    const a = host.querySelector('.cc-arch')!;
    expect(pont.contains(a)).toBe(true);
    expect(a.parentElement!.closest('.combat-console')).toBe(pont);
  });

  // ── P-4 : LE FRONTON EST CENTRÉ SUR LE VIEWPORT (planche 2026-08-17 : arche `[781,811,357,269]`,
  //    centre x = 959,5 pour 1920 — centré au pixel MALGRÉ des travées de largeurs inégales).
  //    Mesuré avant cette passe : −79px à 1280, −87px à 1920.
  //    ALGÈBRE du modèle déclaré (c'est elle que ce contrat verrouille) : le pont pose quatre
  //    colonnes — voie gauche (1fr) · fronton (auto) · voie droite (1fr) · coin (auto) — séparées de
  //    trois écarts `g`, avec un rembourrage gauche `p`. Les deux voies valent `t` (mêmes `1fr`),
  //    d'où largeur = p + t + g + A + g + t + g + coin, et centre du fronton = p + t + g + A/2.
  //    Ce centre vaut la moitié de la largeur SI ET SEULEMENT SI p = coin + g — quelle que soit la
  //    largeur d'écran, la taille d'alvéole ou celle de l'arche. Le contrat est donc cette identité,
  //    exprimée dans les MÊMES tokens (un littéral recopié dériverait au premier réglage du coin).
  it('P-4 — le fronton est centré : deux voies `1fr` égales + réserve MIROIR du coin', () => {
    const dock = ruleOf(CC_BASE, '.cc-dock');
    const cols = decl(dock, 'grid-template-columns')!;
    // Deux voies `1fr` (donc de MÊME largeur) qui encadrent le fronton, et le coin en 4ᵉ colonne.
    expect(cols.match(/1fr/g)?.length, `voies du pont : « ${cols} »`).toBe(2);
    expect(cols.split(/\s+(?![^(]*\))/).length).toBe(4);
    // La réserve miroir vaut EXACTEMENT le coin + un écart de région — l'identité p = coin + g.
    // La MARGE INTERNE de la bande (arbitrage 2026-08-24 : les régions ne touchent plus le bord de
    // l'écran) s'ajoute des DEUX côtés : c'est la DIFFÉRENCE des deux rembourrages qui centre.
    // L'identité se juge ÉVALUÉE : la différence des deux rembourrages vaut le coin plus l'écart de
    // région, quelles que soient l'écriture de la formule et la valeur des tokens.
    const coin = evalLen('var(--cc-corner)', 1920, 1080);
    const ecart = evalLen('var(--cc-bay-gap)', 1920, 1080);
    const gauche = evalLen(decl(dock, 'padding-left')!, 1920, 1080);
    const droite = evalLen(decl(dock, 'padding-right')!, 1920, 1080);
    expect(gauche - droite, 'la réserve miroir ne vaut plus coin + écart').toBe(coin + ecart);
    expect(norm(decl(dock, 'padding-right')!)).toBe('var(--cc-marge)');
    // … et le coin tire sa largeur du MÊME token : la réserve ne peut pas se désynchroniser de lui.
    expect(decl(ruleOf(CC_BASE, '.cc-end'), 'width')).toBe('var(--cc-corner)');
    expect(parseFloat(decl(ruleOf(CC_BASE, ':root'), '--cc-corner')!)).toBeGreaterThan(0);
    // Chaque travée se range CONTRE le fronton (le surplus de sa voie va au bord, pas au milieu).
    expect(decl(ruleOf(CC_BASE, '.cc-bay-left'), 'justify-self')).toBe('end');
    expect(decl(ruleOf(CC_BASE, '.cc-bay-right'), 'justify-self')).toBe('start');
    // … et les quatre régions sont bien les quatre colonnes, dans cet ordre, dans le DOM monté.
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h);
    // La PEAU de bande n'est pas un nom de région : le fronton la porte à côté de sa classe.
    expect([...host.querySelector('.cc-dock')!.children].map((el) => el.className.split(' ').filter((c) => c !== 'skin-pont').pop())).toEqual([
      'cc-bay-left', 'cc-arch', 'cc-bay-right', 'cc-corner',
    ]);
  });

  // ── P-5 : LE FIL DE COMBAT descend BAS-GAUCHE, en texte NU sur le terrain, juste au-dessus du
  //    pont (planche 2026-08-17 : journal `[170,779,330,57]`, aucun cadre, aligné à gauche). Il
  //    était en haut-centre, en pastilles cadrées (`top: 136px; left: 50%`).
  it('P-5 — le fil de combat est ancré bas-gauche sur la réserve du pont, en lignes NUES', () => {
    const feed = ruleOf(BANNER_BASE, '.combat-feed');
    expect(decl(feed, 'top')).toBe('auto');
    expect(decl(feed, 'transform')).toBe('none');
    // Ancré au BAS de la RANGÉE DU MONDE (#1848) : le pont est la rangée d'en dessous, le fil n'a
    // donc plus aucune hauteur de pont à connaître — seul le bandeau de phase, SUPERPOSÉ au parapet,
    // déborde dans sa rangée, et c'est la grandeur que le bandeau publie qu'il réserve.
    expect(decl(feed, 'bottom')).not.toMatch(/var\(--cc-deck-h\)/);
    expect(decl(feed, 'bottom')).toMatch(/var\(--cc-phase-h\)/);
    expect(readFileSync(join(process.cwd(), 'src', 'ui', 'CampaignView.tsx'), 'utf8'))
      .toMatch(/<div className="stage-flot">[\s\S]*<CombatBanner \/>/);
    // … à GAUCHE : une valeur en px depuis le bord, jamais un centrage.
    expect(decl(feed, 'left')).toMatch(/^\d+(\.\d+)?px$/);
    expect(decl(feed, 'align-items')).toBe('flex-start');
    // Lignes NUES : plus de carte (fond, filet, arrondi, rembourrage) — la lisibilité tient au halo
    // PARTAGÉ `.halo-champ`, que la ligne POSE.
    const ev = ruleOf(BANNER_BASE, '.cb-ev');
    expect(decl(ev, 'background')).toBe('none');
    expect(parseFloat(decl(ev, 'border')!)).toBe(0);
    expect(readFileSync(join(process.cwd(), 'src', 'ui', 'CombatBanner.tsx'), 'utf8')).toMatch(/className=\{`cb-ev [^`]*\bhalo-champ\b/);
    // Le ton se porte à l'ENCRE (plus de liseré ni de fond à teinter).
    for (const ton of ['.cb-tone-strong', '.cb-tone-grave']) {
      const bloc = ruleOf(BANNER_BASE, ton);
      expect(decl(bloc, 'color'), ton).toBeTruthy();
      expect(decl(bloc, 'background'), ton).toBeNull();
    }
  });

  // ── P-6 : LA FRISE ne déborde pas sur le pont (planche 2026-08-17 : plaque `[0,132,133,472]`,
  //    terminée nettement au-dessus du pont à y=863). Mesuré avant cette passe : 103,6 × 97,3px de
  //    recouvrement à 1280, points de frise par-dessus le pont au hit-test.
  //    Depuis #1848 la borne n'est plus une RÉSERVE mais un REPÈRE : la frise est une surface de la
  //    rangée du monde, qui s'arrête au bord haut du pont. Elle ne lit donc plus aucune hauteur de
  //    pont — ni au bord bas, ni dans la hauteur de sa piste.
  it('P-6 — la frise borne sa hauteur à la RANGÉE du monde, sans lire aucune hauteur de pont', () => {
    // La hauteur du pont est une grandeur PUBLIÉE au `:root`, dérivée de la hauteur de travée — donc du
    // seul côté d'alvéole. Personne, dans la frise, ne la lit.
    const racine = ruleOf(CC_BASE, ':root');
    expect(decl(racine, '--cc-deck-h')).toMatch(/var\(--cc-bay-h\)/);
    expect(decl(racine, '--cc-bay-h')).toMatch(/var\(--cc-cell-h\)/);
    expect(STRIP_BASE, 'la frise lit encore une hauteur de pont').not.toMatch(/--cc-deck-h|--xd-deck-h/);
    // La colonne est une surface de la RANGÉE : c'est l'écran qui l'y pose (`.stage-flot`), et son
    // bord bas réserve seulement le bandeau de phase, seule boîte qui déborde dans cette rangée.
    const strip = ruleOf(STRIP_BASE, '.initiative-strip');
    expect(decl(strip, 'bottom')).toMatch(/var\(--cc-phase-h\)/);
    expect(parseFloat(decl(strip, 'top')!)).toBeGreaterThanOrEqual(44); // norme: la frise part SOUS le coin du menu ☰, dont la cible au doigt fait 44px (charte UI règle 4)
    // La PISTE aussi : au-delà elle défile (aucune entrée ne disparaît, rien ne dépasse sur le pont).
    // Sa hauteur disponible se mesure sur le CONTENEUR (`cqh` = la rangée), que hud.css déclare.
    const tiles = ruleOf(STRIP_BASE, '.is-tiles');
    expect(decl(tiles, '--is-avail')).toMatch(/cqh/);
    expect(decl(ruleOf(HUD_BASE, '.stage > .stage-flot'), 'container-type'), 'la rangée n’est pas un conteneur de requête').toBe('size');
    expect(decl(tiles, 'max-height')).toMatch(/--is-avail/);
    expect(decl(tiles, 'overflow-y')).toBe('auto');
  });

  // ── P-7 : LE BANDEAU DE PHASE ET LA FRISE NE SE RECOUPENT JAMAIS. La colonne d'initiative est en
  //    z-index 45 contre 5 pour la console : tout ce qu'elle occupe de la bande de terrain passe
  //    PAR-DESSUS le bandeau. Mesuré à l'écran (sonde pixel de recette, 4 captures sur 4) : le titre
  //    perdait ses capitales et ses accents — « Bordée » se lisait « Bordee ». Deux causes, deux
  //    bornes ici : le bandeau était posé À CHEVAL sur le liseré (`bottom: calc(100% - 10px)`), et la
  //    réserve du bas de la frise ne connaissait que le pont.
  //    Le contrat est ARITHMÉTIQUE, dans les tokens déclarés : une hauteur de pont arbitraire suffit,
  //    seules les RELATIONS entre les deux boîtes sont jugées.
  it('P-7 — le bandeau de phase se pose AU-DESSUS du liseré, et la frise réserve sa hauteur', () => {
    // Le liseré est celui de la peau de bande : son épaisseur est un token du `:root` (base.css).
    const liseret = parseFloat(token('--pont-liseret'));
    expect(decl(ruleOf(COMPONENTS_BASE, '.skin-pont'), 'border-top')).toMatch(/var\(--pont-liseret\)/);
    expect(liseret).toBeGreaterThan(0);
    const P = parseFloat(decl(ruleOf(CC_BASE, ':root'), '--cc-phase-h')!);
    expect(P, 'hauteur de bandeau non publiée').toBeGreaterThan(0);
    // La réserve n'est pas une fiction : le bandeau TIENT la boîte qu'il fait réserver.
    const phase = ruleOf(CC_BASE, '.cc-phase');
    expect(decl(phase, 'min-height')).toBe('var(--cc-phase-h)');
    expect(decl(phase, 'box-sizing')).toBe('border-box');

    // Repère : distances au BAS du viewport. La BANDE occupe [0, D] (liseré compris) ; l'EMPREINTE
    // du pont y ajoute la saillie du fronton — c'est elle que `100%` mesure pour un enfant absolu de
    // la racine (#1848). Les chiffres sont arbitraires : seule la relation est jugée.
    const D = 240;
    const S = 60;
    const air = parseFloat(decl(racine(), '--cc-phase-air')!);
    const env = { '--cc-deck-h': D, '--cc-phase-h': P, '--cc-saillie': S, '--cc-phase-air': air, '100%': D + S };
    const basBandeau = pxCalc(decl(phase, 'bottom')!, env);
    expect(basBandeau, 'le bandeau redescend sur le liseré du pont').toBeGreaterThanOrEqual(D);
    const hautBandeau = basBandeau + P;
    // La frise se mesure depuis SA RANGÉE, dont le bord bas est le bord haut du pont — soit
    // l'EMPREINTE (bande + saillie) au-dessus du bas du viewport : conversion de repère, la frise ne
    // lit rien du pont et le bandeau reste dégagé par construction.
    const basFrise = (D + S) + pxCalc(decl(ruleOf(STRIP_BASE, '.initiative-strip'), 'bottom')!, env);
    expect(basFrise, 'la frise descend dans la bande du bandeau de phase').toBeGreaterThanOrEqual(hautBandeau);
    // La piste borne sa hauteur sur la MÊME réserve (sinon elle déborderait là où la boîte s'arrête).
    expect(decl(ruleOf(STRIP_BASE, '.is-tiles'), '--is-avail')).toMatch(/var\(--cc-phase-h\)/);

    // … et la RAMPE de débord suit la PLAQUE : la boîte de la frise épouse son contenu au lieu d'être
    // étirée jusqu'à la réserve (sonde B6 : 174px de terrain nu, puis 20px de bois dans le vide).
    const strip = ruleOf(STRIP_BASE, '.initiative-strip');
    expect(decl(strip, 'height')).toBe('fit-content');
    expect(decl(strip, 'margin-block')).toBe('auto');
    expect(decl(ruleOf(STRIP_BASE, '.initiative-strip::after'), 'bottom')).toBeTruthy();
  });
});

// ── ÉTAT DE CHARGE : la case G4 lit le REGISTRE de l'arme (`engine/weaponLoad`), jamais un champ du
//    porteur. Un pistolet et une arbalète tenus par le même héros ont chacun leur cycle (LDB 62 l.335).
/**
 * TROIS FORMES, UNE SEULE BANDE — la console rend le pont COMPLET, la forme SPECTATRICE ou
 * l'OUVERTURE ; la RÉSERVE de la bande, elle, est la même dans les trois (fiches
 * `.claude/memory/user-arbitrage-tour-adverse-console-spectatrice-jamais-pont-entier.md` et
 * `…/user-arbitrage-round0-forme-rt-et-splash-conserve.md`, 2026-08-24). C'est ce qui permet au
 * bandeau de phase de vivre au-dessus du liseré sans jitter.
 * La mise en page RENDUE (débord, hauteur réelle, recouvrements) se mesure au navigateur —
 * `scripts/recette/console-pont-formes.mjs` : jsdom ne fait pas de layout, ces contrats-ci ne
 * jugent que ce que le CSS DÉCLARE.
 */
describe('CombatConsole — trois formes, une seule bande', () => {
  /** Les trois formes, montées pour de vrai. */
  function formes() {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    const e = foe('e1', 9, 9);
    const releve = () => {
      const pont = host.querySelector('.combat-console')!;
      return {
        forme: pont.getAttribute('data-forme'),
        cases: host.querySelectorAll('.cc-cell').length,
        regions: host.querySelectorAll('.cc-dock > *').length,
        arches: host.querySelectorAll('.cc-arch').length,
      };
    };
    monter(h, { foes: [e] });
    const complete = releve();
    monter(h, { foes: [e], turn: 1 });
    const spectatrice = releve();
    act(() => { useGame.setState({ pendingRoundStart: { round: 1, readyBySeat: {} } as never }); });
    const ouverture = releve();
    act(() => { useGame.setState({ pendingRoundStart: null }); });
    return { complete, spectatrice, ouverture };
  }

  it('la FORME dit l’état : la bande et ses cases quand ce siège joue, l’arche SEULE sinon', () => {
    const { complete, spectatrice, ouverture } = formes();
    expect(complete.forme).toBe('complete');
    expect(complete.cases).toBeGreaterThan(0);
    expect(complete.regions, 'les quatre régions du pont complet').toBe(4);
    expect(complete.arches).toBe(1);
    // Forme spectatrice ET ouverture : UNE seule région dans la bande, l'arche — et rien qu'elle.
    for (const f of [spectatrice, ouverture]) {
      expect(f.forme).toBe('spectatrice');
      expect(f.cases).toBe(0);
      expect(f.regions).toBe(1);
      expect(f.arches).toBe(1);
    }
  });

  it('la RÉSERVE de bande est déclarée UNE fois, en PLANCHER, et aucune forme ne la reprend', () => {
    // PLANCHER (`min-height`), jamais couperet : une hauteur imposée AMPUTAIT le pont dès que son
    // contenu réel dépassait la réserve (mesuré : nom du héros 9px hors écran, plaque de sortie
    // 7px, travée droite 17px à 900×800). La réserve, elle, est la même dans les trois formes.
    // La bande réserve la hauteur du pont MOINS son liseré (que la peau porte) : relation évaluée.
    const liseret = parseFloat(token('--pont-liseret'));
    expect(evalLen(decl(ruleOf(CC_BASE, '.cc-dock'), 'min-height')!, 1920, 1080), 'le plancher de bande n’est plus la réserve moins le liseré')
      .toBe(evalLen('var(--cc-deck-h)', 1920, 1080) - liseret);
    expect(decl(ruleOf(CC_BASE, '.cc-dock'), 'height'), 'une hauteur imposée ampute').toBeNull();
    expect(decl(ruleOf(CC_BASE, '.combat-console'), 'height'), 'une hauteur imposée ampute').toBeNull();
    // AUCUNE règle keyée sur une FORME ne touche à une grandeur de hauteur : c'est ce qui garantit
    // que les deux formes se superposent au pixel. Une mutation qui poserait `height: auto` sur une
    // forme rougirait ici.
    for (const bloc of [...CC_CSS.matchAll(/\[data-forme[^{]*\{([^}]*)\}/g)]) {
      for (const p of ['height', 'min-height', 'max-height', 'padding-top', 'padding-bottom']) {
        expect(decl(bloc[1], p), `une forme règle « ${p} » : le pont bat d’une forme à l’autre`).toBeNull();
      }
    }
    // La forme spectatrice ÉTEINT la matière de la bande sans toucher à sa BOÎTE : c'est ce qui rend
    // l'arche immobile au pixel (une bordure retirée faisait sauter le pont de 3px, mesuré à 1707).
    // Le LISERÉ n'y perd que sa teinte, jamais son épaisseur.
    const eteinte = ruleOf(CC_BASE, ".combat-console[data-forme='spectatrice'] > .cc-dock");
    expect(decl(eteinte, 'border-top-color'), 'le liseré éteint garde sa place').toBe('transparent');
    expect(decl(eteinte, 'border-top-width'), 'une épaisseur de liseré réglée par une forme').toBeNull();
    expect(decl(eteinte, 'box-shadow')).toBe('none');
    expect(decl(eteinte, 'background-image')).toBe('none');
  });

  it('le bandeau d’OUVERTURE s’ancre sur des grandeurs DÉCLARÉES, jamais sur un nombre sans origine', () => {
    // Le recouvrement se juge sur des BOÎTES RENDUES, que jsdom ne calcule pas : c'est
    // `scripts/recette/console-pont-formes.mjs` qui refuse tout chevauchement de la bande de groupe,
    // de la frise, du rail, du fil et du pont — à six largeurs, dans les trois formes.
    // ANGLE MORT DÉCLARÉ de ce contrat-ci : il ne juge que l'ANCRAGE déclaré.
    // Au-delà de 900, le bandeau se pose en haut du champ, sous la zone haute.
    const ouv = ruleOf(CC_BASE, ".cc-phase[data-phase='ouverture']");
    expect(decl(ouv, 'top')).toBe('var(--cc-ouverture-top)');
    expect(decl(ouv, 'bottom')).toBe('auto');
    expect(centrage(ouv), 'le bandeau d’ouverture n’est pas centré en largeur').toBe('axe X');
    expect(parseFloat(decl(ruleOf(CC_BASE, ':root'), '--cc-ouverture-top')!)).toBeGreaterThan(0);
    // Cette position tient jusqu'à 701px inclus (mesuré libre de tout recouvrement à 901, 900, 800
    // et 701). Sous 700 SEULEMENT — là où la frise quitte sa colonne pour une bande haute et où le
    // fil monte en haut du champ — il descend au bas du champ. Enfant du CHAMP et non du pont, il
    // vit dans la RANGÉE DU MONDE (#1848) : il n'a plus aucune hauteur de pont à relire.
    expect(mediaBlock(CC_CSS, '@media (max-width: 900px)'), 'la tranche 700-900 n’est pas contrainte : le bandeau y garde le haut')
      .not.toContain("data-phase='ouverture'");
    const ouv700 = ruleOf(mediaBlock(CC_CSS, '@media (max-width: 700px)'), ".cc-phase[data-phase='ouverture']");
    expect(decl(ouv700, 'top')).toBe('auto');
    expect(decl(ouv700, 'bottom')).not.toContain('var(--cc-deck-h)');
    expect(decl(ruleOf(CC_BASE, '.stage > .cc-phase'), 'grid-area'), 'le bandeau du champ n’est pas dans la rangée du monde').toBeTruthy();
    // … et le fil de combat non plus : les deux se rangent dans le même repère.
    expect(decl(ruleOf(BANNER_BASE, '.combat-feed'), 'bottom')).not.toContain('var(--cc-deck-h)');
  });

  it('la forme SPECTATRICE ne publie AUCUN slot au pont clavier (pas de touche sans case)', () => {
    // Contrat de `hotbarBridge` : la console publie ses cases VISIBLES. En forme spectatrice il n'y
    // a plus une seule case à l'écran — une touche encore branchée y tirerait sur une affordance
    // invisible (seul le verdict d'offre du registre l'en empêchait).
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    const e = foe('e1', 9, 9);
    monter(h, { foes: [e] });
    expect(hotbar.capacites.length, 'témoin : le pont complet publie ses cases').toBeGreaterThan(0);
    monter(h, { foes: [e], turn: 1 });
    expect(host.querySelector('.combat-console')!.getAttribute('data-forme')).toBe('spectatrice');
    expect(hotbar.capacites, 'des touches restent branchées sur un pont sans case').toEqual([]);
    // … et à l'ouverture non plus (le pont y est l'arche seule).
    monter(h, { foes: [e] });
    act(() => { useGame.setState({ pendingRoundStart: { round: 1, readyBySeat: {} } as never }); });
    expect(hotbar.capacites).toEqual([]);
    act(() => { useGame.setState({ pendingRoundStart: null }); });
  });

  it('la sonde de RECETTE du pont existe et mesure les trois formes aux largeurs canon', () => {
    // Un contrat de mise en page sans mesure de rendu est aveugle : le script qui la porte doit
    // exister, être exécutable, et couvrir les largeurs de la charte.
    const sonde = readFileSync(join(process.cwd(), 'scripts', 'recette', 'console-pont-formes.mjs'), 'utf8');
    for (const w of [900, 700, 560]) expect(sonde, `largeur canon ${w} non sondée`).toContain(String(w));
    // Les vues JUGÉES (dont le mobile) ne s'écrivent pas dans la sonde : elle les lit à leur source.
    expect(sonde, 'la sonde ne lit plus les vues de recette à leur source unique').toContain('VUES_RECETTE');
    const vues: { largeur: number }[] = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'recette', 'vues-recette.json'), 'utf8'));
    expect(vues.some((v) => v.largeur <= 360), 'aucune vue mobile (≤ 360px) à la source des vues').toBe(true);
    expect(sonde).toContain('scrollHeight');
    expect(sonde).toContain('data-forme');
    // Elle mesure la bande RENDUE contre la bande DÉCLARÉE, les recouvrements du pont, et elle sait
    // se RÉFUTER (`--stress` : le contenu de l'arche dérive, la sonde doit rougir).
    expect(sonde).toContain('deckDeclare');
    expect(sonde).toContain('pontSurFil');
    expect(sonde).toContain('SONDE AVEUGLE');
  });
});

describe('CombatConsole — case Recharger : le porteur de l’état est l’ARME', () => {
  /** Arme à distance NUE (sans `uid`) : son registre de charge est l'instance d'arme elle-même. */
  function pistolet(load: Partial<Weapon>): Weapon {
    return { label: 'Pistolet', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 20, reload: 3, qualities: [], ...load } as Weapon;
  }

  it('affiche la progression du Test étendu portée par l’ARME et allume la case tant qu’elle est déchargée', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    h.weapons = [pistolet({ loaded: false, reloadProgress: 2 })];
    monter(h);
    const cell = host.querySelector('[data-cell="g4-recharger"]')!;
    expect(cell.querySelector('.cc-lbl')!.textContent).toBe('Recharger 2/3');
    expect(cell.classList.contains('on')).toBe(true);
  });

  it('une progression posée sur le COMBATTANT n’est pas lue : arme chargée = case éteinte, libellé nu', () => {
    const h = hero('h2', 'Gunnar');
    h.conditions = [];
    h.weapons = [pistolet({ loaded: true })];
    Object.assign(h, { loaded: false, reloadProgress: 2 });
    monter(h);
    const cell = host.querySelector('[data-cell="g4-recharger"]')!;
    expect(cell.querySelector('.cc-lbl')!.textContent).toBe('Recharger');
    expect(cell.classList.contains('on')).toBe(false);
  });
});

// ── TRAVÉE GAUCHE : la COMPOSITION de la planche USER 2026-08-17 (spec §1c-bis) ──────────────────
// Colonne latérale de SETS (le commutateur EST la colonne) · 2×3 cases (haute DÉDUITE du set au
// poing, basse LIBRE) · rubrique ACCÈS RAPIDE 2×2. Les fixtures sont de VRAIS objets du catalogue
// (`itemFromTrappingById`) montés par la dérivation réelle (`recomputeLoadout`) : aucune arme forgée.
describe('CombatConsole — travée gauche : sets, gestes déduits, accès rapide', () => {
  /** Objet du CATALOGUE, uid stable pour que les sets le désignent. */
  function objet(id: string, uid: string, over: Partial<ItemInstance> = {}): ItemInstance {
    const it = itemFromTrappingById(id);
    expect(it, `catalogue : « ${id} » absent`).not.toBeNull();
    return Object.assign(it!, { uid }, over);
  }

  /** Héros à DEUX sets : dague au poing, arbalète lourde (Recharge 2) au second. */
  function deuxSets(opts: { loaded?: boolean; reloadProgress?: number; actif?: string } = {}) {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    h.items = [
      objet('dague', 'i-dague'),
      objet('arbalete-lourde', 'i-arb', { loaded: opts.loaded ?? false, reloadProgress: opts.reloadProgress ?? 1 }),
    ];
    h.loadouts = [{ id: 'lo-melee', main: 'i-dague' }, { id: 'lo-tir', main: 'i-arb' }];
    h.activeLoadoutId = opts.actif ?? 'lo-melee';
    recomputeLoadout(h);
    return h;
  }

  // Une alvéole/vignette porteuse de règle est ENVELOPPÉE par son `CodexRef` : on cible la case elle-même,
  // pas l'enfant direct de la piste (qui peut être l'enveloppe).
  const vignettes = () => [...host.querySelectorAll('.cc-sets .cc-set')];
  const casesGauche = () => [...host.querySelectorAll('.cc-grid-left .cc-cell')];
  const casesRapide = () => [...host.querySelectorAll('.cc-grid-quick .cc-cell')];

  it('(a) dessine la COLONNE de sets — compte constant, set au poing en relief, en-tête = son libellé', () => {
    const h = deuxSets();
    monter(h);
    // Trois emplacements TOUJOURS dessinés (deux sets + un vide), et le compte ne dépend pas du porteur.
    expect(vignettes().length).toBe(3);
    expect(vignettes().filter((v) => v.classList.contains('cc-empty')).length).toBe(1);
    expect(vignettes().map((v) => v.classList.contains('on'))).toEqual([true, false, false]);
    // En-tête de travée = le SET AU POING, libellé DÉRIVÉ de son contenu par le moteur.
    const head = host.querySelector('.cc-bay-head')!;
    expect(head.textContent).toBe(loadoutLabel(h.loadouts![0], h));
    // Un acteur SANS set (statbloc de créature) garde les trois emplacements : géométrie immuable.
    const nu = hero('h2', 'Gunnar');
    nu.conditions = [];
    nu.loadouts = [];
    monter(nu);
    expect(vignettes().length).toBe(3);
    expect(vignettes().filter((v) => v.classList.contains('cc-empty')).length).toBe(3);
  });

  it('(a bis) l’état de charge d’un set est lu sur l’ARME, en MOT ENTIER, y compris pour le set NON tenu', () => {
    const h = deuxSets({ loaded: false });
    // L'état vient bien du registre de l'arme (l'objet possédé), pas d'un champ du porteur.
    const arb = h.items!.find((i) => i.uid === 'i-arb')!;
    expect(weaponLoaded(h, { ...arb, type: 'ranged', reload: 2 } as unknown as Weapon)).toBe(false);
    monter(h);
    const tir = host.querySelector('[data-set="lo-tir"]')!;
    // Un MOT ENTIER, jamais une abréviation tronquée (« déch. » : grief vision 2026-08-17).
    const mot = tir.querySelector('.cc-set-load')!.textContent!;
    expect(mot).toBe('VIDE');
    expect(mot, 'un mot abrégé/tronqué n’est pas du texte joueur').not.toMatch(/[.…]/);
    // Le SET est nommé accessiblement (le libellé ne tient pas dans la vignette) — jamais par un title.
    expect(tir.getAttribute('aria-label')).toBe(loadoutLabel(h.loadouts![1], h));
    expect(tir.getAttribute('title'), 'infobulle native proscrite sur une vignette').toBeNull();
    // Le set de MÊLÉE n'a pas de cycle de charge : aucune mention.
    expect(host.querySelector('[data-set="lo-melee"]')!.querySelector('.cc-set-load')).toBeNull();

    // Arme CHARGÉE : la mention disparaît (c'est l'état de l'arme qui parle, pas la présence d'un set).
    const charge = deuxSets({ loaded: true });
    monter(charge);
    expect(host.querySelector('[data-set="lo-tir"]')!.querySelector('.cc-set-load')).toBeNull();
  });

  it('(b) rangée DÉDUITE d’un set ARMÉ : aucune case d’Empoignade (LDB 14 l.155), rangée basse VIDE', () => {
    const h = deuxSets();
    monter(h);
    // 2×3 : rangée haute = les gestes pertinents pour CE set (une dague en ouvre deux : frapper,
    // charger), rangée basse VIDE — et toute case non pertinente est DESSINÉE, pas absente.
    expect(casesGauche().length).toBe(6);
    const basse = casesGauche().slice(3);
    expect(basse.every((c) => c.classList.contains('cc-empty'))).toBe(true);
    // L'alvéole vide est un CREUX MUET : aucun mot n'y est gravé (arbitrage user 2026-08-24, « je ne
    // connais aucune interface […] qui dans les emplacement de capacité met "Libre" »).
    for (const l of casesGauche().filter((c) => c.classList.contains('cc-empty'))) {
      expect(l.querySelector('.cc-lbl'), 'une case vide ne porte aucun libellé').toBeNull();
      expect(texteVisible(l).trim(), 'une case vide n’écrit rien à l’écran').toBe('');
    }
    // L'Empoignade est une option du combat à MAINS NUES : elle n'est pas un geste d'arme.
    const labels = casesGauche().map((c) => c.querySelector('.cc-lbl')?.textContent ?? '');
    expect(labels.some((l) => /Empoign/i.test(l))).toBe(false);
    expect(host.querySelector('[data-cell="g6-geste-arme"]')).toBeNull();
    // … et ce qui est déduit du set de mêlée l'est bien : l'attaque de l'arme tenue + la Charge.
    expect(casesGauche()[0].getAttribute('data-cell')).toBe('g1-attaque');
    expect(casesGauche()[0].querySelector('.cc-lbl')!.textContent).toBe('Dague');
    expect(casesGauche().map((c) => c.getAttribute('data-cell'))).toContain('g2-charge');

    // SET DE TIR au poing : la rangée CHANGE avec le set — le cycle de charge de l'arme y entre, avec sa
    // progression, et la Charge n'y est plus déduite (aucune arme de mêlée AU SET : les Mains nues
    // implicites de `c.weapons` ne comptent pas). Elle reste un geste par défaut de la grille.
    const tir = deuxSets({ actif: 'lo-tir', reloadProgress: 1 });
    monter(tir);
    const dataCells = casesGauche().map((c) => c.getAttribute('data-cell'));
    expect(dataCells).toContain('g4-recharger');
    expect(dataCells, 'set de tir pur : la Charge n’y a rien à faire').not.toContain('g2-charge');
    expect(host.querySelector('[data-cell="g4-recharger"] .cc-lbl')!.textContent).toBe('Recharger 1/2');
  });

  it('(c) ACCÈS RAPIDE : consommables GROUPÉS ×N + Soigner, cases restantes dessinées VIDES', () => {
    const h = deuxSets();
    h.wounds = { current: 5, max: 12 }; // blessé → cible soignable (moteur `healableTargets`)
    h.skills = [...(h.skills ?? []), { id: 'guerison', advances: 10 } as never];
    h.items = [...h.items!, objet('potion-de-guerison', 'i-po1'), objet('potion-de-guerison', 'i-po2')];
    monter(h);
    expect(casesRapide().length).toBe(4);
    const labels = casesRapide().map((c) => c.querySelector('.cc-lbl')?.textContent ?? '');
    // Deux potions IDENTIQUES = UNE case à compteur (jamais deux cases du même objet).
    expect(labels.filter((l) => l.startsWith('Potion de guérison')).length).toBe(1);
    expect(labels).toContain('Potion de guérison ×2');
    expect(labels).toContain('Soigner');
    // Les deux restantes sont dessinées, et MUETTES : une alvéole vide ne nomme rien (2026-08-24).
    expect(casesRapide().filter((c) => c.classList.contains('cc-empty')).length).toBe(2);
    expect(casesRapide().filter((c) => texteVisible(c).trim() === '').length).toBe(2);
    // La case d'objet est BRANCHÉE (elle consomme l'objet réel du store), pas une maquette.
    const potion = casesRapide().find((c) => (c.querySelector('.cc-lbl')?.textContent ?? '').startsWith('Potion'))!;
    expect(potion.classList.contains('cc-inert')).toBe(false);

    // Rubrique nommée, et le compte de cases ne dépend PAS du contenu (héros sans rien).
    expect([...host.querySelectorAll('.cc-bay-head')].map((e) => e.textContent)).toContain('ACCÈS RAPIDE');
    const nu = deuxSets();
    monter(nu);
    expect(casesRapide().length).toBe(4);
    expect(casesRapide().filter((c) => c.classList.contains('cc-empty')).length).toBe(4);
  });

  // L'ADRESSE D'UN CONSOMMABLE EST CELLE DE SON MODÈLE, pas de l'instance : la case se déclare
  // `q-objet-<trappingId>`. Boire une potion consomme un `uid` — l'adresse posée par le joueur, elle,
  // ne bouge pas d'un rang. Une adresse bâtie sur l'`itemUid` d'args mourrait à la première gorgée.
  it('(c-bis) l’adresse d’un consommable SURVIT à la consommation d’une instance', () => {
    const avecPotions = (uids: string[]) => {
      const h = deuxSets();
      h.wounds = { current: 5, max: 12 };
      h.skills = [...(h.skills ?? []), { id: 'guerison', advances: 10 } as never];
      h.items = [...h.items!, ...uids.map((u) => objet('potion-de-guerison', u))];
      // Le joueur a posé SA potion au 3ᵉ rang de l'accès rapide.
      h.barre = { accesRapide: { 2: { actionId: 'use-item', cle: 'q-objet-potion-de-guerison' } } };
      return h;
    };
    monter(avecPotions(['i-po1', 'i-po2']));
    const rangs = () => casesRapide().map((c) => c.getAttribute('data-cell'));
    expect(rangs()[2], 'la potion ne s’est pas rendue à l’adresse posée').toBe('q-objet-potion-de-guerison');
    expect(casesRapide()[2].querySelector('.cc-lbl')!.textContent).toBe('Potion de guérison ×2');

    // … une gorgée plus tard : l'instance de tête a disparu du sac (c'est CE `uid` que les args
    // publiaient). La case reste à SON rang, avec un compteur de moins.
    monter(avecPotions(['i-po2']));
    expect(rangs()[2], 'l’adresse a suivi l’uid consommé au lieu du modèle').toBe('q-objet-potion-de-guerison');
    expect(casesRapide()[2].querySelector('.cc-lbl')!.textContent).toBe('Potion de guérison');
    expect(rangs()[0], 'la potion a repeuplé le rang 0 : l’adresse posée a été perdue').not.toBe('q-objet-potion-de-guerison');
  });
});

// ── VERDICTS DU JUGE VISION 2026-08-17 (2ᵉ passe) promus en contrats ─────────────────────────────────
// Les sondes de ce bloc jugent : le DROIT (un geste déduit ne tombe plus, la Charge suit le RAW, le coin
// dit l'état vrai du tour et garde le 2ᵉ clic, le clavier publie la travée gauche), puis le MICRO-RENDU
// (contraste et HIÉRARCHIE des encres, hauteur du pont invariante, icône par arme, une grammaire de case
// vide, lisibilité des vignettes, MATIÈRE UNIQUE du pont).
describe('CombatConsole — droit de la travée et du coin (juge vision 2026-08-17)', () => {
  function objet(id: string, uid: string, over: Partial<ItemInstance> = {}): ItemInstance {
    const it = itemFromTrappingById(id);
    expect(it, `catalogue : « ${id} » absent`).not.toBeNull();
    return Object.assign(it!, { uid }, over);
  }

  /** Arbalétrier : arbalète lourde (Recharge) SEULE au set, ses carreaux au sac. */
  function arbaletrier(opts: { ammo?: boolean } = {}) {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    h.items = [objet('arbalete-lourde', 'i-arb', { loaded: false, reloadProgress: 0 })];
    if (opts.ammo) h.items.push(objet('carreau', 'i-carreaux'));
    h.loadouts = [{ id: 'lo-tir', main: 'i-arb' }];
    h.activeLoadoutId = 'lo-tir';
    recomputeLoadout(h);
    return h;
  }

  const casesGauche = () => [...host.querySelectorAll('.cc-grid-left .cc-cell')];
  const cellKeys = () => casesGauche().map((c) => c.getAttribute('data-cell'));

  /** Set d'une seule arme du catalogue, au poing. */
  function unSet(trappingId: string, opts: Partial<ItemInstance> = {}) {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    h.items = [objet(trappingId, 'i-1', opts)];
    h.loadouts = [{ id: 'lo-1', main: 'i-1' }];
    h.activeLoadoutId = 'lo-1';
    recomputeLoadout(h);
    return h;
  }

  /** Set MAINS NUES : une panoplie déclarée, aucune arme portée. */
  function poings() {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    h.items = [];
    h.loadouts = [{ id: 'lo-poings' }];
    h.activeLoadoutId = 'lo-poings';
    recomputeLoadout(h);
    return h;
  }

  /** Set MIXTE : lame en main principale, PISTOLET (Recharge 1) en main gauche — les deux cases
   *  coexistent (deux armes à UNE main : `recomputeLoadout` garde bien les deux). */
  function mixte() {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    h.items = [objet('dague', 'i-ep'), objet('pistolet', 'i-arb', { loaded: false, reloadProgress: 0 })];
    h.loadouts = [{ id: 'lo-mixte', main: 'i-ep', off: 'i-arb' }];
    h.activeLoadoutId = 'lo-mixte';
    recomputeLoadout(h);
    return h;
  }

  // Défaut mesuré : `deduced.slice(0, 3)` faisait TOMBER la posture de tir (G5) d'une arbalète, alors que
  // la spec §1a en fait le SEUL accès. Le débord garnit la rangée libre.
  it('D-1 — arbalète lourde seule : TOUS les gestes déduits sont visibles, G5 posture comprise', () => {
    monter(arbaletrier());
    expect(casesGauche().length).toBe(6);
    const keys = cellKeys();
    for (const k of ['g1-attaque', 'g4-recharger', 'g3-viser', 'g5-posture', 'g5-posture-tas']) {
      expect(keys, `geste ${k} tombé hors de la travée`).toContain(k);
    }
    // Un set de TIR PUR ne déduit PAS la Charge (arbitrage user 2026-08-17 : un Test de Corps à corps
    // n'est pas le geste d'une arbalète). Elle reste un geste par défaut de la grille de capacités.
    expect(keys, 'set de tir pur : aucune Charge déduite').not.toContain('g2-charge');
    // Les cases restantes sont dessinées LIBRES : le compte ne bouge pas (5 gestes déduits pour ce set —
    // attaque, recharge, visée et les DEUX postures de tir — sur 6 alvéoles).
    expect(casesGauche().filter((c) => c.classList.contains('cc-empty')).length).toBe(1);
    // La 4ᵉ case (1ʳᵉ de la rangée basse) porte bien un geste du débord, pas un trou.
    expect(casesGauche()[3].getAttribute('data-cell')).toBeTruthy();
  });

  // G5 — la posture de tir est une action VIVANTE (spec §1a G5) : la case EST le seul contrôle du
  // choix pré-jet, elle l'écrit dans `battle.stances`, et une fois le Mouvement entamé elle dit
  // POURQUOI elle ne sert plus (`LDB 14 l.70`).
  it('D-1ter — la case G5 arme la POSTURE dans le store, se rallume, et porte sa raison de gate', () => {
    monter(arbaletrier());
    const case5 = () => host.querySelector('[data-action="posture-tir"]') as HTMLButtonElement;
    expect(case5(), 'la case de posture est rendue').toBeTruthy();
    expect(case5().disabled, 'arme de tir en main, Mouvement intact : la case est active').toBe(false);

    act(() => case5().click());
    expect(useGame.getState().battle!.stances?.['h1']?.heldGround, 'le clic ARME la posture').toBe(true);
    expect(case5().classList.contains('on'), 'la case allumée dit que la posture est tenue').toBe(true);

    act(() => case5().click());
    expect(useGame.getState().battle!.stances?.['h1']?.heldGround, 're-clic : la posture tombe').toBe(false);
    expect(case5().classList.contains('on')).toBe(false);

    act(() => { useGame.setState({ battle: { ...useGame.getState().battle!, movementUsed: 1 } }); });
    expect(case5().hasAttribute('data-gated'), 'Mouvement entamé : la case reste dessinée, gatée').toBe(true);
    expect(case5().textContent, 'la raison est en TEXTE dans l’alvéole, jamais dans un title').toContain('Mouvement déjà entamé ce tour');
  });

  // Prédicat de la Charge (`LDB 15 l.35` / `LDB 13 l.90`) : une arme de mêlée DU SET, ou le set mains
  // nues. Jamais l'arme que le moteur préférerait hors d'Allonge (`attackWeapon`, préférence distance),
  // jamais les Mains nues implicites que `recomputeLoadout` laisse dans `c.weapons`.
  it('D-2 — la Charge se déduit du CORPS À CORPS du set (mêlée ou mains nues), et se gate sur l’Engagement', () => {
    // (i) tir pur → absente (cf. D-1) ; (ii) set de mêlée → présente.
    monter(unSet('dague'));
    expect(cellKeys(), 'set de mêlée : la Charge se déduit').toContain('g2-charge');
    expect(host.querySelector('[data-cell="g2-charge"]')!.hasAttribute('data-gated')).toBe(false);

    // (iii) set MAINS NUES → présente (le bagarreur la mérite).
    monter(poings());
    expect(cellKeys(), 'set mains nues : la Charge se déduit').toContain('g2-charge');

    // (iv) set MIXTE lame+pistolet → les deux cases coexistent, chacune ENVELOPPÉE par le popover de SA
    // fiche (`CodexRef wrap`) : c'est là que vit le texte de règle, en verbatim, jamais dans un `title`.
    monter(mixte());
    const keys = cellKeys();
    expect(keys).toContain('g2-charge');
    expect(keys).toContain('g4-recharger');
    // Les textes attendus sont LUS DANS LA DONNÉE (aucune chaîne de règle recopiée dans ce test) : c'est
    // le contrat « le texte de règle affiché est du verbatim recollable dans `Source/` » (CLAUDE.md 5).
    const fiche = regles.find((r) => r.id === 'charger')!;
    const qualite = findQualityById('recharge')!;
    expect(fiche.desc.length, 'la fiche regles/charger doit porter son verbatim').toBeGreaterThan(80);
    expect(qualite.desc, 'la qualité recharge doit porter son verbatim').toBeTruthy();
    const popCharge = survol('g2-charge');
    const popRech = survol('g4-recharger');
    expect(popCharge.title).toBe(fiche.label);
    expect(popCharge.body).toBe(verbatimAttendu(fiche.desc));
    // Le corps est BORNÉ par la primitive : la porte vers la fiche complète doit donc être là.
    expect(popCharge.porte, 'verbatim borné sans porte vers la fiche').toBe('Ouvrir la fiche');
    expect(popCharge.source, 'la source de la règle se lit au popover').toContain('165');
    expect(popRech.title).toBe(qualite.label);
    expect(popRech.body).toBe(verbatimAttendu(qualite.desc!));
    expect(popCharge.body, 'deux gestes, deux verbatims').not.toBe(popRech.body);
    // Aucun `title` natif nulle part sur ces deux cases.
    for (const k of ['g2-charge', 'g4-recharger']) {
      expect(host.querySelector(`[data-cell="${k}"]`)!.getAttribute('title')).toBeNull();
    }

    // GATE : héros Engagé → la case reste DESSINÉE et PROPRE — sa raison ne se grave PAS sous son nom
    // (arbitrage user 2026-08-24), elle naît au SURVOL dans la MÊME infobulle que sa règle (une seule
    // boîte par ancrage), et le lecteur d'écran la reçoit par `aria-describedby`.
    const engage = unSet('dague');
    engage.engagedWith = ['e1'];
    monter(engage, { foes: [foe('e1', 5, 6)] });
    const gate = host.querySelector('[data-cell="g2-charge"]')!;
    expect(gate, 'la case doit rester DESSINÉE (géométrie constante)').not.toBeNull();
    expect(gate.hasAttribute('data-gated')).toBe(true);
    expect(texteVisible(gate), 'aucune raison ne doit être gravée dans l’alvéole').not.toContain('Engagé');
    const copie = gate.querySelector('.hors-ecran[data-gate]');
    expect(copie, 'la copie accessible de la raison doit rester au DOM').not.toBeNull();
    expect(copie!.textContent).toContain('Engagé');
    expect(gate.getAttribute('aria-describedby')).toBe(copie!.id);
    expect(gate.getAttribute('title')).toBeNull();
    const popGate = survol('g2-charge');
    expect(popGate.refus, 'la raison se lit au survol').toContain('Engagé');
    expect(popGate.body, 'la même boîte porte encore le verbatim de la règle').toBe(verbatimAttendu(fiche.desc));
    expect(quitterRefus(gate), 'l’infobulle meurt quand le pointeur s’en va').toBeNull();
    expect(refusAuFocus(gate as HTMLElement), 'le FOCUS (clavier, manette) l’ouvre aussi').toContain('Engagé');
    expect(casesGauche().length).toBe(6);
  });

  // Coin de sortie : la ternaire d'origine n'affichait « Action intacte » que pour un héros INCAPABLE
  // d'agir (Surpris → `canTakeAction` faux) — l'avertissement ne sortait donc jamais quand il servait.
  it('D-3 — le coin dit l’état VRAI du tour : Action non dépensée · Tour fini · sa touche', () => {
    const note = () => host.querySelector('.cc-end .cc-key')!.textContent;
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h);
    expect(note(), 'Action non dépensée et utilisable : l’avertissement doit sortir').toBe('Action non dépensée');

    const agi = hero('h2', 'Gunnar');
    agi.conditions = [];
    monter(agi);
    act(() => {
      const b = useGame.getState().battle!;
      useGame.setState({ battle: { ...b, acted: true } });
    });
    expect(note()).toBe('Tour fini');

    // Surpris (`etats.json` : `gating.action = 'none'`) : rien à dépenser, donc aucun reproche — la
    // plaque imprime SA touche.
    const surpris = hero('h3', 'Gunnar');
    surpris.conditions = [{ id: 'surpris', value: 1 }] as ConditionInstance[];
    monter(surpris);
    expect(note()).toBe('ESPACE');
  });

  it('D-4 — garde-fou 2 clics : le 1ᵉʳ ARME la plaque (rien ne se passe), le 2ᵉ finit le tour', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h, { foes: [foe('e1', 9, 9)] });
    const plaque = () => host.querySelector('.cc-end') as HTMLButtonElement;
    expect(useGame.getState().battle!.turn).toBe(0);
    expect(plaque().hasAttribute('data-armed')).toBe(false);

    act(() => plaque().click());
    // 1ᵉʳ clic : armement VISIBLE, tour intact.
    expect(plaque().hasAttribute('data-armed'), 'le 1ᵉʳ clic doit ARMER, pas finir').toBe(true);
    expect(host.querySelector('.cc-end .cc-key')!.textContent).toBe('Finir quand même ?');
    expect(host.querySelector('.cc-end .cc-lbl')!.textContent).toBe('Finir quand même');
    expect(useGame.getState().battle!.turn).toBe(0);

    act(() => plaque().click());
    // 2ᵉ clic : le tour passe pour de vrai (le moteur avance l'ordre).
    expect(useGame.getState().battle!.turn).not.toBe(0);
  });

  // La touche suit la CASE, pas l'action (spec HUD zone 8) : le pont publie CHAQUE ZONE par adresse,
  // trous compris, et les touches 1-8 sont les 8 premiers rangs de la GRILLE. Un rang vide ou fermé ne
  // glisse pas au voisin. Chaque rang publié porte son `actionId` : aucune closure anonyme (zone 12).
  it('D-5 — le pont publie chaque zone PAR ADRESSE (trous compris), et la touche d’un rang de grille exécute CE rang', () => {
    hotbar.capacites = [];
    const h = arbaletrier();
    monter(h);
    // Travée gauche : ses cases se rendent à LEUR rang… et ne portent AUCUN badge — les chiffres
    // sont ceux de la grille (spec zone 8), et le pont ne publie que la zone dont on lit les rangs.
    const arsenal = [...host.querySelectorAll('.cc-grid-left .cc-cell')];
    expect(arsenal.length, 'l’arsenal garde sa géométrie entière').toBe(6);
    expect(arsenal.map((c) => c.getAttribute('data-action')).slice(0, 4)).toEqual(['attaque', 'reload', 'aim', 'posture-tir']);
    expect(host.querySelector('[data-cell="g4-recharger"] .cc-key'), 'un chiffre sur la travée gauche').toBeNull();
    // La POSTURE de tir n'est plus une maquette (spec §1a G5) : branchée, elle mord au clic.
    const posture = host.querySelector('[data-cell="g5-posture"]') as HTMLButtonElement;
    expect(posture.className).not.toContain('cc-inert');
    act(() => posture.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(useGame.getState().battle!.stances?.[h.id]?.heldGround, 'le rang 4 de la travée n’a pas armé la posture').toBe(true);
    // GRILLE : le rang N porte le badge N (1-8), et la touche exécute LE RANG — pas la N-ième branchée.
    const grille = [...host.querySelectorAll('.cc-grid-right .cc-cell')];
    expect(hotbar.capacites.length, 'la grille de capacités est publiée à sa géométrie entière').toBe(12);
    for (let i = 0; i < 8; i++) {
      const badge = grille[i].querySelector('.cc-key');
      // Une case REFUSÉE éteint son badge (elle ne promet pas une touche morte) ; toute autre l'imprime.
      if (grille[i].hasAttribute('data-gated')) continue;
      expect(badge?.textContent, `rang ${i + 1} de la grille sans son chiffre`).toBe(String(i + 1));
    }
    expect(grille[8].querySelector('.cc-key'), 'les rangs 9-12 n’ont pas encore de touche (spec zone 8)').toBeNull();
    // Le rang de « Se défendre » exécute bien CETTE case (même `run` que le clic).
    const rang = hotbar.capacites.findIndex((s) => s?.actionId === 'defend');
    expect(rang, 'aucune case Se défendre publiée à la grille').toBeGreaterThanOrEqual(0);
    expect(hotbar.capacites[rang]!.disabled).toBe(false);
    expect(useGame.getState().battle!.acted).toBe(false);
    act(() => hotbar.capacites[rang]!.run!());
    expect(useGame.getState().battle!.acted, 'la touche du rang n’a pas dépensé l’Action de la Défensive').toBe(true);
  });

  // Le cœur du lot A1 : les cases se rendent PAR ADRESSE. Une case vidée par le joueur RESTE vide à sa
  // place — aucune recomposition ne fait remonter la suivante (patron RT : la position s'apprend).
  it('D-5bis — la DISPOSITION du porteur commande l’adresse : case vidée, case posée, id inconnu', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h, { foes: [foe('e1', 9, 9)] });
    const cellules = () => [...host.querySelectorAll('.cc-grid-right .cc-cell')];
    const lire = () => cellules().map((c) => c.getAttribute('data-action'));
    const temoin = lire();
    expect(temoin[0], 'témoin : le pré-remplissage déduit garnit le rang 0').not.toBeNull();

    // (a) rang 0 VIDÉ : il reste vide, et les rangs suivants ne bougent pas d'un cran.
    const vide = hero('h1', 'Gunnar');
    vide.conditions = [];
    vide.barre = { capacites: { 0: null } };
    monter(vide, { foes: [foe('e1', 9, 9)] });
    expect(lire()[0], 'la case vidée s’est repeuplée').toBeNull();
    // Le PRÉ-REMPLISSAGE s'écoule dans les rangs LIBRES, dans l'ordre : rien n'est perdu, rien n'est
    // dupliqué — la case vidée, elle, n'est pas reprise.
    expect(lire().slice(1), 'le pré-remplissage a perdu ou dupliqué une case').toEqual(temoin.slice(0, temoin.length - 1));

    // (b) entrée POSÉE : elle se rend à SON adresse, et QUITTE son rang déduit (poser = déplacer,
    // jamais dupliquer).
    const pose = hero('h1', 'Gunnar');
    pose.conditions = [];
    pose.barre = { capacites: { 0: { actionId: 'defend', cle: 'defend' } } };
    monter(pose, { foes: [foe('e1', 9, 9)] });
    expect(lire()[0]).toBe('defend');
    expect(lire().filter((a) => a === 'defend').length, 'la capacité posée s’est dédoublée').toBe(1);

    // (c) id INCONNU (save d'une autre version) : entrée ignorée, la case reste VIDE — la déduction ne
    // la reprend pas, le joueur l'avait remplie.
    const inconnu = hero('h1', 'Gunnar');
    inconnu.conditions = [];
    inconnu.barre = { capacites: { 0: { actionId: 'action-qui-nexiste-pas', cle: 'action-qui-nexiste-pas' } } };
    monter(inconnu, { foes: [foe('e1', 9, 9)] });
    expect(lire()[0], 'un id inconnu a laissé la déduction reprendre la case').toBeNull();
  });

  // Plusieurs cases partagent un même `actionId` (une par Compétence d'Avantage, une par sort) : sans
  // le CANDIDAT dans l'adresse, la case posée rendrait la n-ième occurrence de l'offre — donc une
  // AUTRE compétence dès que l'offre change. L'adresse désigne « CELLE-LÀ ».
  it('D-5ter — l’adresse porte le CANDIDAT : deux cases de la MÊME action ne se confondent pas', () => {
    /** Un lanceur à DEUX sorts : deux alvéoles, un seul `actionId` (`cast-spell`). */
    const sorcier = () => {
      const h = hero('h1', 'Magister');
      h.conditions = [];
      h.skills = [{ id: 'focalisation', characteristic: 'force-mentale', advances: 10 }] as never;
      h.spells = ['carreau', 'bouclier-magique'];
      return h;
    };
    monter(sorcier(), { foes: [foe('e1', 9, 9)] });
    const cles = () => [...host.querySelectorAll('.cc-grid-right .cc-cell')].map((c) => c.getAttribute('data-cell'));
    const memeAction = [...host.querySelectorAll('.cc-grid-right [data-action="cast-spell"]')]
      .map((c) => c.getAttribute('data-cell')!);
    expect(memeAction.length, 'un seul sort : la sonde ne mesurerait aucune collision').toBeGreaterThan(1);
    // Le 2ᵉ sort, posé au rang 0 : c'est LUI qui doit s'y rendre.
    const elue = memeAction[1];
    const pose = sorcier();
    pose.barre = { capacites: { 0: { actionId: 'cast-spell', cle: elue } } };
    monter(pose, { foes: [foe('e1', 9, 9)] });
    expect(cles()[0], 'l’adresse a rendu une AUTRE compétence que celle posée').toBe(elue);
    expect(cles().filter((k) => k === elue).length, 'la compétence posée s’est dédoublée').toBe(1);
  });

  it('D-6 — l’icône de la case d’attaque suit l’ARME du set, jamais un glyphe d’épée en dur', () => {
    monter(arbaletrier());
    const arb = host.querySelector('[data-cell="g1-attaque"] .cc-ico')!.innerHTML;
    // L'art vient de la primitive d'objet (`ItemIcon`), pas du registre d'icônes générique.
    expect(host.querySelector('[data-cell="g1-attaque"] .item-icon')).not.toBeNull();

    const h = hero('h2', 'Gunnar');
    h.conditions = [];
    h.items = [objet('dague', 'i-dague')];
    h.loadouts = [{ id: 'lo-melee', main: 'i-dague' }];
    h.activeLoadoutId = 'lo-melee';
    recomputeLoadout(h);
    monter(h);
    const dague = host.querySelector('[data-cell="g1-attaque"] .cc-ico')!.innerHTML;
    expect(dague, 'deux armes différentes ne peuvent pas porter le MÊME dessin').not.toBe(arb);
  });
});

// ── LA CONSOLE CONSOMME LE REGISTRE DES ACTIONS (spec HUD « Zone 12 », lot branchements) ────────
// Plus aucune case n'est écrite à la main : chacune naît d'une entrée de `src/data/actions.json`
// (libellé, icône, foyer de règle, verdict d'offre) et s'exécute par `runAction`. Ce bloc mesure le
// CÂBLAGE sur le store réel — un clic qui ne bouge pas le moteur est une case morte.
describe('CombatConsole — les cases sont des ENTRÉES du registre (branchement)', () => {
  const caseAction = (id: string) => host.querySelector(`[data-action="${id}"]`) as HTMLButtonElement | null;

  it('R-1 — toute case rendue porte un `data-action` DÉCLARÉ au registre, et son libellé vient de l’entrée', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h, { foes: [foe('e1', 9, 9)] });
    const cases = [...host.querySelectorAll('.cc-cell:not(.cc-empty)')] as HTMLElement[];
    expect(cases.length, 'aucune case rendue : la sonde ne mesurerait rien').toBeGreaterThan(4);
    const inconnues = cases.filter((c) => !findActionById(c.getAttribute('data-action') ?? ''));
    expect(
      inconnues.map((c) => c.getAttribute('data-action')),
      'case rendue dont l’id d’action n’existe pas au registre',
    ).toEqual([]);
    // Le libellé de la Défensive n'est pas écrit dans le composant : il est LU dans l'entrée.
    expect(caseAction('defend')!.querySelector('.cc-lbl')!.textContent).toBe(findActionById('defend')!.label);
  });

  it('R-2 — la case Défensive EXÉCUTE son dispatcher (`battleDefendTotal`) par le registre', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h, { foes: [foe('e1', 9, 9)] });
    expect(useGame.getState().battle!.acted).toBe(false);
    act(() => caseAction('defend')!.click());
    // Effet MOTEUR observable (pas un drapeau d'UI) : posture défensive posée, Action dépensée.
    expect(useGame.getState().battle!.combatants[0].defensiveStance, 'la case Défensive n’a rien exécuté').toBe(true);
    expect(useGame.getState().battle!.acted).toBe(true);
  });

  // DÉTERMINATION (LDB 17 l.59-60) : deux des trois dépenses sont des ALVÉOLES, et leurs dispatchers
  // sont DIRECTS — le clic DÉPENSE le point, il n'arme aucun mode (aucune entrée d'armement au registre).
  it('R-3 — les deux dépenses de Détermination sont des alvéoles DIRECTES (aucun mode armé)', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    h.resolve = 2;
    act(() => { useGame.setState({ scene: emptyScene(20, 20) }); });
    monter(h, { foes: [foe('e1', 9, 9)] });
    act(() => caseAction('resolve-psych-immune')!.click());
    // Effet MOTEUR observable : un point parti, l'immunité posée, et AUCUN mode d'action armé.
    expect(useGame.getState().battle!.combatants[0].resolve, 'la case n’a pas dépensé le point').toBe(1);
    expect(useGame.getState().battle!.combatants[0].activeEffects?.some((e) => e.psychImmune)).toBe(true);
    expect(useGame.getState().battle!.action, 'une dépense directe n’arme rien').toBeNull();
    act(() => caseAction('resolve-ignore-crit')!.click());
    expect(useGame.getState().battle!.combatants[0].resolve).toBe(0);
    expect(useGame.getState().battle!.combatants[0].activeEffects?.some((e) => e.ignoreCritMods)).toBe(true);
    // Réserve épuisée : le gate du registre referme les deux alvéoles, avec sa raison.
    expect(estFermee(caseAction('resolve-psych-immune')!)).toBe(true);
    expect(estFermee(caseAction('resolve-ignore-crit')!)).toBe(true);
  });

  it('R-4 — une case gatée porte la RAISON du registre AU SURVOL/FOCUS, et ne s’exécute pas', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    h.resolve = 0; // aucun point : le gate `determination-en-reserve` refuse, avec sa raison
    monter(h, { foes: [foe('e1', 9, 9)] });
    const det = caseAction('resolve-psych-immune')!;
    expect(det.hasAttribute('data-gated')).toBe(true);
    const attendue = actionGate('resolve-psych-immune', { active: h, battle: useGame.getState().battle! }).reason;
    // La raison du REGISTRE (jamais une chaîne recopiée ici) se lit au survol ET au focus…
    expect(refusAuSurvol(det)).toBe(attendue);
    expect(refusAuFocus(det)).toBe(attendue);
    // … et nulle part à l'écran au repos : seule sa copie hors écran reste, pour l'`aria-describedby`.
    expect(texteVisible(det)).not.toContain(attendue);
    const copie = det.querySelector('.hors-ecran[data-gate]')!;
    expect(copie.textContent).toBe(attendue);
    expect(det.getAttribute('aria-describedby')).toBe(copie.id);
    // FERMÉE par `aria-disabled`, JAMAIS par `disabled` : l'attribut HTML la retirerait du focus, donc
    // de la manette et du doigt — sa raison ne serait lisible qu'à la souris. Le clic reste inerte.
    expect(det.disabled, 'une case qui porte une raison ne doit pas être `disabled`').toBe(false);
    expect(det.getAttribute('aria-disabled')).toBe('true');
    const avant = useGame.getState().battle!.combatants[0].resolve;
    act(() => det.click());
    expect(useGame.getState().battle!.combatants[0].resolve, 'le clic d’une case fermée a dépensé').toBe(avant);
    expect(useGame.getState().battle!.action, 'le clic d’une case fermée a armé un mode').toBeNull();
  });

  // Deux défauts MESURÉS sur la capture user 2026-08-24 : les cases de Détermination — les libellés les
  // PLUS LONGS du registre — avaient leur NOM tronqué (« Immunité… », « Ignorer les… ») parce que la
  // bande de raison inline mangeait la hauteur, et la raison ÉTAIT ELLE-MÊME tronquée (« AUCUN POINT DE
  // DÉTE… ») : illisible deux fois. La raison partie au survol, la hauteur rendue au nom, la case gatée
  // redevient une case NORMALE — même boîte, même glyphe, deux lignes de nom, encre AA.
  it('R-7 — case gatée : le NOM ENTIER reste lisible (2 lignes, encre AA), la RAISON n’est plus dans la boîte', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    h.resolve = 0;
    monter(h, { foes: [foe('e1', 9, 9)] });
    // PIRE CAS mesuré, jamais une fixture courte : le plus long libellé des gestes de Détermination.
    const detIds = ['resolve-psych-immune', 'resolve-ignore-crit'];
    const pire = detIds.reduce((a, b) => (findActionById(a)!.label.length >= findActionById(b)!.label.length ? a : b));
    expect(findActionById(pire)!.label.length, 'le pire cas doit être un libellé long').toBeGreaterThan(18);
    for (const id of detIds) {
      const c = caseAction(id)!;
      // (a) DOM : le nom du geste est un nœud À PART, porteur du libellé ENTIER de l'entrée + sa réserve
      // — aucune troncature à la source, et plus AUCUN texte de raison à côté de lui.
      const nom = c.querySelector('.cc-lbl:not([data-gate])')!;
      expect(nom.textContent).toBe(`${findActionById(id)!.label} (0)`);
      expect(texteVisible(c).trim(), 'l’alvéole ne montre QUE son nom').toBe(nom.textContent);
    }
    const det = caseAction(pire)!;
    // (b) CSS : la case gatée n'a plus AUCUNE règle qui rétrécit son contenu — ni bande réservée, ni
    // clamp à une ligne, ni glyphe à 0,75× ; le libellé garde les DEUX lignes de la primitive.
    expect(CC_CSS, 'plus aucune règle ne rogne le libellé d’une case gatée')
      .not.toMatch(/\.cc-cell\[data-gated\][^{]*\.cc-(lbl|ico)/);
    expect(CC_CSS, 'plus de bande de raison dans l’alvéole').not.toMatch(/\.cc-lbl\[data-gate\]/);
    expect(decl(ruleOf(CC_BASE, '.cc-lbl'), 'line-clamp'), 'le nom garde ses deux lignes').toBe('2');
    // (c) l'ENCRE de la case fermée tient AA (≥ 4,5:1) sur les deux arrêts de l'alvéole : le grief vision
    // « Recharger 2,94:1 » (spec HUD l.85-86) se ferme au TOKEN, pas à l'œil.
    const travee = ruleOf(CC_BASE, '.cc-bay-right');
    const fonds = [decl(travee, '--cc-cell-hi')!, decl(travee, '--cc-cell-lo')!].map(parseColor);
    const regleGatee = ruleOf(CC_BASE, '.cc-cell[data-gated]:not([data-refus-2e])');
    const encre = parseColor(decl(regleGatee, '--cc-cell-ink')!);
    expect(worst(encre, fonds), 'le nom d’une capacité refusée doit rester LU').toBeGreaterThanOrEqual(4.5);
    // … tout en restant NETTEMENT sous la case vivante : refusée ne veut pas dire égale.
    const vive = parseColor(decl(travee, '--cc-cell-ink')!);
    expect(worst(vive, fonds) / worst(encre, fonds), 'l’écart vivant/fermé n’est pas net').toBeGreaterThanOrEqual(2);
    // (d) aucun badge de touche sur une case refusée — il ne promet pas une touche qui ne fait rien.
    expect(det.querySelector('.cc-key'), 'badge de touche sur une case gatée').toBeNull();
  });

  // Le badge de touche est posé HORS FLUX au pied de l'alvéole : sur un libellé long il passait SOUS
  // les mots (sonde du juge vision, « Immunité Psychologie (2) » captures 01/07/15). La case qui
  // IMPRIME sa touche lui réserve donc sa bande au pied.
  it('R-7bis — la case qui imprime sa touche RÉSERVE sa bande au pied (le chiffre ne mord plus le nom)', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h, { foes: [foe('e1', 9, 9)] });
    // Les alvéoles des GRILLES (la plaque de sortie a sa propre boîte et sa propre note de pied).
    const alveoles = [...host.querySelectorAll('.cc-grid .cc-cell')];
    const avecTouche = alveoles.filter((c) => c.querySelector('.cc-key'));
    expect(avecTouche.length, 'aucune case à touche : la sonde ne mesurerait rien').toBeGreaterThan(0);
    for (const c of avecTouche) {
      expect(c.hasAttribute('data-hotkey'), `case « ${c.getAttribute('data-action')} » : touche imprimée sans réserve`).toBe(true);
    }
    // … et aucune case SANS badge ne paie la réserve (la géométrie ne se paie que là où elle sert).
    for (const c of alveoles.filter((x) => !x.querySelector('.cc-key'))) {
      expect(c.hasAttribute('data-hotkey')).toBe(false);
    }
    const regle = ruleOf(CC_BASE, '.cc-cell[data-hotkey]');
    const bande = parseFloat(decl(regle, 'padding-bottom')!);
    const badge = ruleOf(CC_BASE, '.cc-key');
    // La bande couvre le badge : son corps + son fond de ligne.
    expect(bande, 'réserve plus courte que le badge : le chevauchement revient')
      .toBeGreaterThanOrEqual(parseFloat(/\b(\d+(?:\.\d+)?)px\b/.exec(decl(badge, 'font')!)![1]) + parseFloat(decl(badge, 'bottom')!));
  });

  it('R-5 — G6bis : le geste d’ÉTAT du porteur (surface `geste-d-etat`) se dessine quand sa situation l’ouvre', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h, { foes: [foe('e1', 9, 9)] });
    expect(caseAction('dismount'), 'à pied : aucun geste d’état').toBeNull();

    const cavalier = hero('h2', 'Gunnar');
    cavalier.conditions = [];
    cavalier.mountId = 'mule';
    monter(cavalier, { foes: [foe('e1', 9, 9)] });
    const desc = caseAction('dismount');
    expect(desc, 'en selle : la case G6bis doit être dessinée').not.toBeNull();
    expect(findActionById('dismount')!.surface).toBe('geste-d-etat');
    expect(desc!.querySelector('.cc-lbl')!.textContent).toBe(findActionById('dismount')!.label);
    // La géométrie ne bouge pas d'un poil : la travée garde son compte de cases.
    expect(host.querySelectorAll('.cc-grid-left .cc-cell').length).toBe(6);
  });

  it('R-6 — remèdes d’ÉTAT : la case naît de l’État porté et exécute son dispatcher', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h, { foes: [foe('e1', 9, 9)] });
    expect(caseAction('roll-fire'), 'sans flammes, aucune case de remède').toBeNull();

    const brulant = hero('h2', 'Gunnar');
    brulant.conditions = [{ id: 'en-flammes', value: 1 }] as ConditionInstance[];
    monter(brulant, { foes: [foe('e1', 9, 9)] });
    const rouler = caseAction('roll-fire');
    expect(rouler, 'En flammes : le remède doit être offert à la grille').not.toBeNull();
    act(() => rouler!.click());
    // `battleRecoverState('en-flammes')` ouvre le Test de récupération de l'État (donnée `EtatData.recover`).
    expect(useGame.getState().pendingStateRecovery, 'la case n’a rien exécuté').toBeTruthy();
  });
});

describe('CombatConsole — micro-rendu, 2ᵉ passe du juge vision (2026-08-17)', () => {
  /** Valeur d'une variable de matière déclarée par une travée (les alvéoles/vides y sont keyés). */
  const bayVar = (bay: string, name: string) => decl(ruleOf(CC_BASE, bay), name)!;
  const BAYS = ['.cc-bay-left', '.cc-bay-right'];
  /** Fonds possibles d'une alvéole PLEINE : les deux arrêts du dégradé de `.cc-cell`. */
  const cellBgOf = (bay: string) => [bayVar(bay, '--cc-cell-hi'), bayVar(bay, '--cc-cell-lo')].map(parseColor);

  // Sonde du juge : hiérarchie INVERSÉE — une case morte (« Dague », 8,66:1 sous un simple voile
  // d'opacité 0,88) plus lumineuse que tout le pont. Le CREUX, lui, ne se juge plus à son encre : il
  // n'a plus de mot (2026-08-24), il se juge à sa MATIÈRE (fond + cadre en retrait).
  it('E-1 — hiérarchie des encres d’alvéole : vivant ≫ inerte ≥ 3:1, et le CREUX recule sans mot', () => {
    const inerte = ruleOf(CC_BASE, '.cc-cell.cc-inert');
    // L'inerte ne se joue plus à l'opacité (invisible au token, non mesurable) : c'est une ENCRE.
    expect(decl(inerte, 'opacity')).toBe('1');
    const inertInk = parseColor(decl(inerte, '--cc-cell-ink')!);
    for (const bay of BAYS) {
      const fonds = cellBgOf(bay);
      const vivant = worst(parseColor(bayVar(bay, '--cc-cell-ink')), fonds);
      const mort = worst(inertInk, fonds);
      expect(vivant, `${bay} : une case vivante doit être franche`).toBeGreaterThanOrEqual(7);
      expect(mort, `${bay} : une case dessinée reste lisible`).toBeGreaterThanOrEqual(3);
      expect(vivant / mort, `${bay} : l’écart vivant/mort n’est pas net`).toBeGreaterThanOrEqual(2);
      // Le CREUX se lit SANS MOT : son verre RECULE sous celui d'une alvéole pleine, et son liseré
      // recule sous celui d'une alvéole pleine — deux reculs, mesurés au token (le cadre était
      // jusqu'ici IDENTIQUE : seul le mot distinguait la case vide, et le mot est parti).
      const verre = contrast(parseColor(bayVar(bay, '--cc-cell-hi')), parseColor(bayVar(bay, '--cc-void-hi')));
      expect(verre, `${bay} : le verre du creux ne recule pas sous l’alvéole pleine`).toBeGreaterThan(1.15);
      const cadre = contrast(parseColor(bayVar(bay, '--cc-cell-edge')), parseColor(bayVar(bay, '--cc-void-edge')));
      expect(cadre, `${bay} : le liseré du creux est celui d’une case pleine`).toBeGreaterThan(1.3);
    }
  });

  // Une seule GRAMMAIRE de case vide, dans les DEUX travées — et c'est le SILENCE : « je ne connais
  // aucune interface, même pas Rogue Trader, qui dans les emplacement de capacité met "Libre" »
  // (arbitrage user 2026-08-24). L'œil voit un creux ; seul le lecteur d'écran l'entend nommer.
  it('E-2 — les DEUX travées rendent une case vide MUETTE, nommée pour le seul lecteur d’écran', () => {
    expect(bayVar('.cc-bay-left', '--cc-void-ink')).toBe(bayVar('.cc-bay-right', '--cc-void-ink'));
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h);
    const vides = [...host.querySelectorAll('.cc-cell.cc-empty')];
    expect(host.querySelectorAll('.cc-bay-right .cc-cell.cc-empty').length, 'aucune case vide à droite').toBeGreaterThan(0);
    expect(host.querySelectorAll('.cc-bay-left .cc-cell.cc-empty').length, 'aucune case vide à gauche').toBeGreaterThan(0);
    for (const v of vides) {
      // Le SILENCE porte sur les MOTS. Le seul signe admis est la TOUCHE de l'adresse (un chiffre) :
      // le rang s'apprend même vide, c'est le patron positionnel de la grille (spec HUD zone 8).
      const texte = texteVisible(v).trim();
      expect(texte, 'une case vide écrit encore un mot à l’écran').toMatch(/^\d*$/);
      expect(texte, 'une case vide écrit autre chose que sa touche').toBe(v.querySelector('.cc-key')?.textContent?.trim() ?? '');
      const nom = v.querySelector('.hors-ecran');
      expect(nom?.textContent, 'une case vide doit rester NOMMÉE pour le lecteur d’écran').toBe(t('cc.caseVide'));
    }
    // La règle du hors-écran est structurelle : jamais `display: none` (l'arbre a11y le perdrait).
    // La primitive est PARTAGÉE (base.css) : jamais une recopie du clip par module.
    const horsEcran = ruleOf(BASE_CSS, '.hors-ecran');
    expect(decl(horsEcran, 'clip-path'), 'la primitive hors-écran doit CLIPPER sa boîte').toMatch(/^inset\(/);
    expect(decl(horsEcran, 'position')).toBe('absolute');
    expect(decl(horsEcran, 'display'), 'hors écran ≠ retiré de l’arbre a11y').toBeNull();
  });

  // Sonde du juge : liseré du pont à y=595 avec la rangée de munition, y=598 sans — 3px de dérive selon le
  // CONTENU. Le contrat verrouille l'invariance PAR CONSTRUCTION (hauteur fixe, pas un plancher).
  it('E-3 — la hauteur du pont est FIXE : la rangée de munition est réservée, jamais ajoutée', () => {
    const bay = ruleOf(CC_BASE, '.cc-bay-left');
    // La travée prend la hauteur de la BANDE : c'est la bande qui porte la réserve (`--cc-deck-h`),
    // et la travée ne peut donc plus grandir seule au fil de son contenu.
    expect(decl(bay, 'height')).toBe('100%');
    expect(decl(bay, 'min-height'), 'un PLANCHER laisse la travée grandir avec la munition').toBeNull();
    const racine = ruleOf(CC_BASE, ':root');
    // La réserve de bande vaut la plus HAUTE des régions — la travée, ou l'arche diminuée de ce
    // qu'elle franchit — plus le liseré. Une réserve calée sur la seule travée AMPUTAIT l'arche
    // (mesuré 17px de contenu coupé à 900×800, `scripts/recette/console-pont-formes.mjs`).
    // Jugé ÉVALUÉ, à deux viewports : la réserve vaut la plus HAUTE des deux régions plus le liseré,
    // et l'arche vaut son portrait plus son chrome. Une formule RÉÉCRITE sans changer ces lois passe ;
    // une loi qui change rougit.
    const liseret = parseFloat(token('--pont-liseret'));
    for (const [vw, vh] of [[1920, 1080], [900, 800]] as [number, number][]) {
      const lu = (e: string) => evalLen(e, vw, vh);
      expect(lu(decl(racine, '--cc-deck-h')!), `réserve de bande à ${vw}×${vh}`)
        .toBe(Math.max(lu('var(--cc-bay-h)'), lu('var(--cc-arch-h)') - lu('var(--cc-fronton)')) + liseret);
      expect(lu(decl(racine, '--cc-arch-h')!), `hauteur d’arche à ${vw}×${vh}`)
        .toBe(lu('var(--cc-portrait)') + lu('var(--cc-arch-chrome)'));
    }
    // Ce liseré est bien celui du pont, pas un nombre en l'air : la peau de bande le déclare par le
    // token `--pont-liseret` (base.css), et c'est CE token que la réserve ci-dessus additionne.
    expect(decl(ruleOf(COMPONENTS_BASE, '.skin-pont'), 'border-top')).toMatch(/^var\(--pont-liseret\) /);
    expect(liseret, 'le liseré du pont doit être une épaisseur non nulle').toBeGreaterThan(0);
    // C'est la COMPOSITION de la bande qui décide, pas une largeur écrite à la main : tant que les
    // régions sont sur une LIGNE, la travée porte la hauteur du pont et aucune tranche ne la rejoue ;
    // dès que la bande EMPILE ses régions, la travée reprend la sienne, EXPLICITEMENT — elle ne se
    // recalcule pas. La règle se relit donc tranche par tranche, en lisant le régime au `.cc-dock`.
    let empilee = false;
    for (const q of ['@media (max-width: 900px)', '@media (max-width: 700px)', '@media (max-width: 560px)']) {
      const tranche = mediaBlock(CC_CSS, q);
      // Les tranches se lisent du plus large au plus étroit et se CUMULENT : une tranche qui n'en
      // reparle pas hérite du régime de la précédente.
      empilee ||= /column/.test(decl(ruleOf(tranche, '.cc-dock'), 'flex-direction') ?? '');
      const blocs = [...tranche.matchAll(/\.cc-bay-left\s*\{([^{}]*)\}/g)].map((m) => m[1]);
      for (const bloc of blocs) {
        expect(decl(bloc, 'height'), `${q} : régime ${empilee ? 'empilé' : 'en ligne'}`)
          .toBe(empilee ? 'auto' : null);
        expect(decl(bloc, 'min-height'), `${q} rejoue un PLANCHER de travée`).toBeNull();
      }
      if (empilee) expect(blocs.length, `${q} empile ses régions sans relâcher la travée`).toBeGreaterThan(0);
    }
    const at560 = mediaBlock(CC_CSS, '@media (max-width: 560px)');
    // … et le fronton y rentre dans le rang, au `:root` : la réserve de bande le lit.
    expect(parseFloat(decl(ruleOf(at560, ':root'), '--cc-fronton')!)).toBe(0);
    // … et la travée ne porte AUCUNE bande réservée : la munition vit dans l'EN-TÊTE, à côté du set
    // (arbitrage #1348 complément a — 47px de plaque NUE mesurés sous les travées avant la coupe).
    const objet = (id: string, uid: string, over: Partial<ItemInstance> = {}) => Object.assign(itemFromTrappingById(id)!, { uid }, over);
    const tireur = hero('h1', 'Gunnar');
    tireur.conditions = [];
    tireur.items = [objet('arbalete-lourde', 'i-arb', { loaded: false }), objet('carreau', 'i-c')];
    tireur.loadouts = [{ id: 'lo-tir', main: 'i-arb' }];
    tireur.activeLoadoutId = 'lo-tir';
    recomputeLoadout(tireur);
    monter(tireur);
    expect(host.querySelectorAll('.cc-bay-left').length).toBe(1);
    expect((host.querySelector('.cc-bay-left') as HTMLElement).style.height, 'aucune hauteur en ligne : la loi est au CSS').toBe('');
    // La travée a seulement UN enfant de contenu (le corps) : plus de bandeau sous les cases.
    expect(host.querySelector('.cc-bay-left')!.children.length, 'une bande de plus sous la travée = du vide payé par le pont').toBe(1);
    expect(host.querySelector('.cc-bay-left')!.children[0].className).toContain('cc-bay-body');

    const bagarreur = hero('h2', 'Gunnar');
    bagarreur.conditions = [];
    bagarreur.items = [objet('dague', 'i-d')];
    bagarreur.loadouts = [{ id: 'lo-melee', main: 'i-d' }];
    bagarreur.activeLoadoutId = 'lo-melee';
    recomputeLoadout(bagarreur);
    monter(bagarreur);
    expect(host.querySelectorAll('.cc-bay-left').length).toBe(1);
    expect(host.querySelector('.cc-bay-left')!.children.length).toBe(1);
  });

  // Sondes du juge : « déch. » = 7px (plus petit texte du dépôt, 3 rangées de pixels à 360), à cheval sur
  // le « X », et le set AU POING portait le liseré le PLUS discret de la travée.
  it('E-4 — vignette de set : mot entier ≥ 8px, trois coins DISJOINTS, set au poing en relief', () => {
    const load = ruleOf(CC_BASE, '.cc-set-load');
    const px = (v: string) => parseFloat(/(\d+(?:\.\d+)?)px/.exec(v)![1]);
    expect(px(decl(load, 'font')!)).toBeGreaterThanOrEqual(8); // norme: plancher de lisibilité 8px (charte UI — un mot entier, lisible)
    // Aucune tranche compacte ne le rapetisse (il était descendu à 6px sous 560).
    for (const q of ['@media (max-width: 900px)', '@media (max-width: 700px)', '@media (max-width: 560px)']) {
      expect(mediaBlock(CC_CSS, q)).not.toMatch(/\.cc-set-load\s*\{/);
    }
    // Trois gravures, trois coins : rang haut-GAUCHE, touche haut-DROITE, état au PIED pleine largeur.
    const rang = ruleOf(CC_BASE, '.cc-set-n');
    const touche = ruleOf(CC_BASE, '.cc-set .cc-key');
    expect(decl(rang, 'top')).toBeTruthy();
    expect(decl(rang, 'left')).toBeTruthy();
    expect(decl(touche, 'top')).toBeTruthy();
    expect(decl(touche, 'right')).toBeTruthy();
    expect(decl(touche, 'bottom'), 'la touche quitte le pied, occupé par l’état de charge').toBe('auto');
    expect(decl(touche, 'left')).toBe('auto');
    expect(decl(load, 'position')).toBe('absolute');
    expect(decl(load, 'bottom')).toBe('0');

    // RELIEF du set au poing : liseré plus épais, à l'or du pont, et lueur plus large que celle d'une
    // alvéole armée — l'identité du set passe devant les états.
    const set = ruleOf(CC_BASE, '.cc-set');
    const on = ruleOf(CC_BASE, '.cc-set.on');
    expect(px(decl(on, 'border')!)).toBeGreaterThan(px(decl(set, 'border')!));
    expect(borderColorOf(on)).toEqual(parseColor(token('--combat-gold')));
    const halo = (b: string) => Math.max(...[...b.matchAll(/(?:^|,)\s*0 0 (\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])));
    expect(halo(decl(on, 'box-shadow')!)).toBeGreaterThan(halo(decl(ruleOf(CC_BASE, '.cc-cell.on'), 'box-shadow')!));
  });

  // Le pont était mesuré en quatre plats de couleurs distinctes (acier bleu, laiton, plaque rouge, bois).
  // Loi de composition tenue ici : une SEULE matière pour le pont et ses trois plaques ; la région se
  // distingue par son liseré et ses alvéoles. Trace de la décision : `combat-console.css` en tête des
  // travées.
  // E-5 — spec §1c-ter (« UN PONT CONTINU pleine largeur : bande
  // unique de bord à bord […] avec son LISERÉ HAUT continu ; les travées, les pages, le conduit
  // d'Avantage et le coin Fin du tour sont des RÉGIONS — jamais des boîtes sœurs flottantes »).
  // Mesuré avant : quatre liserés DIFFÉRENTS par région (acier 0,67px à gauche, or 2,67px à l'arche,
  // brun 0,67px à droite) et quatre bandes de matière plus sombre entre les zones, lues comme des
  // trous de carte. Le contrat : UN SEUL élément peint la bande, les régions ne peignent RIEN.
  it('E-5 — BANDE CONTINUE : un seul élément porte le fond ET le liseré ; aucune région n’en peint', () => {
    // La bande est opaque, de bord à bord, et porte le liseré haut — une seule fois, dans la peau
    // `.skin-pont` que le pont POSE (une seule définition pour les trois boîtes de pont).
    const peau = ruleOf(COMPONENTS_BASE, '.skin-pont');
    expect(decl(peau, 'background-image')).toMatch(/linear-gradient/);
    expect(parseColor(decl(peau, 'background-color')!)[3]).toBe(1);
    expect(decl(peau, 'border-top')).toBeTruthy();
    // AUCUNE région n'a plus de fond ni de bordure propre : ni les deux travées, ni le coin.
    for (const sel of ['.cc-bay', '.cc-bay-left', '.cc-bay-right', '.cc-corner']) {
      for (const p of ['background', 'background-image', 'background-color', 'border', 'border-top', 'box-shadow']) {
        expect(decl(ruleOf(CC_BASE, sel), p), `${sel} peint encore « ${p} » : la couture revient`).toBeNull();
      }
    }
    // … et la règle qui donnait une nappe aux régions a disparu de la feuille entière (tranches
    // responsives comprises) : une nappe de région rouvre un liseré à chaque écart.
    expect(CC_CSS).not.toMatch(/\.cc-bay-left,\s*\n?\s*\.cc-bay-right/);
    expect(CC_CSS, 'le rouge de la plaque de sortie doit avoir disparu').not.toMatch(/--cc-end-(hi|lo)\b/);
    // SEULE EXCEPTION, et elle est le FRONTON : l'arche s'élève AU-DESSUS du liseré (la figurine
    // dépasse), il lui faut donc sa matière là-haut — la MÊME que la bande, prolongement compris
    // (contrat P-3). Elle l'obtient en POSANT la même peau, jamais en la recopiant, et ne peint
    // aucun flanc (trois remises à zéro, qui laissent le liseré de la peau intact).
    const arche = ruleOf(CC_BASE, '.cc-arch');
    for (const p of ['background-image', 'border-top']) expect(decl(arche, p), p).toBeNull();
    expect(readFileSync(join(process.cwd(), 'src', 'ui', 'CombatConsole.tsx'), 'utf8')).toMatch(/className="cc-arch skin-pont"/);
    for (const c of ['border-right', 'border-bottom', 'border-left']) expect(decl(arche, c), c).toBe('0');
    // Une région se distingue par ses ALVÉOLES : le coin porte les tokens de case, sans plaque à lui.
    expect(decl(ruleOf(CC_BASE, '.cc-corner'), '--cc-cell-edge')).toBeTruthy();
    expect(decl(ruleOf(CC_BASE, '.cc-end'), 'border')).toBeNull();
  });
});

// ── BUDGET DE HAUTEUR DU PONT — CONTRAT (spec §1c « BUDGET DE HAUTEUR », commit `432e1247`) : la
//    planche budgétise 217px de pont pour 1080 de haut, soit 20,1 % ; une capture à ~1998px en mesurait
//    28-29 %. Le pont tient ≤ 21 % du viewport.
//    On ÉVALUE ici les déclarations réelles (le `clamp`/`min`/`calc` de `--cc-cell-h` et la chaîne
//    `--cc-bay-h` → `--cc-deck-h`) à viewport simulé : c'est la LOI déclarée qui est jugée, pas un
//    littéral recopié. La recette re-mesure les mêmes largeurs à l'écran.
describe('CombatConsole — budget de hauteur du pont (arbitrage user 2026-08-17)', () => {
  /** Hauteur du pont telle que le CSS la DÉCLARE, à un viewport donné. */
  const deck = (vw: number, vh: number) => evalLen(decl(racine(), '--cc-deck-h')!, vw, vh);

  // 1998×959 = la résolution de la capture de l'arbitrage ; 1280×800 et 1920×1080 = l'étalon et la planche.
  const ECRANS: [number, number][] = [[1280, 800], [1600, 900], [1920, 1080], [1998, 959], [2560, 1440]];

  it('F-1 — le pont tient ≤ 21 % du viewport à toutes les largeurs de bureau', () => {
    for (const [vw, vh] of ECRANS) {
      const h = deck(vw, vh);
      const part = h / vh;
      expect(part, `${vw}×${vh} : pont ${h.toFixed(1)}px = ${(part * 100).toFixed(1)} % du viewport`).toBeLessThanOrEqual(0.21);
      // … et il reste PRÉSENT (une console écrasée n'est pas une console).
      expect(part, `${vw}×${vh} : pont ${(part * 100).toFixed(1)} % — trop maigre`).toBeGreaterThan(0.13);
    }
  });

  it('F-2 — l’alvéole est PAYSAGE partout (jamais un carré, jamais un portrait)', () => {
    for (const [vw, vh] of ECRANS) {
      const w = evalLen(decl(racine(), '--cc-cell-w')!, vw, vh);
      const h = evalLen(decl(racine(), '--cc-cell-h')!, vw, vh);
      expect(w / h, `${vw}×${vh} : alvéole ${w.toFixed(1)}×${h.toFixed(1)}`).toBeGreaterThan(1.1);
      // La planche : 90×66 à 1920, ratio 1,36 — on reste dans sa famille de proportions.
      expect(w / h, `${vw}×${vh} : alvéole trop étirée`).toBeLessThan(1.7);
    }
  });

  it('F-3 — la HAUTEUR d’alvéole se calcule sur la hauteur du viewport (c’est elle qui porte le budget)', () => {
    const h = decl(racine(), '--cc-cell-h')!;
    expect(h, 'un côté keyé sur la LARGEUR laisse un écran large et court dépasser le budget').toMatch(/vh/);
    expect(h).not.toMatch(/vw\b/);
    // La largeur, elle, suit la largeur d'écran (le pont doit porter ses quatre régions).
    expect(decl(racine(), '--cc-cell-w')!).toMatch(/vw/);
    // Un même écran, deux fois plus haut : le pont grandit (le budget est un RATIO, pas un plafond fixe).
    expect(deck(1920, 1080)).toBeGreaterThan(deck(1920, 800));
  });

  it('F-4 — l’icône est une FRACTION de sa case, jamais un px figé (ni au CSS, ni au call-site)', () => {
    expect(decl(racine(), '--cc-ico')!).toMatch(/var\(--cc-cell-h\)/);
    expect(decl(racine(), '--cc-ico-set')!).toMatch(/var\(--cc-cell-h\)/);
    const ico = ruleOf(CC_BASE, '.cc-ico');
    expect(decl(ico, 'width')).toBe('var(--cc-ico)');
    expect(decl(ico, 'height')).toBe('var(--cc-ico)');
    // … et le glyphe REMPLIT cette boîte (sinon la boîte grandit sans que le dessin suive).
    expect(decl(ruleOf(CC_BASE, '.cc-ico svg'), 'width')).toBe('100%');
    // ≈ la moitié de la hauteur utile, comme la planche.
    for (const [vw, vh] of ECRANS) {
      const r = evalLen(decl(racine(), '--cc-ico')!, vw, vh) / evalLen(decl(racine(), '--cc-cell-h')!, vw, vh);
      expect(r, `${vw}×${vh} : icône/case = ${r.toFixed(2)}`).toBeGreaterThan(0.4);
      expect(r).toBeLessThan(0.62);
    }
    // Aucune taille d'icône FIGÉE au call-site de la console (le CSS est la seule échelle).
    const tsx = readFileSync(join(process.cwd(), 'src', 'ui', 'CombatConsole.tsx'), 'utf8');
    expect(tsx, 'taille d’icône en px au call-site : l’échelle vit au CSS').not.toMatch(/<ItemIcon[^>]*size=\{\d+\}/);
  });

  it('F-5 — le budget MOBILE reste celui de l’arbitrage compact (≤560 : la console peut prendre plus)', () => {
    // ≤560 les régions s'EMPILENT : le pont y vaut plus que 21 %, c'est l'arbitrage 2026-08-16 (~40-45 %).
    // Le contrat ici est que la tranche DÉCLARE ses deux côtés (aucun héritage du calcul de bureau).
    const at560 = mediaBlock(CC_CSS, '@media (max-width: 560px)');
    expect(decl(ruleOf(at560, ':root'), '--cc-cell-w')).toBeTruthy();
    expect(decl(ruleOf(at560, ':root'), '--cc-cell-h')).toBeTruthy();
    // … et l'alvéole compacte reste PAYSAGE elle aussi.
    const w = parseFloat(decl(ruleOf(at560, ':root'), '--cc-cell-w')!);
    const h = parseFloat(decl(ruleOf(at560, ':root'), '--cc-cell-h')!);
    expect(w).toBeGreaterThan(h);
  });

  // ── VIDE INTERNE (spec §1c « BUDGET DE HAUTEUR » complément, commit `22004155`). Deux poches
  //    mesurées avant la coupe : 47px de plaque NUE sous les travées à toute largeur de bureau, et un
  //    portrait FIGÉ à 78px sous 116,6px de vide à 1920 (ratio portrait/arche 0,287).
  it('G-1 — la travée ne réserve plus de bande sous ses cases : le socle ne paie que ses titres', () => {
    const socle = decl(racine(), '--cc-bay-h')!;
    // Le socle est la CONSTANTE de la formule (`2×h + écart + socle`). Il ne doit plus porter la
    // rangée de munition (26px) ni son écart (8px).
    const cst = Number(/\+\s*(\d+(?:\.\d+)?)px\s*\)?\s*$/.exec(socle.trim())![1]);
    expect(cst, `socle de travée = ${cst}px`).toBeLessThanOrEqual(41);
    expect(cst, 'un socle nul ne porterait plus ses bandes de titre').toBeGreaterThan(20);
    // Aucune règle de bandeau de munition ne subsiste (la classe entière a disparu du module).
    expect(CC_CSS).not.toMatch(/\.cc-loadouts\b/);
    expect(CC_CSS).not.toMatch(/\.cc-ammo\b/);
  });

  it('G-2 — la munition CHARGÉE vit dans l’en-tête de travée, lue au registre de l’arme', () => {
    const objet = (id: string, uid: string, over: Partial<ItemInstance> = {}) => Object.assign(itemFromTrappingById(id)!, { uid }, over);
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    const arb = objet('arbalete-lourde', 'i-arb');
    const carreaux = objet('carreau', 'i-c', { qty: 12 });
    h.items = [arb, carreaux];
    h.loadouts = [{ id: 'lo-tir', main: 'i-arb' }];
    h.activeLoadoutId = 'lo-tir';
    recomputeLoadout(h);
    // On CHARGE l'arme par le moteur (jamais un champ forgé) : c'est `loadedAmmo` qui doit parler.
    const w = h.weapons.find((x) => x.type === 'ranged')!;
    loadWeapon(h, w); // capture la munition choisie pour CETTE arme (`selectedAmmo`) dans son registre
    expect(loadedAmmo(h, w)?.uid, 'la couture de chargement doit désigner le carreau').toBe('i-c');
    monter(h);
    const tete = host.querySelector('.cc-bay-head')!;
    const mun = tete.querySelector('[data-ammo]');
    expect(mun, 'la munition doit être dans l’EN-TÊTE de travée').not.toBeNull();
    expect(mun!.textContent).toBe(`${carreaux.label} ×12`);
    expect(tete.textContent).toContain(loadoutLabel(h.loadouts![0], h));
    // … et elle porte sa fiche, comme toute possession de la console.
    expect(mun!.closest('.codex-ref'), 'la munition doit porter son foyer Codex').not.toBeNull();

    // Set de MÊLÉE : aucune mention de munition, et l'en-tête reste le nom du set.
    const cac = hero('h2', 'Gunnar');
    cac.conditions = [];
    cac.items = [objet('dague', 'i-d')];
    cac.loadouts = [{ id: 'lo-melee', main: 'i-d' }];
    cac.activeLoadoutId = 'lo-melee';
    recomputeLoadout(cac);
    monter(cac);
    expect(host.querySelector('.cc-bay-head [data-ammo]')).toBeNull();
  });

  it('G-3 — le PORTRAIT se dérive de l’ALVÉOLE, et il DOMINE l’arche sans jamais la faire grandir', () => {
    const racine = ruleOf(CC_BASE, ':root');
    const cc = ruleOf(CC_BASE, '.combat-console');
    const portrait = decl(racine, '--cc-portrait')!;
    // Il suit le CÔTÉ D'ALVÉOLE — une grandeur d'ENTRÉE. Dérivé de la hauteur du pont, il la
    // faisait croître à son tour (portrait ∝ pont ∝ arche ∝ portrait) : le point fixe de cette
    // boucle sortait du budget de hauteur, et toute valeur en deçà amputait l'arche.
    expect(portrait, 'le portrait doit suivre le côté d’alvéole, jamais la hauteur du pont').toMatch(/var\(--cc-cell-h\)/);
    expect(portrait, 'la boucle portrait→pont→arche→portrait est rouverte').not.toMatch(/--cc-deck-h|--cc-arch-h/);
    // Il DOMINE l'arche (planche) : au moins la moitié de sa hauteur, à tout écran de bureau.
    for (const [vw, vh] of ECRANS) {
      const p = evalLen(portrait, vw, vh);
      const arche = evalLen(decl(racine, '--cc-arch-h')!, vw, vh);
      expect(p / arche, `${vw}×${vh} : portrait ${p.toFixed(1)} / arche ${arche.toFixed(1)}`).toBeGreaterThanOrEqual(0.5);
      expect(p / arche, 'un portrait qui déborde l’arche mangerait gouttières, barre et nom').toBeLessThanOrEqual(0.75);
    }
    // La règle qui l'applique reprend bien le style INLINE de la primitive (sinon rien ne bouge).
    const appl = ruleOf(CC_BASE, '.cc-arch .ptile, .cc-arch .ptile-face, .cc-arch .rig-portrait');
    expect(decl(appl, 'height')).toBe('var(--cc-portrait) !important');
    // Le rail des gouttières suit le portrait (il ne peut pas rester plus haut que lui).
    expect(decl(cc, '--cc-rail')!).toMatch(/var\(--cc-portrait\)/);
    // Le CHROME de l'arche (tout ce qui n'est pas le portrait) est une grandeur MESURÉE au
    // navigateur, pas un nombre en l'air : c'est lui qui complète la réserve de bande.
    expect(parseFloat(decl(racine, '--cc-arch-chrome')!)).toBeGreaterThan(0);
    expect(decl(ruleOf(CC_BASE, '.cc-gutter-rail'), 'height')).toBe('var(--cc-rail)');
  });

  it('G-4 — le FAÎTE de l’arche est serré : son rembourrage haut ne creuse plus un sommet vide', () => {
    const arche = ruleOf(CC_BASE, '.cc-arch');
    const pad = decl(arche, 'padding')!.split(/\s+/).map(parseFloat);
    expect(pad[0], `rembourrage haut de l’arche = ${pad[0]}px`).toBeLessThanOrEqual(8);
  });
});

/**
 * INTENTION ARMÉE (spec HUD zone 4) — le popover de règle se TAIT tant que la portée est peinte.
 *
 * Défaut mesuré sur captures au lot « intentions » : le clic qui arme Course/Charge donne le focus au
 * bouton, le popover `CodexRef` (mode `wrap`) s'ouvre par ce focus… et sa boîte recouvre le champ à
 * l'instant PRÉCIS où le joueur a demandé à voir la portée. Le popover reste le canon d'information
 * HORS intention : ces contrats mesurent les deux états.
 */
describe('CombatConsole — intention armée : aucun popover de règle au-dessus du champ', () => {
  const caseAction = (id: string) => host.querySelector(`[data-action="${id}"]`) as HTMLButtonElement | null;
  const popovers = () => [...document.body.querySelectorAll('.codex-pop[role="tooltip"]')];
  const enveloppeDe = (b: HTMLButtonElement) => {
    const e = b.closest('.codex-ref');
    if (!e) throw new Error('la case n’est pas enveloppée par son foyer de règle (CodexRef)');
    return e;
  };
  const survoler = (e: Element) => act(() => { e.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });

  /** Héros au tour entier, intention DÉSARMÉE (le store la garde entre deux tests : `setState` fusionne). */
  function console1() {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    act(() => { useGame.setState({ localIntent: null }); });
    monter(h, { foes: [foe('e1', 9, 9)] });
    const c = caseAction('course');
    expect(c, 'la case Course doit être rendue : sans elle la sonde ne mesure rien').not.toBeNull();
    expect(c!.disabled, 'la case Course doit être cliquable pour armer').toBe(false);
    return c!;
  }

  it('le clic qui ARME l’intention referme le popover que le survol/focus avait ouvert', () => {
    const c = console1();
    survoler(enveloppeDe(c));
    expect(popovers().length, 'hors intention, le popover de règle doit s’ouvrir (comportement INCHANGÉ)').toBe(1);
    act(() => { caseAction('course')!.click(); });
    expect(useGame.getState().localIntent, 'la case n’a pas armé l’intention').toEqual({ actionId: 'course' });
    expect(popovers().length, 'un popover de règle recouvre la portée peinte').toBe(0);
  });

  it('intention armée : plus AUCUN popover ne s’ouvre — et le désarmement rend la règle', () => {
    const c = console1();
    act(() => { c.click(); });
    expect(useGame.getState().localIntent).toEqual({ actionId: 'course' });
    // Ni la case armée, ni ses voisines : le champ reste dégagé sous toutes les alvéoles de la console.
    survoler(enveloppeDe(caseAction('course')!));
    expect(popovers().length, 'la case armée rouvre son popover au survol').toBe(0);
    survoler(enveloppeDe(caseAction('defend')!));
    expect(popovers().length, 'une case VOISINE rouvre son popover au survol').toBe(0);
    // Désarmement (re-clic, `toggleOff` du registre) → l'information de règle n'était pas retirée, elle attendait.
    act(() => { caseAction('course')!.click(); });
    expect(useGame.getState().localIntent).toBeNull();
    survoler(enveloppeDe(caseAction('course')!));
    expect(popovers().length, 'intention dissoute : le popover de règle doit revenir').toBe(1);
  });
});

/**
 * BANDEAU D'INTERLUDE (#1411 P0-B) — un ciblage par la carte SANS MODALE (Frappe Mortelle, 2ᵉ frappe,
 * Surincantation, pose de zone, bordée, téléportation) doit porter SA SORTIE à l'écran : sans elle, le
 * joueur a seulement le clic-carte pour quitter le mode. Le bandeau la tire du REGISTRE (entrées
 * `surface: 'interlude'`, appariées par leur `mode` au mode de ciblage courant) — la console ne nomme
 * aucun état de flux, et le dispatcher exécuté est celui du registre (`runAction`).
 */
describe('CombatConsole — bandeau d’interlude : tout ciblage par la carte porte sa sortie', () => {
  const bandeau = () => host.querySelector('.cc-phase');
  const sortie = (id: string) => host.querySelector(`.cc-phase [data-action="${id}"]`) as HTMLButtonElement | null;
  /** Remet à zéro les flux différés que `setState` conserve d'un test à l'autre (fusion du store). */
  const sansFlux = () => act(() => { useGame.setState({ pendingCleave: null, pendingDualStrike: null, pendingCast: null, pendingRoundStart: null }); });

  it('Frappe Mortelle : le bandeau nomme la phase et son bouton COMMET la sortie du registre', () => {
    sansFlux();
    const h = hero('h1', 'Gunnar');
    monter(h, { foes: [foe('e1', 6, 5)] });
    act(() => { useGame.setState({ pendingCleave: { attackerId: h.id, hitIds: [], count: 0 } as never }); });
    expect(bandeau()?.querySelector('.cc-phase-label')?.textContent).toBe('Frappe Mortelle');
    const b = sortie('cleave-end');
    expect(b, 'la sortie « Terminer » de l’interlude cleave doit être à l’écran').not.toBeNull();
    expect(b!.textContent).toContain('Terminer');
    // Proéminence DÉDUITE du rôle (validation) — jamais un champ de style en donnée.
    expect(b!.className).toContain('btn-primary');
    act(() => { b!.click(); });
    expect(useGame.getState().pendingCleave, 'le clic doit exécuter `cleaveEnd` (dispatcher du registre)').toBeNull();
    sansFlux();
  });

  it('Bordée : la sortie d’annulation est DISCRÈTE et désarme le mode', () => {
    sansFlux();
    const h = hero('h1', 'Gunnar');
    monter(h, { foes: [foe('e1', 9, 9)] });
    // La scène est requise par `battleSelectAction` (le désarmement lit `{ battle, scene }`).
    act(() => { useGame.setState({ scene: emptyScene(), battle: { ...useGame.getState().battle!, action: 'battery' } }); });
    expect(bandeau()?.querySelector('.cc-phase-label')?.textContent).toBe('Bordée');
    const b = sortie('battery-cancel');
    expect(b, 'la sortie « Annuler » de l’interlude bordée doit être à l’écran').not.toBeNull();
    expect(b!.className, 'une annulation ne porte pas l’accent').toContain('btn-ghost');
    act(() => { b!.click(); });
    expect(useGame.getState().battle!.action, 'le clic doit désarmer le mode de bordée').toBeNull();
  });

  it('hors interlude : aucun bandeau de sortie — et la pause de Round garde le sien', () => {
    sansFlux();
    const h = hero('h1', 'Gunnar');
    monter(h, { foes: [foe('e1', 9, 9)] });
    expect(bandeau(), 'un tour ordinaire n’a pas de bandeau de phase').toBeNull();
    act(() => { useGame.setState({ pendingRoundStart: { round: 2, readyBySeat: {} } as never }); });
    expect(bandeau()?.querySelector('.cc-phase-label')?.textContent).toBe('Début du Round 2');
    expect(sortie('round-start')?.textContent, 'la pause de Round garde son bouton d’ouverture').toContain('Commencer le round 2');
    sansFlux();
  });
});

/**
 * TOUR DU NAVIRE & COOP (#1411 P0-B lot 2) — deux défauts d'UNE racine : la console ne vivait que pour
 * un combattant non-véhicule d'une partie `mode:'local'`. Résultat mesuré : au tour de la COQUE, toutes
 * les cases étaient inertes et aucune case navale n'était même construite ; et en partie réseau, la
 * console était morte pour TOUT le monde, hôte compris. La possession se tranche par `controlsCombatant`
 * (`netOwnership.ts`), qui connaît déjà les sièges — la console n'a aucune clause de mode de partie.
 */
describe('CombatConsole — tour du NAVIRE contrôlé : ses Tests d’équipage SONT les cases', () => {
  const caseAction = (id: string) => host.querySelector(`[data-action="${id}"]`) as HTMLButtonElement | null;

  /** Une pièce de bord DÉCHARGÉE servie par son chef : c'est ce qui rend la recharge pertinente. */
  const poste = (): ShipPoste =>
    ({
      side: 'tribord', loaded: false, reloadProgress: 0, crewIds: ['gunner'],
      item: { uid: 'canon', label: 'Canon moyen', type: 'ranged', damage: { flat: 14, plusBF: false }, range: 75, qualities: [{ id: 'recharge', value: 6 }] },
    }) as unknown as ShipPoste;

  /** La COQUE du groupe : un vrai `vehicleCombatant` (facette `hull` de `vehicles.json`), du camp
   *  joueur (`kind:'hero'` — c'est ainsi que le combat naval la pose, `combatSlice.ts:2777`). */
  function navire(): Combatant {
    const hull = vehicleCombatant(findVehicleById('bateau-de-patrouille')!)!;
    hull.id = 'ship';
    hull.kind = 'hero';
    hull.pos = { x: 5, y: 5 };
    hull.crewIds = ['gunner'];
    hull.postes = [poste()];
    return hull;
  }

  /** Combat naval : la coque et son artilleur, la coque ACTIVE. */
  function monterNavire() {
    const crew = hero('gunner', 'Artilleur');
    const ship = navire();
    act(() => {
      useGame.setState({
        party: [crew], scene: emptyScene(20, 20),
        battle: {
          combatants: [ship, crew], order: [ship.id, crew.id], baseOrder: [ship.id, crew.id], turn: 0, round: 1,
          action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
          acted: false, runBudget: 4, log: [], over: null, crewActed: {},
        } as unknown as BattleState,
      });
    });
    act(() => { root.render(<CombatConsole />); });
    return ship;
  }

  it('N-1 — la console VIT au tour de la coque : aucune bande d’attente, les cinq cases navales sont là', () => {
    monterNavire();
    expect(host.querySelector('.cc-phase'), 'le tour d’un acteur CONTRÔLÉ n’est pas une phase d’attente').toBeNull();
    for (const id of ['maneuver-ship', 'battery', 'crew-test-rude-epreuve', 'sing-shanty', 'ship-reload']) {
      expect(caseAction(id), `case navale « ${id} » absente de la travée`).not.toBeNull();
    }
    // BRANCHÉES, pas seulement dessinées : le pont clavier ne publie que les cases qui portent un `run`.
    const publiees = [...host.querySelectorAll('.cc-grid-left .cc-cell:not(.cc-empty)')]
      .filter((c) => !(c as HTMLButtonElement).disabled)
      .map((c) => c.getAttribute('data-action'));
    for (const id of ['maneuver-ship', 'battery', 'crew-test-rude-epreuve', 'ship-reload']) {
      expect(publiees, `« ${id} » n’est pas branchée (aucun dispatcher publié)`).toContain(id);
    }
    // Manœuvrer / Bordée / Rude épreuve : Action du navire INTACTE → offertes (gates du registre).
    for (const id of ['maneuver-ship', 'battery', 'crew-test-rude-epreuve']) {
      expect(caseAction(id)!.disabled, `« ${id} » est inerte alors que l’Action du navire est intacte`).toBe(false);
    }
    // … et aucune case de FANTASSIN ne s'invite : une coque n'a ni poing ni Charge.
    expect(caseAction('attaque'), 'une coque n’a pas d’attaque d’arme').toBeNull();
    expect(caseAction('charge'), 'une coque ne charge pas').toBeNull();
  });

  it('N-2 — la Bordée ARME son mode par le registre, et l’interlude prend la main pour en sortir', () => {
    monterNavire();
    act(() => caseAction('battery')!.click());
    expect(useGame.getState().battle!.action, 'la case Bordée n’a pas armé le mode').toBe('battery');
    // Le mode armé est un CIBLAGE par la carte : la console passe sous son bandeau de phase, et c'est
    // LUI qui porte la sortie (aucune case ne reste cliquable pendant un interlude).
    expect(host.querySelector('.cc-phase .cc-phase-label')!.textContent).toBe('Bordée');
    const sortie = host.querySelector('.cc-phase [data-action="battery-cancel"]') as HTMLButtonElement;
    act(() => sortie.click());
    expect(useGame.getState().battle!.action, 'la sortie d’interlude doit désarmer la bordée').toBeNull();
  });

  it('N-3 — la fin de tour passe au tour du navire (garde-fou « Action non dépensée » compris)', () => {
    monterNavire();
    const fin = host.querySelector('[data-cell="end-turn"]') as HTMLButtonElement;
    expect(fin.disabled, 'la fin de tour est inerte au tour du navire').toBe(false);
    act(() => fin.click()); // 1ᵉʳ clic : Action du navire non dépensée → confirmation armée
    expect((host.querySelector('[data-cell="end-turn"]') as HTMLElement).hasAttribute('data-armed')).toBe(true);
    act(() => (host.querySelector('[data-cell="end-turn"]') as HTMLButtonElement).click());
    expect(useGame.getState().battle!.turn, 'le tour du navire n’est pas passé').not.toBe(0);
  });

  it('N-4 — une pièce DÉJÀ chargée éteint la recharge (restriction de site), la case restant dessinée', () => {
    const crew = hero('gunner', 'Artilleur');
    const ship = navire();
    ship.postes = [{ ...poste(), loaded: true } as ShipPoste];
    act(() => {
      useGame.setState({
        party: [crew], scene: emptyScene(20, 20),
        battle: {
          combatants: [ship, crew], order: [ship.id, crew.id], baseOrder: [ship.id, crew.id], turn: 0, round: 1,
          action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
          acted: false, runBudget: 4, log: [], over: null, crewActed: {},
        } as unknown as BattleState,
      });
    });
    act(() => { root.render(<CombatConsole />); });
    expect(caseAction('ship-reload'), 'la géométrie ne perd jamais une case').not.toBeNull();
    expect(estFermee(caseAction('ship-reload')!)).toBe(true);
  });

  // Une coque n'a « ni arme tenue, ni sort, ni marche de fantassin » (`engine/vehicle.ts`) : les
  // gestes du CORPS ne lui sont pas offerts. Sans gate, « Défensive » restait vivante au tour du
  // navire et le clic BRÛLAIT son Action (celle de la Bordée) — le refus doit être visible et inerte.
  it('N-5 — les gestes de FANTASSIN sont fermés à la coque, avec leur raison, et ne s’exécutent pas', () => {
    monterNavire();
    for (const id of ['defend', 'course', 'mouvement']) {
      const c = caseAction(id);
      expect(c, `la géométrie garde sa case « ${id} »`).not.toBeNull();
      expect(estFermee(c!), `« ${id} » reste cliquable au tour d’une coque`).toBe(true);
      const attendue = actionGate(id, { active: useGame.getState().battle!.combatants[0], battle: useGame.getState().battle! }).reason;
      expect(refusAuSurvol(c!), `« ${id} » se ferme sans dire pourquoi au survol`).toBe(attendue);
      const copie = c!.querySelector('.hors-ecran[data-gate]');
      expect(copie?.textContent, `« ${id} » : rien à lire pour un lecteur d’écran`).toBe(attendue);
      expect(texteVisible(c!), `« ${id} » grave encore sa raison dans la case`).not.toContain(attendue);
      expect(c!.getAttribute('aria-describedby')).toBe(copie!.id);
    }
    // … et le clic ne mange PAS l'Action du navire (elle reste à la Bordée).
    act(() => caseAction('defend')!.click());
    expect(useGame.getState().battle!.acted, 'la Défensive a dépensé l’Action de la coque').toBe(false);
    expect(useGame.getState().battle!.combatants[0].defensiveStance).toBeFalsy();
    expect(caseAction('battery')!.disabled, 'l’Action du navire doit rester offerte à la Bordée').toBe(false);
  });
});

describe('CombatConsole — COOP : la console suit la POSSESSION, jamais le mode de partie', () => {
  const enAttente = () => !!host.querySelector('.cc-phase');
  /** Deux héros de sièges différents, un combat, et le siège LOCAL est 0 (hôte). */
  function monterCoop(turn: number) {
    const a = hero('h1', 'Gunnar');
    const b = hero('h2', 'Rolf');
    act(() => {
      useGame.setState({
        party: [a, b], scene: emptyScene(20, 20),
        net: { ...useGame.getState().net, mode: 'host', mySeat: 0, ownership: { h1: 0, h2: 1 } },
        battle: {
          combatants: [a, b], order: [a.id, b.id], baseOrder: [a.id, b.id], turn, round: 1,
          action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
          acted: false, runBudget: 4, log: [], over: null,
        } as unknown as BattleState,
      });
    });
    act(() => { root.render(<CombatConsole />); });
  }
  afterEach(() => { act(() => { useGame.setState({ net: { ...useGame.getState().net, mode: 'local', ownership: {} } }); }); });

  it('C-1 — en partie RÉSEAU, le siège qui tient l’actif a une console VIVANTE', () => {
    monterCoop(0); // tour de « h1 », possédé par le siège local (0)
    expect(enAttente(), 'la console de MON héros ne doit pas être en lecture').toBe(false);
    expect((host.querySelector('[data-cell="end-turn"]') as HTMLButtonElement).disabled).toBe(false);
    expect(
      hotbar.capacites.some((s) => s?.run && !s.disabled),
      'aucune case branchée : le pont clavier est mort',
    ).toBe(true);
  });

  // Le tour d'un AUTRE siège est un tour non contrôlé comme un autre : la console y prend la FORME
  // SPECTATRICE (même fiche que le tour d'un ennemi,
  // `.claude/memory/user-arbitrage-tour-adverse-console-spectatrice-jamais-pont-entier.md`).
  // Ce contrat verrouillait « mêmes cases, inertes ».
  it('C-2 — le tour du héros d’un AUTRE siège : forme SPECTATRICE, et la puce nomme le siège', () => {
    monterCoop(1); // tour de « h2 », possédé par le siège 1
    expect(enAttente(), 'le tour d’autrui doit porter sa bande d’attente').toBe(true);
    expect(host.querySelector('.combat-console')!.getAttribute('data-forme')).toBe('spectatrice');
    // Plus une seule case à cliquer — parce qu'il n'y a plus une seule case. Rien n'est grisé.
    expect(host.querySelectorAll('.cc-cell').length, 'les cases survivent au tour d’autrui').toBe(0);
    expect(host.querySelector('[data-cell="end-turn"]'), 'la plaque de fin de tour survit').toBeNull();
    // L'arche seule montre l'ALLIÉ que l'autre siège joue (jamais en teinte hostile), et la puce coop
    // reste : c'est elle qui dit QUI joue.
    const arche = host.querySelector('.cc-arch')!;
    expect(arche.querySelector('.ptile')!.classList.contains('team-enemy')).toBe(false);
    expect(arche.querySelector('.cc-arch-name')!.textContent).toBe('Rolf');
    expect(host.querySelector('.spectator-chip'), 'la puce coop doit rester').not.toBeNull();
  });
});

/**
 * DISSIPATION JOUABLE (spec HUD §1d, LDB 46 l.158-162) — l'alvéole ARME le mode, le clic-token élit
 * le PORTEUR (`DISPEL_MODE`), et le SORT se choisit au PANNEAU-PARAMÈTRE né de cette même alvéole.
 * La progression du Test étendu se lit sur la case.
 */
describe('CombatConsole — Dissiper : alvéole → porteur → panneau-paramètre', () => {
  /** Un mage capable de dissiper (Langue (Magick)) — le gate de la case le lit sur ses Compétences. */
  function mage() {
    const h = hero('h1', 'Elsa');
    h.skills.push({ id: 'langue', spec: 'magick', advances: 2 } as never);
    return h;
  }

  /** Marque un combattant PORTEUR de `n` Sorts permanents (effets `ActiveEffect.spell`, cf. `engine/dispel`). */
  function porteur(c: Combatant, n: number) {
    c.activeEffects = Array.from({ length: n }, (_, i) => ({
      label: `Effet ${i + 1}`,
      spell: { spellId: `sort-${i + 1}`, casterId: 'e1', label: `Sort ${i + 1}`, ni: 3 + i },
    })) as never;
  }

  const panneau = () => document.body.querySelector('[data-panneau-parametre]');
  const options = () => [...(panneau()?.querySelectorAll('button') ?? [])];

  // `battleSelectAction` (l'armement du mode) exige une SCÈNE : sans elle, la case cliquée n'arme rien.
  beforeEach(() => { useGame.setState({ scene: emptyScene() }); });
  afterEach(() => { useGame.setState({ dispelCarrierId: null, pendingDispel: null, battle: null }); });

  it('l’alvéole Dissiper existe dès qu’un Sort permanent est en jeu, et le clic ARME le mode', () => {
    const h = mage();
    const e = foe('e1', 6, 5);
    porteur(e, 2);
    monter(h, { foes: [e] });
    const cell = host.querySelector('[data-action="dispel"]') as HTMLButtonElement;
    expect(cell, 'aucune alvéole Dissiper').toBeTruthy();
    act(() => { cell.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(useGame.getState().battle!.action).toBe('dispel');
  });

  it('clic-porteur (2 Sorts) → panneau BORNÉ à SES Sorts ; le clic COMMET `dispel-spell` avec les bons ids', () => {
    const h = mage();
    const e = foe('e1', 6, 5);
    porteur(e, 2);
    monter(h, { foes: [e] });
    act(() => { (host.querySelector('[data-action="dispel"]') as HTMLButtonElement).dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    // Le clic-token du champ passe par la MÊME porte que la carte (`battleClickEntity`).
    act(() => { useGame.getState().battleClickEntity('e1'); });
    expect(useGame.getState().dispelCarrierId).toBe('e1');
    expect(options().map((b) => b.textContent), 'un candidat par Sort de CE porteur, NI en méta')
      .toEqual(['Sort 1NI 3', 'Sort 2NI 4']);
    act(() => { options()[1].dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(useGame.getState().pendingDispel).toMatchObject({ spellId: 'sort-2', spellCasterId: 'e1', ni: 4 });
    expect(panneau(), 'le panneau se referme sur son commit').toBeNull();
  });

  it('ÉCHAP referme le panneau sans rien dissiper (annulation gratuite)', () => {
    const h = mage();
    const e = foe('e1', 6, 5);
    porteur(e, 2);
    monter(h, { foes: [e] });
    act(() => { (host.querySelector('[data-action="dispel"]') as HTMLButtonElement).dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    act(() => { useGame.getState().battleClickEntity('e1'); });
    expect(panneau()).toBeTruthy();
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(panneau()).toBeNull();
    expect(useGame.getState().pendingDispel).toBeNull();
    expect(useGame.getState().battle!.action, 'le mode reste armé : on vise un autre porteur').toBe('dispel');
  });

  it('l’alvéole PORTE la progression du Test étendu (DR cumulé / NI) dès qu’un Sort est entamé', () => {
    const h = mage();
    h.dispel = { spellId: 'sort-1', spellCasterId: 'e1', total: 2 };
    const e = foe('e1', 6, 5);
    porteur(e, 2);
    monter(h, { foes: [e] });
    const cell = host.querySelector('[data-action="dispel"]') as HTMLButtonElement;
    expect(cell.querySelector('.cc-lbl')?.textContent).toBe(`${findActionById('dispel')!.label} 2/3`);
  });

  // ON VISE, ON NE LIT PAS : un mode de ciblage armé met les popovers de règle de la console en
  // SOURDINE — le pavé de règle de la case armée (ouvert par le focus que son propre clic lui donne)
  // recouvrait la bandelette de refus du survol et quatre cases du pont (sonde du juge vision,
  // captures 08/09). Le mode dissous, la règle revient : l'information n'est pas retirée, elle attend.
  it('mode de ciblage ARMÉ : le popover de règle de la case se tait, et revient au désarmement', () => {
    const h = mage();
    const e = foe('e1', 6, 5);
    porteur(e, 2);
    monter(h, { foes: [e] });
    const cell = () => host.querySelector('[data-action="dispel"]') as HTMLButtonElement;
    const survole = () => {
      act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
      act(() => { cell().closest('.codex-ref')!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
      return document.body.querySelector('.codex-pop[role="tooltip"]');
    };
    expect(survole(), 'témoin : rien d’armé, la règle de la case s’ouvre au survol').not.toBeNull();

    act(() => { cell().dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(useGame.getState().battle!.action, 'témoin : le mode doit être armé').toBe('dispel');
    expect(survole(), 'pavé de règle ouvert pendant qu’on vise : il recouvre ce que le clic a armé').toBeNull();

    act(() => { cell().dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(useGame.getState().battle!.action, 'témoin : le re-clic dissout le mode').toBeNull();
    expect(survole(), 'le mode dissous, la règle doit revenir').not.toBeNull();
  });
});

/**
 * MUNITION JOUABLE DEPUIS LA CONSOLE (#1411 P1-B, spec §1a + zone 10) : la munition vit à l'EN-TÊTE de
 * travée, et ce chip EST le déclencheur du choix — panneau BORNÉ aux munitions compatibles de l'arme,
 * conséquence RENDUE sur le candidat qui déchargera, annulation gratuite. Le commit passe par le
 * registre (`select-ammo` → `battleSelectAmmo`), jamais par une closure de site.
 */
describe('CombatConsole — munition : le chip de l’en-tête est le DÉCLENCHEUR du choix', () => {
  const objet = (id: string, uid: string, over: Partial<ItemInstance> = {}) =>
    Object.assign(itemFromTrappingById(id)!, { uid }, over) as ItemInstance;

  /** Arbalétrier au set de tir, avec DEUX munitions compatibles (même famille) dans sa besace. */
  function tireur(opts: { charge?: boolean; deuxMunitions?: boolean } = {}) {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    const arb = objet('arbalete-lourde', 'i-arb');
    h.items = [
      arb,
      objet('carreau', 'i-c', { qty: 12 }),
      ...(opts.deuxMunitions === false ? [] : [objet('carreau', 'i-c2', { label: 'Carreau perçant', qty: 5 })]),
    ];
    h.loadouts = [{ id: 'lo-tir', main: 'i-arb' }];
    h.activeLoadoutId = 'lo-tir';
    recomputeLoadout(h);
    // Le chargement passe par le MOTEUR (jamais un registre forgé) : c'est lui qui capture la munition.
    if (opts.charge !== false) loadWeapon(h, h.weapons.find((w) => w.type === 'ranged')!);
    return h;
  }

  const chip = () => host.querySelector('.cc-bay-head button[data-ammo]') as HTMLButtonElement | null;
  const panneau = () => document.body.querySelector('[data-panneau-parametre]');
  const candidats = () => [...(panneau()?.querySelectorAll('button') ?? [])];
  const ouvrir = () => act(() => { chip()!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  /** L'acteur tel que le STORE le porte après un dispatch (jamais l'objet de départ). */
  const acteur = () => useGame.getState().battle!.combatants[0];

  afterEach(() => { useGame.setState({ battle: null }); });

  it('DEUX munitions compatibles : le chip est un BOUTON qui ouvre un panneau BORNÉ à ces munitions', () => {
    monter(tireur());
    expect(chip(), 'le chip de munition doit être actionnable dès qu’il y a un choix').not.toBeNull();
    expect(chip()!.getAttribute('aria-haspopup')).toBe('dialog');
    expect(panneau(), 'aucun panneau avant le clic').toBeNull();
    ouvrir();
    expect(panneau()).toBeTruthy();
    // La conséquence ne pend qu'au candidat qui DÉCHARGERA : celui en chambre ne la porte pas.
    expect(candidats().map((b) => b.textContent)).toEqual(['Carreau×12valeur actuelle', 'Carreau perçant×5décharge — rechargement à refaire']);
    // La munition EN CHAMBRE est MARQUÉE (état, pas une simple mise en avant) — et son marquage est
    // LISIBLE : l'état ferré `aria-pressed`, une règle qui le PEINT, ET un mot à l'écran (un état
    // qu'aucune règle ne peint ne marque rien : sonde du juge vision).
    expect(candidats().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    expect(ruleOf(baseSection(BASE_CSS), ".btn[aria-pressed='true']"), 'l’état pressé n’est peint nulle part').toMatch(/border-color|box-shadow|background/);
    expect(candidats().map((b) => b.querySelector('[data-actuel]')?.textContent ?? null)).toEqual(['valeur actuelle', null]);
  });

  it('le clic COMMET `select-ammo` avec les bons ids : l’arme change de munition ET se décharge', () => {
    const h = tireur();
    const w = h.weapons.find((x) => x.type === 'ranged')!;
    expect(weaponLoaded(h, w), 'témoin : l’arme part chargée').toBe(true);
    monter(h);
    ouvrir();
    act(() => { candidats()[1].dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const c = acteur();
    expect(selectedAmmo(c, w)?.uid, 'la munition choisie est celle du candidat cliqué').toBe('i-c2');
    expect(weaponLoaded(c, w), 'changer la munition d’une arme chargée la décharge (dispatcher)').toBe(false);
    expect(panneau(), 'le panneau se referme sur son commit').toBeNull();
  });

  it('la CONSÉQUENCE n’est rendue que là où le dispatcher déchargera VRAIMENT (arme non chargée : aucune)', () => {
    monter(tireur({ charge: false }));
    ouvrir();
    expect(candidats().map((b) => b.textContent)).toEqual(['Carreau×12valeur actuelle', 'Carreau perçant×5']);
    expect(panneau()!.textContent).not.toContain('rechargement à refaire');
  });

  it('ÉCHAP referme sans rien engager (annulation gratuite : la munition ne bouge pas)', () => {
    const h = tireur();
    const w = h.weapons.find((x) => x.type === 'ranged')!;
    monter(h);
    ouvrir();
    expect(panneau()).toBeTruthy();
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(panneau()).toBeNull();
    expect(selectedAmmo(acteur(), w)?.uid).toBe('i-c');
    expect(weaponLoaded(acteur(), w), 'aucune décharge : rien n’a été commis').toBe(true);
  });

  it('UNE SEULE munition compatible : chip INFORMATIF seul — aucun panneau à un candidat', () => {
    monter(tireur({ deuxMunitions: false }));
    expect(chip(), 'un panneau à une valeur ne choisit rien').toBeNull();
    expect(host.querySelector('.cc-bay-head [data-ammo]'), 'la munition reste LUE dans l’en-tête').not.toBeNull();
  });

  it('FRÉNÉSIE : le choix est REFUSÉ et le refus se LIT au survol (raison du registre), jamais escamoté', () => {
    const h = tireur();
    h.psychState = [{ type: 'frenesie' }] as never;
    monter(h);
    expect(chip(), 'le chip reste à l’écran : le refus ne fait pas disparaître l’affordance').not.toBeNull();
    expect(chip()!.getAttribute('aria-disabled'), 'le chip refusé doit rester focalisable, donc `aria-disabled`').toBe('true');
    expect(chip()!.disabled).toBe(false);
    // Le chip garde sa ligne d'en-tête PROPRE : la raison naît de son survol, dans la même infobulle que
    // sa fiche de munition (arbitrage user 2026-08-24), et son `aria-describedby` reste câblé.
    expect(refusAuSurvol(chip()!), 'la raison ne se lit pas au survol du chip').toBe(t('agate.frenzyOnly'));
    const copie = host.querySelector('.cc-bay-head [data-gate]')!;
    expect(copie.textContent).toBe(t('agate.frenzyOnly'));
    expect(copie.className, 'la copie de la raison doit être HORS ÉCRAN').toContain('hors-ecran');
    expect(chip()!.getAttribute('aria-describedby')).toBe(copie.id);
    expect(chip()!.getAttribute('title'), 'infobulle native proscrite').toBeNull();
  });

  // Le panneau appartient à l'ARME qui l'a ouvert. Commuter de set refait l'arme au poing : le chip
  // déclencheur du set précédent n'existe plus, et un panneau qui lui survit est un FANTÔME — ancré
  // à rien, et il garde le popover de règle du chip en sourdine (`suppressPopover`) sans plus aucun
  // moyen de se refermer. L'autre set porte lui aussi une arme de tir : sans remise à zéro, la
  // condition de rendu du panneau resterait vraie.
  it('COMMUTER DE SET referme le panneau (il appartient à l’arme qui l’a ouvert)', () => {
    const h = tireur();
    h.items = [
      ...h.items!,
      objet('arc', 'i-arc'),
      objet('fleche', 'i-f', { qty: 10 }),
      objet('fleche', 'i-f2', { label: 'Flèche barbelée', qty: 4 }),
    ];
    h.loadouts = [...h.loadouts!, { id: 'lo-arc', main: 'i-arc' }];
    monter(h);
    ouvrir();
    expect(panneau(), 'témoin : le panneau doit être ouvert avant la commutation').toBeTruthy();
    act(() => { useGame.getState().battleSwitchLoadout('lo-arc'); });
    act(() => { root.render(<CombatConsole />); });
    expect(acteur().weapons.some((w) => w.type === 'ranged'), 'témoin : l’autre set porte AUSSI une arme de tir').toBe(true);
    expect(panneau(), 'panneau FANTÔME : il a survécu à l’arme qui l’avait ouvert').toBeNull();
  });
});

// ── GESTE ADOSSÉ À LA GOUTTIÈRE DE MOUVEMENT (#1411 P1 lot C, spec §1c) ─────────────────────────
// L'annulation du déplacement n'est pas une case de plus : elle vit sur la ressource qu'elle rend.
// Le contrat est une AFFORDANCE-VÉRITÉ — elle n'est à l'écran que là où `cancelMove` mordrait
// vraiment. Le compteur `movementUsed` ne suffit pas à le dire : `battleStandUp` l'écrit SANS poser
// de `moveSnapshot` (`combatSlice.ts:1663`), et le dispatcher n'aurait alors rien à restaurer.
describe('CombatConsole — annuler le déplacement, sur la gouttière de Mouvement', () => {
  const geste = () => host.querySelector('.cc-gutter-move [data-action="undo-move"]') as HTMLButtonElement | null;

  beforeEach(() => { useGame.setState({ scene: emptyScene(20, 20) }); });

  it('Mouvement dépensé SANS segment restaurable (relevé) : AUCUN geste — pas de bouton mort', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [{ id: 'a-terre', value: 1 }] as ConditionInstance[];
    monter(h);
    act(() => { useGame.getState().battleStandUp(); });
    const st = useGame.getState().battle!;
    // Le relevé a bien consommé du Mouvement — et n'a laissé AUCUN instantané à défaire.
    expect(st.movementUsed, 'la sonde ne mesurerait rien sans Mouvement dépensé').toBeGreaterThan(0);
    expect(st.moveSnapshot ?? null).toBeNull();
    act(() => { root.render(<CombatConsole />); });
    expect(geste(), 'geste rendu alors que `cancelMove` no-operait : affordance morte').toBeNull();
  });

  it('après une Marche : le geste EXISTE, le clic RESTAURE la position, puis le geste meurt', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h);
    const depart = { ...h.pos! };
    act(() => { useGame.getState().battleClickTile({ x: depart.x + 1, y: depart.y }, { confirm: true }); });
    act(() => { root.render(<CombatConsole />); });
    const st = useGame.getState().battle!;
    expect(st.movementUsed, 'aucun segment commis : la sonde mesurerait le vide').toBeGreaterThan(0);
    expect(st.combatants[0].pos).toEqual({ x: depart.x + 1, y: depart.y });
    const bouton = geste();
    expect(bouton, 'aucun geste d’annulation sur la gouttière de Mouvement').toBeTruthy();
    // Le nom accessible vient de l'ENTRÉE du registre, jamais d'un littéral du composant.
    expect(bouton!.getAttribute('aria-label')).toBe(findActionById('undo-move')!.label);
    act(() => { bouton!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const apres = useGame.getState().battle!;
    expect(apres.combatants[0].pos, 'le clic n’a pas restauré la position').toEqual(depart);
    expect(apres.movementUsed).toBe(0);
    act(() => { root.render(<CombatConsole />); });
    expect(geste(), 'le gate est mort avec le segment : plus rien à annuler, plus rien à l’écran').toBeNull();
  });

  it('une Action prise ferme le geste (aide PRÉ-Action, même verdict que le dispatcher)', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h);
    const depart = { ...h.pos! };
    act(() => { useGame.getState().battleClickTile({ x: depart.x + 1, y: depart.y }, { confirm: true }); });
    act(() => { root.render(<CombatConsole />); });
    expect(geste()).toBeTruthy();
    act(() => { useGame.setState({ battle: { ...useGame.getState().battle!, acted: true } }); });
    act(() => { root.render(<CombatConsole />); });
    expect(geste(), 'l’Action prise, `cancelMove` ne mord plus : le geste ne doit pas rester offert').toBeNull();
  });

  // GÉOMÉTRIE IMMUABLE (loi 1) : la venue du geste ne DÉPLACE rien — sa place est réservée dans
  // TOUTE gouttière. Sonde du juge vision : la boîte du compteur MOUV. remontait de 13px (y 810→797)
  // au moment où « Annuler dépl. » apparaissait.
  it('la place du geste est RÉSERVÉE : le socle a les mêmes voisins et le même rang, geste ou pas', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h);
    const rangs = () => {
      const g = host.querySelector('.cc-gutter-move')!;
      const enfants = [...g.children];
      return {
        formes: enfants.map((el) => (el.classList.contains('cc-gutter-rail') ? 'rail' : el.classList.contains('cc-socle') ? 'socle' : el.hasAttribute('data-geste') ? 'slot-geste' : 'autre')),
        socle: enfants.findIndex((el) => el.classList.contains('cc-socle')),
      };
    };
    const avant = rangs();
    expect(avant.formes, 'le slot du geste doit être dessiné même sans geste offert').toEqual(['rail', 'socle', 'slot-geste']);
    expect(host.querySelector('.cc-gutter-move [data-geste]')!.children.length, 'slot vide tant que rien n’est à annuler').toBe(0);

    const depart = { ...h.pos! };
    act(() => { useGame.getState().battleClickTile({ x: depart.x + 1, y: depart.y }, { confirm: true }); });
    act(() => { root.render(<CombatConsole />); });
    expect(geste(), 'témoin : sans geste offert la sonde ne mesurerait rien').toBeTruthy();
    expect(rangs(), 'la venue du geste a changé la place du socle').toEqual(avant);
    expect(geste()!.parentElement!.hasAttribute('data-geste'), 'le geste naît DANS le slot réservé').toBe(true);

    // … et le slot porte une HAUTEUR FIXE en CSS : occupé ou vide, il occupe la même bande.
    const slot = ruleOf(CC_BASE, '.cc-gutter > [data-geste]');
    expect(decl(slot, 'height'), 'sans hauteur déclarée, le slot vide se replie et le compteur remonte').toMatch(/^\d+px$/);
    expect(decl(slot, 'flex')).toBe('0 0 auto');
  });

  // Le geste DIT ce qu'il fait et s'atteint au doigt : glyphe de 26px, sans mot, cible 32×26 mesurée
  // par le juge vision. Le mot est à l'écran, le libellé ENTIER reste le nom accessible (jamais un
  // `title`), et la zone de touche vaut ≥44px À TOUS LES POINTEURS, hors flux (la plaque ne grandit pas).
  it('le geste porte un MOT visible, son nom accessible entier, et une cible ≥44px hors flux', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h);
    const depart = { ...h.pos! };
    act(() => { useGame.getState().battleClickTile({ x: depart.x + 1, y: depart.y }, { confirm: true }); });
    act(() => { root.render(<CombatConsole />); });
    const bouton = geste()!;
    expect(bouton.querySelector('i')!.textContent, 'le geste ne dit rien à l’écran').toBe('ANNULER');
    expect(bouton.getAttribute('aria-label')).toBe(findActionById('undo-move')!.label);
    expect(bouton.hasAttribute('title'), 'la raison ne passe jamais par une infobulle native').toBe(false);
    // La cible tactile est posée HORS de toute tranche de pointeur (elle vaut partout).
    const cible = ruleOf(CC_BASE, 'button.cc-socle::before');
    expect(decl(cible, 'position')).toBe('absolute');
    // Le PLANCHER de la zone de contact, quelle que soit la taille du socle : c'est la norme qui
    // est gardée, pas l'écriture du `max()`.
    const plancher = (v: string) => Math.max(...[...v.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])), 0);
    for (const cote of ['width', 'height']) {
      expect(plancher(decl(cible, cote)!), `cible tactile : ${cote} sous le plancher`).toBeGreaterThanOrEqual(44); // norme: cible tactile 44px au doigt (charte UI règle 4)
    }
  });
});

// ── PLAFOND D'AVANTAGE : un REFUS VISIBLE, jamais une case qui s'évapore (#1411 P1) ─────────────
// Spec HUD § « ARBITRAGE 2026-08-19 » : le refus se VOIT. Une méthode d'Avantage déjà au plafond de
// sa Caractéristique (LDB 09 l.305-308) ne peut plus rien rendre — mais faire disparaître sa case
// privait le joueur de la RAISON, et le laissait chercher une affordance qu'il avait vue au tour
// d'avant. Le verdict est donc le gate `avantage-sous-plafond` (`actionRegistry.ts`), source UNIQUE :
// le sélecteur `competences-avantage` (`actionRegistry.ts:192`) ne filtre plus rien.
describe('CombatConsole — Avantage au plafond : la case reste, FERMÉE, avec sa raison', () => {
  const casesAdv = () => [...host.querySelectorAll('[data-action="gain-advantage"]')] as HTMLButtonElement[];

  it('à Avantage 0 la case est OUVERTE ; au plafond elle reste dessinée, désactivée, raison à l’écran', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    h.advantage = 0;
    // Intuition (LDB 09 l.305-308) : Compétence de BASE dont la donnée porte `combatAdvantage` —
    // plafond = Bonus d'Intelligence. C'est la méthode que la case offre.
    h.skills = [{ id: 'intuition', advances: 0 }] as never;
    monter(h);
    const offertes = casesAdv();
    expect(offertes.length, 'aucune case d’Avantage : la sonde ne mesurerait rien').toBeGreaterThan(0);
    expect(offertes.every((b) => !b.disabled), 'à Avantage 0 aucune méthode n’est au plafond').toBe(true);
    expect(host.querySelector('[data-action="gain-advantage"] [data-gate]'), 'aucune raison ne doit s’afficher tant que rien ne refuse').toBeNull();
    // Au PLUS HAUT plafond offert, plus AUCUNE méthode ne peut rendre un cran.
    const cap = Math.max(
      ...ACTION_CANDIDATES['competences-avantage']({ active: h, battle: useGame.getState().battle! } as never)
        .map((s) => (s as { cap: number }).cap),
    );
    act(() => {
      const b = useGame.getState().battle!;
      useGame.setState({ battle: { ...b, combatants: b.combatants.map((c) => (c.id === h.id ? { ...c, advantage: cap } : c)) } as BattleState });
    });
    act(() => { root.render(<CombatConsole />); });
    const fermees = casesAdv();
    expect(fermees.length, 'la case a DISPARU au plafond : le refus est devenu muet').toBe(offertes.length);
    expect(fermees.every((b) => estFermee(b)), 'case au plafond encore cliquable').toBe(true);
    expect(refusAuSurvol(fermees[0]), 'la raison du refus ne s’ouvre pas au survol').toBe(t('agate.advantageCapped', { n: cap }));
    const raison = host.querySelector('[data-action="gain-advantage"] [data-gate]');
    expect(raison?.textContent, 'la copie accessible de la raison a disparu').toBe(t('agate.advantageCapped', { n: cap }));
    expect(fermees[0].getAttribute('aria-describedby')).toBe(raison!.id);
  });
});

/**
 * UNE CASE QUI ARME UN MODE LIT SON MODE AU REGISTRE (`armed` de son entrée d'`actions.json`) — la
 * console ne recopie aucune valeur de `battle.action`. Même patron que l'intention locale : allumée
 * tant que SON mode est armé, et le re-clic le dissout (`toggleOff` déduit, jamais passé au site).
 */
describe('CombatConsole — l’allumage d’une case armée vient du REGISTRE', () => {
  const caseCell = (key: string) => host.querySelector(`[data-cell="${key}"]`) as HTMLButtonElement | null;

  /** Un héros CAPABLE de soigner (Compétence Guérison) et BLESSÉ : la case Soigner n'existe qu'avec
   *  au moins une cible soignable (`healableTargets` — lui-même en fait partie). */
  function soigneur() {
    const h = hero('h1', 'Gunnar');
    h.skills.push({ id: 'guerison', advances: 10 } as never);
    h.wounds = { ...h.wounds, current: h.wounds.max - 4 };
    return h;
  }

  it('Soigner : la case s’allume quand `battle.action` vaut l’`armed` de son entrée, et le re-clic désarme', () => {
    act(() => { useGame.setState({ scene: emptyScene() }); }); // `battleSelectAction` lit { battle, scene }
    monter(soigneur());
    const armed = findActionById('heal')!.armed;
    expect(armed, 'l’entrée « Soigner » du registre déclare le mode qu’elle arme').toBe('heal');
    expect(caseCell('q-soigner'), 'la case Soigner doit être à l’écran').not.toBeNull();
    expect(caseCell('q-soigner')!.className, 'rien n’est armé au départ').not.toContain(' on');

    act(() => { caseCell('q-soigner')!.click(); });
    expect(useGame.getState().battle!.action, 'le clic arme le mode DÉCLARÉ par l’entrée').toBe(armed);
    expect(caseCell('q-soigner')!.className, 'mode armé → la case est allumée').toContain(' on');

    act(() => { caseCell('q-soigner')!.click(); });
    expect(useGame.getState().battle!.action, 'le re-clic dissout le mode (toggleOff déduit)').toBeNull();
    expect(caseCell('q-soigner')!.className).not.toContain(' on');
  });
});

/**
 * DEUX ARMES À DISTANCE (#1411 P1-7, spec §1a + zone 10) : la géométrie de la travée ne bouge pas —
 * UNE case `Recharger` quel que soit le nombre d'armes. À plusieurs, elle ouvre un panneau-paramètre
 * BORNÉ (quelle arme ?) dont le clic COMMET `reload` avec SON `weaponUid` ; à une seule, elle
 * dispatche directement. La munition, elle, est une chip PAR arme dans l'EN-TÊTE (pas la grille).
 */
describe('CombatConsole — deux armes à distance : une case, un paramètre à élire', () => {
  const objet = (id: string, uid: string, over: Partial<ItemInstance> = {}) =>
    Object.assign(itemFromTrappingById(id)!, { uid }, over) as ItemInstance;

  /** Bretteur à DEUX pistolets (Recharge 1 chacun) et deux munitions compatibles au sac. */
  function bretteur(opts: { deux?: boolean; charges?: boolean } = {}) {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    h.items = [
      objet('pistolet', 'i-p1'),
      ...(opts.deux === false ? [] : [objet('pistolet', 'i-p2')]),
      objet('balle-et-poudre', 'i-a1', { qty: 12 }),
      objet('balle-et-poudre', 'i-a2', { label: 'Balle bénie', qty: 4 }),
    ];
    h.loadouts = [{ id: 'lo-2p', main: 'i-p1', ...(opts.deux === false ? {} : { off: 'i-p2' }) }];
    h.activeLoadoutId = 'lo-2p';
    recomputeLoadout(h);
    if (opts.charges) h.weapons.filter((w) => w.type === 'ranged').forEach((w) => loadWeapon(h, w));
    return h;
  }

  const panneau = () => document.body.querySelector('[data-panneau-parametre]');
  const candidats = () => [...(panneau()?.querySelectorAll('button') ?? [])];
  const caseRecharger = () => host.querySelector('[data-cell="g4-recharger"]') as HTMLButtonElement;
  const acteur = () => useGame.getState().battle!.combatants[0];

  afterEach(() => { useGame.setState({ battle: null, pendingReload: null }); });

  it('DEUX pistolets : UNE seule case Recharger (géométrie inchangée), et le clic OUVRE le choix de l’arme', () => {
    const h = bretteur();
    expect(h.weapons.filter((w) => w.type === 'ranged').length, 'témoin : les DEUX pistolets sont au set').toBe(2);
    monter(h);
    expect(host.querySelectorAll('[data-cell="g4-recharger"]').length, 'une arme de plus n’ajoute pas une case').toBe(1);
    expect(panneau(), 'aucun panneau avant le clic').toBeNull();
    act(() => { caseRecharger().dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(useGame.getState().pendingReload, 'le clic ne doit RIEN engager : l’arme reste à élire').toBeNull();
    expect(candidats().map((b) => b.textContent)).toEqual([
      'Pistoletmain directrice · à recharger',
      'Pistoletmain gauche · à recharger',
    ]);
  });

  it('le candidat élu COMMET `reload` avec SON uid (la 2ᵉ arme, pas la première du sac)', () => {
    monter(bretteur());
    act(() => { caseRecharger().dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    act(() => { candidats()[1].dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(useGame.getState().pendingReload?.weaponUid, 'le Test étendu doit porter l’arme CHOISIE').toBe('i-p2');
    expect(panneau(), 'le panneau se referme sur son commit').toBeNull();
  });

  it('ÉCHAP referme sans rien engager (annulation gratuite)', () => {
    monter(bretteur());
    act(() => { caseRecharger().dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(panneau()).toBeTruthy();
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(panneau()).toBeNull();
    expect(useGame.getState().pendingReload).toBeNull();
  });

  it('UNE arme à distance : dispatch DIRECT sur son uid — aucun panneau à un candidat', () => {
    monter(bretteur({ deux: false }));
    act(() => { caseRecharger().dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(panneau(), 'un panneau à une valeur ne choisit rien').toBeNull();
    expect(useGame.getState().pendingReload?.weaponUid).toBe('i-p1');
  });

  it('une arme DÉJÀ CHARGÉE reste au panneau, INERTE et son état dit (même mesure que le dispatcher)', () => {
    const h = bretteur();
    loadWeapon(h, h.weapons.find((w) => w.uid === 'i-p1')!);
    monter(h);
    act(() => { caseRecharger().dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(candidats().map((b) => b.textContent)).toEqual([
      'Pistoletmain directrice · chargée',
      'Pistoletmain gauche · à recharger',
    ]);
    expect(candidats().map((b) => (b as HTMLButtonElement).disabled)).toEqual([true, false]);
  });

  it('MUNITION : une chip PAR arme dans l’en-tête, et la 2ᵉ commet `select-ammo` sur SON arme', () => {
    const h = bretteur({ charges: true });
    monter(h);
    const chips = [...host.querySelectorAll('.cc-bay-head button[data-ammo]')] as HTMLButtonElement[];
    expect(chips.map((c) => c.getAttribute('data-ammo')), 'deux armes à distance = deux chips').toEqual(['i-p1', 'i-p2']);
    act(() => { chips[1].dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(panneau()!.textContent).toContain('Balle bénie');
    act(() => { candidats()[1].dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const c = acteur();
    const p1 = c.weapons.find((w) => w.uid === 'i-p1')!;
    const p2 = c.weapons.find((w) => w.uid === 'i-p2')!;
    expect(selectedAmmo(c, p2)?.uid, 'la munition élue va à l’arme de SA chip').toBe('i-a2');
    expect(selectedAmmo(c, p1)?.uid, 'l’autre arme n’a pas bougé').toBe('i-a1');
  });
});

/**
 * LE CHAMP `surface` DU REGISTRE DIT VRAI (#1411 P2, lot 0) — il NOMME le rendeur qui offre l'action,
 * et ce contrat le MESURE au DOM : pour chaque `[data-action]` rendu par la console, l'ancêtre
 * porteur trouvé doit être celui que sa `surface` déclare. Une entrée dont la surface n'est PAS de
 * console (pastille d'entité, frise) n'a par conséquent aucun bouton ici.
 * Le champ mentait sur quatre entrées (`hors-console` pour la gouttière d'annulation, le coin de fin
 * de tour, la colonne de sets, la frise) : la valeur fourre-tout est morte, chaque rendeur est nommé.
 */
describe('CombatConsole — contrat SURFACE ⇄ RENDEUR', () => {
  /** Le RENDEUR de chaque surface, par son ancre DOM. `null` = hors console (aucun bouton ici). */
  const RENDEUR: Record<ActionDef['surface'], string | null> = {
    'deduite-du-set': '.cc-bay-left',
    'geste-d-etat': '.cc-bay-left',
    grille: '.cc-bay-right',
    'gouttiere-arche': '.cc-gutter',
    'selecteur-de-sets': '.cc-sets',
    'coin-de-tour': '.cc-corner',
    'bandeau-de-phase': '.cc-phase',
    interlude: '.cc-phase',
    'pastille-etat': '.cc-arch',
    'pastille-entite': null,
    frise: null,
    // Un GESTE SECONDAIRE n'a AUCUNE alvéole propre : il vit sur celle de son hôte (clic droit,
    // appui long, touche Menu, RB) et ne pose donc jamais de `[data-action]`. Son rendeur RÉEL est
    // mesuré à part, plus bas (l'alvéole hôte porte `data-geste-2e`).
    'geste-secondaire': null,
  };
  const ANCRES = [...new Set(Object.values(RENDEUR).filter((s): s is string => !!s))];

  /** Pour chaque action rendue : son id, la surface DÉCLARÉE et le rendeur MESURÉ. */
  function mesure() {
    return [...host.querySelectorAll('[data-action]')].map((el) => {
      const id = el.getAttribute('data-action')!;
      const def = findActionById(id);
      const ancetre = el.closest(ANCRES.join(', '));
      return { id, surface: def?.surface ?? null, rendeur: ANCRES.find((sel) => ancetre?.matches(sel)) ?? null };
    });
  }

  /** Un porteur de set d'armes, ayant DÉJÀ marché (la gouttière offre alors son geste d'annulation). */
  function porteurAyantMarche() {
    const h = hero('h1', 'Gunnar');
    h.items = [Object.assign(itemFromTrappingById('epee-batarde')!, { uid: 'i-e1' }) as ItemInstance];
    h.loadouts = [{ id: 'lo-1', main: 'i-e1' }];
    h.activeLoadoutId = 'lo-1';
    recomputeLoadout(h);
    monter(h);
    act(() => {
      const b = useGame.getState().battle!;
      useGame.setState({ battle: { ...b, movementUsed: 1, moveSnapshot: { pos: { x: 5, y: 5 }, movementUsed: 0 } } as unknown as BattleState });
    });
    return h;
  }

  it('toute action rendue par la console l’est par LE rendeur que sa surface déclare', () => {
    porteurAyantMarche();
    const rendues = mesure();
    // Méta : sans cases lues, la garde serait verte à vide.
    expect(rendues.length, 'aucune action rendue : la mesure ne prouverait rien').toBeGreaterThan(5);
    const inconnues = rendues.filter((r) => r.surface === null).map((r) => r.id);
    expect(inconnues, 'case rendue par la console et INCONNUE du registre').toEqual([]);
    const menteuses = rendues
      .filter((r) => r.rendeur !== RENDEUR[r.surface!])
      .map((r) => `${r.id} : surface « ${r.surface} » (rendeur attendu ${RENDEUR[r.surface!] ?? 'AUCUN — hors console'}), rendu par ${r.rendeur ?? 'un conteneur non ancré'}`);
    expect(menteuses, `le champ \`surface\` ne décrit pas le rendeur réel :\n  ${menteuses.join('\n  ')}`).toEqual([]);
  });

  it('les rendeurs HORS-GRILLE sont bien couverts par la mesure (témoins nommés)', () => {
    porteurAyantMarche();
    const par = (id: string) => mesure().find((r) => r.id === id);
    expect(par('undo-move')?.rendeur, 'le geste d’annulation vit sur la gouttière de Mouvement').toBe('.cc-gutter');
    expect(par('end-turn')?.rendeur, 'la fin de tour vit au coin, isolée des travées').toBe('.cc-corner');
    expect(par('switch-loadout')?.rendeur, 'la commutation de set vit sur la vignette de set').toBe('.cc-sets');
    expect(par('attaque')?.rendeur, 'le geste déduit du set vit dans la travée gauche').toBe('.cc-bay-left');
  });

  it('aucune entrée à surface HORS CONSOLE n’a de bouton dans la console', () => {
    porteurAyantMarche();
    const horsConsole = ACTIONS.filter((a) => RENDEUR[a.surface] === null).map((a) => a.id);
    expect(horsConsole.length, 'méta : au moins une action vit hors de la console').toBeGreaterThan(0);
    const intruses = horsConsole.filter((id) => host.querySelector(`[data-action="${id}"]`));
    expect(intruses, 'action déclarée hors console mais rendue par elle').toEqual([]);
  });
});

/**
 * PAUSE DE ROUND EN COOP (#1411 P2-A) — le bouton du bandeau passait DIRECTEMENT par
 * `confirmRoundStart`, là où la touche (`keybindings.round-start`) routait vers `roundStartReady` en
 * réseau : deux branchements pour un geste, dont un qui ignorait le ready-check. Le bandeau consomme
 * l'entrée `round-start` du registre — LA porte, pour la souris comme pour la touche.
 */
describe('CombatConsole — pause de Round : UNE porte pour le bouton et la touche', () => {
  const bouton = () => host.querySelector('.cc-phase [data-action="round-start"]') as HTMLButtonElement | null;

  /** Combat en PAUSE de Round (personne n'agit : `turn: -1`), dans le mode réseau demandé. */
  function pause(mode: 'local' | 'host' | 'guest', round = 2) {
    const a = hero('h1', 'Gunnar');
    const b = hero('h2', 'Rolf');
    act(() => {
      useGame.setState({
        party: [a, b], scene: emptyScene(20, 20),
        net: { ...useGame.getState().net, mode, mySeat: mode === 'guest' ? 1 : 0, ownership: { h1: 0, h2: 1 }, seatNames: mode === 'local' ? {} : { 0: 'L’hôte', 1: 'Rolf' } },
        pendingRoundStart: { round },
        battle: {
          combatants: [a, b], order: [a.id, b.id], baseOrder: [a.id, b.id], turn: -1, round,
          action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
          acted: false, runBudget: 4, log: [], over: null,
        } as unknown as BattleState,
      });
    });
    act(() => { root.render(<CombatConsole />); });
  }

  afterEach(() => {
    act(() => { useGame.setState({ pendingRoundStart: null, net: { ...useGame.getState().net, mode: 'local', mySeat: 0, ownership: {}, seatNames: {} } }); });
  });

  it('SOLO — le bouton OUVRE le Round (aucun ready-check à respecter)', () => {
    pause('local');
    expect(bouton(), 'la pause de Round doit porter son geste').not.toBeNull();
    act(() => bouton()!.click());
    expect(useGame.getState().pendingRoundStart, 'le Round ne s’est pas ouvert').toBeNull();
  });

  it('COOP invité — le bouton MARQUE le siège prêt et n’ouvre RIEN (le quorum décide)', () => {
    pause('guest');
    act(() => bouton()!.click());
    const prs = useGame.getState().pendingRoundStart;
    expect(prs, 'un invité a lancé le Round pour toute la table').not.toBeNull();
    expect(prs!.readyBySeat, 'le clic de l’invité n’a pas marqué SON siège').toEqual({ 1: true });
  });

  it('COOP hôte — même porte : le clic marque le siège 0, et le Round attend l’autre siège requis', () => {
    pause('host');
    act(() => bouton()!.click());
    expect(useGame.getState().pendingRoundStart!.readyBySeat).toEqual({ 0: true });
    act(() => { useGame.getState().roundStartReady(1); });
    expect(useGame.getState().pendingRoundStart, 'quorum atteint : le Round devait s’ouvrir').toBeNull();
  });

  it('COOP — la bande porte la rangée des sièges REQUIS et éteint le bouton une fois ce siège prêt', () => {
    pause('host');
    expect(host.querySelectorAll('.cc-phase .ready-chip').length, 'deux sièges requis, deux chips').toBe(2);
    act(() => bouton()!.click());
    expect(bouton()!.disabled, 'un siège déjà prêt ne re-clique pas').toBe(true);
    expect(host.querySelectorAll('.cc-phase .ready-chip[data-pret]').length).toBe(1);
  });

  it('SOLO — aucune rangée de ready-check (personne à attendre)', () => {
    pause('local');
    expect(host.querySelector('.cc-phase .ready-row')).toBeNull();
  });
});

/**
 * QUI JOUE ? (#1411 P2-A) — depuis la mort de la barre v7 (e4bf4d73), le tour d'un siège DISTANT ne
 * s'annonçait plus nulle part : la console disait « Tour de X » sans nommer le JOUEUR qui le tient.
 * Elle compose la puce partagée (`SpectatorChip`). UNE seule puce à l'écran : quand l'arbitre de
 * modales en pose une (il dit ce que le siège FAIT), la bande d'attente lui laisse la parole.
 */
describe('CombatConsole — tour d’un siège distant : exactement UNE puce de spectateur', () => {
  const puces = () => host.querySelectorAll('.spectator-chip').length;

  function coop(turn: number, over: Partial<Record<string, unknown>> = {}) {
    const a = hero('h1', 'Gunnar');
    const b = hero('h2', 'Rolf');
    act(() => {
      useGame.setState({
        party: [a, b], scene: emptyScene(20, 20),
        net: { ...useGame.getState().net, mode: 'host', mySeat: 0, ownership: { h1: 0, h2: 1 }, seatNames: { 0: 'L’hôte', 1: 'Rolf' } },
        battle: {
          combatants: [a, b], order: [a.id, b.id], baseOrder: [a.id, b.id], turn, round: 1,
          action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
          acted: false, runBudget: 4, log: [], over: null,
        } as unknown as BattleState,
        ...over,
      });
    });
    act(() => { root.render(<><CombatConsole /><ActiveModal /></>); });
  }

  afterEach(() => {
    act(() => { useGame.setState({ pendingFall: null, net: { ...useGame.getState().net, mode: 'local', mySeat: 0, ownership: {}, seatNames: {} } }); });
  });

  it('tour DISTANT : une puce, qui NOMME le siège et le héros qu’il joue', () => {
    coop(1);
    expect(puces(), 'ni zéro (personne ne dit qui joue) ni deux').toBe(1);
    const puce = host.querySelector('.spectator-chip')!;
    expect(puce.textContent).toContain('Rolf');
    expect(puce.textContent).toContain('joue');
  });

  it('MON tour : aucune puce (la console vit)', () => {
    coop(0);
    expect(puces()).toBe(0);
  });

  it('modale DISTANTE ouverte pendant un tour distant : toujours UNE puce (l’arbitre parle, la bande se tait)', () => {
    coop(1, { pendingFall: { actorId: 'h2', from: { x: 1, y: 1 }, to: { x: 1, y: 3 }, height: 2 } });
    expect(useGame.getState().pendingFall, 'témoin : la modale distante doit être ouverte').not.toBeNull();
    expect(puces(), 'deux puces (arbitre + bande) ou aucune').toBe(1);
  });
});

/**
 * GESTE SECONDAIRE D'UNE ALVÉOLE (#1411 P2-B) — Focaliser n'est plus une case : c'est le geste
 * secondaire de l'alvéole du SORT (`surface: 'geste-secondaire'`, `hote: 'cast-spell'`), atteint au
 * clic droit, à l'appui long, à la touche Menu et à RB. Le rendeur est GÉNÉRIQUE : la console ne
 * nomme aucun id — elle apparie `hote` et population de candidats. Un geste de plus = une ligne de
 * JSON, ce que mesure ici une entrée FABRIQUÉE.
 */
describe('CombatConsole — geste secondaire de l’alvéole (Focaliser)', () => {
  const panneau = () => document.body.querySelector('[data-panneau-parametre]');
  const candidats = () => [...(panneau()?.querySelectorAll('button') ?? [])];
  const alveole = (spellId: string) => host.querySelector(`[data-cell="sort-${spellId}"]`) as HTMLButtonElement;

  /** Lanceur de sorts NU de Compétences (les alvéoles d'Avantage mangeraient les 12 cases de la
   *  grille avant les sorts) — SAUF Focalisation, Compétence AVANCÉE sans laquelle aucun Test de
   *  Focalisation n'est possible (`LDB 09 l.30`) : `focalisation: false` fait le lanceur qui ne l'a pas. */
  function mage(spells: string[], opts: { focalisation?: boolean } = {}) {
    const h = hero('h1', 'Magister');
    h.skills = opts.focalisation === false ? [] : [{ id: 'focalisation', characteristic: 'force-mentale', advances: 10 }];
    h.talents = [];
    h.spells = spells;
    return h;
  }

  afterEach(() => {
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    useGame.setState({ battle: null, pendingFocus: null });
  });

  it('un sort ARCANE : l’alvéole porte le geste, le clic droit le DISPATCHE (N=1 → aucun panneau)', () => {
    monter(mage(['carreau']));
    const cellule = alveole('carreau');
    expect(cellule, 'témoin : l’alvéole du sort est bien rendue').toBeTruthy();
    expect(cellule.getAttribute('data-geste-2e'), 'le geste secondaire est nommé en structure').toBe('focus-spell');
    act(() => { cellule.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); });
    expect(useGame.getState().pendingFocus?.spellId, 'le clic droit ouvre la Focalisation du sort de SON alvéole').toBe('carreau');
    expect(panneau(), 'un seul geste offert ne se choisit pas : dispatch direct').toBeNull();
  });

  it('la touche MENU (et Maj+F10) prend le MÊME chemin que le clic droit', () => {
    monter(mage(['carreau']));
    act(() => { alveole('carreau').dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true })); });
    expect(useGame.getState().pendingFocus?.spellId).toBe('carreau');
    act(() => { useGame.setState({ pendingFocus: null }); });
    act(() => { alveole('carreau').dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true })); });
    expect(useGame.getState().pendingFocus?.spellId).toBe('carreau');
  });

  it('l’APPUI LONG déclenche le geste, et le clic qui le suit est AVALÉ (pas d’incantation armée)', () => {
    monter(mage(['carreau']));
    const cellule = alveole('carreau');
    vi.useFakeTimers();
    try {
      act(() => { cellule.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 })); });
      act(() => { vi.advanceTimersByTime(600); });
      expect(useGame.getState().pendingFocus?.spellId, 'l’appui tenu ouvre la Focalisation').toBe('carreau');
      act(() => { cellule.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
      expect(useGame.getState().battle!.action, 'le clic de relâchement ne doit PAS armer l’incantation').toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('une PRIÈRE : N=1 REFUSÉ — aucun panneau, la raison se lit À LA CASE, rien au journal', () => {
    monter(mage(['benediction-de-chance']));
    const cellule = alveole('benediction-de-chance');
    const journal = useGame.getState().battle!.log.length;
    const refus = refusAuSurvol(cellule);
    expect(refus, 'le refus du geste unique se lit au SURVOL de l’alvéole').toContain(t('agate.spellNotFocusable'));
    expect(refus, 'le refus NOMME le geste fermé').toContain('Focaliser');
    const bande = cellule.querySelector('[data-gate-2e]') as HTMLElement;
    expect(bande.className, 'la copie de la raison est HORS ÉCRAN, pas gravée sous le nom').toContain('hors-ecran');
    expect(texteVisible(cellule), 'la case reste PROPRE').not.toContain(t('agate.spellNotFocusable'));
    expect(cellule.getAttribute('aria-describedby'), 'la raison est liée au nom accessible').toBe(bande.id);
    expect(cellule.getAttribute('aria-label'), 'le nom accessible ne promet pas un geste qu’il refuse')
      .toBe(`Bénédiction de Chance — ${t('cc.geste2eIndisponible', { geste: 'Focaliser', raison: t('agate.spellNotFocusable') })}`);
    expect(cellule.disabled, 'la CASE reste offerte : c’est son geste secondaire qui est fermé').toBe(false);
    // `data-gated` dit qu'une raison est PORTÉE (elle naît au survol) — quelle que soit son origine.
    expect(cellule.getAttribute('data-gated'), 'la case ne déclare pas porter la raison de son geste').toBe('');
    expect(cellule.getAttribute('data-refus-2e'), '… en disant que c’est le GESTE qui est fermé, pas elle').toBe('');
    act(() => { cellule.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); });
    expect(panneau(), 'un panneau à UN item désactivé n’est pas un paramètre : rien ne s’ouvre').toBeNull();
    expect(useGame.getState().pendingFocus, 'une Prière ne se focalise pas').toBeNull();
    expect(useGame.getState().battle!.log.length, 'un refus se DIT à l’écran, il ne part pas au journal').toBe(journal);
    act(() => { cellule.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true })); });
    expect(panneau(), 'la touche Menu n’ouvre rien non plus').toBeNull();
  });

  /** `LDB 09 l.30` (verbatim, `docs/raw/4e/competences.md`) : « Vous ne pouvez effectuer de Test de
   *  Compétence Avancée que si vous y avez ajouté au moins une Augmentation. » Focalisation EST
   *  Avancée (`skills.json`, accès « avancee ») — le geste doit se fermer AVANT le journal. */
  it('SANS la Compétence Focalisation : le geste est refusé à la CASE, et le journal reste muet', () => {
    monter(mage(['carreau'], { focalisation: false }));
    const cellule = alveole('carreau');
    const journal = useGame.getState().battle!.log.length;
    const bande = cellule.querySelector('[data-gate-2e]') as HTMLElement;
    expect(bande, 'le refus est ÉCRIT dans l’alvéole').toBeTruthy();
    expect(bande.textContent).toContain(t('agate.noFocusSkill', { name: 'Magister' }));
    act(() => { cellule.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); });
    expect(useGame.getState().pendingFocus, 'aucune modale de Focalisation ne s’ouvre').toBeNull();
    expect(panneau(), 'rien ne s’ouvre : le geste unique est fermé').toBeNull();
    expect(useGame.getState().battle!.log.length, 'le refus ne part pas au journal').toBe(journal);
    // TÉMOIN : la MÊME alvéole, chez un lanceur qui a la Compétence, dispatche.
    act(() => { useGame.setState({ battle: null }); });
    monter(mage(['carreau']));
    act(() => { alveole('carreau').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); });
    expect(useGame.getState().pendingFocus?.spellId).toBe('carreau');
  });

  it('MODE ARMÉ discriminé : le sort ÉLU allume SON alvéole, pas celle du voisin', () => {
    monter(mage(['carreau', 'bouclier-magique']));
    act(() => { alveole('carreau').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(useGame.getState().battle!.selectedSpellId, 'témoin : le clic arme bien l’incantation de CE sort').toBe('carreau');
    expect(alveole('carreau').classList.contains('on'), 'le sort élu s’allume').toBe(true);
    expect(alveole('bouclier-magique').classList.contains('on'), 'le mode `cast` seul n’allume pas les autres sorts').toBe(false);
  });

  it('DEUX gestes secondaires sur le même hôte (entrée FABRIQUÉE) : panneau ancré, 2 candidats, Échap gratuit', () => {
    const fabrique: ActionDef = {
      id: 'test-geste-2e-fabrique', label: 'Geste fabriqué', icon: 'flag/focus',
      surface: 'geste-secondaire', hote: 'cast-spell', gate: 'toujours',
      run: 'battleFocusSpell', candidates: 'sorts-du-heros', coutAction: 'gratuit',
    };
    ACTIONS.push(fabrique);
    try {
      monter(mage(['carreau']));
      const cellule = alveole('carreau');
      expect(cellule.getAttribute('data-geste-2e'), 'les DEUX gestes se lisent sur l’alvéole').toBe('focus-spell test-geste-2e-fabrique');
      expect(cellule.querySelector('[data-glyphe-2e]')!.textContent, 'à N≥2 le coin porte le COMPTE, pas le glyphe du premier').toBe('+2');
      expect(cellule.getAttribute('aria-label'), 'les QUATRE surfaces se disent en UNE phrase (source i18n unique)')
        .toBe(`Carreau — ${t('cc.geste2eSurfaces', { gestes: 'Focaliser, Geste fabriqué' })}`);
      act(() => { cellule.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); });
      expect(useGame.getState().pendingFocus, 'à plusieurs gestes, rien n’est engagé avant le choix').toBeNull();
      expect(candidats().length, 'un candidat par geste offert').toBe(2);
      act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
      expect(panneau(), 'Échap referme sans rien engager').toBeNull();
      expect(useGame.getState().pendingFocus).toBeNull();
    } finally {
      ACTIONS.splice(ACTIONS.indexOf(fabrique), 1);
    }
  });

  it('SURFACE ⇄ RENDEUR : le geste secondaire n’a pas d’alvéole propre — son rendeur est celle de son HÔTE', () => {
    monter(mage(['carreau']));
    expect(findActionById('focus-spell')!.surface).toBe('geste-secondaire');
    expect(findActionById('focus-spell')!.hote).toBe('cast-spell');
    expect(host.querySelector('[data-action="focus-spell"]'), 'aucune case propre : le geste n’est pas une alvéole').toBeNull();
    const porteur = host.querySelector('[data-action="cast-spell"][data-geste-2e~="focus-spell"]');
    expect(porteur, 'l’alvéole de l’hôte PORTE le geste').toBeTruthy();
  });

  it('la PROGRESSION du Test étendu se lit sur le geste (DR cumulé / NI du sort)', () => {
    const h = mage(['carreau']);
    h.focus = { spell: 'carreau', dr: 2 };
    monter(h);
    expect(alveole('carreau').getAttribute('aria-label')).toContain('Focaliser (DR 2/4)');
  });

  it('APPUI LONG puis `contextmenu` NATIF : UN seul déclenchement (le doigt ne bascule pas le panneau)', () => {
    const fabrique: ActionDef = {
      id: 'test-geste-2e-fabrique', label: 'Geste fabriqué', icon: 'flag/focus',
      surface: 'geste-secondaire', hote: 'cast-spell', gate: 'toujours',
      run: 'battleFocusSpell', candidates: 'sorts-du-heros', coutAction: 'gratuit',
    };
    ACTIONS.push(fabrique);
    vi.useFakeTimers();
    try {
      monter(mage(['carreau']));
      const cellule = alveole('carreau');
      act(() => { cellule.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 })); });
      act(() => { vi.advanceTimersByTime(600); });
      expect(panneau(), 'témoin : l’appui tenu ouvre le panneau des deux gestes').toBeTruthy();
      // Le navigateur DÉRIVE un `contextmenu` de l’appui long au doigt : il est AVALÉ, sinon la
      // bascule refermerait ce que l’appui vient d’ouvrir.
      act(() => { cellule.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); });
      expect(panneau(), 'le contextmenu qui SUIT l’appui long ne rejoue pas le geste').toBeTruthy();
      act(() => { cellule.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
      expect(useGame.getState().battle!.action, 'le clic de relâchement reste avalé lui aussi').toBeNull();
    } finally {
      vi.useRealTimers();
      ACTIONS.splice(ACTIONS.indexOf(fabrique), 1);
    }
  });

  it('CLIC DROIT sur une case SANS geste secondaire : aucun menu natif en plein HUD', () => {
    monter(mage(['carreau']));
    const sansGeste = host.querySelector('[data-action="course"]') as HTMLButtonElement;
    expect(sansGeste?.getAttribute('data-geste-2e'), 'témoin : cette case ne porte aucun geste secondaire').toBeNull();
    const surCase = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => { sansGeste.dispatchEvent(surCase); });
    expect(surCase.defaultPrevented, 'la racine de la console avale le menu natif').toBe(true);
    const surPont = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => { host.querySelector('.combat-console')!.dispatchEvent(surPont); });
    expect(surPont.defaultPrevented, 'y compris hors alvéole (le pont lui-même)').toBe(true);
  });

  /** RECETTE NAVIGATEUR du 2026-08-23 (reproduite 2×, 25 px puis 60 px) : `mouse.down` sur l'alvéole,
   *  glissement HORS de sa bbox, maintien 650 ms, `up` — la modale s'ouvrait quand même. Le
   *  `pointermove` n'est plus destiné à l'alvéole dès que le pointeur en est sorti : la séquence se
   *  rejoue donc ICI À LA FENÊTRE, comme le navigateur la livre. */
  it('APPUI LONG GLISSÉ hors de la case : le geste est ANNULÉ (un glissement n’est pas un appui)', () => {
    monter(mage(['carreau']));
    const cellule = alveole('carreau');
    vi.useFakeTimers();
    try {
      act(() => { cellule.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 })); });
      act(() => { vi.advanceTimersByTime(50); });
      act(() => { window.dispatchEvent(new MouseEvent('pointermove', { clientX: 160, clientY: 100 })); });
      act(() => { vi.advanceTimersByTime(650); });
      act(() => { window.dispatchEvent(new MouseEvent('pointerup', { clientX: 160, clientY: 100 })); });
      expect(useGame.getState().pendingFocus, 'le pointeur a glissé de 60 px : aucun geste secondaire').toBeNull();
      // TÉMOIN : la MÊME séquence SANS glissement déclenche — le contrat n'est pas mort, il discrimine.
      act(() => { cellule.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 })); });
      act(() => { vi.advanceTimersByTime(650); });
      expect(useGame.getState().pendingFocus?.spellId, 'témoin : l’appui IMMOBILE ouvre bien la Focalisation').toBe('carreau');
    } finally {
      vi.useRealTimers();
    }
  });

  /** Le franchissement de BORDURE n'annule plus : le navigateur émet `pointerleave` sous un pointeur
   *  IMMOBILE dès qu'un re-rendu déplace la case sous lui (friction B de la recette : appui long
   *  aussitôt après la fermeture d'une modale, classé clic court). Seule la DISTANCE décide. */
  it('un `pointerleave` sous un pointeur IMMOBILE n’annule pas l’appui (une case qui bouge n’est pas un glissement)', () => {
    monter(mage(['carreau']));
    const cellule = alveole('carreau');
    vi.useFakeTimers();
    try {
      act(() => { cellule.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 })); });
      act(() => { cellule.dispatchEvent(new MouseEvent('pointerleave', { bubbles: false, clientX: 100, clientY: 100 })); });
      act(() => { cellule.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, clientX: 100, clientY: 100 })); });
      act(() => { vi.advanceTimersByTime(650); });
      expect(useGame.getState().pendingFocus?.spellId, 'le pointeur n’a pas bougé d’un pixel : l’appui tient').toBe('carreau');
    } finally {
      vi.useRealTimers();
    }
  });

  it('l’alvéole demande la CAPTURE du pointeur : la suite du geste lui revient même hors de sa bbox', () => {
    const prise: number[] = [];
    const proto = HTMLButtonElement.prototype as unknown as { setPointerCapture?: (id: number) => void };
    const avant = proto.setPointerCapture;
    proto.setPointerCapture = function capter(id: number) { prise.push(id); };
    try {
      monter(mage(['carreau']));
      const appui = new MouseEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 });
      Object.defineProperty(appui, 'pointerId', { value: 3 });
      act(() => { alveole('carreau').dispatchEvent(appui); });
      expect(prise, 'la capture est demandée pour LE pointeur qui appuie').toEqual([3]);
    } finally {
      if (avant) proto.setPointerCapture = avant;
      else delete proto.setPointerCapture;
    }
  });

  it('CLIC DROIT MAINTENU (contextmenu À L’APPUI, macOS/Linux) : le minuteur d’appui long ne rejoue pas le geste', () => {
    const fabrique: ActionDef = {
      id: 'test-geste-2e-fabrique', label: 'Geste fabriqué', icon: 'flag/focus',
      surface: 'geste-secondaire', hote: 'cast-spell', gate: 'toujours',
      run: 'battleFocusSpell', candidates: 'sorts-du-heros', coutAction: 'gratuit',
    };
    ACTIONS.push(fabrique);
    vi.useFakeTimers();
    try {
      monter(mage(['carreau']));
      const cellule = alveole('carreau');
      // ORDRE INVERSE de l’appui long au doigt : le bouton DROIT s’enfonce, le navigateur émet son
      // `contextmenu` AVANT l’échéance du minuteur — qui ne doit jamais avoir été armé.
      act(() => { cellule.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10, button: 2 })); });
      act(() => { cellule.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); });
      expect(panneau(), 'témoin : le clic droit ouvre le panneau des deux gestes').toBeTruthy();
      act(() => { vi.advanceTimersByTime(900); });
      expect(panneau(), 'le minuteur ne rebascule pas ce que le clic droit vient d’ouvrir').toBeTruthy();
    } finally {
      vi.useRealTimers();
      ACTIONS.splice(ACTIONS.indexOf(fabrique), 1);
    }
  });

  it('case FERMÉE (Action dépensée) : aucun glyphe, aucun geste promis — aucune surface ne peut le prendre', () => {
    monter(mage(['carreau']));
    expect(alveole('carreau').querySelector('[data-glyphe-2e]'), 'témoin : la case ouverte annonce son geste').toBeTruthy();
    act(() => { useGame.setState({ battle: { ...useGame.getState().battle!, acted: true } }); });
    const cellule = alveole('carreau');
    expect(estFermee(cellule), 'témoin : l’Action dépensée ferme la case').toBe(true);
    expect(cellule.querySelector('[data-glyphe-2e]'), 'une case fermée ne promet pas un geste que rien ne peut prendre').toBeNull();
    expect(cellule.getAttribute('aria-label'), 'le nom accessible n’annonce pas les quatre surfaces non plus').toBe('Carreau');
    expect(cellule.getAttribute('data-geste-2e'), 'le CHEMIN reste nommé en structure (mesure de surface)').toBe('focus-spell');
  });

  /** RENDEUR GÉNÉRIQUE (grief G2) : le calcul des gestes secondaires vit dans `cellFor`, pas au site
   *  des sorts — une entrée déclarée sur un AUTRE hôte est rendue SANS une ligne de code. */
  it('un geste secondaire déclaré sur `reload` (entrée FABRIQUÉE) est rendu par l’alvéole de SON hôte', () => {
    const objet = (id: string, uid: string) => Object.assign(itemFromTrappingById(id)!, { uid }) as ItemInstance;
    const tireur = () => {
      const h = hero('h1', 'Gunnar');
      h.conditions = [];
      h.skills = [];
      h.talents = [];
      h.items = [objet('pistolet', 'i-p1')];
      h.loadouts = [{ id: 'lo-p', main: 'i-p1' }];
      h.activeLoadoutId = 'lo-p';
      recomputeLoadout(h);
      return h;
    };
    const fabrique: ActionDef = {
      id: 'test-geste-2e-reload', label: 'Geste de recharge', icon: 'flag/focus',
      surface: 'geste-secondaire', hote: 'reload', gate: 'toujours',
      run: 'battleReload', candidates: 'armes-a-distance', coutAction: 'gratuit',
    };
    monter(tireur());
    expect(host.querySelector('[data-action="reload"]'), 'témoin : l’alvéole hôte est bien rendue').toBeTruthy();
    expect(host.querySelector('[data-action="reload"]')!.getAttribute('data-geste-2e'), 'témoin : aucun geste avant l’entrée').toBeNull();
    ACTIONS.push(fabrique);
    try {
      monter(tireur());
      const hote = host.querySelector('[data-action="reload"]') as HTMLButtonElement;
      expect(hote.getAttribute('data-geste-2e'), 'l’hôte porte le geste : le rendeur ne connaît AUCUN id').toBe('test-geste-2e-reload');
      expect(hote.getAttribute('aria-label')).toContain('Geste de recharge');
    } finally {
      ACTIONS.splice(ACTIONS.indexOf(fabrique), 1);
    }
  });
});

/**
 * OUVERTURE DU COMBAT et affordances MORTES du pont — trois défauts mesurés sur une embuscade réelle
 * (diagnostic 2026-08-24) : pendant la pause de Round (`turn = -1`) le pont rendait le premier de
 * l'INITIATIVE, c'est-à-dire un ENNEMI (portrait, États, Avantage, arsenal de l'adversaire dans le
 * cadre du joueur) ; et un combattant sans aucun set de combat se voyait rendre TROIS vignettes de
 * sets vides — un sélecteur qui ne sélectionne rien.
 */
describe('CombatConsole — le pont d’OUVERTURE est celui du JOUEUR, et n’offre rien de mort', () => {
  /** Ouverture : `turn = -1`, la tête de l'initiative est l'ENNEMI (embuscade). */
  function ouverture(h: Combatant, e: Combatant) {
    const order = [e.id, h.id];
    act(() => {
      useGame.setState({
        party: [h],
        pendingRoundStart: { round: 1, readyBySeat: {} } as never,
        battle: {
          combatants: [e, h], order, baseOrder: order, turn: -1, round: 1,
          action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
          acted: false, runBudget: 4, log: [], over: null,
        } as unknown as BattleState,
      });
    });
    act(() => { root.render(<CombatConsole />); });
  }

  afterEach(() => { act(() => { useGame.setState({ pendingRoundStart: null }); }); });

  it('tête d’initiative ENNEMIE : le pont montre le héros contrôlé, jamais l’adversaire', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    const knud = foe('e1', 9, 9);
    knud.label = 'Knud';
    ouverture(h, knud);
    // Le bandeau de phase est bien là, mais l'identité de l'arche est CELLE DU JOUEUR : son
    // portrait, son nom — jamais l'adversaire qui ouvre l'initiative.
    expect(host.querySelector('.cc-phase'), 'la pause de Round garde son bandeau').toBeTruthy();
    expect(host.querySelector('.cc-arch-name')?.textContent).toBe('Gunnar');
    expect(host.querySelector('.cc-arch .ptile')?.classList.contains('team-enemy'),
      'le cadre du joueur portait un ennemi').toBe(false);
  });

  // À l'ouverture, le bandeau et son bouton quittent le coin du pont pour le champ, centrés, et la
  // console basse est un MÉDAILLON — jamais un pont entier (fiche
  // `.claude/memory/user-arbitrage-round0-forme-rt-et-splash-conserve.md`, 2026-08-24, qui porte le
  // verbatim et la capture RT de référence). Ce contrat remplace celui qui vérifiait qu'un ennemi
  // sans set ne rendait pas de sélecteur de sets : il n'a plus de travée du tout.
  it('OUVERTURE : bandeau CENTRÉ hors du pont, arche d’un héros SEULE, pas une seule case', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    const knud = foe('e1', 9, 9);
    knud.label = 'Knud';
    ouverture(h, knud);

    // Le bandeau quitte le pont : il est enfant du CHAMP, pas de la console (il flotte sur la carte).
    const bandeau = host.querySelector('.cc-phase[data-phase="ouverture"]')!;
    expect(bandeau, 'aucun bandeau d’ouverture centré').not.toBeNull();
    expect(host.querySelector('.combat-console')!.contains(bandeau), 'le bandeau est resté DANS le pont').toBe(false);
    expect(bandeau.textContent).toContain('Ouverture du combat');
    expect(bandeau.querySelector('button[data-action="round-start"]')!.textContent).toContain('Commencer le combat');
    // … et il est CENTRÉ EN HAUT : ancré au haut du champ, ramené au centre par sa demi-largeur.
    const regle = ruleOf(CC_BASE, ".cc-phase[data-phase='ouverture']");
    expect(decl(regle, 'top')).toBe('var(--cc-ouverture-top)');
    expect(decl(regle, 'bottom')).toBe('auto');
    expect(centrage(regle), 'le bandeau d’ouverture n’est pas centré en largeur').toBe('axe X');
    expect(parseFloat(decl(ruleOf(CC_BASE, ':root'), '--cc-ouverture-top')!)).toBeGreaterThan(0);
    // La console basse : l'ARCHE SEULE, et RIEN d'autre — ni bande, ni case, ni set, ni fin de tour
    // (arbitrage 2026-09-20, verbatim : « … et avant le début du combat »).
    expect(host.querySelector('.combat-console')!.getAttribute('data-forme')).toBe('spectatrice');
    expect(host.querySelectorAll('.cc-cell').length, 'une case à l’ouverture').toBe(0);
    expect(host.querySelectorAll('.cc-sets').length).toBe(0);
    expect([...host.querySelector('.cc-dock')!.children].length, 'une région de plus que l’arche à l’ouverture').toBe(1);
    expect(host.querySelector('.cc-arch-name')!.textContent).toBe('Gunnar');
    // Aucun second bandeau sur le parapet : le message ne se dédouble pas.
    expect(host.querySelectorAll('.cc-phase').length).toBe(1);
  });

  it('PAUSE DE ROUND SUIVANTE : le bandeau reste sur le PONT (l’arbitrage ne vise que l’ouverture)', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    ouverture(h, foe('e1', 9, 9));
    act(() => { useGame.setState({ pendingRoundStart: { round: 3, readyBySeat: {} } as never }); });
    const bandeau = host.querySelector('.cc-phase')!;
    // Une pause de Round n'est PAS une ouverture : le bandeau reste sur le pont — à l'adresse que
    // la forme du pont lui donne (le pont est alors spectatrice, le bandeau se centre sur l'arche).
    expect(bandeau.getAttribute('data-phase'), 'le round 3 n’est pas une ouverture').toBe('spectatrice');
    expect(host.querySelector('.combat-console')!.contains(bandeau)).toBe(true);
    expect(bandeau.textContent).toContain('Début du Round 3');
  });
});

/**
 * RIEN NE BAT SUR LE PONT (arbitrage user 2026-08-16 : « je ne veux pas que la taille de l'interface
 * ou les boutons bougent », étendu par l'analyse d'état de l'art RT : une interface de combat ne fait
 * pas clignoter ses ressources). Deux pulsations infinies vivaient ici : les crans d'Avantage/Mouvement
 * qui vont partir, et la plaque « Fin du tour ». Elles disent la MÊME chose en statique.
 */
describe('CombatConsole — aucune animation permanente sur le pont', () => {
  it('la feuille du pont ne porte AUCUNE animation infinie', () => {
    const anims = [...CC_CSS.matchAll(/animation\s*:([^;}]*)/g)].map((m) => m[1].trim());
    expect(anims.filter((a) => /infinite/.test(a)), 'une pulsation permanente subsiste sur le pont').toEqual([]);
    expect(CC_CSS, 'plus aucune horloge de pulsation ne se définit ici').not.toMatch(/@keyframes\s+(af-pulse|cc-end-pulse)/);
  });

  it('les crans qui VONT PARTIR se lisent en segment fantôme STATIQUE, à pleine opacité', () => {
    const spend = ruleOf(CC_BASE, '.cc-gutter-rail > i.spend');
    expect(decl(spend, 'opacity'), 'le cran fantôme ne se joue plus à l’opacité battante').toBe('1');
    expect(decl(spend, 'outline'), 'le cran qui part doit rester nommé par un filet').toBeTruthy();
  });

  it('la plaque « Fin du tour » appelle par sa TEINTE, en état allumé statique', () => {
    const pulse = ruleOf(CC_BASE, '.cc-end.pulse');
    expect(decl(pulse, 'animation'), 'la plaque bat encore').toBeNull();
    expect(decl(pulse, 'box-shadow'), 'la plaque doit garder son halo, fixe').toBeTruthy();
    expect(decl(pulse, 'border-color')).toBe('var(--tooltip-warn)');
  });
});

/**
 * ATTEIGNABILITÉ de la raison d'un refus (grief du juge, 2026-08-24) — la raison ne vaut que si les
 * TROIS entrées y mènent. `<button disabled>` les coupait toutes sauf la souris : Tab le saute,
 * `.focus()` est un no-op, la manette le filtre (`visibleFocusables`), et aucun événement de pointeur
 * ne l'atteint au doigt. La case fermée QUI A UNE RAISON porte donc `aria-disabled` et reste inerte.
 */
describe('CombatConsole — la raison d’une case fermée s’atteint au clavier, à la manette et au doigt', () => {
  const caseAction = (id: string) => host.querySelector(`[data-action="${id}"]`) as HTMLButtonElement | null;

  /** Héros sans réserve de Détermination : ses deux alvéoles sont fermées, avec leur raison. */
  function consoleGatee() {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    h.resolve = 0;
    monter(h, { foes: [foe('e1', 9, 9)] });
    const det = caseAction('resolve-psych-immune')!;
    expect(det, 'la sonde ne mesure rien sans case fermée').toBeTruthy();
    return det;
  }

  it('FOCUS RÉEL (clavier) : la case gatée prend le focus et ouvre sa raison ; le blur la referme', () => {
    const det = consoleGatee();
    const attendue = actionGate('resolve-psych-immune', {
      active: useGame.getState().battle!.combatants[0], battle: useGame.getState().battle!,
    }).reason;
    expect(refusAuFocus(det)).toBe(attendue);
    // La boîte de CETTE case porte aussi la porte vers sa fiche de règle : elle survit au temps du pont
    // de survol, puis meurt. (Un refus SEUL, sans règle, se ferme net — `CodexRef.hooks.test.tsx`.)
    expect(quitterRefus(det), 'la boîte doit mourir quand on quitte la case').toBeNull();
  });

  it('MANETTE : la case gatée est DANS le filtre de focus du pad (`visibleFocusables`)', () => {
    consoleGatee();
    // jsdom ne pose aucune boîte : on mesure le filtre `disabled` de la manette sur les alvéoles, en
    // neutralisant la seule autre condition (`getClientRects`), qui est un fait de navigateur.
    sousLayoutJsdom(() => {
      const pont = host.querySelector('.combat-console') as HTMLElement;
      const focusables = visibleFocusables(pont);
      const gatees = [...host.querySelectorAll('button.cc-cell[aria-disabled="true"]')];
      expect(gatees.length, 'aucune case gatée : la sonde ne mesurerait rien').toBeGreaterThan(0);
      for (const g of gatees) {
        expect(focusables, 'le pad ne peut pas se poser sur cette case, sa raison lui est invisible').toContain(g);
      }
    });
  });

  it('TACTILE : un tap sur la case fermée MONTRE sa raison — et n’exécute rien', () => {
    const det = consoleGatee();
    const attendue = actionGate('resolve-psych-immune', {
      active: useGame.getState().battle!.combatants[0], battle: useGame.getState().battle!,
    }).reason;
    const avant = useGame.getState().battle!.combatants[0].resolve;
    expect(refusAuTap(det), 'au doigt, la raison reste introuvable').toBe(attendue);
    expect(useGame.getState().battle!.combatants[0].resolve, 'le tap a dépensé quelque chose').toBe(avant);
    expect(useGame.getState().battle!.action, 'le tap a armé un mode').toBeNull();
  });
});

/**
 * ÉTAT QUI VERROUILLE L'ACTION — la console ne connaît AUCUN nom d'État : elle lit le drapeau
 * `restrictsAction` de la donnée (`isActionLocked`, `LDB 16 l.52`). La sonde parcourt donc TOUS les
 * États qui le déclarent : le jour où un second le porte, il ferme les mêmes cases sans une ligne
 * de code — et ce test le vérifie déjà.
 */
describe('CombatConsole — tout État qui déclare `restrictsAction` ferme les mêmes cases', () => {
  const caseAction = (id: string) => host.querySelector(`[data-action="${id}"]`) as HTMLButtonElement | null;
  const verrouillants = etats.filter((e) => e.restrictsAction);

  it('la Défensive se ferme pour CHAQUE État verrouillant de la donnée, et reste ouverte sans lui', () => {
    expect(verrouillants.length, 'aucun État ne déclare `restrictsAction` : la sonde ne mesurerait rien').toBeGreaterThan(0);
    // TÉMOIN : le MÊME héros, sans État verrouillant, garde la case OUVERTE.
    const libre = hero('h1', 'Gunnar');
    libre.conditions = [];
    monter(libre, { foes: [foe('e1', 9, 9)] });
    expect(caseAction('defend')!.disabled, 'sans État verrouillant, la Défensive devrait être offerte').toBe(false);
    for (const etat of verrouillants) {
      const h = hero('h1', 'Gunnar');
      h.conditions = [{ id: etat.id, value: 1 }] as ConditionInstance[];
      monter(h, { foes: [foe('e1', 9, 9)] });
      expect(
        caseAction('defend')!.disabled,
        `l’État ${etat.id} déclare restrictsAction, la Défensive reste pourtant ouverte`,
      ).toBe(true);
    }
  });
});

/**
 * REMÈDE D'ÉTAT — UN ÉTAT VERROUILLÉ NE SE LÈVE PAS, et la case le DIT avant le clic. À Terre à 0
 * Blessure est verrouillé en donnée (`EtatData.lockedUntil`, `LDB 18 l.15`) : le gate et le dispatcher
 * lisent ce verrou. La case reste DESSINÉE, fermée, avec la raison de la donnée.
 */
describe('remède d’État — offre et dispatcher rendent le MÊME verdict', () => {
  const caseAction = (id: string) => host.querySelector(`[data-action="${id}"]`) as HTMLButtonElement | null;
  /** Héros À TERRE, avec le compte de Blessures voulu. */
  function aTerre(wounds: number) {
    const h = hero('h1', 'Gunnar');
    h.conditions = [{ id: 'a-terre', value: 1 }] as ConditionInstance[];
    h.wounds.current = wounds;
    return h;
  }

  it('0 Blessure : la case « Se relever » est DESSINÉE, FERMÉE, et dit pourquoi', () => {
    monter(aTerre(0), { foes: [foe('e1', 9, 9)] });
    const cell = caseAction('stand');
    expect(cell, 'la case de relevé a disparu au lieu de dire son refus').not.toBeNull();
    expect(cell!.getAttribute('data-gated'), 'la case ne se déclare pas fermée').toBe('');
    // … et la raison est CELLE DE LA DONNÉE (`lockedReason` d'À Terre), pas un repli générique.
    expect(cell!.querySelector('[data-gate]')!.textContent).toBe(findConditionById('a-terre')!.lockedReason);
    // … et le clic ne fait RIEN (le dispatcher refuse la même chose) : l'État reste porté.
    act(() => cell!.click());
    expect(useGame.getState().battle!.combatants[0].conditions.some((c) => c.id === 'a-terre'), 'le héros s’est relevé à 0 PB').toBe(true);
  });

  it('TÉMOIN — 5 Blessures : la case est OFFERTE et le clic relève', () => {
    monter(aTerre(5), { foes: [foe('e1', 9, 9)] });
    const cell = caseAction('stand');
    expect(cell, 'la case de relevé n’est pas offerte').not.toBeNull();
    expect(cell!.getAttribute('data-gated'), 'la case est fermée alors que le relevé est possible').toBeNull();
    act(() => cell!.click());
    expect(useGame.getState().battle!.combatants[0].conditions.some((c) => c.id === 'a-terre'), 'le clic n’a pas relevé').toBe(false);
  });

  it('un porteur SANS l’État n’a PAS la case : la pertinence vient du gate `etat-porte`', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h, { foes: [foe('e1', 9, 9)] });
    expect(caseAction('stand'), 'debout, la case de relevé n’a aucune raison d’exister').toBeNull();
  });

  // CONTRAT D'ORDRE : les cases de remède paraissent dans l'ordre de `actions.json` — c'est la donnée
  // qui range l'offre, un déplacement d'entrée déplace la case.
  it('tous les États de remède portés : les cases sortent dans l’ordre de la donnée', () => {
    const h = hero('h1', 'Gunnar');
    // Le porteur a TOUS les États que le registre sait soigner : les cases naissent donc toutes.
    h.conditions = REMEDES.map((a) => ({ id: a.rule!, value: 1 })) as ConditionInstance[];
    monter(h, { foes: [foe('e1', 9, 9)] });
    const attendus = REMEDES.map((a) => a.id);
    expect(attendus.length, 'aucun remède au registre : la sonde ne mesurerait rien').toBeGreaterThan(0);
    const rendus = [...host.querySelectorAll('.cc-cell[data-action]')]
      .map((c) => c.getAttribute('data-action')!)
      .filter((id) => attendus.includes(id));
    expect(rendus, 'l’ordre des cases de remède à l’écran a changé').toEqual(attendus);
  });

  // La fenêtre du Test de récupération NOMME le geste par l'entrée du registre (source unique du
  // libellé) : elle ne peut plus diverger de la case.
  it('la fenêtre de récupération porte le LIBELLÉ de l’entrée de remède', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [{ id: 'en-flammes', value: 1 }] as ConditionInstance[];
    monter(h, { foes: [foe('e1', 9, 9)] });
    act(() => caseAction('roll-fire')!.click());
    act(() => { root.render(<><CombatConsole /><ActiveModal /></>); });
    expect(useGame.getState().pendingStateRecovery, 'la case n’a pas ouvert le Test').toBeTruthy();
    // Le titre porte aussi la puce d'enjeu (`StakeRule`) : on mesure le LIBELLÉ, pas sa ponctuation.
    expect(host.querySelector('.modal h3')!.textContent!.trim()).toBe(findActionById('roll-fire')!.label);
  });
});
