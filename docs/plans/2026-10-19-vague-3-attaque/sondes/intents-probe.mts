import { GUEST_INTENTS, CLASSE_DES_ACTIONS } from '/home/user/game/src/state/intents';
for (const a of ['cascadeNext','cascadeFinish','cascadeResolveAll','cascadeRoll','battleClickEntity','battleClickTile','attackRoll','attackConfirm','log','commitCursor'])
  console.log(a, GUEST_INTENTS.has(a), (CLASSE_DES_ACTIONS as any)[a]);
console.log('GUEST_INTENTS', GUEST_INTENTS.size, 'CLASSE keys', Object.keys(CLASSE_DES_ACTIONS).length);
const c: Record<string, number> = {}; for (const v of Object.values(CLASSE_DES_ACTIONS)) c[v as string]=(c[v as string]??0)+1; console.log(c);
