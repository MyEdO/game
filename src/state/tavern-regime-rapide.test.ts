/**
 * LE RÉGIME RAPIDE — règle optionnelle `tavern-games-rapides` (#1279 Sf).
 *
 * `NADJ 16 l.9-11`, verbatim : « **OPTION : JEUX DE TAVERNE RAPIDES** — Pour certains groupes, les
 * jets de dés peuvent gêner le plaisir du jeu de rôle. Si vous souhaitez que vos parties de taverne
 * soient résolues rapidement, effectuez un Test opposé de **Compétence Intermédiaire (+0)** en
 * utilisant la Compétence indiquée dans la section « Jeu » du jeu en question. Si aucune Compétence
 * n'est indiquée (comme pour *Al-zahr*), faites plutôt un Test opposé de **Pari Intermédiaire (+0)**.
 * Celui qui obtient le nombre le plus élevé de DR remporte la partie. »
 *
 * Les DEUX régimes du chapitre coexistent : ce fichier mesure ce que la règle CHANGE (le jeu perd ses
 * règles propres et se résout en UN Test opposé) et ce qu'elle ne change pas quand elle est éteinte.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { seedBattleRng } from './battleRng';
import { setRule, resetRule } from '../engine/policy';
import { findTavernGameById, fastTavernGame, TAVERN_GAMES, TAVERN_FAST_RULE, tavernFastRegime } from '../engine/tavernGame';
import { toBrass } from '../engine/money';
import { bourseOf } from './bourseFlow';
import { tavernParams } from './tavernFlow';
import type { Combatant } from '../engine/types';

const get = useGame.getState.bind(useGame);

/** Un héros seul à la table, face à un adversaire de la salle. */
function seul(): Combatant {
  const a = makePregens()[0] as Combatant;
  useGame.setState({ battle: null, party: [a], journal: [], tavernGames: null, pendingCascade: null, sequence: null });
  return get().party[0];
}

/** Joue la partie ouverte jusqu'à son dénouement, en résolvant tout ce qui se présente. */
function drain(): void {
  for (let i = 0; i < 200 && get().pendingCascade; i++) {
    const p = get().pendingCascade!;
    const cur = p.participants[p.cursor];
    if (cur) {
      if (cur.table && !cur.table.result) get().cascadeTableRoll(cur.id);
      else if (cur.options && cur.chosen == null) get().cascadeChoose(cur.id, cur.defaultChoice ?? cur.options[0].key);
      else if (cur.target != null && !cur.result) get().cascadeRoll(cur.id);
      else if (cur.participants?.some((r) => r.interactive !== false && !r.result)) {
        for (const r of cur.participants) if (r.interactive !== false && !r.result) get().cascadeBatchRoll(r.id);
      }
    }
    get().cascadeNext();
  }
}

beforeEach(() => {
  seedBattleRng(11);
  useGame.setState({ battle: null, party: [], journal: [], tavernGames: null, pendingCascade: null, sequence: null });
});

afterEach(() => {
  resetRule(TAVERN_FAST_RULE);
  useGame.setState({ tavernGames: null, pendingCascade: null, sequence: null });
});

describe('Régime RAPIDE — la règle optionnelle, DISTINCTE de l’ouverture de la fonctionnalité', () => {
  it('elle est ÉTEINTE par défaut, et n’est pas `tavern-games`', () => {
    expect(TAVERN_FAST_RULE).toBe('tavern-games-rapides');
    expect(tavernFastRegime(), 'par défaut : le jeu complet').toBe(false);
    // Ouvrir la fonctionnalité ne bascule PAS le régime — deux règles, deux décisions.
    setRule('tavern-games', true);
    expect(tavernFastRegime()).toBe(false);
    resetRule('tavern-games');
  });

  /**
   * LA LISTE BLANCHE, TENUE PAR UN ROUGE — sur les TREIZE entrées, jamais sur trois échantillons : un
   * champ de famille qui fuirait (plafond de DR, départage, formule de camp, mi-temps, seuil de but,
   * table de score…) RÉVEILLE la famille correspondante côté socle, sans qu'aucune assertion
   * nominative ne le voie. Ce qui est mesuré est donc l'ENSEMBLE des clés, pas une liste de champs
   * qu'on aurait pensé à citer.
   */
  it('active : AUCUN champ hors liste blanche, sur les TREIZE jeux du chapitre', () => {
    setRule(TAVERN_FAST_RULE, true);
    const BLANCHE = new Set(['id', 'label', 'desc', 'skill', 'spec', 'characteristic', 'mode', 'source']);
    const fuites: string[] = [];
    for (const entree of TAVERN_GAMES) {
      const jeu = findTavernGameById(entree.id)!;
      for (const cle of Object.keys(jeu)) if (!BLANCHE.has(cle)) fuites.push(`${entree.id}.${cle}`);
      expect(jeu.mode, `${entree.id} : un Test opposé, rien d’autre`).toBe('opposed');
      // Aucune famille ne peut s'armer : les paramètres de séquence sont VIDES pour tout jeu.
      expect(tavernParams(jeu, 3), `${entree.id} : aucun paramètre de famille`).toEqual({});
    }
    expect(fuites, 'un champ de règle propre a franchi la projection').toEqual([]);
    expect(TAVERN_GAMES.length, 'les 13 jeux du chapitre sont couverts').toBe(13);
  });

  it('active : les 11 jeux se jouent en UNE manche, Intermédiaire (+0), sans mouvement de bourse', () => {
    setRule(TAVERN_FAST_RULE, true);
    for (const entree of TAVERN_GAMES) {
      const h = seul();
      const avant = toBrass(bourseOf(get().party[0]));
      get().playTavernGame({ gameId: entree.id, challengerId: h.id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' }, stakeBrass: 500 });
      const ouverture = get().pendingCascade!;
      expect(ouverture.participants.map((s) => s.kind), `${entree.id} : la manche opposée ordinaire, rien d’autre`).toEqual(['tavern-round']);
      expect(ouverture.participants[0].difficulty, `${entree.id} : « Test opposé de Compétence Intermédiaire (+0) »`).toBe('intermediaire');
      drain();
      const res = get().tavernGames!.result!;
      expect(res.rounds, `${entree.id} : « Celui qui obtient le nombre le plus élevé de DR remporte la partie »`).toBe(1);
      expect([res.stakeBrass, res.netBrass], `${entree.id} : aucune mise ne se joue au régime rapide`).toEqual([0, 0]);
      expect(toBrass(bourseOf(get().party[0])), `${entree.id} : la bourse n’a pas bougé`).toBe(avant);
      expect(get().sequence, `${entree.id} : la partie est dénouée`).toBeNull();
    }
  });

  it('active : le TEST joué suit la LETTRE — la Compétence indiquée, Pari si aucune (l.11)', () => {
    setRule(TAVERN_FAST_RULE, true);
    // « Si aucune Compétence n'est indiquée (comme pour Al-zahr), faites plutôt un Test opposé de Pari ».
    expect(findTavernGameById('al-zahr')!.skill).toEqual({ id: 'pari' });
    // Le Bras de fer n'indique AUCUNE Compétence (l.34 nomme la Force, une Caractéristique) → Pari,
    // et sa Caractéristique ne franchit pas la projection : l'esprit de la règle n'est pas le défaut.
    const brasDeFer = findTavernGameById('bras-de-fer')!;
    expect([brasDeFer.skill, brasDeFer.characteristic]).toEqual([{ id: 'pari' }, undefined]);
    // La Compétence indiquée, elle, est jouée telle quelle — spécialisation comprise.
    expect([findTavernGameById('cerevis')!.skill, findTavernGameById('flechettes')!.skill])
      .toEqual([{ id: 'pari' }, { id: 'projectiles', spec: 'lancer' }]);
    // L'override MAISON vit en DONNÉE (`fastSkill`), éditable : posé, c'est lui qui joue.
    const maison = fastTavernGame({ ...findTavernGameById('bras-de-fer')!, fastSkill: { char: 'force', maison: 'lecture d’esprit de l.11' } });
    expect([maison.skill, maison.characteristic]).toEqual([undefined, 'force']);
  });

  it('éteinte, le jeu complet reste intact (les deux régimes coexistent)', () => {
    expect(findTavernGameById('al-zahr')!.pot, 'la table de mise est là').toBeTruthy();
    expect(findTavernGameById('flechettes')!.volley!.exact).toBe(501);
    expect(findTavernGameById('cerevis')!.combined!.tours).toBe(6);
    expect(findTavernGameById('bras-de-fer')!.target, '« Le premier Personnage qui atteint au moins 10 DR »').toBe(10);
  });

  it('les PARAMÈTRES de séquence tombent avec le jeu : aucune cible de cumul, aucune famille', () => {
    setRule(TAVERN_FAST_RULE, true);
    // Sans `target`, le réducteur dénoue à la PREMIÈRE clôture : « Celui qui obtient le nombre le
    // plus élevé de DR remporte la partie » (l.11).
    expect(tavernParams(findTavernGameById('bras-de-fer')!, 0)).toEqual({});
    expect(tavernParams(findTavernGameById('al-zahr')!, 3)).toEqual({});
  });

  it('AL-ZAHR au régime rapide : une partie SANS MISE, tranchée en UNE manche par un Test opposé', () => {
    setRule(TAVERN_FAST_RULE, true);
    const h = seul();
    get().playTavernGame({ gameId: 'al-zahr', challengerId: h.id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' }, stakeBrass: 0 });
    // Le régime complet REFUSERAIT cette partie (« sans mise, aucune table ne s'ouvre ») : ici elle
    // s'ouvre, parce que le jeu rapide ne connaît ni mise ni pot.
    expect(get().sequence, 'la séquence est ouverte').toBeTruthy();
    drain();
    const res = get().tavernGames!.result!;
    expect(res.rounds, 'une seule manche : le plus de DR l’emporte').toBe(1);
    expect(res.stakeBrass).toBe(0);
    expect(res.netBrass, 'aucun mouvement de bourse : il n’y a pas de mise').toBe(0);
    expect(['player', 'opponent', 'tie']).toContain(res.winner);
    expect(get().sequence, 'la partie est dénouée').toBeNull();
  });

  it('LES FLÉCHETTES au régime rapide : aucun passage de lancers — la partie tient en une manche', () => {
    setRule(TAVERN_FAST_RULE, true);
    const h = seul();
    get().playTavernGame({ gameId: 'flechettes', challengerId: h.id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' } });
    // Aucune étape de volée : c'est la manche opposée ordinaire qui s'ouvre.
    const kinds = get().pendingCascade!.participants.map((s) => s.kind);
    expect(kinds).toEqual(['tavern-round']);
    drain();
    expect(get().tavernGames!.result!.rounds).toBe(1);
  });

  it('LE CEREVIS au régime rapide : aucun Test combiné — la fenêtre n’annonce qu’une lecture', () => {
    setRule(TAVERN_FAST_RULE, true);
    const h = seul();
    get().playTavernGame({ gameId: 'cerevis', challengerId: h.id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' } });
    const cur = get().pendingCascade!.participants[0];
    expect(cur.kind).toBe('tavern-round');
    expect(cur.second, 'le jeu rapide ne joue pas le Test combiné').toBeUndefined();
    // Et la Difficulté est celle du jeu rapide (« Intermédiaire (+0) »), pas le « Pari Accessible (+20) »
    // que l'entrée déclare pour sa manche complète.
    expect(cur.difficulty).toBe('intermediaire');
  });
});
