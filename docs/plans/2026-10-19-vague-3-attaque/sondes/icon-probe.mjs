// Sonde m2 : la garde no-phantom-icon voit-elle les valeurs de MANEUVER_ICON et REVEAL_ICON ?
import { readFileSync } from 'node:fs';
const RE = /(?:"icon"|\bicon)\s*:\s*(['"])((?:(?!\1)[^\n])*)\1/g; // copie verbatim de scripts/guards/lib/iconRefs.mjs:12
for (const [f, debut, fin] of [['src/state/combatManeuvers.ts', 'export const MANEUVER_ICON', '};'], ['src/state/revealStep.ts', 'const REVEAL_ICON', '};']]) {
  const t = readFileSync('/home/user/game/' + f, 'utf8'); const i = t.indexOf(debut); const bloc = t.slice(i, t.indexOf(fin, i) + 2);
  const valeurs = [...bloc.matchAll(/:\s*'([a-z]+\/[a-zA-Z-]+)'/g)].map((m) => m[1]);
  const vues = [...bloc.matchAll(RE)].map((m) => m[2]);
  console.log(f, 'valeurs d’icône', valeurs.length, 'vues par la garde', vues.length);
}
