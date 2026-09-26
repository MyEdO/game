import '/home/claude/game/.wt-1473-r2c3/src/data/overrides';
import { skills, talents, traits, specCatalogOf, specResolves } from '/home/claude/game/.wt-1473-r2c3/src/data/index';
import { IDS_PAR_ESPACE } from '/home/claude/game/.wt-1473-r2c3/src/data/schemas/_ids.generated';
import { cleDesSpecs } from '/home/claude/game/.wt-1473-r2c3/src/data/schemas/grammaire/cle-d-espace';
import { lireLEspace } from '/home/claude/game/.wt-1473-r2c3/src/data/schemas/grammaire/ref';
const out: Record<string, number> = { sourceEntrees: 0, catalogueDiffereEspace: 0, resolvesDiffereEspace: 0, nonSourceCatalogueDiffere: 0, nonSourceResolvesDiffere: 0 };
const ex: string[] = [];
for (const [fichier, liste] of [['skills.json', skills], ['talents.json', talents], ['traits.json', traits]] as const) {
  for (const def of liste as any[]) {
    const cle = cleDesSpecs(fichier, def.id);
    const gen = (IDS_PAR_ESPACE as any)[cle] as string[] | undefined;
    if (!gen) continue;
    const vivant = [...(lireLEspace(cle) ?? [])];
    if (def.specsSource) {
      out.sourceEntrees++;
      const cat = specCatalogOf(def);
      if (JSON.stringify(cat) !== JSON.stringify(gen)) { out.catalogueDiffereEspace++; ex.push(`${cle} source=${def.specsSource} catalogue=${cat.length} espace=${gen.length} vivant=${vivant.length}`); }
      if (gen.some(s => !specResolves(def, s)) ) out.resolvesDiffereEspace++;
    } else if (fichier !== 'traits.json') {
      const cat = specCatalogOf(def);
      if (JSON.stringify(cat) !== JSON.stringify(gen)) { out.nonSourceCatalogueDiffere++; ex.push(`NS ${cle} cat=${JSON.stringify(cat)} gen=${JSON.stringify(gen)}`); }
      if (gen.some(s => !specResolves(def, s)) || cat.some(s => !gen.includes(s))) out.nonSourceResolvesDiffere++;
    }
  }
}
console.log(out); console.log(ex.join('\n'));
