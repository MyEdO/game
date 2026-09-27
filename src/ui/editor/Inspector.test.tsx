// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { Inspector } from './Inspector';
import { emptyScene, type Scene, type SceneEntity } from '../../state/scene';
import { lightTones } from '../../data';
import { valeursDe } from '../../data/schemas/grammaire/meta';
import { facadeFeatureKindSchema, roofProfileSchema } from '../../data/schemas/defs-scenes/scene';
import type { Sel } from './editorState';
import { validateScene } from '../../state/validateScene';
import { hairstylesForSex } from '../../gameIso/rig/parts/hairstyles';
import { MISSING_TONE } from '../../gameIso/rig/viewArt';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(demonterRacines);

/** Harnais minimal : monte l'`Inspector` sur une scène à UNE entité sélectionnée, capture chaque
 *  `setScene` dans `latest` — assez pour vérifier qu'une saisie ATTERRIT dans la Scène, et qu'elle
 *  SURVIT à un aller-retour JSON (le Schéma de Scène est de la donnée pure, aucune sérialisation
 *  dédiée — `JSON.parse(JSON.stringify(...))` EST le round-trip sauvegarde/chargement, #841). */
function mount(entity: SceneEntity) {
  const scene: Scene = { ...emptyScene(4, 4), entities: [entity] };
  let latest = scene;
  const montage = monterRacine(null);
  const render = (s: Scene) => {
    montage.rendre(
      <Inspector
        scene={s}
        otherScenes={[]}
        worldMap={null}
        setScene={(next) => {
          latest = next;
          render(next);
        }}
        sel={{ type: 'entity', id: entity.id }}
        setSel={() => undefined}
        enemyCreatures={[{ id: 'humain', label: 'Humain' }]}
        openLogic={() => undefined}
        resizeScene={() => undefined}
        narratif={{ affaires: [], indices: [], presetsPnj: [{ id: 'preset-tavernier', profil: { label: 'Le Tavernier' } }], objets: [] }}
        tool={{ mode: 'select' }}
        armZoneTiles={() => undefined}
        zoneFocusKey={null}
      />,
    );
  };
  return {
    container: montage.container,
    mount: () => act(() => render(scene)),
    entOf: () => latest.entities[0],
    sceneOf: () => latest,
  };
}

function roundTrip(scene: Scene): Scene {
  return JSON.parse(JSON.stringify(scene)) as Scene;
}

describe('Inspector — apparence visuelle des murs', () => {
  it('conserve la structure mécanique quand une apparence est choisie et sérialisée', async () => {
    const scene: Scene = {
      ...emptyScene(4, 4),
      walls: [{ x: 1, y: 1, side: 'E', structure: 'mur-a-ossature-en-bois' }],
    };
    let latest = scene;
    const montage = monterRacine(null);
    const render = (next: Scene) => montage.rendre(
      <Inspector
        scene={next}
        otherScenes={[]}
        worldMap={null}
        setScene={(updated) => {
          latest = updated;
          render(updated);
        }}
        sel={{ type: 'wall', x: 1, y: 1, side: 'E', z: 0 }}
        setSel={() => undefined}
        enemyCreatures={[]}
        openLogic={() => undefined}
        resizeScene={() => undefined}
        narratif={{ affaires: [], indices: [], presetsPnj: [], objets: [] }}
        tool={{ mode: 'select' }}
        armZoneTiles={() => undefined}
        zoneFocusKey={null}
      />,
    );
    await act(() => render(scene));

    const appearance = Array.from(montage.container.querySelectorAll('select'))
      .find((el) => el.closest('label')?.textContent?.includes('Apparence visuelle')) as HTMLSelectElement;
    expect(appearance).toBeTruthy();
    await act(async () => {
      appearance.value = 'cloison-basse-a-ossature-en-bois';
      appearance.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(latest.walls?.[0]).toEqual({
      x: 1,
      y: 1,
      side: 'E',
      structure: 'mur-a-ossature-en-bois',
      appearance: 'cloison-basse-a-ossature-en-bois',
    });
    expect(roundTrip(latest).walls?.[0]).toEqual(latest.walls?.[0]);
  });
});

describe('Inspector — l’empreinte d’un décor n’est plus une propriété d’instance', () => {
  it('l’empreinte est ANNONCÉE, jamais saisie ; changer de ref ne pose rien sur l’entité', async () => {
    const h = mount({ id: 'p', kind: 'prop', pos: { x: 0, y: 0 }, ref: 'tonneau' });
    await h.mount();

    // Annoncée : un tonneau tient sur sa case. Et AUCUN contrôle ne la saisit — l'empreinte se dérive
    // du type (corps tourné pour une recette, `foot` déclaré pour un billboard), elle ne s'édite pas.
    const ligne = Array.from(h.container.querySelectorAll('p'))
      .find((el) => el.textContent?.startsWith('Empreinte')) as HTMLParagraphElement;
    expect(ligne.textContent).toBe('Empreinte 1×1 (0, 0)');
    expect(ligne.querySelectorAll('input, select')).toHaveLength(0);

    const select = Array.from(h.container.querySelectorAll('select'))
      .find((el) => el.closest('label')?.textContent?.includes('Décor')) as HTMLSelectElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'tribune');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(h.entOf().ref).toBe('tribune');
    expect(h.entOf()).not.toHaveProperty('foot');
  });

  /**
   * CE QUE LE SÉLECTEUR DIT EST CE QUE LA DONNÉE PORTE (#877) — « Rien en dure, pas de fallback ».
   * Un `<select>` sans valeur correspondant à une option AFFICHE la première du catalogue : l'auteur
   * lirait « Abreuvoir » là où l'instance ne nomme aucun type, ou nomme un type disparu. L'inspecteur
   * annonce donc l'ÉTAT, du même constat que `state/validateScene.ts`, et sur une option non élisible.
   */
  const selecteurDeDecor = (container: HTMLElement): HTMLSelectElement =>
    Array.from(container.querySelectorAll('select'))
      .find((el) => el.closest('label')?.textContent?.includes('Décor')) as HTMLSelectElement;

  it('un décor SANS type l’annonce dans le sélecteur, sur une option non élisible', async () => {
    const h = mount({ id: 'nu', kind: 'prop', pos: { x: 0, y: 0 } });
    await h.mount();

    const select = selecteurDeDecor(h.container);
    const affichee = select.options[select.selectedIndex];
    expect(affichee.textContent).toBe('Décor sans type — choisis-en un');
    expect(affichee.disabled).toBe(true);
    // Et rien n'a été écrit sur l'entité : afficher un état n'est pas élire un type.
    expect(h.entOf()).not.toHaveProperty('ref');
  });

  it('un décor à type DISPARU du catalogue nomme l’id fautif, au lieu d’emprunter un autre décor', async () => {
    const h = mount({ id: 'mort', kind: 'prop', pos: { x: 0, y: 0 }, ref: 'tonneau-imaginaire' });
    await h.mount();

    const affichee = selecteurDeDecor(h.container).options[selecteurDeDecor(h.container).selectedIndex];
    expect(affichee.textContent).toBe('Décor inexistant « tonneau-imaginaire »');
    expect(affichee.disabled).toBe(true);
    expect(h.entOf().ref).toBe('tonneau-imaginaire');
  });

  /**
   * RECETTE NAVIGATEUR du 2026-09-21 : un `<option>` natif est TRONQUÉ à la largeur du champ
   * (« Décor inexistant « tonneau-imagi… »), or l'id fautif EST l'information à corriger. L'état se
   * relit donc ENTIER hors du sélecteur — le contrat porte sur ce qui est LISIBLE, pas sur l'option.
   */
  it('l’id fautif se relit ENTIER hors du sélecteur (alerte) et au survol (title)', async () => {
    const id = 'tonneau-imaginaire-au-nom-tres-long-que-le-champ-coupe';
    const h = mount({ id: 'mort', kind: 'prop', pos: { x: 0, y: 0 }, ref: id });
    await h.mount();

    const alerte = h.container.querySelector('[role="alert"]') as HTMLElement;
    expect(alerte.textContent).toBe(`Décor inexistant « ${id} »`);
    expect(selecteurDeDecor(h.container).title).toBe(`Décor inexistant « ${id} »`);
  });

  it('un décor au type RÉSOLU ne porte ni alerte ni title — l’état ne se dit que quand il existe', async () => {
    const h = mount({ id: 'sain', kind: 'prop', pos: { x: 0, y: 0 }, ref: 'tonneau' });
    await h.mount();

    expect(h.container.querySelector('[role="alert"]')).toBeNull();
    expect(selecteurDeDecor(h.container).title).toBe('');
  });

  it('depuis cet état, élire un type l’ÉCRIT sur l’instance et l’état disparaît', async () => {
    const h = mount({ id: 'nu', kind: 'prop', pos: { x: 0, y: 0 } });
    await h.mount();

    const select = selecteurDeDecor(h.container);
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'tonneau');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(h.entOf().ref).toBe('tonneau');
    const apres = selecteurDeDecor(h.container);
    expect(apres.options[apres.selectedIndex].textContent).toBe('Tonneau');
    expect(Array.from(apres.options).some((o) => o.disabled)).toBe(false);
  });

  /**
   * L'INSTANCE tient un cap, donc l'inspecteur annonce l'empreinte AU CAP RÉEL (#1509 L7′) : la même
   * `table-2x1` occupe deux cases en x au sud, deux en y à l'est, et ses cases suivent le changement
   * d'orientation fait dans le même volet. La PALETTE, elle, n'a pas d'instance : elle annonce au cap
   * d'identité (`Palette.tsx`).
   */
  it('annonce l’empreinte au CAP RÉEL de l’instance, et ses cases suivent le changement de cap', async () => {
    const h = mount({ id: 'longue', kind: 'prop', pos: { x: 1, y: 2 }, ref: 'table-2x1', facing: 'S' });
    await h.mount();

    const ligne = () => (Array.from(h.container.querySelectorAll('p'))
      .find((el) => el.textContent?.startsWith('Empreinte')) as HTMLParagraphElement).textContent;
    expect(ligne()).toBe('Empreinte 2×1 (1, 2) (2, 2)');

    const orientation = Array.from(h.container.querySelectorAll('select'))
      .find((el) => el.closest('label')?.textContent?.includes('Orientation')) as HTMLSelectElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(orientation, 'E');
      orientation.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(h.entOf().facing).toBe('E');
    expect(ligne()).toBe('Empreinte 1×2 (1, 2) (1, 3)');
  });

  /** La table MURALE a rejoint les meubles à deux cases par ré-authoring de ses cotes (#1509 L9′,
   *  fait utilisateur du 2026-08-31) : contre un mur, au cap E, elle occupe 1×2. */
  it('la table murale annonce 2×1 au sud et 1×2 à l’est', async () => {
    const h = mount({ id: 'murale', kind: 'prop', pos: { x: 0, y: 0 }, ref: 'table-murale-2-tabourets', facing: 'S' });
    await h.mount();
    const ligne = () => (Array.from(h.container.querySelectorAll('p'))
      .find((el) => el.textContent?.startsWith('Empreinte')) as HTMLParagraphElement).textContent;
    expect(ligne()).toBe('Empreinte 2×1 (0, 0) (1, 0)');

    const orientation = Array.from(h.container.querySelectorAll('select'))
      .find((el) => el.closest('label')?.textContent?.includes('Orientation')) as HTMLSelectElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(orientation, 'E');
      orientation.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(ligne()).toBe('Empreinte 1×2 (0, 0) (0, 1)');
  });
});

describe('Inspector — champs FU-E de l’instance d’entité (#841)', () => {
  it('light.radiusM : la case + le rayon atterrissent dans la Scène et survivent au round-trip', async () => {
    const h = mount({ id: 'lanterne', kind: 'prop', pos: { x: 0, y: 0 }, ref: 'tonneau' });
    await h.mount();

    const checkbox = Array.from(h.container.querySelectorAll('input[type="checkbox"]'))
      .find((el) => el.closest('label')?.textContent?.includes('Source de lumière')) as HTMLInputElement;
    await act(async () => {
      checkbox.click();
    });
    expect(h.entOf().light).toEqual({ radiusM: 6 });

    const radiusInput = Array.from(h.container.querySelectorAll('input[type="number"]'))
      .find((el) => el.closest('label')?.textContent?.includes("Rayon d'éclairage")) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(radiusInput, '6');
      radiusInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(h.entOf().light).toEqual({ radiusM: 6 });
    expect(roundTrip(h.sceneOf()).entities[0].light).toEqual({ radiusM: 6 });
  });

  it('light.tone : le ton d’instance SURVIT au rayon, s’élit/se retire, et survit au round-trip', async () => {
    const h = mount({ id: 'brasero', kind: 'prop', pos: { x: 0, y: 0 }, ref: 'tonneau', light: { radiusM: 4, tone: 'lanterne' } });
    await h.mount();

    // (1) régler le rayon ne DÉTRUIT pas le ton posé (l’objet `light` se patche, il ne se remplace pas).
    const radiusInput = Array.from(h.container.querySelectorAll('input[type="number"]'))
      .find((el) => el.closest('label')?.textContent?.includes("Rayon d'éclairage")) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(radiusInput, '6');
      radiusInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(h.entOf().light).toEqual({ radiusM: 6, tone: 'lanterne' });

    // (2) le ton est ÉLISABLE dans le catalogue, et retirable (hérité du type de décor).
    const toneSelect = Array.from(h.container.querySelectorAll('select'))
      .find((el) => el.closest('label')?.textContent?.includes('Ton de la lumière')) as HTMLSelectElement;
    expect(toneSelect.value).toBe('lanterne');
    expect(Array.from(toneSelect.options).map((o) => o.value)).toEqual(['', ...lightTones.map((t) => t.id)]);

    await act(async () => {
      toneSelect.value = 'chandelle';
      toneSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(h.entOf().light).toEqual({ radiusM: 6, tone: 'chandelle' });
    expect(roundTrip(h.sceneOf()).entities[0].light).toEqual({ radiusM: 6, tone: 'chandelle' });

    await act(async () => {
      toneSelect.value = '';
      toneSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(h.entOf().light).toEqual({ radiusM: 6 });
    expect(roundTrip(h.sceneOf()).entities[0].light).toEqual({ radiusM: 6 });
  });

  it('combat.skills[] : une compétence ajoutée atterrit dans la Scène et survit au round-trip', async () => {
    const h = mount({ id: 'brigand', kind: 'personnage', pos: { x: 0, y: 0 }, ref: 'humain' });
    await h.mount();

    const addSkill = Array.from(h.container.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('+ Ajouter') && b.closest('.ed-field')?.textContent?.includes('Compétences ajoutées')) as HTMLButtonElement;
    await act(async () => {
      addSkill.click();
    });
    expect(h.entOf().combat?.skills).toHaveLength(1);
    expect(h.entOf().combat!.skills![0].id).toBe(''); // réf NON élue à la création — l'auteur choisit
    expect(roundTrip(h.sceneOf()).entities[0].combat?.skills).toEqual(h.entOf().combat!.skills);
  });

  it('presetId : le choix atterrit dans la Scène et survit au round-trip (picker BORNÉ, jamais un texte libre — #834 audit-2 défaut 7)', async () => {
    const h = mount({ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 } });
    await h.mount();

    const select = Array.from(h.container.querySelectorAll('select'))
      .find((el) => el.closest('label')?.textContent?.includes('Preset PNJ')) as HTMLSelectElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'preset-tavernier');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(h.entOf().presetId).toBe('preset-tavernier');
    expect(roundTrip(h.sceneOf()).entities[0].presetId).toBe('preset-tavernier');
  });

  it('upgrades[] : une amélioration navale ajoutée atterrit dans la Scène et survit au round-trip', async () => {
    const h = mount({ id: 'coque', kind: 'prop', pos: { x: 0, y: 0 }, ref: 'cogue', postes: [{ trappingId: 'canon' }] });
    await h.mount();

    const addUpgrade = Array.from(h.container.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('+ Ajouter') && b.closest('.ed-field')?.textContent?.includes("Améliorations d'instance")) as HTMLButtonElement;
    await act(async () => {
      addUpgrade.click();
    });
    expect(h.entOf().upgrades).toHaveLength(1);
    expect(h.entOf().upgrades![0].id).toBe(''); // réf NON élue à la création — l'auteur choisit
    expect(roundTrip(h.sceneOf()).entities[0].upgrades).toEqual(h.entOf().upgrades);
  });

  it('upgrades[] : authorable sur une coque SANS emplacement d’artillerie (Blindage/Lissage seuls, MDG 12 — #834 audit-2 défaut 8)', async () => {
    const h = mount({ id: 'coque-nue', kind: 'prop', pos: { x: 0, y: 0 }, ref: 'cogue' }); // pas de `postes`
    await h.mount();

    expect(h.container.textContent).toContain('Emplacement de siège');
    const addUpgrade = Array.from(h.container.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('+ Ajouter') && b.closest('.ed-field')?.textContent?.includes("Améliorations d'instance")) as HTMLButtonElement;
    await act(async () => {
      addUpgrade.click();
    });
    expect(h.entOf().upgrades).toHaveLength(1);
    expect(roundTrip(h.sceneOf()).entities[0].upgrades).toEqual(h.entOf().upgrades);
  });
});

describe('Inspector — l’identifiant affiché est celui de la zone SÉLECTIONNÉE', () => {
  /** Deux zones d'effet et une sélection PILOTÉE : rejouer le geste « je clique l'une, puis l'autre ». */
  function mountZones() {
    const scene: Scene = {
      ...emptyScene(8, 8),
      effectZones: [
        { id: 'zone-V-z0', label: 'Passage couvert', presentation: 'interior', area: { kind: 'rect', x: 0, y: 0, w: 2, h: 2 }, z: 0 },
        { id: 'zone-X-z1', label: 'Galerie', presentation: 'interior', area: { kind: 'rect', x: 4, y: 4, w: 2, h: 2 }, z: 0 },
      ],
    };
    const { container, rendre } = monterRacine(null);
    const render = (idx: number, zoneFocusKey: string | null = null) =>
      rendre(
        <Inspector
          scene={scene}
          otherScenes={[]}
          worldMap={null}
          setScene={() => undefined}
          sel={{ type: 'effectZone', idx }}
          setSel={() => undefined}
          enemyCreatures={[]}
          openLogic={() => undefined}
          resizeScene={() => undefined}
          narratif={{ affaires: [], indices: [], presetsPnj: [], objets: [] }}
          tool={{ mode: 'select' }}
          armZoneTiles={() => undefined}
          zoneFocusKey={zoneFocusKey}
        />,
      );
    const champ = (libelle: string) =>
      (Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.includes(libelle))?.querySelector('input') as HTMLInputElement | null);
    return {
      container,
      select: (idx: number, zoneFocusKey: string | null = null) => act(() => render(idx, zoneFocusKey)),
      champ,
    };
  }

  it('après un changement de sélection, Identifiant et Nom affichent la NOUVELLE zone', async () => {
    const h = mountZones();
    await h.select(0);
    expect(h.champ('Identifiant')?.value).toBe('zone-V-z0');
    expect(h.champ('Nom')?.value).toBe('Passage couvert');

    await h.select(1);
    expect(h.champ('Identifiant')?.value).toBe('zone-X-z1');
    expect(h.champ('Nom')?.value).toBe('Galerie');
  });

  it('la saisie en cours sur la MÊME zone n’est pas écrasée (le pilote est l’id affiché, pas le rendu)', async () => {
    const h = mountZones();
    await h.select(0);
    const input = h.champ('Identifiant')!;
    await act(async () => {
      // Frappe au clavier : React ignore une affectation directe de `.value` (son traqueur la voit
      // passer) — le setter natif du prototype est le seul chemin qui déclenche `onChange`.
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'zone-V-z0-renommee');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await h.select(0); // re-rendu sur la même sélection (un simple mouvement de souris en produit)
    expect(h.champ('Identifiant')?.value).toBe('zone-V-z0-renommee');
  });

  it('un défaut de ZONE mis en évidence AMÈNE le pinceau d’emprise dans le champ du panneau', async () => {
    const h = mountZones();
    await h.select(1);

    // jsdom ne calcule aucun layout : on pose une géométrie de panneau DÉFILABLE et un bloc d'emprise
    // situé bien plus bas que la ligne de flottaison.
    const panneau = h.container.querySelector('aside.editor-inspector') as HTMLElement;
    const bloc = Array.from(h.container.querySelectorAll('div.ed-field')).find((el) =>
      el.textContent?.includes('Emprise'),
    ) as HTMLElement;
    expect(bloc).toBeTruthy();
    Object.defineProperties(panneau, {
      clientWidth: { value: 320 },
      clientHeight: { value: 400 },
      scrollWidth: { value: 320 },
      scrollHeight: { value: 2000 },
    });
    const rect = (top: number, height: number) =>
      () => ({ width: 320, height, top, left: 0, right: 320, bottom: top + height, x: 0, y: top, toJSON() {} }) as DOMRect;
    panneau.getBoundingClientRect = rect(0, 400);
    bloc.getBoundingClientRect = rect(900, 60); // sous la ligne de flottaison

    expect(panneau.scrollTop).toBe(0);
    await h.select(1, 'zone-debordante:zone-X-z1');
    const amene = panneau.scrollTop;
    expect(amene).toBeGreaterThan(0);
    expect(900 - amene).toBeLessThan(400); // le bloc tient dans la hauteur visible du panneau

    // Discipline : un re-rendu sur le MÊME défaut ne redéplace rien sous les doigts de l'auteur.
    panneau.scrollTop = 42;
    await h.select(1, 'zone-debordante:zone-X-z1');
    expect(panneau.scrollTop).toBe(42);
  });
});

describe('Inspector — l’appareil mécanique d’une zone suit ce que la zone EST', () => {
  /** Une pièce nue (le cas de La Diligence : 37 zones sur 37) et une zone ARMÉE, côte à côte. */
  function mountZones() {
    const scene: Scene = {
      ...emptyScene(8, 8),
      effectZones: [
        { id: 'zone-K-z0', label: 'Cuisine', presentation: 'interior', area: { kind: 'rect', x: 0, y: 0, w: 2, h: 2 }, z: 0 },
        {
          id: 'fosse',
          label: 'Fosse à pieux',
          area: { kind: 'rect', x: 4, y: 4, w: 2, h: 2 },
          onCross: [{ op: 'wounds', amount: 5, ignoreTB: false, ignoreAP: true }],
        },
      ],
    };
    const { container, rendre } = monterRacine(null);
    const render = (idx: number) =>
      rendre(
        <Inspector
          scene={scene}
          otherScenes={[]}
          worldMap={null}
          setScene={() => undefined}
          sel={{ type: 'effectZone', idx }}
          setSel={() => undefined}
          enemyCreatures={[]}
          openLogic={() => undefined}
          resizeScene={() => undefined}
          narratif={{ affaires: [], indices: [], presetsPnj: [], objets: [] }}
          tool={{ mode: 'select' }}
          armZoneTiles={() => undefined}
          zoneFocusKey={null}
        />,
      );
    /** La section repliable dont le résumé porte `titre`. */
    const section = (titre: string) =>
      Array.from(container.querySelectorAll('details.insp-fold')).find((d) =>
        d.querySelector('summary')?.textContent?.includes(titre),
      ) as HTMLDetailsElement | undefined;
    return { container, select: (idx: number) => act(() => render(idx)), section };
  }

  it('une PIÈCE présente sa section mécanique REPLIÉE — armable en un clic, jamais déployée d’office', async () => {
    const h = mountZones();
    await h.select(0);
    expect(h.section('Pièce')?.open).toBe(true);
    const mecanique = h.section('Piège / zone d’effet') ?? h.section("Piège / zone d'effet");
    expect(mecanique).toBeTruthy();
    expect(mecanique!.open).toBe(false);
  });

  it('une zone qui PORTE un effet présente sa section mécanique DÉPLOYÉE', async () => {
    const h = mountZones();
    await h.select(1);
    const mecanique = h.section('Piège / zone d’effet') ?? h.section("Piège / zone d'effet");
    expect(mecanique).toBeTruthy();
    expect(mecanique!.open).toBe(true);
  });
});

/**
 * ASSISE AUTHORÉE — le panneau de décor porte l'authoring des places : sélectionner la table doit
 * suffire pour attabler un PNJ, sans passer par le JSON.
 */
describe('Inspector — places assises d’un décor', () => {
  /** Table ronde en (2,2) cap `N` → abords : nord (2,1), est (3,2), sud (2,3), ouest (1,2). */
  function mountTable() {
    const scene: Scene = {
      ...emptyScene(8, 8),
      entities: [
        { id: 'table-1', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'table-ronde-4-tabourets', facing: 'N' },
        { id: 'pnj-aubergiste', kind: 'personnage', ref: 'humain', pos: { x: 6, y: 6 }, label: 'Aubergiste' },
      ],
    };
    let latest = scene;
    const { container, rendre } = monterRacine(null);
    const render = (s: Scene) =>
      rendre(
        <Inspector
          scene={s}
          otherScenes={[]}
          worldMap={null}
          setScene={(next) => { latest = next; render(next); }}
          sel={{ type: 'entity', id: 'table-1' }}
          setSel={() => undefined}
          enemyCreatures={[]}
          openLogic={() => undefined}
          resizeScene={() => undefined}
          narratif={{ affaires: [], indices: [], presetsPnj: [], objets: [] }}
          tool={{ mode: 'select' }}
          armZoneTiles={() => undefined}
          zoneFocusKey={null}
        />,
      );
    act(() => render(scene));
    return { container, sceneOf: () => latest };
  }

  it('expose les places de la ref et écrit l’occupant par id', () => {
    const { container, sceneOf } = mountTable();
    expect(container.textContent).toContain('4 places');
    const place = [...container.querySelectorAll('label')].find((l) => l.textContent?.startsWith('place-1'));
    const select = place?.querySelector('select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    act(() => {
      select.value = 'entity:pnj-aubergiste';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(sceneOf().seatAssignments).toEqual({ 'table-1': { 'place-1': { kind: 'entity', entityId: 'pnj-aubergiste' } } });
    expect(sceneOf().entities.find((e) => e.id === 'pnj-aubergiste')?.pos).toEqual({ x: 2, y: 1 });
  });

  it('changer la ref du décor élague l’assise dans la même mutation', () => {
    const { container, sceneOf } = mountTable();
    const place = [...container.querySelectorAll('label')].find((l) => l.textContent?.startsWith('place-1'));
    const select = place!.querySelector('select') as HTMLSelectElement;
    act(() => {
      select.value = 'entity:pnj-aubergiste';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const decor = [...container.querySelectorAll('label')].find((l) => l.textContent?.startsWith('Décor'));
    const refSelect = decor!.querySelector('select') as HTMLSelectElement;
    act(() => {
      refSelect.value = 'tonneau';
      refSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(sceneOf().entities.find((e) => e.id === 'table-1')?.ref).toBe('tonneau');
    expect(sceneOf().seatAssignments).toEqual({});
  });
});

/**
 * CAP D'UN DÉCOR VOLUMIQUE (#1680 ligne 3) — verrou au GESTE : le sélecteur d'orientation n'OFFRE pas
 * la diagonale sur un décor dont le type porte une recette. Un cap qu'on ne peut pas choisir n'a pas
 * à être réparé après coup ; le schéma de scène (`sceneEntitySchema`) reste le refus au chargement,
 * `validateScene` le signalement, `buildProps` le billboard d'erreur. Un cap refusé que la donnée
 * porte quand même se MONTRE, non élisible. La règle est celle du CATALOGUE
 * (`refEstVolumique`) : un décor BILLBOARD garde ses huit caps.
 */
describe('Inspector — orientation : les caps OFFERTS suivent le catalogue', () => {
  const capsOfferts = (container: HTMLElement) => {
    const champ = [...container.querySelectorAll('label')].find((l) => l.textContent?.startsWith('Orientation'));
    return [...(champ!.querySelector('select') as HTMLSelectElement).options].map((o) => o.value);
  };

  it('décor VOLUMIQUE : quatre cardinaux, aucune diagonale', () => {
    const h = mount({ id: 'table-1', kind: 'prop', pos: { x: 1, y: 1 }, ref: 'table-ronde-4-tabourets', facing: 'N' });
    h.mount();
    expect(capsOfferts(h.container)).toEqual(['N', 'E', 'S', 'O']);
  });

  it('décor BILLBOARD : les huit caps restent offerts', () => {
    const h = mount({ id: 'brasero-1', kind: 'prop', pos: { x: 1, y: 1 }, ref: 'brasero', facing: 'NE' });
    h.mount();
    expect(capsOfferts(h.container)).toEqual(['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']);
  });

  it('PERSONNAGE : les huit caps restent offerts (la règle ne parle que du décor)', () => {
    const h = mount({ id: 'pnj-1', kind: 'personnage', ref: 'humain', pos: { x: 1, y: 1 }, facing: 'SE' });
    h.mount();
    expect(capsOfferts(h.container)).toEqual(['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']);
  });

  it('cap HORS offre porté par la donnée : montré en option NON élisible, les cardinaux restent élisibles', () => {
    const h = mount({ id: 'table-1', kind: 'prop', pos: { x: 1, y: 1 }, ref: 'table-ronde-4-tabourets', facing: 'NE' });
    h.mount();
    const champ = [...h.container.querySelectorAll('label')].find((l) => l.textContent?.startsWith('Orientation'));
    const select = champ!.querySelector('select') as HTMLSelectElement;
    expect(select.value, 'le DOM montre le cap de la donnée, pas la première option').toBe('NE');
    expect([...select.options].map((o) => [o.value, o.disabled])).toEqual([
      ['NE', true], ['N', false], ['E', false], ['S', false], ['O', false],
    ]);
    act(() => {
      select.value = 'N';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(h.entOf().facing).toBe('N');
  });
});

describe('Inspector — le profil de toiture est nommé par le NŒUD, une seule fois (#1694)', () => {
  const body = {
    id: 'corps',
    style: 'taverne',
    storeys: [{ id: 'rdc', z: 0, parts: [{ id: 'p', foot: { x: 0, y: 0, w: 2, h: 2 } }], roomZoneIds: [] }],
    facades: [],
    masses: [{
      id: 'masse',
      z: 0,
      footprint: [{ x: 0, y: 0, w: 2, h: 2 }],
      levels: 1,
      profile: 'gable' as const,
      pitchDeg: 40,
      material: 'toit-ardoise',
      ridge: 'x' as const,
    }],
  };

  function profilOptions(sel: Sel) {
    const scene: Scene = { ...emptyScene(4, 4), architecture: [body] };
    const { container, rendre } = monterRacine(null);
    return { scene, container, rendre, sel };
  }

  it('les DEUX selects de profil (défauts du corps, masse posée) rendent les libellés du nœud', async () => {
    const attendu = Object.entries(valeursDe(roofProfileSchema)!);
    expect(attendu.length).toBeGreaterThan(1);

    const lu: [string, string][][] = [];
    for (const sel of [
      { type: 'architectureBody', id: 'corps' },
      { type: 'roofSection', bodyId: 'corps', id: 'masse' },
    ] as Sel[]) {
      const h = profilOptions(sel);
      await act(() => {
        h.rendre(
          <Inspector
            scene={h.scene}
            otherScenes={[]}
            worldMap={null}
            setScene={() => undefined}
            sel={h.sel}
            setSel={() => undefined}
            enemyCreatures={[]}
            openLogic={() => undefined}
            resizeScene={() => undefined}
            narratif={{ affaires: [], indices: [], presetsPnj: [], objets: [] }}
            tool={{ mode: 'select' }}
            armZoneTiles={() => undefined}
            zoneFocusKey={null}
          />,
        );
      });
      const select = Array.from(h.container.querySelectorAll('select'))
        .find((el) => el.closest('label')?.textContent?.trim().startsWith('Profil')) as HTMLSelectElement;
      expect(select).toBeTruthy();
      lu.push(Array.from(select.options).map((o) => [o.value, o.textContent ?? ''] as [string, string]));
    }

    // Le select du CORPS ouvre sur une case VIDE (#1715 : profil non posé = la PORTÉE tranche) ; les
    // options NOMMÉES, elles, restent celles du nœud. Celui d'une masse POSÉE n'a pas ce degré de
    // liberté : une masse porte toujours un profil.
    expect(lu[0]).toEqual([['', ''], ...attendu]);
    expect(lu[1]).toEqual(attendu);
  });
});

describe("Inspector — le type d'un ornement de façade est nommé par le NŒUD (#1694)", () => {
  it('le select « Type » rend les options du nœud, `belfry` compris', async () => {
    const attendu = Object.entries(valeursDe(facadeFeatureKindSchema)!);
    expect(attendu.map(([id]) => id)).toContain('belfry');

    const scene: Scene = {
      ...emptyScene(4, 4),
      architecture: [{
        id: 'corps',
        style: 'taverne',
        storeys: [{ id: 'rdc', z: 0, parts: [{ id: 'p', foot: { x: 0, y: 0, w: 2, h: 2 } }], roomZoneIds: [] }],
        facades: [{
          id: 'pan-sud',
          z: 0,
          edges: [{ x: 0, y: 1, side: 'N' as const }],
          appearance: 'chapelle',
          features: [{ id: 'clocheton-nef', kind: 'belfry' as const, edge: { x: 0, y: 1, side: 'N' as const } }],
        }],
        masses: [],
      }],
    };
    const { container, rendre } = monterRacine(null);
    await act(() => {
      rendre(
        <Inspector
          scene={scene}
          otherScenes={[]}
          worldMap={null}
          setScene={() => undefined}
          sel={{ type: 'facadeSection', bodyId: 'corps', id: 'pan-sud' } as Sel}
          setSel={() => undefined}
          enemyCreatures={[]}
          openLogic={() => undefined}
          resizeScene={() => undefined}
          narratif={{ affaires: [], indices: [], presetsPnj: [], objets: [] }}
          tool={{ mode: 'select' }}
          armZoneTiles={() => undefined}
          zoneFocusKey={null}
        />,
      );
    });
    const select = Array.from(container.querySelectorAll('select'))
      .find((el) => el.closest('label')?.textContent?.trim().startsWith('Type')) as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(Array.from(select.options).map((o) => [o.value, o.textContent ?? ''])).toEqual(attendu);
    expect(select.value).toBe('belfry');
  });
});

/** Une coiffure imposée (`appearance.hairstyle`, #637) ne fait plus lever l'aperçu et ne devient plus une
 *  faute par un geste de l'Inspecteur (verdict 5805847379 de #1897, sections A2, A3 et E). */
describe('Inspector — la coiffure imposée suit le pool du sexe', () => {
  const coiffureM = hairstylesForSex('M')[0].id;
  const choisir = async (container: HTMLElement, libelle: string, valeur: string) => {
    const select = Array.from(container.querySelectorAll('select'))
      .find((el) => el.closest('label')?.textContent?.trim().startsWith(libelle)) as HTMLSelectElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, valeur);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };

  it('coiffure M choisie : la clé écrite passe le schéma de la scène', async () => {
    const h = mount({ id: 'pnj', kind: 'personnage', pos: { x: 1, y: 1 }, ref: 'mutant', appearance: { sex: 'M' } });
    await h.mount();
    await choisir(h.container, 'Coiffure', coiffureM);
    expect(h.entOf().appearance?.hairstyle).toBe(coiffureM);
    expect(validateScene([h.sceneOf()]).filter((w) => w.message.includes('hairstyle'))).toEqual([]);
  });

  it('PNJ sans sexe posé, coiffure F choisie : le sexe F est écrit avec elle, le schéma de la scène passe', async () => {
    const coiffureF = hairstylesForSex('F')[0].id;
    const h = mount({ id: 'pnj', kind: 'personnage', pos: { x: 1, y: 1 }, ref: 'mutant' });
    await h.mount();
    await choisir(h.container, 'Coiffure', coiffureF);
    expect(h.entOf().appearance).toMatchObject({ hairstyle: coiffureF, sex: 'F' });
    expect(validateScene([h.sceneOf()]).filter((w) => w.message.includes('hairstyle'))).toEqual([]);
  });

  it('coiffure M puis sexe F : la coiffure retombe dans le MÊME patch, l’aperçu tient', async () => {
    const h = mount({ id: 'pnj', kind: 'personnage', pos: { x: 1, y: 1 }, ref: 'mutant', appearance: { sex: 'M', hairstyle: coiffureM } });
    await h.mount();
    await choisir(h.container, 'Sexe', 'F');
    expect(h.entOf().appearance).toMatchObject({ sex: 'F' });
    expect(h.entOf().appearance).not.toHaveProperty('hairstyle');
    expect(h.container.querySelector('.ent-preview svg')?.innerHTML).not.toContain(MISSING_TONE);
  });

  it('coiffure M déjà posée sur un PNJ F (donnée importée) : l’aperçu montre la chevelure d’erreur', async () => {
    const h = mount({ id: 'pnj', kind: 'personnage', pos: { x: 1, y: 1 }, ref: 'mutant', appearance: { sex: 'F', hairstyle: coiffureM } });
    await h.mount();
    expect(h.container.querySelector('.ent-preview svg')?.innerHTML).toContain(MISSING_TONE);
  });
});
