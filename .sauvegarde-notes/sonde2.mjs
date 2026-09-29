import { execSync } from 'node:child_process';
import { coupesAuCaractere } from '/home/user/game/.wt-1806-L1/scripts/guards/lib/coupeAuCaractere.mjs';
process.chdir('/home/user/game/.wt-1806-L1');
const fs = ['src/ui/creator/CharacterCreator.tsx','src/ui/editor/EffectList.tsx','src/ui/editor/GameOpEditor.tsx','src/ui/editor/DialogueDetail.tsx','src/ui/CombatConsole.test.tsx','src/data/night-stake-form.test.ts','src/data/night-stakes-rules.test.ts','src/data/schemas/defs-scenes/trous-de-validation.test.ts','src/scenes/bundled-projects.test.ts','src/ui/compendium/CodexRef.tsx','src/gameIso/stage/rotation-repose.test.tsx'];
console.log(coupesAuCaractere(fs.map((rel) => ({ rel, text: execSync(`git show HEAD:${rel}`, { encoding: 'utf8', maxBuffer: 1e8 }) }))));
