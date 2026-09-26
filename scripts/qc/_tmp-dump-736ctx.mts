/** JETABLE — diagnostic manchettes brunes : dump SVG résolu sanguinaire front (mon appel QC)
 *  vs appel GOLDEN (entityRigProfile equip/tenue), vers le scratchpad. */
import { writeFileSync } from 'node:fs';
import { resolveRig } from '../../src/gameIso/rig/composeRig';
import { bonesToSvg } from '../../src/gameIso/rig/renderBones';
import { entityRigProfile } from '../../src/gameIso/rig/enemyProfile';

const SCRATCH = 'C:/Users/gauch/AppData/Local/Temp/claude/C--Users-gauch-PhpstormProjects-Foundry-Game/bbc9d6ec-8826-4d31-9fd2-56b7bc29ff8d/scratchpad';
const p = entityRigProfile('sanguinaire-de-khorne', 7)!;
console.log('profile.tenue =', JSON.stringify(p.tenue));
console.log('profile.equip =', JSON.stringify(p.equip));
console.log('appearance =', JSON.stringify(p.appearance));

// MON appel QC (equip vide, tenue undefined)
const mine = bonesToSvg(resolveRig(p.appearance, { weapons: [], armour: [] }, {}, undefined, 'front', []));
writeFileSync(`${SCRATCH}/dump-sang-front-mine.svg`, mine);
// Appel GOLDEN (chemin jeu)
const game = bonesToSvg(resolveRig(p.appearance, p.equip, {}, p.tenue, 'front', []));
writeFileSync(`${SCRATCH}/dump-sang-front-game.svg`, game);
console.log('DONE');
