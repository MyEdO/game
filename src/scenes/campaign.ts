/** Les campagnes du jeu : chacune est un paquet commité (`{<identité>, scenes, worldMap, narratif}`, `src/data/schemas/defs-scenes/projet.ts`), `src/scenes/<campagne>/<campagne>-projet.json`
 *  — celui de l'Arène est l'octet du `build()` de `scripts/arene/generate.mjs` (#1522, #1601) —, que
 *  l'éditeur ouvre en copie (`copieDuJeu`). À l'import, une campagne du jeu n'est que son IDENTITÉ, lue
 *  non parsée à la racine du paquet, et son paquet : la jouer, l'ouvrir dans l'éditeur ou l'exporter
 *  fait passer son paquet par la porte `parseProject` AU GESTE (#1692), comme une entrée de
 *  bibliothèque (`campagneDeLEntree`, `state/projectLibrary.ts`). */
import { Scene } from '../state/scene';
import { WorldMap, parseProject, documentDeProjet, type ProjectDoc, type ProjectIdentite } from '../state/worldMap';
import type { NarratifBlock } from '../state/campaignNarratif';
import { sourceRefSchema } from '../data/schemas/grammaire/valeurs';
import type { GameState } from '../state/store';
import type { Get } from '../state/flowTypes';
import { playerEntryError } from '../state/projectLibrary';
import areneProjet from './arene/arene-projet.json';
import loupEtSaumureProjet from './loup-et-saumure/loup-et-saumure-projet.json';
import bargeDuSelProjet from './barge-du-sel/barge-du-sel-projet.json';
import diligenceProjet from './diligence/diligence-projet.json';

/** Le paquet d'une campagne du jeu tel que commité, NON PARSÉ : seul le compte de ses scènes se lit
 *  sans la porte (liste de la bibliothèque, comme `SavedProject.project.scenes`). */
interface PaquetDuJeu {
  readonly scenes: readonly unknown[];
}

/** Une campagne du jeu (embarquée au build, pas dans le localStorage) : son identité et son paquet.
 *  #211. */
export interface BuiltinCampaign extends ProjectIdentite {
  /** L'icône est REQUISE sur une campagne exposée au picker (l'enveloppe la pose optionnelle). */
  icon: string;
  paquet: PaquetDuJeu;
  /** Nom du fichier du paquet sous `src/scenes/` (`diligence-projet.json`), tel que ce registre le déclare. */
  fichier: string;
}

/** Le paquet d'une campagne du jeu passé par la porte `parseProject`, AU GESTE : un refus lève
 *  `ProjetRefuse`, laissé à l'appelant. Sa première scène est l'entrée. */
export function paquetDuJeu(c: BuiltinCampaign): Omit<ProjectDoc, 'schema'> {
  return parseProject(structuredClone(c.paquet)); // #2097
}

/** La campagne LANCÉE depuis une campagne du jeu (`setPendingCampaign`), SOURCE UNIQUE de tout site
 *  qui la joue (picker de `PartyScreen`, bibliothèque de campagnes, `__wfrp.campaign`). Son paquet
 *  passe la porte à l'appel (`paquetDuJeu`). */
export function campagneDuJeu(c: BuiltinCampaign): NonNullable<GameState['pendingCampaign']> {
  const { label, scenes, worldMap, activeAxes, narratif } = paquetDuJeu(c);
  return {
    id: c.id,
    label,
    scenes,
    startSceneId: scenes[0].id,
    worldMap: worldMap ?? null,
    ...(activeAxes !== undefined ? { activeAxes } : {}),
    narratif,
  };
}

/** La campagne que lance « Lancer » : celle choisie (`pendingCampaign`), et sans choix (`null`)
 *  l'Arène, lancée par `campagneDuJeu` comme toute campagne du jeu. Un refus lève `ProjetRefuse`. */
export function campagneALancer(choisie: GameState['pendingCampaign']): NonNullable<GameState['pendingCampaign']> {
  return choisie ?? campagneDuJeu(areneCampaign);
}

/** LANCE la campagne `campagneALancer(choisie)` par `loadProject`, SOURCE UNIQUE de « Lancer »
 *  (`PartyScreen`), du repli de défaite (`CampaignView`) et de `__wfrp.campaign` ; `sceneId` remplace
 *  sa scène d'entrée. Rend le refus de la porte énoncé au joueur (`playerEntryError`), `null` quand
 *  la campagne est chargée. */
export function lancerCampagne(get: Get, choisie: GameState['pendingCampaign'], sceneId?: string): string | null {
  let lancee: NonNullable<GameState['pendingCampaign']>;
  try {
    lancee = campagneALancer(choisie);
  } catch (err) {
    return playerEntryError(err, 'jouer');
  }
  get().loadProject(lancee.scenes, sceneId ?? lancee.startSceneId, lancee.worldMap ?? null, lancee.narratif);
  return null;
}

/** Ce qu'OUVRE dans l'éditeur la COPIE d'une campagne du jeu (#367) — SOURCE UNIQUE de `loadBuiltin`
 *  (`ui/editor/Editor.tsx`), qui ne fait que la poser. Tout y est la copie PROFONDE de `paquetDuJeu` : l'édition
 *  ne touche jamais le paquet commité. L'identité est celle du paquet parsé, ENTIÈRE (provenance
 *  comprise), sans le `label`, que l'éditeur renomme ; `activeAxes` n'y figure que si la campagne en
 *  déclare. Un refus de la porte lève `ProjetRefuse`. */
export function copieDuJeu(c: BuiltinCampaign): {
  depart: Scene;
  autresScenes: Scene[];
  worldMap: WorldMap | null;
  activeAxes?: string[];
  narratif: NarratifBlock;
  identite: Omit<ProjectIdentite, 'label'>;
} {
  const { scenes: [depart, ...autresScenes], worldMap, activeAxes, narratif, label: _lb, ...identite } = paquetDuJeu(c);
  return {
    depart,
    autresScenes,
    worldMap: worldMap ?? null,
    ...(activeAxes !== undefined ? { activeAxes } : {}),
    narratif,
    identite,
  };
}

/** Le document PORTABLE d'une campagne du jeu, rendu par son EXPORT (bibliothèque de campagnes).
 *  L'identité est RECONDUITE : un export qui la laisserait tomber rendrait un document anonyme, que
 *  sa propre porte refuserait. Un refus de la porte lève `ProjetRefuse`. */
export function documentDuJeu(c: BuiltinCampaign): ProjectDoc {
  const { scenes, worldMap, activeAxes, narratif, ...identite } = paquetDuJeu(c);
  return documentDeProjet(identite, scenes, { worldMap, activeAxes, narratif });
}

/**
 * Une campagne du jeu, son identité DÉRIVÉE de la racine de son paquet (#1467 L1b V-formeProjet) —
 * jamais re-tapée ici : la DONNÉE fait foi, et le seul moyen de changer l'`icon`/le `label` d'une
 * campagne est d'éditer son générateur (`scripts/<campagne>/generate.mjs`), pas ce fichier. Les champs
 * d'identité sont repris NOMMÉMENT : un spread reconduirait le contenu du paquet dans son identité.
 * `bundled-projects.test.ts` garde la validité des paquets sur disque.
 */
function campagneDuPaquet(paquet: PaquetDuJeu & Readonly<Record<string, unknown>>, fichier: string): BuiltinCampaign {
  const refus = (champ: string): never => {
    throw new Error(`${fichier} : paquet de campagne du jeu sans \`${champ}\` valide à la racine — son identité se lit avant la porte (#1692).`);
  };
  const chaine = (champ: string): string => {
    const v = paquet[champ];
    return typeof v === 'string' && v !== '' ? v : refus(champ);
  };
  const optionnelle = (champ: string): string | undefined => (paquet[champ] === undefined ? undefined : chaine(champ));
  const type = paquet.type === 'projet' ? paquet.type : refus('type');
  const id = chaine('id');
  const label = chaine('label');
  const icon = chaine('icon');
  const versionContenu = typeof paquet.versionContenu === 'number' ? paquet.versionContenu : refus('versionContenu');
  const desc = optionnelle('desc');
  const auteur = optionnelle('auteur');
  const maison = optionnelle('maison');
  const source = paquet.source === undefined ? undefined : sourceRefSchema.parse(paquet.source);
  return {
    type,
    id,
    label,
    icon,
    versionContenu,
    ...(desc !== undefined ? { desc } : {}),
    ...(auteur !== undefined ? { auteur } : {}),
    ...(source !== undefined ? { source } : {}),
    ...(maison !== undefined ? { maison } : {}),
    paquet,
    fichier,
  };
}

/** « La Diligence » — chapitre 1 de L'Ennemi Intérieur : paquet éditeur portant SES scènes (la
 *  première étant l'entrée) et la carte du monde du chapitre. */
export const diligenceCampaign: BuiltinCampaign = campagneDuPaquet(diligenceProjet, 'diligence-projet.json');

/** Campagnes du jeu proposées au picker en plus de l'Arène (la campagne sans choix,
 *  `campagneALancer`). Ajouter une campagne étalon = un item ICI, jamais un chemin parallèle. */
export const builtinCampaigns: BuiltinCampaign[] = [
  campagneDuPaquet(loupEtSaumureProjet, 'loup-et-saumure-projet.json'),
  campagneDuPaquet(bargeDuSelProjet, 'barge-du-sel-projet.json'),
  diligenceCampaign,
];

/** L'Arène, la campagne lancée sans choix (`campagneALancer`), sous la MÊME forme, pour la réutiliser
 *  partout où une liste homogène est nécessaire (#367 : « Ouvrir » de l'éditeur). */
export const areneCampaign: BuiltinCampaign = campagneDuPaquet(areneProjet, 'arene-projet.json');

/** Toutes les campagnes du jeu (Arène + `builtinCampaigns`), source unique pour tout listing
 *  homogène (bibliothèque de campagnes ET « Ouvrir » de l'éditeur, #367). */
export const allBuiltinCampaigns: BuiltinCampaign[] = [areneCampaign, ...builtinCampaigns];
