import { describe, it, expect, beforeEach } from 'vitest';
import { applyCriticalToTarget } from '../noyau/combatFlow';
import { journaliser } from '../noyau/combatLog';
import { ouvrirLeBanc, type Banc } from '../noyau/banc.testkit';
import { seedBattleRng } from '../noyau/battleRng';
import { emptyScene } from '../noyau/monde/scene';
import type { EntreeDuJournal, LigneDuJournal } from '../noyau/index';
import { resolveCritique } from '../engine/critical';
import { desEnSuite } from '../engine/dice.testkit';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';
import type { Combatant } from '../engine/types';
import { lignesDuJournal } from './ecran';
import { redigerLEntree } from './journal';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const CHARS = { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const gobelin = (): Combatant => (blessuresSurLeProfil({
  id: 'g', label: 'Gobelin', kind: 'ennemi', pos: { x: 2, y: 1 }, characteristics: CHARS, wounds: blessuresDeBase(10), conditions: [], skills: [], talents: [], traits: [], activeEffects: [],
  bodyShape: 'humanoide', size: 'moyenne', items: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  weapons: [{ uid: 's1', label: 'Hachoir', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] }],
}) as unknown as Combatant);

// #4574 : `rattache` remplace le « ↳ » du noyau ; l'hôte en dérive la mise en page. LDB 18 l.107 (« Choc au bras »)
describe('une entrée rattachée par le noyau, du Critique à l’hôte', () => {
  it('arrive en `detail` au journal de combat, rangée sous sa ligne à l’écran et marquée par l’hôte texte', () => {
    const cible = gobelin();
    const temoin = { ...gobelin(), id: 'h', label: 'Témoin', kind: 'heros', pos: { x: 1, y: 1 } } as Combatant;
    banc.setState({ scene: emptyScene('scene-test'), battle: { combatants: [cible, temoin], log: [] } as never });
    seedBattleRng(1);
    const crit = resolveCritique('ldb', cible, 'brasD', desEnSuite([5], { boucle: true, borne: true }), { overkill: 0 });
    const log: EntreeDuJournal[] = [];
    applyCriticalToTarget(cible, 'brasD', 0, log, banc.setState, { prerolled: crit, get: banc.getState });
    journaliser(banc.getState, banc.setState, log, 'critique', { targetId: cible.id });

    const evenements = banc.getState().battle!.log;
    const lache = evenements.find((e) => e.entree.texte === 'Gobelin lâche Hachoir.');
    expect(lache, 'la ligne de l’arme lâchée est rattachée à la ligne du Critique').toMatchObject({ kind: 'detail', entree: { rattache: true } });
    expect(evenements[0]).toMatchObject({ kind: 'critique', entree: { texte: crit.log } });
    expect(evenements[0].entree.rattache).toBeUndefined();

    expect(redigerLEntree(lache!.entree), 'l’hôte texte rédige le rattachement').toBe('  ↳ Gobelin lâche Hachoir.');
    const journal: LigneDuJournal[] = evenements.map((evenement) => ({ de: 'combat', evenement, heure: banc.getState().gameTime }));
    const { lignes } = lignesDuJournal(banc.getState(), 0, journal, null);
    const duCritique = lignes.find((l) => l.texte === crit.log);
    expect(duCritique?.detail?.split('\n'), 'l’écran range la ligne rattachée sous celle du Critique, sans marque').toContain('Gobelin lâche Hachoir.');
    expect(lignes.some((l) => l.texte.includes('Gobelin lâche Hachoir.')), 'la ligne rattachée n’est pas une ligne à part').toBe(false);
  });
});
