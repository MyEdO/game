import { type ReactNode } from 'react';
import { nomDuSiege } from '../state/netFlow';
import { useGame } from '../state/store';
import type { NetState } from '../state/netFlow';
import { CharFrame } from './CharFrame';
import { MenuToggle } from './MenuCard';
import { Icon } from './Icon';
import type { IconIdInput } from './icons';
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
        <button className="btn small" onClick={onCopierCode}><Icon id="coop/code" size="sm" /> Code</button>
        <button className="btn small" onClick={onCopierLien}><Icon id="coop/invite" size="sm" /> Lien d'invitation</button>
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

/** Un siège tel qu'il se MONTRE : son nom, s'il est le mien, s'il se reconnecte. */
export interface SiegeVu {
  seat: number;
  nom: string;
  moi: boolean;
  absent: boolean;
}

/** Sièges + présence (connecté / reconnexion) — partagé lobby et menu ☰. */
export function SeatList({ sieges }: { sieges: SiegeVu[] }) {
  return (
    <Row as="ul" gap="md">
      {sieges.map(({ seat, nom, moi, absent }) => (
        <li key={seat} className={absent ? 'muted' : undefined}>
          <Icon id={seat === 0 ? 'coop/host' : absent ? 'coop/away' : 'coop/online'} size="sm" /> {nom}
          {moi ? ' (vous)' : ''}
          {absent ? ' — reconnexion…' : ''}
        </li>
      ))}
    </Row>
  );
}

/** Les sièges de la vue réseau, dans l'ordre où ils ont été pris. */
function siegesDe(net: NetState): SiegeVu[] {
  return Object.entries(net.seatNames).map(([s, nom]) => ({
    seat: Number(s),
    nom,
    moi: Number(s) === net.mySeat,
    absent: net.presence[Number(s)] === 'away',
  }));
}

export function CoopSeatList() {
  const net = useGame((s) => s.net);
  return <SeatList sieges={siegesDe(net)} />;
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
  const assign = useGame((s) => s.netAssign);
  const options = siegesDe(net).map(({ seat, nom }) => ({ valeur: seat, libelle: nom }));
  return (
    <Grid cols={2} gap="md" align="stretch">
      {party.map((h) => (
        <CoopAssignRow
          key={h.id}
          /* Tuile + nom : lobby coop = écran méta (un invité découvre les héros par leur NOM). */
          portrait={<CharFrame c={h} variant="identity" size="xs" />}
          libelle={h.label}
          valeur={net.ownership[h.id] ?? 0}
          options={options}
          onChange={(v) => assign(h.id, Number(v))}
        />
      ))}
      <GmSeatSelect />
    </Grid>
  );
}

/** Rôle MJ (bac-à-sable) : UN siège conduit tout le camp ennemi + les jets du monde (ou « IA » = aucun MJ).
 *  UNIQUE (désigner un MJ retire le rôle à tout autre). Hôte-autoritaire → n'apparaît qu'en mode hôte
 *  (en solo, le siège unique bascule via `GmSoloToggle`). */
export function GmSeatSelect() {
  const net = useGame((s) => s.net);
  const setGmSeat = useGame((s) => s.setGmSeat);
  if (net.mode !== 'host') return null;
  return (
    <CoopAssignRow
      libelle="Maître du Jeu"
      valeur={net.gmSeat ?? ''}
      options={[{ valeur: '', libelle: 'IA (aucun MJ)' }, ...siegesDe(net).map(({ seat, nom }) => ({ valeur: seat, libelle: nom }))]}
      onChange={(v) => setGmSeat(v === '' ? null : Number(v))}
    />
  );
}

/** SOLO (mode local) : contrôler aussi les ennemis + les jets du monde (rôle MJ pour le siège unique). */
export function GmSoloToggle() {
  const net = useGame((s) => s.net);
  const setGmSeat = useGame((s) => s.setGmSeat);
  if (net.mode !== 'local') return null;
  return (
    <MenuToggle checked={net.gmSeat != null} onChange={(v) => setGmSeat(v ? 0 : null)}>
      Siège du contrôleur — piloter aussi les ennemis / le monde
    </MenuToggle>
  );
}

/** Bandeau de LIAISON, non bloquant : un chip qui SIGNALE (`.chip.tone-danger`), posé en haut du
 *  champ au-dessus de l'écran courant, quel qu'il soit. */
export function CoopBanner({ icone, children }: { icone: IconIdInput; children: ReactNode }) {
  return <div className="chip tone-danger coop-banner" role="status"><Icon id={icone} size="sm" /> {children}</div>;
}

/** Ce que la vue réseau donne à SIGNALER — `null` : la liaison est saine, aucun bandeau. */
export function liaisonASignaler(net: NetState): { icone: IconIdInput; texte: string } | null {
  if (net.mode === 'guest' && net.connection === 'reconnecting')
    return { icone: 'ui/warning', texte: 'Reconnexion en cours…' };
  if (net.mode === 'guest' && net.hostAway)
    return { icone: 'ui/wait', texte: 'L’hôte est déconnecté — la partie reprendra à son retour.' };
  if (net.mode === 'host') {
    const away = Object.entries(net.presence)
      .filter(([, p]) => p === 'away')
      .map(([s]) => nomDuSiege(net, Number(s)));
    if (away.length) return { icone: 'ui/warning', texte: `${away.join(', ')} : reconnexion en cours…` };
  }
  return null;
}

/** Les trois sections de l'HÔTE — inviter, qui est là, qui joue qui. Les MÊMES au salon et au menu ☰. */
export function CoopHostSections() {
  return (
    <>
      <CoopSection title={t('coop.host.invite.section')}><CoopRoomPanel /></CoopSection>
      <CoopSection title={t('coop.host.players.section')}><CoopSeatList /></CoopSection>
      <CoopSection title={t('coop.host.assign.section')}><CoopAssignList /></CoopSection>
    </>
  );
}

/** Sous-écran Coopération du menu ☰ : il n'a de contenu qu'en partie HÉBERGÉE. */
export function CoopMenuSection() {
  const net = useGame((s) => s.net);
  if (net.mode !== 'host') return null;
  return <CoopHostSections />;
}
