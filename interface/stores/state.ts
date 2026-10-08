import { writable, get } from "svelte/store"

const defaultState: LibState = {
	authenticated: false,
	importData: null,
	updateAvailable: false,
	searchHistory: "",
}

const parseState = (): LibState => {
	try {
		if (typeof sessionStorage !== "undefined") {
			const raw = sessionStorage.getItem("state") || (sessionStorage as any).state
			if (raw) {
				const parsed = JSON.parse(raw)
				if (parsed && typeof parsed === "object") {
					return { ...defaultState, ...parsed }
				}
			}
		}
	} catch (e) {
		console.error("Failed to parse state:", e)
	}
	return defaultState
}

export const state = writable<LibState>(parseState())

state.subscribe((data) => {
	if (typeof window !== "undefined" && (window as any).__AUTHME_DEBUG__) {
		const sanitized = {
			...data,
			importData: data.importData ? "[REDACTED]" : null,
		}
		console.log("State changed: ", sanitized)
	}

	try {
		if (typeof sessionStorage !== "undefined") {
			const json = JSON.stringify(data)
			sessionStorage.setItem("state", json)
			try {
				;(sessionStorage as any).state = json
			} catch {}
		}
	} catch {}
})

export const getState = (): LibState => {
	return get(state)
}

export const setState = (newState: LibState) => {
	state.set(newState)
}

