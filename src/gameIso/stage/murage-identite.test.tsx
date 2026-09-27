// @vitest-environment jsdom
/**
 * MURAGE PAR IDENTITÉ (#1401) — un objet monté dans la scène three ne naît et ne meurt qu'avec
 * l'IDENTITÉ qu'il représente.
 *
 * LE PRÉDICAT, un seul pour toute la batterie. En notant `I`/`I'` les identités de sujet
 * (`BillboardSubject.identity`) PORTÉES par la scène avant et après un geste, et `U`/`U'` les uuid des
 * `Object3D` montés :
 *
 *     U \ U' ⊆ uuid(I \ I')     et     U' \ U ⊆ uuid(I' \ I)
 *
 * — tout objet qui DISPARAÎT appartient à une identité qui disparaît, tout objet qui NAÎT appartient à
 * une identité qui naît. Corollaire, et c'est lui qui mord : `I' == I ⟹ U' == U`, zéro objet libéré,
 * zéro objet neuf. Un pas, un quart de tour, une heure qui avance ne changent AUCUNE identité : ils ne
 * doivent donc toucher à aucun objet de la scène.
 *
 * LE PONT uuid → identité. L'identité est celle du SUJET (`backends/webgl/sceneMeshes`) ; c'est le quad
 * de CORPS qui la porte côté scène, sur son `name` (`stage/GameStage3D`, passe de montage), son disque
 * d'ombre de contact aussi, et le jumeau de silhouette l'hérite de son parent. C'est ce pont qui rend
 * la batterie NON déclarative : le test ne dit jamais « ce geste change telle identité », il RELÈVE
 * `I` et `I'` sur la scène montée.
 *
 * PÉRIMÈTRE MESURÉ : l'écran de campagne (`ui/CampaignView`) monté sur le hub de l'arène — scène
 * RÉELLE, bâtiments, toitures, une soixantaine de sujets — et sur la scène de combat de la fixture.
 * Chaque geste part d'un montage NEUF : deux gestes à la file mesureraient la queue du premier.
 *
 * ANGLES MORTS, déclarés :
 *  - les objets SANS identité (lampes, pools d'instances, masse du monde cuit, semis) ne sont couverts
 *    que par la seconde moitié du prédicat — « aucun churn hors des identités qui bougent ». C'est le
 *    volet le plus fort du contrat, et c'est aussi celui qui rend les FOYERS ci-dessous nécessaires ;
 *  - un geste ne peut mesurer que ce qu'il DÉCLENCHE : chaque ligne porte son TÉMOIN, une lecture
 *    d'état qui doit avoir bougé, sans quoi la ligne prouverait la conservation d'un écran inerte ;
 *  - les gestes de l'ÉDITEUR (tick d'authoring, curseur d'opacité du décalque) ne sont pas couverts :
 *    ils ne vivent pas sous cet hôte (voir `TODO_NOMMÉS`).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { useGame } from '../../state/store';
import { capDuGroupe } from '../../state/combatants';
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { parseProject } from '../../state/worldMap';
import { testScene } from '../../scenes/test-fixture';
import type { Combatant } from '../../engine/types';
import type { Scene } from '../../state/scene';
import { CampaignView } from '../../ui/CampaignView';
import { nudgeStageYaw, resetStageYaw, viewRot } from '../../state/stageYaw';
import { clearedSpace, massFootprintCells } from '../builders/roofs';
import { effectiveArchitecture } from '../../state/sceneEdit';
import { setStageRendererFactory } from './GameStage3D';
import { bakeQueueLength } from '../backends/webgl/atlasBake';
import { battreStageFrames } from './stageFrames';
import { poigneesEnAttente } from './texturesStatiques';
import {
  BancRenderer,
  PLAFOND_ATTENTE_MS,
  attendreQuads,
  attendreQue,
  brancherArdoise,
  quads,
  scènes,
  simulerRasterisation,
  viderCaptures,
} from './banc-volumique';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };
const BUDGET_MS = 60_000;

let root: Root | null = null;
let hôte: HTMLDivElement | null = null;

brancherArdoise();

// ————————————————————————————————————————————————
// L'ATTENTE — le FAIT que ce banc attend, jamais une fenêtre de mur (#1442)
// ————————————————————————————————————————————————

/** Le patron d'attente du harnais (#1442) : toute attente de ce fichier sort AU FAIT ACCOMPLI, jamais
 *  au bout d'une fenêtre de mur. Le rythme unique du stage (`battreStageFrames`) y bat à chaque tour,
 *  pour qu'une attente d'IMAGE ne dépende pas de ce que l'hôte décide de repeindre. */
const attendre = (fait: () => boolean): Promise<void> =>
  attendreQue(fait, PLAFOND_ATTENTE_MS, () => battreStageFrames());

/**
 * REPOS de l'écran : plus une rasterisation dans la file cadencée du cuiseur (`bakeQueueLength`) ni une
 * clé statique qui attend son rang (`poigneesEnAttente`). C'est l'état où tout ce qu'un geste a mis en
 * file a été servi — donc où tout objet que ce service devait monter ou libérer l'est.
 */
const auRepos = (): boolean => bakeQueueLength() === 0 && poigneesEnAttente().size === 0;

/** Images battues APRÈS LE FAIT avant de figer le prédicat (#1442, patron `gabarits-en-file`) : le
 *  murage est une assertion NÉGATIVE (aucun objet tué, aucun neuf hors des identités qui bougent), et
 *  une sortie d'attente est au PLUS TÔT — un objet libéré à l'image suivante resterait hors du jugement. */
const IMAGES_APRES_LE_FAIT = 3;

/**
 * Attend le REPOS de l'écran TENU sur `IMAGES_APRES_LE_FAIT` images battues — la fenêtre se réarme dès
 * qu'une rasterisation repart, si bien que le retour affirme deux choses à la fois : la file est vide,
 * et elle l'est restée le temps que la scène soit repeinte. Le plafond ne fait que borner l'infini.
 */
async function attendreRepos(quoi: string): Promise<void> {
  let fenêtre = scènes.length + IMAGES_APRES_LE_FAIT;
  await attendre(() => {
    if (!auRepos()) {
      fenêtre = scènes.length + IMAGES_APRES_LE_FAIT;
      return false;
    }
    return scènes.length >= fenêtre;
  });
  expect(auRepos(), `PRÉMISSE : ${quoi} — la file du cuiseur porte encore ${bakeQueueLength()} tâche(s) et ${poigneesEnAttente().size} poignée(s)`)
    .toBe(true);
  expect(scènes.length, `PRÉMISSE : ${quoi} — la pompe d'images doit battre après le fait (${scènes.length} image(s) pour ${fenêtre} attendues)`)
    .toBeGreaterThanOrEqual(fenêtre);
}

// ————————————————————————————————————————————————
// FOYERS — le churn SANS identité qui subsiste : nommé, borné, et daté d'une raison structurelle
// ————————————————————————————————————————————————

/**
 * Un foyer EXEMPTE un objet du prédicat, par sa description (`type|name`), et dit POURQUOI. La liste
 * est un inventaire de dette : elle ne doit que décroître, et un foyer vide de sens se supprime.
 */
interface Foyer {
  nom: string;
  reconnaît: RegExp;
  /** Combien d'objets, AU PLUS, ce foyer excuse par côté (tués, neufs) et par geste. Le motif de
   *  reconnaissance est large ; ce plafond borne ce qu'il absorbe : au-delà, ce n'est plus le churn
   *  déclaré, et la faute repasse au prédicat. */
  plafondParGeste: number;
  raison: string;
}

const FOYERS: readonly Foyer[] = [
  {
    nom: 'pool de marques à capacité nulle',
    reconnaît: /^Mesh\|marques:/,
    plafondParGeste: 1,
    raison:
      'un pool de marques de case NAÎT et MEURT à son palier de capacité, et zéro EST un palier '
      + '(`slotCapacity(0) === 0`, `backends/webgl/highlightMeshes`) : la fin d’un tour vide les cases '
      + 'atteignables et libère le pool, le tour suivant le réalloue. Aucune identité de sujet n’y '
      + 'correspond — le prédicat le voit, et c’est bien ce qu’on veut voir (#1401). PÉRIMÈTRE RÉEL du '
      + 'motif : TOUT churn d’un pool de marques, quel que soit son pool — borné à UN objet par côté et '
      + 'par geste (`plafondParGeste`), ce qui est exactement la mort-renaissance décrite. Retrait attendu '
      + 'au DoD de #1428 (le pool cesse de mourir à la capacité nulle) : ce foyer se supprime alors.',
  },
];

const foyerDe = (desc: string): Foyer | undefined => FOYERS.find((f) => f.reconnaît.test(desc));

/**
 * Les gestes que cet hôte NE PEUT PAS jouer, et la raison précise — jamais un contournement muet.
 * Chacun attend son banc chez l'hôte qui les porte (`ui/editor/EditorCanvas`), pas ici.
 */
const TODO_NOMMÉS: readonly { nom: string; raison: string }[] = [
  {
    nom: 'un tick d’édition',
    raison:
      'l’écran d’authoring n’est pas monté par `ui/CampaignView` : le tick d’édition (une référence de '
      + 'scène neuve par `pointermove` de pinceau) entre par `ui/editor/EditorCanvas`, qui monte son '
      + 'propre `GameStage3D`.',
  },
  {
    nom: 'un curseur d’opacité',
    raison:
      'le décalque de calage (`decalque`, seul consommateur d’un curseur d’opacité de l’écran '
      + 'volumique) n’est passé que par `ui/editor/EditorCanvas` — l’écran de campagne n’en monte aucun.',
  },
];

// ————————————————————————————————————————————————
// LE RELEVÉ — I et U, lus sur la scène MONTÉE (jamais déclarés)
// ————————————————————————————————————————————————

interface Objet {
  /** Ce qui NOMME l'objet dans un message d'échec, et ce que les FOYERS reconnaissent : `type|name`,
   *  le `type` étant celui de three — un `InstancedMesh` s'y annonce `Mesh`. */
  desc: string;
  /** L'identité de sujet à laquelle il appartient, quand il en porte une. */
  identité: string | null;
}

interface Relevé {
  objets: Map<string, Objet>;
  identités: Set<string>;
}

const dernièreScène = (): THREE.Scene | undefined => scènes[scènes.length - 1];

/** L'identité qu'un objet PORTE : la sienne, ou celle de son plus proche ancêtre qui en porte une (le
 *  jumeau de silhouette est un enfant du quad de corps). */
function identitéPortée(o: THREE.Object3D, identités: ReadonlySet<string>): string | null {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) {
    if (n.name && identités.has(n.name)) return n.name;
  }
  return null;
}

function relever(): Relevé {
  // `I` = les identités de sujet portées par la scène : le `name` des quads de corps montés. La
  // rétention des boards se fait sur cette même identité (`GameStage3D`, passe de montage), donc un
  // quad vit exactement tant que son identité est voulue.
  const identités = new Set(quads().map((m) => m.name));
  const objets = new Map<string, Objet>();
  dernièreScène()?.traverse((o) => {
    objets.set(o.uuid, { desc: `${o.type}|${o.name || '—'}`, identité: identitéPortée(o, identités) });
  });
  return { objets, identités };
}

/** Le verdict du prédicat, et le message qui le rend lisible : le nom du geste, le compte d'objets
 *  tués/neufs, et l'inventaire `type|name` des fautifs. */
function murage(nom: string, avant: Relevé, après: Relevé): { fautes: string[]; message: string } {
  const disparues = [...avant.identités].filter((i) => !après.identités.has(i));
  const apparues = [...après.identités].filter((i) => !avant.identités.has(i));
  const perdus = [...avant.objets].filter(([u]) => !après.objets.has(u)).map(([, o]) => o);
  const neufs = [...après.objets].filter(([u]) => !avant.objets.has(u)).map(([, o]) => o);
  const fautes: string[] = [];
  const compter = (objets: readonly Objet[]): Map<Foyer, number> => {
    const m = new Map<Foyer, number>();
    for (const o of objets) {
      const f = foyerDe(o.desc);
      if (f) m.set(f, (m.get(f) ?? 0) + 1);
    }
    return m;
  };
  for (const [côté, objets] of [['tué(s)', perdus], ['neuf(s)', neufs]] as const) {
    for (const [f, n] of compter(objets)) {
      if (n > f.plafondParGeste) {
        fautes.push(`FOYER « ${f.nom} » DÉBORDÉ : ${n} objet(s) ${côté} pour un plafond de ${f.plafondParGeste}`);
      }
    }
  }
  for (const o of perdus) {
    if (o.identité && disparues.includes(o.identité)) continue;
    if (foyerDe(o.desc)) continue;
    fautes.push(`TUÉ ${o.desc}${o.identité ? ` (identité ${o.identité}, TOUJOURS voulue)` : ' (aucune identité)'}`);
  }
  for (const o of neufs) {
    if (o.identité && apparues.includes(o.identité)) continue;
    if (foyerDe(o.desc)) continue;
    fautes.push(`NEUF ${o.desc}${o.identité ? ` (identité ${o.identité}, DÉJÀ montée)` : ' (aucune identité)'}`);
  }
  const message = [
    `geste « ${nom} » : ${perdus.length} objet(s) tué(s), ${neufs.length} neuf(s)`,
    `pour ${disparues.length} identité(s) disparue(s) et ${apparues.length} apparue(s)`,
    `— ${fautes.length} hors murage :`,
    fautes.join(' ;; '),
  ].join(' ');
  return { fautes, message };
}

// ————————————————————————————————————————————————
// LES DEUX THÉÂTRES
// ————————————————————————————————————————————————

const HÉROS = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', rng: makeRNG(7) });

/** La scène RÉELLE du jeu (le hub de l'arène) : bâtiments, toitures, une soixantaine de sujets. Sur une
 *  carte nue, « rien n'a bougé » serait vrai sans rien prouver. */
const HUB = parseProject(
  JSON.parse(readFileSync(join(__dirname, '../../scenes/arene/arene-projet.json'), 'utf8')),
).scenes.find((sc) => sc.id === 'arene-hub')!;

/** Le poste de départ authoré du groupe (`heroStart`) — la même lecture que `store.startScene`. */
const DÉPART = { ...(HUB.entities.find((e) => e.kind === 'heroStart')!.pos) };

/** Une case COUVERTE du hub (sous une masse bâtie) : c'est en y entrant que le groupe fait tomber le
 *  couvercle au-dessus de sa tête (`clearedSpace` → `keepEl`). Lue sur l'architecture de la scène,
 *  jamais écrite en dur — une retouche d'auteur ne doit pas périmer ce banc en silence. */
const SOUS_UN_TOIT = (() => {
  for (const corps of effectiveArchitecture(HUB)) {
    for (const masse of corps.masses) {
      const [première] = massFootprintCells(masse.footprint);
      if (première) {
        const [x, y] = première.split(',').map(Number);
        return { x, y };
      }
    }
  }
  throw new Error('le hub de l’arène ne porte aucune masse bâtie : le geste de dégagement n’a rien à mesurer');
})();

/** Les cases DÉGAGÉES par la position courante du groupe — le verdict que lit la loi de dégagement de
 *  l'hôte (`stage/MondeDeCampagne`). Sert de TÉMOIN, jamais d'assertion. */
const dégagées = (): string => {
  const s = useGame.getState();
  if (!s.scene) return '—';
  const c = clearedSpace(s.scene, [s.partyPos], new Set(s.explored[s.scene.id] ?? []));
  return `${c.zoneIds.size}/${c.roomlessCells.size}/${c.overheadCells.size}`;
};

/** Les cases que le brouillard a levées sur la scène courante (`store.explored`, keyé par scène). */
const explorées = (): number => useGame.getState().explored[useGame.getState().scene!.id]?.length ?? 0;

async function monterÉcran(scene: Scene, pos: { x: number; y: number }, quadsAttendus: number): Promise<void> {
  viderCaptures();
  useGame.setState({
    scene,
    mode: 'exploration',
    partyPos: { ...pos },
    party: [{ ...HÉROS, pos: { ...pos } } as Combatant],
    battle: null,
    dialogue: null,
    explored: {},
    povActive: false,
    pendingCascade: null,
  });
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  await act(async () => { root!.render(<CampaignView />); });
  await attendreQuads(quadsAttendus, PLAFOND_ATTENTE_MS);
  // `attendreQuads` est un PLAFOND : il rend la main au budget épuisé, sans lever. Le PLANCHER est
  // ici, et il est une assertion : une file du cuiseur qui n'a servi que trois quads laisserait le
  // banc mesurer la conservation d'un écran presque vide, et le dire vert.
  expect(quads().length, `${quadsAttendus} quads attendus sur cet écran, ${quads().length} servis`)
    .toBeGreaterThanOrEqual(quadsAttendus);
  // Le relevé d'AVANT se prend sur un écran au repos : une file du montage qui sert encore monterait
  // ses quads pendant le geste, et le prédicat les compterait à sa charge.
  await attendreRepos('le montage doit être servi avant le relevé d’avant');
}

/** Le hub monté au départ authoré, décor servi. */
const monterHub = (): Promise<void> => monterÉcran(HUB, DÉPART, 30);

/** La scène de COMBAT de la fixture, montée puis engagée jusqu'à la pause de début de round levée :
 *  c'est l'état où un tour se joue et où la frise se survole. */
async function monterCombat(): Promise<void> {
  useGame.setState({ party: [{ ...HÉROS }] });
  await act(async () => { useGame.getState().startScene(testScene); });
  viderCaptures();
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  await act(async () => { root!.render(<CampaignView />); });
  await attendreQuads(4, PLAFOND_ATTENTE_MS);
  await act(async () => { useGame.getState().startCombat('enc-mutants', undefined, { noSurprise: true }); });
  await attendreRepos('l’engagement du combat doit être servi');
  await act(async () => { useGame.getState().confirmRoundStart(); });
  await attendreRepos('la levée de la pause de début de round doit être servie');
  // Le PLANCHER de population, au poste de mesure : le groupe et ses adversaires montés (cf.
  // `monterÉcran`, même raison).
  expect(quads().length, `4 quads attendus au round engagé, ${quads().length} servis`).toBeGreaterThanOrEqual(4);
}

// ————————————————————————————————————————————————
// LA BATTERIE — un geste = une ENTRÉE de donnée
// ————————————————————————————————————————————————

interface Geste {
  nom: string;
  /** L'écran dans l'état où le geste se joue — hors mesure. */
  monter: () => Promise<void>;
  /** Ce que le geste change, lu sur l'état RÉEL : sans témoin qui bouge, la ligne ne mesure rien. */
  témoin: () => string;
  /** Le geste, par le chemin que le jeu emprunte. */
  agir: () => Promise<void>;
}

const BATTERIE: readonly Geste[] = [
  {
    nom: 'un pas',
    monter: monterHub,
    témoin: () => JSON.stringify(useGame.getState().partyPos),
    agir: async () => { await act(async () => { useGame.getState().stepPartyDir('up'); }); },
  },
  {
    nom: 'un quart de tour',
    monter: monterHub,
    témoin: () => String(viewRot(useGame.getState().camRot)),
    agir: async () => { await act(async () => { nudgeStageYaw(90); }); },
  },
  {
    nom: 'un cap en première personne',
    monter: async () => {
      await monterHub();
      await act(async () => { useGame.getState().togglePov(); });
      await attendreRepos('la bascule en première personne doit être servie avant le geste');
    },
    témoin: () => String(capDuGroupe(useGame.getState()) ?? '—'),
    agir: async () => { await act(async () => { useGame.getState().pivotParty(1); }); },
  },
  {
    nom: 'une heure',
    monter: monterHub,
    témoin: () => String(useGame.getState().gameTime),
    agir: async () => { await act(async () => { useGame.setState({ gameTime: useGame.getState().gameTime + 60 }); }); },
  },
  {
    nom: 'une teinte de vision',
    monter: monterHub,
    témoin: () => String(explorées()),
    agir: async () => {
      // La VOIE de l'hôte : le rendu fond les cases vues dans l'ensemble exploré (`markExplored`), et
      // c'est de cet ensemble que descend la teinte de chaque sommet (`visibilityField`).
      const dims = useGame.getState().scene!.dimensions;
      const cases: string[] = [];
      for (let x = 0; x < dims.w; x++) for (let y = 0; y < dims.h; y++) cases.push(`${x},${y},0`);
      await act(async () => { useGame.getState().markExplored(cases); });
    },
  },
  {
    nom: 'un dégagement',
    monter: monterHub,
    // Le couvercle au-dessus des têtes : c'est LUI que la loi de dégagement retire de la masse.
    témoin: dégagées,
    agir: async () => {
      // Le groupe passe SOUS un toit — même entrée que le pas (`partyPos`), à l'échelle d'une masse
      // bâtie : c'est la seule qui fasse basculer le verdict de dégagement à coup sûr sur cette carte.
      await act(async () => { useGame.setState({ partyPos: { ...SOUS_UN_TOIT } }); });
    },
  },
  {
    nom: 'un survol',
    monter: monterCombat,
    témoin: () => String(useGame.getState().hoverCombatantId ?? '—'),
    agir: async () => {
      const ennemi = useGame.getState().battle!.combatants.find((c) => c.kind === 'enemy')!;
      await act(async () => { useGame.getState().setHoverCombatant(ennemi.id); });
    },
  },
  {
    nom: 'un tour de combat',
    monter: monterCombat,
    témoin: () => String(useGame.getState().battle?.turn ?? '—'),
    agir: async () => { await act(async () => { useGame.getState().battleEndTurn(); }); },
  },
];

// ————————————————————————————————————————————————

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));

beforeEach(() => { resetStageYaw(); simulerRasterisation(); });
afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (hôte) { hôte.remove(); hôte = null; }
  resetStageYaw();
  useGame.setState({ povActive: false, hoverCombatantId: null });
});

describe('Murage par identité — un objet ne naît et ne meurt qu’avec son sujet (#1401)', () => {
  it.each(BATTERIE.map((g) => [g.nom, g] as const))('%s', async (_nom, geste) => {
    await geste.monter();
    // PRÉMISSES — sans quads montés, « rien n'a bougé » serait vrai du vide.
    const avant = relever();
    expect(avant.identités.size, 'aucun sujet monté : ce geste ne mesure rien').toBeGreaterThan(0);
    expect(avant.objets.size, 'aucun objet dans la scène : ce geste ne mesure rien').toBeGreaterThan(avant.identités.size);
    const témoinAvant = geste.témoin();

    await geste.agir();
    // Le geste a MORDU sur l'état — son témoin a bougé. Tous ne mordent pas dans l'appel : un quart de
    // tour pose un lacet CONTINU dont le cran ne bascule qu'au franchissement, plusieurs images plus
    // tard. C'est ce basculement qu'on attend ; l'affirmer reste à la prémisse ci-dessous.
    await attendre(() => geste.témoin() !== témoinAvant);
    // Puis l'écran au REPOS : tout ce que le geste a mis en file est servi, et la scène repeinte.
    await attendreRepos(`le geste « ${geste.nom} » doit être servi avant le relevé d’après`);

    // PRÉMISSE — le geste a bien mordu : un écran inerte conserve tout, et ne prouve rien.
    expect(geste.témoin(), `le geste « ${geste.nom} » n’a rien changé à l’état : il ne mesure rien`)
      .not.toBe(témoinAvant);

    const { fautes, message } = murage(geste.nom, avant, relever());
    expect(fautes, message).toEqual([]);
  }, BUDGET_MS);
});

describe('Murage par identité — ce que ce banc NE couvre pas (#1401)', () => {
  for (const t of TODO_NOMMÉS) it.todo(`${t.nom} — ${t.raison}`);
});
