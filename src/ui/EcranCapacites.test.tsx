// @vitest-environment jsdom
/**
 * ÉCRAN DES CAPACITÉS (spec HUD combat « Zone 6 ») — contrats mesurés au DOM sur le VRAI store et un
 * porteur réel (`createHero` + objets du catalogue), aucun module mocké :
 *  (1) PARITÉ écran ⇄ pools : l'écran rend EXACTEMENT ce que `poolsDuPorteur` produit — mêmes
 *      entrées, même compte. Un écran qui filtrerait une famille en silence serait une surface
 *      « exhaustive » menteuse : c'est ce que la console ne peut pas montrer (12 cases pour N
 *      capacités), donc ce que cet écran doit garantir.
 *  (2) LANCER = FERMER PUIS DISPATCHER (mesuré sur la SÉQUENCE des états du store) : une action qui
 *      arme un ciblage doit trouver la carte dégagée.
 *  (3) PARAMÈTRE BORNÉ : une entrée qui attend encore un paramètre (quelle arme recharger)
 *      n'ENGAGE RIEN au clic — elle ouvre son panneau ; c'est l'élection d'un candidat qui joue.
 *  (4) REFUS VISIBLE : la case fermée reste rendue, porte sa raison hors écran ET son état se VOIT
 *      (attribut + règle de la primitive `chip`).
 *  (5) SPECTATRICE : au tour qu'on ne tient pas, l'écran ne montre RIEN, quelle que soit la porte
 *      qui l'a ouvert (porte unique `state/ecranCapacitesPorte`).
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useGame, type BattleState } from '../state/store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import type { Combatant, ItemInstance } from '../engine/types';
import { itemFromTrappingById, recomputeLoadout } from '../engine/items';
import { controlsCombatant } from '../state/netOwnership';
import { poolsDuPorteur, type CtxPools } from '../state/poolsDeCapacites';
import { netSnapshot, applyNetSnapshot } from '../state/netFlow';
import { resetFields } from '../state/stateFields';
import { deleteSlot } from '../state/saves';
import { testScene } from '../scenes/test-fixture';
import { t } from '../i18n';
import { EcranCapacites } from './EcranCapacites';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function hero(id: string, label: string): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label, rng: makeRNG(7) });
  h.id = id;
  h.pos = { x: 5, y: 5 };
  return h;
}

function objet(trappingId: string, uid: string, over: Partial<ItemInstance> = {}): ItemInstance {
  const it = itemFromTrappingById(trappingId);
  expect(it, `catalogue : « ${trappingId} » absent`).not.toBeNull();
  return Object.assign(it!, { uid }, over);
}

/**
 * PORTEUR RICHE — de quoi peupler les TROIS pools et les cas particuliers de l'écran : DEUX pistolets
 * (à Recharge : la case `reload` déclare alors un PARAMÈTRE borné), DEUX consommables distincts
 * (accès rapide), des sorts (famille magie), et son arsenal au poing (attaque, postures, visée).
 */
function porteurRiche(): Combatant {
  const h = hero('h1', 'Gunnar');
  h.conditions = [];
  h.spells = ['benediction-de-bataille', 'benediction-de-chance'];
  h.items = [
    objet('pistolet', 'i-p1', { loaded: false, reloadProgress: 0 }),
    objet('pistolet', 'i-p2', { loaded: false, reloadProgress: 0 }),
    objet('biere-pinte', 'i-biere'),
    objet('necessaire-antipoison', 'i-antidote'),
  ];
  h.loadouts = [{ id: 'lo-2p', main: 'i-p1', off: 'i-p2' }];
  h.activeLoadoutId = 'lo-2p';
  recomputeLoadout(h);
  return h;
}

let host: HTMLDivElement;
let root: Root;

/** Combat en cours, écran OUVERT. `turn` désigne l'acteur actif dans l'ordre (0 = le héros). */
function monter(h: Combatant, opts: { foes?: Combatant[]; turn?: number; acted?: boolean } = {}) {
  const foes = opts.foes ?? [];
  const order = [h.id, ...foes.map((f) => f.id)];
  act(() => {
    useGame.setState({
      party: [h],
      ecranCapacitesOuvert: true,
      battle: {
        combatants: [h, ...foes], order, baseOrder: order, turn: opts.turn ?? 0, round: 1,
        action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
        acted: !!opts.acted, runBudget: 4, log: [], over: null,
      } as unknown as BattleState,
    });
  });
  act(() => { root.render(<EcranCapacites />); });
}

/** LES POOLS du porteur actif, lus au producteur — la référence de la parité. */
function poolsDeLActif() {
  const s = useGame.getState();
  const battle = s.battle!;
  const active = battle.combatants.find((c) => c.id === battle.order[battle.turn])!;
  const ctx: CtxPools = {
    active, battle, netMode: s.net.mode, live: true,
    controlled: controlsCombatant(s, active), localIntent: s.localIntent, gameTime: s.gameTime,
  };
  const p = poolsDuPorteur(ctx);
  return { ...p, toutes: [...p.arsenal, ...p.accesRapide, ...p.capacites] };
}

const entrees = () => [...host.querySelectorAll('[data-cell][data-action]')];
const entree = (cle: string) => host.querySelector<HTMLButtonElement>(`[data-cell="${cle}"]`);

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ battle: null, ecranCapacitesOuvert: false, localIntent: null, pendingReload: null });
});

describe('écran des capacités — parité avec le producteur de pools', () => {
  it('PORTEUR RICHE : l’écran rend EXACTEMENT les trois pools (mêmes adresses, même compte)', () => {
    monter(porteurRiche(), { acted: true }); // Action dépensée : la situation FERME des capacités
    const { toutes, accesRapide } = poolsDeLActif();
    // Le porteur est bien RICHE — sinon la parité serait verte sur une offre pauvre.
    expect(toutes.length, 'porteur trop pauvre pour mesurer quoi que ce soit').toBeGreaterThanOrEqual(13);
    expect(accesRapide.length, 'accès rapide vide : les consommables ne sont pas mesurés').toBeGreaterThanOrEqual(2);
    expect(toutes.filter((c) => c.ouvrePanneau).length, 'aucun paramètre borné mesuré').toBe(1);
    expect(toutes.filter((c) => c.gate).length, 'aucune capacité refusée mesurée').toBeGreaterThanOrEqual(1);
    expect(toutes.filter((c) => c.item).length, 'aucune case à ART d’objet mesurée').toBeGreaterThanOrEqual(2);

    const rendues = entrees();
    expect(new Set(rendues.map((e) => e.getAttribute('data-cell')))).toEqual(new Set(toutes.map((c) => c.key)));
    expect(new Set(rendues.map((e) => e.getAttribute('data-action')))).toEqual(new Set(toutes.map((c) => c.id)));
    // … et le CARDINAL : deux cases de même id (deux sorts, deux potions) comptent pour deux.
    expect(rendues.length, 'l’écran a perdu (ou dupliqué) des capacités').toBe(toutes.length);
    // Toutes les FAMILLES présentes dans l'offre sont rendues (aucune section muette).
    expect(new Set(rendues.map((e) => e.getAttribute('data-family')))).toEqual(new Set(toutes.map((c) => c.family)));
  });

  it('une capacité REFUSÉE reste rendue, dit sa raison hors écran, et son état SE VOIT', () => {
    monter(porteurRiche(), { acted: true });
    const refusee = poolsDeLActif().toutes.find((c) => c.gate);
    expect(refusee, 'aucune capacité refusée : la mesure serait vide').toBeTruthy();
    const el = entree(refusee!.key)!;
    expect(el.getAttribute('data-gated'), 'la case refusée ne se déclare pas gatée').toBe('');
    expect(el.getAttribute('aria-disabled'), 'le refus n’est pas porté à l’arbre a11y').toBe('true');
    expect(el.querySelector('.hors-ecran')!.textContent).toBe(refusee!.gate);
    expect(el.closest('.codex-ref'), 'la raison n’a pas d’infobulle partagée où se lire').not.toBeNull();
    // ÉTAT VISUEL : la PRIMITIVE (`components.css`) porte l'encre du refus — jsdom ne cascade pas les
    // feuilles, on lit donc la règle à sa source, comme les sondes de matière de la console.
    const css = readFileSync(join(process.cwd(), 'src', 'ui', 'styles', 'components.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const regle = /button\.chip\[aria-disabled='true'\]\s*\{([^}]*)\}/.exec(css);
    expect(regle, 'aucune règle de refus dans la primitive chip : le refus ne se voit pas').not.toBeNull();
    expect(regle![1], 'le refus ne change pas l’encre').toMatch(/color:\s*var\(--cc-gated-ink\)/);
    expect(regle![1], 'le refus ne change pas le curseur').toMatch(/cursor:\s*not-allowed/);
    // … et l'ÉLECTION de lecture n'usurpe jamais l'état « pressé » (ce bouton LANCE).
    expect(host.querySelector('[aria-pressed]'), 'une entrée se déclare pressée : ce n’est pas un interrupteur').toBeNull();
  });
});

describe('écran des capacités — lancer', () => {
  it('un clic FERME l’écran PUIS dispatche (ordre mesuré sur la séquence d’états)', () => {
    monter(porteurRiche());
    const sequence: { ouvert: boolean; intent: string | null }[] = [];
    const stop = useGame.subscribe((s) => sequence.push({ ouvert: s.ecranCapacitesOuvert, intent: s.localIntent?.actionId ?? null }));
    const course = entree('course')!;
    expect(course, 'la Course n’est pas offerte : la mesure serait vide').not.toBeNull();
    act(() => { course.click(); });
    stop();
    expect(sequence.length, 'aucun changement d’état : le clic n’a rien fait').toBeGreaterThan(1);
    // Le PREMIER changement d'état doit être la fermeture seule (aucune intention armée à cet instant).
    expect(sequence[0]).toEqual({ ouvert: false, intent: null });
    // … et le dispatcher a bien couru ENSUITE (l'intention de Course est armée).
    expect(sequence[sequence.length - 1].intent).toBe('course');
    expect(useGame.getState().ecranCapacitesOuvert).toBe(false);
  });

  it('PARAMÈTRE BORNÉ : cliquer « Recharger » (2 armes) n’engage RIEN — le panneau demande laquelle', () => {
    monter(porteurRiche());
    const recharge = entrees().find((e) => e.getAttribute('data-action') === 'reload') as HTMLButtonElement;
    expect(recharge, 'la case de recharge n’est pas offerte').toBeTruthy();
    act(() => { recharge.click(); });
    // RIEN d'engagé : ni Test de rechargement ouvert, ni écran refermé.
    expect(useGame.getState().pendingReload, 'le clic a ENGAGÉ le rechargement sans demander l’arme').toBeFalsy();
    expect(useGame.getState().ecranCapacitesOuvert, 'l’écran s’est fermé alors que rien n’est décidé').toBe(true);
    // Le panneau-paramètre est né de SON déclencheur, avec les DEUX armes du porteur.
    const panneau = document.body.querySelector('[data-panneau-parametre]');
    expect(panneau, 'aucun panneau-paramètre ouvert').not.toBeNull();
    const candidats = [...panneau!.querySelectorAll('button')];
    expect(candidats.length, 'le panneau ne borne pas aux DEUX armes à Recharge du porteur').toBe(2);
    // L'ÉLECTION d'un candidat, elle, JOUE : elle ferme l'écran et dispatche sur CETTE arme.
    act(() => { (candidats[0] as HTMLButtonElement).click(); });
    expect(useGame.getState().ecranCapacitesOuvert, 'l’élection n’a pas fermé l’écran').toBe(false);
    expect(useGame.getState().pendingReload, 'l’élection n’a rien joué').toBeTruthy();
  });
});

describe('écran des capacités — la porte', () => {
  it('au tour qu’on ne tient pas, l’écran ne montre RIEN même ouvert', () => {
    const h = porteurRiche();
    const ennemi = hero('e1', 'Rat');
    ennemi.kind = 'enemy';
    ennemi.pos = { x: 7, y: 5 };
    monter(h, { foes: [ennemi], turn: 1 });
    expect(useGame.getState().ecranCapacitesOuvert, 'l’état d’ouverture a été touché par la garde').toBe(true);
    expect(entrees().length, 'les capacités de l’adversaire sont à l’écran').toBe(0);
    expect(host.innerHTML, 'l’écran s’est rendu au tour d’un porteur qu’on ne tient pas').toBe('');
  });
});

/**
 * L'ÉCRAN N'APPARTIENT QU'À CE CLIENT — c'est une SURFACE, pas un fait de partie :
 *  · COOP : il ne voyage pas dans le snapshot (patron `localIntent`) et celui de l'hôte ne referme
 *    pas celui de l'invité (chacun ouvre et ferme le sien) ;
 *  · SAVE : une partie sauvée écran ouvert se recharge écran FERMÉ (patron `camEdge`) ;
 *  · CADRES : il ne survit ni au changement de scène ni à l'ouverture d'un combat — sinon on
 *    reprendrait la main sous un voile ouvert au combat précédent.
 */
describe('écran des capacités — surface LOCALE (coop, save, cadres de reset)', () => {
  it('COOP : le voile ne VOYAGE pas, et le snapshot de l’hôte ne referme pas celui du client', () => {
    const h = porteurRiche();
    monter(h);
    // L'hôte a SON écran ouvert : rien de tel ne part dans son snapshot.
    expect('ecranCapacitesOuvert' in netSnapshot(useGame.getState), 'le voile de l’hôte part chez ses invités').toBe(false);
    const snap = JSON.parse(JSON.stringify({ ...netSnapshot(useGame.getState) })) as Record<string, unknown>;
    act(() => { applyNetSnapshot(useGame.setState, snap); });
    expect(useGame.getState().ecranCapacitesOuvert, 'le snapshot a refermé l’écran du client').toBe(true);
  });

  it('SAVE : sauvée écran OUVERT, la partie se recharge écran FERMÉ', () => {
    useGame.getState().startScene(testScene);
    act(() => { useGame.setState({ ecranCapacitesOuvert: true }); });
    expect(useGame.getState().saveGame(1), 'la sauvegarde a échoué : la mesure serait vide').toBe(true);
    act(() => { useGame.setState({ ecranCapacitesOuvert: true }); });
    expect(useGame.getState().loadGame(1), 'le chargement a échoué').toBe(true);
    expect(useGame.getState().ecranCapacitesOuvert, 'la partie rechargée rouvre un écran que personne n’a demandé').toBe(false);
    deleteSlot(1);
  });

  it('CADRES : le voile ne survit ni à la scène ni à l’ouverture d’un combat', () => {
    expect(resetFields('scene')).toHaveProperty('ecranCapacitesOuvert', false);
    expect(resetFields('combatStart')).toHaveProperty('ecranCapacitesOuvert', false);
  });
});

/**
 * DEUX FRICTIONS DE RECETTE (2026-08-24), mesurées ici :
 *  · R2 — une case grisée par la SITUATION (et non par la règle) portait un gris MUET : le survol ne
 *    disait rien. Le refus de site emprunte désormais le canal du verdict (`off` = la raison).
 *  · R3 — à l'ouverture, le focus restait au déclencheur (le bouton du rail) : la barre d'espace
 *    l'activait et refermait l'écran. Le focus entre maintenant dans l'écran, sur son champ de filtre.
 */
describe('écran des capacités — refus de SITE et focus d’entrée', () => {
  it('R2 — « Viser » alors qu’on est DÉJÀ en joue : case gatée, raison exacte au survol', () => {
    const h = porteurRiche();
    h.aiming = true;
    monter(h);
    const viser = entrees().find((e) => e.getAttribute('data-action') === 'aim')!;
    expect(viser, 'la case Viser n’est pas rendue').toBeTruthy();
    expect(viser.getAttribute('data-gated'), 'la case est grisée SANS se déclarer gatée (gris muet)').toBe('');
    expect(viser.querySelector('.hors-ecran')!.textContent, 'la raison de site n’est pas portée').toBe(t('agate.alreadyAiming'));
    // … et elle est LISIBLE au survol, dans l'infobulle partagée (le seul véhicule du refus).
    const enveloppe = viser.closest('.codex-ref')!;
    act(() => { enveloppe.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    expect(document.body.querySelector('.codex-pop[role="tooltip"] [data-refus]')?.textContent).toBe(t('agate.alreadyAiming'));
  });

  it('R3 — à l’ouverture, le focus ENTRE dans l’écran (champ de filtre) : Espace ne referme rien', () => {
    monter(porteurRiche());
    const actif = document.activeElement as HTMLElement;
    expect(host.contains(actif), 'le focus est resté hors de l’écran (au déclencheur)').toBe(true);
    expect(actif.tagName, 'le focus n’est pas sur le champ de filtre').toBe('INPUT');
    // Espace sur le champ de filtre = une frappe, jamais l'activation d'un bouton de fermeture.
    act(() => { actif.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })); });
    expect(useGame.getState().ecranCapacitesOuvert, 'la barre d’espace a refermé l’écran').toBe(true);
  });
});
