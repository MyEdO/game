/**
 * LA PORTE — famille d'ouvertures typées (#1262 V0-bis) : `openBand` (une situation, N porteurs, UNE
 * fenêtre) et `openChoice` (une décision, zéro dé). Ce que ces tests verrouillent : l'appelant DÉCLARE
 * et ne touche NI `interactive`, NI `groupOwner`, NI `actorId` — la porte les pose depuis le socle
 * (`surfaceRow`/`bandStep`), et la fenêtre atteint le siège qui tient le porteur.
 */
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { openBand, openChoice, choiceStep, bandStep, type BuiltCascadeStep, type BandOpenSpec, type BandPorteur } from './rollSeam';
import { modalOwnerOf } from './modalArbiter';
import { startCascade } from './cascade';
import { ownsLocally, seatOwns, WORLD_STEP_OWNER } from './netOwnership';
import { setCadence, resetCadence } from '../engine/cadence';
import type { CascadeStep } from './pendings';
import type { Combatant } from '../engine/types';

const hero = (id: string, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, label: `Héros ${id}`, kind: 'hero',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 },
    skills: [], conditions: [], talents: [], fortune: 2, resilience: 3,
    ...over,
  }) as unknown as Combatant;

/** HÔTE au siège 0 ; `H1` appartient au siège 1 (invité), `H2` au siège 0. */
function deuxSieges(party: Combatant[]): void {
  useGame.setState({ party, battle: null, pendingCascade: null, suspendedCascades: [] } as never);
  useGame.setState({ net: { ...useGame.getState().net, mode: 'host', mySeat: 0, ownership: { H1: 1, H2: 0 } } } as never);
}

const etapeCourante = (): CascadeStep => useGame.getState().pendingCascade!.participants[0];

beforeEach(() => {
  useGame.setState({ battle: null, party: [], pendingCascade: null, suspendedCascades: [] } as never);
  useGame.setState({ net: { ...useGame.getState().net, mode: 'local', mySeat: 0, ownership: {} } } as never);
});
afterEach(() => resetCadence());

describe('#1262 — openBand : la porte monte, surface et POSSÈDE', () => {
  it('porteurs de DEUX sièges → bande de GROUPE, et la rangée de l’invité est à JOUER (jamais roulée chez l’hôte)', () => {
    const h1 = hero('H1');
    const h2 = hero('H2');
    deuxSieges([h1, h2]);
    openBand(useGame.getState, useGame.setState, {
      id: 'peur', kind: 'encounterPsych', label: fixtureText('Peur'), title: 'Peur', purpose: 'test',
      difficulty: 'intermediaire',
      porteurs: [{ actor: h1, ligne: { test: { char: 'force-mentale' } } }, { actor: h2, ligne: { test: { char: 'force-mentale' } } }],
    });
    const step = etapeCourante();
    expect(step.groupOwner, 'deux porteurs ⇒ owner de GROUPE (chaque siège voit la fenêtre où se tient SA rangée)').toBe(true);
    expect(modalOwnerOf(useGame.getState())).toBe('*');
    const invite = step.participants!.find((p) => p.id === 'H1')!;
    expect(invite.interactive, 'le héros d’un AUTRE siège garde sa rangée : c’est SON joueur qui la roule').toBe(true);
    expect(invite.result).toBeNull();
    expect(invite.label, 'la rangée NOMME la Compétence dérivée du catalogue').toBe('Force Mentale');
    expect(invite.target, 'ligne montée par le monteur canonique (FM 40, Difficulté intermédiaire +0)').toBe(40);
  });

  it('porteur UNIQUE d’un autre siège → l’étape NOMME son porteur, et la fenêtre va à SON siège', () => {
    const h1 = hero('H1');
    deuxSieges([h1, hero('H2')]);
    openBand(useGame.getState, useGame.setState, {
      id: 'resistance', kind: 'upkeepTest', label: fixtureText('Résistance'), title: 'Entretien', purpose: 'upkeep',
      difficulty: 'intermediaire',
      porteurs: [{ actor: h1, ligne: { test: { char: 'endurance' } } }],
    });
    const step = etapeCourante();
    expect(step.groupOwner).toBeUndefined();
    expect(step.actorId, 'sans porteur nommé, l’arbitre rend `undefined` → fenêtre HÔTE SEUL').toBe('H1');
    expect(modalOwnerOf(useGame.getState())).toBe('H1');
    expect(ownsLocally(useGame.getState(), 'H1'), 'chez l’hôte, la fenêtre n’est pas à lui').toBe(false);
    expect(seatOwns(useGame.getState(), 1, 'H1')).toBe(true);
  });

  it('cadence AUTO → aucune rangée à jouer : chaque témoin naît ROULÉ (une bande sans résultat resterait suspendue)', () => {
    const h1 = hero('H1');
    const h2 = hero('H2');
    deuxSieges([h1, h2]);
    setCadence('rapide');
    openBand(useGame.getState, useGame.setState, {
      id: 'peur', kind: 'encounterPsych', label: fixtureText('Peur'), title: 'Peur', purpose: 'test',
      difficulty: 'intermediaire',
      porteurs: [{ actor: h1, ligne: { test: { char: 'force-mentale' } } }, { actor: h2, ligne: { test: { char: 'force-mentale' } } }],
    });
    const step = etapeCourante();
    expect(step.groupOwner, 'la possession ne dépend pas de la cadence : deux porteurs restent une bande de GROUPE').toBe(true);
    for (const p of step.participants!) {
      expect(p.interactive, `rangée ${p.id}`).toBe(false);
      expect(p.result, `rangée ${p.id} : un témoin sans résultat suspendrait sa bande`).toBeTruthy();
      expect(typeof p.result!.roll).toBe('number');
    }
  });

  it('rangées DÉJÀ montées (producteur qui possède son arithmétique) : la porte établit la surface', () => {
    const h1 = hero('H1');
    deuxSieges([h1, hero('H2', { aiControlled: true } as Partial<Combatant>)]);
    openBand(useGame.getState, useGame.setState, {
      id: 'surprise', kind: 'triggeredBatchTest', label: fixtureText('Surprise'), title: 'Surprise', purpose: 'combat',
      rows: [
        { id: 'H1', base: 40, target: 40, result: null, difficulty: 'intermediaire' },
        { id: 'H2', base: 30, target: 30, result: null, difficulty: 'intermediaire' },
      ],
    });
    const [r1, r2] = etapeCourante().participants!;
    expect(r1.interactive, 'porteur tenu par un siège : rangée à jouer').toBe(true);
    expect(r1.result).toBeNull();
    expect(r2.interactive, 'porteur conduit par l’IA : témoin').toBe(false);
    expect(r2.result).toBeTruthy();
  });

  it('rangée CLOSE (résultat déjà posé — témoin figé d’un opposé) : elle reste close, jamais re-surfacée', () => {
    const h1 = hero('H1');
    deuxSieges([h1, hero('H2')]);
    const fige = { roll: 12, target: 40, sl: 2, success: true };
    openBand(useGame.getState, useGame.setState, {
      id: 'oppose', kind: 'triggeredBatchTest', label: fixtureText('Opposé gelé'), title: 'Opposé', purpose: 'combat',
      rows: [
        { id: 'H1', base: 40, target: 40, result: fige, difficulty: 'intermediaire' },
        { id: 'H2', base: 30, target: 30, result: null, difficulty: 'intermediaire' },
      ],
    });
    const [r1, r2] = etapeCourante().participants!;
    expect(r1.interactive, 'la re-surfacer rendrait un dé DÉJÀ tombé influençable, et lèverait le masquage d’opposé').toBe(false);
    expect(r1.result, 'aucun second dé sur une rangée close').toEqual(fige);
    expect(r2.interactive, 'la rangée voisine, elle, reste à jouer').toBe(true);
  });

  it('rangée ORPHELINE (id sans combattant) : écartée et journalisée — jamais roulée en silence, jamais d’owner fantôme', () => {
    const h1 = hero('H1');
    deuxSieges([h1, hero('H2')]);
    expect(() => openBand(useGame.getState, useGame.setState, {
      id: 'orpheline', kind: 'k', label: fixtureText('L'), title: 'T', purpose: 'test',
      rows: [{ id: 'FANTOME', base: 30, target: 30, result: null, difficulty: 'intermediaire' }],
    })).toThrow(/sans combattant/);
    expect(useGame.getState().pendingCascade, 'plus aucune rangée ⇒ aucune bande').toBeNull();
  });

  it('zéro porteur → aucune fenêtre (rien n’est mis en jeu)', () => {
    deuxSieges([hero('H1')]);
    openBand(useGame.getState, useGame.setState, {
      id: 'vide', kind: 'k', label: fixtureText('L'), title: 'T', purpose: 'test', difficulty: 'intermediaire', porteurs: [],
    });
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('les DEUX entrées s’excluent au TYPE (porteurs XOR rangées montées)', () => {
    const commun = { id: 'x', kind: 'k', label: 'L', title: 'T', purpose: 'test' } as const;
    const rows = [{ id: 'H1', base: 30, target: 30, result: null }];
    // @ts-expect-error — les deux entrées à la fois
    const deux: BandOpenSpec = { ...commun, difficulty: 'intermediaire', porteurs: [], rows };
    // @ts-expect-error — aucune des deux
    const aucune: BandOpenSpec = { ...commun };
    // @ts-expect-error — objet ÉLARGI (hors littéral) portant les deux
    const elargi: BandOpenSpec = { ...commun, difficulty: 'intermediaire' as const, porteurs: [] as BandPorteur[], rows };
    expect([deux, aucune, elargi].length).toBe(3);
  });
});

describe('#1262 — openChoice : une décision PORTÉE, jamais partagée', () => {
  it('le choix porte son PORTEUR et AUCUN `groupOwner` — la fenêtre va au siège qui le tient', () => {
    deuxSieges([hero('H1'), hero('H2')]);
    openChoice(useGame.getState, useGame.setState, {
      id: 'deviation', kind: 'deviation', label: fixtureText('Dévier ?'), title: 'Coup Critique', purpose: 'combat',
      actorId: 'H1',
      options: [{ key: 'devier', label: fixtureText('Dévier (−1 PA)') }, { key: 'subir', label: fixtureText('Subir') }],
      defaultChoice: 'subir',
    });
    const step = etapeCourante();
    expect(step.actorId).toBe('H1');
    expect(step.groupOwner, 'un choix de GROUPE laisserait n’importe quel siège trancher pour autrui').toBeUndefined();
    expect(step.options).toHaveLength(2);
    expect(step.target, 'un choix ne lance aucun dé : ni cible, ni `test:{}` de convenance').toBeUndefined();
    expect(modalOwnerOf(useGame.getState())).toBe('H1');
    expect(seatOwns(useGame.getState(), 1, 'H1')).toBe(true);
  });

  it('PORTEUR oublié → signalé (DEV : throw ; en PROD la décision se dégrade au lieu de disparaître)', () => {
    deuxSieges([hero('H1')]);
    expect(() => openChoice(useGame.getState, useGame.setState, {
      id: 'orphelin', kind: 'pick', label: fixtureText('Choix'), title: 'T', purpose: 'test',
      actorId: '', options: [{ key: 'a', label: fixtureText('A') }],
    })).toThrow(/sans PORTEUR/);
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('`defaultChoice` hors des options → signalé (DEV : throw) — la clé fautive n’est jamais posée', () => {
    expect(() => choiceStep({
      id: 'c', kind: 'pick', label: fixtureText('Choix'), actorId: 'H1',
      options: [{ key: 'a', label: fixtureText('A') }], defaultChoice: 'z',
    })).toThrow(/defaultChoice/);
  });

  it('zéro option → aucune fenêtre : elle serait une impasse (aucune décision à préserver)', () => {
    expect(() => choiceStep({ id: 'c', kind: 'pick', label: fixtureText('Choix'), actorId: 'H1', options: [] })).toThrow(/sans option/);
  });

  /** La branche DE PROD (porteur manquant → fenêtre dégradée) est masquée par le throw de DEV : la
   *  forme qu'elle produit se monte donc directement, comme l'arbitre la recevra. */
  it('forme DÉGRADÉE (choix sans porteur) : la fenêtre EXISTE et échoit à l’hôte — l’invité voit celle d’autrui, jamais une fenêtre morte', () => {
    const sansPorteur: CascadeStep = { id: 'degrade', kind: 'pick', label: fixtureText('Choix'), options: [{ key: 'a', label: fixtureText('A') }, { key: 'b', label: fixtureText('B') }] };
    deuxSieges([hero('H1'), hero('H2')]);
    expect(() => startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'test', steps: [sansPorteur] })).not.toThrow();
    expect(useGame.getState().pendingCascade, 'une décision supprimée serait pire qu’une fenêtre à l’hôte').not.toBeNull();
    const owner = modalOwnerOf(useGame.getState()) ?? undefined;
    expect(owner, 'porteur résolu au site unique `pendings.porteurResolu` (#700) : le monde, dont le siège est l’hôte sans siège MJ').toBe(WORLD_STEP_OWNER);
    expect(ownsLocally(useGame.getState(), owner), 'chez l’hôte (siège 0), la fenêtre est jouable').toBe(true);
    useGame.setState({ net: { ...useGame.getState().net, mode: 'guest', mySeat: 1 } } as never);
    expect(ownsLocally(useGame.getState(), owner), 'chez l’invité, elle est visible en spectateur').toBe(false);
  });
});

describe('#1262 — « `result` ⇒ close » ne vaut QU’À L’OUVERTURE', () => {
  it('une fois la bande en vol, un dé tombé garde `interactive:true` (Chance/Pacte s’appliquent APRÈS le résultat)', () => {
    const h1 = hero('H1');
    const h2 = hero('H2');
    deuxSieges([h1, h2]);
    openBand(useGame.getState, useGame.setState, {
      id: 'peur', kind: 'encounterPsych', label: fixtureText('Peur'), title: 'Peur', purpose: 'test',
      difficulty: 'intermediaire',
      porteurs: [{ actor: h1, ligne: { test: { char: 'force-mentale' } } }, { actor: h2, ligne: { test: { char: 'force-mentale' } } }],
    });
    useGame.getState().cascadeBatchRoll('H1');
    const jouee = etapeCourante().participants!.find((p) => p.id === 'H1')!;
    expect(jouee.result, 'le dé est tombé').toBeTruthy();
    expect(jouee.interactive, 'la rangée reste influençable — c’est pourquoi la règle de la porte ne vaut qu’au montage').toBe(true);
  });
});

/** VRAI quand `T` porte une clé de PLUS que `CascadeStep` : la marque du constructeur (symbole non
 *  exporté). Un constructeur qui cesserait de marquer rendrait `false` — et `tsc` refuserait le
 *  `true` ci-dessous. */
type Marquee<T> = keyof T extends keyof CascadeStep ? false : true;

describe('#1262 — marque `BuiltCascadeStep` : les constructeurs de la porte la posent', () => {
  it('`bandStep` et `choiceStep` rendent une étape MARQUÉE (vérifié par le compilateur)', () => {
    const marqueBande: Marquee<NonNullable<ReturnType<typeof bandStep>>> = true;
    const marqueChoix: Marquee<NonNullable<ReturnType<typeof choiceStep>>> = true;
    expect([marqueBande, marqueChoix]).toEqual([true, true]);
  });

  it('la marque est REQUISE : un littéral nu n’est PAS une étape mintée (refusé par le compilateur)', () => {
    // @ts-expect-error — marque absente : monter une étape à la main ne compile plus
    const nu: BuiltCascadeStep = { id: 'e', kind: 'k', label: 'L', interactive: true };
    expect(nu.id).toBe('e');
  });

  it('la marque n’existe PAS à l’exécution : une étape sérialisée traverse le JSON sans rien perdre', () => {
    const step = choiceStep({ id: 'c', kind: 'pick', label: fixtureText('Choix'), actorId: 'H1', options: [{ key: 'a', label: fixtureText('A') }] })!;
    expect(JSON.parse(JSON.stringify(step))).toEqual(step);
    expect(Object.getOwnPropertySymbols(step)).toEqual([]);
  });
});
