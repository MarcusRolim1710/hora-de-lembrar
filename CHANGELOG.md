# Changelog — Hora de Lembrar!

Todas as mudanças importantes deste projeto serão documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
versionamento [SemVer](https://semver.org/lang/pt-BR/): `MAJOR.MINOR.PATCH`.

## [1.2.1] - 2026-09-04
### Fixed
- Ritmo competitivo: par errado desvira em ~200ms (antes ~1,4s parado).
- Conferência no servidor 800ms → 200ms; trava de clique 1000ms → 350ms; removido delay extra de 600ms no client.
- Animação de giro 0,5s → 0,25s e shake de erro encurtado (1 balanço, sem travar o ritmo).
- Medido em teste local: 2º flip → `no-match` em 217ms.

## [1.2.0] - 2026-09-04
### Added
- Senha de sala opcional: PIN de 4 dígitos ao criar (toggle 🔓/🔒 + campo numérico).
- Lobby mostra cadeado nas salas protegidas; entrar exige PIN via modal (erro "Senha incorreta" sem vazar nada).
- `list-rooms` inclui `hasPassword` (PIN nunca sai do servidor; guardado como SHA-256 + salt da sala, comparado com `timingSafeEqual`).
- Badge "🔒 Sala protegida" na espera; membro que já entrou não precisa do PIN de novo no F5 (`rejoin-room`).

## [1.1.0] - 2026-09-04
### Added
- Identidade "Hora de Lembrar!": mascote relógio-despertador sorridente (`icon.svg`), logo horizontal (`logo-hora-de-lembrar.svg`), fonte Baloo 2, tagline "Bora testar essa memória?".
- Ícones PWA `icon-192.png` e `icon-512.png` (antes faltavam, instalacao falhava).
- Placar ao vivo com pares/total, % e troféus, ordenado por quem está na frente.
- Eventos `joined-room`, `rejoin-room`, `leave-room`, `host-changed` e `progress-updated`.
- `CHANGELOG.md` e workflow de Release automática.

### Fixed
- Entrar em sala com código agora salva sessão e redireciona para `/waiting` (antes travava no lobby).
- Sessão estável via `playerId` persistente: host consegue iniciar, `flip-card` funciona após troca de página (antes `socket.id` mudava e quebrava tudo).
- Board privado por jogador: fim do vazamento que sobrescrevia seu tabuleiro com o do adversário.
- Lock server-side anti-race no `flip-card`/`checkMatch` (cartas não travam mais com clique rápido).
- Melhor-de-3 encerra cedo em 2 vitórias (antes sempre jogava 3 rounds).
- Migração de host + reconexão após F5 (slot mantido, `offline` no placar).
- `updateScoreboard` com `id` (antes sempre mostrava 0 🏆).

## [1.0.0] - 2026-09-03
### Added
- MVP: lobby, salas de 2-4 jogadores, modos rodada única / melhor de 3, tabuleiros individuais, timer, PWA base, 10 imagens de frutas.
