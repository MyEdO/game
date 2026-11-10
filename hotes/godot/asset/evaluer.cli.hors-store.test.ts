import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { etatsDuGabarit, type EtatDuGabarit } from './etatsDuGabarit.ts';
import { nomDeCleDuGabarit } from './gabarit.ts';
import { formesAvecGabarit, glbFabrique, manifesteDe } from './evaluateur/glbFabrique.testkit.ts';

const racine = fileURLToPath(new URL('../../..', import.meta.url));
const script = fileURLToPath(new URL('./evaluer.mjs', import.meta.url));

for (const [nom, options] of [
  ['exige un manifeste', []],
  ['refuse les facteurs explicites', ['--manifeste', 'manifeste.json', '--facteurs', 'legs=1']],
  ['refuse les silhouettes explicites', ['--manifeste', 'manifeste.json', '--silhouettes', 'feminin=0']],
] as const) test(`--etats-gabarit ${nom}`, () => {
  const resultat = spawnSync(process.execPath, [script, 'base.glb', '--etats-gabarit', ...options], { cwd: racine, encoding: 'utf8', windowsHide: true });
  expect(resultat.status, resultat.stderr).toBe(2);
  expect(resultat.stderr).toMatch(/--etats-gabarit : --manifeste requis, --facteurs et --silhouettes incompatibles/);
});

test('--etats-gabarit évalue chaque état de `etatsDuGabarit` sous ses facteurs, sort en 1 sur un écart et écrit `{ etats: [{ etat, fiche }] }`', () => {
  const octets = glbFabrique({ bande: formesAvecGabarit({ feminin: new Array<number>(9).fill(0) }, { [nomDeCleDuGabarit('arms', 'plus')]: [0, 0, 0, 0, 0, 0, 0, -3, 0] }), clips: { Descend: [0, -0.2] } });
  const manifeste = { ...manifesteDe(octets, ['racine', 'pelvis']), silhouettes: ['feminin'] };
  const dossier = mkdtempSync(join(tmpdir(), 'etats-gabarit-'));
  try {
    const [glb, json, sortie] = ['base.glb', 'manifeste.json', 'sortie.json'].map((f) => join(dossier, f));
    writeFileSync(glb, octets);
    writeFileSync(json, JSON.stringify(manifeste));
    const resultat = spawnSync(process.execPath, [script, glb, '--manifeste', json, '--etats-gabarit', '--json', sortie], { cwd: racine, encoding: 'utf8', windowsHide: true });
    expect(resultat.status, resultat.stderr).toBe(1);
    const lu: { etats: { etat: EtatDuGabarit; fiche: { ecarts: { garde: string }[] } }[] } = JSON.parse(readFileSync(sortie, 'utf8'));
    expect(lu.etats.map((e) => e.etat)).toEqual(JSON.parse(JSON.stringify(etatsDuGabarit(manifeste.gabarit, manifeste.silhouettes))));
    for (const { etat, fiche } of lu.etats) {
      expect(fiche.ecarts.some((e) => e.garde === 'piedsAuSol'), etat.nom).toBe(etat.poidsGabarit[nomDeCleDuGabarit('arms', 'plus')] > 0);
    }
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}, 120_000);

test('--porte exige un manifeste et refuse --silhouettes et --json', () => {
  for (const options of [[], ['--manifeste', 'manifeste.json', '--silhouettes', 'feminin=1'], ['--manifeste', 'manifeste.json', '--json', 'sortie.json']]) {
    const resultat = spawnSync(process.execPath, [script, 'base.glb', '--porte', ...options], { cwd: racine, encoding: 'utf8', windowsHide: true });
    expect(resultat.status, resultat.stderr).toBe(2);
    expect(resultat.stderr).toMatch(/--porte : --manifeste requis, --etats-gabarit, --silhouettes et --json incompatibles/);
  }
});

test('--porte joue le corps neutre puis chaque silhouette déclarée seule à 1, et sort en 1 si une passe a un écart', () => {
  const octets = glbFabrique({ bande: formesAvecGabarit({ feminin: [0, 0, 0, 0, 0, 0, 0, -3, 0], corpulence: new Array<number>(9).fill(0) }, {}), clips: { Descend: [0, -0.2] } });
  const manifeste = { ...manifesteDe(octets, ['racine', 'pelvis']), silhouettes: ['feminin', 'corpulence'] };
  const dossier = mkdtempSync(join(tmpdir(), 'porte-'));
  try {
    const [glb, json] = ['base.glb', 'manifeste.json'].map((f) => join(dossier, f));
    writeFileSync(glb, octets);
    writeFileSync(json, JSON.stringify(manifeste));
    const resultat = spawnSync(process.execPath, [script, glb, '--manifeste', json, '--porte'], { cwd: racine, encoding: 'utf8', windowsHide: true });
    expect(resultat.status, resultat.stderr).toBe(1);
    const passes = [...resultat.stdout.matchAll(/^PASSE (\S+) : code (\d)$/gm)].map((m) => [m[1], Number(m[2])]);
    expect(passes.map(([nom]) => nom)).toEqual(['neutre', 'feminin', 'corpulence']);
    expect(Object.fromEntries(passes).feminin).toBe(1);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}, 120_000);

test('avec --base, refuse un élément sans manifeste d’élément voisin : sa couche ferait défaut à la traversée', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'evaluer-sans-manifeste-'));
  try {
    const element = join(dossier, 'humanoide--vetement--robe.glb');
    writeFileSync(element, glbFabrique());
    const resultat = spawnSync(process.execPath, [script, element, '--base', 'base.glb'], { cwd: racine, encoding: 'utf8', windowsHide: true });
    expect(resultat.status, resultat.stderr).toBe(2);
    expect(resultat.stderr).toContain(`sans manifeste d’élément voisin (<id>.element.json ou <id>.manifeste.json) : ${element}`);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

test('avec --base, lit la couche du manifeste voisin, `couvre` absent d’un accessoire valant aucune zone', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'evaluer-couche-'));
  try {
    const [base, element] = ['base.glb', 'humanoide--accessoire--ceinture.glb'].map((f) => join(dossier, f));
    writeFileSync(base, glbFabrique({ clips: { Repos: [0, 0] } }));
    writeFileSync(element, glbFabrique({ clips: { Repos: [0, 0] } }));
    writeFileSync(join(dossier, 'humanoide--accessoire--ceinture.element.json'), JSON.stringify({ couche: 'tenue' }));
    const resultat = spawnSync(process.execPath, [script, element, '--base', base, '--pas', '0.5'], { cwd: racine, encoding: 'utf8', windowsHide: true });
    expect(resultat.stderr).toBe('');
    expect(resultat.stdout).toMatch(/écart\(s\)/);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}, 120_000);
