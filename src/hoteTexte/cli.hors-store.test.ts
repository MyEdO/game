/**
 * LE REJEU PAR LA LIGNE DE COMMANDE (#2898, plan v3 étape 6, recadrage M-C et m8) : le combat d'arène committé
 * (`src/hoteTexte/combat-dome.jsonl`) est rejoué par `scripts/hote-texte.mjs`, une partie par processus. Le premier
 * processus y joue une Charge par `offre` ; le second rejoue le fichier allongé et rend la même projection et la même
 * empreinte, la Charge armée. Deux processus seulement : chaque appel coûte le chargement du module runner.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Projection } from './vue';

const RACINE = fileURLToPath(new URL('../..', import.meta.url));
const COMBAT = join(RACINE, 'src/hoteTexte/combat-dome.jsonl');

let dossier: string;
let partie: string;

/** Une commande de l'hôte, dans son propre processus, en `--json`. */
function hote(...argv: string[]): { code: number | null; json: Record<string, unknown>; brut: string } {
  const r = spawnSync(process.execPath, [join(RACINE, 'scripts/hote-texte.mjs'), '--partie', partie, ...argv, '--json'], { cwd: RACINE, encoding: 'utf8', timeout: 120_000 });
  const brut = `${r.stdout}${r.stderr}`;
  return { code: r.status, json: r.stdout.trim() ? (JSON.parse(r.stdout) as Record<string, unknown>) : {}, brut };
}

beforeAll(() => {
  dossier = mkdtempSync(join(tmpdir(), 'hote-texte-'));
  partie = join(dossier, 'combat.jsonl');
  copyFileSync(COMBAT, partie);
});
afterAll(() => rmSync(dossier, { recursive: true, force: true }));

describe('le combat d’arène committé, rejoué par la CLI', () => {
  it('une Charge par `offre` s’écrit au fichier ; le processus suivant rend la même vue et la même empreinte, la Charge armée', { timeout: 240_000 }, () => {
    const lignes = readFileSync(partie, 'utf8').trimEnd().split('\n').length;
    const charge = hote('offre', 'charge');
    expect(charge.code, charge.brut).toBe(0);
    expect(readFileSync(partie, 'utf8').trimEnd().split('\n'), 'la Charge appliquée n’est pas écrite au fichier').toHaveLength(lignes + 1);

    const vue = hote('vue');
    expect(vue.code, vue.brut).toBe(0);
    expect(vue.json.projection, 'deux rejeux, deux vues').toEqual(charge.json.projection);
    expect(vue.json.empreinte, 'deux rejeux, deux empreintes').toBe(charge.json.empreinte);
    const combat = (vue.json.projection as Projection).combat!;
    expect(combat.intention, 'le processus suivant ne voit pas la Charge armée').toBe('charge');
    // Les tours de l'IA du Round 1 ne se jouent que par la reprise des jetons : sans elle, aucun Round 2.
    expect(combat.round, 'les jetons ne sont pas repris : le combat n’a pas avancé').toBe(2);
  });
});
