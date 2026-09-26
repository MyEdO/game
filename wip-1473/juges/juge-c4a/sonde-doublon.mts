import { setDataset, datasetArray } from '/home/claude/game/.wt-1473-r2c3/src/data/overrides';
import { lireLEspace, refusDeSpec } from '/home/claude/game/.wt-1473-r2c3/src/data/schemas/grammaire/ref';
const skills = datasetArray('skills') as any[];
const art = skills.find((s) => s.id === 'art');
console.log('avant', lireLEspace('skills.json#[art].specs')?.size);
const avant = [...skills];
// pose transactionnelle : une copie d'`art` ajoutée (id en double, comme une création au Compendium qui reprend un id)
setDataset('skills', [...avant, structuredClone(art)] as never);
for (const f of [() => lireLEspace('skills.json#[art].specs')?.size, () => refusDeSpec('skill', 'art', 'calligraphie'), () => lireLEspace('skills.json')?.size]) {
  try { console.log('pendant', f()); } catch (e) { console.log('LEVE', (e as Error).message); }
}
setDataset('skills', avant as never);
console.log('apres', lireLEspace('skills.json#[art].specs')?.size);
