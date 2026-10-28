import { useState } from 'react';
import { useGame } from '../state/store';
import { stockageDesSauvegardes } from '../state/saves';
import { listerLesSauvegardes } from '../hote/sauvegardes';
import { SaveLoadModal } from './SaveLoadModal';
import { OptionsScreen } from './OptionsScreen';
import { CampaignLibraryScreen } from './CampaignLibraryScreen';
import { MenuCard, MenuSection, MenuButton } from './MenuCard';
import { t } from '../i18n';

export function MainMenu() {
  const setScreen = useGame((s) => s.setScreen);
  const openCodex = useGame((s) => s.openCodex);
  const setPendingCampaign = useGame((s) => s.setPendingCampaign);
  const [loadOpen, setLoadOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const hasSaves = listerLesSauvegardes(stockageDesSauvegardes()).some((m) => m != null);

  return (
    <div className="menu tx-ink">
      <MenuCard
        header={<>
          <h1 className="display-title">{t('menu.title')}</h1>
          <p className="subtitle">{t('menu.subtitle')}</p>
        </>}
        footer={<p className="footnote">{t('menu.footnote')}</p>}
      >
        <MenuSection rule={false}>
          <MenuButton icon="nav/new-game" tone="primary" onClick={() => { setPendingCampaign(null); setScreen('party'); }}>{t('menu.newGame')}</MenuButton>
          <MenuButton icon="nav/load" onClick={() => setLoadOpen(true)} title={hasSaves ? t('menu.load.titleHas') : t('menu.load.titleEmpty')}>{t('menu.load')}</MenuButton>
          <MenuButton icon="nav/online" onClick={() => setScreen('coop')}>{t('menu.online')}</MenuButton>
          <MenuButton icon="ui/settings" onClick={() => setOptionsOpen(true)} title={t('menu.options.title')}>{t('menu.options')}</MenuButton>
          <MenuButton icon="nav/compendium" onClick={() => openCodex()} title={t('menu.compendium.title')}>{t('menu.compendium')}</MenuButton>
        </MenuSection>
        <MenuSection label={t('menu.workshop')} ruleClassName="menu-tools-rule" className="menu-tools">
          <MenuButton icon="nav/editor" onClick={() => setScreen('editor')}>{t('menu.editor')}</MenuButton>
          <MenuButton icon="nav/campaign" onClick={() => setLibraryOpen(true)} title={t('menu.library.title')}>{t('menu.library')}</MenuButton>
          <MenuButton icon="nav/test-scenarios" tone="test" onClick={() => setScreen('test')}>{t('menu.testScenarios')}</MenuButton>
          <MenuButton icon="nav/art-gallery" href="galeries.html" target="_blank" rel="noopener">{t('menu.galleries')}</MenuButton>
          {import.meta.env.DEV && (
            <MenuButton icon="nav/art-gallery" tone="test" onClick={() => setScreen('gallery')}>{t('menu.designGallery')}</MenuButton>
          )}
        </MenuSection>
      </MenuCard>
      {loadOpen && <SaveLoadModal mode="load" onClose={() => setLoadOpen(false)} />}
      {optionsOpen && <OptionsScreen onClose={() => setOptionsOpen(false)} />}
      {libraryOpen && <CampaignLibraryScreen onClose={() => setLibraryOpen(false)} />}
    </div>
  );
}
