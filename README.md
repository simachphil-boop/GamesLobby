# BOARDVERSE

A 3D universe of board & card games: sit at a table in a virtual room with animated bot characters,
switch between **first-person** and **third-person** cameras, and play 10 fully implemented games.

| | |
|---|---|
| **Android** | `dist/BOARDVERSE.apk` (Android 7.0+, signed with APK Signature Scheme v2) |
| **PC / browser** | `dist/BOARDVERSE-PC.html` — a single self-contained file, double-click to play (Chrome/Edge/Firefox) |
| **Online server** | `node server/relay.js [port]` (no dependencies) |

## Games (all with full rules, bots with 4 difficulty levels, animations)
| Game | Players | Variants / options |
|---|---|---|
| Tycoon (Monopoly-style) | 2–5 | 6 original boards, 12 tokens, Classic / Jackpot / Speed start, 20/40 rounds or last standing; buy, rent, houses/hotels, mortgages, auctions, trades, cards, jail, taxes, bankruptcy |
| Color Blitz (UNO-style) | 2–5 | 4 deck designs, Classic / Stacking / Draw-until-playable / Strict +4, one round / 200 / 500 points, ONE! call & catch |
| Hold'em (virtual points only) | 2–5 | blinds, side pots, all-in, showdown, 15/30 hands or last standing |
| Chess 3D | 2 | castling, en passant, promotion, check/mate/stalemate, 50-move, repetition, insufficient material, clocks, history, undo |
| Checkers | 2 | Russian (flying kings), English, Casual |
| Backgammon | 2 | Standard / Nackgammon, bar, bearing off, gammon |
| Ludo | 2–4 | Classic / Relaxed |
| Domino | 2–4 | Block / Draw / All Fives, rounds to 100/150 |
| Four in a Row | 2 | 7×6, 8×7, 9×7 |
| Tic-Tac-Toe 3D | 2 | 3×3, 4×4, 5×5, 4 visual themes |

Modes: vs bots, local hot-seat (pass the device), online rooms with invite codes, quick game.
Also: 12 bot personas with personalities, emotions, gestures and chat lines; avatar editor;
6 rooms; collection & coins (no real money); daily rewards; profile, levels, achievements;
9 languages (RU/EN complete, ES/FR/DE/IT/TR/ZH/JA interface); LOW/MEDIUM/HIGH graphics, 30/60 FPS cap.

## Architecture (web/src)
```
core/      store (save system, profile, achievements), audio (procedural WebAudio), catalog, rng, events
i18n/      localization dictionaries + registerStrings() for modules
scene/     engine (renderer, quality, tweens), room (6 interiors), characters (procedural avatars, IK, emotes),
           camera (FP/TP + transitions), dice, particles, labels (speech bubbles)
bots/      personas (12 characters), reactions (emotion/line director)
games/     framework.js (Match: turn loop, humans/bots/remote, undo, autosave/resume, results)
           <game>/rules.js  pure deterministic state machine   <game>/ai.js  bot logic   <game>/index.js 3D view + UI
ai/        worker (search-heavy bots run off the main thread)
net/       online rooms: BroadcastChannel (same device) or WebSocket relay; lockstep action sync
ui/        screens (menu, library, setup, character, collection, settings, online, daily, profile), HUD
android/   native WebView shell + SDK-free APK toolchain (apkpack.py writes binary manifest/resources, apksig signs)
```
Each game is an independent module; adding a game = new folder + one line in `games/registry.js`.

## Build
```bash
cd web && npm install && npm test        # rules tests (perft for chess, simulations for all games)
npm run build                            # -> web/dist (APK assets) + boardverse-single.html (PC)
cd .. && VERSION_CODE=10 VERSION_NAME=1.0.0 android/tools/build_apk.sh   # -> dist/BOARDVERSE.apk
```
Needs Node 18+, JDK 17+, Python 3. The script downloads dx/apksig/android stubs from Maven Central.
A signing key is generated at `android/keystore/boardverse.p12` (not committed). Keep it to ship updates
over an installed version; for Google Play use your own release key.

## Online play
Without a server, rooms work between windows/tabs of the same browser. For internet play run
`node server/relay.js 8787` on a reachable host and set `ws://host:8787` in Settings → Online on every device.

## Roadmap (next updates)
- Accounts with server-side progress sync, matchmaking for quick online games
- Spinner/Mexican-train domino, Long Nardy, doubling cube for backgammon, more poker variants
- Motion-captured character animations, more rooms and outfits, voice lines
- Full translations of long texts (rules, cards, bot lines) for ES/FR/DE/IT/TR/ZH/JA
