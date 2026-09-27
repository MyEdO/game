// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Combatant, HitLocation, Weapon } from '../../engine/types';
import { openAttackCascade } from '../../state/combatFlow';
import { useGame, type BattleState } from '../../state/store';
import { testScene } from '../../scenes/test-fixture';
import { RollShell } from '../RollShell';
import { ANONYMES } from '../RollLine';
import { useAttackJetProps } from './useAttackJetProps';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const characteristics = {
  'capacite-de-combat': 45,
  'capacite-de-tir': 40,
  force: 35,
  endurance: 35,
  initiative: 30,
  agilite: 40,
  dexterite: 30,
  intelligence: 30,
  'force-mentale': 30,
  sociabilite: 30,
};
const sword = {
  name: 'Épée',
  label: 'Épée',
  type: 'melee',
  damage: { plusBF: true, flat: 0, bare: true },
  uid: 'sword',
  qualities: [],
} as unknown as Weapon;
const bow = {
  name: 'Arc',
  label: 'Arc',
  type: 'ranged',
  damage: { plusBF: false, flat: 8 },
  range: 60,
  uid: 'bow',
  qualities: [],
} as unknown as Weapon;

function combatant(id: string, label: string, kind: 'hero' | 'enemy', x: number, weapons: Weapon[] = [sword], advantage = 0): Combatant {
  return {
    id,
    name: label,
    label,
    kind,
    characteristics: { ...characteristics },
    conditions: [],
    traumas: [],
    engagedWith: [],
    skills: [],
    talents: [],
    items: [],
    weapons,
    advantage,
    size: 'moyenne',
    pos: { x, y: 0 },
    wounds: { current: 18, max: 18 },
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    species: 'humains-reiklander',
    bodyShape: 'humanoide',
    movement: 4,
  } as unknown as Combatant;
}

function Probe() {
  const props = useAttackJetProps();
  return props ? <RollShell {...props} /> : null;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => { ANONYMES.count = 0; });
afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null;
  host = null;
});

/**
 * Monte l'écran d'attaque RÉEL (store → `openAttackCascade` → hook → `RollShell`). Les options
 * cadrent la SITUATION mesurée, jamais le rendu : arme tirée, distance, météo de la scène,
 * Localisation visée, tir en mouvement, États et AVANTAGE du jeteur. Défaut = duel de mêlée nu, par
 * temps clair, tireur immobile.
 */
function renderAttack(opts: { ranged?: boolean; cases?: number; fog?: boolean; location?: HitLocation; enMouvement?: boolean; avantage?: number; conditions?: { id: string; value: number }[]; badauds?: number; tasArme?: boolean; tirArme?: boolean; mouvementUse?: number } = {}): HTMLDivElement {
  const weapon = opts.ranged ? bow : sword;
  // Tir : 20 cases = 40 m avec une Portée de 60 m → bande « Moyenne » (+0, aucune chip de portée) ;
  // 5 cases = 10 m → « Courte portée » (+20, entrée de la table). Mêlée : au contact. La distance est
  // CHOISIE pour que seules les circonstances mesurées pèsent.
  const attacker = combatant('attacker', 'Elsa', 'hero', 0, [weapon], opts.avantage ?? 0);
  const target = combatant('target', 'Gobelin', 'enemy', opts.cases ?? (opts.ranged ? 20 : 1));
  if (opts.conditions) (attacker as unknown as { conditions: unknown[] }).conditions = opts.conditions;
  // Badauds AU CONTACT de la cible (`crowdEligible` : distance ≤ 1, la cible comprise) — c'est eux qui
  // font, ou non, le « groupe serré » du seuil de `crowdMod`.
  const badauds = Array.from({ length: opts.badauds ?? 0 }, (_, i) => combatant(`badaud-${i}`, `Badaud ${i}`, 'enemy', (target.pos!.x) + (i % 2 === 0 ? 1 : -1)));
  const combatants = [attacker, target, ...badauds];
  const battle = {
    combatants,
    order: combatants.map((c) => c.id),
    baseOrder: combatants.map((c) => c.id),
    ...(opts.tasArme || opts.tirArme
      ? { stances: { [attacker.id]: { ...(opts.tasArme ? { intoCrowd: true } : {}), ...(opts.tirArme ? { heldGround: true } : {}) } } }
      : {}),
    turn: 0,
    round: 1,
    action: null,
    selectedSpellId: null,
    reachable: new Map(),
    movementUsed: opts.mouvementUse ?? 0,
    movedPreAction: false,
    acted: false,
    log: [],
    over: null,
  } as unknown as BattleState;
  useGame.setState({
    battle,
    mode: 'battle',
    scene: { ...testScene(), weather: opts.fog ? 'brouillard' : 'clair' },
    gameTime: 12 * 60, // plein jour : l'obscurité de nuit ne se surajoute pas au brouillard mesuré
    pendingAttack: null,
    pendingCascade: null,
    net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: 0, ownership: {} },
  });
  openAttackCascade(
    useGame.getState,
    useGame.setState,
    // Posture ARMÉE à la console : on laisse le VERSEMENT moteur (`withArmedStance`) trancher, comme
    // au vrai site de déclaration — un champ porté par l'appelant primerait et court-circuiterait le prédicat.
    { attackerId: attacker.id, targetId: target.id, location: opts.location ?? null, result: null, weaponUid: weapon.uid, ...(opts.tirArme ? {} : { heldGround: !opts.enMouvement }) },
    'Attaque',
    'action/attack',
  );
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<Probe />));
  return host;
}

describe('Attaque — contrat d’affichage Z0–Z15', () => {
  it('rend une seule modale avec le titre nu, le sous-titre composé et un unique A→B', () => {
    const view = renderAttack();
    const dialogs = view.querySelectorAll('[role="dialog"]');
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0].querySelector('h3')?.textContent).toBe('Attaque');
    expect(dialogs[0].querySelector('.rm-subtitle')?.textContent).toBe('Elsa — Attaque (Corps à corps)');
    expect(dialogs[0].querySelectorAll('.rm-vs')).toHaveLength(1);
    expect(dialogs[0].textContent).not.toContain('Round 1');
    expect(dialogs[0].textContent).not.toContain('Groupe');
  });

  /**
   * POSTURES DE TIR — la fenêtre les AFFICHE, elle ne les CONTRÔLE plus (spec HUD §1a G5, verbatim
   * user « plutôt qu'une option dans la modale ») : le contrôle vit dans la console. On mesure
   * l'écran RÉEL : la ligne de posture est là, elle dit son état, et elle ne porte aucun bouton.
   */
  it('la posture de tir est AFFICHÉE en lecture seule — état lisible, aucun bouton de bascule', () => {
    const v = renderAttack({ ranged: true });
    const ligne = v.querySelector('[data-posture="heldGround"]')!;
    expect(ligne, 'un tir de héros annonce sa posture').toBeTruthy();
    expect(ligne.hasAttribute('data-armee'), 'ce pending est armé immobile').toBe(true);
    expect(ligne.textContent).toContain('Tir immobile — armé');
    expect(ligne.textContent).toContain('Mouvement du Tour consommé');
    expect(ligne.querySelector('button'), 'aucun contrôle : le choix se pose à la console').toBeNull();
  });

  it('posture NON armée : la fenêtre le dit aussi, et reste sans bouton', () => {
    const v = renderAttack({ ranged: true, enMouvement: true });
    const ligne = v.querySelector('[data-posture="heldGround"]')!;
    expect(ligne.hasAttribute('data-armee')).toBe(false);
    expect(ligne.textContent).toContain('Tir immobile — non armé');
    expect(ligne.textContent).toContain('-10 « Tir en bougeant »');
    expect(ligne.querySelector('button')).toBeNull();
  });

  /**
   * « Dans le tas » ARMÉE à la console mais SANS OBJET sur la cible visée (`LDB 14 l.106` : le bonus
   * n'existe que face à un groupe) : la case de console ne connaît pas la cible, la fenêtre de jet SI.
   * Elle est donc le siège du verdict par cible — et elle le DIT, avec la raison du prédicat partagé
   * (`intoCrowdStanceBlock`), au lieu de taire la posture.
   */
  it('« Dans le tas » armée + cible ISOLÉE : la ligne est là, sans objet, avec sa raison', () => {
    const v = renderAttack({ ranged: true, tasArme: true });
    const ligne = v.querySelector('[data-posture="intoCrowd"]')!;
    expect(ligne, 'une posture armée ne disparaît pas en silence').toBeTruthy();
    expect(ligne.hasAttribute('data-armee'), 'sans groupe, elle ne mord pas').toBe(false);
    expect(ligne.textContent).toContain('sans objet sur cette cible');
    expect(ligne.textContent).toContain('aucun groupe serré en vue');
    expect(ligne.querySelector('button')).toBeNull();
  });

  it('« Dans le tas » armée + cible EN GROUPE : la ligne de bonus normale (+20, 3 au contact)', () => {
    const v = renderAttack({ ranged: true, tasArme: true, badauds: 2 });
    const ligne = v.querySelector('[data-posture="intoCrowd"]')!;
    expect(ligne.hasAttribute('data-armee')).toBe(true);
    expect(ligne.textContent).toContain('Dans le tas — armée (+20)');
    expect(ligne.textContent).toContain('3 au contact');
    expect(ligne.textContent).not.toContain('sans objet');
  });

  /**
   * SYMÉTRIE du cas ci-dessus pour le TIR IMMOBILE (`LDB 14 l.70`) : la console arme la posture au
   * début du Tour, le joueur entame ensuite son Mouvement — la posture est PÉRIMÉE quand le tir part.
   * Le pending ne la porte donc pas ; la fenêtre la rend quand même, avec la raison du prédicat partagé
   * (`heldGroundStanceBlock`).
   */
  it('« Tir immobile » armé puis Mouvement ENTAMÉ : la ligne est là, sans objet, avec sa raison', () => {
    const v = renderAttack({ ranged: true, tirArme: true, mouvementUse: 3 });
    const ligne = v.querySelector('[data-posture="heldGround"]')!;
    expect(ligne, 'une posture armée ne disparaît pas en silence').toBeTruthy();
    expect(ligne.hasAttribute('data-armee'), 'le Mouvement entamé la périme').toBe(false);
    expect(ligne.textContent).toContain('sans objet sur ce tir');
    expect(ligne.textContent).toContain('Mouvement déjà entamé ce tour');
    expect(ligne.querySelector('button')).toBeNull();
  });

  it('« Tir immobile » armé + Mouvement INTACT : la ligne de posture armée normale', () => {
    const v = renderAttack({ ranged: true, tirArme: true });
    const ligne = v.querySelector('[data-posture="heldGround"]')!;
    expect(ligne.hasAttribute('data-armee')).toBe(true);
    expect(ligne.textContent).toContain('Tir immobile — armé');
    expect(ligne.textContent).toContain('Mouvement du Tour consommé');
    expect(ligne.textContent).not.toContain('sans objet');
  });

  it('MÊLÉE : aucune ligne de posture de tir dans la fenêtre', () => {
    const v = renderAttack();
    expect(v.querySelector('[data-posture]'), 'une attaque au contact n’a pas de posture de tir').toBeNull();
  });

  it('le contrôle des postures vit dans la console (bascule de posture du store)', () => {
    const store = useGame.getState() as unknown as Record<string, unknown>;
    expect(typeof store.battleToggleStance, 'le contrôle vit dans la bascule de posture').toBe('function');
  });
});

/**
 * GRILLE DE RECETTE du palier DÉRIVÉ (#1153 L3b-2), sur l'ÉCRAN RÉEL — aucun pending forgé. Mesuré :
 *  1. la zone Difficulté (Z5, `.rm-roll-diff`) dit le palier que les CIRCONSTANCES composent
 *     (`LDB 14 l.91-96`, verbatim : « le brouillard ajouté au fait de vouloir toucher une
 *     Localisation précise […] le Test devient simplement **Très Difficile (-30)** ») ;
 *  2. ces circonstances ne sont plus des chips — le palier les porte (composition au popover) ;
 *  3. un modificateur de JET (État du jeteur, `LDB 16 l.11` « à tous vos Tests ») RESTE une chip et
 *     ne bouge pas le palier : la taxonomie se VOIT à l'écran ;
 *  4. `ANONYMES.count === 0` partout : aucune ligne ne cache d'écart.
 */
describe('Attaque — la Difficulté DÉRIVE des circonstances (#1153 L3b-2)', () => {
  const ligne = (v: HTMLDivElement) => v.querySelector('.rm-roll-block') as HTMLElement;
  const palier = (v: HTMLDivElement) => ligne(v).querySelector('.rm-roll-diff')?.textContent;
  const chips = (v: HTMLDivElement) => Array.from(ligne(v).querySelectorAll('.rm-mod')).map((c) => c.textContent);
  const calcul = (v: HTMLDivElement) => ligne(v).querySelector('.rm-roll-calc')?.textContent;
  /** Le palier est-il sa PROPRE affordance de règle (déclencheur `CodexRef` → popover de composition,
   *  fiche « Combiner les Difficultés ») ? C'est la trace ADN du mode DÉRIVÉ — un palier CHOISI reste
   *  du texte nu. */
  const porte = (v: HTMLDivElement) => ligne(v).querySelector('.rm-roll-diff .codex-ref')?.textContent;
  /** OUVRE le popover du palier (survol) et rend son contenu : le popover est un PORTAL monté à la
   *  demande — sans le geste, il n'existe pas dans le DOM. C'est là que se lit la COMPOSITION. */
  const popover = (v: HTMLDivElement): string => {
    const trigger = ligne(v).querySelector('.rm-roll-diff .codex-ref');
    if (!trigger) return '';
    act(() => { trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    return document.querySelector('.codex-pop')?.textContent ?? '';
  };
  /** L'affordance (i) qui SIGNALE la porte : elle vit DANS le déclencheur (même hit-target), jamais
   *  accolée à côté, et elle SUIT le palier — arbitrage user 2026-08-10 : « le (i) par convention est
   *  apres et non avant ceux a quoi il fait référence ». */
  const infoPalier = (v: HTMLDivElement) => ligne(v).querySelector('.rm-roll-diff .codex-ref svg.icon');
  /** Le NOM du jet (la Compétence lancée) est-il une porte Codex ? Il l'est PAR SON POPOVER seul :
   *  aucun (i) ne le précède (même arbitrage). */
  const nomDuJet = (v: HTMLDivElement) => ligne(v).querySelector('.rm-roll-label > .codex-ref');

  it('RAW l.95 — brouillard + Localisation visée : « Très difficile (−30) », zéro chip de circonstance', () => {
    const v = renderAttack({ ranged: true, fog: true, location: 'tete' });
    expect(palier(v)).toBe('Très difficile (−30)');
    expect(chips(v), 'les circonstances vivent dans le palier, pas en chips').toEqual([]);
    expect(ligne(v).textContent).not.toContain('plafond Difficultés');
    expect(ligne(v).textContent).not.toContain('autres');
    // Capacité de Tir 40 − 30 = 10, et non 40 − 40 : le plafond a mordu, le palier le DIT.
    expect(calcul(v)).toBe('40 −30 = 10');
    expect(porte(v), 'le palier DÉRIVÉ porte le popover de sa composition').toBe('Très difficile (−30)');
    const decl = ligne(v).querySelector('.rm-roll-diff .codex-ref')!;
    expect(infoPalier(v), 'la porte se SIGNALE : un (i) dans le déclencheur, pas à côté').toBeTruthy();
    // `lastChild` et non `lastElementChild` : le palier est un nœud TEXTE — l'ignorer rendrait
    // l'assertion aveugle à l'ordre. Convention utilisateur 2026-08-10, verbatim : « le (i) par
    // convention est apres et non avant ceux a quoi il fait référence ».
    expect(decl.lastChild, 'le (i) SUIT le palier, il ne le précède pas').toBe(infoPalier(v));
    expect(
      ligne(v).querySelector('.rm-roll-diff .codex-ref')!.getAttribute('aria-label'),
      'le nom accessible COMMENCE par le texte visible et nomme la règle atteinte',
    ).toBe('Très difficile (−30) — Combiner les Difficultés');
    expect(ANONYMES.count).toBe(0);
  });

  /** UNIFICATION (#1153) : toute Difficulté affichée a la MÊME grammaire — même (i), même porte vers
   *  la fiche des Difficultés. Une Difficulté sans composition n'a rien à énumérer, elle reste
   *  explorable : le joueur qui découvre le (i) sur une ligne le retrouve sur toutes. */
  it('attaque simple : « Intermédiaire (+0) » (LDB 13 l.118), aucune chip, MÊME affordance', () => {
    const v = renderAttack();
    expect(palier(v)).toBe('Intermédiaire (+0)');
    expect(chips(v)).toEqual([]);
    expect(calcul(v)).toBe('45');
    expect(porte(v), 'la Difficulté déclarée ouvre la même fiche que la composée').toBe('Intermédiaire (+0)');
    expect(infoPalier(v), 'le (i) ne dépend pas du mode : la grammaire est unique').toBeTruthy();
    expect(ANONYMES.count).toBe(0);
  });

  it('l’État du JETEUR (Empoisonné, LDB 16 l.11) reste une CHIP — palier inchangé', () => {
    const v = renderAttack({ conditions: [{ id: 'empoisonne', value: 1 }] });
    expect(palier(v)).toBe('Intermédiaire (+0)');
    expect(chips(v)).toEqual(['−10 Empoisonné']);
    expect(calcul(v)).toBe('45 −10 = 35');
    expect(ANONYMES.count).toBe(0);
  });

  it('MIXTE — la chip d’État SURVIT à côté du palier composé par la Localisation visée', () => {
    const v = renderAttack({ location: 'tete', conditions: [{ id: 'empoisonne', value: 1 }] });
    expect(palier(v)).toBe('Difficile (−20)');
    expect(chips(v)).toEqual(['−10 Empoisonné']);
    expect(calcul(v)).toBe('45 −30 = 15');
    expect(ANONYMES.count).toBe(0);
  });

  /**
   * CAS DE RECETTE — trois circonstances de la table (+20 −20 −10) et un État du jeteur (−10). Les
   * deux familles ne se mélangent pas : les circonstances composent le palier (`LDB 14 l.95` : leur
   * somme « devient la nouvelle difficulté »), l'État reste une chip qui pèse EN PLUS sur la cible
   * (`LDB 16 l.11`). Aucune amputation ici : la somme des circonstances (−10) ne touche pas le
   * plafond, et rien ne peut plus rembourser à l'une ce qui est coupé à l'autre.
   */
  it('RECETTE — palier des circonstances D’UN CÔTÉ, chip d’État DE L’AUTRE, sur la même ligne', () => {
    const v = renderAttack({
      ranged: true, cases: 5, location: 'tete', enMouvement: true,
      conditions: [{ id: 'empoisonne', value: 1 }],
    });
    expect(palier(v), 'les circonstances SEULES composent le palier').toBe('Complexe (−10)');
    expect(porte(v), 'le palier dérivé est explorable').toBeDefined();
    expect(popover(v)).toContain('+20 Courte portée');
    expect(popover(v)).toContain('−20 Localisation visée');
    expect(popover(v)).toContain('−10 Tir en bougeant');
    expect(popover(v), 'aucune amputation : le plafond ne mord pas sur −10').not.toContain('plafond Difficultés');
    expect(chips(v), 'l’État du jeteur ne se dilue jamais dans la Difficulté').toEqual(['−10 Empoisonné']);
    expect(calcul(v)).toBe('40 −20 = 20');
    expect(ANONYMES.count).toBe(0);
  });

  /**
   * Le palier ne se contente pas d'être une porte : son popover DIT sa composition. Sans cette
   * mesure, `difficultyParts` pourrait être vide/tronqué et le déclencheur resterait vert — le
   * joueur lirait « Très difficile » sans jamais savoir de quoi c'est fait.
   */
  it('le POPOVER du palier énumère les circonstances qui le composent', () => {
    const v = renderAttack({ ranged: true, fog: true, location: 'tete' });
    const pop = popover(v);
    expect(pop, 'l’instance lue à l’écran ouvre le popover').toContain('Très difficile (−30)');
    expect(pop, 'la règle qui plafonne est nommée').toContain('Combiner les Difficultés');
    expect(pop).toContain('−20 Brouillard');
    expect(pop).toContain('−20 Localisation visée');
    expect(pop, 'l’amputation du plafond est une composante du palier, pas un silence').toContain('+10 plafond Difficultés');
  });

  /**
   * AVANTAGE 6 (+60, hors table `LDB 14 l.48`) — Capacité de Combat 45 + 60 = 105, au-delà de la borne
   * `targetMax` : `clampTarget` ramène à 99 et MESURE l'amputation (−6). C'est le bug historique de
   * recette : sans le relai de `clamped` jusqu'au pending, cet écart sortait en chip « autres ».
   * Aucun test d'ÉCRAN ne le verrouillait — celui-ci le fait, sur la ligne réellement rendue.
   */
  it('AVANTAGE 6 : la cible écrêtée à 99 nomme son « plafond 99 » — jamais « autres »', () => {
    const v = renderAttack({ avantage: 6 });
    expect(chips(v)).toEqual(['+60 Avantage', '−6 plafond 99']);
    expect(calcul(v)).toBe('45 +54 = 99');
    expect(ligne(v).textContent).not.toContain('autres');
    expect(ANONYMES.count, 'la sonde DEV ne compte aucune chip anonyme').toBe(0);
  });

  /**
   * COHÉRENCE DE RANGÉE : le nom du jet (la Compétence lancée) est une porte Codex de plein droit —
   * sans elle, la rangée apprenait la règle de la Difficulté et taisait celle de la Compétence. Elle
   * s'ouvre par son SEUL popover : le (i) reste au palier (arbitrage user 2026-08-10).
   */
  it('le NOM du jet est une porte Codex — popover SEUL, sans (i)', () => {
    const v = renderAttack({ ranged: true });
    const nom = nomDuJet(v);
    expect(nom, 'le libellé « Projectiles » ouvre sa fiche').toBeTruthy();
    expect(nom!.textContent).toBe('Projectiles');
    expect(nom!.getAttribute('role'), 'porte RÉELLE, pas un texte décoré').toBe('button');
    expect(nom!.querySelector('svg.icon'), 'aucun (i) sur la Compétence : le popover suffit').toBeNull();
  });

  it('le POPOVER du nom du jet donne la règle de la Compétence lancée', () => {
    const v = renderAttack();
    const nom = nomDuJet(v);
    expect(nom!.textContent).toBe('Corps à corps');
    act(() => { nom!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    expect(document.querySelector('.codex-pop')?.textContent).toContain('Corps à corps');
  });
});
