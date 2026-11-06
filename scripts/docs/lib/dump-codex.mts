// Passerelle TS→JSON du registre Codex VIVANT (`src/noyau/codex/registry.ts`) pour
// `scripts/docs/build-codex-relations.mjs`, qui tourne sous Node nu : ses familles (id, libellé) dans
// l'ordre d'affichage, et ses catégories (clé, libellé, famille, sous-groupe) dans l'ordre de déclaration.
import { CODEX, CODEX_GROUPS, codexGroupLabel } from '../../../src/noyau/codex/registry';

process.stdout.write(JSON.stringify({
  familles: CODEX_GROUPS.map((id) => ({ id, label: codexGroupLabel(id) })),
  categories: CODEX.map((c) => ({ key: c.key, label: c.label, group: c.group, cluster: c.cluster ?? null })),
}));
