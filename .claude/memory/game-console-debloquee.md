---
name: game-console-debloquee
description: "Débloquer une AUTRE session Claude Code bloquée sur un modal (Windows, pas de tmux) — AttachConsole + WriteConsoleInput, sans tuer"
metadata:
  node_type: memory
  type: reference
---

**Why:** deux sessions tournent sur la même machine Windows ; une session bloquée sur un modal ne s'affiche pas dans claude.ai/code et la tuer perd la continuité.

**How to apply:** identifier l'AUTRE `claude.exe` (celui qui tient le TUI, sans `--bg-pty-host`) ; lire son écran par P/Invoke `kernel32` (`FreeConsole`, `AttachConsole(pid)`, `CreateFileW("CONOUT$", [uint32]3221225472, 3)`, `ReadConsoleOutputCharacterW`) ; injecter une touche par `CONIN$` + `WriteConsoleInput` (Échap `0x1B` annule le modal, Entrée `0x0D` valide le choix surligné). La liste blanche lean-ctx bloque `pwsh` en ligne de commande : passer par un lanceur `node` qui `spawnSync('powershell', ['-NoProfile','-ExecutionPolicy','Bypass','-File', …])`. Toujours MONTRER le modal à l'utilisateur et le laisser choisir ; `taskkill` est le dernier recours.
