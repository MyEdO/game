import { describe, it, expect, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BargainModal, BargainModalView } from './BargainModal';
import { TeamPortrait } from './TeamPortrait';
import { useGame, type PendingBargain } from '../state/store';
import { sceneNpc } from '../state/sceneNpc';
import { emptyNarratif } from '../state/campaignNarratif';
import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS, type Scene } from '../state/scene';
import { skillBaseValue, testValue } from '../engine/skills';
import { findMutationById } from '../data';
import type { Combatant } from '../engine/types';

const base: PendingBargain = {
  playerId: 'h',
  playerName: 'H',
  merchantName: 'Armurier',
  merchantValue: 45,
  playerSkill: 50,
  playerBase: 50,
  mode: 'buy',
  negotiator: false,
  roll: null,
  merchantRoll: null,
  result: null,
};

const noop = () => {};

/** #1882 — le marchand est un PNJ de scène : sa ligne adverse porte SA fiche (`sceneNpc`), preset compris. */
describe('BargainModal — le marchand à preset joue sa fiche', () => {
  // Le rendu SERVEUR lit l'état INITIAL du store (patron `refus-au-survol.test.tsx`), les couches hors React l'état courant.
  const initial = useGame.getInitialState() as unknown as Record<string, unknown>;
  const avant = { pendingBargain: initial.pendingBargain, merchant: initial.merchant, scene: initial.scene, party: initial.party };
  afterEach(() => { Object.assign(initial, avant); useGame.setState({ campaignNarratif: null }); });

  it('le portrait adverse est celui de la fiche du preset, pas d’un profil de repli', () => {
    const scene = {
      type: 'scene', id: 's', label: 'S', dimensions: { w: 4, h: 4 }, reliefDefaults: { ...DEFAULT_RELIEF_DEFAULTS }, roofDefaults: { ...DEFAULT_ROOF_DEFAULTS },
      layers: [{ z: 0, tiles: Array(16).fill('herbe') }], dialogues: [], triggers: [], encounters: [], flags: {},
      entities: [{ id: 'marchand', kind: 'personnage', pos: { x: 1, y: 1 }, presetId: 'marchand-nomme' }],
    } as unknown as Scene;
    useGame.setState({ campaignNarratif: { ...emptyNarratif(), presetsPnj: [{ id: 'marchand-nomme', base: 'nain', profil: { label: 'Gunther le Négociant' } }] } });
    Object.assign(initial, { scene, merchant: { entityId: 'marchand' }, pendingBargain: base, party: [] });
    const fiche = sceneNpc(scene, 'marchand')!;
    expect(fiche.creatureId).toBe('nain');
    const html = renderToStaticMarkup(<BargainModal />);
    expect(html).toContain(renderToStaticMarkup(<TeamPortrait combatant={fiche} size={28} />));
  });
});

describe('BargainModal (#2c)', () => {
  it('avant le jet : bouton Lancer + le marchand nommé', () => {
    const html = renderToStaticMarkup(
      <BargainModalView pb={base} fortune={0} onRoll={noop} onReroll={noop} onBonusSL={noop} onConfirm={noop} onCancel={noop} />,
    );
    expect(html).toMatch(/Lancer/);
    expect(html).toContain('Armurier'); // le marchand est nommé
    expect(html).not.toContain('45'); // … mais son Marchandage reste caché à l'ouverture
  });

  /**
   * #990 (arbitrage user 2026-07-30) : sur un Test opposé à jet figé, la rangée adverse est PRÉSENTE
   * dès l'ouverture et MASQUÉE jusqu'à ce que le répondant ait joué. Calendrier posé par la primitive
   * PARTAGÉE `opposedFrozen` — le Marchandage était le seul site à l'ignorer (rangée absente pré-jet).
   */
  it('PRÉ-JET : DEUX rangées, l’adversaire masqué (« ? ») — patron `frozenOpposedRow`', () => {
    const html = renderToStaticMarkup(
      <BargainModalView pb={base} fortune={0} onRoll={noop} onReroll={noop} onBonusSL={noop} onConfirm={noop} onCancel={noop} />,
    );
    expect(html.match(/class="rr-row /g)?.length).toBe(2); // 2 rangées AVANT tout jet
    expect(html).toContain('Caché jusqu’à votre jet'); // masque du CALENDRIER (`mask:'roll'`)…
    expect(html).not.toContain('Valeur de l’adversaire cachée'); // …strictement plus fort que `'value'`
  });

  /**
   * #1153 — l'écran doit annoncer la grandeur qui TRANCHE. `LDB 12 l.160` (verbatim `12 - Tests.md`) :
   * « Si les deux participants obtiennent le même DR, c'est le groupe avec la Compétence ou la
   * Caractéristique la plus élevée qui l'emporte. » La base AFFICHÉE est donc le Niveau de Compétence
   * NU (`LDB 09 l.17`) ; le Soutien (`LDB 12 l.187-200`) et l'État (`LDB 16`) sont des modificateurs
   * de la CIBLE, chacun sur sa ligne NOMMÉE. Somme : 55 + 10 − 10 = 55 = cible, aucun résidu « autres ».
   */
  it('base AFFICHÉE = la Compétence NUE, État et Soutien en chips nommées, cible invariante', () => {
    const negociateur: Combatant = {
      id: 'h', label: 'Maître d’armes', kind: 'hero', speciesId: 'humains-reiklander',
      characteristics: { sociabilite: 40 } as Combatant['characteristics'],
      skills: [{ id: 'marchandage', advances: 15 }], talents: [], items: [],
      conditions: [{ id: 'empoisonne', value: 1 }], advantage: 0,
      // Cas KO de la recette : DEUX postes distincts (État + mutation char-qualifiée) doivent se lire
      // chacun sur SA chip — c'est la mutation qui produisait le « −20 autres ».
      mutations: [(() => { const m = findMutationById('visage-inverse')!; return { id: m.id, label: m.label, desc: m.desc, kind: m.kind, roll: 1, passive: m.passive }; })()],
    } as unknown as Combatant;
    // Compétence NUE 55 (Soc 40 + 15 avances) ; Empoisonné −10 + Visage inversé −20 → Test 25 ; Soutien +10 → 35.
    expect(skillBaseValue(negociateur, 'marchandage')).toBe(55);
    expect(testValue(negociateur, 'marchandage')).toBe(25);
    const pb: PendingBargain = {
      ...base, playerSkill: 35, playerBase: 55, support: { count: 1, bonus: 10, ids: ['h2'] },
      roll: { roll: 20, target: 35, success: true, sl: 3, isDouble: false },
      merchantRoll: { roll: 60, target: 45, success: false, sl: -1, isDouble: false },
      result: {
        attacker: { roll: 20, target: 35, success: true, sl: 3, isDouble: false },
        defender: { roll: 60, target: 45, success: false, sl: -1, isDouble: false },
        winner: 'attacker', attackerWins: true, netSL: 4, decidedBy: 'dr',
      },
    };
    const html = renderToStaticMarkup(
      <BargainModalView pb={pb} actor={negociateur} fortune={0} onRoll={noop} onReroll={noop} onBonusSL={noop} onConfirm={noop} onCancel={noop} />,
    );
    // base NUE 55 + 10 (Soutien) − 10 (État) − 20 (mutation) = 35 = `playerSkill`, la cible INVARIANTE.
    expect(html).toContain('55 −20 = <b>35</b>');
    expect(html).toContain('+10 Soutien'); // chip nommée (LDB 12 l.187-200)
    expect(html).toContain('−10 Empoisonné'); // chip nommée par la DONNÉE (`etats.json`), pas par un `if`
    expect(html).toContain('−20 Visage inversé'); // …et par `mutations.json` : le cas KO de la recette
    expect(html).not.toContain('autres'); // rien d'anonyme : l'écart est ENTIÈREMENT nommé
    // Chaque chip est liée au Codex (`codex-ref`) : la règle/l'entité s'ouvre depuis la ligne.
    expect(html).toMatch(/class="codex-ref rm-mod pos"[^>]*>\+10 Soutien/);
    expect(html).toMatch(/class="codex-ref rm-mod neg"[^>]*>−10 Empoisonné/);
    expect(html).toMatch(/class="codex-ref rm-mod neg"[^>]*>−20 Visage inversé/);
  });

  it('après un jet gagné : verdict « Gagné » + bouton Conclure', () => {
    const pb: PendingBargain = {
      ...base,
      roll: { roll: 20, target: 50, success: true, sl: 3, isDouble: false },
      merchantRoll: { roll: 60, target: 45, success: false, sl: -1, isDouble: false },
      result: {
        attacker: { roll: 20, target: 50, success: true, sl: 3, isDouble: false },
        defender: { roll: 60, target: 45, success: false, sl: -1, isDouble: false },
        winner: 'attacker',
        attackerWins: true,
        netSL: 4,
        decidedBy: 'dr',
      },
    };
    const html = renderToStaticMarkup(
      <BargainModalView pb={pb} fortune={0} onRoll={noop} onReroll={noop} onBonusSL={noop} onConfirm={noop} onCancel={noop} />,
    );
    expect(html).toMatch(/Conclure/);
    expect(html).toContain('Gagné');
  });
});
