# Litany Reader

Shows a litany one line at a time, in large text on a dark screen, paced to guide calm breathing.

## Run

Double-click `start.bat`, or run:

```
node server.js
```

then open http://localhost:8484. Needs Node.js. There is nothing to install.

## Litanies

Put plain `.txt` files in `litanies/`. The first line is the title, and every other non-empty line is one step on screen. The folder is read fresh each time, so new or edited files show up when you refresh.

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
