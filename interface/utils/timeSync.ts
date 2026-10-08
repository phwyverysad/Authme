/**
 * Network Time Synchronization & Clock Drift Compensation for Authme
 * Automatically synchronizes with global atomic clocks (Cloudflare / 1.1.1.1 / TimeAPI)
 * to ensure 2FA tokens and countdowns follow the exact world standard UTC time,
 * completely independent of whatever local timezone or clock error exists on Windows.
 */

const CACHE_KEY = "authme_time_offset_ms"

let timeOffsetMs = 0
let lastSyncTime = 0
let isSyncing = false

// Restore last verified offset from persistent storage immediately on launch
if (typeof localStorage !== "undefined") {
	try {
		const cached = localStorage.getItem(CACHE_KEY)
		if (cached !== null) {
			const parsed = parseInt(cached, 10)
			if (!isNaN(parsed) && Math.abs(parsed) < 30 * 86400 * 1000) {
				timeOffsetMs = parsed
			}
		}
	} catch (e) {}
}

/**
 * Returns the true universal UTC timestamp in milliseconds,
 * auto-compensated for any local Windows clock distortion.
 */
export const getAccurateTimestamp = (): number => {
	return Date.now() + timeOffsetMs
}

/**
 * Returns the current compensated offset in seconds.
 */
export const getTimeOffsetSeconds = (): number => {
	return Math.round(timeOffsetMs / 1000)
}

/**
 * Synchronizes local clock with global atomic internet time.
 * Uses high-precision Anycast timestamp sources (ts= in seconds).
 */
export const syncNetworkTime = async (): Promise<number> => {
	if (isSyncing) return timeOffsetMs
	isSyncing = true

	const endpoints = [
		"https://www.cloudflare.com/cdn-cgi/trace",
		"https://1.1.1.1/cdn-cgi/trace",
		"https://timeapi.io/api/time/current/zone?timeZone=UTC",
	]

	for (const url of endpoints) {
		try {
			const start = Date.now()
			const ctrl = new AbortController()
			const timer = setTimeout(() => ctrl.abort(), 4000)

			const res = await fetch(url, { cache: "no-store", signal: ctrl.signal })
			clearTimeout(timer)

			const end = Date.now()
			const roundtrip = end - start

			if (url.includes("/cdn-cgi/trace")) {
				const text = await res.text()
				const match = text.match(/ts=([0-9.]+)/)
				if (match && match[1]) {
					const serverSec = parseFloat(match[1])
					if (!isNaN(serverSec) && serverSec > 1700000000) {
						const serverUtcMs = Math.round(serverSec * 1000) + Math.round(roundtrip / 2)
						timeOffsetMs = serverUtcMs - end
						lastSyncTime = Date.now()
						isSyncing = false
						try {
							if (typeof localStorage !== "undefined") {
								localStorage.setItem(CACHE_KEY, String(timeOffsetMs))
							}
						} catch (e) {}
						return timeOffsetMs
					}
				}
			} else {
				const data = await res.json()
				if (data && data.dateTime) {
					const parsed = new Date(data.dateTime + "Z").getTime()
					if (!isNaN(parsed)) {
						const serverUtcMs = parsed + Math.round(roundtrip / 2)
						timeOffsetMs = serverUtcMs - end
						lastSyncTime = Date.now()
						isSyncing = false
						try {
							if (typeof localStorage !== "undefined") {
								localStorage.setItem(CACHE_KEY, String(timeOffsetMs))
							}
						} catch (e) {}
						return timeOffsetMs
					}
				}
			}
		} catch (e) {
			// Try fallback endpoint
		}
	}

	isSyncing = false
	return timeOffsetMs
}

// Automatically sync on application startup, on network reconnect, and periodically
if (typeof window !== "undefined") {
	setTimeout(() => {
		syncNetworkTime().catch(() => {})
	}, 300)

	setInterval(() => {
		if (Date.now() - lastSyncTime > 10 * 60 * 1000) {
			syncNetworkTime().catch(() => {})
		}
	}, 2 * 60 * 1000)

	window.addEventListener("online", () => {
		syncNetworkTime().catch(() => {})
	})

	window.addEventListener("focus", () => {
		if (Date.now() - lastSyncTime > 5 * 60 * 1000) {
			syncNetworkTime().catch(() => {})
		}
	})
}
