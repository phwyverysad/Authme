import { getSettings } from "../stores/settings"
import { getState, setState } from "../stores/state"
import { navigate } from "./navigate"
import { showToast } from "../stores/dialog"
import { getLanguage } from "./language"
import { flushClipboardNow } from "./clipboardGuard"
import { clearCodesMemory } from "../windows/codes"
import { clearEncryptionKey } from "./encryption"

export const LOCK_TIMER_OPTIONS = [
	"Never",
	"30 seconds",
	"1 minute",
	"5 minutes",
	"10 minutes",
	"30 minutes",
	"1 hour",
]

export const LOCK_TIMER_SECONDS = [0, 30, 60, 300, 600, 1800, 3600]

let idleTimer: NodeJS.Timeout | null = null
let lastActivityTime = Date.now()

export const lockApp = async (notify = true) => {
	const settings = getSettings()
	const state = getState()
	if (!state.authenticated) return
	if (settings.security && settings.security.requireAuthentication === false) return

	state.authenticated = false
	setState(state)

	flushClipboardNow()
	clearCodesMemory()
	try {
		await clearEncryptionKey()
	} catch (e) {}

	navigate("confirm")

	if (notify) {
		const language = getLanguage()
		showToast(language.confirm?.locked || "Authme has been locked.", "info")
	}
}

let lastThrottleTime = 0
export const resetIdleTimer = () => {
	const now = Date.now()
	if (now - lastThrottleTime >= 1000) {
		lastThrottleTime = now
		lastActivityTime = now
	}
}

export const initLockTimer = () => {
	if (typeof window === "undefined") return

	const events = ["mousemove", "keydown", "mousedown", "wheel", "touchstart"]
	events.forEach((ev) => {
		window.addEventListener(ev, resetIdleTimer, { passive: true })
	})

	// Check periodically
	if (idleTimer) clearInterval(idleTimer)

	idleTimer = setInterval(() => {
		const settings = getSettings()
		const state = getState()

		if (!state.authenticated) return
		if (settings.security && settings.security.requireAuthentication === false) return

		const raw = settings?.settings?.lockTimer ?? 0
		const timeoutSec = LOCK_TIMER_SECONDS[raw] !== undefined ? LOCK_TIMER_SECONDS[raw] : raw
		if (timeoutSec <= 0) return

		const idleSeconds = (Date.now() - lastActivityTime) / 1000
		if (idleSeconds >= timeoutSec) {
			lockApp(true)
		}
	}, 1000)
}
