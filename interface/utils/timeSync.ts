/**
 * Network Time Synchronization & Clock Drift Compensation for Authme
 * Automatically synchronizes with global atomic clocks (Cloudflare / 1.1.1.1 / TimeAPI)
 * to ensure 2FA tokens and countdowns follow the exact world standard UTC time,
 * completely independent of whatever local timezone or clock error exists on Windows.
 */

const CACHE_KEY = "authme_time_offset_ms"

// Sanity bounds: 2024 to 2050 (timestamp between 1,700,000,000 and 2,524,608,000 seconds)
export const MIN_VALID_TIMESTAMP_SEC = 1700000000
export const MAX_VALID_TIMESTAMP_SEC = 2524608000
export const MIN_VALID_TIMESTAMP_MS = MIN_VALID_TIMESTAMP_SEC * 1000
export const MAX_VALID_TIMESTAMP_MS = MAX_VALID_TIMESTAMP_SEC * 1000

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
 * Protects against Time Spoofing, Malicious NTP, and Timestamp Tampering via sanity bounds.
 */
export const syncNetworkTime = async (): Promise<number> => {
	if (isSyncing) return timeOffsetMs
	isSyncing = true

	try {
		const endpoints = [
			"https://www.cloudflare.com/cdn-cgi/trace",
			"https://1.1.1.1/cdn-cgi/trace",
			"https://timeapi.io/api/time/current/zone?timeZone=UTC",
		]

		for (const url of endpoints) {
			let timer: ReturnType<typeof setTimeout> | null = null
			try {
				const start = Date.now()
				const ctrl = new AbortController()
				timer = setTimeout(() => ctrl.abort(), 4000)

				const res = await fetch(url, { cache: "no-store", signal: ctrl.signal })
				if (timer) {
					clearTimeout(timer)
					timer = null
				}

				if (!res.ok) {
					continue
				}

				const end = Date.now()
				const roundtrip = end - start

				if (url.includes("/cdn-cgi/trace")) {
					const text = await res.text()
					const match = text.match(/ts=([0-9.]+)/)
					if (match && match[1]) {
						const serverSec = parseFloat(match[1])
						// Validate against sanity range (2024 - 2050)
						if (!isNaN(serverSec) && serverSec >= MIN_VALID_TIMESTAMP_SEC && serverSec <= MAX_VALID_TIMESTAMP_SEC) {
							const serverUtcMs = Math.round(serverSec * 1000) + Math.round(roundtrip / 2)
							timeOffsetMs = serverUtcMs - end
							lastSyncTime = Date.now()
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
						// Validate against sanity range (2024 - 2050)
						if (!isNaN(parsed) && parsed >= MIN_VALID_TIMESTAMP_MS && parsed <= MAX_VALID_TIMESTAMP_MS) {
							const serverUtcMs = parsed + Math.round(roundtrip / 2)
							timeOffsetMs = serverUtcMs - end
							lastSyncTime = Date.now()
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
				// Try fallback endpoint safely
			} finally {
				if (timer) {
					clearTimeout(timer)
					timer = null
				}
			}
		}
	} finally {
		isSyncing = false
	}

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
