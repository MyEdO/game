// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Combatant, HitLocation, Weapon } from '../../engine/types';
import { openAttackCascade } from '../../noyau/combatFlow';
import { seedBattleRng } from '../../noyau/battleRng';
import { ev } from '../../noyau/combatLog';
import { recapLineOfEvent } from '../../gameIso/combatNarration';
import { useGame } from '../../state/store';
import type { BattleState } from '../../noyau/etat';
import { testScene } from '../../scenes/test-fixture';
import { RollShell } from '../RollShell';
import { ANONYMES } from '../RollLine';
import { useAttackJetProps } from './useAttackJetProps';
import { resetRule, setRule } from '../../engine/policy';
import { passagesDe } from '../../lib/sonde';

/** Les passages de la sonde `ANONYMES` au début du cas. */
let anonymesAvant = 0;

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
  subType: 'base',
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

/** Dernières props rendues — l'aperçu pré-jet et la ligne résolue se lisent sur la MÊME rangée. */
let rendues: ReturnType<typeof useAttackJetProps> = null;

function Probe() {
  const props = useAttackJetProps();
  rendues = props;
  return props ? <RollShell {...props} /> : null;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => { anonymesAvant = passagesDe(ANONYMES); });
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
function renderAttack(opts: { ranged?: boolean; cases?: number; fog?: boolean; location?: HitLocation; enMouvement?: boolean; avantage?: number; conditions?: { id: string; value: number }[]; badauds?: number; tasArme?: boolean; tirArme?: boolean; mouvementUse?: number; armes?: Weapon[]; morsure?: boolean; pietinement?: boolean; bagarre?: number; ethere?: boolean; cible?: { pb?: number; important?: boolean; chanceux?: boolean } } = {}): HTMLDivElement {
  const weapon = opts.ranged ? bow : sword;
  // Tir : 20 cases = 40 m avec une Portée de 60 m → bande « Moyenne » (+0, aucune chip de portée) ;
  // 5 cases = 10 m → « Courte portée » (+20, entrée de la table). Mêlée : au contact. La distance est
  // CHOISIE pour que seules les circonstances mesurées pèsent.
  const attacker = combatant('attacker', 'Elsa', 'hero', 0, opts.armes ?? [weapon], opts.avantage ?? 0);
  if (opts.morsure) (attacker as unknown as { traits: unknown[] }).traits = [{ id: 'morsure', value: 6 }];
  if (opts.pietinement) {
    attacker.size = 'enorme';
    attacker.skills = [
      { id: 'corps-a-corps', spec: 'base', characteristic: 'capacite-de-combat', advances: 8 },
      ...(opts.bagarre ? [{ id: 'corps-a-corps', spec: 'bagarre', characteristic: 'capacite-de-combat', advances: opts.bagarre }] : []),
    ] as Combatant['skills'];
  }
  const target = combatant('target', 'Gobelin', 'enemy', opts.cases ?? (opts.ranged ? 20 : 1));
  if (opts.ethere) (target as unknown as { traits: unknown[] }).traits = [{ id: 'ethere' }];
  if (opts.cible?.pb != null) target.wounds = { current: opts.cible.pb, max: 18 } as Combatant['wounds'];
  if (opts.cible?.important) target.important = true;
  if (opts.cible?.chanceux) target.talents = [{ talentId: 'chanceux', times: 1 }] as Combatant['talents'];
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
    { attackerId: attacker.id, targetId: target.id, location: opts.location ?? null, result: null, ...(opts.morsure ? { freeKind: 'morsure' as const } : opts.pietinement ? { freeKind: 'pietinement' as const } : { weaponUid: weapon.uid }), ...(opts.tirArme ? {} : { heldGround: !opts.enMouvement }) },
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
  // Le choix d'arme tenue n'existe que pour une attaque qui en frappe : la Morsure frappe de la sienne.
  it('choix d’arme : offert à l’attaque d’arme, absent d’une attaque gratuite de créature', () => {
    const hache = { ...sword, name: 'Hache', label: 'Hache', uid: 'hache' } as unknown as Weapon;
    const titres = (v: HTMLDivElement) => [...v.querySelectorAll('.rm-options .mini-title')].map((e) => e.textContent?.trim());
    expect(titres(renderAttack({ armes: [sword, hache] })), 'deux armes tenues : le choix est offert').toContain('Arme');
    act(() => root!.unmount());
    host?.remove();
    expect(titres(renderAttack({ armes: [sword, hache], morsure: true })), 'Morsure : aucun choix d’arme').not.toContain('Arme');
  });

  // LDB 85 l.387 ; ADE II 02 l.604-710.
  it('Piétinement : la modale porte SON intitulé, et l’aperçu lit l’arme et la Compétence du jet', () => {
    const view = renderAttack({ pietinement: true });
    const dialog = view.querySelector('[role="dialog"]')!;
    expect(dialog.querySelector('h3')?.textContent).toBe('Piétinement');
    expect(dialog.querySelector('.rm-subtitle')?.textContent).toBe('Elsa — Piétinement (Corps à corps (Bagarre))');
    const avant = rendues!.rows[0].row.pending!;
    expect(avant.base, 'Bagarre, sans avance : la CC nue, pas la Spé de l’arme tenue').toBe(45);
    expect(avant.mods?.map((m) => m.label)).not.toContain('Possession pas à sa taille');
    act(() => useGame.getState().attackRoll());
    const jet = rendues!.rows[0].row.d!;
    expect([jet.base, jet.target], 'aperçu et jet : même valeur cible').toEqual([avant.base, avant.target]);
  });

  // LDB 85 l.387 ; LDB 14 l.155.
  it('Piétinement : sous-titre et rangée nomment Corps à corps (Bagarre), et le jet tire les Augmentations de cette Spé', () => {
    const view = renderAttack({ pietinement: true, bagarre: 5 });
    expect(view.querySelector('.rm-subtitle')?.textContent).toBe('Elsa — Piétinement (Corps à corps (Bagarre))');
    const avant = rendues!.rows[0].row.pending!;
    expect(avant.label).toBe('Corps à corps (Bagarre)');
    expect(avant.base, 'CC 45 + 5 Augmentations de Bagarre, jamais les 8 de Base').toBe(50);
    act(() => useGame.getState().attackRoll());
    expect(rendues!.rows[0].row.d!.base, 'le jet tire la Spé annoncée').toBe(50);
  });

  // ADE II 8 l.233.
  it('arme à Résolution alternative : le sous-titre nomme la Caractéristique pure, sans Spé', () => {
    const belier = { ...sword, name: 'Bélier', label: 'Bélier', uid: 'belier', resolveChar: 'force' } as unknown as Weapon;
    const view = renderAttack({ armes: [belier] });
    expect(view.querySelector('.rm-subtitle')?.textContent).toBe('Elsa — Attaque (Force)');
    expect(rendues!.rows[0].row.pending!.label).toBe('Force');
  });

  it('rend une seule modale avec le titre nu, le sous-titre composé et un unique A→B', () => {
    const view = renderAttack();
    const dialogs = view.querySelectorAll('[role="dialog"]');
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0].querySelector('h3')?.textContent).toBe('Attaque');
    expect(dialogs[0].querySelector('.rm-subtitle')?.textContent).toBe('Elsa — Attaque (Corps à corps (Base))');
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
 *  2. ces circonstances ne sont plus des chips — le palier les porte (composition à l'infobulle) ;
 *  3. un modificateur de JET (État du jeteur, `LDB 16 l.11` « à tous vos Tests ») RESTE une chip et
 *     ne bouge pas le palier : la taxonomie se VOIT à l'écran ;
 *  4. `passagesDe(ANONYMES)` immobile partout : aucune ligne ne cache d'écart.
 */
describe('Attaque — la Difficulté DÉRIVE des circonstances (#1153 L3b-2)', () => {
  const ligne = (v: HTMLDivElement) => v.querySelector('.rm-roll-block') as HTMLElement;
  const palier = (v: HTMLDivElement) => ligne(v).querySelector('.rm-roll-diff')?.textContent;
  const chips = (v: HTMLDivElement) => Array.from(ligne(v).querySelectorAll('.rm-mod')).map((c) => c.textContent);
  const calcul = (v: HTMLDivElement) => ligne(v).querySelector('.rm-roll-calc')?.textContent;
  /** Le palier est-il sa PROPRE affordance de règle (déclencheur `CodexRef` → infobulle de composition,
   *  fiche « Combiner les Difficultés ») ? C'est la trace ADN du mode DÉRIVÉ — un palier CHOISI reste
   *  du texte nu. */
  const porte = (v: HTMLDivElement) => ligne(v).querySelector('.rm-roll-diff .codex-ref')?.textContent;
  /** OUVRE l'infobulle du palier (survol) et rend son contenu : l'infobulle est un PORTAL monté à la
   *  demande — sans le geste, il n'existe pas dans le DOM. C'est là que se lit la COMPOSITION. */
  const infobulle = (v: HTMLDivElement): string => {
    const trigger = ligne(v).querySelector('.rm-roll-diff .codex-ref');
    if (!trigger) return '';
    act(() => { trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    return document.querySelector('.infobulle')?.textContent ?? '';
  };
  /** L'affordance (i) qui SIGNALE la porte : elle vit DANS le déclencheur (même hit-target), jamais
   *  accolée à côté, et elle SUIT le palier — arbitrage user 2026-08-10 : « le (i) par convention est
   *  apres et non avant ceux a quoi il fait référence ». */
  const infoPalier = (v: HTMLDivElement) => ligne(v).querySelector('.rm-roll-diff .codex-ref svg.icon');
  /** Le NOM du jet (la Compétence lancée) est-il une porte Codex ? Il l'est PAR SON INFOBULLE seule :
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
    expect(porte(v), 'le palier DÉRIVÉ porte l’infobulle de sa composition').toBe('Très difficile (−30)');
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
    expect((passagesDe(ANONYMES) - anonymesAvant)).toBe(0);
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
    expect((passagesDe(ANONYMES) - anonymesAvant)).toBe(0);
  });

  it('l’État du JETEUR (Empoisonné, LDB 16 l.11) reste une CHIP — palier inchangé', () => {
    const v = renderAttack({ conditions: [{ id: 'empoisonne', value: 1 }] });
    expect(palier(v)).toBe('Intermédiaire (+0)');
    expect(chips(v)).toEqual(['−10 Empoisonné']);
    expect(calcul(v)).toBe('45 −10 = 35');
    expect((passagesDe(ANONYMES) - anonymesAvant)).toBe(0);
  });

  it('MIXTE — la chip d’État SURVIT à côté du palier composé par la Localisation visée', () => {
    const v = renderAttack({ location: 'tete', conditions: [{ id: 'empoisonne', value: 1 }] });
    expect(palier(v)).toBe('Difficile (−20)');
    expect(chips(v)).toEqual(['−10 Empoisonné']);
    expect(calcul(v)).toBe('45 −30 = 15');
    expect((passagesDe(ANONYMES) - anonymesAvant)).toBe(0);
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
    expect(infobulle(v)).toContain('+20 Courte portée');
    expect(infobulle(v)).toContain('−20 Localisation visée');
    expect(infobulle(v)).toContain('−10 Tir en bougeant');
    expect(infobulle(v), 'aucune amputation : le plafond ne mord pas sur −10').not.toContain('plafond Difficultés');
    expect(chips(v), 'l’État du jeteur ne se dilue jamais dans la Difficulté').toEqual(['−10 Empoisonné']);
    expect(calcul(v)).toBe('40 −20 = 20');
    expect((passagesDe(ANONYMES) - anonymesAvant)).toBe(0);
  });

  /**
   * Le palier ne se contente pas d'être une porte : son infobulle DIT sa composition. Sans cette
   * mesure, `difficultyParts` pourrait être vide/tronqué et le déclencheur resterait vert — le
   * joueur lirait « Très difficile » sans jamais savoir de quoi c'est fait.
   */
  it('l’INFOBULLE du palier énumère les circonstances qui le composent', () => {
    const v = renderAttack({ ranged: true, fog: true, location: 'tete' });
    const pop = infobulle(v);
    expect(pop, 'l’instance lue à l’écran ouvre l’infobulle').toContain('Très difficile (−30)');
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
    expect((passagesDe(ANONYMES) - anonymesAvant), 'la sonde DEV ne compte aucune chip anonyme').toBe(0);
  });

  /**
   * COHÉRENCE DE RANGÉE : le nom du jet (la Compétence lancée) est une porte Codex de plein droit —
   * sans elle, la rangée apprenait la règle de la Difficulté et taisait celle de la Compétence. Elle
   * s'ouvre par sa SEULE infobulle : le (i) reste au palier (arbitrage user 2026-08-10).
   */
  it('le NOM du jet est une porte Codex — infobulle SEULE, sans (i)', () => {
    const v = renderAttack({ ranged: true });
    const nom = nomDuJet(v);
    expect(nom, 'le libellé « Projectiles » ouvre sa fiche').toBeTruthy();
    expect(nom!.textContent).toBe('Projectiles');
    expect(nom!.getAttribute('role'), 'porte RÉELLE, pas un texte décoré').toBe('button');
    expect(nom!.querySelector('svg.icon'), 'aucun (i) sur la Compétence : l’infobulle suffit').toBeNull();
  });

  it('l’INFOBULLE du nom du jet donne la règle de la Compétence lancée', () => {
    const v = renderAttack();
    const nom = nomDuJet(v);
    expect(nom!.textContent).toBe('Corps à corps (Base)');
    act(() => { nom!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    expect(document.querySelector('.infobulle')?.textContent).toContain('Corps à corps');
  });
});

describe('Attaque — issue d’un coup sans prise', () => {
  // LDB 85 l.98, l.134.
  it('flèche non magique, double, sur une cible Éthérée : l’issue ne présente pas un Critique infligé', () => {
    // Tir à l'arc : aucune fenêtre de Défense ne s'interpose, l'issue s'affiche dans la popin d'attaque.
    renderAttack({ ethere: true, ranged: true });
    seedBattleRng(29);
    act(() => useGame.getState().attackRoll());
    const res = useGame.getState().pendingAttack!.result!;
    expect([res.critical, res.sansPrise], 'précondition : Critique obtenu au jet, coup sans prise').toEqual([true, 'ethere']);
    const issue = rendues!.outcome![0];
    expect(issue.icon, 'l’issue n’est pas celle d’un Critique').not.toBe(recapLineOfEvent(ev('crit', res.log)).icon);
    expect(issue.icon, 'l’issue est celle d’une touche').toBe(recapLineOfEvent(ev('damage', res.log)).icon);
  });

  it('jet forcé sur un double contre une cible Éthérée : aucun sélecteur de Localisation du Critique', () => {
    const vue = renderAttack({ ethere: true, ranged: true });
    act(() => { useGame.getState().battle!.combatants[0].resilience = 1; });
    seedBattleRng(1);
    act(() => useGame.getState().attackRoll());
    expect(useGame.getState().pendingAttack!.result!.attackerDetail!.success, 'précondition : jet raté, à forcer').toBe(false);
    act(() => useGame.getState().attackForceSuccess());
    act(() => useGame.getState().attackSetForcedRoll(33));
    const pa = useGame.getState().pendingAttack!;
    expect([pa.forced, pa.result?.critical, pa.result?.sansPrise], 'précondition : jet forcé, Critique obtenu, coup sans prise').toEqual([true, true, 'ethere']);
    expect(rendues!.forcedExtra, 'pas de Localisation à choisir pour un Critique non appliqué').toBeUndefined();
    expect(vue.querySelector('.rm-loc-grid')).toBeNull();
  });
});

describe('Attaque — l’annonce du Coup Critique lit le compte du coup (LDB 17 l.68 ; LDB 18 l.44 ; AA 07 l.65 ; #1595 c.6219992594, c.6228496170 R1)', () => {
  afterEach(() => { resetRule('combat-aa-blessures'); });

  /** Tir d'arc raté puis forcé à `force` (« Je ne faillirai pas ! ») sur le Gobelin `cible`, au jeu `jeu`. */
  function forcer(jeu: 'ldb' | 'aa', force: number, cible: { pb?: number; important?: boolean; chanceux?: boolean }) {
    if (jeu === 'aa') setRule('combat-aa-blessures', 'aa');
    const vue = renderAttack({ ranged: true, cible });
    act(() => { useGame.getState().battle!.combatants[0].resilience = 1; });
    seedBattleRng(1);
    act(() => useGame.getState().attackRoll());
    expect(useGame.getState().pendingAttack!.result!.attackerDetail!.success, 'précondition : jet raté, à forcer').toBe(false);
    act(() => useGame.getState().attackForceSuccess());
    act(() => useGame.getState().attackSetForcedRoll(force));
    const res = useGame.getState().pendingAttack!.result!;
    expect(res.hit, 'précondition : le jet forcé touche').toBe(true);
    const iconeCrit = recapLineOfEvent(ev('crit', res.log)).icon;
    return { selecteur: rendues!.forcedExtra !== undefined, grille: !!vue.querySelector('.rm-loc-grid'), crit: rendues!.outcome![0].icon === iconeCrit, marque: rendues!.outcome![0].text.includes('CRITIQUE'), res };
  }

  for (const jeu of ['ldb', 'aa'] as const) {
    it.each([18, 2])(`${jeu}, figurant sous Mort subite à %i PB, double forcé : ni sélecteur ni Critique annoncé`, (pb) => {
      const vu = forcer(jeu, 33, { pb });
      expect(vu.res.critical, 'précondition : Critique obtenu au jet').toBe(true);
      expect([vu.selecteur, vu.grille, vu.crit, vu.marque]).toEqual([false, false, false, false]);
    });
  }

  it('ldb, cible importante, double forcé : sélecteur et Critique annoncé', () => {
    const vu = forcer('ldb', 33, { important: true });
    expect([vu.selecteur, vu.grille, vu.crit, vu.marque]).toEqual([true, true, true, true]);
  });

  it('aa, Chanceux, passage de 2 PB à 0 sans double : Critique annoncé, sans sélecteur (branche 2)', () => {
    const vu = forcer('aa', 21, { pb: 2, chanceux: true });
    expect([vu.res.critical, vu.res.woundsLost! >= 2], 'précondition : sans double, le coup fait tomber à 0').toEqual([false, true]);
    expect([vu.selecteur, vu.grille, vu.crit, vu.marque]).toEqual([false, false, true, true]);
  });

  it('aa, Chanceux, déjà à 0 PB, sans double : sélecteur et Critique annoncé (branche 1)', () => {
    const vu = forcer('aa', 21, { pb: 0, chanceux: true });
    expect(vu.res.critical, 'précondition : sans double').toBe(false);
    expect([vu.selecteur, vu.grille, vu.crit, vu.marque]).toEqual([true, true, true, true]);
  });
});

describe('Attaque — l’issue d’une Empoignade (LDB 14 l.159)', () => {
  it('Empoigner coché, touche : la ligne d’issue annonce l’Empoignade sans chiffrer Dégâts ni Blessures', () => {
    const poings = { ...sword, name: 'Mains nues', label: 'Mains nues', uid: 'poings', trappingId: 'mains-nues' } as Weapon;
    const vue = renderAttack({ armes: [poings] });
    // Aucun siège MJ : la Défense du Gobelin ne s'interpose pas, l'issue s'affiche dans la popin d'attaque.
    act(() => useGame.setState({ net: { ...useGame.getState().net, gmSeat: undefined } }));
    const empoigner = [...vue.querySelectorAll('button')].find((b) => b.textContent?.includes('Empoigner'))!;
    act(() => empoigner.click());
    expect(useGame.getState().pendingAttack!.grapple, 'précondition : Empoigner coché').toBe(true);
    act(() => { useGame.getState().battle!.combatants[0].resilience = 1; });
    seedBattleRng(1);
    act(() => useGame.getState().attackRoll());
    if (!useGame.getState().pendingAttack!.result!.hit) {
      act(() => useGame.getState().attackForceSuccess());
      act(() => useGame.getState().attackSetForcedRoll(21));
    }
    const res = useGame.getState().pendingAttack!.result!;
    expect([res.hit, !!res.touche], 'précondition : touche, ligne de touche').toEqual([true, true]);
    const issue = rendues!.outcome![0].text;
    expect(issue).toContain('touche');
    expect(issue).not.toMatch(/dégâts|Blessures/);
    expect(issue).toContain('empoigne Gobelin : ils sont Empoignés et Gobelin gagne l’État Empêtré.');
  });

  it('Empoigner coché, cible devenue inerte : l’issue suit le coup normal, Blessures chiffrées', () => {
    const poings = { ...sword, name: 'Mains nues', label: 'Mains nues', uid: 'poings', trappingId: 'mains-nues' } as Weapon;
    const vue = renderAttack({ armes: [poings] });
    act(() => useGame.setState({ net: { ...useGame.getState().net, gmSeat: undefined } }));
    const empoigner = [...vue.querySelectorAll('button')].find((b) => b.textContent?.includes('Empoigner'))!;
    act(() => empoigner.click());
    expect(useGame.getState().pendingAttack!.grapple, 'précondition : Empoigner coché').toBe(true);
    act(() => {
      const b = useGame.getState().battle!;
      b.combatants[0].resilience = 1;
      b.combatants.find((c) => c.id === useGame.getState().pendingAttack!.targetId)!.inert = true;
    });
    seedBattleRng(1);
    act(() => useGame.getState().attackRoll());
    if (!useGame.getState().pendingAttack!.result!.hit) {
      act(() => useGame.getState().attackForceSuccess());
      act(() => useGame.getState().attackSetForcedRoll(21));
    }
    const res = useGame.getState().pendingAttack!.result!;
    expect([res.hit, !!res.touche], 'précondition : touche, ligne de touche').toEqual([true, true]);
    const issue = rendues!.outcome![0].text;
    expect(issue).toMatch(/\d+ dégâts − \d+ \(.+\) = \d+ Blessures/);
    expect(issue).not.toContain('empoigne');
  });
});
