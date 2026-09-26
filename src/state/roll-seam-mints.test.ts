/**
 * LES CONSTRUCTEURS DE LA PORTE (#1262 lot 0) — `monoStep`, `tableStep`/`tableStepDone`, `hostStep`,
 * les portes d'APPEND (`push*`) et `openSequence`. Ce que ces tests verrouillent :
 *  - la MARQUE d'étape est REQUISE : un littéral nu ne franchit ni le type ni `openSequence` ;
 *  - une étape hôte ne s'ouvre PAS sans le `pending*` qui porte sa donnée (fenêtre fantôme) ;
 *  - une étape mono sans cible ne s'ouvre pas (elle serait validée sans qu'aucun dé ne tombe) ;
 *  - table À POSER et table RÉSOLUE sont DEUX entrées, et la résolue fait descendre l'enjeu ;
 *  - la voie d'APPEND passe par la garde de possession et distingue ses ids par l'index.
 */
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ts from 'typescript';
import { useGame } from './store';
import {
  monoStep, tableStep, tableStepDone, hostStep, openSequence, rollStep,
  pushMono, pushChoice, pushHost, pushTable, pushTableDone, pushBand,
  type BuiltCascadeStep, type HostJet, type HostSpec,
} from './rollSeam';
import { pushStep, registerTableStep, stepInteraction, registerCascadeTableFold, cascadeTableFolds } from './cascade';
import { pushCombatStep } from './combatEffects';
import { modalOwnerOf } from './modalArbiter';
import { ownsLocally, seatOwns } from './netOwnership';
import type { PendingKey } from './stateFields';
import type { CascadeStep } from './pendings';
import type { GameState } from './store';
import { nightBands } from './nightBands';
import type { Combatant, Weapon } from '../engine/types';
import { combatStakeRef, type StakeRef } from '../data';

const hero = (id: string): Combatant =>
  ({
    id, label: `Héros ${id}`, kind: 'hero',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 },
    skills: [], conditions: [], talents: [], fortune: 2, resilience: 3,
  }) as unknown as Combatant;

const TABLE = 'test-mints-table';

/** ENJEU de sonde (#1262 V2 L6d) : `MonoSpec.stake` est REQUIS — une étape mono ne se DÉCLARE plus
 *  sans dire ce qui se joue. Les tests ci-dessous mesurent d'autres champs, mais ils le déclarent
 *  comme tout producteur réel : c'est précisément ce que le murage rend inévitable. */
const ENJEU: StakeRef = combatStakeRef('fatigue');

beforeEach(() => {
  useGame.setState({ battle: null, party: [hero('H1')], pendingCascade: null, suspendedCascades: [] } as never);
  useGame.setState({ net: { ...useGame.getState().net, mode: 'local', mySeat: 0, ownership: {} } } as never);
  registerTableStep(TABLE, {
    label: 'Table des mints',
    rows: [{ min: 1, max: 50, id: 'basse' }, { min: 51, max: 100, id: 'haute' }],
    lines: (die) => [`ligne ${die}`],
    entryCategory: 'mutations',
  });
});

// `stubEnv('DEV')` (contrat du résiduel muet) et les espions de journal sont RENDUS entre les cas :
// `isolate: false` partage le module — un DEV resté faux éteindrait les throws des tests suivants.
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

const etapes = (): CascadeStep[] => useGame.getState().pendingCascade?.participants ?? [];

describe('#1262 — monoStep : un porteur, un jet, une cible', () => {
  it('pose la POSSESSION et la SURFACE, et monte sa ligne par le monteur canonique', () => {
    const step = monoStep({ id: 'calme', kind: 'psych', label: fixtureText('Garder son calme'), actor: hero('H1'), difficulty: 'intermediaire', stake: ENJEU, ligne: { test: { char: 'force-mentale' } } })!;
    expect(step.actorId, 'le mint NOMME le porteur — c’est ce qui donne à l’arbitre un owner à router (sans lui : fenêtre hôte seul)').toBe('H1');
    expect(step.result, 'le dé n’est pas tombé : c’est la fenêtre qui le jette').toBeNull();
    expect(step.target, 'FM 40, Difficulté intermédiaire +0').toBe(40);
    expect(step.base).toBe(40);
    expect(step.rollLabel, 'la ligne NOMME la Compétence dérivée du catalogue').toBe('Force Mentale');
    expect(stepInteraction(step)).toBe('jet');
  });

  it('cible NON CALCULABLE → refusé (DEV : throw) : une étape sans cible serait « prête » d’office', () => {
    expect(() => monoStep({
      id: 'fantome', kind: 'k', label: fixtureText('L'), actor: hero('H1'), difficulty: 'intermediaire', stake: ENJEU,
      ligne: { valeur: Number.NaN, valeurEtrangere: true },
    })).toThrow(/cible non calculable/);
  });

  it('les slots HYBRIDES (révélation, lignes de conséquence) voyagent tels quels', () => {
    const step = monoStep({
      id: 'h', kind: 'k', label: fixtureText('L'), actor: hero('H1'), difficulty: 'intermediaire', stake: ENJEU,
      ligne: { test: { char: 'force-mentale' } },
      reveal: { kind: 'effet', title: 'Ce qui vient d’arriver', lines: ['a'] },
    })!;
    expect(step.reveal!.title).toBe('Ce qui vient d’arriver');
  });

  /**
   * LE RÉSIDUEL DU MURAGE, FIGÉ (#1262 V2 L6d) — `MonoSpec.stake` est requis à la DÉCLARATION, mais sa
   * valeur peut être `undefined` (aucun enjeu déclaré, aucun porteur résoluble). Ce que fait la porte
   * alors n'est PAS ce qu'elle fait d'une cible non calculable, et la différence est un CHOIX :
   *  · cible non calculable → `undefined` : l'étape serait un jet fantôme, validé sans qu'aucun dé ne
   *    tombe — mieux vaut ne rien ouvrir ;
   *  · enjeu muet → l'étape s'ouvre QUAND MÊME (le jet est dû ; le taire coûterait au joueur son jet),
   *    et le refus est JOURNALISÉ (DEV : throw ; PROD : `console.error`).
   * Sans ce contrat, transformer le journal en `return undefined` passerait toutes les suites, et un
   * jet DÛ disparaîtrait en silence — exactement ce que ce chantier combat.
   */
  it('enjeu MUET → l’étape s’ouvre QUAND MÊME, et le refus est journalisé (PROD simulée)', () => {
    vi.stubEnv('DEV', false);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const step = monoStep({ id: 'muet', kind: 'k', label: fixtureText('Jet dû'), actor: hero('H1'), difficulty: 'intermediaire', stake: undefined, ligne: { test: { char: 'force-mentale' } } });
    expect(step, 'le jet DÛ ne disparaît pas : l’étape existe').toBeTruthy();
    expect(step!.target, 'et elle lance pour de vrai (cible calculée)').toBe(40);
    expect(stepInteraction(step!)).toBe('jet');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toMatch(/enjeu MUET/);
  });

  it('enjeu MUET en DEV → THROW : la dégradation se voit au premier passage', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => monoStep({ id: 'muet', kind: 'k', label: fixtureText('Jet dû'), actor: hero('H1'), difficulty: 'intermediaire', stake: undefined, ligne: { test: { char: 'force-mentale' } } }))
      .toThrow(/enjeu MUET/);
  });
});

describe('#1262 — tableStep / tableStepDone : DEUX entrées, jamais un drapeau', () => {
  it('table À POSER : le dé n’est pas tombé, l’interaction est `table`', () => {
    const step = tableStep({ id: 'tir', kind: 'mutation', label: fixtureText('Tirage'), actorId: 'H1', table: { tableId: TABLE }, stake: { key: { dataset: 'combat', kind: 'mutation' } } })!;
    expect(step.table!.result).toBeUndefined();
    expect(stepInteraction(step)).toBe('table');
    expect(step.actorId).toBe('H1');
  });

  it('table À POSER portant DÉJÀ un résultat → refusée (le dé serait re-jeté par la fenêtre)', () => {
    expect(() => tableStep({
      id: 'tir', kind: 'mutation', label: fixtureText('Tirage'), actorId: 'H1',
      table: { tableId: TABLE, result: { roll: 60, die: 60, id: 'haute', lines: ['x'] } },
      stake: { key: { dataset: 'combat', kind: 'mutation' } },
    })).toThrow(/tableStepDone/);
  });

  it('table RÉSOLUE : le résultat est posé, et l’ENJEU descend à la LIGNE tirée (jamais au seul `kind`)', () => {
    const step = tableStepDone({
      id: 'fait', kind: 'mutation', label: fixtureText('Tirage'), actorId: 'H1',
      table: { tableId: TABLE },
      result: { roll: 60, die: 60, id: 'haute', lines: ['ligne 60'] },
      stake: { key: { dataset: 'combat', kind: 'mutation' } },
    })!;
    expect(step.table!.result!.id).toBe('haute');
    expect(stepInteraction(step), 'une table résolue s’affiche, elle ne se retire pas').toBe('affichage');
    expect(step.stake!.key!.entryId, 'la ligne jouée, pas le kind').toBe('haute');
    expect(step.stake!.key!.entryCategory, 'catégorie DÉCLARÉE PAR LA TABLE').toBe('mutations');
  });

  /**
   * MURAGE AU TYPE (#1262 V2 L6) — l'ENJEU d'un tirage est REQUIS : `TableSpec.stake` n'est plus
   * optionnel, donc les deux directives ci-dessous sont TUEUSES (sous `stake?`, elles deviendraient
   * INUTILISÉES et `tsc` rougirait en TS2578 — c'est ce que rejoue la sonde de `built-brand-lint`).
   * Le cliquet textuel a perdu son volet `table:` dans le même geste : le compilateur le remplace.
   */
  it('un tirage MUET ne compile plus — ni à poser, ni résolu', () => {
    // @ts-expect-error — `stake` manquant : un tirage qui LANCE dit ce qu'il met en jeu
    expect(() => tableStep({ id: 'muet', kind: 'mutation', label: 'Tirage', actorId: 'H1', table: { tableId: TABLE } })).toBeTypeOf('function');
    // @ts-expect-error — même exigence sur la table DÉJÀ tirée (`TableDoneSpec` hérite de `TableSpec`)
    expect(() => tableStepDone({ id: 'muet2', kind: 'mutation', label: 'Tirage', actorId: 'H1', table: { tableId: TABLE }, result: { roll: 60, die: 60, id: 'haute', lines: [] } })).toBeTypeOf('function');
  });

  /**
   * CONTRÔLE POSITIF du refus (#1426) : un `kind` qui déclare un PLI post-dé (`registerCascadeTableFold`)
   * ne peut PAS être poussé déjà tiré — aucune fenêtre ne jouerait son pli, et l'étape arriverait
   * résolue mais SANS sa dérivée (le Critique manquant à une étape de Déviation). Le refus passe par
   * le canal unique des portes (`refusePorte` : lève en DEV, journalise en PROD) et ne rend AUCUNE
   * étape — jamais un drop silencieux.
   */
  it('table déjà tirée sur un `kind` À PLI post-dé → REFUSÉE (le pli ne serait jamais joué)', () => {
    const KIND_A_PLI = 'test-mints-kind-a-pli';
    registerCascadeTableFold(KIND_A_PLI, (step) => step);
    try {
      expect(() => tableStepDone({
        id: 'plie', kind: KIND_A_PLI, label: fixtureText('Tirage'), actorId: 'H1',
        table: { tableId: TABLE }, result: { roll: 60, die: 60, id: 'haute', lines: ['x'] },
        stake: { key: { dataset: 'combat', kind: 'mutation' } },
      })).toThrow(/PLI post-dé/);
      // PROD : le canal journalise au lieu de lever, et le mint rend `undefined` (rien à pousser).
      const dev = import.meta.env.DEV;
      vi.spyOn(console, 'error').mockImplementation(() => {});
      (import.meta.env as { DEV: boolean }).DEV = false;
      try {
        expect(tableStepDone({
          id: 'plie2', kind: KIND_A_PLI, label: fixtureText('Tirage'), actorId: 'H1',
          table: { tableId: TABLE }, result: { roll: 60, die: 60, id: 'haute', lines: ['x'] },
          stake: { key: { dataset: 'combat', kind: 'mutation' } },
        }), 'aucune étape rendue : le refus est explicite, pas un drop').toBeUndefined();
        expect(console.error, 'un refus PROD se journalise').toHaveBeenCalled();
      } finally { (import.meta.env as { DEV: boolean }).DEV = dev; vi.restoreAllMocks(); }
      // TÉMOIN : le MÊME appel sur un `kind` SANS pli passe — c'est bien le pli qui refuse.
      expect(tableStepDone({
        id: 'sans-pli', kind: 'mutation', label: fixtureText('Tirage'), actorId: 'H1',
        table: { tableId: TABLE }, result: { roll: 60, die: 60, id: 'haute', lines: ['x'] },
        stake: { key: { dataset: 'combat', kind: 'mutation' } },
      })).toBeTruthy();
    } finally { delete cascadeTableFolds[KIND_A_PLI]; }
  });
});

/** Miroir de `PENDING_BY_JET` (privé au mint) — TOTAL par le type : un `jet` de plus dans l'union
 *  ne compile plus sans sa ligne ici, comme dans le mint. */
const SLOT_ATTENDU: Record<HostJet, PendingKey | null> = {
  attack: 'pendingAttack',
  trample: 'pendingTrample',
  defense: 'pendingDefense',
  fumble: null,
  cast: 'pendingCast',
  test: 'pendingTest',
  extended: 'pendingExtendedTest',
  disengage: 'pendingDisengage',
  forceDoor: 'pendingForceDoor',
};

const ARME = { label: 'Épée', damage: 4 } as unknown as Weapon;

describe('#1262 — hostStep : jamais de fenêtre sans la donnée qu’elle rend', () => {
  it('les NEUF jets sont couverts (union fermée × table totale)', () => {
    expect(Object.keys(SLOT_ATTENDU)).toHaveLength(9);
  });

  for (const [jet, slot] of Object.entries(SLOT_ATTENDU) as [HostJet, PendingKey | null][]) {
    if (!slot) continue;
    it(`jet:'${jet}' sans \`${slot}\` → refusé (DEV : throw) — la cadence auto validerait la fenêtre à vide`, () => {
      expect(() => hostStep(useGame.getState, { id: 'h', kind: 'k', jet, actorId: 'H1' } as never)).toThrow(new RegExp(slot));
    });

    it(`jet:'${jet}' avec son \`${slot}\` posé → étape hôte montée`, () => {
      useGame.setState({ [slot]: { marqueur: true } } as never);
      const step = hostStep(useGame.getState, { id: 'h', kind: 'k', jet, actorId: 'H1' } as never)!;
      expect(step.jet).toBe(jet);
      expect(step.actorId).toBe('H1');
      useGame.setState({ [slot]: null } as never);
    });
  }

  it('jet:\'fumble\' : aucun pending à attendre, sa charge vit SUR l’étape', () => {
    const step = hostStep(useGame.getState, { id: 'f', kind: 'fumbleJet', jet: 'fumble', actorId: 'H1', fumble: { weapon: ARME, result: null } })!;
    expect(step.fumble!.weapon.label).toBe('Épée');
  });

  it('jet:\'fumble\' SANS sa charge → refusé au TYPE (union discriminée)', () => {
    // @ts-expect-error — `fumble` requis par la branche `jet:'fumble'`
    const nu: HostSpec = { id: 'f', kind: 'fumbleJet', jet: 'fumble', actorId: 'H1' };
    expect(nu.jet).toBe('fumble');
  });

  it('une charge de Maladresse sur un AUTRE jet est inexprimable', () => {
    // @ts-expect-error — `fumble` interdit hors de sa branche
    const croise: HostSpec = { id: 'x', kind: 'k', jet: 'attack', actorId: 'H1', fumble: { weapon: ARME, result: null } };
    expect(croise.jet).toBe('attack');
  });

  it('`groupOwner` est le SEUL canal de possession partagée de la famille (moment de cast partagé)', () => {
    useGame.setState({ pendingCast: { marqueur: true } } as never);
    const step = hostStep(useGame.getState, { id: 'c', kind: 'cast', jet: 'cast', actorId: 'H1', groupOwner: true })!;
    expect(step.groupOwner).toBe(true);
    useGame.setState({ pendingCast: null } as never);
  });
});

describe('#1262 — la MARQUE mure la porte', () => {
  it('un littéral nu n’est PAS une étape mintée', () => {
    // @ts-expect-error — marque absente
    const nu: BuiltCascadeStep = { id: 'e', kind: 'k', label: 'L', interactive: true };
    expect(nu.id).toBe('e');
  });

  it('`openSequence` refuse un littéral monté à la main (le contrôle du juge)', () => {
    // @ts-expect-error — `steps` n'accepte que des étapes MINTÉES
    openSequence(useGame.getState, useGame.setState, { title: 'T', purpose: 'test', steps: [{ id: 'e', kind: 'k', label: 'L', interactive: true }] });
    expect(true).toBe(true);
  });

  it('`openSequence` ouvre la séquence d’une étape MINTÉE', () => {
    const step = monoStep({ id: 'm', kind: 'k', label: fixtureText('L'), actor: hero('H1'), difficulty: 'intermediaire', stake: ENJEU, ligne: { test: { char: 'force-mentale' } } })!;
    openSequence(useGame.getState, useGame.setState, { title: 'Titre', purpose: 'test', steps: [step] });
    expect(useGame.getState().pendingCascade!.title).toBe('Titre');
    expect(etapes()).toHaveLength(1);
  });

  /**
   * LE MURAGE DE LA VAGUE COMBAT (#1262 B4) — `pushCombatStep` est le point d'append historique des
   * étapes de combat. Retypé à la MARQUE, il prend seulement ce qu'un mint a monté : le site qui
   * bâtirait son étape à la main NE COMPILE PLUS, dans les deux formes (déclaration directe ET
   * fabrique indexée). Le verrou est celui du COMPILATEUR : c'est la ligne `@ts-expect-error` qui
   * l'atteste (sans l'erreur attendue, `tsc` échoue) — l'exécution, elle, ignore les types, et l'étape
   * atterrit bel et bien dans la séquence. Ce qui suit le mesure, pour ne rien promettre de plus.
   */
  it('`pushCombatStep` refuse au TYPE un littéral d’étape monté à la main', () => {
    // @ts-expect-error — `step` n'accepte que des étapes MINTÉES (marque absente)
    pushCombatStep(useGame.setState, { id: 'e', kind: 'k', label: 'L', actorId: 'H1', interactive: true });
    expect(etapes().map((s) => s.id)).toEqual(['e']);
  });

  it('`pushCombatStep` refuse au TYPE la FABRIQUE qui rend un littéral', () => {
    // @ts-expect-error — la fabrique doit rendre une étape MINTÉE
    pushCombatStep(useGame.setState, (index: number) => ({ id: `e-${index}`, kind: 'k', label: 'L', actorId: 'H1', interactive: true }));
    expect(etapes().map((s) => s.id)).toEqual(['e-0']);
  });

  it('`pushCombatStep` accepte l’étape MINTÉE (la voie qui reste ouverte)', () => {
    const step = monoStep({ id: 'm', kind: 'k', label: fixtureText('L'), actor: hero('H1'), difficulty: 'intermediaire', stake: ENJEU, ligne: { test: { char: 'force-mentale' } } })!;
    pushCombatStep(useGame.setState, step);
    expect(etapes().map((s) => s.id)).toEqual(['m']);
    expect(useGame.getState().pendingCascade!.purpose).toBe('combat');
  });
});

describe('#1262 — les portes d’APPEND', () => {
  it('l’appelant ne fournit NI titre NI purpose : l’étape rejoint la séquence de combat', () => {
    pushMono(useGame.setState, { id: 'a', kind: 'k', label: fixtureText('Étape A'), actor: hero('H1'), difficulty: 'intermediaire', stake: ENJEU, ligne: { test: { char: 'force-mentale' } } });
    expect(useGame.getState().pendingCascade!.purpose).toBe('combat');
    expect(etapes()[0].id).toBe('a');
  });

  it('FABRIQUE-INDEX : deux étapes de MÊME clé prennent des ids DISTINCTS dans la séquence', () => {
    const decl = (index: number) => ({ id: `miscast-${index}`, kind: 'k', label: fixtureText('Imparfaite'), actor: hero('H1'), difficulty: 'intermediaire' as const, stake: ENJEU, ligne: { test: { char: 'force-mentale' as const } } });
    pushMono(useGame.setState, decl);
    pushMono(useGame.setState, decl);
    expect(etapes().map((s) => s.id)).toEqual(['miscast-0', 'miscast-1']);
  });

  it('une déclaration REFUSÉE par son mint n’appende RIEN', () => {
    pushMono(useGame.setState, { id: 'ok', kind: 'k', label: fixtureText('L'), actor: hero('H1'), difficulty: 'intermediaire', stake: ENJEU, ligne: { test: { char: 'force-mentale' } } });
    expect(() => pushTable(useGame.setState, {
      id: 'ko', kind: 'k', label: fixtureText('L'), actorId: 'H1',
      table: { tableId: TABLE, result: { roll: 60, die: 60, id: 'haute', lines: [] } },
      stake: { key: { dataset: 'combat', kind: 'mutation' } },
    })).toThrow(/tableStepDone/);
    expect(etapes().map((s) => s.id), 'la séquence n’a pas bougé').toEqual(['ok']);
  });

  it('`pushHost` refuse aussi la fenêtre fantôme (le mint est le même des deux côtés)', () => {
    expect(() => pushHost(useGame.getState, useGame.setState, { id: 'h', kind: 'k', jet: 'attack', actorId: 'H1' })).toThrow(/pendingAttack/);
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('`pushChoice` ne peut pas produire un choix de GROUPE (le mint ne pose que le porteur)', () => {
    pushChoice(useGame.setState, { id: 'c', kind: 'pick', label: fixtureText('Choix'), actorId: 'H1', options: [{ key: 'a', label: fixtureText('A') }] });
    expect(etapes()[0].groupOwner).toBeUndefined();
    expect(etapes()[0].actorId).toBe('H1');
  });

  /** La possession de BANDE est ce que la voie d'APPEND doit encore refuser : la garde jumelle du CHOIX
   *  DE GROUPE est morte au profit du type (`ChoiceSpec.groupOwner?: never`, #1262 V4 M2). */
  it('la GARDE de possession mord sur la voie d’APPEND, comme à l’ouverture (#1262 B8)', () => {
    const rangee = (id: string) => ({ id, interactive: true, label: fixtureText('Résistance'), base: 40, target: 40, result: null });
    const sansPossession: CascadeStep = { id: 'e', kind: 'sonde-bande', label: fixtureText('Bande'), aggregate: 'none', participants: [rangee('H1'), rangee('H2')] };
    expect(() => pushStep(useGame.setState, sansPossession, 'combat')).toThrow(/possession/);
    expect(useGame.getState().pendingCascade, 'aucune bande sans possession n’a été appendue').toBeNull();
  });

  it('`pushTableDone` : la table résolue rejoint la séquence, enjeu DESCENDU à la ligne tirée', () => {
    pushTableDone(useGame.setState, {
      id: 'crit', kind: 'mutation', label: fixtureText('Tirage'), actorId: 'H1',
      table: { tableId: TABLE },
      result: { roll: 60, die: 60, id: 'haute', lines: ['ligne 60'] },
      stake: { key: { dataset: 'combat', kind: 'mutation' } },
      outcome: [{ text: 'ligne 60' }],
    });
    const [st] = etapes();
    expect(st.table!.result!.id).toBe('haute');
    expect(st.stake!.key!.entryId, 'un append ne court-circuite pas la re-pose post-tirage').toBe('haute');
    expect(st.outcome).toHaveLength(1);
  });
});

/**
 * `pushBand` est la SEULE porte d'append qui traverse `surfaceRow` — donc la seule dont la
 * régression se joue sur la POSSESSION. En SOLO elle est invisible (`surfaceOf` ≡ « quelqu'un a la
 * main ici ») : le harnais monte deux sièges, H1 à l'invité, et mesure chez l'HÔTE (#1262 B7).
 */
describe('#1262 — pushBand : la bande APPENDUE porte sa possession (assertion COOP)', () => {
  const h1 = hero('H1');
  const h2 = hero('H2');

  beforeEach(() => {
    useGame.setState({ battle: null, party: [h1, h2], pendingCascade: null, suspendedCascades: [] } as never);
    useGame.setState({ net: { ...useGame.getState().net, mode: 'host', mySeat: 0, ownership: { H1: 1, H2: 0 } } } as never);
  });

  it('DEUX porteurs de sièges distincts → bande de GROUPE, et la rangée de l’INVITÉ reste à JOUER', () => {
    pushBand(useGame.getState, useGame.setState, {
      id: 'peur', kind: 'combatPsych', label: fixtureText('Peur'), difficulty: 'intermediaire',
      porteurs: [{ actor: h1, ligne: { test: { char: 'force-mentale' } } }, { actor: h2, ligne: { test: { char: 'force-mentale' } } }],
    });
    const [st] = etapes();
    expect(st.groupOwner, 'deux porteurs ⇒ chaque siège voit la fenêtre où se tient SA rangée').toBe(true);
    expect(modalOwnerOf(useGame.getState())).toBe('*');
    const invite = st.participants!.find((p) => p.id === 'H1')!;
    expect(invite.interactive, 'chez l’hôte, le jet de l’invité ne se roule pas en silence').toBe(true);
    expect(invite.result).toBeNull();
    expect(invite.target, 'FM 40, Difficulté intermédiaire +0').toBe(40);
  });

  it('porteur UNIQUE de l’invité → l’étape le NOMME, et la fenêtre va à SON siège (jamais à l’hôte)', () => {
    pushBand(useGame.getState, useGame.setState, {
      id: 'terreur', kind: 'combatPsych', label: fixtureText('Terreur'), difficulty: 'intermediaire',
      porteurs: [{ actor: h1, ligne: { test: { char: 'force-mentale' } } }],
    });
    const [st] = etapes();
    expect(st.groupOwner).toBeUndefined();
    expect(st.actorId, 'porteur unique → l’étape le NOMME : l’arbitre a un owner à router (sans lui : fenêtre hôte seul)').toBe('H1');
    expect(modalOwnerOf(useGame.getState())).toBe('H1');
    expect(ownsLocally(useGame.getState(), 'H1'), 'chez l’hôte, la fenêtre n’est pas à lui').toBe(false);
    expect(seatOwns(useGame.getState(), 1, 'H1'), 'elle est au siège 1, qui possède le porteur').toBe(true);
  });

  it('zéro porteur → rien n’est appendu (aucune règle mise en jeu)', () => {
    pushBand(useGame.getState, useGame.setState, { id: 'vide', kind: 'k', label: fixtureText('L'), difficulty: 'intermediaire', porteurs: [] });
    expect(useGame.getState().pendingCascade).toBeNull();
  });
});

/**
 * #1262 V2 lot 1 — LES DEUX CANAUX DE LA NUIT sont typés À LA MARQUE : la file des Tests d'entretien
 * différés (`deferredUpkeepQueue`) et la fabrique de bandes (`nightBands`, qui entre et sort en
 * minté). C'est ce qui permet à la fin de combat d'ouvrir sa séquence par la PORTE (`openSequence`)
 * au lieu d'un `startCascade` nu.
 *
 * Les `@ts-expect-error` ci-dessous sont TUEURS : sous l'ancienne signature (`CascadeStep[]`) le
 * littéral passe, la directive devient INUTILISÉE et `tsc` rougit (TS2578) — cf. la sonde rejouable
 * de `built-brand-lint.test.ts`.
 */
describe('#1262 V2 — la FILE d’entretien et la FABRIQUE de nuit n’acceptent que du MINTÉ', () => {
  const LITTERAL = {
    id: 'faim-H1', kind: 'faim', actorId: 'H1', label: 'Faim', rollLabel: 'Résistance',
    base: 40, difficulty: 'intermediaire' as const, target: 40, result: null, interactive: true,
  };
  const minte = (): BuiltCascadeStep => monoStep({
    id: 'faim-H1', kind: 'faim', actor: hero('H1'), label: fixtureText('Faim'), rollLabel: 'Résistance',
    difficulty: 'intermediaire', stake: ENJEU, montee: { base: 40, target: 40 }, meta: { day: 1 },
  })!;

  it('la FILE refuse une étape manuscrite, accepte le produit de la porte', () => {
    const file = (steps: GameState['deferredUpkeepQueue']): number => steps.length;
    // @ts-expect-error — la file est typée à la MARQUE : une étape montée à la main n'y entre plus.
    expect(file([LITTERAL])).toBe(1);
    expect(file([minte()])).toBe(1);
  });

  it('la FABRIQUE de bandes refuse une étape manuscrite, et rend une bande possédée', () => {
    // @ts-expect-error — `nightBands` ENTRE à la marque : rien de manuscrit ne rejoint une séquence par là.
    nightBands([LITTERAL]);
    const [band] = nightBands([minte()]);
    expect(band.participants!.map((r) => r.id), 'le porteur descend en RANGÉE').toEqual(['H1']);
    expect(band.actorId, 'porteur unique → la fenêtre va à SON siège').toBe('H1');
  });

  it('`montee` : la ligne DÉJÀ montée entre TELLE QUELLE (aucun remontage à l’assemblage)', () => {
    const st = monoStep({
      id: 'faim-H1', kind: 'faim', actor: hero('H1'), label: fixtureText('Faim'), difficulty: 'complexe', stake: ENJEU,
      montee: { base: 33, target: 23, mods: [{ label: 'Faim (2ᵉ Test)', value: -10, famille: 'jet' }] },
    })!;
    expect(st.base, 'la base vient du producteur, pas d’un second calcul').toBe(33);
    expect(st.target, 'la Difficulté DÉCLARÉE n’est pas ré-appliquée à une cible déjà montée').toBe(23);
    expect(st.mods).toHaveLength(1);
  });

  /**
   * LA RAISON du régime, mesurée : une ligne montée AU MOMENT DÛ ne suit pas le héros. L'entretien
   * quotidien monte le Test de Faim (`upkeep.ts`) puis continue de MUTER le héros (Blessures, États)
   * avant que `deferredUpkeepSteps` n'assemble l'étape. La déclarer en `ligne` la ferait recalculer sur
   * l'état d'APRÈS — un autre jet que celui qui était dû.
   */
  it('`montee` fige la ligne du MOMENT DU MONTAGE — `ligne`, elle, suit le héros', () => {
    const h = hero('H1');
    h.characteristics.endurance = 34;
    const dejaMontee = rollStep({ actor: h, test: { char: 'endurance' }, difficulty: 'intermediaire' });
    expect(dejaMontee.target, 'prémisse : la ligne est montée pendant que l’Endurance vaut 34').toBe(34);

    h.characteristics.endurance = 19; // l'entretien a frappé entre le montage et l'assemblage

    const figee = monoStep({ id: 'faim-H1', kind: 'faim', actor: h, label: fixtureText('Faim'), difficulty: 'intermediaire', stake: ENJEU, montee: dejaMontee })!;
    expect(figee.base, 'la ligne DUE est celle du moment où le Test était dû').toBe(34);
    expect(figee.target).toBe(34);

    const remontee = monoStep({ id: 'faim-H1', kind: 'faim', actor: h, label: fixtureText('Faim'), difficulty: 'intermediaire', stake: ENJEU, ligne: { test: { char: 'endurance' } } })!;
    expect(remontee.target, 'remontée à l’assemblage : un AUTRE jet — c’est ce que `montee` évite').toBe(19);
  });

  it('les deux régimes de ligne sont EXCLUSIFS (déclarer ET fournir ne compile pas)', () => {
    // @ts-expect-error — `ligne` et `montee` ne peuvent pas coexister : une seule source de ligne.
    const st = monoStep({ id: 'x', kind: 'faim', actor: hero('H1'), label: 'Faim', difficulty: 'complexe', stake: ENJEU, montee: { base: 1, target: 1 }, ligne: { test: { char: 'force-mentale' } } });
    expect(st).toBeDefined();
  });

  /**
   * LA BORNE du régime, mesurée (#1262 V2 lot 2) : une valeur ÉTRANGÈRE (seuil figé, formule hors
   * `testValue`) n'a JAMAIS besoin de `montee`. Sans Test nommé, le monteur n'a rien à décomposer
   * (`testValueSplit` : « rien à décomposer » dès qu'aucune compétence ni caractéristique n'est
   * déclarée) — il rend la valeur EN BASE, que l'acteur soit nommé ou non. Le lot 2 avait d'abord
   * ouvert la porte de forge pour ce cas (redressement de bateau sans barreur, `riverVoyageFlow`) :
   * cette équivalence est ce qui l'a refermée, et ce qui empêchera de la rouvrir pour le même motif.
   */
  it('valeur ÉTRANGÈRE : `ligne` et `montee` rendent la MÊME étape — la forge n’a rien à faire ici', () => {
    const h = hero('H1');
    h.characteristics['force-mentale'] = 71; // le héros a SES composantes : elles ne doivent PAS entrer
    const cumul = [{ label: '−5 cumulatif (Round 2)', value: -5, famille: 'jet' as const }];
    const commun = { id: 'right-1', kind: 'riverRighting', actor: h, label: fixtureText('Redressement'), difficulty: 'accessible' as const, stake: ENJEU };

    const parLigne = monoStep({ ...commun, ligne: { valeur: 42, valeurEtrangere: true, surLaCible: cumul } })!;
    const parMontee = monoStep({ ...commun, montee: rollStep({ difficulty: 'accessible', valeur: 42, valeurEtrangere: true, surLaCible: cumul }) })!;

    expect(parLigne.base, 'la valeur fournie EST la base (aucune décomposition possible)').toBe(42);
    expect(parLigne.target, '42 + 20 (Accessible) − 5 (cumulatif)').toBe(57);
    expect(parLigne.base).toBe(parMontee.base);
    expect(parLigne.target).toBe(parMontee.target);
    expect(parLigne.mods).toEqual(parMontee.mods);
    expect(parLigne.actorId, 'et le porteur nomme la fenêtre dans les DEUX régimes').toBe(parMontee.actorId);
  });
});

/**
 * LE NÉGATIF DE TYPE de l'union `DisplaySpec` (#1262 V2 lot 2) — la possession d'une étape d'affichage
 * est EXCLUSIVE : son concerné (`actorId`) OU le monde (`worldOwner`), jamais les deux, jamais aucun.
 * Aucun scanner ne tient cet invariant : c'est le compilateur, et cette sonde mesure qu'il le tient
 * VRAIMENT (mêmes API que la sonde de murage de `built-brand-lint`, programme TypeScript réel).
 */
const SONDE_DISPLAY = (decl: string) => `
type RecapLine = { text: string };
type Meta = Record<string, unknown>;
interface DisplayBase { id: string; kind: string; label: string; icon?: string; outcome?: RecapLine[]; meta?: Meta }
type DisplaySpec = DisplayBase & ({ actorId: string; worldOwner?: never } | { worldOwner: true; actorId?: never });
declare function displayStep(spec: DisplaySpec): void;
displayStep({ id: 'x', kind: 'k', label: 'L'${decl} });
`;

function diagnosticsDisplay(code: string): number[] {
  const fileName = 'sonde-display.ts';
  // `types: []` : la sonde ne dépend d'AUCUN `@types` du dépôt — elle mesure la FORME de l'union, rien d'autre.
  const options: ts.CompilerOptions = { strict: true, noEmit: true, target: ts.ScriptTarget.ES2020, types: [], skipLibCheck: true };
  const libPath = ts.getDefaultLibFilePath(options);
  const sf = ts.createSourceFile(fileName, code, ts.ScriptTarget.ES2020, true);
  const host: ts.CompilerHost = {
    getSourceFile: (n) => {
      if (n === fileName) return sf;
      const texte = ts.sys.readFile(n);
      return texte === undefined ? undefined : ts.createSourceFile(n, texte, ts.ScriptTarget.ES2020);
    },
    writeFile: () => {},
    getDefaultLibFileName: () => libPath,
    useCaseSensitiveFileNames: () => false,
    getCanonicalFileName: (n) => n.toLowerCase(),
    getCurrentDirectory: () => '',
    getNewLine: () => '\n',
    fileExists: (n) => n === fileName || ts.sys.fileExists(n),
    readFile: (n) => (n === fileName ? code : ts.sys.readFile(n)),
  };
  return ts.getPreEmitDiagnostics(ts.createProgram([fileName], options, host)).map((d) => d.code);
}

describe('#1262 V2 — la possession d’un AFFICHAGE est exclusive (négatif de type)', () => {
  it('un concerné SEUL compile ; le MONDE seul compile', () => {
    expect(diagnosticsDisplay(SONDE_DISPLAY(", actorId: 'h1'"))).toEqual([]);
    expect(diagnosticsDisplay(SONDE_DISPLAY(', worldOwner: true'))).toEqual([]);
  });

  it('les DEUX ensemble ne compilent pas', () => {
    expect(diagnosticsDisplay(SONDE_DISPLAY(", actorId: 'h1', worldOwner: true"))).not.toEqual([]);
  });

  it('AUCUNE des deux ne compile pas (une étape sans possession échoit à l’hôte seul)', () => {
    expect(diagnosticsDisplay(SONDE_DISPLAY(''))).not.toEqual([]);
  });

  it('`worldOwner: false` ne compile pas (le monde se DÉCLARE, il ne se désactive pas)', () => {
    expect(diagnosticsDisplay(SONDE_DISPLAY(', worldOwner: false'))).not.toEqual([]);
  });
});
