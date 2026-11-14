import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { draineCascade } from './cascade.testkit';
import { castSpell, resolveRoundBoundary, counterspellCandidates, routeCounterspell, advanceTurn } from './combatFlow';
import { createHero } from '../engine/character';
import { acquerirTalent } from '../engine/careerSlots';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { reluDans } from './combatDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Dissipation / Contre-sort (LDB 46 l.156) : Test opposé de Langue (Magick) contre une
 *  incantation — IA (ennemi → héros) et action joueur (héros → ennemi), un seul par Round. */
describe('Contre-sort (Dissipation, LDB 46 l.156)', () => {
  function setup() {
    const hero = createHero({ idNeuf: idsDeTest,
      speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W',
      careerTalent: { id: 'magie-mineure' }, seed: 707,
    });
    hero.spells = ['flechette'];
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    // L'ennemi devient une lanceuse façon Eusapia : Langue (Magick) 63 (Int 48 + 15), Carreau connu.
    E.characteristics.intelligence = 48; E.characteristics['force-mentale'] = 53;
    E.skills = [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 15 }];
    E.spells = ['carreau'];
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 12, y: 10 }; // à 2 cases : dans les FM mètres de chacun
    banc.setState({ battle: { ...b } });
    return { H: reluDans(banc.getState, H), E: reluDans(banc.getState, E) };
  }

  it('candidats : lanceur du camp opposé, ciblé ou point vu à ≤ FM mètres ; un seul essai par Round', () => {
    const { H, E } = setup();
    expect(counterspellCandidates(banc.getState().battle, banc.getState().scene, H, E).map((c) => c.id)).toContain(E.id);
    E.dispelledThisRound = true; // essai consommé
    expect(counterspellCandidates(banc.getState().battle, banc.getState().scene, H, E)).toHaveLength(0);
    E.dispelledThisRound = undefined;
    E.skills = []; // plus lanceuse (ni Compétence ni Trait)
    expect(counterspellCandidates(banc.getState().battle, banc.getState().scene, H, E)).toHaveLength(0);
  });

  it('IA : l’ennemie chante un Contre-sort contre le Sort du héros (déclaré au jet, 1/Round)', () => {
    banc.getState().ensemencerLeTirage(3);
    const { H, E } = setup();
    castSpell(banc.getState, banc.setState, H, E, 'flechette');
    banc.getState().jetLancer('incantation');
    const pc = banc.getState().pendingCast!;
    if (!pc.result!.isCritical) {
      expect(pc.result!.log).toContain('Contre-sort de');
      expect(banc.getState().battle!.combatants.find((c) => c.id === E.id)!.dispelledThisRound).toBe(true);
    }
    // 2e incantation du même Round : l'essai est consommé, plus de Contre-sort. (La 1re situation se
    // referme à la main — après le jet, `jetAnnuler('incantation')` REFUSE de renoncer, #1031.)
    banc.setState({ pendingCast: null, pendingCascade: null, pendingCounterspell: null });
    castSpell(banc.getState, banc.setState, H, E, 'flechette');
    banc.getState().jetLancer('incantation');
    const pc2 = banc.getState().pendingCast!;
    expect(pc2.result!.log).not.toContain('Contre-sort de');
  });

  it('routage : c’est le JET qui ouvre le Contre-sort, pas l’aboutissement du Sort (LDB 46 l.156)', () => {
    const { H, E } = setup();
    const open = (cast: boolean) => {
      banc.setState({
        pendingCounterspell: null,
        pendingCast: { casterId: E.id, targetId: H.id, spellId: 'carreau', missile: true, focused: false,
          result: { cast, roll: 20, target: 145, sl: 12, isCritical: false, isFumble: false, log: 'x' } },
      });
      routeCounterspell(banc.getState, banc.setState); // déterministe (jet figé contrôlé)
      return banc.getState().pendingCounterspell;
    };
    // « vous pouvez opposer le Test d'Incantation » : l'objet du Test opposé est le JET, et « le Sort
    // utilise le DR du Test opposé pour déterminer si l'incantation a réussi » — la réussite est
    // POSTÉRIEURE au Contre-sort. Le DR obtenu par le lanceur ne conditionne donc pas la fenêtre.
    const pcs = open(true);
    expect(pcs).toBeTruthy();
    expect(pcs!.participants.map((p) => p.id)).toContain(H.id);
    const rate = open(false);
    expect(rate, 'un DR insuffisant n’est pas un verrou : le contre-lanceur déclare AU jet').toBeTruthy();
    expect(rate!.participants.map((p) => p.id)).toContain(H.id);
  });

  it('IA : le Sort ennemi SUSPEND le tour ; résoudre la réaction rend la main', () => {
    banc.getState().ensemencerLeTirage(3);
    const { H, E } = setup();
    H.wounds = blessuresDeBase(99, 99, H); // survit au Carreau : le sujet est la suspension
    banc.setState({
      battle: { ...banc.getState().battle!, order: [H.id, E.id], turn: 0, action: null, movementUsed: 0, movedPreAction: false, acted: false },
      pendingRoundStart: null, 
    });
    advanceTurn(banc.getState, banc.setState); // H finit → E actif → IA : Carreau pré-roulé (aucun « Lancer »)
    banc.avancer(5000);
    let st = banc.getState();
    expect(st.pendingCast?.casterId).toBe(E.id); // incantation ennemie figée → tour suspendu sur le lanceur
    expect(st.battle!.order[st.battle!.turn]).toBe(E.id);
    expect(st.battle!.round).toBe(1);
    // Résoudre ce qui s'est ouvert : Contre-sort (cast réussi) OU révélation (cast raté/Maladresse) → la main passe.
    // Le Contre-sort passe par SA phase de déclaration (#1042/#1059) : les rangées surfacées passent, la
    // dernière déclaration referme la fenêtre par le résolveur canonique.
    if (st.pendingCounterspell) {
      for (const p of st.pendingCounterspell.participants) banc.getState().jetRegler('contreSort', 'declaration', 'passer', p.id);
    } else banc.getState().jetValider('incantation');
    banc.avancer(2000);
    // Une Maladresse de l'IA déclare son étape à table comme partout (#1426) : la main ne repasse
    // qu'une fois la séquence de conséquence jouée (le socle a déjà tiré ce que nul siège ne tient).
    draineCascade(banc.getState);
    banc.avancer(2000);
    st = banc.getState();
    expect(st.pendingCast).toBeNull();
    expect(st.pendingCounterspell).toBeNull();
    expect(st.battle!.round).toBe(2); // frontière franchie : la main est bien passée
  });

  it('frontière de Round : l’essai de Contre-sort se réarme (LDB 46 : « chaque Round »)', () => {
    const { E } = setup();
    E.dispelledThisRound = true;
    resolveRoundBoundary(banc.getState, banc.setState);
    expect(banc.getState().battle!.combatants.find((c) => c.id === E.id)!.dispelledThisRound).toBeUndefined();
  });

  it('une Prière ne se dissipe pas (LDB 46 : « Si un SORT vous cible »)', () => {
    banc.getState().ensemencerLeTirage(3);
    const { H } = setup();
    const hero = banc.getState().battle!.combatants.find((c) => c.id === H.id)! as Combatant;
    hero.skills = [...hero.skills, { id: 'priere', characteristic: 'sociabilite', advances: 5 }];
    acquerirTalent(hero, { id: 'beni', spec: 'shallya' }); // LDB 10 l.109
    hero.spells = ['benediction-de-guerison'];
    castSpell(banc.getState, banc.setState, hero, hero, 'benediction-de-guerison');
    banc.getState().jetLancer('incantation');
    expect(banc.getState().pendingCast!.result!.log).not.toContain('Contre-sort');
  });
});
