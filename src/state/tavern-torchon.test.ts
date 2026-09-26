/**
 * LE TORCHON TREMPÉ (NADJ 16 l.109-111) — un tour = un lanceur, la cible tirée au sort parmi les 11
 * danseurs, le barème de points en TABLE de donnée, la pinte de bière sur un raté, et le balayage
 * final « trop sobre ». Règle verbatim : « lorsque vous balancez le torchon, faites un Test opposé
 * Projectiles (Lancer) / Esquive d'un joueur choisi aléatoirement parmi les 11 danseurs. En cas de
 * succès, vous le touchez à la jambe pour 1 point. Avec au moins 3 DR […] 2 points. Si vous faites au
 * moins 6 DR […] 3 points. Si vous ratez, vous devez descendre une pinte de bière et faire un Test de
 * Résistance à l'alcool Intermédiaire (+0). En cas d'échec […] votre équipe perd 1 point. Le jeu se
 * termine lorsque tous les joueurs ont lancé la serviette. À ce stade, chaque joueur qui n'a pas
 * encore fait de jet sur le Tableau Ivre […] est considéré comme trop sobre et fait perdre 1 point à
 * son équipe. C'est l'équipe qui a le plus de points qui gagne. »
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { seedBattleRng } from './battleRng';
import { findTavernGameById } from '../engine/tavernGame';
import { sequenceTableRow } from './sequenceCore';
import { tavernParams } from './tavernFlow';
import { schema } from '../data/schemas/defs/tavernGames';
import type { Combatant } from '../engine/types';

const get = useGame.getState.bind(useGame);
const TORCHON = findTavernGameById('torchon')!;

/**
 * LE RÉCIT, mesuré au PUITS (`store.log`) et non au slot `journal` : ce slot est un ANNEAU de 40
 * lignes (`state/store.ts:2537`) alors qu'une partie de Torchon en émet ~85 d'un seul geste (le tour
 * du héros, puis les 23 tours de figurants qui s'enchaînent d'office). Le tour joué en FENÊTRE est le
 * PREMIER : ses lignes sont les premières chassées de l'anneau, alors même que le socle les a
 * produites. Le puits est la surface où le socle écrit — c'est là que se mesure « le coup est raconté ».
 */
const PUITS = useGame.getState().log;
const recit: string[] = [];
function capterLeRecit(): void {
  recit.length = 0;
  useGame.setState({
    log: (msg: string | string[]) => { recit.push(...(Array.isArray(msg) ? msg : [msg])); PUITS(msg); },
  } as never);
}

function partie(n: number): Combatant[] {
  const party = makePregens().slice(0, n) as Combatant[];
  useGame.setState({ battle: null, party, journal: [], tavernGames: null, pendingCascade: null, sequence: null });
  capterLeRecit();
  get().playTavernGame({ gameId: 'torchon', challengerId: party[0].id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' }, allyProfil: 'elfe-haut-et-sylvain' });
  return party;
}

const bande = () => get().pendingCascade?.participants.find((s) => s.kind === 'tavern-round');
const payload = () => get().sequence?.payload as {
  throwers?: { id: string; camp: string }[];
} | undefined;

/** Pose le DR des deux rangées du lancer courant, puis clôt (et enchaîne l'étape de pinte s'il y en a une). */
function poseLancer(drLanceur: number, drDanseur: number, drAlcool?: number): void {
  const pc = get().pendingCascade!;
  const idx = pc.participants.findIndex((s) => s.kind === 'tavern-round');
  const band = pc.participants[idx];
  const rows = band.participants!.map((r) => ({
    ...r,
    result: { roll: 11, target: r.target!, sl: r.id.startsWith('danseur-') ? drDanseur : drLanceur, success: true },
  }));
  const participants = [...pc.participants];
  participants[idx] = { ...band, participants: rows };
  useGame.setState({ pendingCascade: { ...pc, participants, cursor: idx } });
  get().cascadeNext();
  // Étape de pinte APPENDÉE (lancer raté d'un héros surfacé) : elle se joue dans la MÊME fenêtre.
  const pinte = get().pendingCascade?.participants[get().pendingCascade!.cursor];
  if (pinte?.kind === 'tavern-drink') {
    const pc2 = get().pendingCascade!;
    const j = pc2.participants.findIndex((s) => s.kind === 'tavern-drink');
    const parts = [...pc2.participants];
    const ok = (drAlcool ?? 1) >= 0;
    parts[j] = { ...pinte, result: { roll: ok ? 11 : 99, target: pinte.target!, sl: drAlcool ?? 1, success: ok } };
    useGame.setState({ pendingCascade: { ...pc2, participants: parts, cursor: j } });
    get().cascadeNext();
  }
}

beforeEach(() => {
  seedBattleRng(5);
  useGame.setState({ battle: null, pendingCascade: null, sequence: null } as never);
});

describe('Le torchon trempé (NADJ 16 l.109-111)', () => {
  it('l’entrée porte la règle : 12 par équipe, 11 danseurs, le barème en table, somme par camp', () => {
    expect(TORCHON.team?.size, '« deux équipes de 12 personnes » (l.109)').toBe(12);
    expect(TORCHON.dancers, '« deux cercles de 11 joueurs » (l.109)').toBe(11);
    expect(TORCHON.table?.map((t) => [t.min, t.max, t.points])).toEqual([[-99, 2, 1], [3, 5, 2], [6, 99, 3]]);
    expect(TORCHON.campScore).toBe('sum');
  });

  /** LA SANCTION DU RATÉ est en DONNÉE (famille 10, `NADJ 16 l.111` — la règle vit à l'Atlas et dans
   *  la `desc` de l'entrée) : aucun Test, aucune op, aucun barème de points n'est écrit dans le flux,
   *  et un second jeu à lanceurs dont le raté se paie autrement est une entrée JSON. */
  it('l’entrée DÉCLARE la sanction du raté : le Test, sa Difficulté, ses ops, ses points, le balayage, SON récit', () => {
    expect(TORCHON.throwerPenalty).toEqual({
      test: { skill: { id: 'resistance-a-l-alcool' } },
      difficulty: 'intermediaire',
      label: 'Descendre une pinte',
      points: 1,
      ops: [{ op: 'intoxicate' }],
      sobrietyPoints: 1,
      lines: {
        manque: '{who} manque son coup et doit descendre une pinte.',
        reussite: '{who} vide son pot sans broncher.',
        echec: '{who} n’a pas vidé le pot à temps : son équipe perd {points} point{s}.',
        balayage: 'Trop sobres : {mien} de votre équipe, {sien} en face — {perteMien} et {perteSien} points perdus.',
      },
    });
  });

  it('le barème est lu par le SOCLE sur le DR net (jambe 1 / corps ≥3 / tête ≥6, l.111)', () => {
    const params = { table: TORCHON.table };
    expect(sequenceTableRow(params, 0)).toMatchObject({ points: 1, label: 'à la jambe' });
    expect(sequenceTableRow(params, 2)).toMatchObject({ points: 1 });
    expect(sequenceTableRow(params, 3)).toMatchObject({ points: 2, label: 'au corps' });
    expect(sequenceTableRow(params, 6)).toMatchObject({ points: 3, label: 'à la tête' });
  });

  it('un tour = UN lanceur, opposé à UN danseur tiré au sort dans le cercle d’en face', () => {
    const party = partie(2);
    const rows = bande()!.participants!;
    expect(rows).toHaveLength(2);
    expect(rows[0].id, 'le lanceur du rang 1').toBe(party[0].id);
    expect(rows[0].interactive, 'un héros porte son jet').toBe(true);
    expect(rows[1].id).toMatch(/^danseur-/);
    expect(rows[1].label, 'le danseur est nommé par son rang dans le cercle').toMatch(/^Danseur ([1-9]|1[01]) /);
    expect(rows[1].interactive, 'le danseur esquive en témoin').toBe(false);
    expect(rows[1].result, 'son Esquive est déjà roulée').toBeTruthy();
    // « le jeu se termine lorsque tous les joueurs ont lancé » : 12 + 12 lanceurs.
    expect(payload()!.throwers).toHaveLength(24);
  });

  /** Seul le lancer d'un HÉROS ouvre une fenêtre : celui posé ici joué, les 23 lancers de figurants
   *  s'enchaînent d'office et la partie se dénoue dans la foulée (c'est le comportement voulu — sinon
   *  une partie coûterait 24 fenêtres). Les assertions portent donc sur le RÉCIT et l'issue. */
  it('TOUCHE : le DR net décide le barème — 6 DR net = coup à la tête, 3 points', () => {
    const party = partie(1);
    poseLancer(7, 1); // net 6 → tête
    const ligne = recit.find((l) => l.includes(party[0].label) && l.includes('touche'));
    expect(ligne, 'le coup est raconté').toBeTruthy();
    expect(ligne).toContain('à la tête');
    expect(ligne).toContain('3 points');
  });

  it('TOUCHE : 3 DR net = coup au corps (2 points), sous 3 DR = jambe (1 point)', () => {
    const party = partie(1);
    poseLancer(4, 1); // net 3 → corps
    expect(recit.find((l) => l.includes(party[0].label) && l.includes('touche'))).toContain('au corps');

    const party2 = partie(1);
    poseLancer(2, 1); // net 1 → jambe
    expect(recit.find((l) => l.includes(party2[0].label) && l.includes('touche'))).toContain('à la jambe');
  });

  it('RATÉ : la pinte s’ouvre dans la MÊME fenêtre, et l’échec coûte 1 point à l’équipe (l.111)', () => {
    const party = partie(1);
    poseLancer(0, 5, -2); // le danseur esquive mieux → raté ; Résistance à l'alcool ratée
    expect(recit.some((l) => l.includes(party[0].label) && l.includes('descendre une pinte'))).toBe(true);
    expect(recit.some((l) => l.includes(party[0].label) && l.includes('perd 1 point')), 'le pot non vidé coûte 1 point').toBe(true);
    expect(get().party.find((h) => h.id === party[0].id)!.drunk?.failedTests, 'l’op `intoxicate` a joué').toBe(1);
  });

  it('BALAYAGE FINAL (l.113) : qui n’a pas roulé sur le Tableau Ivre coûte 1 point — et qui l’a fait, non', () => {
    const party = makePregens().slice(0, 1) as Combatant[];
    useGame.setState({ battle: null, party, journal: [], tavernGames: null, pendingCascade: null, sequence: null });
    capterLeRecit();
    // Bonus d'Endurance ramené à 1 : le premier échec de Résistance suffit à franchir le seuil d'Ivresse.
    party[0].characteristics.endurance = 19;
    get().playTavernGame({ gameId: 'torchon', challengerId: party[0].id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' }, allyProfil: 'elfe-haut-et-sylvain' });
    poseLancer(0, 5, -2); // raté + Résistance ratée → Tableau Ivre roulé

    expect(get().sequence, 'tous ont lancé : la partie est finie').toBeNull();
    // 12 lanceurs par camp : tous « trop sobres » sauf le héros qui a roulé sur le Tableau Ivre.
    const balayage = recit.find((l) => l.includes('Trop sobres'))!;
    expect(balayage, 'le balayage est raconté').toBeTruthy();
    expect(balayage).toContain('11 de votre équipe');
    expect(balayage).toContain('12 en face');
    // Le balayage se lit AUSSI sur les POINTS finaux (pas seulement dans sa phrase) : il RETIRE, donc
    // les deux totaux sont négatifs après 24 lancers — un barème qui ajouterait, ou un compte inversé,
    // ne les produirait pas.
    const res = get().tavernGames!.result!;
    expect(res.playerSL, 'les points d’un camp de 12 sobres passent sous zéro').toBeLessThan(0);
    expect(res.opponentSL).toBeLessThan(0);
  });

  /**
   * Le critère du balayage (`NADJ 16 l.111`) porte sur le jet du Tableau d'Ivresse, sans borne de
   * partie : c'est l'ÉTAT du personnage qui répond. Un lanceur arrivé DÉJÀ ivre à la taverne échappe
   * donc au malus, même s'il n'a rien bu ce soir-là.
   */
  it('BALAYAGE : un lanceur DÉJÀ ivre en arrivant ne compte pas parmi les trop sobres', () => {
    const party = makePregens().slice(0, 1) as Combatant[];
    party[0].drunk = { failedTests: 3, drunk: true, result: 'piece-tourne' };
    useGame.setState({ battle: null, party, journal: [], tavernGames: null, pendingCascade: null, sequence: null });
    capterLeRecit();
    get().playTavernGame({ gameId: 'torchon', challengerId: party[0].id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' }, allyProfil: 'elfe-haut-et-sylvain' });
    poseLancer(7, 1); // il touche : il ne boira pas de la partie

    expect(get().sequence).toBeNull();
    const balayage = recit.find((l) => l.includes('Trop sobres'))!;
    expect(balayage, 'son ivresse d’avant la partie compte').toContain('11 de votre équipe');
    expect(balayage).toContain('12 en face');
  });

  /**
   * LE DR NET, pas le DR brut : un lancer à 6 DR contre un danseur à 4 DR fait 2 DR NET — donc la
   * JAMBE (1 point). Lu au brut, le barème dirait « à la tête » (3 points). C'est le seul cas qui
   * distingue les deux lectures ; les autres tombent dans la même ligne de table.
   */
  it('TOUCHE : c’est le DR NET qui décide — 6 DR contre 4 DR = 2 net = la jambe, jamais la tête', () => {
    const party = partie(1);
    poseLancer(6, 4);
    const ligne = recit.find((l) => l.includes(party[0].label) && l.includes('touche'))!;
    expect(ligne).toContain('à la jambe');
    expect(ligne).toContain('1 point');
    expect(ligne).not.toContain('à la tête');
  });

  it('GRAINE RÉELLE (aucun DR posé) : la partie entière se déroule et se dénoue', () => {
    seedBattleRng(17);
    const party = makePregens().slice(0, 2) as Combatant[];
    useGame.setState({ battle: null, party, journal: [], tavernGames: null, pendingCascade: null, sequence: null });
    get().playTavernGame({ gameId: 'torchon', challengerId: party[0].id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' }, allyProfil: 'elfe-haut-et-sylvain' });
    for (let i = 0; i < 200 && get().pendingCascade; i++) {
      const pc = get().pendingCascade!;
      const cur = pc.participants[pc.cursor];
      if (cur?.participants) {
        for (const row of cur.participants) if (row.interactive !== false && !row.result) get().cascadeBatchRoll(row.id);
      } else if (cur && cur.target != null && !cur.result) get().cascadeRoll(cur.id);
      get().cascadeNext();
    }
    expect(get().sequence, 'la séquence est retirée').toBeNull();
    const res = get().tavernGames!.result!;
    expect(res.rounds).toBe(24);
    expect(['player', 'opponent', 'tie']).toContain(res.winner);
  });
});

/**
 * LE JEU N+1 (famille 10) — un SECOND jeu à lanceurs dont le raté se paie AUTREMENT ne coûte pas une
 * ligne de TS : sa sanction, son barème et SON RÉCIT sont une entrée de donnée. Mesuré en deux temps,
 * sans rien inventer au catalogue livré (une 2ᵉ entrée réelle demanderait une source, ch.16 n'en
 * donne qu'un jeu à lanceurs) :
 *  (a) la FIXTURE passe le schéma du fichier — c'est bien une entrée JSON valide, pas un objet forgé ;
 *  (b) ses PARAMÈTRES pilotent une partie RÉELLE (le flux ne lit QUE `seq.params` pour la sanction) :
 *      le récit sort en toutes lettres de la fixture, et la pinte du Torchon n'y apparaît nulle part.
 * CE QUE LA SONDE NE COUVRE PAS, dit plutôt que supposé : l'effectif et les danseurs restent ceux du
 * Torchon (ils viennent de l'ENTRÉE, pas des paramètres) — la conversion entrée→paramètres, elle, est
 * mesurée exhaustivement par `tavern-dominos-tiebreak.test.ts`.
 */
describe('famille (10) — un 2ᵉ jeu à lanceurs est une ENTRÉE JSON, récit compris', () => {
  const FIXTURE = {
    id: 'sonde-lanceurs',
    type: 'tavernGames',
    label: 'Sonde à lanceurs',
    desc: 'Entrée de SONDE (jamais livrée au catalogue) : elle mesure qu’un 2ᵉ jeu à lanceurs se déclare.',
    skill: { id: 'projectiles', spec: 'lancer' },
    mode: 'opposed' as const,
    team: { size: 2 },
    dancers: 3,
    roundShape: 'thrower' as const,
    campScore: 'sum',
    table: [{ min: -99, max: 99, points: 2, label: 'de plein fouet' }],
    throwerPenalty: {
      test: { skill: { id: 'calme' } },
      difficulty: 'difficile' as const,
      label: 'Garder contenance',
      points: 2,
      lines: {
        manque: '{who} rate son jet et perd la face.',
        reussite: '{who} garde contenance.',
        echec: '{who} se trouble : son camp perd {points} point{s}.',
      },
    },
    source: { book: 'nuits-agitees-et-dures-journees', page: 94 },
  };

  it('(a) la fixture est une entrée JSON VALIDE au schéma du fichier', () => {
    const parse = schema.safeParse([FIXTURE]);
    expect(parse.success, parse.success ? '' : JSON.stringify(parse.error.issues.slice(0, 3))).toBe(true);
  });

  it('(b) ses paramètres pilotent la partie : SON récit sort, et aucune pinte n’est descendue', () => {
    const party = makePregens().slice(0, 1) as Combatant[];
    useGame.setState({ battle: null, party, journal: [], tavernGames: null, pendingCascade: null, sequence: null });
    capterLeRecit();
    get().playTavernGame({ gameId: 'torchon', challengerId: party[0].id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' }, allyProfil: 'elfe-haut-et-sylvain' });
    // La SANCTION jouée est celle des paramètres — ceux de la fixture, convertis par la même porte.
    const seq = get().sequence!;
    useGame.setState({ sequence: { ...seq, params: tavernParams(FIXTURE as never) } });
    poseLancer(0, 5, -2); // lancer manqué, puis Test de sanction ÉCHOUÉ

    expect(recit.some((l) => l.includes('perd la face')), 'le coup manqué se raconte comme la fixture le dit').toBe(true);
    expect(recit.some((l) => l.includes('se trouble') && l.includes('2 points')), 'l’échec coûte ce qu’elle déclare').toBe(true);
    expect(recit.some((l) => /pinte|pot/i.test(l)), 'aucune phrase du Torchon ne survit à un autre jeu').toBe(false);
  });
});
