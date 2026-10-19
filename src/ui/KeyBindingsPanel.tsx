import { useMemo, useRef } from 'react';
import { useGame } from '../state/store';
import {
  KEYBINDINGS, bindingLabel, keySectionLabel, effectiveCodes, effectiveMods, surchargeDe, comboLabel, formatCombo,
  type KeyBindingSection,
} from '../state/clavier/keybindings';
import { Icon } from './Icon';
import { useRemapDeTouche } from './clavier/remapDeTouche';
import { Row } from './Layout';

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
 */
const SECTION_ORDER: KeyBindingSection[] = ['systeme', 'pov', 'camera', 'combat', 'curseur', 'hotbar', 'exploration', 'dialogue', 'editeur'];

export function KeyBindingsPanel() {
  const keyOverrides = useGame((s) => s.keyOverrides);
  const resetKeyBindings = useGame((s) => s.resetKeyBindings);
  const panneau = useRef<HTMLDivElement>(null);
  const remap = useRemapDeTouche(panneau);

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
    <div className="opt-panel" ref={panneau}>
      <div className="opt-keys">
        {SECTION_ORDER.filter((sec) => bySection.has(sec)).map((sec) => (
          <div className="opt-key-section" key={sec}>
            <h4 className="opt-key-section-title">{keySectionLabel(sec)}</h4>
            {bySection.get(sec)!.map((b) => {
              const code = effectiveCodes(b, keyOverrides)[0];
              const remapped = surchargeDe(b, keyOverrides) !== undefined;
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
                    className="btn small"
                    aria-pressed={remap.enCours === b.id}
                    onClick={() => remap.armer(b.id)}
                    title={remapped ? 'Touche personnalisée — clic pour réassigner' : 'Clic pour réassigner'}
                  >
                    {remap.enCours === b.id ? 'Appuyez sur une touche…' : comboLabel(code, effectiveMods(b, keyOverrides))}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="hint">Touches par POSITION physique (le binding suit l’endroit de la touche, AZERTY comme QWERTY). Échap pendant la capture = annuler.</p>
      <Row justify="end">
        <button type="button" className="btn small" onClick={() => resetKeyBindings()}>Réinitialiser les touches</button>
      </Row>
    </div>
  );
}
