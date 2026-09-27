import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../state/store';
import {
  KEYBINDINGS, bindingLabel, keySectionLabel, effectiveCodes, effectiveMods, eventMods, comboLabel, formatCombo,
  type KeyBindingSection,
} from '../state/keybindings';
import { Icon } from './Icon';

/**
 * Panneau Options — REMAP clavier (onglet « Clavier » de l'écran Options). Liste les raccourcis de jeu
 * (registre `keybindings`), GROUPÉS par section (`KeyBindingSection`), et permet de réassigner chaque
 * touche : un clic arme la capture, la PROCHAINE touche pressée devient le binding (par POSITION
 * physique `event.code` → AZERTY-safe). Échap pendant la capture = annuler. « Réinitialiser » efface
 * toutes les surcharges. (Volume → onglet Audio ; reduce-motion, vitesse — à venir.)
 *
 * Détection de PARTAGE de touche (#376 pt.5) : deux raccourcis sur la MÊME touche effective sont
 * signalés par un badge — la plupart sont des contextes MUTUELLEMENT EXCLUSIFS voulus (POV vs Caméra
 * sur Q/E : `exploringPov` et `screen === 'campaign'` ne se recouvrent jamais en jeu), mais un joueur qui
 * REMAPPE à la main peut créer un VRAI conflit (même touche, même contexte) — le badge est donc
 * informatif dans TOUS les cas, la garde `when` de chaque binding restant l'arbitre d'exécution.
 *
 * @clavier-hors-registre la CAPTURE de remap n'est pas un raccourci : elle lit la touche BRUTE pour
 * l'écrire dans le registre, et doit donc passer avant lui (garde `ui/raccourcis-registre.test.ts`).
 */
const SECTION_ORDER: KeyBindingSection[] = ['systeme', 'pov', 'camera', 'combat', 'curseur', 'hotbar', 'exploration', 'dialogue', 'editeur'];

/** Codes qui ne sont QUE des modificateurs : tenus seuls, ils ne désignent aucune touche — la capture attend la touche qualifiée. */
const CODES_MODIFICATEUR = /^(Control|Alt|Shift|Meta)(Left|Right)$/;

export function KeyBindingsPanel() {
  const keyOverrides = useGame((s) => s.keyOverrides);
  const setKeyBinding = useGame((s) => s.setKeyBinding);
  const resetKeyBindings = useGame((s) => s.resetKeyBindings);
  const [rebinding, setRebinding] = useState<string | null>(null);

  // Capture de la prochaine touche pour le raccourci en cours de remap. EN CAPTURE + stop immédiat :
  // passe AVANT le hook de jeu (useGameKeyboard) pour ne pas déclencher un raccourci pendant la saisie.
  useEffect(() => {
    if (!rebinding) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (CODES_MODIFICATEUR.test(e.code)) return; // Ctrl/Alt/Maj seuls : on attend la touche qu'ils qualifient
      if (e.code !== 'Escape') setKeyBinding(rebinding, formatCombo(e.code, eventMods(e))); // Échap = annule la capture sans changer
      setRebinding(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [rebinding, setKeyBinding]);

  // Touches PARTAGÉES : code effectif → labels des autres raccourcis sur la même touche.
  const sharedBy = useMemo(() => {
    const byCode = new Map<string, { id: string; label: string }[]>();
    for (const b of KEYBINDINGS) {
      // La TOUCHE, c'est le code ET ses modificateurs : Ctrl+Z ne partage rien avec Z.
      const code = formatCombo(effectiveCodes(b, keyOverrides)[0], effectiveMods(b, keyOverrides));
      (byCode.get(code) ?? byCode.set(code, []).get(code)!).push({ id: b.id, label: bindingLabel(b) });
    }
    const out = new Map<string, string>(); // id → titre listant les autres partageant sa touche
    for (const entries of byCode.values()) {
      if (entries.length < 2) continue;
      for (const e of entries) {
        const others = entries.filter((o) => o.id !== e.id).map((o) => o.label);
        out.set(e.id, `Touche partagée avec : ${others.join(', ')}`);
      }
    }
    return out;
  }, [keyOverrides]);

  const bySection = useMemo(() => {
    const m = new Map<KeyBindingSection, typeof KEYBINDINGS>();
    for (const b of KEYBINDINGS) (m.get(b.section) ?? m.set(b.section, []).get(b.section)!).push(b);
    return m;
  }, []);

  return (
    <div className="opt-panel">
      <div className="opt-keys">
        {SECTION_ORDER.filter((sec) => bySection.has(sec)).map((sec) => (
          <div className="opt-key-section" key={sec}>
            <h4 className="opt-key-section-title">{keySectionLabel(sec)}</h4>
            {bySection.get(sec)!.map((b) => {
              const code = effectiveCodes(b, keyOverrides)[0];
              const remapped = !!keyOverrides[b.id];
              const shared = sharedBy.get(b.id);
              return (
                <div className="opt-key-row" key={b.id}>
                  <span className="opt-key-label">
                    {bindingLabel(b)}
                    {shared && (
                      <span className="opt-key-shared" title={shared}>
                        <Icon id="ui/warning" size="sm" />
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    className={`btn small ${rebinding === b.id ? 'btn-primary' : ''}`}
                    onClick={() => setRebinding(b.id)}
                    title={remapped ? 'Touche personnalisée — clic pour réassigner' : 'Clic pour réassigner'}
                  >
                    {rebinding === b.id ? 'Appuyez sur une touche…' : comboLabel(code, effectiveMods(b, keyOverrides))}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="hint">Touches par POSITION physique (le binding suit l’endroit de la touche, AZERTY comme QWERTY). Échap pendant la capture = annuler.</p>
      <div className="modal-actions">
        <button type="button" className="btn small" onClick={() => resetKeyBindings()}>Réinitialiser les touches</button>
      </div>
    </div>
  );
}
