import { describe, it, expect } from 'vitest';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { codeSeul } from '../scripts/guards/lib/commentPoison.mjs';

/**
 * Garde-fou chemins PORTABLES — un chemin absolu de machine de dev (lecteur Windows, racine de
 * profil POSIX) écrit en dur dans une source est mort partout ailleurs que sur la machine qui l'a
 * écrit : sur la CI (ubuntu-latest) il rend ENOENT. La résolution se fait relativement au module :
 * `fileURLToPath(new URL('./styles/x.css', import.meta.url))` en environnement `node`
 * (patron de `src/ui/atelier-conformance.test.ts`) ; en environnement `jsdom`, `new URL(rel, base)`
 * est détourné vers la base du document, la résolution y passe donc par
 * `join(dirname(fileURLToPath(import.meta.url)), '..', 'styles', 'x.css')`.
 *
 * PÉRIMÈTRE : `src/**` (`.ts`/`.tsx`) ET `scripts/**` (`.mjs`/`.mts`) — l'outillage tourne sur la CI
 * et dans les worktrees d'agents, un chemin de machine y meurt exactement pareil.
 *
 * CODE SEUL (`codeSeul`, `scripts/guards/lib/commentPoison.mjs`) : la garde juge ce qui S'EXÉCUTE.
 * Une graphie de chemin CITÉE dans une JSDoc documente le comportement de la fonction (deux sites :
 * `scripts/hooks/new-src-file-guard.mjs`, `scripts/hooks/solde-ticket-guard.mjs`) et ne casse aucune
 * machine ; le même littéral dans une expression, si. Le blanchiment conserve la numérotation des
 * lignes, donc les `fichier:ligne` du rapport valent pour la source d'origine.
 *
 * Détection STRUCTURELLE (aucune liste d'exception par fichier) :
 *   - lettre de lecteur Windows suivie d'un séparateur, qui ne termine pas un jeton plus long : ni
 *     précédée d'un caractère d'identifiant ou d'un tiret (schémas d'URL `http://`, `file://`, propriété
 *     `overflow-y:`), ni ÉCHAPPÉE par un nombre impair de `\` (échappement de regex `/\d\d:\d\d/`) ;
 *     un `\\` pair est une barre littérale, le préfixe long `\\?\` reste vu ;
 *   - racine de profil POSIX (`home`/`Users` + nom d'utilisateur).
 * ANGLE MORT DÉCLARÉ : un lecteur écrit derrière une barre UNIQUE dans un `String.raw` (préfixe long
 * brut) se lit comme un échappement ; le cas « angle mort déclaré » du contrôle négatif le fixe.
 * Les cas plantés ci-dessous sont ASSEMBLÉS à l'exécution : ce fichier ne porte lui-même aucun
 * littéral de chemin absolu, il est donc soumis à sa propre garde comme le reste du périmètre.
 */

/** Racines scannées : dossier + extensions retenues. */
const SCAN_ROOTS: { dir: string; exts: string[] }[] = [
  { dir: 'src', exts: ['.ts', '.tsx'] },
  { dir: 'scripts', exts: ['.mjs', '.mts'] },
];

const WIN_DRIVE = /(?<![A-Za-z0-9_-])(?<!(?<!\\)(?:\\\\)*\\)[A-Za-z]:[\\/]+[A-Za-z0-9._-]/g;
const POSIX_HOME = /\/(?:home|Users)\/[A-Za-z0-9._-]+\//;
/** Racines d'INSTALLATION de la plateforme : identiques sur toute machine Windows, elles ne nomment
 *  aucune machine (`C:\Program Files\Git\git.exe` vaut sur n'importe quel poste). SYMÉTRIQUE du côté
 *  POSIX, qui ne mord déjà que les racines de PROFIL (`/home/x/`), jamais `/usr/local/bin`. */
const WIN_SYSTEME = /^[A-Za-z]:[\\/]+(?:Program Files(?: \(x86\))?|Windows|ProgramData)[\\/]/;

/** RETOURNE le motif de chemin absolu machine trouvé dans une ligne de source, ou `null`. */
export function absoluteMachinePathIn(line: string): string | null {
  for (const win of line.matchAll(WIN_DRIVE)) {
    if (win.index !== undefined && WIN_SYSTEME.test(line.slice(win.index))) continue;
    return win[0];
  }
  const posix = POSIX_HOME.exec(line);
  if (posix) return posix[0];
  return null;
}

function scanFiles(): { rel: string; text: string }[] {
  return SCAN_ROOTS.flatMap(({ dir, exts }) =>
    readCorpus([dir], { exts, tests: true }).map(({ rel, text }) => ({ rel, text })),
  );
}

const DRIVE = 'C' + ':';

describe('garde-fou chemins portables — aucun chemin absolu de machine dans le CODE', () => {
  it('cas planté : un chemin de lecteur Windows est détecté (preuve TDD)', () => {
    const p = DRIVE + '/Users/' + 'dev' + '/projet/src/ui/styles/x.css';
    expect(absoluteMachinePathIn("readFileSync('" + p + "', 'utf8')")).not.toBeNull();
    expect(absoluteMachinePathIn("const d = '" + DRIVE + "\\projets\\jeu\\src';")).not.toBeNull();
    expect(absoluteMachinePathIn("const d = '" + DRIVE + "\\\\Users\\\\moi';"), 'barre doublée de source').not.toBeNull();
    expect(absoluteMachinePathIn('const d = "D' + ':\\\\foo";'), 'lecteur après un guillemet').not.toBeNull();
    expect(absoluteMachinePathIn("const p = '\\\\\\\\?\\\\" + DRIVE + "\\\\projet';"), 'préfixe long, barres paires').not.toBeNull();
    expect(absoluteMachinePathIn('[a, ' + DRIVE + '/x]'), 'lecteur après un espace').not.toBeNull();
  });

  it('cas planté : une racine de profil POSIX est détectée (preuve TDD)', () => {
    expect(absoluteMachinePathIn("readFileSync('/home/" + 'runner' + "/work/jeu/src/a.css')")).not.toBeNull();
    expect(absoluteMachinePathIn("'/Users/" + 'dev' + "/jeu/src/a.css'")).not.toBeNull();
  });

  it('faux positifs écartés : schémas d’URL, chemins relatifs et ratios (contrôle négatif)', () => {
    expect(absoluteMachinePathIn("fetch('http://localhost:5173/api')")).toBeNull();
    expect(absoluteMachinePathIn("new URL('file:///src/a.css')")).toBeNull();
    expect(absoluteMachinePathIn("import { x } from '../styles/components.css';")).toBeNull();
    expect(absoluteMachinePathIn("fileURLToPath(new URL('./styles/creator.css', import.meta.url))")).toBeNull();
    expect(absoluteMachinePathIn("const ratio = 'w:h';")).toBeNull();
    expect(absoluteMachinePathIn("const img = 'data:image/svg+xml;base64,AA';")).toBeNull();
  });

  it('faux positifs écartés : une lettre qui termine un jeton plus long n’est pas un lecteur (contrôle négatif)', () => {
    expect(absoluteMachinePathIn('const v = /overflow-y' + ':\\s*([\\w-]+)/.exec(c);'), 'propriété à tiret').toBeNull();
    expect(absoluteMachinePathIn("const s = 'mon_x" + ":/a';"), 'identifiant').toBeNull();
    expect(absoluteMachinePathIn('expect(s).toMatch(/\\d\\d' + ':\\d\\d/);'), 'échappement de regex').toBeNull();
    expect(absoluteMachinePathIn('/\\w' + ':\\s+/'), 'échappement de regex').toBeNull();
    expect(absoluteMachinePathIn('String.raw`' + '\\\\?\\' + DRIVE + '\\x`'), 'angle mort déclaré').toBeNull();
  });

  it('faux positif écarté : une racine d’INSTALLATION de la plateforme ne nomme aucune machine', () => {
    const PF = DRIVE + '\\Program Files';
    expect(absoluteMachinePathIn("'" + PF + "\\Git\\git.exe'")).toBeNull();
    expect(absoluteMachinePathIn("'" + DRIVE + "\\Program Files (x86)\\Google\\Chrome\\chrome.exe'")).toBeNull();
    expect(absoluteMachinePathIn("'/usr/local/bin/node'")).toBeNull();
    // …mais un profil de machine posé sur la MÊME ligne reste vu.
    expect(absoluteMachinePathIn("[" + PF + "\\Git, " + DRIVE + "\\Users\\moi\\jeu]")).not.toBeNull();
  });

  it('cas planté : le motif reste vu dans le CODE quand un commentaire le suit sur la MÊME ligne', () => {
    const source = "const p = '" + DRIVE + "/x';" + ' // note';
    const lignes = (codeSeul(source) as string).split(/\r?\n/);
    expect(absoluteMachinePathIn(lignes[0])).not.toBeNull();
  });

  it('cas planté : le MÊME motif écrit en commentaire est hors de portée (prose, pas machine)', () => {
    const bloc = ['// ' + DRIVE + '/x/projet', '/* ' + DRIVE + '/y/projet */'].join('\n');
    const rendu = codeSeul(bloc) as string;
    expect(absoluteMachinePathIn(rendu)).toBeNull();
    // La numérotation des lignes survit au blanchiment : un rapport `fichier:ligne` reste juste.
    expect(rendu.split('\n')).toHaveLength(2);
    expect(rendu).toHaveLength(bloc.length);
  });

  it('aucune source du périmètre ne porte de chemin absolu de machine (tolérance ZÉRO)', () => {
    const offenders: string[] = [];
    for (const { rel, text } of scanFiles()) {
      const lines = (codeSeul(text) as string).split(/\r?\n/);
      lines.forEach((line, i) => {
        const hit = absoluteMachinePathIn(line);
        if (hit) offenders.push(`${rel}:${i + 1} → ${hit}`);
      });
    }
    expect(
      offenders,
      `Chemin(s) absolu(s) de machine — résoudre relativement à \`import.meta.url\` (cf. en-tête de ce fichier) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
