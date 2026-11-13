/**
 * LA TABLE DES PRÉFÉRENCES de confort (#3041) : chaque entrée porte sa forme de contrôle (`flag` booléen, `mode` l'une
 * de ses `options`, `param` nombre entre `min` et `max`, mêmes formes que les règles optionnelles), son défaut, et la
 * lecture et l'écriture de sa valeur, qui vit dans son module feuille (`engine/cadence.ts`, `noyau/volumes.ts`…).
 * Leur persistance est à l'hôte (`hote/preferences.ts`) ; l'effet d'un changement JOUEUR sur l'affichage est à
 * l'hôte qui affiche.
 *
 * Ce n'est PAS le registre des règles optionnelles (`engine/policy.ts`, dont chaque entrée cite un folio d'un livre
 * autorisé et dont le moteur reconstruit l'état de combat) : ces réglages ne changent aucun état de jeu déjà
 * construit et restent donc modifiables pendant un combat. Ajouter un réglage = une entrée ICI (son id entre dans
 * `IdDePreference`), et son effet chez chaque hôte qui en déclare un (exhaustif par id) ; zéro
 * ligne d'UI (doctrine utilisateur 2026-07-26 : « "if (id=" n'est jamais une solution »).
 */
import { CADENCE_DEFAULT, CADENCE_MODES, cadence, setCadence, type Cadence } from '../engine/cadence';
import { DES_FIXES_DEFAULT, desFixes, setDesFixes } from '../engine/fixedDie';
import { valeurConforme, type FormeDeControle } from '../engine/policy';
import { CANAUX_DE_SON, type CanalDeSon } from '../data/sons/types';
import { SON_COUPE_DEFAUT, VOLUME_DEFAUT, couperLeSon, reglerLeVolume, sonCoupe, volumeDuCanal } from './volumes';

export type PrefValue = boolean | number | string;

/** La forme d'une entrée de la table : ses champs, et la forme de son contrôle. */
type FormeDePreference = FormeDeControle & {
  id: string;
  /** Libellé affiché. */
  label: string;
  /** Aide courte (infobulle). */
  hint?: string;
  default: PrefValue;
  /** Lecture de la valeur effective, dans son module feuille. */
  get(): PrefValue;
  /** Écriture de la valeur, sans effet de bord. */
  set(value: PrefValue): void;
};

const LIBELLES_DES_VOLUMES: Record<CanalDeSon, string> = {
  musique: 'Volume de la musique',
  ambiance: 'Volume des ambiances',
  effets: 'Volume des effets',
  interface: 'Volume de l’interface',
};

/** L'entrée du volume du canal `canal` (`noyau/volumes.ts`). */
const volume = <C extends CanalDeSon>(canal: C) => ({
  id: `volume-${canal}` as const,
  label: LIBELLES_DES_VOLUMES[canal],
  kind: 'param' as const,
  min: 0,
  max: 1,
  step: 0.05,
  default: VOLUME_DEFAUT,
  get: () => volumeDuCanal(canal),
  set: (v: PrefValue) => reglerLeVolume(canal, v as number),
});

const TABLE = [
  {
    id: 'son-coupe',
    label: 'Couper le son',
    kind: 'flag',
    default: SON_COUPE_DEFAUT,
    get: sonCoupe,
    set: (v) => couperLeSon(v === true),
  },
  ...CANAUX_DE_SON.map(volume),
  {
    id: 'combat-cadence',
    label: 'Cadence de combat',
    kind: 'mode',
    options: CADENCE_MODES,
    default: CADENCE_DEFAULT,
    hint: 'manuel = chaque jet d’un héros passe par sa modale (défaut) ; rapide = les jets se lancent et s’appliquent seuls, sans dépenser Chance/Résilience/Sombre Pacte (le Sauvetage par Destin reste une modale) ; auto = l’IA joue aussi les héros (cible, action, surincantation, défense) et dépense le Destin pour éviter la mort.',
    get: cadence,
    set: (v) => setCadence(v as Cadence),
  },
  {
    id: 'des-fixes',
    label: 'Dés fixés',
    kind: 'flag',
    default: DES_FIXES_DEFAULT,
    hint: 'ajoute, sur les jets que vous contrôlez (vos héros ; les ennemis et le monde seulement si le siège MJ est le vôtre), un champ pour saisir vous-même la valeur du d100 — avant de lancer comme après. Le jet saisi est évalué normalement (réussite, DR, double → Critique/Maladresse), ne coûte aucun point, et porte la mention « dé fixé » dans la rangée et le journal. Le champ n’apparaît que sur les jets dont le moteur sait re-dériver l’issue depuis le dé.',
    get: desFixes,
    set: (v) => setDesFixes(v === true),
  },
] as const satisfies readonly FormeDePreference[];

/** Les ids des préférences, dérivés de la table : la clé de persistance, et la clé des effets qu'un hôte déclare par
 *  entrée. */
export type IdDePreference = (typeof TABLE)[number]['id'];

export type Preference = FormeDePreference & { id: IdDePreference };

export const PREFERENCES: readonly Preference[] = TABLE;

export const preferenceDef = (id: string): Preference | undefined => PREFERENCES.find((p) => p.id === id);

/** La valeur que l'entrée `v` d'un hôte donne à la préférence `id` : son défaut si `v` est absente, `v` si elle est
 *  conforme à la forme de l'entrée (`valeurConforme`), `undefined` sinon. */
export function valeurDEntree(id: IdDePreference, v: unknown): PrefValue | undefined {
  const def = preferenceDef(id)!;
  if (v === undefined) return def.default;
  return valeurConforme(def, v) ? v : undefined;
}

/** Valeur effective d'une préférence (`undefined` si l'id est inconnu). */
export function pref(id: string): PrefValue | undefined {
  return preferenceDef(id)?.get();
}

/** Les préférences qui s'écartent de leur défaut, par id : ce qu'un hôte persiste. */
export function preferencesAPersister(): Record<string, PrefValue> {
  return Object.fromEntries(PREFERENCES.filter((p) => p.get() !== p.default).map((p) => [p.id, p.get()]));
}

/** Pose le dictionnaire `persiste` (venu d'un stockage) : une valeur non conforme à la forme de son entrée
 *  (`valeurConforme`) est ignorée, l'entrée garde sa valeur (#2404). */
export function poserLesPreferencesPersistees(persiste: Readonly<Record<string, unknown>>): void {
  for (const p of PREFERENCES) {
    const v = persiste[p.id];
    if (valeurConforme(p, v)) p.set(v);
  }
}
