# PromptQuest — Make Waiting for AI Fun

A tiny prompt-powered RPG built for the **Commonsmade / VibeFi** hackathon theme *"Make Waiting for AI Fun."*

While "the AI" generates your answer (a 90-second meter), you fight the monsters of bad prompting. The **prompt box is the star of the screen** — the better your prompt (role, context, format, constraints, clear ask), the more and stronger **battle actions** you earn.

## Gameplay

- **Write a prompt** to earn Action Points (AP). Prompt quality (0–100) drives how many actions you get and how hard they hit.
- **Fight** with 5 classic RPG actions: Attack, Special, Defend, Heal, Flee.
- The enemy has a **limited number of moves per prompt** — it can't grind you down forever.
- If both sides run out of moves with nobody defeated, the **battle resets** (a truce) — no cheap deaths.
- **No pop-ups, ever.** Win or lose is shown as a small line in the combat log. Just keep typing:
  - After a **win**, a new prompt asks the next question (score is kept).
  - After a **loss**, a new prompt starts a fresh game.
- The whole HUD is intentionally **15% smaller**, then the interface is scaled up **20%**, so the prompt box stays the focal point.
- **Hover-scale:** buttons smoothly grow on hover for a lively, game-like feel.

## Look & feel

- Centered **PromptQuest** title up top.
- **Heart icons** next to each HP bar (yours pulses red; the foe's is tinted).
- A twinkling **starfield** plus a light, drifting **pixel-fog** in a few spots on the backdrop.

## Run it

```bash
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173).

### Build for production

```bash
npm run build
npm run preview
```

## Test

Pure game logic is unit-tested (no framework required):

```bash
npm test        # or: node test_logic.mjs
```

## Project structure

```
promptquest/
├─ index.html            # Vite entry
├─ vite.config.js
├─ package.json
├─ test_logic.mjs        # unit tests for the reducer + scorer
├─ public/favicon.svg
└─ src/
   ├─ main.jsx           # React bootstrap
   ├─ App.jsx
   ├─ index.css          # theme vars + starfield
   ├─ PromptQuest.jsx    # UI + interaction
   ├─ PromptQuest.css    # HUD + prompt box + hover-scale + pixel fog
   └─ game/
      ├─ rpg.js          # state machine: monsters, actions, ticks
      └─ promptScore.js  # scores prompt quality → actions
```

## How prompt scoring works

`scorePrompt()` rewards prompt-engineering signals — giving the AI a **role**, adding **context/goal**, requesting an **output format**, setting **constraints**, providing **examples**, naming an **audience**, and specifying **tone** — plus a sensible length, and penalizes vague filler words. Score maps to a rank (Novice → Archmage) and to battle power.
