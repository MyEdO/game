import type { Combatant } from '../engine/types';
import { Modal } from './Modal';
import { CharacterPreview } from './CharacterPreview';
import { ParchmentCard } from './ParchmentCard';
import { heroSubtitle, heroRoles, heroKeySkills, heroKeyTalents } from './CharCard';
import { t } from '../i18n';
import { Row } from './Layout';

/**
 * PRÉSENTATION d'un personnage — la vue qui RACONTE (avant/après recrutement), distincte de la
 * `CharacterSheet` de gestion (grilles de stats). Portrait en grand, archétype, ce qui l'anime
 * (motivation/ambitions, données pré-tiré), rôle/forces + compétences & talents CLÉS en clair, puis
 * un accès « Fiche complète » pour les chiffres. Compose Modal + CharacterPreview + ParchmentCard
 * (aucun 3e format de carte) — accessible d'un clic depuis toute carte (candidat ou membre d'équipe).
 */
export function HeroPresentation({ hero, onFullSheet, onClose }: {
  hero: Combatant;
  /** Ouvre la fiche complète (chiffres) — fournie SEULEMENT pour un membre du groupe : la
   *  `CharacterSheet` lit le héros dans le store, un candidat du vivier n'y est pas encore. */
  onFullSheet?: () => void;
  onClose: () => void;
}) {
  const roles = heroRoles(hero, 3);
  const skills = heroKeySkills(hero, 8);
  const talents = heroKeyTalents(hero, 8);
  const motivation = hero.motivation;
  const ambShort = hero.details?.ambitionShort;
  const ambLong = hero.details?.ambitionLong;

  return (
    <Modal
      title={hero.label}
      onClose={onClose}
      backdropClose
      footer={
        <>
          <button className="btn" onClick={onClose}>{t('present.close')}</button>
          {onFullSheet && <button className="btn btn-primary" onClick={onFullSheet}>{t('present.fullSheet')}</button>}
        </>
      }
    >
      <div className="hero-present-body">
        <aside className="hero-present-aside">
          <div className="hero-present-fig">
            <CharacterPreview hero={hero} size="fill" ambiance="spotlight" />
          </div>
          <span className="hero-present-sub">{heroSubtitle(hero)}</span>
        </aside>
        <div className="hero-present-detail">
          <ParchmentCard title={t('present.story')}>
            {motivation && <p><strong>{t('present.motivation')} :</strong> {motivation}</p>}
            {ambShort && <p className="hero-present-amb">« {ambShort} »</p>}
            {ambLong && <p className="hint">{t('present.ambitionLong')} : {ambLong}</p>}
            {!motivation && !ambShort && !ambLong && <p className="hint">{t('present.noStory')}</p>}
          </ParchmentCard>
          {roles.length > 0 && (
            <section className="hero-present-sec">
              <h4>{t('present.forces')}</h4>
              <p className="card-roles">{roles.join(' · ')}</p>
            </section>
          )}
          {skills.length > 0 && (
            <section className="hero-present-sec">
              <h4>{t('present.skills')}</h4>
              <Row className="hero-present-chips">{skills.map((s) => <span key={s} className="lore-chip">{s}</span>)}</Row>
            </section>
          )}
          {talents.length > 0 && (
            <section className="hero-present-sec">
              <h4>{t('present.talents')}</h4>
              <Row className="hero-present-chips">{talents.map((tt) => <span key={tt} className="lore-chip">{tt}</span>)}</Row>
            </section>
          )}
        </div>
      </div>
    </Modal>
  );
}
