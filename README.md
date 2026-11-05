# Litany Reader

Shows a litany one line at a time, in large text on a dark screen, paced to guide calm breathing.

## Run

```
npm start    # runs in the background and opens your browser
npm stop     # stops it
```

Or double-click `start.bat` and `stop.bat`. The reader is at http://localhost:8484. It needs Node.js; there is nothing to install.

## Litanies

The idea comes from the **Litany Against Fear** in Frank Herbert's *Dune* (1965), recited by the Bene Gesserit to calm the mind in the face of fear. The litanies here, by piyook, are written in the same spirit: short lines, spoken slowly, in time with the breath.

| File | Author |
|---|---|
| `litany-against-anxiety.txt` | piyook |
| `litany-against-despair.txt` | piyook |
| `litany-for-calm.txt` | piyook |
| `litany-for-patience.txt` | piyook |

### File format

Each litany is a plain `.txt` file in `litanies/`:

```
Title of the litany

First line.
Second line.
...

Author: Name
```

- The first line is the title.
- Every other non-empty line is one step on screen.
- An optional last line starting `Author:` is shown as a small credit in the whole-litany view, not as a step.

The folder is read fresh each time, so new or edited files show up when you refresh.

## Breathing

Lines alternate between an in-breath and an out-breath:

1. **In-breath** (4s): the line fills left to right in amber.
2. **Hold** (4s): a circle under the line draws itself round.
3. **Out-breath** (6s): the next line fills in blue, more slowly.
4. **Hold** (2s): the circle again.

Change the timings with the ⚙ button. They are saved in the browser.

## Controls

Move the pointer to the bottom of the screen to show the controls: previous, play/pause, next, loop, whole litany, settings, back. With loop on, the litany repeats from the start indefinitely.

Keys: `Space` play/pause · `←` `→` previous/next · `L` loop on/off · `V` whole litany on one screen · `F` fullscreen · `Esc` back to the index.
