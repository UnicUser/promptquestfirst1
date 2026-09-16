import { useEffect, useReducer, useRef, useState } from "react"
import { ACTION_LIST, GENERATION_MS, MONSTER_EMOJI, initGame, reducer } from "./game/rpg.js"
import { scorePrompt } from "./game/promptScore.js"
import "./PromptQuest.css"

const BEST_KEY = "promptquest.best"
const TICK_MS = 400
const HERO = "\uD83E\uDDD9"
const DEAD = "\uD83D\uDC80"

function fmt(ms) {
	const t = Math.max(0, Math.round(ms / 1000))
	return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`
}

export default function PromptQuest() {
	const [state, dispatch] = useReducer(reducer, undefined, initGame)
	const [text, setText] = useState("")
	const [feedback, setFeedback] = useState(null)
	const [best, setBest] = useState(() => {
		try {
			const v = Number(localStorage.getItem(BEST_KEY) || 0)
			return isNaN(v) ? 0 : v
		} catch {
			return 0
		}
	})
	const inputRef = useRef(null)
	const logRef = useRef(null)

	// Heartbeat: advance generation + enemy while the round is playing.
	useEffect(() => {
		if (state.status !== "playing") return
		const id = setInterval(() => dispatch({ type: "TICK", payload: { dt: TICK_MS } }), TICK_MS)
		return () => clearInterval(id)
	}, [state.status])

	useEffect(() => {
		if (state.score > best) {
			setBest(state.score)
			try {
				localStorage.setItem(BEST_KEY, String(state.score))
			} catch {}
		}
	}, [state.score, best])

	useEffect(() => {
		if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
	}, [state.log])

	const send = () => {
		const trimmed = text.trim()
		if (!trimmed) return
		const result = scorePrompt(trimmed)
		setFeedback(result)
		// No modals: a new prompt continues after a win, or restarts after a loss.
		if (state.status === "won") dispatch({ type: "CONTINUE" })
		else if (state.status === "lost") dispatch({ type: "RESTART" })
		dispatch({ type: "REFUEL", payload: { score: result.score, crit: result.crit } })
		setText("")
		inputRef.current?.focus()
	}

	const onKey = (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			send()
		}
	}

	const m = state.monster
	const emoji = MONSTER_EMOJI[state.level % MONSTER_EMOJI.length]
	const genPct = Math.min(100, Math.round((state.genElapsed / GENERATION_MS) * 100))
	const hpPct = Math.max(0, Math.round((state.playerHp / state.playerMaxHp) * 100))
	const foePct = Math.max(0, Math.round((m.hp / m.maxHp) * 100))
	const playing = state.status === "playing"
	const foeMoves = state.enemyActions > 0 ? `\u26a1 ${state.enemyActions} left` : "resting"

	const placeholder =
		state.status === "lost"
			? "You fell \u2014 write a prompt to start a new game\u2026"
			: state.status === "won"
				? "Answer ready \u2014 write your next prompt to ask again\u2026"
				: state.ap === 0
					? "Out of actions \u2014 write a strong prompt to gain more\u2026"
					: "Write a prompt to earn more actions\u2026"

	return (
		<div className="pq">
			<div className="pq__fog" aria-hidden="true" />
			<div className="pq__wrap">
				<h1 className="pq__title">PromptQuest</h1>
				<div className="pq__hud">
					<div className="pq__scene">
						<div className="pq__actor">
							<span className="pq__sprite">{state.status === "lost" ? DEAD : HERO}</span>
							<span className="pq__name">You</span>
							<div className="pq__hprow">
								<span className="pq__heart" aria-hidden="true">❤️</span>
								<div className="pq__hpbar">
									<span className="pq__hpbar-fill pq__hpbar-fill--hero" style={{ width: `${hpPct}%` }} />
								</div>
							</div>
							<span className="pq__hpnum">
								{state.playerHp}/{state.playerMaxHp}
							</span>
						</div>

						{state.status === "won" ? (
							<div className="pq__bubble pq__bubble--done">
								<span className="pq__bubble-done">answer ready ✓</span>
							</div>
						) : (
							<div className="pq__bubble">
								<span className="pq__dots">
									<i />
									<i />
									<i />
								</span>
								<span className="pq__bubble-count">{genPct}%</span>
							</div>
						)}

						<div className="pq__actor">
							<span className="pq__sprite pq__sprite--foe">{emoji}</span>
							<span className="pq__name">{m.name}</span>
							<div className="pq__hprow">
								<span className="pq__heart pq__heart--foe" aria-hidden="true">❤️</span>
								<div className="pq__hpbar">
									<span className="pq__hpbar-fill pq__hpbar-fill--foe" style={{ width: `${foePct}%` }} />
								</div>
							</div>
							<span className="pq__hpnum">
								{Math.max(0, m.hp)}/{m.maxHp}
							</span>
							<span className="pq__foe-moves">{foeMoves}</span>
						</div>
					</div>

					<div className="pq__gen">
						<div className="pq__gen-head">
							<span>AI is generating your answer…</span>
							<span className="pq__gen-time">
								{genPct}% · {fmt(state.genElapsed)} / {fmt(GENERATION_MS)}
							</span>
						</div>
						<div className="pq__genbar">
							<span className="pq__genbar-fill" style={{ width: `${genPct}%` }} />
						</div>
					</div>

					<div
						className={`pq__log${state.status === "lost" ? " pq__log--lost" : ""}${state.status === "won" ? " pq__log--won" : ""}`}
						ref={logRef}
					>
						{state.log.map((l, i) => (
							<div key={i} className={`pq__log-line pq__log-line--${l.kind}`}>
								{l.text}
							</div>
						))}
					</div>

					<div className="pq__actions">
						<div className="pq__ap">
							<span className="pq__ap-label">Actions</span>
							<b className="pq__ap-num">{state.ap}</b>
						</div>
						<div className="pq__act-row">
							{ACTION_LIST.map((a) => (
								<button
									key={a.kind}
									className="pq__act"
									disabled={!playing || state.ap < a.cost}
									title={`${a.desc} (cost ${a.cost} AP)`}
									onClick={() => dispatch({ type: "ACTION", payload: { kind: a.kind } })}
								>
									<span className="pq__act-icon">{a.icon}</span>
									<span className="pq__act-label">{a.label}</span>
									<span className="pq__act-cost">{a.cost}</span>
								</button>
							))}
						</div>
					</div>
				</div>

				<div className="pq__box">
					<textarea
						ref={inputRef}
						className="pq__input"
						rows={1}
						value={text}
						placeholder={placeholder}
						onChange={(e) => setText(e.target.value)}
						onKeyDown={onKey}
					/>
					<div className="pq__box-bar">
						<button
							className="pq__icon"
							title="New game"
							aria-label="New game"
							onClick={() => {
								setFeedback(null)
								dispatch({ type: "RESTART" })
								inputRef.current?.focus()
							}}
						>
							<svg viewBox="0 0 24 24" width="18" height="18">
								<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
							</svg>
						</button>
						<span className="pq__box-hint">Better prompts = more &amp; stronger actions · Enter to send</span>
						<button className="pq__send" title="Send prompt" aria-label="Send prompt" disabled={!text.trim()} onClick={send}>
							<svg viewBox="0 0 24 24" width="18" height="18">
								<path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
							</svg>
						</button>
					</div>
				</div>

				<div className="pq__meta">
					<span className="pq__meta-fb">
						{feedback ? (
							<>
								Prompt <b>{feedback.score}</b> · {feedback.rank}
								{feedback.missing[0] ? <span className="pq__meta-tip"> · tip: {feedback.missing[0].tip}</span> : null}
							</>
						) : (
							<span className="pq__meta-muted">Role + context + format + constraints = more actions.</span>
						)}
					</span>
					<span className="pq__meta-score">
						Score {state.score} · Best {best}
					</span>
				</div>
			</div>
		</div>
	)
}
