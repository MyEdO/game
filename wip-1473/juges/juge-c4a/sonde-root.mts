import { SCHEMA_DEFS } from '/home/claude/game/.wt-1473-r2c3/src/data/schemas/_registry.generated';
const roots = new Map<string, number>(); for (const d of SCHEMA_DEFS as any[]) roots.set(d.root, (roots.get(d.root) ?? 0) + 1);
console.log([...roots]);
