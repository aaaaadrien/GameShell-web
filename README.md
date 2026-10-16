# GameShell-web

## Intro

Browser-playable version of the [GameShell](https://github.com/phyver/GameShell) game,
a game for learning Unix shell commands while having fun.

- 44 missions (the `xeyes` mission was intentionally excluded).
- Interface: HTML + CSS + pure JavaScript (no dependencies).
- Language: **English** by default, **French** automatically if the browser
  language is French (`EN`/`FR` button in the top right corner to switch).
- Progress: saved in a browser **cookie** (1 year).

## Running the game

The simplest way is to serve the folder with a small HTTP server,
but it can also be hosted on apache or nginx:

```sh
cd web
python3 -m http.server 8000
# then open http://server_ip:8000/
```

The `gsh goal`, `gsh check`, `gsh reset`, `gsh help`, ... commands are available.

## Game commands

| Command       | Description                                    |
|---------------|------------------------------------------------|
| `gsh goal`    | show the objective of the current mission      |
| `gsh check`   | check that the objective is met                |
| `gsh reset`   | reset the current mission                      |
| `gsh help`    | short help                                     |
| `gsh skip`    | abandon the mission and move to the next one   |
| `gsh goto N`  | go directly to mission N                       |
| `gsh index`   | list of missions with their status             |
| `gsh stat`    | statistics                                     |
| `gsh exit`    | quit (and save) — or `Ctrl-D`                  |

Keyboard shortcuts: `Tab` (completion), `↑`/`↓` (history),
`Ctrl-L` (clear screen), `Ctrl-C` (interrupt).

## Tests

```sh
node test.js          # unit tests (FS, shell, missions)
node playthrough.js   # automatic resolution of the 44 missions
```
