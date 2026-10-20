import { CLASSE_DES_ACTIONS, GUEST_INTENTS } from '/home/user/game/src/state/intents';
import { coopFlowIntents } from '/home/user/game/src/state/flowVerbs';
import { writeFileSync } from 'fs';
const out: Record<string, string> = { ...(CLASSE_DES_ACTIONS as any) };
for (const g of GUEST_INTENTS) if (!out[g]) out[g] = 'invité(dérivé)';
writeFileSync(process.argv[2], JSON.stringify(out));
console.log(Object.keys(out).length);
