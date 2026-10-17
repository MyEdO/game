/**
 * OCCUPATION AU RUNTIME — LA CHAISE SUIT LE CORPS.
 *
 * À l'AUTHORING, une place de groupe désigne un EMPLACEMENT (« Héros 1 »… « Héros N ») : qui entre
 * au rang r s'y assoit. Au RUNTIME, la chaise appartient au CORPS qui l'occupe — dès que le héros
 * présent à un rang ASSIS change (permutation, retrait avec glissement, remplacement, écriture en
 * bloc), cette place se lève : une chaise ne change jamais de propriétaire en silence.
 *
 * La couture est UNIQUE et ne dépend d'AUCUN appelant : elle observe la transition d'état du store
 * (`useGame.subscribe`) et compare les corps rang par rang. Ces tests l'attaquent donc par des
 * écrivains qui ne la connaissent pas — `setState` brut, `setParty` en bloc — autant que par les
 * primitives de recomposition.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { useGame } from './store';
import { emptyScene, type Scene } from './scene';
import { assignSeat, seatPoseOf } from './seating';
import { readSlot } from './saves';
import type { Combatant } from '../engine/types';

const TABLE = 'table-ronde-4-tabourets';
const PROP = 'table-1';
/** Les places de la table, dans l'ordre du catalogue : une par rang, pour lire le résultat d'un œil. */
const SLOT_DU_RANG = ['place-1', 'place-2', 'place-3', 'place-4'];

const hero = (id: string): Combatant =>
  ({ id, label: id.toUpperCase(), kind: 'hero', xp: 0, wounds: { current: 12, max: 12 }, conditions: [], movement: 4 }) as unknown as Combatant;

const poseDe = (rang: number) => seatPoseOf(useGame.getState().scene!, { kind: 'party', rang });
const placesDeGroupe = () =>
  Object.values(useGame.getState().scene?.seatAssignments ?? {}).flatMap((m) => Object.values(m)).filter((o) => o.kind === 'party');

/** Attable les `rangs` demandés par la primitive RÉELLE (`assignSeat`), puis entre en scène. */
function attable(rangs: number[], party: Combatant[]): void {
  let sc: Scene = emptyScene(12, 12);
  sc.id = 'taverne';
  sc.entities.push({ id: PROP, kind: 'prop', pos: { x: 5, y: 5 }, ref: TABLE, facing: 'N', usable: { assise: true } });
  for (const rang of rangs) {
    const r = assignSeat(sc, PROP, SLOT_DU_RANG[rang - 1], { kind: 'party', rang }, party.length);
    if (!r.ok) throw new Error(`assignSeat refusé (rang ${rang}) : ${r.reason}`);
    sc = r.scene;
  }
  useGame.setState({ party, scene: null, mode: 'exploration', journal: [], battle: null, dialogue: null });
  useGame.getState().startScene(sc);
}

/** Stockage de save en mémoire — le chemin de save/chargement est le RÉEL, sur un support jetable. */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  } as Storage;
}

describe('recomposition du groupe — l’emplacement dont le corps change se lève', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
    useGame.setState({ battle: null, dialogue: null });
  });

  it('PERMUTER l’ordre du groupe lève la chaise : elle ne se transmet pas au corps suivant', () => {
    attable([1], [hero('h1'), hero('h2')]);
    expect(poseDe(1)).toMatchObject({ slotId: 'place-1' });
    // Écriture BRUTE : cet appelant ne connaît pas la couture, et n'a pas à la connaître.
    useGame.setState((s) => ({ party: [s.party[1], s.party[0]] }));
    expect(poseDe(1)).toBeNull();
    expect(placesDeGroupe()).toEqual([]);
  });

  it('RETIRER le premier héros lève les rangs qui glissent, et EUX SEULS', () => {
    attable([2, 3], [hero('h1'), hero('h2'), hero('h3')]);
    expect(poseDe(2)).toMatchObject({ slotId: 'place-2' });
    expect(poseDe(3)).toMatchObject({ slotId: 'place-3' });
    useGame.getState().partyRemoveHero('h1');
    // h2 et h3 ont glissé d'un cran : « Héros 2 » désigne un AUTRE corps, « Héros 3 » plus personne.
    expect(useGame.getState().party.map((h) => h.id)).toEqual(['h2', 'h3']);
    expect(poseDe(2)).toBeNull();
    expect(poseDe(3)).toBeNull();
  });

  it('REMPLACER un héros EN PLACE ne lève que SON emplacement — les rangs suivants tiennent', () => {
    attable([2, 3], [hero('h1'), hero('h2'), hero('h3')]);
    useGame.getState().partyReplaceHero('h2', hero('neuf'));
    expect(useGame.getState().party.map((h) => h.id)).toEqual(['h1', 'neuf', 'h3']);
    expect(poseDe(2)).toBeNull();
    expect(poseDe(3)).toMatchObject({ slotId: 'place-3' }); // son corps n'a pas bougé : il garde sa chaise
  });

  it('un remplacement À MÊME ID (édition en place) ne lève personne, et n’écrit pas la scène', () => {
    attable([1], [hero('h1')]);
    const avant = useGame.getState().scene!;
    useGame.getState().partyReplaceHero('h1', { ...hero('h1'), label: 'Retouché' } as Combatant);
    expect(poseDe(1)).toMatchObject({ slotId: 'place-1' });
    expect(useGame.getState().scene).toBe(avant); // aucune écriture inutile
  });

  it('`setParty` en BLOC (devtools, écran de scénarios) lève la place du corps remplacé', () => {
    attable([1], [hero('h1')]);
    useGame.getState().setParty([hero('autre')]);
    expect(poseDe(1)).toBeNull();
    expect(placesDeGroupe()).toEqual([]);
  });

  it('scène PATCHÉE et groupe permuté dans la MÊME écriture : la chaise se lève quand même', () => {
    // Ce n'est pas la scène (l'objet) qui décide, c'est l'OCCUPATION en vigueur : patcher un champ de
    // la scène ne rend pas l'écriture invisible à la couture. Un écrivain qui touche les deux d'un
    // seul `set` ne peut donc pas transmettre une chaise en silence.
    attable([1], [hero('h1'), hero('h2')]);
    const sc = useGame.getState().scene!;
    useGame.setState((s) => ({ party: [s.party[1], s.party[0]], scene: { ...sc, label: 'Taverne patchée' } }));
    expect(useGame.getState().scene!.label).toBe('Taverne patchée');
    expect(poseDe(1)).toBeNull();
    expect(placesDeGroupe()).toEqual([]);
  });

  it('une OCCUPATION NEUVE fait foi : la save chargée garde la sienne, quel que soit le groupe précédent', () => {
    // Le pendant du test ci-dessus, et la raison de la clause : une écriture qui APPORTE une
    // occupation (chargement, entrée en scène, élagage) porte sa propre vérité. La comparer au
    // groupe de la partie PRÉCÉDENTE lèverait la chaise que la save vient de restaurer.
    attable([1], [hero('h1')]);
    expect(useGame.getState().saveGame(1)).toBe(true);

    attable([1], [hero('h9')]);           // une AUTRE partie, même scène, même place, autre corps
    expect(poseDe(1)).toMatchObject({ slotId: 'place-1' });
    expect(useGame.getState().loadGame(1)).toBe(true);
    expect(useGame.getState().party.map((h) => h.id)).toEqual(['h1']);
    expect(poseDe(1)).toMatchObject({ slotId: 'place-1' });
  });

  it('RECRUTER un héros au rang suivant ne touche à rien de ce qui est assis', () => {
    attable([1], [hero('h1')]);
    useGame.getState().partyAddHero(hero('h2'));
    expect(useGame.getState().party.map((h) => h.id)).toEqual(['h1', 'h2']);
    expect(poseDe(1)).toMatchObject({ slotId: 'place-1' });
  });

  it('CHARGEMENT d’une save dont le groupe n’atteint pas le rang assis : élagage SILENCIEUX', () => {
    // Save dont la scène attable l'emplacement 2 alors que la partie n'a qu'un héros — la forme
    // qu'un paquet de campagne réédité entre deux sessions produit. Au chargement, rien à afficher
    // et rien à corriger à la main : le rang est élagué (`pruneSeatAssignments`).
    attable([2], [hero('h1'), hero('h2')]);
    expect(useGame.getState().saveGame(1)).toBe(true);
    const save = readSlot(1)!;
    const data = save.data as { party: Combatant[] };
    data.party = data.party.slice(0, 1);

    useGame.setState({ party: [], scene: null });
    expect(useGame.getState().importGame(JSON.stringify(save))).toBeNull();
    expect(useGame.getState().party.map((h) => h.id)).toEqual(['h1']);
    expect(poseDe(2)).toBeNull();
    expect(placesDeGroupe()).toEqual([]);
  });

  it('une scène qui n’a JAMAIS porté d’assise n’en gagne pas le champ au chargement', () => {
    attable([], [hero('h1')]);
    expect(useGame.getState().scene!.seatAssignments).toBeUndefined();
    expect(useGame.getState().saveGame(1)).toBe(true);
    useGame.setState({ party: [], scene: null });
    expect(useGame.getState().loadGame(1)).toBe(true);
    expect(useGame.getState().scene!.seatAssignments).toBeUndefined();
  });
});

describe('la couture d’occupation est UNIQUE', () => {
  const ROOT = path.resolve(__dirname, '..', '..');
  const lire = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

  it('un SEUL site de `src/**` réconcilie l’occupation d’une recomposition', () => {
    const appelants = readCorpus(['src'])
      .filter(({ rel, text }) => rel !== 'src/state/seating.ts' && /releaseRecomposedRanks\(/.test(text))
      .map(({ rel }) => rel);
    expect(appelants).toEqual(['src/state/store.ts']);
  });

  it('le module qui RECOMPOSE le groupe n’écrit PAS l’assise lui-même', () => {
    // `partyFlow` ajoute, retire, remplace : il écrit le GROUPE, jamais la scène. La politique
    // d'occupation n'a donc qu'un auteur — un `set({ scene })` ici en ferait un second, libre de
    // diverger de la couture rang par rang.
    const src = lire('src/state/partyFlow.ts');
    const ecritures = [...src.matchAll(/set\(\s*(?:\([^)]*\)\s*=>\s*)?\(?\{[^}]*\bscene\s*:/g)].map((m) => m[0]);
    expect(ecritures).toEqual([]);
  });
});
