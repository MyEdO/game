import { type ReactNode } from 'react';
import { emplacementsDuGroupe, nomDuSiege, siegesDeLaTable, type SiegeDeLaTable } from '../noyau/sieges';
import { useGame } from '../state/store';
import type { NetState } from '../noyau/etat';
import { CharFrame } from './CharFrame';
import { MenuToggle } from './MenuCard';
import { Icon } from './Icon';
import type { IconId } from '../data/icons';
import { Stack, Row, Grid } from './Layout';
import { t } from '../i18n';

/**
 * Briques coop PARTAGÉES (lobby « Jouer en ligne » ET menu ☰ en partie) : code de room à
 * partager (+ lien d'invitation), sièges avec présence, attribution des héros. La reconnexion
 * d'un invité est automatique (reprise de siège par token) — l'hôte n'a rien à faire.
 *
 * Chaque brique est PURE (props seules, spécimen de galerie) ; le lecteur du store qui la nourrit
 * vit juste en dessous d'elle, ou chez son consommateur quand le montage lui appartient
 * (`CoopBanner`, monté hors écran par `App`).
 */

/** Une SECTION coop : la surface canonique, en colonne, sous son intertitre. */
export function CoopSection({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <Stack as="section" gap="md" className="panel">
      <div className="mini-title">{title}</div>
      {children}
    </Stack>
  );
}

/** Code de room + ses deux gestes de partage. La plaque MONTRE le code (un clic le sélectionne en
 *  entier) ; la copie passe par les boutons. */
export function CoopInvite({ code, onCopierCode, onCopierLien }: {
  code: string;
  onCopierCode: () => void;
  onCopierLien: () => void;
}) {
  return (
    <Stack gap="md">
      <div className="coop-code display-title">{code}</div>
      <div className="bar">
        <button className="btn small" onClick={onCopierCode}><Icon id="coop/code-de-partie" size="sm" /> Code</button>
        <button className="btn small" onClick={onCopierLien}><Icon id="coop/invitation" size="sm" /> Lien d'invitation</button>
      </div>
    </Stack>
  );
}

export function CoopRoomPanel() {
  const net = useGame((s) => s.net);
  const copy = (text: string) => void navigator.clipboard?.writeText(text).catch(() => {});
  if (!net.roomCode) return null;
  const link = `${location.origin}${location.pathname}?join=${net.roomCode}`;
  return <CoopInvite code={net.roomCode} onCopierCode={() => copy(net.roomCode!)} onCopierLien={() => copy(link)} />;
}

/** CHAMP du code de room côté invité : six caractères, saisis en majuscules quoi qu'on frappe. */
export function CoopCodeInput({ valeur, onChange, placeholder }: {
  valeur: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      className="coop-code-input"
      value={valeur}
      onChange={(e) => onChange(e.target.value.toUpperCase())}
      placeholder={placeholder}
      maxLength={6}
    />
  );
}

/** Sièges + présence (connecté / reconnexion) — partagé lobby et menu ☰. */
export function SeatList({ sieges }: { sieges: SiegeDeLaTable[] }) {
  return (
    <Row as="ul" gap="md">
      {sieges.map(({ seat, nom, moi, absent }) => (
        <li key={seat} className={absent ? 'muted' : undefined}>
          <Icon id={seat === 0 ? 'coop/hote' : absent ? 'coop/reconnexion' : 'coop/connecte'} size="sm" /> {nom}
          {moi ? ' (vous)' : ''}
          {absent ? ' — reconnexion…' : ''}
        </li>
      ))}
    </Row>
  );
}

export function CoopSeatList() {
  const net = useGame((s) => s.net);
  return <SeatList sieges={siegesDeLaTable(net)} />;
}

/** UNE ligne d'attribution : qui (portrait + nom) tient quel siège. Sert le héros ET le rôle MJ. */
export function CoopAssignRow({ portrait, libelle, valeur, options, onChange }: {
  /** Tuile d'identité du sujet — absente quand la ligne attribue un RÔLE et non une personne. */
  portrait?: ReactNode;
  libelle: ReactNode;
  valeur: string | number;
  options: { valeur: string | number; libelle: string }[];
  onChange: (valeur: string) => void;
}) {
  return (
    <label className="coop-assign-row">
      {portrait}
      <span>{libelle}</span>
      <select value={valeur} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>{o.libelle}</option>
        ))}
      </select>
    </label>
  );
}

/** Attribution des héros par siège (« un certain nombre de personnages décidé dans le lobby »). */
export function CoopAssignList() {
  const net = useGame((s) => s.net);
  const party = useGame((s) => s.party);
  const assign = useGame((s) => s.affecterLeHerosAuSiege);
  const options = siegesDeLaTable(net).map(({ seat, nom }) => ({ valeur: seat, libelle: nom }));
  return (
    <Grid cols={2} gap="md" align="stretch">
      {emplacementsDuGroupe({ party, net }).flatMap(({ heroId, proprietaire }) => {
        const h = party.find((x) => x.id === heroId);
        return h && proprietaire !== null ? [
          <CoopAssignRow
            key={h.id}
            /* Tuile + nom : lobby coop = écran méta (un invité découvre les héros par leur NOM). */
            portrait={<CharFrame c={h} variant="identity" size="xs" decoratif />}
            libelle={h.label}
            valeur={proprietaire}
            options={options}
            onChange={(v) => assign(h.id, Number(v))}
          />,
        ] : [];
      })}
      <GmSeatSelect />
    </Grid>
  );
}

/** Rôle MJ (bac-à-sable) : UN siège conduit tout le camp ennemi + les jets du monde (ou « IA » = aucun MJ).
 *  UNIQUE (désigner un MJ retire le rôle à tout autre). Hôte-autoritaire → n'apparaît qu'en mode hôte
 *  (en solo, le siège unique bascule via `GmSoloToggle`). */
export function GmSeatSelect() {
  const net = useGame((s) => s.net);
  const affecterLeSiegeMJ = useGame((s) => s.affecterLeSiegeMJ);
  if (net.mode !== 'hote') return null;
  return (
    <CoopAssignRow
      libelle="Maître du Jeu"
      valeur={net.gmSeat ?? ''}
      options={[{ valeur: '', libelle: 'IA (aucun MJ)' }, ...siegesDeLaTable(net).map(({ seat, nom }) => ({ valeur: seat, libelle: nom }))]}
      onChange={(v) => affecterLeSiegeMJ(v === '' ? null : Number(v))}
    />
  );
}

/** SOLO (mode local) : contrôler aussi les ennemis + les jets du monde (rôle MJ pour le siège unique). */
export function GmSoloToggle() {
  const net = useGame((s) => s.net);
  const affecterLeSiegeMJ = useGame((s) => s.affecterLeSiegeMJ);
  if (net.mode !== 'local') return null;
  return (
    <MenuToggle checked={net.gmSeat != null} onChange={(v) => affecterLeSiegeMJ(v ? 0 : null)}>
      Siège du contrôleur — piloter aussi les ennemis / le monde
    </MenuToggle>
  );
}

/** Bandeau de LIAISON, non bloquant : un chip qui SIGNALE (`.chip.tone-danger`), posé en haut du
 *  champ au-dessus de l'écran courant, quel qu'il soit. */
export function CoopBanner({ icone, children }: { icone: IconId; children: ReactNode }) {
  return <div className="chip tone-danger coop-banner" role="status"><Icon id={icone} size="sm" /> {children}</div>;
}

/** Ce que la vue réseau donne à SIGNALER — `null` : la liaison est saine, aucun bandeau. */
export function liaisonASignaler(net: NetState): { icone: IconId; texte: string } | null {
  if (net.mode === 'invite' && net.connection === 'reconnexion')
    return { icone: 'interface/attention', texte: 'Reconnexion en cours…' };
  if (net.mode === 'invite' && net.hoteAbsent)
    return { icone: 'interface/attendre', texte: 'L’hôte est déconnecté — la partie reprendra à son retour.' };
  if (net.mode === 'hote') {
    const away = Object.entries(net.presence)
      .filter(([, p]) => p === 'absent')
      .map(([s]) => nomDuSiege(net, Number(s)));
    if (away.length) return { icone: 'interface/attention', texte: `${away.join(', ')} : reconnexion en cours…` };
  }
  return null;
}

/** Les trois sections de l'HÔTE — inviter, qui est là, qui joue qui. Les MÊMES au salon et au menu ☰. */
export function CoopHostSections() {
  return (
    <>
      <CoopSection title={t('coop.hote.inviter.section')}><CoopRoomPanel /></CoopSection>
      <CoopSection title={t('coop.hote.joueurs.section')}><CoopSeatList /></CoopSection>
      <CoopSection title={t('coop.hote.attribution.section')}><CoopAssignList /></CoopSection>
    </>
  );
}

/** Sous-écran Coopération du menu ☰ : il n'a de contenu qu'en partie HÉBERGÉE. */
export function CoopMenuSection() {
  const net = useGame((s) => s.net);
  if (net.mode !== 'hote') return null;
  return <CoopHostSections />;
}
