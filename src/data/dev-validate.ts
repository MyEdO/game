/**
 * Validation DURE des documents authorés au CHARGEMENT (les DEUX racines : catalogues `src/data` et
 * projets de campagne `src/scenes`) — DEV uniquement (`import.meta.env.DEV`). En prod, le JSON servi a
 * DÉJÀ été validé par la porte CI (`schema-contract.test.ts`) : aucun coût runtime.
 * En dev, une édition à la main d'un document qui diverge de son schéma zod fait
 * remonter un message champ-par-champ (`validateDataset`) dès le démarrage — même contrat que la CI et que
 * la sauvegarde Codex, servi par la SOURCE UNIQUE `schemas/validate.ts`.
 */
import { DEFS_DE_DOCUMENT, validateDataset } from './schemas/validate';

/** Catalogues lus en FORME DISQUE (`?raw` : le texte du fichier, hors `transform`). Le plugin
 *  `wfrp:prose-source` MATÉRIALISE la prose adressée dans le module JSON servi à l'application —
 *  or `desc` et `descRef` sont EXCLUSIFS au schéma : c'est le disque que le schéma décrit. */
const DISQUE = import.meta.glob('./*.json', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

/** Tous les documents des DEUX racines, chargés EAGER par Vite (clé = chemin relatif au module). */
const RAW = {
  'src/data': Object.fromEntries(
    Object.entries(DISQUE).map(([k, texte]) => [k, JSON.parse(texte) as unknown]),
  ) as Record<string, unknown>,
  'src/scenes': import.meta.glob('../scenes/**/*-projet.json', { eager: true, import: 'default' }) as Record<string, unknown>,
};
/** Préfixe de clé `import.meta.glob` par racine — `SchemaDef.file` est relatif à SA racine. */
const PREFIXE = { 'src/data': './', 'src/scenes': '../scenes/' } as const;

/** Valide chaque document registré contre son schéma ; log champ-par-champ + throw au premier invalide. */
export function validateDataOnLoad(): void {
  const failures: string[] = [];
  for (const def of DEFS_DE_DOCUMENT) {
    const raw = RAW[def.root][`${PREFIXE[def.root]}${def.file}`];
    if (raw === undefined) { failures.push(`${def.root}/${def.file} — introuvable (import.meta.glob)`); continue; }
    const err = validateDataset(def.file, raw);
    if (err) failures.push(err);
  }
  if (failures.length) {
    const report = failures.join('\n\n');
    console.error(`[contrat de donnée] ${failures.length} dataset(s) invalide(s) :\n\n${report}`);
    throw new Error(`Contrat de donnée violé au chargement — corriger src/data/*.json :\n\n${report}`);
  }
}
