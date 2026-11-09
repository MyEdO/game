import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { SOUND_DEFS } from './_registry.generated';

/** Les fichiers que le projet Godot épingle sous `res://sons/` (`hotes/godot/asset/epingles.ts`, #3771). */
const EPINGLES = new Set(Object.keys(JSON.parse(readFileSync(new URL('../../../hotes/godot/projet/sons/provenance.json', import.meta.url), 'utf8')) as object));

describe('les sons du registre sous Godot (#3771)', () => {
  it('chaque fichier d’un effet sonore est épinglé au projet Godot', () => {
    const manquants = SOUND_DEFS.filter((d) => !d.music).flatMap((d) => d.files.filter((f) => !EPINGLES.has(f)).map((f) => `${d.id} : ${f}`));
    expect(manquants).toEqual([]);
  });
});
