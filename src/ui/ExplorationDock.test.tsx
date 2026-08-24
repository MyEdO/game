// @vitest-environment jsdom
/**
 * PONT D'EXPLORATION (spec `docs/plans/2026-08-16-spec-hud-combat.md` § « Zone 11 ») — l'ÉCRAN est
 * jugé, pas le prédicat : `CampaignView` est montée pour de vrai (patron `createRoot`/`act` du repo)
 * sur le VRAI store, aucun module mocké.
 * Quatre contrats : la barre haute dégraissée (ni date ni bouton flottant), le pont monté hors
 * combat SEULEMENT (en combat le pont est la console), les 7 ouvreurs assis SUR le pont avec leurs
 * conditions, et UNE seule bande de bord à bord (jamais des boîtes flottantes).
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useGame, type BattleState } from '../state/store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import type { WorldMap } from '../state/worldMap';
import type { NarratifBlock } from '../state/campaignNarratif';
import { testScene } from '../scenes/test-fixture';
import { CampaignView } from './CampaignView';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;
let root: Root;

/** État NEUTRE d'exploration : rien qui puisse offrir un ouvreur conditionnel. */
function explorationNue() {
  useGame.setState({
    scene: testScene, mode: 'exploration', battle: null, povActive: false,
    worldMap: null, travelPlan: null, vessel: null, campaignNarratif: null,
    port: null, landMarket: null, travelRecap: null,
  });
}

function monter() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root.render(<CampaignView />); });
  return host;
}

/** Combat en cours (un héros, son tour) : la console de combat prend le pont. */
function enCombat() {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', rng: makeRNG(7) });
  h.id = 'h1';
  h.pos = { x: 5, y: 5 };
  useGame.setState({
    mode: 'battle', party: [h],
    battle: {
      combatants: [h], order: [h.id], baseOrder: [h.id], turn: 0, round: 1,
      action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
      acted: false, runBudget: 4, log: [], over: null,
    } as unknown as BattleState,
  });
}

const dock = () => host.querySelector('.exploration-dock');
/** Titres des ouvreurs assis sur le pont, dans l'ordre du DOM. */
const ouvreurs = () => [...host.querySelectorAll('.exploration-dock .worldmap-btn')].map((b) => b.getAttribute('title'));

beforeEach(() => { explorationNue(); });
afterEach(() => {
  act(() => { root.unmount(); });
  host.remove();
  useGame.setState({ battle: null, mode: 'exploration' });
});

describe('Zone 11 — barre haute d’exploration DÉGRAISSÉE', () => {
  it('ne porte NI la date NI un seul bouton flottant : ☰, le lieu, l’objectif', () => {
    const el = monter();
    const topbar = el.querySelector('.hud-topbar');
    expect(topbar, 'la barre haute reste montée en exploration').not.toBeNull();
    expect(topbar!.querySelector('.hud-clock'), 'la date QUITTE le HUD (menu ☰ + écrans plein-champ)').toBeNull();
    expect(topbar!.querySelector('.worldmap-btn'), 'aucun ouvreur d’écran ne flotte plus dans la barre haute').toBeNull();
    // Ce qui RESTE : le menu et le nom du lieu (l'objectif est nul sans pile d'objectifs).
    expect(topbar!.querySelector('.game-menu')).not.toBeNull();
    expect(topbar!.querySelector('[data-hud="place"]')!.textContent).toBe(testScene.nom);
  });
});

describe('Zone 11 — le pont existe hors combat, et cède au pont de combat', () => {
  it('EXPLORATION : le pont d’exploration est monté, la console de combat non', () => {
    const el = monter();
    expect(dock(), 'le pont d’exploration est monté hors combat').not.toBeNull();
    expect(el.querySelector('.combat-console')).toBeNull();
  });

  it('COMBAT : la console prend le pont, le pont d’exploration disparaît', () => {
    enCombat();
    const el = monter();
    expect(el.querySelector('.combat-console'), 'le pont de combat est inchangé').not.toBeNull();
    expect(dock(), 'un seul pont à la fois : l’exploration cède la bande basse').toBeNull();
  });
});

describe('Zone 11 — les 7 ouvreurs vivent SUR le pont, avec leurs conditions', () => {
  it('exploration nue : Possessions sans condition, et le repos LÀ où le groupe se tient', () => {
    monter();
    // La scène de fixture n'est pas un lieu de carte : l'offre de couchage y est le camp (`restPlacesHere`).
    expect(ouvreurs()).toEqual(['Possessions du groupe', 'Camper — dormir sur place jusqu’à l’aube']);
  });

  it('CONDITIONNEL — carnet d’enquête : offert seulement si la campagne porte un indice', () => {
    monter();
    expect(ouvreurs()).not.toContain('Carnet d’enquête');
    act(() => {
      useGame.setState({
        campaignNarratif: {
          affaires: [{ id: 'aff', titre: 'Affaire' }],
          indices: [{ id: 'ind', affaireId: 'aff', kind: 'indice', titre: 'Indice', stades: [{ id: 's1', prose: 'Prose.' }] }],
          presetsPnj: [], objets: [],
        } satisfies NarratifBlock,
      });
    });
    expect(ouvreurs()).toEqual(['Possessions du groupe', 'Carnet d’enquête', 'Camper — dormir sur place jusqu’à l’aube']);
  });

  it('CONDITIONNEL — carte du monde : offerte seulement quand la scène EST un lieu connu', () => {
    monter();
    expect(ouvreurs()).not.toContain('Carte du monde — voyager');
    act(() => {
      useGame.setState({
        worldMap: {
          id: 'carte', nom: 'Carte', routes: [],
          places: [{ id: 'lieu', label: 'Terrain de test', pos: { x: 50, y: 50 }, scene: testScene.id }],
        } satisfies WorldMap,
      });
    });
    // Une scène qui EST un lieu ouvre DEUX entrées d'un coup (la carte, et le hub du lieu où l'on se
    // tient — `placeServices` offre au moins l'hébergement) : les deux conditions sont satisfaites
    // par la même donnée, l'attendu le dit tel quel.
    expect(ouvreurs()).toEqual(['Possessions du groupe', 'Carte du monde — voyager', 'Terrain de test — services du lieu']);
  });
});

describe('Zone 11 — UNE bande, jamais des boîtes flottantes (contrat d’assemblage §1c-ter)', () => {
  it('un seul pont, et AUCUN ouvreur hors de lui', () => {
    act(() => { useGame.setState({ campaignNarratif: null }); });
    const el = monter();
    expect(el.querySelectorAll('.exploration-dock')).toHaveLength(1);
    expect(el.querySelectorAll('.worldmap-btn')).toHaveLength(el.querySelectorAll('.exploration-dock .worldmap-btn').length);
  });

  it('la bande va de bord à bord, ancrée en bas (géométrie déclarée, pas une esthétique)', () => {
    // `import.meta.url` n'est pas un URL `file:` sous l'environnement jsdom de Vitest (mesuré) — le
    // module se lit depuis la racine du dépôt, la racine d'exécution du runner.
    const css = readFileSync(join(process.cwd(), 'src', 'ui', 'styles', 'exploration-dock.css'), 'utf8');
    const regle = /\.exploration-dock\s*\{([^}]*)\}/.exec(css);
    expect(regle, '`.exploration-dock` doit porter sa géométrie de bande').not.toBeNull();
    for (const prop of ['left: 0', 'right: 0', 'bottom: 0']) expect(regle![1]).toContain(prop);
    // Même matière/liseré que le pont de combat : les tokens `--cc-*` du `:root`, jamais un hex.
    expect(regle![1]).toContain('var(--cc-arch-lo)');
    expect(regle![1]).toMatch(/border-top:[^;]*var\(--atelier-brass-hover\)/);
  });
});

/* ══════════ Outils de MESURE des feuilles (aucune valeur recopiée : tout est lu au CSS) ══════════ */

/** Écran de la capture de recette : les `clamp()`/`vw`/`vh` des deux ponts s'y résolvent. C'est le
 *  premier des écrans de bureau jugés par `CombatConsole.test.tsx` (F-1, `ECRANS`) — la HAUTEUR est
 *  load-bearing depuis que l'alvéole se calcule en `vh` (budget de hauteur, arbitrage #1348). */
const VIEWPORT_W = 1280;
const VIEWPORT_H = 800;
const styles = (n: string) => readFileSync(join(process.cwd(), 'src', 'ui', 'styles', n), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
/** Corps du PREMIER bloc dont le sélecteur est exactement `sel`. */
function bloc(css: string, sel: string): string {
  const re = new RegExp(`(^|[}\\n])\\s*${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'm');
  const m = re.exec(css);
  if (!m) throw new Error(`sélecteur absent : ${sel}`);
  return m[2];
}
/** Valeur d'une propriété (ou d'un token) dans un corps de bloc. */
function prop(corps: string, p: string): string {
  const m = new RegExp(`(^|;|\\s)${p}\\s*:([^;]+)`).exec(corps);
  if (!m) throw new Error(`propriété absente : ${p}`);
  return m[2].trim();
}
/** Évaluateur `calc()`/`clamp()`/`min()`/`max()` en px (descente récursive — toute autre forme jette). */
function evalPx(src: string): number {
  const s = src.replace(/\s+/g, ' ');
  let i = 0;
  const skip = () => { while (s[i] === ' ') i++; };
  function primary(): number {
    skip();
    const fn = /^(calc|clamp|min|max)\(/.exec(s.slice(i));
    if (fn) {
      i += fn[0].length;
      const args = [expr()];
      skip();
      while (s[i] === ',') { i++; args.push(expr()); skip(); }
      if (s[i] !== ')') throw new Error(`appel non fermé : ${s.slice(i)}`);
      i++;
      if (fn[1] === 'calc') return args[0];
      if (fn[1] === 'min') return Math.min(...args);
      if (fn[1] === 'max') return Math.max(...args);
      return Math.min(Math.max(args[0], args[1]), args[2]); // clamp(min, val, max)
    }
    if (s[i] === '(') { i++; const v = expr(); skip(); if (s[i] !== ')') throw new Error('parenthèse'); i++; return v; }
    const num = /^-?[\d.]+(px|vw|vh)?/.exec(s.slice(i));
    if (!num || num[0] === '') throw new Error(`nombre attendu : ${s.slice(i, i + 24)}`);
    i += num[0].length;
    const n = parseFloat(num[0]);
    if (num[1] === 'vw') return (n * VIEWPORT_W) / 100;
    if (num[1] === 'vh') return (n * VIEWPORT_H) / 100;
    return n;
  }
  function term(): number {
    let v = primary();
    for (;;) { skip(); if (s[i] === '*') { i++; v *= primary(); } else if (s[i] === '/') { i++; v /= primary(); } else return v; }
  }
  function expr(): number {
    let v = term();
    for (;;) { skip(); if (s[i] === '+') { i++; v += term(); } else if (s[i] === '-') { i++; v -= term(); } else return v; }
  }
  const out = expr();
  skip();
  if (i !== s.length) throw new Error(`reste non lu : ${s.slice(i)}`);
  return out;
}
/** Résout les `var()` d'une expression depuis un dictionnaire de tokens, puis l'évalue en px. */
function px(expr: string, tokens: Record<string, string>): number {
  let e = expr;
  for (let n = 0; n < 8 && e.includes('var('); n++) {
    e = e.replace(/var\(\s*(--[a-z0-9-]+)\s*\)/g, (_m, t: string) => {
      if (tokens[t] === undefined) throw new Error(`token inconnu : ${t}`);
      return `(${tokens[t]})`;
    });
  }
  return evalPx(e);
}
type RGB = [number, number, number];
/** Palette `--cc-arch-*` lue à base.css (source unique des teintes). */
function palette(): Record<string, RGB> {
  const base = styles('base.css');
  const out: Record<string, RGB> = {};
  for (const m of base.matchAll(/(--cc-arch-[a-z-]+):\s*#([0-9a-f]{6})/g)) {
    out[m[1]] = [0, 2, 4].map((k) => parseInt(m[2].slice(k, k + 2), 16)) as RGB;
  }
  return out;
}
/** Bornes d'un `linear-gradient(180deg, …)` : couleur + position en fraction de la nappe. */
function bornes(image: string, pal: Record<string, RGB>): { c: RGB; at: number }[] {
  const args = image.replace(/^linear-gradient\(\s*180deg\s*,/, '').replace(/\)\s*$/, '').split(/,(?![^(]*\))/);
  return args.map((a, k) => {
    const t = /var\(\s*(--[a-z0-9-]+)\s*\)\s*(?:([\d.]+)%)?/.exec(a.trim());
    if (!t || !pal[t[1]]) throw new Error(`borne illisible : ${a}`);
    return { c: pal[t[1]], at: t[2] !== undefined ? parseFloat(t[2]) / 100 : k === 0 ? 0 : 1 };
  });
}
/** Couleur rendue à la fraction `f` de la nappe (interpolation linéaire, arrondi entier). */
function teinte(stops: { c: RGB; at: number }[], f: number): RGB {
  const g = Math.min(1, Math.max(0, f));
  for (let k = 1; k < stops.length; k++) {
    if (g <= stops[k].at) {
      const a = stops[k - 1];
      const b = stops[k];
      const t = (g - a.at) / (b.at - a.at);
      return [0, 1, 2].map((j) => Math.round(a.c[j] + (b.c[j] - a.c[j]) * t)) as RGB;
    }
  }
  return stops[stops.length - 1].c;
}

describe('Zone 11 — la RÉSERVE du pont est lisible, et le pont est COMPACT', () => {
  it('`--xd-deck-h` vit au `:root` (patron `--cc-deck-h`) et vaut une rangée + respiration + liseré', () => {
    const css = styles('exploration-dock.css');
    const racine = bloc(css, ':root');
    // Le token est au `:root`, pas sur le sélecteur du pont : sinon aucun consommateur ne peut le lire.
    expect(prop(racine, '--xd-deck-h')).toContain('var(--xd-row)');
    expect(bloc(css, '.exploration-dock')).not.toContain('--xd-deck-h:');
    const tokens = { '--xd-row': prop(racine, '--xd-row'), '--xd-liseret': prop(racine, '--xd-liseret') };
    const h = px(prop(racine, '--xd-deck-h'), tokens);
    // COMPACT : la rangée (42px) + sa respiration + le liseré, JAMAIS une bande de contenu. La bande
    // avale du sol cliquable sur toute la largeur (hors combat, se déplacer EST cliquer au sol) :
    // 60px × 1280 = 76 800px² de terrain confisqués contre 49 × 1280 = 62 720px² ici.
    expect(h).toBeLessThanOrEqual(52);
    expect(h).toBeGreaterThanOrEqual(px(prop(racine, '--xd-row'), {}));
    // La cible tactile suit le canon au doigt (44px) et la réserve la relit : les deux ne divergent pas.
    const coarse = /@media \(pointer: coarse\) \{\s*:root \{([^}]*)\}/.exec(css);
    expect(coarse, 'la tranche pointeur grossier règle la rangée, pas une hauteur en dur').not.toBeNull();
    expect(px(prop(coarse![1], '--xd-row'), {})).toBe(44);
    const wmCoarse = /@media \(pointer: coarse\) \{([\s\S]*?)\n\}/.exec(styles('world-meta.css'));
    expect(wmCoarse, 'la variante « tôle » déclare sa cible tactile avec la primitive').not.toBeNull();
    expect(prop(bloc(wmCoarse![1], ".worldmap-btn[data-skin='tole']"), 'min-height')).toBe('44px');
  });

  it('le tiroir-journal LIT la réserve pour s’ancrer au-dessus du pont (jamais un nombre recopié)', () => {
    const hud = styles('hud.css');
    const tiroir = bloc(hud, '.exploration-dock .log-drawer');
    // Le pont porte l'ancrage : le tiroir ne flotte plus (les calages mobiles ≤700/≤560 sont annulés).
    expect(prop(tiroir, 'position')).toBe('relative');
    expect(prop(tiroir, 'inset')).toBe('auto');
    expect(prop(bloc(hud, '.exploration-dock .ld-panel'), 'max-height')).toContain('var(--xd-deck-h)');
  });
});

describe('Zone 11 — MÊME MATIÈRE que le pont de combat, mesurée à profondeur égale', () => {
  it('même nappe, même liseré, et la même teinte à +3px sous le liseré', () => {
    const xd = styles('exploration-dock.css');
    const cc = styles('combat-console.css');
    const pontXd = bloc(xd, '.exploration-dock');
    const pontCc = bloc(cc, '.combat-console');
    const pal = palette();
    // MÊME nappe déclarée : un dégradé recopié à la main pourrait dériver borne par borne.
    expect(prop(pontXd, 'background-image')).toBe(prop(pontCc, 'background-image'));
    // MÊME hauteur de nappe : `--cc-band` vit sur la console (hors `:root`), donc le pont léger porte
    // sa jumelle — cette garde ROUGIT si les deux valeurs divergent.
    expect(prop(pontXd, '--xd-band')).toBe(prop(pontCc, '--cc-band'));
    // MÊME épaisseur de liseré (le décalage de nappe la relit).
    const liseretXd = px(prop(bloc(xd, ':root'), '--xd-liseret'), {});
    expect(px(prop(pontCc, 'border-top').split(' ')[0], {})).toBe(liseretXd);

    const tokens: Record<string, string> = {
      ...Object.fromEntries([...bloc(cc, ':root').matchAll(/(--cc-[a-z-]+):([^;]+)/g)].map((m) => [m[1], m[2].trim()])),
      ...Object.fromEntries([...bloc(xd, ':root').matchAll(/(--xd-[a-z-]+):([^;]+)/g)].map((m) => [m[1], m[2].trim()])),
      '--xd-band': prop(pontXd, '--xd-band'),
      '--cc-band': prop(pontCc, '--cc-band'),
    };
    const stops = bornes(prop(pontXd, 'background-image'), pal);
    const bandeCc = px(prop(pontCc, 'background-size').split(' ')[1], tokens);
    const bandeXd = px(prop(pontXd, 'background-size').split(' ')[1], tokens);
    // Boîtes DE FOND (le liseré est hors nappe) : hauteur totale déclarée moins le liseré.
    const fondCc = px(tokens['--cc-deck-h'], tokens) - liseretXd;
    // Nappe du pont de combat : ancrée EN BAS de sa boîte de fond.
    expect(prop(pontCc, 'background-position')).toBe('bottom');
    const teinteCc = (d: number) => teinte(stops, (bandeCc - fondCc + d) / bandeCc);
    // Nappe du pont léger : le décalage déclaré donne la position du HAUT de la nappe dans la boîte.
    const haut = px(prop(pontXd, 'background-position').replace(/^0\s+/, ''), tokens);
    const teinteXd = (d: number) => teinte(stops, (d - haut) / bandeXd);
    expect(teinteXd(3)).toEqual(teinteCc(3));
    // ANCRAGE ABSOLU : l'égalité ci-dessus est vraie par construction (le décalage du pont léger se
    // DÉRIVE de `--cc-deck-h`) — elle resterait verte sur une nappe fausse des deux côtés. La valeur
    // ci-dessous épingle la teinte RÉELLEMENT peinte à +3px sous le liseré, à 1280×800. Elle SUIT la
    // hauteur de pont : la nappe (300px) est ancrée en bas d'une boîte de `--cc-deck-h`, un pont plus
    // court n'en montre que la queue sombre. Re-mesurée après l'arbitrage de densité #1348 (alvéole
    // en `vh`, pont 208,6px → 134px à cet écran) : rgb(33,24,13) → rgb(25,18,9).
    for (const [k, v] of [...teinteXd(3).entries()]) expect(Math.abs(v - [25, 18, 9][k])).toBeLessThanOrEqual(1);
    // Et la même matière plus BAS dans la bande (une seule profondeur pourrait coïncider par hasard).
    expect(teinteXd(20)).toEqual(teinteCc(20));
  });
});

describe('Zone 11 — la tôle du pont est une VARIANTE de la primitive, jamais un scope d’écran', () => {
  it('le module du pont ne redéfinit AUCUNE propriété de `.worldmap-btn`', () => {
    expect(styles('exploration-dock.css')).not.toContain('.worldmap-btn');
  });

  it('la variante vit avec la primitive, et les ouvreurs du pont la portent', () => {
    const wm = styles('world-meta.css');
    const tole = bloc(wm, ".worldmap-btn[data-skin='tole']");
    for (const p of ['border-radius', 'background', 'border', 'box-shadow', 'color', 'clip-path']) expect(() => prop(tole, p)).not.toThrow();
    const el = monter();
    const boutons = [...el.querySelectorAll('.exploration-dock .worldmap-btn')];
    expect(boutons.length).toBeGreaterThan(0);
    for (const b of boutons) expect(b.getAttribute('data-skin')).toBe('tole');
  });
});

describe('Zone 11 — le journal est SUR le pont hors combat, au RAIL en combat', () => {
  it('EXPLORATION : le tiroir est la dernière entrée de la rangée, et le rail n’est pas monté', () => {
    const el = monter();
    expect(el.querySelector('.hud-rail'), 'hors combat, une seule plaque : le pont').toBeNull();
    const rangee = el.querySelector('.xd-openers')!;
    expect(rangee.querySelector('.log-drawer'), 'le tiroir est assis DANS la rangée d’ouvreurs').not.toBeNull();
    expect(rangee.lastElementChild!.classList.contains('log-drawer')).toBe(true);
    // Aucun tiroir hors du pont : plus de boîte flottante au coin du champ.
    expect(el.querySelectorAll('.log-drawer')).toHaveLength(el.querySelectorAll('.exploration-dock .log-drawer').length);
  });

  it('COMBAT : le rail porte le journal ET le dossier de navire ; la barre haute ne porte plus rien', () => {
    enCombat();
    act(() => { useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } } } as never); });
    const el = monter();
    const rail = el.querySelector('.hud-rail');
    expect(rail, 'en combat, le rail est la plaque d’outils').not.toBeNull();
    expect(rail!.querySelector('.log-drawer')).not.toBeNull();
    const dossier = rail!.querySelector('.worldmap-btn:not([data-ecran])');
    expect(dossier!.getAttribute('title')).toBe('Dossier du navire — état, cargaison, équipage');
    expect(dossier!.getAttribute('data-skin')).toBe('tole');
    // Zéro flottant en barre haute, en AUCUN mode (le dossier y vivait).
    expect(el.querySelector('.hud-topbar .worldmap-btn')).toBeNull();
    expect(el.querySelectorAll('.worldmap-btn')).toHaveLength(el.querySelectorAll('.hud-rail .worldmap-btn').length);
  });
});
