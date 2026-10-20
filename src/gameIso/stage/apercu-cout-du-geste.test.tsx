/**
 * APERÇU COÛT/CHEMIN AVANT CLIC (#1411 P2-D) — ce que le curseur DIT du geste avant qu'on le commette :
 * le Mouvement « avant → après » qu'il consommera, et le palier de Difficulté NOMMÉ que l'attaque
 * produirait. Contrat POSITIF : un palier ne s'affiche qu'à l'exactitude (`LDB 12`, tableau de
 * Difficulté ; `LDB 14 l.91-96` pour la combinaison), jamais par plus proche voisin.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Dims } from '../../geometry/iso';
import { HoverMovePreview, TapPreview, mouvementLigne } from './MoveOverlays';
import { composeAttack, type ModLine } from '../../engine/combat';
import { difficultyOf, type AttackPreview } from '../../noyau/combatFlow';
import { difficultyShownText } from '../../ui/difficultyText';
import { DIFFICULTY_LABELS, type Combatant, type Weapon } from '../../engine/types';
import type { BattleState } from '../../noyau/etat';

const dims: Dims = { w: 8, h: 8, rot: 0, view: 'iso' };
const circ = (value: number): ModLine[] => [{ label: 'circonstances', value, famille: 'circonstance' }];
/** Un aperçu d'attaque dont SEULE la composition varie — `namedDifficulty` ne lit rien d'autre. */
const apercu = (mods: ModLine[]): AttackPreview => ({
  ...composeAttack(mods), blocked: false, inRange: true,
  weapon: { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0 }, qualities: [] } as unknown as Weapon,
  kind: 'melee', target: 40, base: 40, dmg: 4, soak: 0,
});

/** Ce que le curseur DIRA de cette Difficulté : la donnée du socle, mise en mots par l'UI. */
const dit = (p: AttackPreview): string | null => difficultyShownText(difficultyOf(p));

const héros = {
  id: 'h1', label: 'Héros', kind: 'hero', pos: { x: 1, y: 0 }, size: 'moyenne',
  movement: 4, conditions: [], items: [], talents: [], traits: [], weapons: [], characteristics: {}, liveTraits: [],
} as unknown as Combatant;
const battle = (over: Partial<BattleState> = {}): BattleState =>
  ({ combatants: [héros], order: ['h1'], turn: 0, movementUsed: 0, preview: null, ...over } as unknown as BattleState);

describe('la Difficulté aperçue est dite dans les termes de la modale (LDB 12)', () => {
  it('−20 : « Difficile (−20) », le cran de l’échelle', () => {
    expect(dit(apercu(circ(-20)))).toBe(DIFFICULTY_LABELS.difficile);
    expect(DIFFICULTY_LABELS.difficile).toBe('Difficile (−20)');
  });

  it('−15 : aucun cran ne le porte → le modificateur RÉEL, « Combinée (−15) », jamais le voisin', () => {
    expect(dit(apercu(circ(-15)))).toBe('Combinée (−15)');
    expect(dit(apercu(circ(-15))), 'surtout pas le cran voisin −10').not.toBe(DIFFICULTY_LABELS.complexe);
  });

  it('aucune circonstance : l’attaque garde sa Difficulté déclarée, « Intermédiaire (+0) »', () => {
    expect(dit(apercu([]))).toBe('Intermédiaire (+0)');
  });

  it('un aperçu sans cible atteignable (hors portée / LdV coupée) n’en dit AUCUNE', () => {
    expect(dit({ ...apercu(circ(-20)), inRange: false })).toBeNull();
    expect(dit({ ...apercu(circ(-20)), blocked: true })).toBeNull();
  });
});

describe('le curseur porte ce que le geste fait du Mouvement', () => {
  it('le badge de SURVOL dit « Mouvement avant → après » en plus du coût', () => {
    const html = renderToStaticMarkup(
      <svg>
        <HoverMovePreview
          move={{ kind: 'move', path: [{ x: 0, y: 0 }, { x: 1, y: 0 }], cost: 2, label: 'Aller (2)' }}
          at={{ x: 1, y: 0 }} footN={1} dims={dims} lift={() => 0} battle={battle()} activeC={héros}
        />
      </svg>,
    );
    expect(html).toContain('Aller (2)');
    expect(html, 'le solde du Tour AVANT et APRÈS le geste, pas seulement son coût').toContain('Mouvement 4 → 2');
  });

  it('le Mouvement déjà dépensé ce Tour est décompté du « avant »', () => {
    expect(mouvementLigne(battle({ movementUsed: 1 } as Partial<BattleState>), héros, { kind: 'move', tile: { x: 1, y: 0 }, path: [], cost: 2 } as BattleState['preview']))
      .toBe('Mouvement 3 → 1');
  });

  it('un geste qui ne coûte AUCUN Mouvement ne parle pas de Mouvement', () => {
    expect(mouvementLigne(battle(), héros, { kind: 'attack', targetId: 'e1' } as BattleState['preview'])).toBeNull();
  });

});

describe('l’aperçu tap-1 porte la Difficulté de l’attaque qu’il commettra', () => {
  const cible = { ...héros, id: 'e1', kind: 'enemy', pos: { x: 3, y: 0 } } as unknown as Combatant;

  it('le badge d’ATTAQUE dit la Difficulté que la modale dira', () => {
    const html = renderToStaticMarkup(
      <svg>
        <TapPreview
          battle={battle({ combatants: [héros, cible], preview: { kind: 'attack', targetId: 'e1', path: [] } } as unknown as Partial<BattleState>)}
          activeC={héros} dims={dims} liftOf={() => 0} myTurn difficulty={{ difficulty: 'difficile' }}
        />
      </svg>,
    );
    expect(html).toContain('Attaquer');
    expect(html).toContain('Difficile (−20)');
  });

  it('sans Difficulté résolue, le badge n’en invente pas — ni voisin approximant, ni « ~ »', () => {
    const html = renderToStaticMarkup(
      <svg>
        <TapPreview
          battle={battle({ combatants: [héros, cible], preview: { kind: 'attack', targetId: 'e1', path: [] } } as unknown as Partial<BattleState>)}
          activeC={héros} dims={dims} liftOf={() => 0} myTurn
        />
      </svg>,
    );
    expect(html).toContain('Attaquer');
    for (const label of Object.values(DIFFICULTY_LABELS)) expect(html).not.toContain(label);
  });
});
