// Core game logic for PromptQuest. Pure, side-effect-free, and unit-tested.

export const GENERATION_MS = 90000 // "the AI" takes 90s to generate the answer
export const AP_CAP = 12

export const ACTION_LIST = [
	{ kind: "attack", label: "Attack", icon: "\u2694\uFE0F", cost: 1, desc: "Reliable damage" },
	{ kind: "special", label: "Special", icon: "\u2728", cost: 2, desc: "A powerful blow" },
	{ kind: "defend", label: "Defend", icon: "\uD83D\uDEE1\uFE0F", cost: 1, desc: "Cut the next hit by 70%" },
	{ kind: "heal", label: "Heal", icon: "\u2764\uFE0F", cost: 1, desc: "Restore vigor" },
	{ kind: "flee", label: "Flee", icon: "\uD83C\uDFC3", cost: 1, desc: "Skip to the next foe" },
]

export const MONSTERS = [
	{ name: "Vague Slime", hp: 40, atk: 8, reward: 40, interval: 4200, actions: 1 },
	{ name: "Ambiguity Goblin", hp: 60, atk: 11, reward: 70, interval: 3800, actions: 2 },
	{ name: "Hallucination Bug", hp: 85, atk: 14, reward: 110, interval: 3400, actions: 2 },
	{ name: "Context Wraith", hp: 115, atk: 17, reward: 160, interval: 3000, actions: 3 },
	{ name: "Token Dragon", hp: 150, atk: 21, reward: 240, interval: 2600, actions: 3 },
]

export const MONSTER_EMOJI = ["\uD83D\uDFE2", "\uD83D\uDC7A", "\uD83D\uDC1B", "\uD83D\uDC7B", "\uD83D\uDC09"]

export function makeMonster(level) {
	const base = MONSTERS[level % MONSTERS.length]
	const loop = Math.floor(level / MONSTERS.length)
	const scale = 1 + loop * 0.5
	return {
		name: loop > 0 ? `${base.name} +${loop}` : base.name,
		maxHp: Math.round(base.hp * scale),
		hp: Math.round(base.hp * scale),
		atk: Math.round(base.atk * scale),
		reward: Math.round(base.reward * scale),
		interval: Math.max(1600, Math.round(base.interval - loop * 300)),
		actions: Math.min(6, base.actions + loop),
		level,
	}
}

// Better prompts grant more action points and stronger actions.
export function apFromScore(score, crit) {
	return Math.max(2, Math.min(8, 2 + Math.floor(score / 18) + (crit ? 1 : 0)))
}
export function powerFromScore(score) {
	return 0.6 + score / 100
}

export function pushLog(log, entry) {
	const next = log.concat([entry])
	return next.length > 15 ? next.slice(next.length - 15) : next
}

export function initGame() {
	const m = makeMonster(0)
	return {
		status: "playing",
		level: 0,
		score: 0,
		genElapsed: 0,
		playerHp: 100,
		playerMaxHp: 100,
		ap: 0,
		power: 1,
		guard: 0,
		enemyActions: 0,
		enemyCooldown: m.interval,
		roundActive: false,
		monster: m,
		log: [
			{ kind: "info", text: "The AI starts generating your answer\u2026" },
			{ kind: "info", text: `A ${m.name} appears to make you wait.` },
			{ kind: "info", text: "Write a prompt to earn actions, then fight!" },
		],
	}
}

function defeatMonster(state) {
	const reward = state.monster.reward
	const nextLevel = state.level + 1
	const m = makeMonster(nextLevel)
	let log = pushLog(state.log, { kind: "win", text: `${state.monster.name} defeated! +${reward} score.` })
	log = pushLog(log, { kind: "info", text: `A ${m.name} steps up.` })
	return {
		...state,
		score: state.score + reward,
		level: nextLevel,
		playerHp: Math.min(state.playerMaxHp, state.playerHp + 15),
		monster: m,
		enemyActions: 0,
		enemyCooldown: m.interval,
		roundActive: false,
		log,
	}
}

function fleeToNext(state) {
	const nextLevel = state.level + 1
	const m = makeMonster(nextLevel)
	const log = pushLog(state.log, { kind: "info", text: `A ${m.name} blocks the way.` })
	return { ...state, level: nextLevel, monster: m, enemyActions: 0, enemyCooldown: m.interval, roundActive: state.ap > 0, log }
}

function restartBattle(state) {
	const m = makeMonster(state.level)
	const log = pushLog(state.log, { kind: "info", text: "Stalemate \u2014 the battle resets. Write a prompt to re-engage." })
	return { ...state, playerHp: state.playerMaxHp, monster: m, ap: 0, guard: 0, enemyActions: 0, enemyCooldown: m.interval, roundActive: false, log }
}

export function reducer(state, action) {
	switch (action.type) {
		case "REFUEL": {
			if (state.status !== "playing") return state
			const { score, crit } = action.payload
			const granted = apFromScore(score, crit)
			const ap = Math.min(AP_CAP, state.ap + granted)
			const power = powerFromScore(score)
			const enemyActions = state.monster.actions
			const log = pushLog(state.log, {
				kind: crit ? "crit" : "hit",
				text: `Prompt ${score} \u2192 +${granted} actions, power \u00d7${power.toFixed(2)}. ${state.monster.name} readies ${enemyActions} move${enemyActions > 1 ? "s" : ""}.`,
			})
			return { ...state, ap, power, enemyActions, enemyCooldown: state.monster.interval, roundActive: true, log }
		}
		case "ACTION": {
			if (state.status !== "playing") return state
			const def = ACTION_LIST.find((a) => a.kind === action.payload.kind)
			if (!def || state.ap < def.cost) return state
			const power = state.power || 1
			let s = { ...state, ap: state.ap - def.cost }
			if (def.kind === "attack") {
				const dmg = Math.round(10 * power)
				s.monster = { ...s.monster, hp: s.monster.hp - dmg }
				s.log = pushLog(s.log, { kind: "hit", text: `You strike for ${dmg}.` })
			} else if (def.kind === "special") {
				const dmg = Math.round(26 * power)
				s.monster = { ...s.monster, hp: s.monster.hp - dmg }
				s.log = pushLog(s.log, { kind: "crit", text: `Special attack! ${dmg} damage.` })
			} else if (def.kind === "defend") {
				s.guard = 0.7
				s.log = pushLog(s.log, { kind: "info", text: "You brace \u2014 next hit reduced." })
			} else if (def.kind === "heal") {
				const heal = Math.round(20 * power)
				s.playerHp = Math.min(s.playerMaxHp, s.playerHp + heal)
				s.log = pushLog(s.log, { kind: "win", text: `You recover ${heal} HP.` })
			} else if (def.kind === "flee") {
				const chance = Math.min(0.9, 0.35 + power * 0.25)
				if (Math.random() < chance) {
					s.log = pushLog(s.log, { kind: "info", text: "You slip past to the next foe." })
					return fleeToNext(s)
				}
				s.log = pushLog(s.log, { kind: "dmg", text: "Couldn't escape!" })
			}
			if (s.monster.hp <= 0) return defeatMonster(s)
			return s
		}
		case "TICK": {
			if (state.status !== "playing") return state
			const dt = (action.payload && action.payload.dt) || 0
			let s = { ...state }
			s.genElapsed = s.genElapsed + dt
			if (s.genElapsed >= GENERATION_MS) {
				s.genElapsed = GENERATION_MS
				s.status = "won"
				s.log = pushLog(s.log, { kind: "win", text: "Your answer is ready \u2014 send a prompt to ask again." })
				return s
			}
			if (s.enemyActions > 0) {
				s.enemyCooldown = s.enemyCooldown - dt
				if (s.enemyCooldown <= 0) {
					const dmg = Math.max(1, Math.round(s.monster.atk * (s.guard ? 1 - s.guard : 1)))
					s.playerHp = s.playerHp - dmg
					s.enemyActions = s.enemyActions - 1
					s.enemyCooldown = s.monster.interval
					s.guard = 0
					s.log = pushLog(s.log, { kind: "dmg", text: `${s.monster.name} hits you for ${dmg}.` })
					if (s.playerHp <= 0) {
						s.playerHp = 0
						s.status = "lost"
						s.log = pushLog(s.log, { kind: "lost", text: "You fell. Send a prompt to start again." })
						return s
					}
				}
			}
			if (s.roundActive && s.ap === 0 && s.enemyActions === 0 && s.monster.hp > 0 && s.playerHp > 0) {
				return restartBattle(s)
			}
			return s
		}
		case "CONTINUE": {
			const m = makeMonster(state.level)
			return {
				...state,
				status: "playing",
				genElapsed: 0,
				monster: m,
				ap: 0,
				guard: 0,
				enemyActions: 0,
				enemyCooldown: m.interval,
				roundActive: false,
				log: pushLog(state.log, { kind: "info", text: "New question sent \u2014 the AI thinks again." }),
			}
		}
		case "RESTART":
			return initGame()
		default:
			return state
	}
}
