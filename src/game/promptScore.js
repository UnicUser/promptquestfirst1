// Scores a user's prompt from 0-100 based on prompt-engineering best practices.
// A higher score grants more and stronger battle actions.

export const SIGNALS = [
	{ id: "role", re: /\b(you are|act as|as an?|role of|expert|assistant)\b/i, pts: 12, tip: 'Give the AI a role ("You are a senior editor\u2026").' },
	{ id: "context", re: /\b(context|background|because|so that|goal|i am|i'm|we are|we're)\b/i, pts: 12, tip: 'Add context or your goal ("so that\u2026").' },
	{ id: "format", re: /\b(format|as a (list|table|json)|bullet|markdown|steps?|numbered)\b/i, pts: 14, tip: "Ask for a specific output format (list, table, JSON)." },
	{ id: "constraints", re: /\b(no more than|at most|within|limit|only|avoid|\d+\s*(words?|sentences?|bullets?|items?))\b/i, pts: 12, tip: 'Add a concrete constraint ("in 3 bullet points").' },
	{ id: "examples", re: /\b(example|for instance|e\.g\.|such as|like this)\b/i, pts: 10, tip: "Ask for or give an example." },
	{ id: "audience", re: /\b(audience|reader|for (kids|beginners|experts|developers|a \w+))\b/i, pts: 8, tip: 'Name the audience ("explain for a beginner").' },
	{ id: "tone", re: /\b(tone|style|concise|detailed|formal|casual|friendly|professional)\b/i, pts: 8, tip: "Specify tone or style." },
]

const VAGUE = /\b(something|stuff|things?|etc\.?|good|nice|whatever|any\b|some\b)\b/gi

function countWords(t) {
	return (t.trim().match(/\S+/g) || []).length
}

function lengthScore(words) {
	if (words === 0) return 0
	if (words < 4) return 4
	if (words < 12) return 10 + (words - 4) * 1.5
	if (words <= 70) return 24
	if (words <= 120) return 18
	return 10
}

export function rankFor(score) {
	if (score >= 90) return "Archmage"
	if (score >= 75) return "Wizard"
	if (score >= 55) return "Adept"
	if (score >= 30) return "Apprentice"
	return "Novice"
}

export function scorePrompt(text) {
	const raw = (text || "").trim()
	const words = countWords(raw)
	const matched = []
	const missing = []
	let signalPts = 0
	for (const s of SIGNALS) {
		if (s.re.test(raw)) {
			signalPts += s.pts
			matched.push(s.id)
		} else {
			missing.push({ id: s.id, tip: s.tip })
		}
	}
	signalPts = Math.min(signalPts, 58)
	const lenPts = lengthScore(words)
	const vagueHits = (raw.match(VAGUE) || []).length
	const vaguePenalty = Math.min(vagueHits * 5, 20)
	const hasClearAsk =
		/[?]/.test(raw) ||
		/^(write|make|create|explain|list|summarize|draft|design|build|generate|compare|translate|fix|improve)\b/i.test(raw)
	const clarityPts = hasClearAsk ? 10 : 0
	let score = Math.round(lenPts + signalPts + clarityPts - vaguePenalty)
	score = Math.max(0, Math.min(100, score))
	return { score, rank: rankFor(score), matched, missing: missing.slice(0, 3), crit: score >= 85 }
}
