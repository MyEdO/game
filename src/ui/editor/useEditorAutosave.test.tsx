// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useEditorAutosave } from './useEditorAutosave';
import { autosaveSave, __setAutosaveBackendForTest, __resetAutosaveForTest, type EditorAutosaveBackend, type EditorAutosaveRecord, type RepriseLocale } from '../../state/editorAutosave';
import { emptyScene, type Scene } from '../../state/scene';
import { CURRENT_PROJECT_SCHEMA } from '../../state/worldMap';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function fakeBackend(): EditorAutosaveBackend & { store: Map<string, EditorAutosaveRecord> } {
  const store = new Map<string, EditorAutosaveRecord>();
  return {
    store,
    async get(sceneId) {
      return store.get(sceneId) ?? null;
    },
    async put(entry) {
      store.set(entry.sceneId, entry);
    },
    async delete(sceneId) {
      store.delete(sceneId);
    },
    async clear() {
      store.clear();
    },
  };
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

type Probe = {
  recovery: RepriseLocale | null;
  hasHiddenRecovery: boolean;
  restore: () => void;
  dismiss: () => void;
  hide: () => void;
  show: () => void;
};

/** Harnais minimal : expose l'état du hook sur `window.__probe` pour l'inspection depuis le test. */
function Harness({ scene, onRecovered }: { scene: Scene; onRecovered: (s: Scene) => void }) {
  const { recovery, hasHiddenRecovery, restore, dismiss, hide, show } = useEditorAutosave(scene, onRecovered);
  (window as unknown as { __probe: Probe }).__probe = { recovery, hasHiddenRecovery, restore, dismiss, hide, show };
  return null;
}

function probe(): Probe {
  return (window as unknown as { __probe: Probe }).__probe;
}

/** La scène que la reprise PROPOSE (montée au format courant) — rien si l'enregistrement est écarté. */
function proposee(): Scene | undefined {
  const r = probe().recovery;
  return r?.ok ? r.record.scene : undefined;
}

describe('useEditorAutosave — filet de crash de l’éditeur', () => {
  let container: HTMLDivElement;
  let root: Root;
  let backend: ReturnType<typeof fakeBackend>;

  beforeEach(async () => {
    await __resetAutosaveForTest();
    backend = fakeBackend();
    __setAutosaveBackendForTest(backend);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    __setAutosaveBackendForTest(null);
    delete (window as unknown as { __probe?: Probe }).__probe;
  });

  it('écrit une sauvegarde débattue après un changement de scène (pas à chaque frappe)', async () => {
    vi.useFakeTimers();
    try {
      const scene = { ...emptyScene(), id: 'scene-x', label: 'v1' };
      await act(async () => {
        root.render(<Harness scene={scene} onRecovered={() => {}} />);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0); // laisse la vérification de reprise (aucune sauvegarde existante) conclure
      });
      expect(backend.store.has('scene-x')).toBe(false); // rien avant le délai de débattue

      const scene2 = { ...scene, label: 'v2' };
      await act(async () => {
        root.render(<Harness scene={scene2} onRecovered={() => {}} />);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1600);
      });
      expect(backend.store.get('scene-x')?.scene.label).toBe('v2');
    } finally {
      vi.useRealTimers();
    }
  });

  it('propose une RESTAURATION (jamais un écrasement silencieux) quand une sauvegarde plus récente diverge de la scène chargée', async () => {
    await autosaveSave({ sceneId: 'scene-y', scene: { ...emptyScene(), id: 'scene-y', label: 'récupérée' }, savedAt: 999 });
    const scene = { ...emptyScene(), id: 'scene-y', label: 'source (non sauvegardée)' };
    let recovered: Scene | null = null;
    await act(async () => {
      root.render(<Harness scene={scene} onRecovered={(s) => { recovered = s; }} />);
    });
    await act(async () => {
      await flush();
    });
    expect(proposee()?.label).toBe('récupérée');

    // Tant que la reprise est proposée : AUCUNE écriture (la version à récupérer ne doit jamais
    // disparaître avant que l'utilisateur ait choisi — cf. doc du hook).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1700));
    });
    expect(backend.store.get('scene-y')?.scene.label).toBe('récupérée');

    await act(async () => {
      probe().restore();
    });
    expect(recovered).not.toBeNull();
    expect((recovered as unknown as Scene).label).toBe('récupérée');
    expect(probe().recovery).toBeNull();
  });

  it('une scène au format courant qui enfreint le schéma de scène est ÉCARTÉE et nommée : rien à restaurer', async () => {
    const { type: _muet, ...muette } = { ...emptyScene(), id: 'scene-muette', label: 'muette' };
    await autosaveSave({ sceneId: 'scene-muette', scene: muette as Scene, savedAt: 999 });
    let recovered: Scene | null = null;
    await act(async () => {
      root.render(<Harness scene={{ ...emptyScene(), id: 'scene-muette', label: 'en cours' }} onRecovered={(s) => { recovered = s; }} />);
    });
    await act(async () => { await flush(); });
    const r = probe().recovery;
    expect(r && !r.ok ? r.refus.fautes.map((f) => [f.chemin, f.code]) : null).toEqual([[['type'], 'invalid_value']]);
    await act(async () => { probe().restore(); });
    expect(recovered).toBeNull();
  });

  it('une FAUTE DU JEU à la relecture se propage (rejet non géré) et ne coupe pas l’écriture débattue', async () => {
    vi.useFakeTimers();
    const nonGerees: unknown[] = [];
    const capter = (raison: unknown): void => { nonGerees.push(raison); };
    process.on('unhandledRejection', capter);
    // Un enregistrement dont la LECTURE lève autre chose qu'un `ProjetRefuse` : la relecture rejette.
    // Posé sur le backend du test, jamais par mock de module (`src/vi-mock-isolate-guard.test.ts`).
    const piege = { sceneId: 'scene-faute', schema: CURRENT_PROJECT_SCHEMA, savedAt: 1 } as unknown as EditorAutosaveRecord;
    Object.defineProperty(piege, 'scene', { enumerable: true, get() { throw new Error('faute du jeu'); } });
    backend.store.set('scene-faute', piege);
    try {
      const scene = { ...emptyScene(), id: 'scene-faute', label: 'v1' };
      await act(async () => {
        root.render(<Harness scene={scene} onRecovered={() => {}} />);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(probe().recovery, 'la relecture a levé : rien à proposer, rien ne suspend l’écriture').toBeNull();
      await act(async () => {
        root.render(<Harness scene={{ ...scene, label: 'v2' }} onRecovered={() => {}} />);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1600);
      });
      const ecrit = backend.store.get('scene-faute');
      expect(ecrit === piege, 'le filet doit écrire malgré la faute').toBe(false);
      expect(ecrit?.scene.label).toBe('v2');
      vi.useRealTimers();
      for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
      expect(nonGerees.map((e) => (e as Error).message)).toEqual(['faute du jeu']);
    } finally {
      process.off('unhandledRejection', capter);
      vi.useRealTimers();
    }
  });

  it('un enregistrement au format 15 qui cite un sort FUSIONNÉ (#1897) est restauré remappé, par la chaîne du projet', async () => {
    const scene15 = {
      ...emptyScene(), id: 'scene-15', label: 'crypte',
      entities: [
        { id: 'sorcier', kind: 'personnage', pos: { x: 0, y: 0 }, statblock: { type: 'statblock', label: 'Sorcier', char: {}, spells: ['alarme', 'flamme'] }, combat: { spells: ['alarme'] } },
        { id: 'autel', kind: 'prop', ref: 'tonneau', pos: { x: 1, y: 0 }, usable: { actions: [{ id: 'prier', flow: { kind: 'seq', steps: [
          { kind: 'do', effect: { type: 'learnSpell', spell: 'alarme' } },
          { kind: 'do', effect: { type: 'castSpell', casterId: 'sorcier', spellId: 'projectile' } },
        ] } }] } },
      ],
    } as unknown as Scene;
    backend.store.set('scene-15', { sceneId: 'scene-15', scene: scene15, schema: 15, savedAt: 999 } as unknown as EditorAutosaveRecord);
    let recovered: Scene | null = null;
    await act(async () => {
      root.render(<Harness scene={{ ...emptyScene(), id: 'scene-15', label: 'en cours' }} onRecovered={(s) => { recovered = s; }} />);
    });
    await act(async () => { await flush(); });
    await act(async () => { probe().restore(); });
    const [sorcier, autel] = (recovered as unknown as { entities: Record<string, any>[] }).entities;
    expect(sorcier.statblock.spells).toEqual(['alerte', 'flamme-magique']);
    expect(sorcier.combat.spells).toEqual(['alerte']);
    expect(autel.usable.actions[0].flow.steps.map((st: { effect: unknown }) => st.effect)).toEqual([
      { type: 'learnSpell', spell: 'alerte' },
      { type: 'castSpell', casterId: 'sorcier', spellId: 'carreau' },
    ]);
  });

  it('un enregistrement SANS marqueur de format est ÉCARTÉ et nommé : rien à restaurer, l’auteur le supprime', async () => {
    backend.store.set('scene-sans-format', { sceneId: 'scene-sans-format', scene: { ...emptyScene(), id: 'scene-sans-format', label: 'ancienne' }, savedAt: 999 } as unknown as EditorAutosaveRecord);
    let recovered: Scene | null = null;
    await act(async () => {
      root.render(<Harness scene={{ ...emptyScene(), id: 'scene-sans-format', label: 'en cours' }} onRecovered={(s) => { recovered = s; }} />);
    });
    await act(async () => { await flush(); });
    const r = probe().recovery;
    expect(r && !r.ok ? r.refus.fautes.map((f) => [f.chemin, f.message]) : null).toEqual([[['schema'], '« schema » absent ou non numérique (schema=undefined)']]);
    await act(async () => { probe().restore(); });
    expect(recovered).toBeNull();
    await act(async () => { probe().dismiss(); });
    expect(backend.store.has('scene-sans-format')).toBe(false);
  });

  it('ignorer une reprise proposée supprime la sauvegarde locale et ne restaure rien', async () => {
    await autosaveSave({ sceneId: 'scene-z', scene: { ...emptyScene(), id: 'scene-z', label: 'ancienne' }, savedAt: 1 });
    const scene = { ...emptyScene(), id: 'scene-z', label: 'actuelle' };
    let recovered: Scene | null = null;
    await act(async () => {
      root.render(<Harness scene={scene} onRecovered={(s) => { recovered = s; }} />);
    });
    await act(async () => {
      await flush();
    });
    await act(async () => {
      probe().dismiss();
    });
    expect(recovered).toBeNull();
    expect(backend.store.has('scene-z')).toBe(false);
  });

  it('deux scènes identiques (aucune divergence) ne proposent pas de reprise', async () => {
    const scene: Scene = { ...emptyScene(), id: 'scene-w', label: 'même contenu' };
    await autosaveSave({ sceneId: 'scene-w', scene, savedAt: 1 });
    await act(async () => {
      root.render(<Harness scene={scene} onRecovered={() => {}} />);
    });
    await act(async () => {
      await flush();
    });
    expect(probe().recovery).toBeNull();
  });

  it('#834 pt. A — masquer la proposition (`hide`, l’équivalent d’Échap) ne détruit RIEN : elle revient avec `show`', async () => {
    await autosaveSave({ sceneId: 'scene-hide', scene: { ...emptyScene(), id: 'scene-hide', label: 'récupérée' }, savedAt: 999 });
    const scene = { ...emptyScene(), id: 'scene-hide', label: 'chargée' };
    await act(async () => {
      root.render(<Harness scene={scene} onRecovered={() => {}} />);
    });
    await act(async () => {
      await flush();
    });
    expect(proposee()?.label).toBe('récupérée');

    await act(async () => {
      probe().hide();
    });
    // Masquée : la modale n'a plus lieu d'être affichée, mais RIEN n'est supprimé du backend, et la
    // proposition reste accessible (elle « peut revenir »).
    expect(probe().recovery).toBeNull();
    expect(probe().hasHiddenRecovery).toBe(true);
    expect(backend.store.has('scene-hide')).toBe(true);

    await act(async () => {
      probe().show();
    });
    expect(proposee()?.label).toBe('récupérée');
    expect(probe().hasHiddenRecovery).toBe(false);
    expect(backend.store.has('scene-hide')).toBe(true);
  });

  it('#834 audit-2 DÉFAUT 1 — hide() ne gèle plus l’écriture : le travail fait APRÈS un hide est protégé', async () => {
    vi.useFakeTimers();
    try {
      await autosaveSave({ sceneId: 'scene-hide-work', scene: { ...emptyScene(), id: 'scene-hide-work', label: 'vieille-recup' }, savedAt: 999 });
      const scene = { ...emptyScene(), id: 'scene-hide-work', label: 'chargée' };
      await act(async () => {
        root.render(<Harness scene={scene} onRecovered={() => {}} />);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(proposee()?.label).toBe('vieille-recup');

      await act(async () => {
        probe().hide();
      });

      const worked = { ...scene, label: 'DEUX HEURES DE TRAVAIL' };
      await act(async () => {
        root.render(<Harness scene={worked} onRecovered={() => {}} />);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1600);
      });

      expect(backend.store.get('scene-hide-work')?.scene.label).toBe('DEUX HEURES DE TRAVAIL');
    } finally {
      vi.useRealTimers();
    }
  });

  it('#834 audit-2 DÉFAUT 3 — une bascule de scène ÉCRIT la scène QUITTÉE avant de vérifier la nouvelle', async () => {
    vi.useFakeTimers();
    try {
      const sceneA = { ...emptyScene(), id: 'scene-switch-a', label: 'v0' };
      await act(async () => {
        root.render(<Harness scene={sceneA} onRecovered={() => {}} />);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0); // laisse la vérification de reprise conclure pour A
      });

      const sceneADirty = { ...sceneA, label: 'v1-avant-bascule' };
      await act(async () => {
        root.render(<Harness scene={sceneADirty} onRecovered={() => {}} />);
      });
      // AUCUNE pause de 1,5 s ici — la bascule survient AVANT que la débattue n'ait écrit A.
      const sceneB = { ...emptyScene(), id: 'scene-switch-b', label: 'B' };
      await act(async () => {
        root.render(<Harness scene={sceneB} onRecovered={() => {}} />);
      });

      expect(backend.store.get('scene-switch-a')?.scene.label).toBe('v1-avant-bascule');
    } finally {
      vi.useRealTimers();
    }
  });

  it('#834 pt. C — un tracé CONTINU (jamais 1,5 s de pause) écrit quand même, plafonné par MAX_WAIT_MS', async () => {
    vi.useFakeTimers();
    try {
      const scene = { ...emptyScene(), id: 'scene-continu', label: 'v0' };
      await act(async () => {
        root.render(<Harness scene={scene} onRecovered={() => {}} />);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      // Une frappe toutes les 1000 ms (jamais de pause de 1,5 s) réarmerait indéfiniment une simple
      // débattue — le plafond (5000 ms) force l'écriture malgré tout.
      for (let i = 1; i <= 6; i++) {
        const next = { ...scene, label: `v${i}` };
        await act(async () => {
          root.render(<Harness scene={next} onRecovered={() => {}} />);
        });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
      }
      expect(backend.store.has('scene-continu')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('#834 pt. C — flush au DÉMONTAGE : un crash de rendu ne jette pas la modification en attente', async () => {
    vi.useFakeTimers();
    try {
      const scene = { ...emptyScene(), id: 'scene-unmount', label: 'v0' };
      await act(async () => {
        root.render(<Harness scene={scene} onRecovered={() => {}} />);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0); // laisse la vérification de reprise conclure
      });
      expect(backend.store.has('scene-unmount')).toBe(false);

      const dirty = { ...scene, label: 'v1-en-vol' };
      await act(async () => {
        root.render(<Harness scene={dirty} onRecovered={() => {}} />);
      });
      // Démontage AVANT la fin de la débattue (1500 ms) — le filet ne doit rien jeter.
      await act(async () => {
        root.unmount();
      });
      expect(backend.store.get('scene-unmount')?.scene.label).toBe('v1-en-vol');
    } finally {
      vi.useRealTimers();
      // Le root est déjà démonté par ce test : `afterEach` ré-appelle `unmount()`, no-op sur un root démonté.
    }
  });

  it('#834 pt. C — flush sur `pagehide` : fermeture d’onglet/navigation, pas d’attente de 1,5 s', async () => {
    vi.useFakeTimers();
    try {
      const scene = { ...emptyScene(), id: 'scene-pagehide', label: 'v0' };
      await act(async () => {
        root.render(<Harness scene={scene} onRecovered={() => {}} />);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const dirty = { ...scene, label: 'v1-avant-fermeture' };
      await act(async () => {
        root.render(<Harness scene={dirty} onRecovered={() => {}} />);
      });
      expect(backend.store.has('scene-pagehide')).toBe(false);
      await act(async () => {
        window.dispatchEvent(new Event('pagehide'));
      });
      expect(backend.store.get('scene-pagehide')?.scene.label).toBe('v1-avant-fermeture');
    } finally {
      vi.useRealTimers();
    }
  });
});
