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
    const glb = join(dossier, 'base.glb');
    const json = join(dossier, 'manifeste.json');
    const sortie = join(dossier, 'sortie.json');
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

for (const [nom, options, motif] of [
  ['--tenue refuse --preset, qu’elle implique', ['--tenue', 'gladiateur', '--preset', 'gladiateur'], /--tenue : implique --preset, à ne pas donner/],
  ['--local exige --tenue', ['--local', 'a=a.glb'], /--local : --tenue requis/],
  ['--tenue exige la base et son manifeste', ['--tenue', 'gladiateur'], /--tenue : --base et --manifeste requis/],
  ['--poses-rangees exige un seul clip', ['--tenue', 'gladiateur', '--base', 'b.glb', '--manifeste', 'm.json', '--poses-rangees', '--clips', 'A,B'], /--poses-rangees : --tenue ou --preset requis, un seul clip/],
  ['--poses-rangees exige un preset', ['--base', 'b.glb', '--manifeste', 'm.json', '--poses-rangees', '--clips', 'A'], /--poses-rangees : --tenue ou --preset requis/],
] as const) test(nom, () => {
  const resultat = spawnSync(process.execPath, [script, ...options], { cwd: racine, encoding: 'utf8', windowsHide: true });
  expect(resultat.status, resultat.stderr).toBe(2);
  expect(resultat.stderr).toMatch(motif);
});

test('--porte exige un manifeste et refuse --silhouettes', () => {
  for (const options of [[], ['--manifeste', 'manifeste.json', '--silhouettes', 'feminin=1']]) {
    const resultat = spawnSync(process.execPath, [script, 'base.glb', '--porte', ...options], { cwd: racine, encoding: 'utf8', windowsHide: true });
    expect(resultat.status, resultat.stderr).toBe(2);
    expect(resultat.stderr).toMatch(/--porte : --manifeste requis, --etats-gabarit et --silhouettes incompatibles/);
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

test('--temoin refuse --etats-gabarit', () => {
  const resultat = spawnSync(process.execPath, [script, 'base.glb', '--manifeste', 'manifeste.json', '--temoin', 'temoin.json', '--etats-gabarit'], { cwd: racine, encoding: 'utf8', windowsHide: true });
  expect(resultat.status, resultat.stderr).toBe(2);
  expect(resultat.stderr).toMatch(/--temoin : --etats-gabarit incompatible/);
});

test('--porte avec --json écrit le rapport de chaque passe, que --porte avec --temoin relit passe par passe', () => {
  const octets = glbFabrique({ bande: formesAvecGabarit({ feminin: [0, 0, 0, 0, 0, 0, 0, -3, 0] }, {}), clips: { Descend: [0, -0.2] } });
  const manifeste = { ...manifesteDe(octets, ['racine', 'pelvis']), silhouettes: ['feminin'] };
  const dossier = mkdtempSync(join(tmpdir(), 'porte-rapports-'));
  try {
    const [glb, json, mesure] = ['base.glb', 'manifeste.json', 'mesure.json'].map((f) => join(dossier, f));
    writeFileSync(glb, octets);
    writeFileSync(json, JSON.stringify(manifeste));
    const porte = (...options: string[]) => spawnSync(process.execPath, [script, glb, '--manifeste', json, '--porte', ...options], { cwd: racine, encoding: 'utf8', windowsHide: true });
    expect(porte('--json', mesure).status).toBe(1);
    const ecarts = (passe: string): unknown[] => JSON.parse(readFileSync(join(dossier, `mesure.${passe}.json`), 'utf8')).ecarts;
    expect(ecarts('feminin').length).toBeGreaterThan(ecarts('neutre').length);

    const rejouee = porte('--temoin', mesure);
    expect(rejouee.status, rejouee.stdout).toBe(0);
    expect([...rejouee.stdout.matchAll(/^témoin (\d+) écart\(s\), mesure (\d+), neufs (\d+)$/gm)].map((m) => m.slice(1).map(Number)))
      .toEqual(['neutre', 'feminin'].map((passe) => [ecarts(passe).length, ecarts(passe).length, 0]));
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}, 120_000);

test('--temoin ne liste que les écarts absents du rapport témoin, sort en 1 seulement s’il y en a, et --json écrit le rapport complet', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'evaluer-temoin-'));
  try {
    const glb = join(dossier, 'base.glb');
    const temoin = join(dossier, 'temoin.json');
    const vide = join(dossier, 'vide.json');
    const sortie = join(dossier, 'sortie.json');
    writeFileSync(glb, glbFabrique({ clips: { Descend: [0, -0.2] } }));
    writeFileSync(vide, JSON.stringify({ ecarts: [] }));
    const evaluer = (...options: string[]) => spawnSync(process.execPath, [script, glb, '--pas', '0.5', ...options], { cwd: racine, encoding: 'utf8', windowsHide: true });
    expect(evaluer('--json', temoin).status).toBe(1);
    const ecarts: unknown[] = JSON.parse(readFileSync(temoin, 'utf8')).ecarts;
    expect(ecarts.length).toBeGreaterThan(0);

    const sansNeuf = evaluer('--temoin', temoin, '--json', sortie);
    expect(sansNeuf.status, sansNeuf.stderr).toBe(0);
    expect(sansNeuf.stdout).toBe(`témoin ${ecarts.length} écart(s), mesure ${ecarts.length}, neufs 0\n`);
    expect(JSON.parse(readFileSync(sortie, 'utf8')).ecarts).toEqual(ecarts);

    const toutNeuf = evaluer('--temoin', vide);
    expect(toutNeuf.status, toutNeuf.stderr).toBe(1);
    const lignes = toutNeuf.stdout.trimEnd().split('\n');
    expect(lignes[0]).toBe(`témoin 0 écart(s), mesure ${ecarts.length}, neufs ${ecarts.length}`);
    expect(lignes.slice(1)).toHaveLength(ecarts.length);
    expect(lignes.slice(1).every((l) => l.startsWith('['))).toBe(true);

    writeFileSync(join(dossier, 'etats.json'), JSON.stringify({ etats: [] }));
    const pasUnRapport = evaluer('--temoin', join(dossier, 'etats.json'));
    expect(pasUnRapport.status).toBe(2);
    expect(pasUnRapport.stderr).toMatch(/n’est pas le rapport --json d’une évaluation/);
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
