import { useState, type ReactNode } from 'react';
import { useGame } from '../state/store';
import { CoopSection, CoopHostSections, CoopSeatList, CoopCodeInput } from './CoopPanels';
import { SaveLoadModal } from './SaveLoadModal';
import { MenuSubScreen } from './MenuCard';
import { Row, Grid } from './Layout';
import { Icon } from './Icon';
import { ChipDeRefus } from './ChipDeRefus';
import { t } from '../i18n';

/**
 * Lobby coop — connexion par CODE DE ROOM court (relay WebSocket, spec coop v2).
 *
 * HÔTE : « Héberger » crée la room → un code à 6 caractères (et un lien d'invitation) à
 * partager. Les invités apparaissent dans la liste dès qu'ils rejoignent. L'hôte continue vers
 * l'écran d'équipe, où il attribue les EMPLACEMENTS aux joueurs — chacun remplit les siens
 * (créer / roster local / pré-tiré) ; les écrans invités REFLÈTENT le sien (snapshots).
 * INVITÉ : code + nom → connecté. Reconnexion automatique avec reprise de siège.
 *
 * Présentation : c'est un SOUS-ÉCRAN de menu (`MenuSubScreen`), le même que Coopération et
 * Options — en-tête Retour + titre, corps défilant, sections en `.panel`. Un ÉCRAN, pas un
 * dialogue : il garde la coquille `.menu`, sans voile ni a11y de dialogue.
 */

/** Coquille centrée, partagée par les 3 états du lobby (local / invité / hôte). */
function CoopShell({
  title,
  backLabel,
  onBack,
  wide,
  children,
}: {
  title: string;
  backLabel: string;
  onBack: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="menu">
      <MenuSubScreen title={title} backLabel={backLabel} onBack={onBack} wide={wide}>
        {children}
      </MenuSubScreen>
    </div>
  );
}

export function CoopLobby() {
  const setScreen = useGame((s) => s.setScreen);
  const net = useGame((s) => s.net);
  const hostStart = useGame((s) => s.netHostStart);
  const join = useGame((s) => s.netJoin);
  const leave = useGame((s) => s.netLeave);

  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState(() => new URLSearchParams(location.search).get('join')?.toUpperCase() ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadOpen, setLoadOpen] = useState(false);

  if (net.mode === 'local') {
    return (
      <CoopShell title={t("coop.title.local")} backLabel={t("coop.back.menu")} onBack={() => { leave(); setScreen('menu'); }}>
        <label className="field">
          <span>{t("coop.name.label")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("coop.name.placeholder")} autoFocus />
        </label>
        <Grid cols={2} gap="lg" align="stretch">
          <CoopSection title={t("coop.host.section")}>
            <p className="hint">{t("coop.host.hint")}</p>
            <button
              className="btn btn-primary"
              disabled={!name.trim() || busy}
              onClick={async () => {
                setError('');
                setBusy(true);
                if (!(await hostStart(name.trim()))) setError(t("coop.host.error"));
                setBusy(false);
              }}
            >
              {t("coop.host.btn")}
            </button>
          </CoopSection>
          <CoopSection title={t("coop.join.section")}>
            <p className="hint">{t("coop.join.hint")}</p>
            <CoopCodeInput valeur={joinCode} onChange={setJoinCode} placeholder={t("coop.join.placeholder")} />
            <button
              className="btn btn-primary"
              disabled={!name.trim() || joinCode.trim().length !== 6 || busy}
              onClick={async () => {
                setError('');
                setBusy(true);
                const err = await join(joinCode, name.trim());
                if (err) setError(err);
                setBusy(false);
              }}
            >
              {t("coop.join.btn")}
            </button>
            {error && <ChipDeRefus refus={{ message: error }} />}
          </CoopSection>
        </Grid>
      </CoopShell>
    );
  }

  if (net.mode === 'guest') {
    return (
      <CoopShell title={t("coop.title.guest")} backLabel={t("coop.back.quit")} onBack={() => { leave(); setScreen('menu'); }}>
        <CoopSection title={<>Partie {net.roomCode}</>}>
          <CoopSeatList />
        </CoopSection>
        <Row className="hint" gap="xs" justify="center">
          <Icon id={net.connection === 'reconnecting' ? 'coop/away' : 'ui/wait'} size="sm" />
          {net.hostAway ? t("coop.guest.waiting.hostAway")
            : net.connection === 'reconnecting' ? t("coop.guest.waiting.reconnecting")
            : t("coop.guest.waiting.default")}
        </Row>
      </CoopShell>
    );
  }

  // ── HÔTE ──
  return (
    <CoopShell title={t("coop.title.host")} backLabel={t("coop.back.quit")} onBack={() => { leave(); setScreen('menu'); }} wide>
      <CoopHostSections />
      {/* Charger en session : le salon survit (`applyLoadedSave` préserve `net`), l'invité
          suit au snapshot — c'est LE chemin pour reprendre une partie coop sauvegardée. */}
      <Row gap="md" className="coop-actions">
        <button className="btn" onClick={() => setLoadOpen(true)}><Icon id="file/open" /> {t("coop.host.loadGame")}</button>
        <button className="btn btn-primary" onClick={() => setScreen('party')}>
          {t("coop.host.compose")}
        </button>
      </Row>
      {loadOpen && <SaveLoadModal mode="load" onClose={() => setLoadOpen(false)} />}
    </CoopShell>
  );
}
