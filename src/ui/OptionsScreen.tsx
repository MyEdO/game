import { useRef, useState, type ReactNode } from 'react';
import { useModalA11y } from './Modal';
import { MenuSubScreen } from './MenuCard';
import { Tabs } from './composites/Tabs';
import { KeyBindingsPanel } from './KeyBindingsPanel';
import { AudioControls } from './AudioControls';
import { PreferencesPanel } from './PreferencesPanel';
import { HouseRulesPanel } from './HouseRulesModal';
import { t } from '../i18n';

type OptTab = 'keys' | 'audio' | 'prefs' | 'rules';

/**
 * SOUS-ÉCRAN UNIQUE des Options — Clavier · Audio · Confort · Règles maison. Composé À L'IDENTIQUE
 * par les DEUX foyers : le menu SYSTÈME en jeu (`GameMenu`) et le menu PRINCIPAL hors partie
 * (`OptionsScreen` ci-dessous) — la carte, l'en-tête et les onglets ne se recomposent à aucun des
 * deux. Aucun fork par foyer : un seul panneau clavier, un seul audio, un seul `PreferencesPanel`,
 * un seul `HouseRulesPanel`.
 *
 * La barre d'onglets passe par le `head` de `MenuSubScreen` : elle tient EN TÊTE, hors du défileur
 * `.menu-card-body`, quel que soit l'onglet — Clavier compris (#839).
 */
export function OptionsSubScreen({ title = t('gameMenu.options'), onBack }: { title?: ReactNode; onBack: () => void }) {
  const [tab, setTab] = useState<OptTab>('keys');
  return (
    <MenuSubScreen
      title={title}
      onBack={onBack}
      wide
      head={<Tabs
        label={t('gameMenu.options')}
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'keys', label: t('gameMenu.options.tab.keys') },
          { key: 'audio', label: t('gameMenu.options.tab.audio') },
          { key: 'prefs', label: t('gameMenu.options.tab.prefs') },
          { key: 'rules', label: t('gameMenu.options.tab.rules') },
        ]}
      />}
    >
      {tab === 'keys' && <KeyBindingsPanel />}
      {tab === 'audio' && <AudioControls />}
      {tab === 'prefs' && <PreferencesPanel />}
      {tab === 'rules' && <HouseRulesPanel />}
    </MenuSubScreen>
  );
}

/**
 * Écran Options du MENU PRINCIPAL (hors partie) — même voile et même sous-écran que le menu
 * système : `OptionsSubScreen`. Le menu principal donne donc accès aux touches, à l'audio et au
 * confort AVANT de lancer une partie, et les règles optionnelles y sont un onglet parmi les autres.
 * A11y de dialogue (focus piégé, Échap = fermeture) via `useModalA11y`, comme `GameMenu`.
 */
export function OptionsScreen({ onClose, title = t('gameMenu.options') }: { onClose: () => void; title?: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  useModalA11y(boxRef, onClose, { kind: 'options' }); // aucun early-return : monté = affiché
  return (
    <div className="game-menu-overlay" role="dialog" aria-modal="true" aria-label={t('gameMenu.options')} ref={boxRef}>
      <OptionsSubScreen title={title} onBack={onClose} />
    </div>
  );
}
