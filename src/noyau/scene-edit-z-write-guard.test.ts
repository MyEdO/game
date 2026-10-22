import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scanSceneEditZWrites } from '../../scripts/guards/lib/sceneEditZWrite.mjs';

/**
 * Garde-fou « écriture du z sur `sceneEdit.ts` » (#835 FU-1/FU-3) — la racine mesurée du ticket :
 * 8 champs `z` existent au modèle (`Trigger.rect.z`, `restZones[].rect.z`, `SceneEffectZone.z`,
 * `SceneEntity.z`…) et l'éditeur n'en écrivait que 3, SILENCIEUSEMENT — rien ne cassait à la
 * compilation quand une primitive `addX`/`pasteX` poussait un élément frais sans paramètre `z`.
 * Scan AST réelle (compilateur TypeScript, `scripts/guards/lib/sceneEditZWrite.mjs`) — TOLÉRANCE
 * ZÉRO : toute future primitive qui pousse dans `entities`/`triggers`/`restZones`/`effectZones`
 * DOIT déclarer un paramètre `z`.
 */

const SCENE_EDIT_PATH = fileURLToPath(new URL('./sceneEdit.ts', import.meta.url));

describe('garde-fou « écriture du z sur sceneEdit.ts » (AST, tolérance zéro)', () => {
  it('aucune primitive exportée de sceneEdit.ts ne pousse dans une collection z-portante sans paramètre `z`', () => {
    const findings = scanSceneEditZWrites(readFileSync(SCENE_EDIT_PATH, 'utf8'));
    expect(
      findings,
      'Primitive qui pousse dans une collection z-portante (entities/triggers/restZones/effectZones) ' +
        `sans paramètre \`z\` — l'omission est SILENCIEUSE (#835) :\n${findings.map((f) => `${f.name} (scene.${f.prop}) L${f.line}`).join('\n')}`,
    ).toEqual([]);
  });

  it('fail-closed : le scanner détecte une écriture SYNTHÉTIQUE omettant le z', () => {
    const regressed = `
      export function addSomething(scene, rect) {
        return { scene: { ...scene, triggers: [...scene.triggers, { id: 'x', rect, once: true }] }, id: 'x' };
      }
    `;
    expect(scanSceneEditZWrites(regressed).length).toBe(1);
  });

  it('fail-closed : une primitive avec paramètre `z` explicite passe', () => {
    const ok = `
      export function addSomething(scene, rect, z = 0) {
        return { scene: { ...scene, triggers: [...scene.triggers, { id: 'x', rect: { ...rect, z }, once: true }] }, id: 'x' };
      }
    `;
    expect(scanSceneEditZWrites(ok).length).toBe(0);
  });

  it('fail-closed : une fonction qui ne TOUCHE pas une collection z-portante ne remonte rien', () => {
    const unrelated = `
      export function setSceneFlags(scene, patch) {
        return { ...scene, flags: { ...scene.flags, ...patch } };
      }
    `;
    expect(scanSceneEditZWrites(unrelated).length).toBe(0);
  });
});
