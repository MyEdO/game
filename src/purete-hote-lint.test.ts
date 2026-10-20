/**
 * BANC DU MUR SANS HÔTE (#2817, AGENTS.md règle 3) : `src/engine` et `src/noyau` ne tirent ni entropie,
 * ni horloge murale, ni service du navigateur — l'hôte les fournit ; dans tout `src/`, `Math.random` ne
 * s'écrit qu'à `src/web/entropie.ts`. Le banc lance les murs `murs/sans-hote`, `murs/sans-hote-syntaxe`,
 * `murs/sans-hote-globale` et `murs/entropie` (`oxlint.config.mjs`, patron `murs/alea-serveur`) sur la
 * config RÉELLE, et sélectionne par `ruleId` : un sélecteur trop étroit rendrait le vert par vacuité.
 * Les minuteries et le stockage web restent à `murs/minuteries` et `murs/stockage-web-global`.
 * ANGLES MORTS (communs au patron canonique) : l'alias (`const M = Math; M.random()`,
 * `const D = Date; new D()`) et la réflexion (`Reflect.get(Math, 'random')`).
 */
import { describe, it, expect } from 'vitest';
import { creerBancLint, selectionnerMessages } from '../scripts/guards/lib/lint.testkit.mjs';

const banc = creerBancLint();
const MURS = new Set(['murs/sans-hote', 'murs/sans-hote-syntaxe', 'murs/sans-hote-globale', 'murs/entropie']);

async function pris(code: string, filePath: string, murs: ReadonlySet<string> = MURS): Promise<number> {
  const [res] = await banc.lintText(code, { filePath });
  return selectionnerMessages(res, (m) => murs.has(m.ruleId ?? '')).length;
}

const SOUS_LE_MUR = ['src/noyau/__sonde-purete.ts', 'src/noyau/monde/__sonde-purete.ts', 'src/engine/__sonde-purete.ts'];

const TIRAGES: [nom: string, code: string][] = [
  ['Math.random', 'export const a = Math.random();\n'],
  ['globalThis.Math.random', 'export const a = globalThis.Math.random();\n'],
  ['Math["random"]', 'export const a = Math["random"]();\n'],
  ['{ random } = Math', 'const { random } = Math; export const a = random();\n'],
];

const INTERDITS: [nom: string, code: string][] = [
  ...TIRAGES,
  ['Date.now', 'export const a = Date.now();\n'],
  ['globalThis.Date.now', 'export const a = globalThis.Date.now();\n'],
  ['new globalThis.Date()', 'export const a = new globalThis.Date().getTime();\n'],
  ['new Date()', 'export const a = new Date().getTime();\n'],
  ['new Date', 'export const a = (new Date).getTime();\n'],
  ['new Date(Date.now())', 'export const a = new Date(Date.now());\n'],
  ['Date()', 'export const a = Date();\n'],
  ['performance', 'export const a = performance.now();\n'],
  ['globalThis.performance', 'export const a = globalThis.performance.now();\n'],
  ['crypto', 'export const a = crypto.randomUUID();\n'],
  ['self.crypto', 'export const a = self.crypto.randomUUID();\n'],
  ['window', 'export const a = window.innerWidth;\n'],
  ['global', 'export const a = global;\n'],
  ['document', 'export const a = document.title;\n'],
  ['navigator', 'export const a = navigator.language;\n'],
  ['location', 'export const a = location.href;\n'],
  ['fetch', 'export const a = fetch;\n'],
  ['indexedDB', 'export const a = indexedDB;\n'],
  ['process', 'export const a = process.hrtime();\n'],
  ['queueMicrotask', 'queueMicrotask(() => {});\n'],
  ['requestIdleCallback', 'export const a = requestIdleCallback;\n'],
  ['requestAnimationFrame', 'export const a = requestAnimationFrame;\n'],
];

const PERMIS: [nom: string, code: string][] = [
  ['une date nommée', 'export const a = new Date(0).getTime();\n'],
  ['un champ homonyme', 'export const a = (w: { window?: boolean }) => !!w.window;\n'],
  ['une clé homonyme', 'export const a = { document: 1, window: true };\n'],
  ['un paramètre homonyme', 'export const a = (navigator: number) => navigator + 1;\n'],
];

describe('mur sans hôte — le moteur et le noyau tournent sans hôte (#2817)', () => {
  for (const fichier of SOUS_LE_MUR) {
    for (const [nom, code] of INTERDITS) {
      it(`${fichier} : \`${nom}\` est refusé`, async () => {
        expect(await pris(code, fichier)).toBeGreaterThan(0);
      });
    }
    for (const [nom, code] of PERMIS) {
      it(`${fichier} : ${nom} passe`, async () => {
        expect(await pris(code, fichier)).toBe(0);
      });
    }
  }

  for (const fichier of ['src/ui/__sonde-purete.tsx', 'src/audio/__sonde-purete.ts', 'src/state/__sonde-purete.ts', 'src/web/__sonde-purete.ts']) {
    for (const [nom, code] of TIRAGES) {
      it(`${fichier} : \`${nom}\` est refusé hors du site d’entropie`, async () => {
        expect(await pris(code, fichier)).toBeGreaterThan(0);
      });
    }
    it(`${fichier} : l’horloge murale reste permise côté hôte`, async () => {
      expect(await pris('export const a = Date.now();\n', fichier)).toBe(0);
    });
  }

  it('le moteur ne pose aucune minuterie : `murs/minuteries` le couvre', async () => {
    expect(await pris('export const a = setTimeout;\n', 'src/engine/__sonde-purete.ts', new Set(['murs/minuteries']))).toBeGreaterThan(0);
  });

  it('le site d’entropie et les tests tirent librement', async () => {
    expect(await pris('export const a = Math.random();\n', 'src/web/entropie.ts')).toBe(0);
    expect(await pris('export const a = Math.random() + Date.now();\n', 'src/noyau/__sonde-purete.test.ts')).toBe(0);
    expect(await pris('export const a = Math.random();\n', 'src/ui/__sonde-purete.test.tsx')).toBe(0);
  });
});
