/**
 * PRÉFÉRENCES de confort — registre + persistance `localStorage` (patron `keybindingsPrefs.ts`).
 *
 * Ce n'est PAS le registre des règles optionnelles (`engine/policy.ts`, dont chaque entrée cite un
 * folio d'un livre autorisé et dont le moteur reconstruit l'état de combat) : ici vivent les
 * réglages de CONFORT (rythme de résolution…), qui ne changent aucun état de jeu déjà construit et
 * restent donc modifiables pendant un combat.
 *
 * Une entrée porte TOUT ce qui la concerne — sa forme de contrôle, sa lecture, son écriture, et
 * l'effet à jouer quand le JOUEUR la change (`onChange`). L'écran n'a donc jamais à connaître une
 * préférence par son id : il itère le registre. Ajouter un réglage = ajouter une entrée ICI, zéro
 * ligne d'UI (doctrine utilisateur 2026-07-26 : « "if (id=" n'est jamais une solution »).
 */
import { CADENCE_DEFAULT, CADENCE_MODES, cadence, setCadence, type Cadence } from '../engine/cadence';
import { DES_FIXES_DEFAULT, desFixes, setDesFixes } from '../engine/fixedDie';
import { useGame } from './store';
import { HOUSE_RULES_STORAGE_KEY } from './houseRules';
import { stockageWeb } from '../lib/stockageWeb';

export type PrefValue = boolean | number | string;
export type PrefKind = 'flag' | 'mode';

export interface Preference {
  /** Identifiant stable (clé de persistance). */
  id: string;
  /** Libellé affiché. */
  label: string;
  /** Aide courte (infobulle). */
  hint?: string;
  /** Forme du contrôle auto-rendu : flag=case à cocher, mode=liste. */
  kind: PrefKind;
  /** Valeurs possibles (kind='mode'). */
  options?: string[];
  /** Valeur par défaut. */
  default: PrefValue;
  /** Lecture de la valeur effective (la valeur vit dans son module métier, jamais en double ici). */
  get(): PrefValue;
  /** Écriture de la valeur (pure — appelée aussi au chargement, sans effet de bord). */
  set(value: PrefValue): void;
  /** Effet DÉCLARÉ à jouer après un changement JOUEUR (jamais au chargement). */
  onChange?(): void;
}

export const PREFERENCES: Preference[] = [
  {
    id: 'combat-cadence',
    label: 'Cadence de combat',
    kind: 'mode',
    options: [...CADENCE_MODES],
    default: CADENCE_DEFAULT,
    hint: 'manuel = chaque jet d’un héros passe par sa modale (défaut) ; rapide = les jets se lancent et s’appliquent seuls, sans dépenser Chance/Résilience/Sombre Pacte (le Sauvetage par Destin reste une modale) ; auto = l’IA joue aussi les héros (cible, action, surincantation, défense) et dépense le Destin pour éviter la mort.',
    get: cadence,
    set: (v) => setCadence(v as Cadence),
    // Basculer en Rapide/Auto EN PLEIN COMBAT ne traverse pas la boucle de tours : sans reprise
    // explicite, le tour courant reste figé.
    onChange: () => useGame.getState().resumeCadence(),
  },
  {
    id: 'des-fixes',
    label: 'Dés fixés',
    kind: 'flag',
    default: DES_FIXES_DEFAULT,
    hint: 'ajoute, sur les jets que vous contrôlez (vos héros ; les ennemis et le monde seulement si le siège MJ est le vôtre), un champ pour saisir vous-même la valeur du d100 — avant de lancer comme après. Le jet saisi est évalué normalement (réussite, DR, double → Critique/Maladresse), ne coûte aucun point, et porte la mention « dé fixé » dans la rangée et le journal. Le champ n’apparaît que sur les jets dont le moteur sait re-dériver l’issue depuis le dé.',
    get: desFixes,
    set: (v) => setDesFixes(v === true),
    // La valeur vit hors du store (module feuille) : une modale de jet DÉJÀ ouverte ne se re-rendrait
    // pas. On touche la tranche `net` — celle à laquelle `RollShell` s'abonne pour son sélecteur de dé.
    onChange: () => useGame.setState((s) => ({ net: { ...s.net } })),
  },
];

export const preferenceDef = (id: string): Preference | undefined => PREFERENCES.find((p) => p.id === id);

/** Valeur effective d'une préférence (défaut si l'id est inconnu). */
export function pref(id: string): PrefValue | undefined {
  return preferenceDef(id)?.get();
}

const KEY = 'wfrp4.prefs.v1';

/** Persiste l'état courant du registre. */
export function savePreferences(): void {
  try {
    const o: Record<string, PrefValue> = {};
    for (const p of PREFERENCES) if (p.get() !== p.default) o[p.id] = p.get();
    if (Object.keys(o).length) stockageWeb('localStorage')?.setItem(KEY, JSON.stringify(o));
    else stockageWeb('localStorage')?.removeItem(KEY);
  } catch {
    /* stockage indisponible (mode privé, quota…) : le réglage reste effectif pour la session */
  }
}

/**
 * REPRISE d'un réglage qui vivait dans le magasin des RÈGLES MAISON avant d'être reconnu comme une
 * préférence de confort (`combat-cadence`) : une partie déjà jouée porte son choix là-bas, et le
 * registre des règles ne le connaît plus (`loadRuleOverrides` ignore les ids inconnus) — sans cette
 * reprise, le joueur retrouve le défaut sans un mot. Le réglage est adopté puis RETIRÉ du magasin
 * d'origine : la reprise ne se joue qu'une fois. Le magasin des préférences PRIME (`already`) — c'est
 * le choix le plus récent.
 */
function adoptHouseRulePreferences(already: Record<string, PrefValue>): void {
  const raw = stockageWeb('localStorage')?.getItem(HOUSE_RULES_STORAGE_KEY);
  if (!raw) return;
  const o = JSON.parse(raw) as Record<string, PrefValue>;
  if (!o || typeof o !== 'object') return;
  const moved = PREFERENCES.filter((p) => p.id in o);
  if (!moved.length) return;
  for (const p of moved) {
    if (!(p.id in already)) p.set(o[p.id]);
    delete o[p.id];
  }
  stockageWeb('localStorage')?.setItem(HOUSE_RULES_STORAGE_KEY, JSON.stringify(o));
  savePreferences();
}

/** Charge les préférences persistées (démarrage de l'app) — sans jouer les `onChange`. */
export function loadPreferences(): void {
  try {
    const raw = stockageWeb('localStorage')?.getItem(KEY);
    const o = raw ? (JSON.parse(raw) as Record<string, PrefValue>) : {};
    if (!o || typeof o !== 'object') return;
    for (const p of PREFERENCES) if (p.id in o) p.set(o[p.id]);
    adoptHouseRulePreferences(o);
  } catch {
    /* JSON corrompu ou stockage indisponible : on garde les défauts */
  }
}

/** COUTURE UNIQUE d'écriture JOUEUR : écrit, persiste, puis joue l'effet déclaré par l'entrée. */
export function setPreference(id: string, value: PrefValue): void {
  const def = preferenceDef(id);
  if (!def) return;
  def.set(value);
  savePreferences();
  def.onChange?.();
}

/** Réinitialise une préférence à son défaut (même couture que `setPreference`). */
export function resetPreference(id: string): void {
  const def = preferenceDef(id);
  if (def) setPreference(id, def.default);
}
