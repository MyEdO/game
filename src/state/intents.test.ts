/**
 * Garde-fou de l'allowlist coop côté web : la table des actions de l'ADAPTATEUR est totale et n'expose rien à
 * l'invité, une action émise par un écran n'est jamais `interne`, et l'événement React ne part pas sur le réseau. La
 * table du noyau et l'allowlist se jouent au banc (`src/noyau/intents.hors-store.test.ts`).
 */
import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { useGame } from './store';
import { CLASSE_DES_ACTIONS_DU_NOYAU, type ClasseCoop } from '../noyau/intentionsDeSiege';
import { CLASSE_DES_ACTIONS_DE_L_ADAPTATEUR, sanitizeIntentArgs, type TableDeLAdaptateur } from './intents';

describe('#2724 — table TOTALE des classes coop : une action non classée ne compile pas', () => {
  it('la table de l’adaptateur aussi : une action sans classe, ou classée `invité`, ne compile pas', () => {
    const { autoSave, ...sansAutoSave } = CLASSE_DES_ACTIONS_DE_L_ADAPTATEUR;
    // @ts-expect-error — `autoSave` n'a pas de classe
    const privee: TableDeLAdaptateur = sansAutoSave;
    // @ts-expect-error — l'allowlist ne compte que des actions du noyau
    const invitee: TableDeLAdaptateur = { ...CLASSE_DES_ACTIONS_DE_L_ADAPTATEUR, saveGame: 'invité' };
    expect([autoSave, privee.setZoom, invitee.saveGame]).toEqual(['interne', 'local', 'invité']);
  });

});

/**
 * #1050 (a) — ÉMISSION d'écran ⇄ classe. Scan TEXTUEL des sélecteurs `s.<action>` /
 * `getState().<action>` de `src/ui` et `src/gameIso` : il prouve un SITE d'émission, jamais son
 * atteignabilité (recette navigateur) ; une action appelée hors sélecteur lui échappe.
 */
function emissionsDe(fichiers: readonly { rel: string; texte: string }[], actions: ReadonlySet<string>): Map<string, string> {
  const vus = new Map<string, string>();
  for (const f of fichiers) {
    f.texte.split('\n').forEach((l, i) => {
      for (const tok of ['=> s.', '=>s.', '.getState().']) {
        for (let k = l.indexOf(tok); k !== -1; k = l.indexOf(tok, k + 1)) {
          const n = /^[A-Za-z0-9_]*/.exec(l.slice(k + tok.length))![0];
          if (actions.has(n) && !vus.has(n)) vus.set(n, `${f.rel}:${i + 1}`);
        }
      }
    });
  }
  return vus;
}

describe('#1050 (a) — une action émise par un écran n’est jamais `interne`, une action `interne` jamais émise', () => {
  it('le détecteur voit un sélecteur d’écran sur une action, avec son site, et rien d’autre', () => {
    const vus = emissionsDe([
      { rel: 'ui/Faux.tsx', texte: 'const a = useGame((s) => s.fauxGeste);\nconst b = useGame((s)=>s.autreGeste);' },
      { rel: 'ui/Bis.tsx', texte: 'useGame.getState().troisieme();\nconst x = s.pasUnSelecteur;\nuseGame((s) => s.inconnue);' },
    ], new Set(['fauxGeste', 'autreGeste', 'troisieme', 'pasUnSelecteur']));
    expect([...vus]).toEqual([['fauxGeste', 'ui/Faux.tsx:1'], ['autreGeste', 'ui/Faux.tsx:2'], ['troisieme', 'ui/Bis.tsx:1']]);
  });

  it('les écrans réels', () => {
    const etat = useGame.getState() as unknown as Record<string, unknown>;
    const actions = new Set(Object.keys(etat).filter((k) => typeof etat[k] === 'function'));
    const emises = emissionsDe(readCorpus(['src/ui', 'src/gameIso']).map(({ rel, text }) => ({ rel, texte: text })), actions);
    const classes = Object.entries({ ...CLASSE_DES_ACTIONS_DU_NOYAU, ...CLASSE_DES_ACTIONS_DE_L_ADAPTATEUR }) as [string, ClasseCoop][];
    const internesEmises = classes.filter(([a, c]) => c === 'interne' && emises.has(a)).map(([a]) => `${a} (${emises.get(a)})`);
    expect(internesEmises, 'action `interne` émise par un écran : chez l’invité elle s’exécute EN LOCAL puis meurt au snapshot').toEqual([]);
    const ecransMuets = classes.filter(([a, c]) => (c === 'hôte' || c === 'local') && !emises.has(a)).map(([a]) => a);
    expect(ecransMuets, 'action `hôte`/`local` qu’aucun écran n’émet : sa classe est `interne`').toEqual([]);
  });
});

describe('sanitizeIntentArgs — l’événement React ne part pas sur le réseau (audit coop)', () => {
  it('tronque la queue non sérialisable (événement circulaire, fonction) sans toucher aux vrais args', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular; // un SyntheticEvent est circulaire (nativeEvent/target)
    expect(sanitizeIntentArgs(['h2', 'stash', 120, circular])).toEqual(['h2', 'stash', 120]);
    expect(sanitizeIntentArgs([circular])).toEqual([]);
    expect(sanitizeIntentArgs([() => {}])).toEqual([]);
    expect(sanitizeIntentArgs(['h1', { x: 1 }])).toEqual(['h1', { x: 1 }]);
  });
});
