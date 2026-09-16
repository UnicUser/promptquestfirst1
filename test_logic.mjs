// Lightweight unit tests for the pure game logic. Run with: node test_logic.mjs
import {
	ACTION_LIST,
	AP_CAP,
	GENERATION_MS,
	apFromScore,
	initGame,
	makeMonster,
	powerFromScore,
	reducer,
} from "./src/game/rpg.js"
import { rankFor, scorePrompt } from "./src/game/promptScore.js"

let passed = 0
let failed = 0
function ok(cond, name) {
	if (cond) {
		passed++
		console.log("ok  : " + name)
	} else {
		failed++
		console.log("FAIL: " + name)
	}
}

const refuel = (state, score, crit = false) => reducer(state, { type: "REFUEL", payload: { score, crit } })
const act = (state, kind) => reducer(state, { type: "ACTION", payload: { kind } })
const tick = (state, dt) => reducer(state, { type: "TICK", payload: { dt } })

// ---- promptScore ----
const weak = scorePrompt("do something good")
ok(weak.score < 20, "weak prompt scores low (" + weak.score + ")")
const strong = scorePrompt(
	"You are an expert chef. In 3 bullet points, list a quick pasta dinner for beginners, so that a student can cook it in 15 minutes.",
)
ok(strong.score >= 70, "strong prompt scores high (" + strong.score + ")")
ok(typeof rankFor(strong.score) === "string", "rankFor returns string")

ok(apFromScore(strong.score, false) > apFromScore(weak.score, false), "better prompt grants more actions")
ok(apFromScore(50, true) >= apFromScore(50, false), "crit grants at least as many actions")
ok(powerFromScore(80) > powerFromScore(10), "higher score means stronger actions")

// ---- REFUEL ----
let s = initGame()
s = refuel(s, strong.score, strong.crit)
ok(s.ap >= 6 && s.ap <= AP_CAP, "strong prompt refuels plenty of AP (" + s.ap + ")")
ok(s.enemyActions === s.monster.actions, "enemy gains bounded actions from the prompt (" + s.enemyActions + ")")
ok(s.roundActive === true, "a prompt starts an active round")

// ---- ACTIONS ----
let a = refuel(initGame(), 90, true)
const apBefore = a.ap
a = act(a, "attack")
ok(a.ap === apBefore - 1, "attack costs 1 AP")
ok(a.monster.hp < a.monster.maxHp, "attack damages the monster")

let sp = refuel(initGame(), 90, true)
const spAp = sp.ap
sp = act(sp, "special")
ok(sp.ap === spAp - 2, "special costs 2 AP")

let h = refuel(initGame(), 90, true)
h = { ...h, playerHp: 50 }
h = act(h, "heal")
ok(h.playerHp > 50, "heal restores vigor")

let d = refuel(initGame(), 90, true)
d = act(d, "defend")
ok(d.guard === 0.7, "defend raises a guard")

let none = refuel(initGame(), 90, true)
none = { ...none, ap: 0 }
const noneHp = none.monster.hp
none = act(none, "attack")
ok(none.monster.hp === noneHp, "no AP means no attack")

// ---- ENEMY (bounded) ----
let e = refuel(initGame(), 90, true)
ok(e.enemyActions === e.monster.actions, "enemy budget equals its per-level action count")
e = tick(e, e.monster.interval)
ok(e.playerHp < 100, "enemy attacks while it has actions")
ok(e.enemyActions === e.monster.actions - 1, "enemy action budget depletes")

// enemy stops attacking when out of actions -> no guaranteed death
let safe = refuel(initGame(), 90, true)
safe = { ...safe, ap: 0, enemyActions: 0, playerHp: 5 }
for (let i = 0; i < 20; i++) safe = tick(safe, safe.monster.interval)
ok(safe.playerHp === safe.playerMaxHp || safe.status === "playing", "enemy STOPS attacking when out of actions (no guaranteed death)")

// a draw keeps the game going & restarts the battle
let draw = refuel(initGame(), 30, false)
draw = { ...draw, ap: 0, enemyActions: 0, playerHp: 40 }
draw = tick(draw, 10)
ok(draw.status === "playing", "a draw keeps the game going")
ok(draw.playerHp === draw.playerMaxHp, "a draw restarts the battle (HP restored)")
ok(draw.roundActive === false, "a draw clears the active round")

// losing
let lose = refuel(initGame(), 90, true)
lose = { ...lose, ap: 0, playerHp: 1, enemyActions: 3 }
for (let i = 0; i < 5 && lose.status === "playing"; i++) lose = tick(lose, lose.monster.interval)
ok(lose.status === "lost", "running out of HP loses")

// winning
let win = refuel(initGame(), 90, true)
win = { ...win, enemyActions: 0 }
win = tick(win, GENERATION_MS)
ok(win.status === "won", "filling the generation meter wins the round")

// continue keeps score, restart resets
let cont = { ...win, score: 120 }
cont = reducer(cont, { type: "CONTINUE" })
ok(cont.status === "playing" && cont.score === 120 && cont.genElapsed === 0, "continue keeps score and refills the meter")
const fresh = reducer({ ...cont, score: 999 }, { type: "RESTART" })
ok(fresh.score === 0 && fresh.level === 0 && fresh.status === "playing", "restart begins a fresh game")

// sanity: 5 monsters + escalation
ok(makeMonster(0).name !== makeMonster(5).name, "monsters escalate after a full loop")
ok(ACTION_LIST.length === 5, "five battle actions are available")

console.log("\n" + (failed === 0 ? "ALL PASSED" : failed + " FAILED") + " (" + passed + " passed)")
process.exit(failed === 0 ? 0 : 1)
