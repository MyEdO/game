import { flowStakeRef } from '../data';
import { rule } from '../engine/policy';
import { t } from '../i18n';
import { EMPTY_FLOW, flowFromEffects, testFlow, type Flow } from './flow';
import {
  casesDeFace, porteMasquee, porteTentee, sceneMetresPerTile, secretAuteur,
  type Effect, type FaceDArete, type Scene, type Trigger, type WallSeg,
} from './scene';
import { rayonEnCases } from './vision';
import type { RoomFocus } from './rooms';

/**
 * DÉCOUVERTE d'une porte secrète — `EDO 08 l.402`, `LDB 09 l.399`, `LDB 12 l.189` ; arbitrage utilisateur
 * #700 (2026-09-29, commentaires 5896287794 et 5896407205) : « Les deux » déclencheurs, « Une seule
 * (Recommandé) — Un échec est définitif pour cette porte », « Exploration seulement (Recommandé) ».
 * UNE définition par porte (`testDePorteSecrete`), jouée par ses déclencheurs : à l'APPROCHE, un Trigger
 * de zone DÉRIVÉ de l'arête (`triggersDePortesSecretes`), lu par `checkTriggers` via `triggersEnJeu` ; en
 * FOUILLANT la pièce (`fouilleDeLaPiece`), joué par le verbe `fouillerLaPiece` (`store.ts`).
 */

/** Porte secrète encore à DÉCOUVRIR : masquée ET jamais tentée. */
export function porteADecouvrir(scene: Pick<Scene, 'flags'>, seg: WallSeg): boolean {
  return porteMasquee(scene, seg) && !porteTentee(scene, seg);
}

/** Le Flow de découverte d'une porte secrète : la marque « tentée » (PREMIÈRE étape, posée avant le dé),
 *  puis le Test de Perception à la difficulté de la porte (meilleur PJ + Soutien, `openSkillTest`).
 *  Réussite = porte révélée + ligne de journal ; échec = rien. Refuse une arête sans porte secrète. */
export function testDePorteSecrete(seg: WallSeg): Flow {
  const secret = secretAuteur(seg);
  if (!secret) throw new Error(`testDePorteSecrete : l'arête (${seg.x},${seg.y},${seg.side}) ne porte pas de porte secrète`);
  const arete = { type: 'setDoor', x: seg.x, y: seg.y, side: seg.side, z: seg.z ?? 0 } as const;
  return {
    kind: 'seq',
    steps: [
      { kind: 'do', effect: { ...arete, attempted: true } as Effect },
      testFlow(
        { skill: { id: 'perception' }, difficulty: secret.difficulty, label: t('eff.porteSecreteTest'), stake: flowStakeRef('perception-detect') },
        flowFromEffects([{ ...arete, revealed: true }, { type: 'journal', desc: t('eff.porteSecreteTrouvee') }] as Effect[]),
        EMPTY_FLOW,
      ),
    ],
  };
}

/** Profondeur (en cases) de la zone d'approche : `porte-secrete-rayon-m` (maison) converti par l'échelle
 *  de la scène (`rayonEnCases`), arrondi à l'inférieur, au minimum 1 — la case qui borde l'arête. */
export function profondeurDApproche(scene: Pick<Scene, 'metresPerTile'>): number {
  return Math.max(1, Math.floor(rayonEnCases(rule('porte-secrete-rayon-m') as number, sceneMetresPerTile(scene))));
}

/** Rectangle des cases de la face `face` à ≤ `n` cases de l'arête (Chebyshev depuis la case qui la
 *  borde), à l'étage de l'arête. `N` : porteuse au sud (`y`…), voisine au nord ; `E` : porteuse à
 *  l'ouest (…`x`), voisine à l'est. Une cloison oblique n'a pas de zone d'approche (`undefined`). */
function rectDApproche(seg: WallSeg, face: FaceDArete, n: number): Trigger['rect'] | undefined {
  const z = seg.z ?? 0;
  const profondeur = face === 'les-deux' ? 2 * n : n;
  if (seg.side === 'N') return { x: seg.x - n + 1, y: face === 'porteuse' ? seg.y : seg.y - n, w: 2 * n - 1, h: profondeur, z };
  if (seg.side === 'E') return { x: face === 'voisine' ? seg.x + 1 : seg.x - n + 1, y: seg.y - n + 1, w: profondeur, h: 2 * n - 1, z };
  return undefined;
}

/** Id STABLE du Trigger dérivé d'une arête : `scene.id` encodé (aucune virgule — `evalCondition` découpe
 *  l'expression de drapeau `__trigger_<id>` sur `,`) + l'arête. */
export function idDeTriggerDePorte(scene: Pick<Scene, 'id'>, seg: WallSeg): string {
  return `porte-secrete~${encodeURIComponent(scene.id)}~${seg.x}~${seg.y}~${seg.side}~${seg.z ?? 0}`;
}

/** Triggers DÉRIVÉS des portes secrètes à découvrir (`porteADecouvrir`) : un par arête dont une case de
 *  la face découvrable est VUE par le groupe (`casesVues`, clés `"x,y,z"` de la vision canonique
 *  `computeStateVisible` — lumière, fumée, murs). `casesVues` n'est évalué que si une porte est à
 *  découvrir. Aucun `once` : la marque « tentée » de `testDePorteSecrete` retire la porte. PUR. */
export function triggersDePortesSecretes(scene: Scene, casesVues: () => ReadonlySet<string>): Trigger[] {
  const portes = (scene.walls ?? []).filter((w) => porteADecouvrir(scene, w));
  if (!portes.length) return [];
  const vues = casesVues();
  const n = profondeurDApproche(scene);
  const out: Trigger[] = [];
  for (const seg of portes) {
    const face = secretAuteur(seg)!.face;
    const rect = rectDApproche(seg, face, n);
    if (!rect) continue;
    if (!casesDeFace(seg, face).some((c) => vues.has(`${c.x},${c.y},${rect.z}`))) continue;
    out.push({ id: idDeTriggerDePorte(scene, seg), rect, flow: testDePorteSecrete(seg) });
  }
  return out;
}

/** Les Triggers EN JEU d'une scène : authorés (`scene.triggers`) puis dérivés des portes secrètes.
 *  Seul lecteur runtime : `checkTriggers`. Un dérivé ne se dessine jamais. */
export function triggersEnJeu(scene: Scene, casesVues: () => ReadonlySet<string>): Trigger[] {
  const derives = triggersDePortesSecretes(scene, casesVues);
  return derives.length ? [...scene.triggers, ...derives] : scene.triggers;
}

/** Portes à découvrir (`porteADecouvrir`) que FOUILLER la pièce `piece` vise : arête à l'étage de la
 *  pièce dont une case de la face découvrable (`casesDeFace`) appartient à la pièce. */
export function portesDeLaPiece(scene: Scene, piece: RoomFocus): WallSeg[] {
  return (scene.walls ?? []).filter((seg) => porteADecouvrir(scene, seg)
    && (seg.z ?? 0) === piece.z
    && casesDeFace(seg, secretAuteur(seg)!.face).some((c) => piece.tiles.has(`${c.x},${c.y},${piece.z}`)));
}

/** Le Flow du geste « Fouiller la pièce » : la découverte (`testDePorteSecrete`) de chaque porte visée,
 *  en UNE séquence — chacune sa difficulté. Aucune porte visée : le Flow VIDE. */
export function fouilleDeLaPiece(scene: Scene, piece: RoomFocus): Flow {
  const portes = portesDeLaPiece(scene, piece);
  return portes.length ? { kind: 'seq', steps: portes.map(testDePorteSecrete) } : EMPTY_FLOW;
}
