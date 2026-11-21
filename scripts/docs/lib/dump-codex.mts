// Passerelle TS→JSON du registre Codex pour `scripts/docs/build-codex-relations.mjs` : les
// familles et catégories dans l'ordre de déclaration, et les renvois inverses de leurs fiches.
import { CODEX, CODEX_GROUPS, codexGroupLabel } from '../../../src/noyau/codex/registry';
import { reverseGroups } from '../../../src/noyau/codex/relations';

const relations = new Map<string, { source: string; cible: string; titre: string; renvois: number }>();
for (const categorie of CODEX) {
  for (const { id } of categorie.items) {
    for (const groupe of reverseGroups(categorie.key, id)) {
      const cle = JSON.stringify([groupe.category, categorie.key]);
      const relation = relations.get(cle);
      if (relation) relation.renvois += groupe.referrers.length;
      else relations.set(cle, { source: groupe.category, cible: categorie.key, titre: groupe.title, renvois: groupe.referrers.length });
    }
  }
}

process.stdout.write(JSON.stringify({
  familles: CODEX_GROUPS.map((id) => ({ id, label: codexGroupLabel(id) })),
  categories: CODEX.map((c) => ({ key: c.key, label: c.label, group: c.group, cluster: c.cluster ?? null })),
  relations: [...relations.values()],
}));
