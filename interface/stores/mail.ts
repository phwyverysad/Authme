import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { writable, get } from "svelte/store"
import { TOTP } from "otpauth"
import { showToast } from "./dialog"
import { language } from "@utils/language"
import { normalizeCategory } from "../utils/icons"
import { getAccurateTimestamp } from "../utils/timeSync"

export interface MailAccount {
	id: string
	provider: "gmail" | "outlook" | "yahoo" | "proton" | "icloud" | "custom"
	name: string
	email: string
	label: string
	custom_url?: string
	password?: string
	unread_count: number
	created_at: number
}

/**
 * Extracts the email username prefix before '@'.
 * e.g. 'woranat.fluke@gmail.com' -> 'woranat.fluke'
 */
export function extractEmailName(email: string): string {
	if (!email) return ""
	let clean = email.trim()
	if (clean.startsWith("DETECTED:")) {
		clean = clean.replace("DETECTED:", "").trim()
	}
	const match = clean.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
	if (match) {
		clean = match[0]
	}
	const atIdx = clean.indexOf("@")
	let namePart = atIdx > 0 ? clean.substring(0, atIdx) : clean
	const plusIdx = namePart.indexOf("+")
	if (plusIdx > 0) {
		namePart = namePart.substring(0, plusIdx)
	}
	return namePart
}

/**
 * Auto-detects the provider based on the email domain.
 */
export function detectProviderFromEmail(
	email: string
): "gmail" | "outlook" | "yahoo" | "proton" | "icloud" | null {
	if (!email || !email.includes("@")) return null
	const lower = email.toLowerCase().trim()
	if (lower.includes("@gmail.") || lower.includes("@googlemail.")) return "gmail"
	if (
		lower.includes("@outlook.") ||
		lower.includes("@hotmail.") ||
		lower.includes("@live.") ||
		lower.includes("@msn.") ||
		lower.includes("@office365.")
	)
		return "outlook"
	if (lower.includes("@yahoo.") || lower.includes("@ymail.")) return "yahoo"
	if (lower.includes("@proton.") || lower.includes("@pm.me")) return "proton"
	if (lower.includes("@icloud.") || lower.includes("@me.com") || lower.includes("@mac.com")) return "icloud"
	return null
}

export interface MailBounds {
	x: number
	y: number
	width: number
	height: number
}

export const PROVIDER_CONFIGS: Record<
	string,
	{ name: string; url: string; color: string; bg: string }
> = {
	gmail: {
		name: "Gmail / Google",
		url: "https://mail.google.com/mail/u/0/?tab=rm&ogbl#inbox",
		color: "#ea4335",
		bg: "linear-gradient(135deg, #ea4335 0%, #c5221f 100%)",
	},
	outlook: {
		name: "Outlook / Hotmail",
		url: "https://outlook.live.com/mail/",
		color: "#0078d4",
		bg: "linear-gradient(135deg, #0078d4 0%, #005a9e 100%)",
	},
	yahoo: {
		name: "Yahoo Mail",
		url: "https://mail.yahoo.com",
		color: "#6001d2",
		bg: "linear-gradient(135deg, #6001d2 0%, #4a00a0 100%)",
	},
	proton: {
		name: "Proton Mail",
		url: "https://mail.proton.me",
		color: "#6d4aff",
		bg: "linear-gradient(135deg, #6d4aff 0%, #4d2ed6 100%)",
	},
	icloud: {
		name: "iCloud Mail",
		url: "https://www.icloud.com/mail",
		color: "#0091ff",
		bg: "linear-gradient(135deg, #33a3ff 0%, #0070e0 100%)",
	},
	custom: {
		name: "Custom Webmail",
		url: "",
		color: "#64748b",
		bg: "linear-gradient(135deg, #475569 0%, #334155 100%)",
	},
}

export interface PendingLoginSession {
	id: string
	provider: "gmail" | "outlook" | "yahoo" | "proton" | "icloud" | "custom"
	custom_url?: string
	email?: string
	password?: string
}

export const mailAccounts = writable<MailAccount[]>([])
export const activeMailAccount = writable<MailAccount | null>(null)
export const mailViewActive = writable<boolean>(false)
export const pendingLogin = writable<PendingLoginSession | null>(null)

let listenerSetup = false

export async function initMailStore() {
	await loadMailAccounts()
	mailViewActive.set(false)
	activeMailAccount.set(null)
	preloadMailView().catch(() => {})

	if (!listenerSetup && typeof window !== "undefined") {
		listenerSetup = true
		try {
			await listen<{ id: string; count: number; title: string }>(
				"mail:unread-update",
				(event) => {
					const { id, count, title } = event.payload || {}
					if (id !== undefined && count !== undefined) {
						updateAccountUnread(id, count, title)
					}
				}
			)

			await listen<{ id: string; email: string; url: string; title: string }>(
				"mail:login-success",
				async (event) => {
					const { id, email, url } = event.payload || {}
					if (id && email) {
						await handleLoginSuccess(id, email, url)
					}
				}
			)

			await listen("mail:request-exit-dashboard", async () => {
				await exitMailViewToDashboard()
			})
		} catch (e) {
			console.warn("Mail listen error:", e)
		}
	}
}

function updateAccountUnread(id: string, count: number, _title?: string) {
	mailAccounts.update((accounts) => {
		const idx = accounts.findIndex((a) => a.id === id)
		if (idx !== -1) {
			const prevCount = accounts[idx].unread_count || 0
			accounts[idx].unread_count = count

			// If new unread mail arrived and user is not currently looking at this account
			const currentActive = get(activeMailAccount)
			if (count > prevCount && (!currentActive || currentActive.id !== id)) {
				const acc = accounts[idx]
				invoke("send_mail_notification", {
					title: `📩 ${acc.email} (${count} unread)`,
					body: `You have ${count} unread messages in ${acc.label || acc.name || acc.email}`,
				}).catch(() => {})
			}
		}
		return accounts
	})
}

export let pinnedMailIds: Set<string> = new Set()
let pinnedMailIdsLoaded = false
export const pinnedMailIdsStore = writable<Set<string>>(new Set())

export function loadPinnedMailIds(): Set<string> {
	if (pinnedMailIdsLoaded) return pinnedMailIds
	pinnedMailIdsLoaded = true
	try {
		if (typeof localStorage !== "undefined") {
			const raw = localStorage.getItem("authme_pinned_mails")
			if (raw) {
				const list = JSON.parse(raw)
				if (Array.isArray(list)) {
					pinnedMailIds = new Set(list)
					pinnedMailIdsStore.set(new Set(pinnedMailIds))
				}
			}
		}
	} catch (e) {
		console.warn("Failed to load pinned mail ids:", e)
	}
	return pinnedMailIds
}

export function savePinnedMailIds(): void {
	try {
		if (typeof localStorage !== "undefined") {
			localStorage.setItem("authme_pinned_mails", JSON.stringify([...pinnedMailIds]))
		}
		pinnedMailIdsStore.set(new Set(pinnedMailIds))
	} catch (e) {
		console.warn("Failed to save pinned mail ids:", e)
	}
}

export function isMailPinned(id: string): boolean {
	loadPinnedMailIds()
	return pinnedMailIds.has(id)
}

export function sortPinnedMailAccountsToTop(accounts: MailAccount[]): MailAccount[] {
	if (!accounts || accounts.length <= 1) return accounts
	loadPinnedMailIds()
	if (pinnedMailIds.size === 0) return accounts

	const pinned: MailAccount[] = []
	const unpinned: MailAccount[] = []
	for (const acc of accounts) {
		if (pinnedMailIds.has(acc.id)) {
			pinned.push(acc)
		} else {
			unpinned.push(acc)
		}
	}
	return [...pinned, ...unpinned]
}

export async function togglePinMailAccount(id: string): Promise<void> {
	loadPinnedMailIds()
	const accounts = get(mailAccounts)
	const accIndex = accounts.findIndex((a) => a.id === id)
	if (accIndex === -1) return

	const currentlyPinned = pinnedMailIds.has(id)
	const newAccounts = [...accounts]
	const [acc] = newAccounts.splice(accIndex, 1)

	if (!currentlyPinned) {
		pinnedMailIds.add(id)
		savePinnedMailIds()

		// Insert directly after the last pinned item
		let targetIndex = 0
		for (let j = 0; j < newAccounts.length; j++) {
			if (pinnedMailIds.has(newAccounts[j].id)) {
				targetIndex = j + 1
			} else {
				break
			}
		}
		newAccounts.splice(targetIndex, 0, acc)
		mailAccounts.set(newAccounts)
		await reorderMailAccounts(newAccounts.map((a) => a.id))
		showToast(language.codes?.pinSuccess || "Pinned account to top", "success")
	} else {
		pinnedMailIds.delete(id)
		savePinnedMailIds()

		// If there are other pinned items, move this unpinned item after them
		let lastPinnedIndex = -1
		for (let j = 0; j < newAccounts.length; j++) {
			if (pinnedMailIds.has(newAccounts[j].id)) {
				lastPinnedIndex = j
			}
		}
		if (lastPinnedIndex >= 0) {
			newAccounts.splice(lastPinnedIndex + 1, 0, acc)
		} else {
			newAccounts.splice(accIndex, 0, acc)
		}
		mailAccounts.set(newAccounts)
		await reorderMailAccounts(newAccounts.map((a) => a.id))
		showToast(language.codes?.unpinSuccess || "Unpinned account", "info")
	}
}

export async function loadMailAccounts(): Promise<MailAccount[]> {
	try {
		loadPinnedMailIds()
		const accounts = await invoke<MailAccount[]>("get_mail_accounts")
		const cleaned = (accounts || []).map((acc) => {
			let em = acc.email || ""
			const match = em.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
			if (match) {
				em = match[0].toLowerCase()
			}
			let nm = acc.name || ""
			if (nm.startsWith("DETECTED:") || !nm.trim() || nm.includes("@")) {
				nm = extractEmailName(em) || nm
			}
			return { ...acc, email: em, name: nm }
		})
		const sorted = sortPinnedMailAccountsToTop(cleaned)
		mailAccounts.set(sorted)
		return sorted
	} catch (e) {
		console.error("Failed to load mail accounts:", e)
		return []
	}
}

export async function saveMailAccount(account: MailAccount): Promise<void> {
	try {
		if (!account.name || !account.name.trim()) {
			account.name = extractEmailName(account.email) || "Mail"
		}
		const updated = await invoke<MailAccount[]>("save_mail_account", { account })
		const sorted = sortPinnedMailAccountsToTop(updated || [])
		mailAccounts.set(sorted)
		const title = account.name || account.email
		showToast(`${title}: ${language.mail?.toastAccountSaved || "Account saved successfully"}`, "success")
	} catch (e: any) {
		console.error("Failed to save mail account:", e)
		showToast(`${language.mail?.toastSaveFailed || "Failed to save account"}: ${e}`, "error")
		throw e
	}
}

export async function deleteMailAccount(id: string): Promise<void> {
	try {
		if (pinnedMailIds.has(id)) {
			pinnedMailIds.delete(id)
			savePinnedMailIds()
		}
		const updated = await invoke<MailAccount[]>("delete_mail_account", { id })
		const sorted = sortPinnedMailAccountsToTop(updated || [])
		mailAccounts.set(sorted)
		if (get(activeMailAccount)?.id === id) {
			await closeMailView()
		}
		showToast(language.mail?.toastAccountDeleted || "Email account deleted successfully", "success")
	} catch (e: any) {
		console.error("Failed to delete mail account:", e)
		showToast(`${language.mail?.toastDeleteFailed || "Failed to delete account"}: ${e}`, "error")
	}
}

export async function reorderMailAccounts(accountIds: string[]): Promise<void> {
	try {
		const updated = await invoke<MailAccount[]>("reorder_mail_accounts", { accountIds })
		if (updated) {
			mailAccounts.set(updated)
		}
	} catch (e: any) {
		console.error("Failed to reorder mail accounts:", e)
	}
}

export function getProviderLoginUrl(provider: string, customUrl?: string): string {
	switch (provider) {
		case "gmail":
			return "https://accounts.google.com/ServiceLogin?service=mail&continue=https://mail.google.com/mail/"
		case "outlook":
			return "https://outlook.live.com/mail/"
		case "yahoo":
			return "https://mail.yahoo.com/"
		case "proton":
			return "https://account.proton.me/mail"
		case "icloud":
			return "https://www.icloud.com/mail"
		case "custom":
			return customUrl || "https://mail.google.com"
		default:
			return "https://mail.google.com"
	}
}

export async function startLoginSession(
	provider: "gmail" | "outlook" | "yahoo" | "proton" | "icloud" | "custom",
	bounds: MailBounds,
	customUrl?: string,
	email?: string,
	password?: string
): Promise<string> {
	const id = "mail_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7)
	pendingLogin.set({ id, provider, custom_url: customUrl, email, password })
	activeMailAccount.set(null)
	mailViewActive.set(true)

	const loginUrl = getProviderLoginUrl(provider, customUrl)
	try {
		await invoke("open_mail_view", {
			id,
			url: loginUrl,
			bounds,
			isLogin: true,
			email: email || null,
			password: password || null,
		})
	} catch (e: any) {
		console.error("Failed to open login view:", e)
		showToast(`${language.mail?.toastOpenLoginFailed || "Failed to open login page"}: ${e}`, "error")
		pendingLogin.set(null)
		mailViewActive.set(false)
		throw e
	}
	return id
}

export async function preloadMailView(): Promise<void> {
	try {
		await invoke("preload_mail_view")
	} catch (e) {
		console.warn("Failed to preload mail view:", e)
	}
}

export async function handleLoginSuccess(id: string, email: string, url?: string): Promise<void> {
	const pending = get(pendingLogin)
	const accounts = get(mailAccounts)
	let cleanEmail = email.trim()
	const match = cleanEmail.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
	if (match) {
		cleanEmail = match[0].toLowerCase()
	}

	// Check if this account was already saved
	const existing = accounts.find((a) => a.email.toLowerCase() === cleanEmail.toLowerCase())
	if (existing) {
		if (pending) {
			pendingLogin.set(null)
			activeMailAccount.set(existing)
			showToast(`${cleanEmail}: ${language.mail?.toastAlreadyConnected || "Account is already connected"}`, "info")
		}
		return
	}

	const provider = pending?.provider || detectProviderFromEmail(cleanEmail) || "custom"
	const extractedName = extractEmailName(cleanEmail) || PROVIDER_CONFIGS[provider]?.name || "Webmail"
	const newAccount: MailAccount = {
		id,
		provider,
		name: extractedName,
		email: cleanEmail,
		password: pending?.password,
		label: language.mail?.labelPersonal || "Personal",
		custom_url: url || pending?.custom_url,
		unread_count: 0,
		created_at: Date.now(),
	}
	await saveMailAccount(newAccount)
	pendingLogin.set(null)
	activeMailAccount.set(newAccount)
	showToast(`🎉 ${extractedName} (${cleanEmail}) - ${language.mail?.toastConnectedSuccess || "Connected successfully"}`, "success")
}

export async function exitMailViewToDashboard(): Promise<void> {
	activeMailAccount.set(null)
	mailViewActive.set(false)
	await setMailViewVisible(false)
}

export async function cancelLoginSession(): Promise<void> {
	const pending = get(pendingLogin)
	pendingLogin.set(null)
	mailViewActive.set(false)
	if (pending?.id) {
		try {
			await invoke("cancel_login_session", { id: pending.id })
		} catch (e) {
			console.warn("Failed to cancel login session:", e)
			await closeMailView()
		}
	} else {
		await closeMailView()
	}
}

export async function openMailView(account: MailAccount, bounds: MailBounds): Promise<void> {
	try {
		let providerUrl: string
		if (account.provider === "custom") {
			providerUrl = account.custom_url || "https://mail.google.com"
		} else {
			providerUrl = PROVIDER_CONFIGS[account.provider]?.url || "https://mail.google.com"
		}

		activeMailAccount.set(account)
		mailViewActive.set(true)

		await invoke("open_mail_view", {
			id: account.id,
			url: providerUrl,
			bounds,
			isLogin: false,
			email: account.email,
			password: account.password || null,
		})
	} catch (e) {
		console.error("Failed to open mail view:", e)
		showToast(`${language.mail?.toastOpenMailFailed || "Failed to open mail page"}: ${e}`, "error")
	}
}

export async function updateMailViewBounds(boundsOrId: MailBounds | string, maybeBounds?: MailBounds): Promise<void> {
	const bounds = (typeof boundsOrId === "object" ? boundsOrId : maybeBounds) as MailBounds
	if (!bounds) return
	try {
		await invoke("update_mail_view_bounds", { bounds })
	} catch (e) {
		console.warn("Failed to update mail view bounds:", e)
	}
}

export async function reloadMailView(): Promise<void> {
	try {
		await invoke("reload_mail_view")
	} catch (e) {
		console.warn("Failed to reload mail view:", e)
	}
}

export async function setMailViewVisible(visible: boolean): Promise<void> {
	try {
		await invoke("set_mail_view_visible", { visible })
	} catch (e) {
		console.warn("Failed to set mail view visibility:", e)
	}
}

export async function closeMailView(): Promise<void> {
	try {
		activeMailAccount.set(null)
		pendingLogin.set(null)
		mailViewActive.set(false)
		await invoke("close_mail_view")
	} catch (e) {
		console.warn("Failed to close mail view:", e)
	}
}

/**
 * Checks if Authme 2FA vault has a token matching this email or provider.
 * Returns the current 6-digit TOTP code and remaining seconds if found.
 */
export function getMatching2FACode(
	email: string,
	provider: string
): { token: string; secondsRemaining: number; title: string } | null {
	if (typeof window === "undefined") return null
	const codesData = (window as any).__authme_codes?.getCodesData?.()
	if (!codesData || !codesData.names || codesData.names.length === 0) return null

	const normalizedEmail = (email || "").toLowerCase().trim()
	const normalizedProvider = (provider || "").toLowerCase().trim()

	// Target category based on provider
	const targetCategory =
		normalizedProvider === "gmail"
			? "google"
			: normalizedProvider === "outlook"
			? "microsoft"
			: normalizedProvider === "yahoo"
			? "yahoo"
			: normalizedProvider === "proton"
			? "proton"
			: normalizedProvider === "icloud"
			? "apple"
			: ""

	for (let i = 0; i < codesData.names.length; i++) {
		const rawName = (codesData.names[i] || "").toLowerCase().trim()
		const rawIssuer = (codesData.issuers[i] || "").toLowerCase().trim()
		const secret = codesData.secrets[i] || ""
		if (!secret) continue

		const cat = normalizeCategory(codesData.issuers[i], codesData.names[i])

		// Strictly enforce provider matching if targetCategory is defined!
		// A Microsoft token must NEVER match a Gmail login even if username is an @gmail.com email!
		if (targetCategory && cat.id !== targetCategory) {
			continue
		}

		// Email matching logic
		const emailMatch =
			!normalizedEmail ||
			rawName.includes(normalizedEmail) ||
			rawIssuer.includes(normalizedEmail) ||
			(normalizedEmail.includes("@") &&
				(rawName.includes(normalizedEmail.split("@")[0]) || rawIssuer.includes(normalizedEmail.split("@")[0])))

		if (emailMatch) {
			try {
				const totp = new TOTP({
					secret: secret.toUpperCase().replace(/\s+/g, ""),
					digits: 6,
					period: 30,
				})
				const token = totp.generate({ timestamp: getAccurateTimestamp() })
				const secondsRemaining = 30 - (Math.floor(getAccurateTimestamp() / 1000) % 30)
				const title = codesData.issuers[i] || codesData.names[i] || cat.name || "2FA"
				return { token, secondsRemaining, title }
			} catch (e) {}
		}
	}
	return null
}
