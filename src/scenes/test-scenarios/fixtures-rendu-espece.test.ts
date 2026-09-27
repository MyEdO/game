import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { testScenarios } from './index';
import { tokenBodyKind } from '../../gameIso/tokenBodyKind';
import { resetDiagOnce } from '../../gameIso/rig/devDiag';
import { spawnEnemy } from '../../state/spawn';
import { enemyRigProfile } from '../../gameIso/rig/enemyProfile';
import { useGame } from '../../state/store';
import { ficheDEntite } from '../../state/sceneNpc';
import { findCreatureById } from '../../data';
import type { SceneEntity } from '../../state/scene';

/**
 * Chaque personnage AUTHORÉ d'un scénario de test doit être rendable par SA donnée : réf de créature,
 * ou Espèce explicite (`appearance.species`). Le pipeline de rendu diagnostique le manque en console
 * (`[rig]`, `[bodyPlan]`, `[tokenBodyKind]`) — un scénario livré avec un de ces diagnostics oblige toute
 * recette navigateur à trier le bruit avant de lire ses vraies erreurs (#936).
 *
 * Les DEUX chemins de rendu sont exercés (ils lisent l'espèce dans des champs différents) : entité de
 * scène (exploration/éditeur) et combattant spawné (combat, membres de rencontre seulement).
 *
 * Périmètre : la donnée de SCÉNARIO. Une entité dont la `ref` désigne un record de bestiaire existant
 * est rendue par le catalogue (`src/data/creatures.json`) — ce que ce record déclare relève de lui.
 */
const persos = (s: (typeof testScenarios)[number]): SceneEntity[] =>
  [s.scene, ...(s.extraScenes ?? [])].flatMap((sc) => sc.entities.filter((e) => e.kind === 'personnage'));

/** L'apparence de cette entité est décidée par le SCÉNARIO (pas de record de bestiaire derrière la réf). */
const authoreIci = (ent: SceneEntity): boolean => !ent.ref || !findCreatureById(ent.ref);

/** Scénarios dont les personnages s'authorent AILLEURS que dans ce dossier : l'Arène est un projet de
 *  campagne GÉNÉRÉ (`scripts/arene/*.mjs` → `src/scenes/arene/arene-projet.json`), corrigé dans son
 *  générateur puis régénéré — cf. #936 (13 personnages à espèce, dont 2 Nuées de statbloc). */
const AUTHORES_AILLEURS = new Set(['arene']);

describe('scénarios de test — aucun personnage sans espèce résolue (#936)', () => {
  let err: ReturnType<typeof vi.spyOn>;
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    resetDiagOnce();
    err = vi.spyOn(console, 'error').mockImplementation(() => {});
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    err.mockRestore();
    warn.mockRestore();
    useGame.setState({ campaignNarratif: null });
  });

  it.each(testScenarios.filter((s) => !AUTHORES_AILLEURS.has(s.id)).map((s) => [s.id, s] as const))('le scénario %s rend ses personnages sans diagnostic de donnée', (id, s) => {
    useGame.setState({ campaignNarratif: s.narratif ?? null }); // presets de PNJ du scénario (posés au lancement)
    const enroles = new Set(
      [s.scene, ...(s.extraScenes ?? [])].flatMap((sc) => sc.encounters.flatMap((e) => (e.members ?? []).map((m) => m.entityId))),
    );
    for (const ent of persos(s).filter(authoreIci)) {
      tokenBodyKind({ kind: 'sceneEntity', ent, enrolled: enroles.has(ent.id) });
      if (!enroles.has(ent.id)) continue; // un figurant qui n'entre jamais en combat n'est jamais spawné
      tokenBodyKind({ kind: 'combatant', combatant: ficheDEntite(ent) }); // la fiche que spawne `combatSlice`
    }
    const dits = [...err.mock.calls, ...warn.mock.calls].map((c) => String(c[0]));
    expect(dits, `scénario « ${id} » : ${dits.join(' | ')}`).toEqual([]);
  });

  it('le mannequin d’entraînement rend le MÊME profil qu’avant l’espèce posée (seules la chaîne species et le tirage individuel de sa race changent)', () => {
    const sb = { type: 'statblock' as const, label: "Mannequin d'entraînement", char: { M: 0, endurance: 35, B: 40 } };
    const avant = enemyRigProfile(spawnEnemy({ statblock: sb }, 'm', { x: 0, y: 0 }));
    const apres = enemyRigProfile(spawnEnemy({ statblock: sb }, 'm', { x: 0, y: 0 }, { appearance: { species: 'humains-reiklander' } }));
    expect(apres?.appearance.species).toBe('humains-reiklander');
    // `uid` d'objet = compteur de PROCESSUS (`w-it-<n>`) : sa valeur dépend de tout ce qui a spawné avant
    // dans le fichier de test ET de l'ordre de la suite. Toute comparaison de profil le neutralise.
    const stable = (e: unknown): string => JSON.stringify(e).replace(/"uid":"[^"]*"/g, '"uid":""');
    // L'espèce posée (race `humain`) ajoute le tirage individuel (`tirageIndividuel`, #1882) que la race de REPLI ne tire pas.
    expect(avant!.appearance.colors).toBeUndefined();
    expect(apres!.appearance.colors).toBeDefined();
    const horsTirage = (a: object) => ({ ...a, species: '', colors: undefined, parts: undefined });
    expect(stable(horsTirage(apres!.appearance))).toBe(stable(horsTirage(avant!.appearance)));
    expect(stable(apres!.equip)).toBe(stable(avant!.equip));
    expect(apres!.tenue).toEqual(avant!.tenue);
  });
});
