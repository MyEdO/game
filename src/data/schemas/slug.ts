/**
 * Slug d'`id` STABLE d'un libellé — convention des `id` de `skills.json`/`talents.json`
 * (« Talent aléatoire » → « talent-aleatoire », « Art » → « art »). SOURCE UNIQUE, réutilisée par
 * l'éditeur (id d'une entrée créée au Codex).
 * L'`id` est la cible des références structurées : robuste au renommage du `label`.
 */
export function slugId(label: string): string {
  return label
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // décompose puis retire les diacritiques
    .toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** `id` unique dans un ensemble déjà attribué : `slug`, puis `slug-2`, `slug-3`… (ordre stable d'appel).
 *  `taken` est muté (l'id retenu y est ajouté) — désambiguïse les collisions de label (Couteau arme vs outil…). */
export function uniqueSlugId(label: string, taken: Set<string>): string {
  const base = slugId(label);
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}
