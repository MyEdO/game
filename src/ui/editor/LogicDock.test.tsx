import { flowFromEffects } from '../../state/flow';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyScene } from '../../state/scene';
import { LogicDock } from './LogicDock';
import { wallSideSchema } from '../../data/schemas/defs-scenes/communs';
import { effectSummary } from './EffectList';
import { CIBLES_D_EFFET_DE_SCENE } from '../../state/combatEffects';

const SCENE = { cibles: CIBLES_D_EFFET_DE_SCENE };

function dock(overrides: Partial<Parameters<typeof LogicDock>[0]>) {
  const scene = emptyScene(10, 10);
  return (
    <LogicDock
      scene={scene}
      otherScenes={[]}
      worldMap={null}
      setScene={vi.fn()}
      warnings={[]}
      onSelectWarning={vi.fn()}
      tab="triggers"
      setTab={vi.fn()}
      height={300}
      setHeight={vi.fn()}
      trigSel={null}
      setTrigSel={vi.fn()}
      dlgSel={null}
      setDlgSel={vi.fn()}
      encSel={null}
      setEncSel={vi.fn()}
      onSelectEntity={vi.fn()}
      currentLayer={0}
      {...overrides}
    />
  );
}

describe('LogicDock — onglet Rencontres (remplace la modale EncountersEditor)', () => {
  it('affiche les récompenses de victoire (onVictory) de la rencontre sélectionnée', () => {
    const scene = emptyScene(10, 10);
    scene.encounters = [{ id: 'e1', members: [], onVictory: flowFromEffects([{ type: 'giveXp', amount: 20 }]) }];
    const html = renderToStaticMarkup(dock({ scene, tab: 'encounters', encSel: 'e1' }));
    expect(html).toContain('À la victoire'); // section de récompenses
    expect(html).toContain('Donner des PX'); // l'option giveXp du constructeur d'effets
    expect(html).toContain('value="20"'); // le montant câblé à onVictory
    expect(html).toContain('Surprise (embuscade, LDB 13)');
  });

  it('le select d’arête de la condition « détruire une structure » offre EXACTEMENT les côtés du canon', () => {
    // Les `<option>` sont DÉRIVÉES de `wallSideSchema.options` (#1440) : sans contrat positif, un canon
    // vidé rendrait un select MUET sans qu'aucun rouge ne sorte.
    const scene = emptyScene(10, 10);
    scene.encounters = [{ id: 'e1', members: [], victoryCondition: { type: 'destroyStructure', edge: { x: 2, y: 3, side: '\\' } } }];
    const html = renderToStaticMarkup(dock({ scene, tab: 'encounters', encSel: 'e1' }));
    const bloc = html.slice(html.indexOf('Arête'));
    const options = [...bloc.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]).slice(0, wallSideSchema.options.length);
    expect(options, 'les options du select d’arête ≠ les côtés du canon').toEqual([...wallSideSchema.options]);
    expect(bloc).toContain('selected'); // le côté STOCKÉ est bien l'option retenue
  });
});

describe('LogicDock — onglet Triggers (master-détail, édition LIVE)', () => {
  it('liste les triggers et édite le sélectionné (rect + condition + effets)', () => {
    const scene = emptyScene(10, 10);
    scene.triggers = [
      { id: 'trig-porte', rect: { x: 1, y: 2, w: 3, h: 1 }, once: true, when: { kind: 'flag', expr: 'cle' }, flow: flowFromEffects([{ type: 'journal', desc: 'La porte grince' }]) },
    ];
    const html = renderToStaticMarkup(dock({ scene, tab: 'triggers', trigSel: 'trig-porte' }));
    expect(html).toContain('trig-porte');
    expect(html).toContain('Au déclenchement'); // éditeur de Flow (effets · conditions · tests)
    expect(html).toContain('La porte grince');
  });
});

describe('LogicDock — onglet Dialogues (master-détail de nœuds)', () => {
  it('affiche le détail du dialogue sélectionné, un nœud à la fois', () => {
    const scene = emptyScene(10, 10);
    scene.dialogues = [
      {
        id: 'dlg-forgeron',
        start: 'n1',
        nodes: [
          { id: 'n1', desc: 'Bonjour voyageur', choices: [{ label: 'Au revoir', next: 'n2' }] },
          { id: 'n2', desc: 'Bonne route', choices: [] },
        ],
      },
    ];
    const html = renderToStaticMarkup(dock({ scene, tab: 'dialogues', dlgSel: 'dlg-forgeron' }));
    expect(html).toContain('dlg-forgeron');
    expect(html).toContain('Bonjour voyageur'); // le nœud de départ est édité
    expect(html).toContain('Au revoir'); // résumé du choix replié
    expect(html).toContain('→ n2'); // cible du choix
  });
});

describe('effectSummary — résumés humains des rangées repliées', () => {
  it('résume les effets courants en clair', () => {
    expect(effectSummary({ type: 'giveXp', amount: 50 }, SCENE)).toContain('50 PX');
    expect(effectSummary({ type: 'startCombat', encounter: 'enc-rats' }, SCENE)).toContain('enc-rats');
    expect(effectSummary({ type: 'setFlag', flag: 'porte_ouverte', value: true }, SCENE)).toContain('porte_ouverte');
    expect(effectSummary({ type: 'giveMoney', montant: { gold: 2, silver: 5, brass: 0 } }, SCENE)).toBe('Argent : 2 CO 5/–');
    expect(
      effectSummary({ type: 'transition', scene: 'sc-b', entry: 'porte' }, { ...SCENE, scenes: [{ id: 'sc-b', nom: 'Taverne', entries: ['porte'] }] }),
    ).toContain('Taverne');
    expect(effectSummary({ type: 'extendedTest', skill: { id: 'crochetage' }, label: 'Serrure', targetDR: 5 }, SCENE)).toContain('Crochetage');
  });
});
