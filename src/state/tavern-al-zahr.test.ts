/**
 * L'AL-ZAHR (NADJ 16 l.17) — jeu de MISE : la famille (5) du socle de séquence (mise, pot, abandon,
 * élimination) jouée de bout en bout par le store. Patron `tavern-middenball.test.ts` : la partie se
 * déroule via `drain()`, qui pose les dés des tours du héros (étape à TABLE, 2d10) et tranche ses
 * choix. Les tours des habitués se résolvent sans fenêtre, côté monde.
 *
 * Les dés du héros sont POSÉS (`cascadeTableSetForcedRoll`, le mode « dés fixés » du dépôt) : c'est
 * le seul moyen d'exercer une PLAGE précise (2 = éliminé, 20 = rafle) sans dépendre d'une graine.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { toBrass, fromBrass, formatMoney } from '../engine/money';
import { creditBourse, bourseOf } from './bourseFlow';
import { seedBattleRng } from './battleRng';
import { findTavernGameById } from '../engine/tavernGame';
import { resolveSequencePotTurn, sequenceBoardOf } from './sequenceCore';
import { tavernParams, potProchain } from './tavernFlow';
import type { Combatant } from '../engine/types';

const get = useGame.getState.bind(useGame);
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/** Une trace de ce qui a été surfacé : de quoi vérifier QUI a joué, et quand. */
interface Trace { id: string; kind: string; manche: number; round: number; actorId?: string }

/**
 * Le journal du store est BORNÉ (les vieilles lignes tombent) : une partie de trois manches en écrit
 * plus qu'il n'en garde. Cette fusion recolle les tranches vues à chaque tour de boucle — sans elle,
 * une assertion sur le début de partie mesurerait l'éviction, pas le jeu.
 */
function fusionne(vues: string[], courant: string[]): string[] {
  for (let k = Math.min(vues.length, courant.length); k >= 0; k--) {
    let recouvre = true;
    for (let i = 0; i < k; i++) if (vues[vues.length - k + i] !== courant[i]) { recouvre = false; break; }
    if (recouvre) return [...vues, ...courant.slice(k)];
  }
  return [...vues, ...courant];
}

/**
 * Joue la partie jusqu'au bout. `des` = les dés POSÉS pour les tours du héros, consommés dans
 * l'ordre (au-delà, le dé est tiré). `choix` = la clé tranchée sur chaque étape de choix.
 */
async function drain(opts: { des?: number[]; choix?: string } = {}): Promise<{ trace: Trace[]; journal: string[] }> {
  const trace: Trace[] = [];
  let journal: string[] = [];
  const des = [...(opts.des ?? [])];
  for (let i = 0; i < 400; i++) {
    journal = fusionne(journal, get().journal);
    const p = get().pendingCascade;
    if (p) {
      const cur = p.participants[p.cursor];
      if (cur) {
        const enCours = get().sequence?.payload as { manche?: number } | undefined;
        trace.push({
          id: cur.id, kind: cur.kind, manche: enCours?.manche ?? 0, round: get().sequence?.round ?? 0,
          ...(cur.actorId ? { actorId: cur.actorId } : {}),
        });
        if (cur.table && !cur.table.result) {
          const pose = des.shift();
          if (pose != null) get().cascadeTableSetForcedRoll(cur.id, pose);
          else get().cascadeTableRoll(cur.id);
        } else if (cur.options && cur.chosen == null) {
          get().cascadeChoose(cur.id, opts.choix ?? cur.defaultChoice ?? cur.options[0].key);
        } else if (cur.target != null && !cur.result) {
          get().cascadeRoll(cur.id);
        }
      }
      get().cascadeNext();
    }
    await tick();
    journal = fusionne(journal, get().journal);
    if (!get().pendingCascade && !get().sequence) break;
  }
  return { trace, journal: fusionne(journal, get().journal) };
}

function heros(): Combatant {
  return makePregens()[0] as Combatant;
}

/** Un héros à la bourse garnie, seul au groupe. */
function tableDeJeu(brass = 2000): Combatant {
  const a = heros();
  useGame.setState({ party: [a] });
  creditBourse(get, useGame.setState, a.id, { gold: 0, silver: 0, brass });
  return get().party[0];
}

/**
 * Joue une partie complète et RECOMPTE le solde du héros depuis ce que le journal RACONTE (mise de
 * chaque manche, pot empoché, mise reprise, remise payée) : le solde annoncé et la bourse doivent
 * tomber sur ce compte-là. Chaque montant est un multiple de la mise — on le retrouve en cherchant
 * le plus grand multiple dont le libellé figure dans la ligne (« 1 CO 5/– » plutôt que « 1 CO »).
 */
async function partieComptee(des: number[], opts: { ante?: number; joueurs?: number } = {}) {
  const ante = opts.ante ?? 100;
  const a = tableDeJeu();
  const avant = toBrass(bourseOf(get().party[0]));
  get().playTavernGame({
    gameId: 'al-zahr', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' },
    stakeBrass: ante, tablePlayers: opts.joueurs ?? 3,
  });
  const { journal, trace } = await drain({ des });
  const sousDe = (ligne: string): number => {
    for (let k = 40; k >= 1; k--) if (ligne.includes(formatMoney(fromBrass(k * ante)))) return k * ante;
    return 0;
  };
  let attendu = 0;
  for (const ligne of journal) {
    if (/^Manche \d+ : chacun mise/.test(ligne)) attendu -= ante; // le héros est solvable : il mise
    else if (ligne.startsWith(`${a.label} remporte la manche et empoche `)) attendu += sousDe(ligne);
    else if (ligne.startsWith(`${a.label} reprend `)) attendu += sousDe(ligne);
    else if (ligne.startsWith(`${a.label} remet `)) attendu -= sousDe(ligne);
  }
  return {
    a, attendu, journal, trace, avant,
    apres: toBrass(bourseOf(get().party[0])),
    res: get().tavernGames!.result!,
  };
}

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [], tavernGames: null, pendingCascade: null, sequence: null });
  seedBattleRng(7);
});

describe('Al-zahr — les effets de pot (famille 5, socle)', () => {
  const params = tavernParams(findTavernGameById('al-zahr')!);
  const tour = (roll: number, cible: number, pot: number) => resolveSequencePotTurn(params, { roll, target: cible, ante: 100, pot });

  it('2 : le joueur QUITTE la manche', () => {
    expect(tour(2, 10, 300).outcome).toEqual({ out: true });
  });

  it('3 à 6 : remettre une mise, ou abandonner — le montant dû est PARAMÉTRÉ par la plage', () => {
    expect(tour(4, 10, 300).outcome).toEqual({ choose: true, owes: 100 });
  });

  it('7 à 15 : la cible atteinte remporte la manche, sinon le total devient la cible du suivant', () => {
    expect(tour(10, 10, 300).outcome).toEqual({ wins: true });
    expect(tour(12, 10, 300).outcome).toEqual({ target: 12 });
  });

  it('16 à 19 : une mise reprise dans le pot — jamais plus que ce qu’il contient', () => {
    expect(tour(17, 10, 300).outcome).toEqual({ takes: 100 });
    expect(tour(17, 10, 40).outcome).toEqual({ takes: 40 });
  });

  it('20 : le pot est raflé', () => {
    expect(tour(20, 10, 300).outcome).toEqual({ wins: true });
  });

  it('l’ORDRE du tour saute les joueurs sortis — un éliminé ne relance jamais', () => {
    const seats = [
      { id: 'a', label: 'A', hero: true },
      { id: 'b', label: 'B', hero: false },
      { id: 'c', label: 'C', hero: false },
    ];
    expect(potProchain(seats, 0, [])).toBe(1);
    expect(potProchain(seats, 0, ['b'])).toBe(2);
    expect(potProchain(seats, 2, ['a'])).toBe(1);
    expect(potProchain(seats, 1, ['c', 'a']), 'plus personne d’autre en jeu').toBe(1);
  });

  it('la donnée porte la règle : dés, plage de cible et manches par joueur', () => {
    const jeu = findTavernGameById('al-zahr')!;
    expect(jeu.pot).toBeTruthy();
    expect(jeu.pot!.dice).toEqual({ count: 2, faces: 10 });
    expect(jeu.pot!.targetRange).toEqual({ min: 7, max: 15 });
    expect(jeu.pot!.rows.map((r) => r.potEffectId)).toEqual([
      'quitte-la-manche', 'remise-ou-abandon', 'cible-ou-passe', 'reprend-mise', 'rafle-le-pot',
    ]);
    // La règle est recopiée SANS coupe : la dernière phrase du RAW (l.17) est là.
    expect(jeu.desc.startsWith('chaque joueur ajoute une mise égale au pot.')).toBe(true);
    expect(jeu.desc.endsWith('la possibilité de lancer les dés en premier.')).toBe(true);
  });
});

describe('Al-zahr — la partie au store', () => {
  it('partie entière : la bourse du héros bouge EXACTEMENT du solde annoncé', async () => {
    const a = tableDeJeu();
    const avant = toBrass(bourseOf(get().party[0]));
    get().playTavernGame({ gameId: 'al-zahr', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' }, stakeBrass: 100, tablePlayers: 3 });
    expect(get().sequence?.def).toBe('tavern');
    await drain();
    const res = get().tavernGames!.result!;
    expect(res.gameLabel).toBe('L\'Al-zahr');
    expect(res.stakeBrass).toBe(100);
    expect(toBrass(bourseOf(get().party[0]))).toBe(avant + res.netBrass);
    expect(get().sequence).toBeNull();
  });

  it('la MISE sort de la bourse : chacun l’ajoute au pot à l’ouverture de la manche', () => {
    const a = tableDeJeu();
    get().playTavernGame({ gameId: 'al-zahr', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' }, stakeBrass: 100, tablePlayers: 3 });
    const p = get().sequence!.payload as { pot?: number; net?: Record<string, number>; seats?: unknown[] };
    expect(p.seats).toHaveLength(3);
    expect(p.pot, '3 joueurs × 100 sc').toBe(300);
    expect(p.net?.[a.id], 'le héros a engagé sa mise').toBe(-100);
  });

  it('mise plafonnée à la bourse du challenger', () => {
    const a = tableDeJeu(50);
    get().playTavernGame({ gameId: 'al-zahr', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' }, stakeBrass: 100000 });
    expect((get().sequence!.payload as { stakeBrass: number }).stakeBrass).toBe(50);
  });

  it('sans le sou : aucune partie ne s’ouvre (garde explicite, la source est muette)', () => {
    const a = heros();
    useGame.setState({ party: [a] });
    get().playTavernGame({ gameId: 'al-zahr', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' }, stakeBrass: 100 });
    expect(get().sequence).toBeNull();
    expect(get().pendingCascade).toBeNull();
    expect(get().journal.some((l) => l.includes('aucune partie'))).toBe(true);
  });

  it('ÉLIMINÉ (2) : le joueur ne relance plus de la manche — les autres, si', async () => {
    const a = tableDeJeu();
    get().playTavernGame({ gameId: 'al-zahr', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' }, stakeBrass: 100, tablePlayers: 3 });
    // Cible annoncée par le héros (il ouvre la manche), puis son 1ᵉʳ lancer POSÉ à 2.
    const { trace, journal } = await drain({ des: [2] });
    const sien = trace.filter((s) => s.kind === 'tavern-pot-turn' && s.manche === 1 && s.actorId === a.id);
    expect(sien, 'un seul lancer du héros dans la manche : le 2 l’en a sorti').toHaveLength(1);
    const quitte = journal.findIndex((l) => l.includes(`${a.label} quitte la manche`));
    expect(quitte, 'le journal dit la sortie').toBeGreaterThanOrEqual(0);
    // La manche CONTINUE sans lui : les autres joueurs enchaînent leurs tours après sa sortie, et
    // jusqu'à la manche SUIVANTE (où il remise), plus une seule ligne ne le nomme.
    const manche2 = journal.findIndex((l) => l.startsWith('Manche 2'));
    const apres = journal.slice(quitte + 1, manche2 > quitte ? manche2 : undefined);
    expect(apres.some((l) => l.includes('habitué') || l.includes('adversaire de la salle'))).toBe(true);
    expect(apres.some((l) => l.startsWith(a.label)), 'aucun tour du sorti dans la manche').toBe(false);
  });

  it('le POT va au vainqueur : un 20 rafle les mises de la table', async () => {
    const a = tableDeJeu();
    get().playTavernGame({ gameId: 'al-zahr', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' }, stakeBrass: 100, tablePlayers: 3 });
    const { journal } = await drain({ des: [20] });
    const potEntier = formatMoney(fromBrass(300)); // 3 mises de 100 sous
    expect(journal.some((l) => l === `${a.label} remporte la manche et empoche ${potEntier}.`)).toBe(true);
  });

  it('GAGNANT : le solde de la bourse est EXACTEMENT la somme des mouvements racontés', async () => {
    const { attendu, res, avant, apres } = await partieComptee([20]);
    expect(attendu, 'ce run se solde par un gain (sinon le crédit n’est pas exercé)').toBeGreaterThan(0);
    expect(res.netBrass, 'le solde annoncé suit les mouvements du journal').toBe(attendu);
    expect(apres, 'et la bourse a réellement bougé d’autant').toBe(avant + attendu);
  });

  it('PERDANT : la mise perdue sort réellement de la bourse', async () => {
    const { attendu, res, avant, apres } = await partieComptee([2, 2, 2]);
    expect(attendu, 'ce run se solde par une perte (sinon le débit n’est pas exercé)').toBeLessThan(0);
    expect(res.netBrass).toBe(attendu);
    expect(apres).toBe(avant + attendu);
  });

  it('D1 — manche impossible à ouvrir : AUCUNE mise n’est prise (quorum avant débit)', async () => {
    const [a, b] = makePregens() as Combatant[];
    useGame.setState({ party: [a, b] });
    creditBourse(get, useGame.setState, a.id, { gold: 0, silver: 0, brass: 5000 });
    const avant = toBrass(bourseOf(get().party[0]));
    // Le vis-à-vis est un COMPAGNON sans le sou : la table ne peut pas s'ouvrir à deux.
    get().playTavernGame({ gameId: 'al-zahr', challengerId: a.id, opponent: { kind: 'hero', id: b.id }, stakeBrass: 100, tablePlayers: 2 });
    const { journal } = await drain();
    expect(toBrass(bourseOf(get().party[0])), 'la mise du solvable n’est pas partie en fumée').toBe(avant);
    expect(get().tavernGames!.result!.netBrass).toBe(0);
    expect(journal.some((l) => l.includes(`${b.label} n’a pas de quoi miser`)), 'le journal nomme le fauché').toBe(true);
    expect(journal.some((l) => l.includes('la partie s’arrête'))).toBe(true);
  });

  it('D2 — 6 joueurs, 10 graines : aucune borne, aucun pot évaporé, solde exact', async () => {
    for (let graine = 1; graine <= 10; graine++) {
      useGame.setState({ battle: null, party: [], journal: [], tavernGames: null, pendingCascade: null, sequence: null });
      seedBattleRng(graine);
      const { attendu, res, avant, apres, journal } = await partieComptee([], { joueurs: 6 });
      expect(journal.some((l) => l.includes('sur sa borne')), `graine ${graine} : partie coupée par l’anti-boucle`).toBe(false);
      expect(journal.some((l) => l.includes('Partie interrompue')), `graine ${graine} : pot resté sur la table`).toBe(false);
      expect(res.netBrass, `graine ${graine} : solde ≠ mouvements racontés`).toBe(attendu);
      expect(apres, `graine ${graine} : bourse ≠ solde`).toBe(avant + attendu);
    }
  });

  it('D2 — partie INTERROMPUE : le pot en vol revient à ceux qui l’ont mis, et l’issue suit la bourse', async () => {
    const a = tableDeJeu();
    // Borne ramenée à un seul tour : la partie est coupée le pot encore plein (artefact d'anti-boucle).
    get().playTavernGame({ gameId: 'al-zahr', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' }, stakeBrass: 100, tablePlayers: 3 });
    const avant = toBrass(bourseOf(get().party[0]));
    useGame.setState({ sequence: { ...get().sequence!, params: { ...get().sequence!.params, maxRounds: 2 } } });
    const { journal } = await drain();
    const res = get().tavernGames!.result!;
    expect(journal.some((l) => l.includes('Partie interrompue')), 'la reprise est dite').toBe(true);
    expect(res.netBrass, 'sa mise lui est revenue').toBe(0);
    expect(toBrass(bourseOf(get().party[0]))).toBe(avant);
  });

  it('l’ENCART de résultat dit l’ISSUE au moment du jet, jamais la seule fourchette', () => {
    const a = tableDeJeu();
    get().playTavernGame({ gameId: 'al-zahr', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' }, stakeBrass: 100, tablePlayers: 3 });
    // 1) le héros ouvre la manche : il annonce la cible (défaut de l'étape de choix = 7).
    const cibleStep = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    expect(cibleStep.kind).toBe('tavern-pot-target');
    get().cascadeChoose(cibleStep.id, '7');
    get().cascadeNext();
    // 2) son lancer POSÉ à 7 atteint la cible : l'encart le dit AVANT le commit.
    const tour = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    expect(tour.kind).toBe('tavern-pot-turn');
    get().cascadeTableSetForcedRoll(tour.id, 7);
    const pose = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    expect(pose.table!.result!.lines[0], 'la rafle est annoncée à l’écran du jet').toBe('la manche est remportée, le pot est raflé');
    // 3) même vérité que le journal : la ligne de récit dit la même issue.
    get().cascadeNext();
    expect(get().journal.concat(get().pendingCascade?.participants.flatMap((s) => s.outcome?.map((o) => o.text) ?? []) ?? [])
      .some((l) => typeof l === 'string' && l.includes('la manche est remportée, le pot est raflé'))).toBe(true);
  });

  it('un lancer qui PASSE la cible n’annonce pas une victoire (même plage, autre issue)', () => {
    const a = tableDeJeu();
    get().playTavernGame({ gameId: 'al-zahr', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' }, stakeBrass: 100, tablePlayers: 3 });
    const cibleStep = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    get().cascadeChoose(cibleStep.id, '7');
    get().cascadeNext();
    const tour = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    get().cascadeTableSetForcedRoll(tour.id, 12); // même fourchette 7-15, cible NON atteinte
    const pose = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    expect(pose.table!.result!.lines[0]).toBe('raté : 12 devient le nombre cible du suivant');
  });

  it('le tableau de marque montre le POT en jeu', () => {
    const a = tableDeJeu();
    get().playTavernGame({ gameId: 'al-zahr', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' }, stakeBrass: 100, tablePlayers: 3 });
    const board = sequenceBoardOf(get);
    expect(board?.pot).toBe(`Pot : ${formatMoney(fromBrass(300))}`);
    expect(board?.camps).toHaveLength(3);
  });
});
