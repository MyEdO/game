import { SCHEMA_DEFS } from '/home/claude/game/.wt-1473-r2c3/src/data/schemas/_registry.generated';
import { DATASET_FICHIER_DERIVE } from '/home/claude/game/.wt-1473-r2c3/src/data/schemas/exposition-derivee';
import { IDS_PAR_ESPACE } from '/home/claude/game/.wt-1473-r2c3/src/data/schemas/_ids.generated';
import { lireCleDEspace } from '/home/claude/game/.wt-1473-r2c3/src/data/schemas/grammaire/cle-d-espace';
const fichiers = new Set(SCHEMA_DEFS.map(d => d.file));
const avecCle = new Set(Object.values(DATASET_FICHIER_DERIVE));
const sansCle = [...fichiers].filter(f => !avecCle.has(f)).sort();
const espacesParFichier = new Map<string, string[]>();
for (const k of Object.keys(IDS_PAR_ESPACE)) { const f = lireCleDEspace(k).fichier; espacesParFichier.set(f, [...(espacesParFichier.get(f) ?? []), k]); }
console.log({ fichiers: fichiers.size, avecCle: avecCle.size, sansCle: sansCle.length });
console.log('sans cle, avec espace:', sansCle.filter(f => espacesParFichier.has(f)).length);
console.log(JSON.stringify(sansCle.map(f => [f, espacesParFichier.get(f)?.length ?? 0])));
console.log('avecCle hors SCHEMA_DEFS:', [...avecCle].filter(f => !fichiers.has(f)));
