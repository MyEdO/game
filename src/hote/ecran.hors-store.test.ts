import { describe, it, expect } from 'vitest';
import { nouvelEntete, ouvrirLaPartie } from './partie';
import { lignesDuJournal } from './ecran';
import type { LigneDuJournal } from '../noyau/index';

describe('le journal de l’écran (`journal.lignes`)', () => {
  it('une ligne par événement, ses sous-lignes à son détail, le ton dit ce qu’il pèse et pour quel camp', () => {
    const { partie } = ouvrirLaPartie(nouvelEntete('dome', { graine: 7 }), () => {});
    try {
      const etat = partie.etat();
      const heros = etat.battle!.combatants.find((c) => c.kind === 'hero')!;
      const ennemi = etat.battle!.combatants.find((c) => c.kind === 'enemy')!;
      const combat = (kind: Extract<LigneDuJournal, { de: 'combat' }>['evenement']['kind'], text: string, actorId?: string, targetId?: string): LigneDuJournal =>
        ({ de: 'combat', evenement: { kind, text, actorId, targetId } });
      const lignes = lignesDuJournal(etat, 3, [
        { de: 'journal', texte: 'Vous entrez.' },
        combat('round', 'Round 2'),
        combat('attack', 'Coup porté.', heros.id, ennemi.id),
        combat('detail', '  ↳ Tête, 4 Blessures'),
        combat('detail', '  ↳ Sonné'),
        combat('crit', 'Critique au bras.', ennemi.id, heros.id),
        combat('death', 'Hors de combat.', ennemi.id),
        combat('info', ''),
      ]);
      expect(lignes.map(({ id, ton, texte, detail }) => ({ id, ton, texte, detail }))).toEqual([
        { id: 'journal/3', ton: 'neutre', texte: 'Vous entrez.', detail: null },
        { id: 'journal/4', ton: 'alerte', texte: 'Round 2', detail: null },
        { id: 'journal/5', ton: 'neutre', texte: 'Coup porté.', detail: 'Tête, 4 Blessures\nSonné' },
        { id: 'journal/8', ton: 'echec', texte: 'Critique au bras.', detail: null },
        { id: 'journal/9', ton: 'reussite', texte: 'Hors de combat.', detail: null },
      ]);
      expect(lignesDuJournal(etat, 0, [combat('detail', '↳ Seule')]), 'une sous-ligne sans ligne avant elle dans l’appel reste une ligne').toMatchObject([{ texte: '↳ Seule', detail: null }]);
    } finally {
      partie.fermer();
    }
  });
});
