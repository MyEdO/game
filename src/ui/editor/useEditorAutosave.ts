import { useEffect, useRef, useState } from 'react';
import type { Scene } from '../../state/scene';
import { autosaveLoad, autosaveSave, autosaveDelete, type EditorAutosaveRecord } from '../../state/editorAutosave';

/** Délai de débattue avant écriture (pas à chaque frappe/pas de pinceau — cf. `editorAutosave.ts`). */
const DEBOUNCE_MS = 1500;
/** Plafond de la débattue (#834 audit pt. C) : un tracé CONTINU (pinceau, pas de pause de 1,5 s)
 *  réarme le minuteur à chaque frappe et n'écrirait sinon JAMAIS — l'écriture est forcée une fois
 *  ce délai écoulé depuis la première modification en attente, même sans pause. */
const MAX_WAIT_MS = 5000;

/**
 * Filet de crash de l'éditeur : sauvegarde locale débattue de la scène en cours (INDÉPENDANTE du
 * « Fichier → Enregistrer » explicite), et proposition de RESTAURATION quand une sauvegarde
 * enregistrée diverge de la scène chargée — jamais un écrasement silencieux : `recovery` reste posé
 * tant que l'appelant n'a pas explicitement choisi `restore`/`dismiss`. L'écriture débattue est
 * SUSPENDUE tant que la proposition reste AFFICHÉE (une frappe pendant que la modale de reprise est
 * montrée ne doit jamais faire disparaître la version à récupérer avant que l'utilisateur l'ait vue) —
 * `hide` lève cette suspension : masquer la proposition (Échap, #834 audit pt. A) ne détruit RIEN
 * (seul `dismiss`, geste explicite et nommé, supprime la sauvegarde locale) mais ne doit PLUS non plus
 * geler l'écriture du travail en cours (#834 audit-2 défaut 1 : Échap ne peut pas rendre l'autosave
 * périmé pour le reste de la session). `show` referme la fenêtre de suspension.
 */
export function useEditorAutosave(scene: Scene, applyRecovered: (s: Scene) => void) {
  const [recovery, setRecovery] = useState<EditorAutosaveRecord | null>(null);
  const [hidden, setHidden] = useState(false);
  const [ecartee, setEcartee] = useState<string | null>(null); // raison d'un enregistrement écarté à la lecture
  const [ready, setReady] = useState(false); // reste faux tant que la vérification de reprise n'a pas conclu pour CETTE scène
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkedRef = useRef<string | null>(null); // id de scène déjà vérifié cette session
  const pendingRef = useRef<Scene | null>(null); // dernière scène modifiée en attente d'écriture (flush au démontage/pagehide)
  const firstPendingAtRef = useRef<number | null>(null); // début de la rafale en attente, pour le plafond MAX_WAIT_MS

  // Vérification de reprise — une fois PAR SCÈNE chargée (jamais à chaque frappe : dépend de scene.id seul).
  useEffect(() => {
    if (checkedRef.current === scene.id) return;
    flushPending(); // bascule de scène (#834 audit-2 défaut 3) : la scène QUITTÉE doit être écrite avant de vérifier la nouvelle, jamais jetée avec le minuteur en cours
    checkedRef.current = scene.id;
    setReady(false);
    let cancelled = false;
    autosaveLoad(scene.id).then((lu) => {
      if (cancelled) return;
      const rec = lu && 'ecartee' in lu ? null : lu;
      setEcartee(lu && 'ecartee' in lu ? lu.ecartee : null);
      const stale = !!rec && JSON.stringify(rec.scene) !== JSON.stringify(scene);
      setRecovery(stale ? rec : null);
      setHidden(false);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [scene.id]);

  /** Écrit `pendingRef` s'il porte une modification en instance sur disque (rafale tronquée par le
   *  plafond, démontage, `pagehide`) — jamais un `setTimeout` de plus, un appel direct au backend. */
  function flushPending(): void {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    firstPendingAtRef.current = null;
    autosaveSave({ sceneId: pending.id, scene: pending, savedAt: Date.now() });
  }

  // Écriture débattue, PLAFONNÉE (#834 audit pt. C) — SUSPENDUE tant que la vérification n'a pas
  // conclu, ou qu'une reprise est proposée.
  useEffect(() => {
    if (!ready || (recovery && !hidden)) return; // masquée (`hidden`) → l'écriture reprend malgré une reprise encore proposée
    pendingRef.current = scene;
    if (firstPendingAtRef.current == null) firstPendingAtRef.current = Date.now();
    if (timerRef.current) clearTimeout(timerRef.current);
    const elapsed = Date.now() - firstPendingAtRef.current;
    const wait = Math.max(0, Math.min(DEBOUNCE_MS, MAX_WAIT_MS - elapsed));
    timerRef.current = setTimeout(flushPending, wait);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [scene, ready, recovery, hidden]);

  // Flush au démontage (crash de rendu → `SceneErrorBoundary` démonte l'`Editor`, #834 audit pt. C)
  // et sur `pagehide` (fermeture d'onglet/navigation) — jamais jusqu'à `DEBOUNCE_MS` de frappes jetées.
  useEffect(() => {
    window.addEventListener('pagehide', flushPending);
    return () => {
      window.removeEventListener('pagehide', flushPending);
      flushPending();
    };
  }, []);

  /** La scène proposée a DÉJÀ traversé la chaîne de migrations canonique à la lecture
   *  (`autosaveLoad`, `sceneAuSchemaCourant`) : elle est restaurée telle quelle. */
  function restore(): void {
    if (!recovery) return;
    applyRecovered(recovery.scene);
    setRecovery(null);
    setHidden(false);
  }

  /** Masque la proposition SANS RIEN détruire (Échap/fermeture sans trancher, #834 audit pt. A) —
   *  la sauvegarde locale reste intacte ET l'écriture débattue REPREND (#834 audit-2 défaut 1 : un
   *  filet masqué doit continuer à protéger le travail en cours) ; `show` la fait revenir. */
  function hide(): void {
    setHidden(true);
  }

  function show(): void {
    setHidden(false);
  }

  /** Geste EXPLICITE et nommé (« Ignorer et supprimer ») : supprime la sauvegarde locale. */
  function dismiss(): void {
    if (recovery) autosaveDelete(recovery.sceneId);
    setRecovery(null);
    setHidden(false);
  }

  return {
    ecartee,
    oublierEcartee: () => setEcartee(null),
    recovery: hidden ? null : recovery,
    hasHiddenRecovery: hidden && !!recovery,
    restore,
    dismiss,
    hide,
    show,
  };
}
