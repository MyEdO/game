import { describe, expect, it } from 'vitest';
import { actorBillboards, collectBillboards, combatantRenderSignature } from './sceneMeshes';
import { buildTokens } from '../../builders/tokens';
import { buildProps } from '../../builders/props';
import { combatantTokenScale, footprintTokenScale, sizeTokenScale } from '../../sizeScale';
import { tokenBodyKind } from '../../tokenBodyKind';
import { parseProject } from '../../../state/worldMap';
import { creatureToCombatant } from '../../../state/spawn';
import { emptyScene, sceneMetresPerTile, type Scene, type SceneEntity } from '../../../state/scene';
import { creatures } from '../../../data';
import type { BattleState } from '../../../state/store';
import type { Combatant } from '../../../engine/types';
import { lireProjetLivre } from '../../../../scripts/source/projetLivre.mjs';

/**
 * PARITÉ DES DEUX VOIES DE RENDU DU MONDE (#1176) : ce que le monde VOLUMIQUE dessine doit être ce que
 * le stage AFFINE dessine — même population de corps, même échelle. Les deux mesures ci-dessous sont
 * celles qui ont RÉFUTÉ le lot P2-2 :
 *  - POPULATION : la voie volumique lisait `scene.entities` en direct, sans AUCUN des filtres du
 *    builder — 16 ennemis d'embuscade visibles avant leur combat sur les trois scènes d'exploration de
 *    l'arène, et une entité enrôlée dessinée deux fois pendant le combat ;
 *  - ÉCHELLE : elle jetait l'échelle d'ART de l'espèce (`resolveRender().scale`) pour ne garder que la
 *    catégorie de Taille.
 */
const doc = parseProject(lireProjetLivre('arene/arene-projet.json'));

/**
 * Scène CONSTRUITE pour ce contrat : deux figurants VISIBLES et deux EMBUSQUÉS
 * (`combat.hiddenUntilCombat`) sur un plain-pied nu. La propriété — « la voie volumique dessine les
 * corps du BUILDER, pas la scène brute » — ne dépend d'aucune carte jouée, ni de son roster, ni de
 * son compte : c'est la fixture qui porte les cas.
 */
function sceneEmbuscade(): Scene {
  const perso = (id: string, x: number, embusque: boolean): SceneEntity => ({
    id,
    kind: 'personnage',
    pos: { x, y: 1 },
    ref: 'villageois',
    ...(embusque ? { combat: { hiddenUntilCombat: true } } : {}),
  });
  return {
    ...emptyScene(8, 4),
    id: 'fixture-embuscade',
    entities: [perso('vu-1', 1, false), perso('vu-2', 2, false), perso('embusque-1', 5, true), perso('embusque-2', 6, true)],
  };
}


/** Tout est en vue : la population mesurée est celle des FILTRES, pas celle du brouillard. */
function toutVu(scene: Scene): Set<string> {
  const out = new Set<string>();
  for (const l of scene.layers)
    for (let y = 0; y < scene.dimensions.h; y++)
      for (let x = 0; x < scene.dimensions.w; x++) out.add(`${x},${y},${l.z}`);
  return out;
}

/** Éléments du stage pour une scène — la loi de la voie affine, celle que l'hôte du monde applique
 *  (`stage/MondeDeCampagne`). */
function elsDuStage(scene: Scene, battle: BattleState | null) {
  const visible = toutVu(scene);
  const vue = { activeZ: Math.max(...scene.layers.map((l) => l.z)), viewZ: null, top: false };
  return { tokens: buildTokens(scene, visible, battle, vue), props: buildProps(scene, visible, vue) };
}

/** Ids d'entités d'embuscade d'une scène. */
const embusques = (scene: Scene): string[] => scene.entities.filter((e) => e.combat?.hiddenUntilCombat).map((e) => e.id);
/** Ids des personnages que la voie FAUTIVE dessinait : la scène brute, sans filtre. */
const persosBruts = (scene: Scene): string[] => scene.entities.filter((e) => e.kind === 'personnage').map((e) => e.id);
/** Ids des personnages billboardés par la voie volumique. L'identité d'un figurant porte SA
 *  signature de dessin après le `|` (son ambiance authorée, comme celle d'un décor porte sa réf) :
 *  l'id d'entité est ce qui la précède. */
const persosBillboardés = (subs: { kind: string; identity: string }[]): string[] =>
  subs.filter((s) => s.kind === 'personnage').map((s) => s.identity.replace(/^perso:/, '').split('|')[0]);

describe('POPULATION — le monde volumique dessine les corps du builder, pas la scène brute', () => {
  it('la fixture porte les DEUX cas — des figurants visibles et des embusqués (sinon la mesure ne pèserait rien)', () => {
    const scene = sceneEmbuscade();
    expect(embusques(scene).length).toBeGreaterThan(0);
    expect(persosBruts(scene).filter((id) => !embusques(scene).includes(id)).length).toBeGreaterThan(0);
  });

  it('hors combat, AUCUN embusqué n’est billboardé — et les figurants visibles le sont tous', () => {
    const scene = sceneEmbuscade();
    const rendus = persosBillboardés(collectBillboards(scene, sceneMetresPerTile(scene), elsDuStage(scene, null)));
    const cachés = embusques(scene);
    expect(rendus.filter((rid) => cachés.includes(rid))).toEqual([]);
    // La mesure MORD : la lecture BRUTE de `scene.entities` en montrait exactement les embusqués de plus.
    expect(persosBruts(scene).filter((pid) => !rendus.includes(pid)).sort()).toEqual([...cachés].sort());
  });

  /** La MÊME propriété relue sur la géométrie livrée : entrée RÉELLE, attente DÉRIVÉE de l'entrée
   *  (les deux voies comparées l'une à l'autre) — aucun roster ni aucun compte n'est écrit ici. */
  it('sur toute scène livrée du paquet, les deux voies montent les MÊMES corps (un pour un)', () => {
    for (const scene of doc.scenes) {
      const els = elsDuStage(scene, null);
      const affine = els.tokens
        .filter((t) => t.subject.kind === 'figurant' && t.subject.ent.kind === 'personnage')
        .map((t) => t.id)
        .sort();
      const volumique = persosBillboardés(collectBillboards(scene, sceneMetresPerTile(scene), els)).sort();
      expect([scene.id, volumique]).toEqual([scene.id, affine]);
    }
  });

  it('en COMBAT, une entité enrôlée n’est PAS dessinée deux fois (billboard de scène + acteur)', () => {
    const scene = sceneEmbuscade();
    const mpt = sceneMetresPerTile(scene);
    const ent = scene.entities.find((e) => e.kind === 'personnage' && !e.combat?.hiddenUntilCombat)!;
    const enrôlé = creatureToCombatant(creatures[0], ent.id, { x: ent.pos.x, y: ent.pos.y, z: ent.z ?? 0 });
    const battle = { combatants: [enrôlé], order: [enrôlé.id], turn: 0 } as unknown as BattleState;
    const subs = collectBillboards(scene, mpt, elsDuStage(scene, battle));
    const acteurs = actorBillboards([{ c: enrôlé, x: ent.pos.x, y: ent.pos.y, z: ent.z ?? 0 }], scene, mpt);
    expect(persosBillboardés(subs)).not.toContain(ent.id);
    // Un seul acteur, ancré sur SON id — la suite de l'identité est la signature de dessin
    // (`combatantRenderSignature`, cf. `actor-signature.test.ts`).
    expect(acteurs.map((a) => a.identity)).toEqual([`acteur:${enrôlé.id}|${combatantRenderSignature(enrôlé)}`]);
  });
});

describe('ÉCHELLE — la même pour les deux voies, sur TOUT le bestiaire', () => {
  // La scène n'est ici qu'un repère (échelle + sol) : une fixture nue suffit, le sujet est le bestiaire.
  const scene = emptyScene(8, 4);
  const mpt = sceneMetresPerTile(scene);

  /** Facteur d'échelle du jeton dans le repère SVG de référence : le `speciesScale` du
   *  classifieur de corps × la catégorie de Taille (ou l'empreinte propre). La base 0,62 est du SVG. */
  const echelleAffine = (c: Combatant): number =>
    tokenBodyKind({ kind: 'combatant', combatant: c }).speciesScale
    * (c.footprint ? footprintTokenScale(c.footprint) : sizeTokenScale(c.size));

  it('tout le bestiaire rend le MÊME facteur des deux côtés — 0 créature divergente', () => {
    const divergentes: { id: string; affine: number; volumique: number }[] = [];
    let mesurées = 0;
    for (const record of creatures) {
      const c = creatureToCombatant(record, `p-${record.id}`, { x: 1, y: 1, z: 0 });
      const volumique = actorBillboards([{ c, x: 1, y: 1, z: 0 }], scene, mpt)[0];
      if (!volumique) continue; // structure de siège : elle se rend sur son arête, pas en jeton
      mesurées++;
      const affine = echelleAffine(c);
      if (Math.abs(affine - volumique.scaleK) > 1e-9) divergentes.push({ id: record.id, affine, volumique: volumique.scaleK });
    }
    expect(mesurées).toBeGreaterThan(400); // la population mesurée est bien le bestiaire entier
    expect(divergentes).toEqual([]);
  });

  it('l’échelle d’ESPÈCE pèse vraiment : une part du bestiaire sort de la table de Taille', () => {
    // Sans elle, `scaleK` retomberait sur `sizeTokenScale(size)` seul — c'était le défaut mesuré.
    const horsTable = creatures.filter((record) => {
      const c = creatureToCombatant(record, `q-${record.id}`, { x: 1, y: 1, z: 0 });
      return Math.abs(combatantTokenScale(c) - sizeTokenScale(c.size)) > 1e-9;
    });
    expect(horsTable.length).toBeGreaterThan(100);
  });
});
