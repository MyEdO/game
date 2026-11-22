/**
 * LE COMMIT DE TRANSFERT (#4338, #4746, `transfert.ts`) : sur un dépôt forgé dont l'arbre de travail porte des fichiers
 * épinglés neufs, ignorés par git (un GLB importé, une texture épinglée), le commit fils de HEAD qui les verse.
 */
import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { envDeDepotForge, instanceDeDepot } from '../../../scripts/guards/lib/depotGabarit.mjs';
import { sha256 } from './empreinte';
import { commandeDEnvoi, fabriquerTransfert, refusDuNom } from './transfert';

const MODELES = 'hotes/godot/projet/modeles';
const TEXTURES = 'hotes/godot/projet/textures';
const BURE = `${MODELES}/humanoide--vetement--bure`;
const GLB = 'glTF bure';
const JPG = 'JFIF laine';
const ANCIEN = 'c'.repeat(64);
const acceptee = () => ({ status: 0, stdout: '', stderr: '' });

const RACINES: string[] = [];
afterEach(() => { for (const r of RACINES.splice(0)) rmSync(r, { recursive: true, force: true }); });

/** Un dépôt forgé dont HEAD épingle `ANCIEN` pour la bure et ne connaît pas `prop--laine.jpg`, et dont l'arbre de
 *  travail porte leurs fichiers neufs, ignorés, et les provenances qui les épinglent. */
function depotAvecEpinglesNeufs(): { racine: string; git: (...args: string[]) => string } {
  const { racine } = instanceDeDepot({ fichiers: {
    '.gitignore': '*.glb\n*.jpg\n',
    [`${BURE}.manifeste.json`]: '{"version":1}',
    [`${BURE}.provenance.json`]: JSON.stringify({ model_sha256: ANCIEN }),
    [`${TEXTURES}/provenance.json`]: '{}',
  } }) as { racine: string };
  RACINES.push(racine);
  writeFileSync(join(racine, `${BURE}.manifeste.json`), '{"version":2}');
  writeFileSync(join(racine, `${BURE}.provenance.json`), JSON.stringify({ model_sha256: sha256(Buffer.from(GLB)) }));
  writeFileSync(join(racine, `${BURE}.glb`), GLB);
  writeFileSync(join(racine, `${TEXTURES}/provenance.json`), JSON.stringify({ 'prop--laine.jpg': { sha256: sha256(Buffer.from(JPG)) } }));
  writeFileSync(join(racine, `${TEXTURES}/prop--laine.jpg`), JPG);
  return { racine, git: (...args) => execFileSync('git', args, { cwd: racine, env: envDeDepotForge(), encoding: 'utf8' }).trim() };
}

describe('fabriquerTransfert', () => {
  it('rend le commit fils de HEAD qui porte les fichiers épinglés et leur provenance, sans toucher l’index ni l’arbre', () => {
    const { racine, git } = depotAvecEpinglesNeufs();
    const head = git('rev-parse', 'HEAD');
    const statut = git('status', '--porcelain');
    const indexJuges: (string | undefined)[] = [];
    const sha = fabriquerTransfert({ racine, fichiers: [`${BURE}.glb`, `${TEXTURES}/prop--laine.jpg`], nom: 'soldat', env: envDeDepotForge(),
      porte: (_fichier, { env }) => (indexJuges.push(env.GIT_INDEX_FILE), acceptee()) });
    expect(git('rev-parse', `${sha}^`)).toBe(head);
    expect(git('show', `${sha}:${BURE}.glb`)).toBe(GLB);
    expect(git('show', `${sha}:${TEXTURES}/prop--laine.jpg`)).toBe(JPG);
    expect(git('diff', '--name-only', head, sha).split('\n'))
      .toEqual([`${BURE}.glb`, `${BURE}.manifeste.json`, `${BURE}.provenance.json`, `${TEXTURES}/prop--laine.jpg`, `${TEXTURES}/provenance.json`]);
    expect(git('rev-parse', 'HEAD'), 'HEAD ne bouge pas').toBe(head);
    expect(git('diff', '--cached', '--name-only'), 'l’index ne change pas').toBe('');
    expect(git('status', '--porcelain'), 'l’arbre de travail ne change pas').toBe(statut);
    expect(git('log', '-1', '--format=%B', sha)).toMatch(/^transfert\/soldat : 2 fichier\(s\) épinglé\(s\) à verser/);
    expect(indexJuges).toHaveLength(1);
    expect(indexJuges[0], 'la porte juge l’index temporaire').toBeTruthy();
  });

  it('ROUGE : refuse un fichier que sa provenance n’épingle pas, un chemin hors des dossiers épinglés, un message refusé, un nom de branche invalide', () => {
    const { racine } = depotAvecEpinglesNeufs();
    const env = envDeDepotForge();
    writeFileSync(join(racine, `${TEXTURES}/prop--laine.jpg`), 'JFIF autre');
    expect(() => fabriquerTransfert({ racine, fichiers: [`${TEXTURES}/prop--laine.jpg`], nom: 'laine', env, porte: acceptee }))
      .toThrow(new RegExp(`prop--laine\\.jpg : sa provenance épingle ${sha256(Buffer.from(JPG))}, le fichier est ${sha256(Buffer.from('JFIF autre'))}`));
    expect(() => fabriquerTransfert({ racine, fichiers: ['ailleurs/x.jpg'], nom: 'laine', env, porte: acceptee })).toThrow(/ni le GLB d'un modèle/);
    expect(() => fabriquerTransfert({ racine, fichiers: [`${BURE}.glb`], nom: 'soldat', env, porte: () => ({ status: 1, stdout: '', stderr: 'sujet refusé' }) }))
      .toThrow(/porte du commit : sujet refusé/);
    expect(refusDuNom('deux..points')).toMatch(/ne nomme pas une branche/);
    expect(() => fabriquerTransfert({ racine, fichiers: [`${BURE}.glb`], nom: 'deux..points', env, porte: acceptee })).toThrow(/ne nomme pas une branche/);
  });

  it('dit la commande qui pousse le commit en branche transfert, sans la lancer', () => {
    expect(commandeDEnvoi('c0ffee', 'soldat')).toBe('git push origin c0ffee:refs/heads/transfert/soldat');
    expect(refusDuNom('soldat')).toBeNull();
  });
});
