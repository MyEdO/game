/**
 * MIDDENBALL (NADJ 16 l.117-119) — le jeu d'ÉQUIPE par le socle de séquence (#1279 S1bis). Règle
 * verbatim : « chaque tour, tous les joueurs effectuent un Test de **Corps à corps (Bagarre)
 * Accessible (+20)** ou d'**Athlétisme Intermédiaire (+0)**. On additionne le nombre de DR obtenus
 * pour chaque équipe. L'équipe qui obtient le total le plus élevé gagne +1 Avantage pour le tour
 * suivant (en utilisant les règles habituelles relatives à l'Avantage), et marquera un but si son
 * total est de +25 ou plus. Une partie dure deux mi-temps de trois tours chacune […]. »
 *
 * COMPOSITION DES CAMPS : chaque camp est complété à 11 par des figurants PNJ à valeur simple ; les
 * héros portent leurs jets, les figurants roulent en témoins auto. La décision et sa citation vivent
 * au code qu'elle règle (`state/tavernFlow.ts`, section « JEUX D'ÉQUIPE »). L'effectif (11) est RAW et
 * vit en donnée ; seule la VALEUR des figurants est maison, et elle est éditable.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { seedBattleRng } from './battleRng';
import { findTavernGameById } from '../engine/tavernGame';
import { tavernGameValue } from './tavernFlow';
import { pnjAuProfil } from './sceneNpc';
import type { BatchParticipant, CascadeStep } from './pendings';
import type { Combatant } from '../engine/types';

const get = useGame.getState.bind(useGame);
const MIDDENBALL = findTavernGameById('middenball')!;

function equipe(n: number): Combatant[] {
  const party = makePregens().slice(0, n) as Combatant[];
  party.forEach((h) => { h.advantage = 0; });
  useGame.setState({ battle: null, party, journal: [], tavernGames: null, pendingCascade: null, sequence: null });
  return party;
}

const etape = (): CascadeStep => get().pendingCascade!.participants[get().pendingCascade!.cursor];
const bande = (): CascadeStep | undefined => get().pendingCascade?.participants.find((s) => s.kind === 'tavern-round');

/** Tranche tous les CHOIX d'option ouverts (la bande du tour est appendée par le dernier). */
function choisir(option: number): void {
  for (let i = 0; i < 8; i++) {
    const cur = get().pendingCascade?.participants[get().pendingCascade!.cursor];
    if (!cur || cur.kind !== 'tavern-option') return;
    get().cascadeChoose(cur.id, String(option));
    get().cascadeNext();
  }
}

/** Pose le DR de CHAQUE rangée de la bande du tour, puis la clôt. */
function poseTour(drHeros: number, drFigurantMien: number, drFigurantSien: number): void {
  const pc = get().pendingCascade!;
  const idx = pc.participants.findIndex((s) => s.kind === 'tavern-round');
  const band = pc.participants[idx];
  const rows = band.participants!.map((r: BatchParticipant) => {
    const sien = r.id.startsWith('figurant-o-');
    const figurant = r.id.startsWith('figurant-');
    const sl = sien ? drFigurantSien : figurant ? drFigurantMien : drHeros;
    return { ...r, result: { roll: 11, target: r.target!, sl, success: true } };
  });
  const participants = [...pc.participants];
  participants[idx] = { ...band, participants: rows };
  useGame.setState({ pendingCascade: { ...pc, participants, cursor: idx } });
  get().cascadeNext();
}

beforeEach(() => {
  seedBattleRng(7);
  useGame.setState({ battle: null, pendingCascade: null, sequence: null } as never);
});

describe('Middenball — les camps, le tour, la somme (NADJ 16 l.117-119)', () => {
  it('l’entrée de données porte la règle : 11 par camp, deux options de Test, somme, but à 25, 2×3 tours', () => {
    expect(MIDDENBALL.team?.size, '« deux équipes de 11 joueurs » (l.119)').toBe(11);
    expect(MIDDENBALL.options?.map((o) => [o.skill, o.difficulty])).toEqual([
      [{ id: 'corps-a-corps', spec: 'bagarre' }, 'accessible'], // « Corps à corps (Bagarre) Accessible (+20) »
      [{ id: 'athletisme' }, 'intermediaire'], // « ou d'Athlétisme Intermédiaire (+0) »
    ]);
    expect(MIDDENBALL.campScore, '« On additionne le nombre de DR obtenus pour chaque équipe »').toBe('sum');
    expect(MIDDENBALL.scoreThreshold, '« marquera un but si son total est de +25 ou plus »').toBe(25);
    expect(MIDDENBALL.phases, '« deux mi-temps de trois tours chacune »').toEqual({ count: 2, rounds: 3 });
  });

  it('le tour s’ouvre sur le CHOIX de chaque héros, PUIS la bande — jamais un Test tranché à sa place', () => {
    const party = equipe(2);
    get().playTavernGame({ gameId: 'middenball', challengerId: party[0].id, opponent: { kind: 'profil', id: 'humain' }, allyProfil: 'humain' });

    const pc = get().pendingCascade!;
    expect(pc.participants.map((s) => s.kind)).toEqual(['tavern-option', 'tavern-option']);
    expect(pc.participants.map((s) => s.actorId)).toEqual(party.map((h) => h.id));
    expect(pc.participants[0].options!.map((o) => o.label)).toEqual(['Corps à corps (Bagarre)', 'Athlétisme']);
    expect(bande(), 'aucune rangée montée avant que les options ne soient dites').toBeUndefined();
  });

  it('la bande du tour porte 11 rangées par camp : les héros à jouer, les figurants en TÉMOINS déjà roulés', () => {
    const party = equipe(2);
    get().playTavernGame({ gameId: 'middenball', challengerId: party[0].id, opponent: { kind: 'profil', id: 'humain' }, allyProfil: 'humain' });
    choisir(0);

    const band = bande()!;
    const rows = band.participants!;
    expect(rows).toHaveLength(22); // 11 + 11 (l.119)
    const mien = rows.filter((r) => !r.id.startsWith('figurant-o-'));
    expect(mien, 'le camp du groupe est complété à 11').toHaveLength(11);
    for (const h of party) {
      const row = rows.find((r) => r.id === h.id)!;
      expect(row.interactive, 'les héros portent leurs jets').toBe(true);
      expect(row.result).toBeNull();
    }
    const figurants = rows.filter((r) => r.id.startsWith('figurant-'));
    expect(figurants).toHaveLength(20);
    for (const f of figurants) {
      expect(f.interactive, 'les figurants roulent en témoins auto').toBe(false);
      expect(f.result, 'et leur jet est DÉJÀ tombé').toBeTruthy();
      expect(f.base, 'leur valeur est celle de la fiche de l’habitué').toBe(tavernGameValue(pnjAuProfil('humain', 'h')!, findTavernGameById('middenball')!));
    }
    expect(get().sequence?.payload).toMatchObject({ teams: { player: expect.any(Array), opponent: expect.any(Array) } });
  });

  it('l’OPTION choisie décide la Compétence ET la Difficulté de la rangée (Bagarre +20 vs Athlétisme +0)', () => {
    const party = equipe(1);
    get().playTavernGame({ gameId: 'middenball', challengerId: party[0].id, opponent: { kind: 'profil', id: 'humain' }, allyProfil: 'humain' });
    choisir(1); // Athlétisme Intermédiaire (+0)
    const athle = bande()!.participants!.find((r) => r.id === party[0].id)!;
    expect(athle.skillId).toBe('athletisme');
    expect(athle.difficulty).toBe('intermediaire');
    expect(athle.target).toBe(athle.base);

    useGame.setState({ pendingCascade: null, sequence: null } as never);
    const party2 = equipe(1);
    get().playTavernGame({ gameId: 'middenball', challengerId: party2[0].id, opponent: { kind: 'profil', id: 'humain' }, allyProfil: 'humain' });
    choisir(0); // Corps à corps (Bagarre) Accessible (+20)
    const bagarre = bande()!.participants!.find((r) => r.id === party2[0].id)!;
    expect(bagarre.skillId).toBe('corps-a-corps');
    expect(bagarre.difficulty).toBe('accessible');
    expect(bagarre.target, 'la Difficulté (+20) entre dans la cible').toBe(bagarre.base! + 20);
  });

  it('SOMME par équipe, BUT au-delà de 25, +1 Avantage au camp qui l’emporte (l.121)', () => {
    const party = equipe(2);
    get().playTavernGame({ gameId: 'middenball', challengerId: party[0].id, opponent: { kind: 'profil', id: 'humain' }, allyProfil: 'humain' });
    choisir(0);
    // 11 rangées à 3 DR = 33 (≥ 25) contre 11 rangées à 1 DR = 11.
    poseTour(3, 3, 1);

    const p = get().sequence!.payload as { last: { playerSL: number; opponentSL: number } };
    expect(p.last).toEqual({ playerSL: 33, opponentSL: 11 });
    expect(get().sequence!.cum, 'total ≥ 25 pour le camp le plus haut : un but').toEqual({ player: 1, opponent: 0 });
    for (const h of party) expect(get().party.find((x) => x.id === h.id)!.advantage, '+1 Avantage pour le tour suivant').toBe(1);
    expect(get().journal.some((l) => l.includes('BUT'))).toBe(true);
  });

  /**
   * L'AVANTAGE AGIT (l.121 : « en utilisant les règles habituelles relatives à l'Avantage » ; LDB 14
   * l.30 : « +10 à un Test de Combat ou de Psychologie approprié »). Il ne suffit pas de le COMPTER
   * sur la fiche : il doit entrer dans la CIBLE du tour suivant — et seulement pour un Test de Combat.
   */
  it('l’Avantage gagné entre dans la CIBLE du tour suivant — en Bagarre (Test de Combat) seulement', () => {
    const party = equipe(2);
    get().playTavernGame({ gameId: 'middenball', challengerId: party[0].id, opponent: { kind: 'profil', id: 'humain' }, allyProfil: 'humain' });
    choisir(0); // Bagarre
    const cibleT1 = bande()!.participants!.find((r) => r.id === party[0].id)!.target!;
    poseTour(3, 3, 1); // votre camp l'emporte : +1 Avantage

    expect(get().party.find((x) => x.id === party[0].id)!.advantage).toBe(1);
    choisir(0); // Bagarre au tour 2 : l'Avantage s'applique
    const rowT2 = bande()!.participants!.find((r) => r.id === party[0].id)!;
    expect(rowT2.target, 'cible du tour 2 = cible du tour 1 + 10').toBe(cibleT1 + 10);
    expect(rowT2.mods?.some((m) => m.label === 'Avantage' && m.value === 10), 'la ligne est NOMMÉE').toBe(true);
  });

  it('l’Avantage n’entre PAS dans la cible d’un Athlétisme (ce n’est pas un Test de Combat)', () => {
    const party = equipe(2);
    get().playTavernGame({ gameId: 'middenball', challengerId: party[0].id, opponent: { kind: 'profil', id: 'humain' }, allyProfil: 'humain' });
    choisir(1); // Athlétisme
    const cibleT1 = bande()!.participants!.find((r) => r.id === party[0].id)!.target!;
    poseTour(3, 3, 1);

    expect(get().party.find((x) => x.id === party[0].id)!.advantage).toBe(1);
    choisir(1); // Athlétisme au tour 2
    const rowT2 = bande()!.participants!.find((r) => r.id === party[0].id)!;
    expect(rowT2.target, 'Test « non approprié » : la cible ne bouge pas').toBe(cibleT1);
    expect(rowT2.mods?.some((m) => m.label === 'Avantage')).toBeFalsy();
  });

  /** SYMÉTRIE (l.121) : l'Avantage est gagné par une ÉQUIPE. Les figurants n'ont pas de fiche — leur
   *  camp le porte, sans quoi une équipe sans héros ne pourrait jamais rien gagner. */
  it('l’Avantage d’un camp s’applique AUSSI à ses figurants — les deux camps, symétriquement', () => {
    const party = equipe(1);
    get().playTavernGame({ gameId: 'middenball', challengerId: party[0].id, opponent: { kind: 'profil', id: 'humain' }, allyProfil: 'humain' });
    choisir(0);
    const figMien = () => bande()!.participants!.find((r) => r.id.startsWith('figurant-p-'))!;
    const figSien = () => bande()!.participants!.find((r) => r.id.startsWith('figurant-o-'))!;
    const cibleMienT1 = figMien().target!;
    const cibleSienT1 = figSien().target!;
    poseTour(1, 1, 3); // le camp d'EN FACE l'emporte (11×3 contre 11×1)

    choisir(0);
    expect(figSien().target, 'le camp adverse a gagné : ses figurants prennent +10').toBe(cibleSienT1 + 10);
    expect(figMien().target, 'le vôtre non').toBe(cibleMienT1);
    poseTour(3, 3, 1); // votre camp l'emporte à son tour

    choisir(0);
    expect(figMien().target, 'vos figurants prennent +10 à leur tour').toBe(cibleMienT1 + 10);
    expect(figSien().target, 'et le camp adverse retombe (l’Avantage vaut pour LE tour suivant)').toBe(cibleSienT1);
  });

  it('vos coéquipiers figurants jouent LEUR fiche (profil standard, LDB 77), jamais celle de l’adversaire', () => {
    const party = equipe(1);
    get().playTavernGame({
      gameId: 'middenball', challengerId: party[0].id,
      opponent: { kind: 'profil', id: 'humain' }, allyProfil: 'nain',
    });
    choisir(0);
    const rows = bande()!.participants!;
    const jeu = findTavernGameById('middenball')!;
    expect(rows.find((r) => r.id.startsWith('figurant-p-'))!.base, 'vos coéquipiers').toBe(tavernGameValue(pnjAuProfil('nain', 'n')!, jeu));
    expect(rows.find((r) => r.id.startsWith('figurant-o-'))!.base, 'le camp d’en face').toBe(tavernGameValue(pnjAuProfil('humain', 'h')!, jeu));
    expect(tavernGameValue(pnjAuProfil('nain', 'n')!, jeu)).not.toBe(tavernGameValue(pnjAuProfil('humain', 'h')!, jeu));
  });

  /** LA CONJONCTION du but (l.121) : « L'équipe qui obtient le total le plus élevé […] marquera un but
   *  si son total est de +25 ou plus » — les DEUX conditions, sur le MÊME camp. Deux équipes au-dessus
   *  de 25 : seule celle qui l'emporte marque. */
  it('les DEUX camps au-dessus de 25 : SEUL le vainqueur marque', () => {
    const party = equipe(1);
    get().playTavernGame({ gameId: 'middenball', challengerId: party[0].id, opponent: { kind: 'profil', id: 'humain' }, allyProfil: 'humain' });
    choisir(0);
    poseTour(4, 4, 3); // 11×4 = 44 contre 11×3 = 33 : les deux ≥ 25

    const p = get().sequence!.payload as { last: { playerSL: number; opponentSL: number } };
    expect(p.last).toEqual({ playerSL: 44, opponentSL: 33 });
    expect(get().sequence!.cum, 'un seul but, pour le camp le plus haut').toEqual({ player: 1, opponent: 0 });
  });

  it('total sous le seuil : l’équipe la plus haute gagne l’Avantage, mais AUCUN but', () => {
    const party = equipe(2);
    get().playTavernGame({ gameId: 'middenball', challengerId: party[0].id, opponent: { kind: 'profil', id: 'humain' }, allyProfil: 'humain' });
    choisir(0);
    poseTour(2, 2, 1); // 22 contre 11 : le plus haut, mais < 25

    expect(get().sequence!.cum).toEqual({ player: 0, opponent: 0 });
    expect(get().party.find((x) => x.id === party[0].id)!.advantage).toBe(1);
  });

  it('la partie dure SIX tours (deux mi-temps de trois) et se dénoue sur le compte des buts', () => {
    const party = equipe(2);
    get().playTavernGame({ gameId: 'middenball', challengerId: party[0].id, opponent: { kind: 'profil', id: 'humain' }, allyProfil: 'humain' });
    const tours: number[] = [];
    for (let i = 0; i < 8 && get().sequence; i++) {
      tours.push(get().sequence!.round);
      choisir(0);
      poseTour(3, 3, 1);
    }
    expect(tours).toEqual([1, 2, 3, 4, 5, 6]);
    expect(get().sequence, 'les deux mi-temps consommées, la séquence est retirée').toBeNull();
    const res = get().tavernGames!.result!;
    expect(res.winner).toBe('player');
    expect(res.playerSL, 'le score final EST le compte de buts').toBe(6);
    expect(res.opponentSL).toBe(0);
    expect(res.rounds).toBe(6);
  });

  it('GRAINE RÉELLE (aucun DR posé) : une partie entière se déroule, six tours, un vainqueur nommé', () => {
    seedBattleRng(11);
    const party = equipe(3);
    get().playTavernGame({ gameId: 'middenball', challengerId: party[0].id, opponent: { kind: 'profil', id: 'humain' }, allyProfil: 'humain' });
    for (let i = 0; i < 40 && get().pendingCascade; i++) {
      const cur = etape();
      if (cur.kind === 'tavern-option') get().cascadeChoose(cur.id, '0');
      else if (cur.participants) {
        for (const row of cur.participants) if (row.interactive !== false && !row.result) get().cascadeBatchRoll(row.id);
      }
      get().cascadeNext();
    }
    expect(get().sequence).toBeNull();
    const res = get().tavernGames!.result!;
    expect(res.rounds).toBe(6);
    expect(['player', 'opponent', 'tie']).toContain(res.winner);
    expect(res.playerSL + res.opponentSL, 'des buts ont pu tomber, jamais des DR bruts').toBeLessThanOrEqual(6);
  });
});
