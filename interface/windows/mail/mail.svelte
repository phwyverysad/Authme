<script lang="ts">
	import { onMount, onDestroy, tick } from "svelte"
	import { flip } from "svelte/animate"
	import { fade, scale } from "svelte/transition"
	import * as clipboard from "@tauri-apps/plugin-clipboard-manager"
	import { openUrl } from "@tauri-apps/plugin-opener"
	import {
		mailAccounts,
		activeMailAccount,
		mailViewActive,
		pendingLogin,
		initMailStore,
		loadMailAccounts,
		openMailView,
		startLoginSession,
		cancelLoginSession,
		updateMailViewBounds,
		reloadMailView,
		setMailViewVisible,
		closeMailView,
		deleteMailAccount,
		saveMailAccount,
		reorderMailAccounts,
		getMatching2FACode,
		PROVIDER_CONFIGS,
		type MailAccount,
		pinnedMailIdsStore,
		togglePinMailAccount,
		isMailPinned,
	} from "../../stores/mail"
	import { invoke } from "@tauri-apps/api/core"
	import { showToast, askModal } from "../../stores/dialog"
	import { scheduleClipboardClear } from "../../utils/clipboardGuard"
	import { router } from "@baileyherbert/tinro"
	import { navigate } from "@utils/navigate"
	import { getLanguage, currentLanguage } from "@utils/language"

	let language = getLanguage()
	$: language = $currentLanguage || getLanguage()

	let mailProviderFilter = "all"
	let mailUnreadOnly = false

	// Handle navigation from Import page to start login session
	$: if ($router.path === "/mail" && $router.query?.action === "login") {
		const prov = $router.query.provider as any
		const customUrl = $router.query.url ? decodeURIComponent($router.query.url) : undefined
		router.goto("/mail")
		if (prov) {
			handleStartLoginDirect(prov, customUrl)
		}
	}

	// Ensure mail accounts are fresh whenever switching to /mail
	let lastLoadedMailRoute = ""
	$: if ($router.path === "/mail") {
		if (lastLoadedMailRoute !== "/mail") {
			lastLoadedMailRoute = "/mail"
			loadMailAccounts().catch(() => {})
			if ($mailViewActive) {
				tick().then(() => {
					restoreActiveMailView()
				})
			}
		}
	} else {
		lastLoadedMailRoute = ""
	}

	let searchQuery = ""
	let webviewContainerEl: HTMLDivElement | null = null
	let resizeObserver: ResizeObserver | null = null
	let matching2FA: { token: string; secondsRemaining: number; title: string } | null = null
	let totpTimer: NodeJS.Timeout | null = null
	let activeMailMenu: { x: number; y: number; account: MailAccount } | null = null
	let mailMenuEl: HTMLDivElement | null = null
	let menuPosX = 0
	let menuPosY = 0
	let menuOpenedAt = 0

	$: if (activeMailMenu) {
		menuOpenedAt = Date.now()
		const pad = 12
		const menuWidth = 224
		const menuHeight = 250
		const winW = typeof window !== "undefined" ? window.innerWidth : 1000
		const winH = typeof window !== "undefined" ? window.innerHeight : 700

		menuPosX = Math.min(activeMailMenu.x, winW - menuWidth - pad)
		menuPosY = Math.min(activeMailMenu.y, winH - menuHeight - pad)
		if (menuPosX < pad) menuPosX = pad
		if (menuPosY < pad) menuPosY = pad
	}

	// Upgraded pointer-based drag & drop state with 3D tilt and smooth FLIP reordering
	interface ActiveMailDrag {
		account: MailAccount
		currentX: number
		currentY: number
		offsetX: number
		offsetY: number
		width: number
		height: number
		tilt: number
		velocityX: number
	}

	let activeMailDrag: ActiveMailDrag | null = null
	let draggedMailId: string | null = null
	let heldMailId: string | null = null
	let settledMailId: string | null = null
	let isDraggingMail = false
	let dragJustEnded = false
	let lastMailSwapTimestamp = 0
	let mailHoldTimer: NodeJS.Timeout | null = null
	let mailDownX = 0
	let mailDownY = 0
	let lastPointerX = 0
	let floatingMailAvatarEl: HTMLElement | null = null
	let pendingDragAcc: MailAccount | null = null
	let dragIsFromHandle = false

	function handleMailHandlePointerDown(acc: MailAccount, e: PointerEvent) {
		if (e.button !== 0) return
		if (searchQuery.trim() || mailProviderFilter !== "all" || mailUnreadOnly) return

		mailDownX = e.clientX
		mailDownY = e.clientY
		lastPointerX = e.clientX
		heldMailId = null
		pendingDragAcc = acc
		dragIsFromHandle = true

		if (mailHoldTimer) {
			clearTimeout(mailHoldTimer)
			mailHoldTimer = null
		}

		window.addEventListener("pointermove", onGlobalPointerMove)
		window.addEventListener("pointerup", onGlobalPointerUp)
		window.addEventListener("pointercancel", onGlobalPointerUp)

		mailHoldTimer = setTimeout(() => {
			if (pendingDragAcc) {
				heldMailId = pendingDragAcc.id
				startMailDrag(pendingDragAcc, e.clientX, e.clientY)
			}
		}, 40)
	}

	function startMailDrag(acc: MailAccount, clientX: number, clientY: number) {
		const container = document.querySelector(".mail-card-content")
		if (!container) return

		const cardEl = document.querySelector(`[data-mail-card-id="${acc.id}"]`) as HTMLElement | null
		if (!cardEl) return
		const rect = cardEl.getBoundingClientRect()

		activeMailDrag = {
			account: acc,
			currentX: clientX,
			currentY: clientY,
			offsetX: clientX - rect.left,
			offsetY: clientY - rect.top,
			width: rect.width,
			height: rect.height,
			tilt: -1.5,
			velocityX: 0,
		}

		draggedMailId = acc.id
		isDraggingMail = true
		dragJustEnded = true
		document.body.classList.add("cursor-grabbing", "select-none")
	}

	function onGlobalPointerMove(e: PointerEvent) {
		if (mailHoldTimer && !isDraggingMail) {
			const dist = Math.hypot(e.clientX - mailDownX, e.clientY - mailDownY)
			const threshold = dragIsFromHandle ? 2 : 7
			if (dist > threshold) {
				clearTimeout(mailHoldTimer)
				mailHoldTimer = null
				if (pendingDragAcc) {
					startMailDrag(pendingDragAcc, e.clientX, e.clientY)
				}
			}
		}

		if (isDraggingMail && activeMailDrag) {
			const vx = e.clientX - lastPointerX
			lastPointerX = e.clientX
			const tilt = Math.max(-6, Math.min(6, -1.5 + vx * 0.18))

			const curX = e.clientX - activeMailDrag.offsetX
			const curY = e.clientY - activeMailDrag.offsetY

			if (floatingMailAvatarEl) {
				floatingMailAvatarEl.style.transform = `translate3d(${curX}px, ${curY}px, 0) scale(1.04) rotate(${tilt}deg)`
			}

			// Edge auto-scrolling
			const scrollContainer = document.querySelector(".overflow-y-auto") as HTMLElement | null
			if (scrollContainer) {
				if (e.clientY < 90) scrollContainer.scrollTop -= 12
				else if (e.clientY > window.innerHeight - 90) scrollContainer.scrollTop += 12
			}

			if ($mailAccounts.length <= 1) return

			const now = Date.now()
			if (now - lastMailSwapTimestamp < 80) return

			// 1. Direct card under cursor using elementFromPoint
			const elUnder = document.elementFromPoint(e.clientX, e.clientY)
			const targetCard = elUnder?.closest("[data-mail-card-id]") as HTMLElement | null
			if (targetCard) {
				const targetId = targetCard.getAttribute("data-mail-card-id")
				if (targetId && targetId !== activeMailDrag.account.id) {
					lastMailSwapTimestamp = now
					const current = [...$mailAccounts]
					const fromIdx = current.findIndex((a) => a.id === activeMailDrag?.account.id)
					const toIdx = current.findIndex((a) => a.id === targetId)
					if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
						const [moved] = current.splice(fromIdx, 1)
						current.splice(toIdx, 0, moved)
						mailAccounts.set(current)
					}
					return
				}
			}

			// 2. Extreme boundary triggers (drag past top or bottom card)
			const container = document.querySelector(".mail-card-content")
			if (container) {
				const cardEls = Array.from(container.querySelectorAll<HTMLElement>("[data-mail-card-id]"))
				if (cardEls.length > 1) {
					const firstRect = cardEls[0].getBoundingClientRect()
					const lastRect = cardEls[cardEls.length - 1].getBoundingClientRect()
					const current = [...$mailAccounts]
					const fromIdx = current.findIndex((a) => a.id === activeMailDrag?.account.id)
					if (fromIdx !== -1) {
						if (e.clientY < firstRect.top - 10 && fromIdx !== 0) {
							lastMailSwapTimestamp = now
							const [moved] = current.splice(fromIdx, 1)
							current.unshift(moved)
							mailAccounts.set(current)
						} else if (e.clientY > lastRect.bottom + 10 && fromIdx !== current.length - 1) {
							lastMailSwapTimestamp = now
							const [moved] = current.splice(fromIdx, 1)
							current.push(moved)
							mailAccounts.set(current)
						}
					}
				}
			}
		}
	}

	function onGlobalPointerUp() {
		window.removeEventListener("pointermove", onGlobalPointerMove)
		window.removeEventListener("pointerup", onGlobalPointerUp)
		window.removeEventListener("pointercancel", onGlobalPointerUp)

		if (mailHoldTimer) {
			clearTimeout(mailHoldTimer)
			mailHoldTimer = null
		}
		heldMailId = null
		pendingDragAcc = null
		floatingMailAvatarEl = null
		dragIsFromHandle = false

		if (isDraggingMail && activeMailDrag) {
			const droppedId = activeMailDrag.account.id
			settledMailId = droppedId
			setTimeout(() => {
				if (settledMailId === droppedId) settledMailId = null
			}, 600)

			activeMailDrag = null
			draggedMailId = null
			isDraggingMail = false
			document.body.classList.remove("cursor-grabbing", "select-none")

			// Persist reordered IDs to disk via backend
			const ids = $mailAccounts.map((a) => a.id)
			reorderMailAccounts(ids)

			setTimeout(() => {
				dragJustEnded = false
			}, 280)
		} else {
			heldMailId = null
			isDraggingMail = false
			draggedMailId = null
			activeMailDrag = null
		}
	}

	function handleCardClick(acc: MailAccount) {
		if (isDraggingMail || dragJustEnded || heldMailId || activeMailDrag) return
		selectAccount(acc)
	}

	async function moveMailAccount(id: string, delta: number) {
		const list = [...$mailAccounts]
		const idx = list.findIndex((a) => a.id === id)
		if (idx === -1) return
		const targetIdx = idx + delta
		if (targetIdx < 0 || targetIdx >= list.length) return
		const [moved] = list.splice(idx, 1)
		list.splice(targetIdx, 0, moved)
		mailAccounts.set(list)
		await reorderMailAccounts(list.map((a) => a.id))
	}

	function handleCardKeydown(e: KeyboardEvent, acc: MailAccount) {
		if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowLeft")) {
			e.preventDefault()
			moveMailAccount(acc.id, -1)
		} else if (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowRight")) {
			e.preventDefault()
			moveMailAccount(acc.id, 1)
		} else if (e.key === "Enter" || e.key === " ") {
			if (!isDraggingMail && !dragJustEnded && !heldMailId && !activeMailDrag) {
				selectAccount(acc)
			}
		}
	}

	// Modals
	let showProviderPickerModal = false
	let showCustomUrlModal = false
	let customWebmailInput = "https://"
	let showEditModal = false
	let editingAccount: MailAccount | null = null
	let editName = ""
	let editLabel = ""
	let editCustomUrl = ""
	let editPassword = ""
	let showManualConfirmModal = false
	let manualEmailInput = ""

	$: PRESET_LABELS = [
		language.mail?.labelPersonal || "Personal",
		language.mail?.labelWork || "Work",
		language.mail?.labelBackup || "Backup",
		language.mail?.labelBusiness || "Business",
	]

	$: filteredAccounts = $mailAccounts.filter((acc) => {
		if (mailProviderFilter === "pinned") {
			if (!$pinnedMailIdsStore.has(acc.id)) return false
		} else if (mailProviderFilter !== "all" && acc.provider !== mailProviderFilter) {
			return false
		}
		if (mailUnreadOnly && (acc.unread_count || 0) === 0) {
			return false
		}
		if (!searchQuery || !searchQuery.trim()) return true
		const q = searchQuery.toLowerCase().trim()
		return (
			acc.email.toLowerCase().includes(q) ||
			(acc.label && acc.label.toLowerCase().includes(q)) ||
			acc.name.toLowerCase().includes(q) ||
			acc.provider.toLowerCase().includes(q)
		)
	})

	$: mailCategoryCounts = {
		all: $mailAccounts.length,
		pinned: $mailAccounts.filter((a) => $pinnedMailIdsStore.has(a.id)).length,
		gmail: $mailAccounts.filter((a) => a.provider === "gmail").length,
		outlook: $mailAccounts.filter((a) => a.provider === "outlook").length,
		yahoo: $mailAccounts.filter((a) => a.provider === "yahoo").length,
		proton: $mailAccounts.filter((a) => a.provider === "proton").length,
		icloud: $mailAccounts.filter((a) => a.provider === "icloud").length,
		custom: $mailAccounts.filter((a) => a.provider === "custom").length,
		unread: $mailAccounts.filter((a) => (a.unread_count || 0) > 0).length,
	}

	let isMailCategoryOverflowing = false
	let isDraggingMailCategory = false
	let mailCategoryDragStartX = 0
	let mailCategoryDragStartScrollLeft = 0
	let mailCategoryHasDragged = false
	let mailCategoryJustDragged = false

	function handleMailCategoryClick(callback: () => void) {
		if (mailCategoryJustDragged || mailCategoryHasDragged) return
		callback()
	}

	function horizontalMailScrollAction(node: HTMLElement) {
		const updateOverflow = () => {
			isMailCategoryOverflowing = node.scrollWidth > node.clientWidth + 4
			if (isMailCategoryOverflowing) {
				node.classList.add("cursor-grab")
			} else {
				node.classList.remove("cursor-grab", "cursor-grabbing")
			}
		}

		const resizeObserver = new ResizeObserver(() => {
			updateOverflow()
		})
		resizeObserver.observe(node)
		setTimeout(updateOverflow, 60)

		const onWheel = (e: WheelEvent) => {
			if (e.deltaY !== 0) {
				e.preventDefault()
				node.scrollLeft += e.deltaY
			} else if (e.deltaX !== 0) {
				e.preventDefault()
				node.scrollLeft += e.deltaX
			}
		}

		const onPointerDown = (e: PointerEvent) => {
			if (e.button !== 0 || !isMailCategoryOverflowing) return
			isDraggingMailCategory = true
			mailCategoryHasDragged = false
			mailCategoryDragStartX = e.clientX
			mailCategoryDragStartScrollLeft = node.scrollLeft

			const onPointerMove = (me: PointerEvent) => {
				if (!isDraggingMailCategory) return
				const dx = me.clientX - mailCategoryDragStartX
				if (!mailCategoryHasDragged && Math.abs(dx) > 3) {
					mailCategoryHasDragged = true
					node.classList.add("cursor-grabbing")
					node.classList.remove("cursor-grab")
				}
				if (mailCategoryHasDragged) {
					node.scrollLeft = mailCategoryDragStartScrollLeft - dx
					me.preventDefault()
				}
			}

			const onPointerUp = () => {
				isDraggingMailCategory = false
				window.removeEventListener("pointermove", onPointerMove)
				window.removeEventListener("pointerup", onPointerUp)
				window.removeEventListener("pointercancel", onPointerUp)

				node.classList.remove("cursor-grabbing")
				if (isMailCategoryOverflowing) {
					node.classList.add("cursor-grab")
				}

				if (mailCategoryHasDragged) {
					mailCategoryJustDragged = true
					setTimeout(() => {
						mailCategoryJustDragged = false
						mailCategoryHasDragged = false
					}, 120)
				}
			}

			window.addEventListener("pointermove", onPointerMove)
			window.addEventListener("pointerup", onPointerUp)
			window.addEventListener("pointercancel", onPointerUp)
		}

		node.addEventListener("wheel", onWheel, { passive: false })
		node.addEventListener("pointerdown", onPointerDown)

		return {
			update() {
				updateOverflow()
			},
			destroy() {
				resizeObserver.disconnect()
				node.removeEventListener("wheel", onWheel)
				node.removeEventListener("pointerdown", onPointerDown)
			}
		}
	}

	$: if ($mailViewActive && webviewContainerEl) {
		if (!resizeObserver) {
			resizeObserver = new ResizeObserver(() => {
				handleResize()
			})
			resizeObserver.observe(webviewContainerEl)
		}
	} else if (!$mailViewActive && resizeObserver) {
		resizeObserver.disconnect()
		resizeObserver = null
	}

	function handleGlobalKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") {
			if (activeMailMenu) {
				closeMenu()
				return
			}
			if ($mailViewActive) {
				handleBackToDashboard()
			}
		}
	}

	function handleOutsidePointerDown(e: PointerEvent) {
		if (!activeMailMenu) return
		if (Date.now() - menuOpenedAt < 60) return
		if (mailMenuEl && !mailMenuEl.contains(e.target as Node)) {
			closeMenu()
		}
	}

	onMount(async () => {
		if (typeof window !== "undefined") {
			(window as any).__authme_closeActiveModal = () => {
				if (activeMailMenu) {
					closeMenu()
					return true
				}
				if (showEditModal) {
					closeEditModal()
					return true
				}
				if (showProviderPickerModal) {
					closeProviderPicker()
					return true
				}
				if (showCustomUrlModal) {
					showCustomUrlModal = false
					return true
				}
				if (showManualConfirmModal) {
					closeManualConfirmModal()
					return true
				}
				return false
			}
		}

		await initMailStore()
		window.addEventListener("resize", handleResize)
		window.addEventListener("keydown", handleGlobalKeydown)
		window.addEventListener("pointerdown", handleOutsidePointerDown, true)
		if ($mailViewActive) {
			await restoreActiveMailView()
		}
	})

	onDestroy(() => {
		if (typeof window !== "undefined") {
			(window as any).__authme_closeActiveModal = null
		}
		window.removeEventListener("resize", handleResize)
		window.removeEventListener("keydown", handleGlobalKeydown)
		window.removeEventListener("pointerdown", handleOutsidePointerDown, true)
		if (resizeRaf) cancelAnimationFrame(resizeRaf)
		if (totpTimer) clearInterval(totpTimer)
		if (resizeObserver) resizeObserver.disconnect()
		setMailViewVisible(false)
	})

	async function restoreActiveMailView() {
		if (!$mailViewActive) return
		const bounds = getContainerBounds()
		if ($activeMailAccount) {
			await openMailView($activeMailAccount, bounds)
			update2FAStatus($activeMailAccount)
		} else {
			await updateMailViewBounds(bounds)
			await setMailViewVisible(true)
			if ($pendingLogin) {
				update2FAStatus($pendingLogin.email || "", $pendingLogin.provider)
			}
		}
	}

	function getContainerBounds(): { x: number; y: number; width: number; height: number } {
		const navEl = document.querySelector(".transparent-900.flex.h-full.flex-col") || document.querySelector(".menuButton")?.parentElement?.parentElement
		const navWidth = navEl ? Math.round(navEl.getBoundingClientRect().width) : 80
		const winW = typeof window !== "undefined" ? window.innerWidth : 1280
		const winH = typeof window !== "undefined" ? window.innerHeight : 800
		let bounds = {
			x: navWidth,
			y: 0,
			width: Math.max(winW - navWidth, 600),
			height: Math.max(winH, 400),
		}

		if (webviewContainerEl) {
			const rect = webviewContainerEl.getBoundingClientRect()
			if (rect.width >= 100 && rect.height >= 100) {
				bounds = {
					x: Math.round(rect.left),
					y: Math.round(rect.top),
					width: Math.round(rect.width),
					height: Math.round(rect.height),
				}
			}
		}
		return bounds
	}

	let resizeRaf: number | null = null
	function handleResize() {
		if ($mailViewActive) {
			if (resizeRaf) cancelAnimationFrame(resizeRaf)
			resizeRaf = requestAnimationFrame(() => {
				resizeRaf = null
				const bounds = getContainerBounds()
				updateMailViewBounds(bounds)
			})
		}
	}

	function openProviderPicker() {
		showProviderPickerModal = true
	}

	function closeProviderPicker() {
		showProviderPickerModal = false
	}

	async function handleStartLoginDirect(provider: "gmail" | "outlook" | "yahoo" | "proton" | "icloud" | "custom", customUrl?: string) {
		if (provider === "custom" && !customUrl) {
			showProviderPickerModal = false
			customWebmailInput = "https://"
			showCustomUrlModal = true
			return
		}

		showProviderPickerModal = false
		showCustomUrlModal = false
		mailViewActive.set(true)
		await tick()

		const bounds = getContainerBounds()
		try {
			const sessionId = await startLoginSession(provider, bounds, customUrl)
			setTimeout(() => {
				if ($pendingLogin?.id === sessionId) {
					const b = getContainerBounds()
					updateMailViewBounds(b)
				}
			}, 100)
		} catch (err) {
			console.error("Failed to start login session:", err)
		}
	}

	function submitCustomWebmailUrl() {
		let url = customWebmailInput.trim()
		if (!url || url === "https://" || url === "http://") {
			showToast(language.mail?.toastEnterValidUrl || "Please enter a valid webmail URL", "error")
			return
		}
		if (!url.startsWith("http://") && !url.startsWith("https://")) {
			url = "https://" + url
		}
		handleStartLoginDirect("custom", url)
	}

	function openEditModal(acc: MailAccount) {
		editingAccount = acc
		editName = acc.name
		editLabel = acc.label || language.mail?.labelPersonal || "Personal"
		editCustomUrl = acc.custom_url || ""
		editPassword = acc.password || ""
		showEditModal = true
	}

	function closeEditModal() {
		showEditModal = false
		editingAccount = null
	}

	async function saveAccountEdit() {
		if (!editingAccount) return
		const target = { ...editingAccount }
		target.name = editName.trim() || target.email
		target.label = editLabel.trim() || language.mail?.labelPersonal || "Personal"
		if (target.provider === "custom") {
			target.custom_url = editCustomUrl.trim() || undefined
		}
		target.password = editPassword.trim() || undefined
		await saveMailAccount(target)
		closeEditModal()
	}

	async function copyPassword(pw?: string) {
		if (!pw) return
		try {
			await clipboard.writeText(pw)
		} catch {
			try {
				await navigator.clipboard.writeText(pw)
			} catch (err) {
				console.error("Clipboard error:", err)
			}
		}
		scheduleClipboardClear(pw)
		showToast("Password copied (will be cleared from clipboard automatically)", "success")
	}

	async function copyEmail(em?: string) {
		if (!em) return
		try {
			await clipboard.writeText(em)
		} catch {
			try {
				await navigator.clipboard.writeText(em)
			} catch (err) {
				console.error("Clipboard error:", err)
			}
		}
		showToast(`Email copied: ${em}`, "success")
	}

	async function manualConfirmLogin() {
		if (!$pendingLogin) return
		await setMailViewVisible(false)
		const defaultDomain = $pendingLogin.provider === "gmail" ? "@gmail.com" : $pendingLogin.provider === "outlook" ? "@outlook.com" : ""
		manualEmailInput = defaultDomain
		showManualConfirmModal = true
	}

	async function closeManualConfirmModal() {
		showManualConfirmModal = false
		await setMailViewVisible(true)
	}

	async function submitManualLogin() {
		if (!$pendingLogin || !manualEmailInput.trim() || !manualEmailInput.includes("@")) {
			showToast(language.mail?.toastEnterValidEmail || "Please enter a valid email address (e.g. user@gmail.com)", "error")
			return
		}
		const p = $pendingLogin
		const email = manualEmailInput.trim()
		showManualConfirmModal = false
		const { handleLoginSuccess } = await import("../../stores/mail")
		await handleLoginSuccess(p.id, email, p.custom_url)
	}

	async function handleCancelLogin() {
		await cancelLoginSession()
		mailViewActive.set(false)
		await setMailViewVisible(false)
	}

	async function selectAccount(acc: MailAccount) {
		activeMailAccount.set(acc)
		mailViewActive.set(true)
		await tick()
		await launchWebview(acc)
	}

	async function launchWebview(acc: MailAccount) {
		const bounds = getContainerBounds()
		await openMailView(acc, bounds)
		update2FAStatus(acc)
	}

	function update2FAStatus(accOrEmail: MailAccount | string, maybeProvider?: string) {
		if (totpTimer) clearInterval(totpTimer)
		const targetEmail = typeof accOrEmail === "string" ? accOrEmail : accOrEmail.email
		const targetProvider = typeof accOrEmail === "string" ? (maybeProvider || "") : accOrEmail.provider

		matching2FA = getMatching2FACode(targetEmail, targetProvider)

		totpTimer = setInterval(() => {
			const activeEm = $activeMailAccount?.email || $pendingLogin?.email || targetEmail
			const activeProv = $activeMailAccount?.provider || $pendingLogin?.provider || targetProvider
			matching2FA = getMatching2FACode(activeEm, activeProv)
		}, 1000)
	}

	async function handleBackToDashboard() {
		if (totpTimer) clearInterval(totpTimer)
		matching2FA = null
		mailViewActive.set(false)
		await setMailViewVisible(false)
	}

	async function copy2FACode() {
		if (!matching2FA) return
		await clipboard.writeText(matching2FA.token)
		scheduleClipboardClear(matching2FA.token)
		showToast(`${language.mail?.toastCopied2FA || "2FA code copied successfully"}: ${matching2FA.token}`, "success")
	}

	async function refreshMailView() {
		await reloadMailView()
		showToast(language.mail?.toastRefreshed || "Webmail page refreshed", "success")
	}

	async function openInDefaultBrowser(acc: MailAccount) {
		const targetUrl =
			acc.provider === "custom"
				? acc.custom_url || "https://mail.google.com"
				: PROVIDER_CONFIGS[acc.provider]?.url || "https://mail.google.com"
		try {
			await invoke("open_external_url", { url: targetUrl })
			showToast("Opened in default browser", "success")
		} catch {
			try {
				await openUrl(targetUrl)
				showToast("Opened in default browser", "success")
			} catch (e) {
				console.error("Open external error:", e)
				showToast(`Failed to open browser: ${e}`, "error")
			}
		}
	}

	async function handleDeleteAccount(acc: MailAccount) {
		closeMenu()
		const confirmed = await askModal(
			`Are you sure you want to delete this mail account?\n\n"${acc.name || acc.email}" (${acc.email})`,
			{
				title: "Delete Account",
				kind: "error",
				okLabel: "Delete",
				cancelLabel: "Cancel",
			}
		)
		if (!confirmed) return
		await deleteMailAccount(acc.id)
	}

	function handleCardContextMenu(acc: MailAccount, e: MouseEvent) {
		e.preventDefault()
		e.stopPropagation()
		activeMailMenu = {
			x: e.clientX,
			y: e.clientY,
			account: acc,
		}
	}

	function handleThreeDotsClick(acc: MailAccount, e: MouseEvent) {
		e.preventDefault()
		e.stopPropagation()
		const target = e.currentTarget as HTMLElement | null
		const rect = target?.getBoundingClientRect()
		if (rect) {
			activeMailMenu = {
				x: Math.round(rect.right - 224),
				y: Math.round(rect.bottom + 6),
				account: acc,
			}
		} else {
			activeMailMenu = {
				x: e.clientX,
				y: e.clientY,
				account: acc,
			}
		}
	}

	function closeMenu() {
		activeMailMenu = null
	}

	function handleSwitchAccount(e: Event) {
		const targetId = (e.target as HTMLSelectElement)?.value
		const target = $mailAccounts.find((a) => a.id === targetId)
		if (target) selectAccount(target)
	}

	function handleScrollCloseMenu() {
		if (activeMailMenu) {
			closeMenu()
		}
	}

	onMount(() => {
		window.addEventListener("scroll", handleScrollCloseMenu, true)
		window.addEventListener("wheel", handleScrollCloseMenu, { passive: true })
		window.addEventListener("touchmove", handleScrollCloseMenu, { passive: true })
	})

	onDestroy(() => {
		if (typeof window !== "undefined") {
			window.removeEventListener("scroll", handleScrollCloseMenu, true)
			window.removeEventListener("wheel", handleScrollCloseMenu)
			window.removeEventListener("touchmove", handleScrollCloseMenu)
			window.removeEventListener("pointermove", onGlobalPointerMove)
			window.removeEventListener("pointerup", onGlobalPointerUp)
			window.removeEventListener("pointercancel", onGlobalPointerUp)
		}
		if (mailHoldTimer) clearTimeout(mailHoldTimer)
		if (totpTimer) clearInterval(totpTimer)
		if (resizeObserver) resizeObserver.disconnect()
		document.body.classList.remove("cursor-grabbing", "select-none")
	})
</script>

<svelte:window on:click={closeMenu} />

<!-- Dashboard: Clean Minimalist Authme Layout matching /codes -->
<div class="transparent-900 main mx-auto my-6 sm:my-10 md:my-16 w-[96%] sm:w-[94%] md:w-[92%] lg:w-[90%] xl:w-4/5 max-w-7xl rounded-2xl p-4 sm:p-6 md:p-8 lg:p-10 text-center select-none" class:hidden={$mailViewActive}>
		<h1>Mail</h1>

		{#if $mailAccounts.length === 0}
			<div class="content mail-content mx-auto grid grid-cols-1 gap-3.5 sm:gap-4 md:gap-5 rounded-2xl p-1 sm:p-2 md:p-4 w-full">
				<div class="importMail col-span-full transparent-800 w-full max-w-2xl mx-auto rounded-2xl p-5 text-center">
					<h2>{language.mail?.importMail || "Import your email accounts"}</h2>
					<h3>{language.mail?.importMailText || "Import your existing email accounts on the Import page."}</h3>
					<div class="mx-auto mt-6 flex flex-row items-center justify-center gap-3 sm:flex-wrap">
						<button class="button" on:click={() => navigate("import?category=mail")}>
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4" /><polyline points="14 2 14 8 20 8" /><path d="M2 15h10" /><path d="m9 18 3-3-3-3" /></svg>
							{language.mail?.importMailButton || "Import accounts"}
						</button>
					</div>
				</div>
			</div>
		{:else}
			<!-- Search Bar & Add Account Action -->
			<div class="searchContainer mx-auto mb-5 mt-4 flex items-center justify-center px-1 sm:px-4 w-full gap-2.5 sm:gap-3">
			<div class="relative flex items-center justify-center w-full max-w-xl md:max-w-2xl flex-1">
				<!-- Search Icon -->
				<svg class="pointer-events-none absolute left-4 h-5 w-5 text-slate-400 dark:text-slate-500 z-10" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>

				<!-- Search Input -->
				<input
					bind:value={searchQuery}
					spellcheck="false"
					class="search input w-full pl-11 sm:pl-12 pr-12 py-2.5 sm:py-3 rounded-2xl text-sm sm:text-base shadow-sm border border-slate-200/80 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md focus:ring-2 focus:ring-slate-400/50 dark:focus:ring-slate-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
					type="text"
					placeholder={language.mail?.searchPlaceholder || "Search email accounts..."}
				/>

				<!-- Right Control Group: Clear Button -->
				{#if searchQuery}
					<div class="absolute right-3 flex items-center gap-1.5 z-10">
						<button
							type="button"
							class="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors focus:outline-none cursor-pointer"
							title={language.codes?.clearSearchTooltip || "Clear search"}
							on:click={() => (searchQuery = "")}
						>
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
						</button>
					</div>
				{/if}
			</div>

			<!-- Add Account Button (Navigates to Import -> Mail category) -->
			<button
				type="button"
				class="button py-2.5 sm:py-3 px-3.5 sm:px-4 rounded-2xl flex items-center gap-2 text-sm font-semibold flex-shrink-0 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95 transition-all"
				title={language.mail?.addAccount || "Add new email account"}
				on:click={() => navigate("import?category=mail")}
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
				<span class="hidden min-[480px]:inline whitespace-nowrap">{language.mail?.addAccount || "Add account"}</span>
			</button>
		</div>

		{#if $mailAccounts.length > 0}
			<!-- Mail Category / Provider Filter Pills Bar with App Icons, Mouse Drag & Wheel Scroll -->
			<div
				use:horizontalMailScrollAction
				class="mail-category-bar mx-auto mb-6 -mt-2 flex items-center px-4 w-full max-w-4xl overflow-x-auto no-scrollbar py-2 select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				<div class="flex items-center gap-2.5 flex-nowrap min-w-max px-2 py-0.5 justify-start">
					<!-- All Pill -->
					<button
						type="button"
						class="category-pill group h-10 px-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 transition-all duration-150 cursor-pointer select-none flex-shrink-0 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 active:translate-y-[0.5px]
						{mailProviderFilter === 'all' && !mailUnreadOnly
							? 'bg-slate-900 text-white border border-slate-900 shadow-sm dark:bg-white dark:text-slate-900 dark:border-white'
							: 'bg-white/95 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'}"
						on:click={() => handleMailCategoryClick(() => {
							mailProviderFilter = 'all'
							mailUnreadOnly = false
						})}
					>
						<span class="w-6 h-6 rounded-[7px] flex items-center justify-center flex-shrink-0 shadow-xs
							{mailProviderFilter === 'all' && !mailUnreadOnly
								? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900'
								: 'bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300'}"
						>
							<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<rect x="3" y="3" width="7" height="7" rx="1.5" />
								<rect x="14" y="3" width="7" height="7" rx="1.5" />
								<rect x="14" y="14" width="7" height="7" rx="1.5" />
								<rect x="3" y="14" width="7" height="7" rx="1.5" />
							</svg>
						</span>
						<span class="whitespace-nowrap tracking-tight font-semibold text-[13px]">{language.mail?.allProviders || "All"}</span>
						<span class="text-[11px] px-2 py-0.5 rounded-full font-bold min-w-[20px] text-center
							{mailProviderFilter === 'all' && !mailUnreadOnly
								? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900 font-bold'
								: 'bg-slate-100 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400'}"
						>
							{$mailAccounts.length}
						</span>
					</button>

					<!-- Pinned Pill -->
					{#if mailCategoryCounts.pinned > 0}
						<button
							type="button"
							class="category-pill group h-10 px-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 transition-all duration-150 cursor-pointer select-none flex-shrink-0 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 active:translate-y-[0.5px]
							{mailProviderFilter === 'pinned' && !mailUnreadOnly
								? 'bg-slate-900 text-white border border-slate-900 shadow-sm dark:bg-white dark:text-slate-900 dark:border-white'
								: 'bg-white/95 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'}"
							on:click={() => handleMailCategoryClick(() => {
								mailProviderFilter = 'pinned'
								mailUnreadOnly = false
							})}
						>
							<span class="w-6 h-6 rounded-[7px] flex items-center justify-center flex-shrink-0 shadow-xs
								{mailProviderFilter === 'pinned' && !mailUnreadOnly
									? 'bg-amber-400/25 text-amber-300 dark:bg-amber-400/30 dark:text-amber-400'
									: 'bg-amber-400/15 dark:bg-amber-400/20 text-amber-500 dark:text-amber-400'}"
							>
								<svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
									<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
								</svg>
							</span>
							<span class="whitespace-nowrap tracking-tight font-semibold text-[13px]">{language.codes?.pinnedCategory || "Pinned"}</span>
							<span class="text-[11px] px-2 py-0.5 rounded-full font-bold min-w-[20px] text-center
								{mailProviderFilter === 'pinned' && !mailUnreadOnly
									? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900 font-bold'
									: 'bg-slate-100 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400'}"
							>
								{mailCategoryCounts.pinned}
							</span>
						</button>
					{/if}

					<!-- Gmail Pill -->
					{#if mailCategoryCounts.gmail > 0}
						<button
							type="button"
							class="category-pill group h-10 px-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 transition-all duration-150 cursor-pointer select-none flex-shrink-0 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 active:translate-y-[0.5px]
							{mailProviderFilter === 'gmail' && !mailUnreadOnly
								? 'bg-slate-900 text-white border border-slate-900 shadow-sm dark:bg-white dark:text-slate-900 dark:border-white'
								: 'bg-white/95 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'}"
							on:click={() => handleMailCategoryClick(() => {
								mailProviderFilter = 'gmail'
								mailUnreadOnly = false
							})}
						>
							<span class="w-6 h-6 rounded-[7px] flex items-center justify-center flex-shrink-0 shadow-xs bg-white border border-black/8 dark:border-white/12">
								<svg class="w-4 h-4" viewBox="0 0 24 24">
									<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
									<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
									<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
									<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
								</svg>
							</span>
							<span class="whitespace-nowrap tracking-tight font-semibold text-[13px]">Gmail</span>
							<span class="text-[11px] px-2 py-0.5 rounded-full font-bold min-w-[20px] text-center
								{mailProviderFilter === 'gmail' && !mailUnreadOnly
									? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900 font-bold'
									: 'bg-slate-100 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400'}"
							>
								{mailCategoryCounts.gmail}
							</span>
						</button>
					{/if}

					<!-- Outlook Pill -->
					{#if mailCategoryCounts.outlook > 0}
						<button
							type="button"
							class="category-pill group h-10 px-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 transition-all duration-150 cursor-pointer select-none flex-shrink-0 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 active:translate-y-[0.5px]
							{mailProviderFilter === 'outlook' && !mailUnreadOnly
								? 'bg-slate-900 text-white border border-slate-900 shadow-sm dark:bg-white dark:text-slate-900 dark:border-white'
								: 'bg-white/95 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'}"
							on:click={() => handleMailCategoryClick(() => {
								mailProviderFilter = 'outlook'
								mailUnreadOnly = false
							})}
						>
							<span class="w-6 h-6 rounded-[7px] flex items-center justify-center flex-shrink-0 shadow-xs bg-[#0078d4] text-white">
								<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="white">
									<path d="M23.007 6.467L13.72.062a.853.853 0 00-.916.037L.426 8.358A.853.853 0 000 9.072v11.996c0 .472.383.854.854.854h22.292c.472 0 .854-.382.854-.854V7.27a.853.853 0 00-.993-.803z"/>
								</svg>
							</span>
							<span class="whitespace-nowrap tracking-tight font-semibold text-[13px]">Outlook</span>
							<span class="text-[11px] px-2 py-0.5 rounded-full font-bold min-w-[20px] text-center
								{mailProviderFilter === 'outlook' && !mailUnreadOnly
									? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900 font-bold'
									: 'bg-slate-100 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400'}"
							>
								{mailCategoryCounts.outlook}
							</span>
						</button>
					{/if}

					<!-- Yahoo Pill -->
					{#if mailCategoryCounts.yahoo > 0}
						<button
							type="button"
							class="category-pill group h-10 px-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 transition-all duration-150 cursor-pointer select-none flex-shrink-0 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 active:translate-y-[0.5px]
							{mailProviderFilter === 'yahoo' && !mailUnreadOnly
								? 'bg-slate-900 text-white border border-slate-900 shadow-sm dark:bg-white dark:text-slate-900 dark:border-white'
								: 'bg-white/95 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'}"
							on:click={() => handleMailCategoryClick(() => {
								mailProviderFilter = 'yahoo'
								mailUnreadOnly = false
							})}
						>
							<span class="w-6 h-6 rounded-[7px] flex items-center justify-center flex-shrink-0 shadow-xs bg-[#6001d2] text-white">
								<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="white">
									<path d="M12.983 12.068l4.498-8.918h-2.613l-3.184 6.786-3.21-6.786H5.807l4.524 8.892V19.5h2.652v-7.432zm3.842 4.932c-.754 0-1.365.61-1.365 1.365 0 .754.61 1.365 1.365 1.365.754 0 1.365-.61 1.365-1.365 0-.754-.61-1.365-1.365-1.365z"/>
								</svg>
							</span>
							<span class="whitespace-nowrap tracking-tight font-semibold text-[13px]">Yahoo</span>
							<span class="text-[11px] px-2 py-0.5 rounded-full font-bold min-w-[20px] text-center
								{mailProviderFilter === 'yahoo' && !mailUnreadOnly
									? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900 font-bold'
									: 'bg-slate-100 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400'}"
							>
								{mailCategoryCounts.yahoo}
							</span>
						</button>
					{/if}

					<!-- Proton Pill -->
					{#if mailCategoryCounts.proton > 0}
						<button
							type="button"
							class="category-pill group h-10 px-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 transition-all duration-150 cursor-pointer select-none flex-shrink-0 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 active:translate-y-[0.5px]
							{mailProviderFilter === 'proton' && !mailUnreadOnly
								? 'bg-slate-900 text-white border border-slate-900 shadow-sm dark:bg-white dark:text-slate-900 dark:border-white'
								: 'bg-white/95 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'}"
							on:click={() => handleMailCategoryClick(() => {
								mailProviderFilter = 'proton'
								mailUnreadOnly = false
							})}
						>
							<span class="w-6 h-6 rounded-[7px] flex items-center justify-center flex-shrink-0 shadow-xs bg-[#6d4aff] text-white">
								<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="white">
									<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.93V14h-2v2.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 12h2V7.07c.33-.05.66-.07 1-.07s.67.02 1 .07V12h2l4.79-4.79c.13.58.21 1.17.21 1.79 0 4.08-3.05 7.44-7 7.93z"/>
								</svg>
							</span>
							<span class="whitespace-nowrap tracking-tight font-semibold text-[13px]">Proton</span>
							<span class="text-[11px] px-2 py-0.5 rounded-full font-bold min-w-[20px] text-center
								{mailProviderFilter === 'proton' && !mailUnreadOnly
									? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900 font-bold'
									: 'bg-slate-100 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400'}"
							>
								{mailCategoryCounts.proton}
							</span>
						</button>
					{/if}

					<!-- iCloud Pill -->
					{#if mailCategoryCounts.icloud > 0}
						<button
							type="button"
							class="category-pill group h-10 px-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 transition-all duration-150 cursor-pointer select-none flex-shrink-0 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 active:translate-y-[0.5px]
							{mailProviderFilter === 'icloud' && !mailUnreadOnly
								? 'bg-slate-900 text-white border border-slate-900 shadow-sm dark:bg-white dark:text-slate-900 dark:border-white'
								: 'bg-white/95 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'}"
							on:click={() => handleMailCategoryClick(() => {
								mailProviderFilter = 'icloud'
								mailUnreadOnly = false
							})}
						>
							<span class="w-6 h-6 rounded-[7px] flex items-center justify-center flex-shrink-0 shadow-xs bg-[#3699ff] text-white">
								<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="white">
									<path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
								</svg>
							</span>
							<span class="whitespace-nowrap tracking-tight font-semibold text-[13px]">iCloud</span>
							<span class="text-[11px] px-2 py-0.5 rounded-full font-bold min-w-[20px] text-center
								{mailProviderFilter === 'icloud' && !mailUnreadOnly
									? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900 font-bold'
									: 'bg-slate-100 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400'}"
							>
								{mailCategoryCounts.icloud}
							</span>
						</button>
					{/if}

					<!-- Webmail Pill -->
					{#if mailCategoryCounts.custom > 0}
						<button
							type="button"
							class="category-pill group h-10 px-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 transition-all duration-150 cursor-pointer select-none flex-shrink-0 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 active:translate-y-[0.5px]
							{mailProviderFilter === 'custom' && !mailUnreadOnly
								? 'bg-slate-900 text-white border border-slate-900 shadow-sm dark:bg-white dark:text-slate-900 dark:border-white'
								: 'bg-white/95 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'}"
							on:click={() => handleMailCategoryClick(() => {
								mailProviderFilter = 'custom'
								mailUnreadOnly = false
							})}
						>
							<span class="w-6 h-6 rounded-[7px] flex items-center justify-center flex-shrink-0 shadow-xs bg-slate-700 text-white">
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<circle cx="12" cy="12" r="10" stroke-width="2" />
									<line x1="2" y1="12" x2="22" y2="12" stroke-width="2" />
									<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke-width="2" />
								</svg>
							</span>
							<span class="whitespace-nowrap tracking-tight font-semibold text-[13px]">Webmail</span>
							<span class="text-[11px] px-2 py-0.5 rounded-full font-bold min-w-[20px] text-center
								{mailProviderFilter === 'custom' && !mailUnreadOnly
									? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900 font-bold'
									: 'bg-slate-100 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400'}"
							>
								{mailCategoryCounts.custom}
							</span>
						</button>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Card Grid (Matching Authme /codes content grid) -->
		<div class="mail-card-content mx-auto grid grid-cols-1 card2:grid-cols-2 card3:grid-cols-3 gap-3.5 sm:gap-4 md:gap-5 rounded-2xl p-1 sm:p-2 md:p-4 w-full">
			{#if filteredAccounts.length === 0 && searchQuery.trim()}
				<!-- No Search Results -->
				<div class="noSearchResults col-span-full transparent-800 w-full max-w-2xl mx-auto rounded-2xl p-8 text-center border border-slate-200/80 dark:border-slate-700/60 shadow-lg">
					<div class="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
						<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
					</div>
					<h2 class="text-xl font-bold mb-1 text-slate-900 dark:text-white">{language.mail?.noAccountsFound || "No email accounts found"}</h2>
					<h3 class="text-sm text-slate-500 dark:text-slate-400 mb-4">{language.mail?.noResultsFor || "No results for"} "{searchQuery}"</h3>
					<button class="button mx-auto py-2 px-4 text-sm inline-flex items-center gap-2 cursor-pointer" on:click={() => (searchQuery = "")}>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
						<span>{language.mail?.clearSearch || "Clear search (Show all)"}</span>
					</button>
				</div>
			{:else}
				<!-- Render Account Cards with smooth drag-and-drop reordering -->
				{#each filteredAccounts as acc (acc.id)}
					<div
						role="button"
						tabindex="0"
						draggable="false"
						style="touch-action: none;"
						data-mail-card-id={acc.id}
						animate:flip={{ duration: 200 }}
						class="mail-card group transition-all duration-200 select-none text-left relative cursor-pointer {draggedMailId === acc.id ? 'code-drag-placeholder flex flex-col items-center justify-center min-h-[88px] pointer-events-none' : ''} {settledMailId === acc.id ? 'code-drop-settle' : 'hover:scale-[1.01]'} {activeMailMenu?.account?.id === acc.id ? 'z-40 ring-2 ring-sky-500/60' : 'z-10'} {$pinnedMailIdsStore.has(acc.id) ? 'mail-card-pinned' : ''}"
						on:click={() => handleCardClick(acc)}
						on:keydown={(e) => handleCardKeydown(e, acc)}
						on:contextmenu={(e) => handleCardContextMenu(acc, e)}
					>
						{#if draggedMailId === acc.id}
							<!-- Placeholder Slot in Grid -->
							<div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-400 animate-pulse">
								<svg class="w-4 h-4 text-sky-400 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m-6-6l6 6 6-6" />
								</svg>
								<span>{language.mail?.dropSlot || "Move here"}</span>
							</div>
						{:else}
						<div class="flex flex-row items-center justify-between gap-3 w-full">
							<!-- Brand Icon -->
							<div
								class="flex-shrink-0 flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-2xl shadow-sm overflow-hidden select-none transition-transform duration-200 group-hover:scale-105 pointer-events-none"
								style="background: {PROVIDER_CONFIGS[acc.provider]?.bg || 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'}; border: 1px solid rgba(255,255,255,0.12);"
							>
								{#if acc.provider === "gmail"}
									<div class="w-full h-full bg-white flex items-center justify-center">
										<svg class="w-7 h-7" viewBox="0 0 24 24">
											<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
											<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
											<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
											<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
										</svg>
									</div>
								{:else if acc.provider === "outlook"}
									<svg class="w-7 h-7" viewBox="0 0 24 24" fill="white">
										<path d="M23.007 6.467L13.72.062a.853.853 0 00-.916.037L.426 8.358A.853.853 0 000 9.072v11.996c0 .472.383.854.854.854h22.292c.472 0 .854-.382.854-.854V7.27a.853.853 0 00-.993-.803z" fill="#0078d4"/>
										<path d="M13.714 13.626L24 7.271v13.797a.853.853 0 01-.854.854H13.714V13.626z" fill="#005a9e"/>
										<path d="M0 9.072l10.286 6.355V21.92H.854A.853.853 0 010 21.068V9.072z" fill="#0078d4"/>
									</svg>
								{:else if acc.provider === "yahoo"}
									<svg class="w-6 h-6" viewBox="0 0 24 24" fill="white">
										<path d="M12.983 12.068l4.498-8.918h-2.613l-3.184 6.786-3.21-6.786H5.807l4.524 8.892V19.5h2.652v-7.432zm3.842 4.932c-.754 0-1.365.61-1.365 1.365 0 .754.61 1.365 1.365 1.365.754 0 1.365-.61 1.365-1.365 0-.754-.61-1.365-1.365-1.365z"/>
									</svg>
								{:else if acc.provider === "proton"}
									<svg class="w-6 h-6" viewBox="0 0 24 24" fill="white">
										<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.93V14h-2v2.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 12h2V7.07c.33-.05.66-.07 1-.07s.67.02 1 .07V12h2l4.79-4.79c.13.58.21 1.17.21 1.79 0 4.08-3.05 7.44-7 7.93z"/>
									</svg>
								{:else if acc.provider === "icloud"}
									<svg class="w-7 h-7" viewBox="0 0 24 24" fill="white">
										<path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
									</svg>
								{:else}
									<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<circle cx="12" cy="12" r="10" stroke-width="2" />
										<line x1="2" y1="12" x2="22" y2="12" stroke-width="2" />
										<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke-width="2" />
									</svg>
								{/if}
							</div>

							<!-- Info Stack -->
							<div class="flex flex-col justify-center flex-grow min-w-0 overflow-hidden text-left pl-1 pointer-events-none">
								<div class="flex items-center gap-2">
									<p class="text-base md:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate" title="{acc.name}">
										{acc.name}
									</p>
									{#if acc.label}
										<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700/60">
											{acc.label}
										</span>
									{/if}
								</div>

								<p class="text-xs md:text-sm font-normal text-slate-500 dark:text-slate-400 truncate w-full mt-0.5" title="{acc.email}">
									{acc.email}
								</p>

								<!-- Status Indicator -->
								<div class="mt-2 flex items-center gap-2">
									{#if acc.unread_count > 0}
										<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-500 border border-rose-500/30">
											<span class="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
											{acc.unread_count} {language.mail?.newMessages || "new messages"}
										</span>
									{:else}
										<span class="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
											<span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
											{language.mail?.clickToOpen || "Click to open mailbox"}
										</span>
									{/if}
								</div>
							</div>

							<!-- Right Side: Action Stack -->
							<div class="flex-shrink-0 flex flex-col items-end justify-between self-stretch pointer-events-auto py-0.5 min-h-[64px]">
								<!-- Top-Right: Star Pin Button -->
								<button
									type="button"
									class="star-btn w-6.5 h-6.5 sm:w-7 sm:h-7 rounded-xl flex items-center justify-center transition-all active:scale-90 focus:outline-none cursor-pointer {
										$pinnedMailIdsStore.has(acc.id)
											? 'text-amber-400 bg-amber-400/15 dark:bg-amber-400/20 border border-amber-400/40 shadow-xs'
											: 'text-slate-400 hover:text-amber-400 dark:text-slate-500 dark:hover:text-amber-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
									}"
									title={$pinnedMailIdsStore.has(acc.id) ? (language.codes?.unpin || 'Unpin from top') : (language.codes?.pinToTop || 'Pin to top')}
									on:pointerdown|stopPropagation
									on:click|stopPropagation={() => togglePinMailAccount(acc.id)}
								>
									{#if $pinnedMailIdsStore.has(acc.id)}
										<svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 fill-amber-400 drop-shadow-xs pointer-events-none" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
									{:else}
										<svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
									{/if}
								</button>

								<!-- Bottom Row: Dedicated Drag Handle & Three-dots Menu -->
								<div class="flex items-center gap-1 sm:gap-1.5 mt-auto">
									<!-- Dedicated Drag Grip Handle -->
									<div
										role="button"
										tabindex="0"
										aria-label={language.mail?.dragHandleTooltip || "Drag to reorder"}
										class="drag-handle w-6.5 h-6.5 sm:w-7 sm:h-7 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 cursor-grab active:cursor-grabbing transition-all select-none flex-shrink-0"
										title={language.mail?.dragHandleTooltip || "Drag to reorder"}
										on:pointerdown|stopPropagation={(e) => handleMailHandlePointerDown(acc, e)}
										on:click|stopPropagation
										on:keydown|stopPropagation={(e) => {
											if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
												e.preventDefault();
												moveMailAccount(acc.id, -1);
											} else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
												e.preventDefault();
												moveMailAccount(acc.id, 1);
											}
										}}
									>
										<svg class="w-3.5 h-3.5 pointer-events-none opacity-70 group-hover:opacity-100" viewBox="0 0 24 24" fill="currentColor">
											<circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
											<circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
											<circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
										</svg>
									</div>

									<button
										type="button"
										draggable="false"
										on:dragstart|stopPropagation|preventDefault
										on:click={(e) => handleThreeDotsClick(acc, e)}
										on:contextmenu={(e) => handleCardContextMenu(acc, e)}
										class="w-6.5 h-6.5 sm:w-7 sm:h-7 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-all active:scale-90 focus:outline-none cursor-pointer"
										title={language.mail?.options || "Options"}
									>
										<svg class="w-4 h-4 pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
											<path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
										</svg>
									</button>
								</div>
							</div>
						</div>
					{/if}
					</div>
				{/each}
			{/if}
		</div>
	{/if}
	</div>

	<!-- In-App Embedded Mail View Container (ALWAYS in DOM, sized and ready) -->
	<div
		class="w-full h-full min-h-screen overflow-hidden select-none bg-white"
		class:hidden={!$mailViewActive}
	>
		<!-- Embedded Webview Container Area (full height) -->
		<div
			bind:this={webviewContainerEl}
			class="mailWebviewContainer w-full h-full min-h-screen bg-white relative"
			style="height: 100vh; min-height: 100vh; background-color: #ffffff;"
		>
			<!-- Seamless subtle connecting placeholder (only shown during new login session) -->
			{#if !$activeMailAccount && $pendingLogin}
				<div class="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-sm text-slate-400 select-none pointer-events-none z-0">
					<div class="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-800/90 border border-slate-700/60 shadow-xl mb-3 animate-pulse">
						<svg class="w-7 h-7 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<rect width="20" height="16" x="2" y="4" rx="2" />
							<path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
						</svg>
					</div>
					<p class="text-sm font-semibold text-slate-200">
						Connecting to {$pendingLogin.provider}...
					</p>
				</div>
			{/if}
		</div>
	</div>

<!-- Floating Drag Avatar for Mail Card -->
{#if activeMailDrag}
	<div
		bind:this={floatingMailAvatarEl}
		class="code-drag-floating rounded-2xl p-4 sm:p-5 select-none text-left bg-white/95 dark:bg-slate-800/95 border-2 border-sky-400 dark:border-sky-400 pointer-events-none"
		style="width: {activeMailDrag.width}px; height: {activeMailDrag.height}px; left: 0; top: 0; transform: translate3d({activeMailDrag.currentX - activeMailDrag.offsetX}px, {activeMailDrag.currentY - activeMailDrag.offsetY}px, 0) scale(1.04) rotate({activeMailDrag.tilt}deg); will-change: transform;"
	>
		<div class="flex flex-row items-center justify-between gap-3 w-full">
			<!-- Brand Icon -->
			<div
				class="flex-shrink-0 flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-2xl shadow-sm overflow-hidden select-none pointer-events-none"
				style="background: {PROVIDER_CONFIGS[activeMailDrag.account.provider]?.bg || 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'}; border: 1px solid rgba(255,255,255,0.12);"
			>
				{#if activeMailDrag.account.provider === "gmail"}
					<div class="w-full h-full bg-white flex items-center justify-center">
						<svg class="w-7 h-7" viewBox="0 0 24 24">
							<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
							<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
							<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
							<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
						</svg>
					</div>
				{:else if activeMailDrag.account.provider === "outlook"}
					<svg class="w-7 h-7" viewBox="0 0 24 24" fill="white">
						<path d="M23.007 6.467L13.72.062a.853.853 0 00-.916.037L.426 8.358A.853.853 0 000 9.072v11.996c0 .472.383.854.854.854h22.292c.472 0 .854-.382.854-.854V7.27a.853.853 0 00-.993-.803z" fill="#0078d4"/>
						<path d="M13.714 13.626L24 7.271v13.797a.853.853 0 01-.854.854H13.714V13.626z" fill="#005a9e"/>
						<path d="M0 9.072l10.286 6.355V21.92H.854A.853.853 0 010 21.068V9.072z" fill="#0078d4"/>
					</svg>
				{:else}
					<div class="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold uppercase">
						{activeMailDrag.account.name?.[0] || "M"}
					</div>
				{/if}
			</div>

			<!-- Info Stack -->
			<div class="flex flex-col justify-center flex-grow min-w-0 overflow-hidden text-left pl-1 pointer-events-none">
				<div class="flex items-center gap-2">
					<p class="text-base md:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
						{activeMailDrag.account.name}
					</p>
					{#if activeMailDrag.account.label}
						<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
							{activeMailDrag.account.label}
						</span>
					{/if}
				</div>
				<p class="text-xs md:text-sm font-normal text-slate-500 dark:text-slate-400 truncate w-full mt-0.5">
					{activeMailDrag.account.email}
				</p>
			</div>
		</div>
	</div>
{/if}

<!-- Custom Floating Mail Card Context Menu (Authme Standard Floating Style) -->
{#if activeMailMenu}
	<div
		bind:this={mailMenuEl}
		role="menu"
		tabindex="-1"
		in:scale={{ start: 0.95, duration: 150 }}
		out:fade={{ duration: 100 }}
		style="left: {menuPosX}px; top: {menuPosY}px;"
		class="fixed z-[99999] w-56 rounded-2xl p-1.5 shadow-2xl backdrop-blur-2xl border select-none
			bg-white/95 text-slate-800 border-slate-200/90 shadow-slate-900/10
			dark:bg-[#0f172a]/95 dark:text-slate-100 dark:border-slate-700/80 dark:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.7)] dark:ring-1 dark:ring-white/10"
		on:contextmenu|preventDefault|stopPropagation
		on:pointerdown|stopPropagation
		on:pointerup|stopPropagation
		on:click|stopPropagation
		on:keydown|stopPropagation
	>
		<!-- Open Inbox -->
		<button
			type="button"
			class="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-xl font-medium text-sm transition-all duration-150 group/menuitem
				hover:bg-slate-100 dark:hover:bg-slate-800/90 hover:text-slate-900 dark:hover:text-white active:scale-[0.98] cursor-pointer"
			on:contextmenu|preventDefault|stopPropagation
			on:click={() => { const acc = activeMailMenu?.account; closeMenu(); if (acc) selectAccount(acc); }}
		>
			<div class="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100/90 dark:bg-slate-800/90 text-slate-400 group-hover/menuitem:text-sky-500 dark:group-hover/menuitem:text-sky-400 group-hover/menuitem:bg-sky-50 dark:group-hover/menuitem:bg-sky-500/20 group-hover/menuitem:ring-1 group-hover/menuitem:ring-sky-500/30 transition-all duration-150">
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
					<path d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z"/>
				</svg>
			</div>
			<span class="text-slate-700 dark:text-slate-200 group-hover/menuitem:text-slate-900 dark:group-hover/menuitem:text-white">Open Inbox</span>
		</button>

		<!-- Edit -->
		<button
			type="button"
			class="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-xl font-medium text-sm transition-all duration-150 group/menuitem
				hover:bg-slate-100 dark:hover:bg-slate-800/90 hover:text-slate-900 dark:hover:text-white active:scale-[0.98] cursor-pointer"
			on:contextmenu|preventDefault|stopPropagation
			on:click={() => { const acc = activeMailMenu?.account; closeMenu(); if (acc) openEditModal(acc); }}
		>
			<div class="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100/90 dark:bg-slate-800/90 text-slate-400 group-hover/menuitem:text-sky-500 dark:group-hover/menuitem:text-sky-400 group-hover/menuitem:bg-sky-50 dark:group-hover/menuitem:bg-sky-500/20 group-hover/menuitem:ring-1 group-hover/menuitem:ring-sky-500/30 transition-all duration-150">
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
					<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
					<path d="m15 5 4 4" />
				</svg>
			</div>
			<span class="text-slate-700 dark:text-slate-200 group-hover/menuitem:text-slate-900 dark:group-hover/menuitem:text-white">Edit</span>
		</button>

		<!-- Toggle Pin / Star Action -->
		<button
			type="button"
			class="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-xl font-medium text-sm transition-all duration-150 group/menuitem
				hover:bg-slate-100 dark:hover:bg-slate-800/90 hover:text-slate-900 dark:hover:text-white active:scale-[0.98] cursor-pointer"
			on:contextmenu|preventDefault|stopPropagation
			on:click={() => { const acc = activeMailMenu?.account; closeMenu(); if (acc) togglePinMailAccount(acc.id); }}
		>
			<div class="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100/90 dark:bg-slate-800/90 text-slate-400 group-hover/menuitem:text-amber-500 dark:group-hover/menuitem:text-amber-400 group-hover/menuitem:bg-amber-50 dark:group-hover/menuitem:bg-slate-700/80 transition-colors">
				{#if activeMailMenu?.account && $pinnedMailIdsStore.has(activeMailMenu.account.id)}
					<svg class="w-4 h-4 text-amber-500 dark:text-amber-400 fill-amber-500 dark:fill-amber-400" viewBox="0 0 24 24">
						<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
					</svg>
				{:else}
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
						<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
					</svg>
				{/if}
			</div>
			<span class="text-slate-700 dark:text-slate-200 group-hover/menuitem:text-slate-900 dark:group-hover/menuitem:text-white">
				{activeMailMenu?.account && $pinnedMailIdsStore.has(activeMailMenu.account.id) ? (language.codes?.unpin || "Unpin from top") : (language.codes?.pinToTop || "Pin to top")}
			</span>
		</button>

		<!-- Copy Email -->
		<button
			type="button"
			class="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-xl font-medium text-sm transition-all duration-150 group/menuitem
				hover:bg-slate-100 dark:hover:bg-slate-800/90 hover:text-slate-900 dark:hover:text-white active:scale-[0.98] cursor-pointer"
			on:contextmenu|preventDefault|stopPropagation
			on:click={() => { const acc = activeMailMenu?.account; closeMenu(); if (acc) copyEmail(acc.email); }}
		>
			<div class="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100/90 dark:bg-slate-800/90 text-slate-400 group-hover/menuitem:text-sky-500 dark:group-hover/menuitem:text-sky-400 group-hover/menuitem:bg-sky-50 dark:group-hover/menuitem:bg-sky-500/20 group-hover/menuitem:ring-1 group-hover/menuitem:ring-sky-500/30 transition-all duration-150">
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
					<rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
					<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
				</svg>
			</div>
			<span class="text-slate-700 dark:text-slate-200 group-hover/menuitem:text-slate-900 dark:group-hover/menuitem:text-white">Copy Email</span>
		</button>

		{#if activeMailMenu?.account?.password}
			<!-- Copy Password -->
			<button
				type="button"
				class="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-xl font-medium text-sm transition-all duration-150 group/menuitem
					hover:bg-slate-100 dark:hover:bg-slate-800/90 hover:text-slate-900 dark:hover:text-white active:scale-[0.98] cursor-pointer"
				on:contextmenu|preventDefault|stopPropagation
				on:click={() => { const acc = activeMailMenu?.account; closeMenu(); if (acc?.password) copyPassword(acc.password); }}
			>
				<div class="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100/90 dark:bg-slate-800/90 text-slate-400 group-hover/menuitem:text-sky-500 dark:group-hover/menuitem:text-sky-400 group-hover/menuitem:bg-sky-50 dark:group-hover/menuitem:bg-sky-500/20 group-hover/menuitem:ring-1 group-hover/menuitem:ring-sky-500/30 transition-all duration-150">
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 2l-2 2m-1.5 1.5L14 9m0 0l-1.5-1.5M14 9l1.5 1.5M14 9l-3 3m0 0l-1.5-1.5M11 12l1.5 1.5M11 12l-1 1M8 15a4 4 0 1 1-4-4c1.1 0 2.1.45 2.83 1.17L14 5l3-3 5 5-7.17 7.17A3.98 3.98 0 0 1 8 15z" />
					</svg>
				</div>
				<span class="text-slate-700 dark:text-slate-200 group-hover/menuitem:text-slate-900 dark:group-hover/menuitem:text-white">Copy Password</span>
			</button>
		{/if}

		<!-- Open in Browser -->
		<button
			type="button"
			class="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-xl font-medium text-sm transition-all duration-150 group/menuitem
				hover:bg-slate-100 dark:hover:bg-slate-800/90 hover:text-slate-900 dark:hover:text-white active:scale-[0.98] cursor-pointer"
			on:contextmenu|preventDefault|stopPropagation
			on:click={() => { const acc = activeMailMenu?.account; closeMenu(); if (acc) openInDefaultBrowser(acc); }}
		>
			<div class="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100/90 dark:bg-slate-800/90 text-slate-400 group-hover/menuitem:text-sky-500 dark:group-hover/menuitem:text-sky-400 group-hover/menuitem:bg-sky-50 dark:group-hover/menuitem:bg-sky-500/20 group-hover/menuitem:ring-1 group-hover/menuitem:ring-sky-500/30 transition-all duration-150">
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
					<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
					<polyline points="15 3 21 3 21 9"/>
					<line x1="10" y1="14" x2="21" y2="3"/>
				</svg>
			</div>
			<span class="text-slate-700 dark:text-slate-200 group-hover/menuitem:text-slate-900 dark:group-hover/menuitem:text-white">Open in Browser</span>
		</button>

		<!-- Divider -->
		<div class="h-px bg-slate-200/90 dark:bg-slate-700/70 my-1 mx-1.5" />

		<!-- Delete -->
		<button
			type="button"
			class="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-xl font-medium text-sm transition-all duration-150 group/menuitem
				hover:bg-rose-500/10 dark:hover:bg-rose-500/15 active:scale-[0.98] cursor-pointer"
			on:contextmenu|preventDefault|stopPropagation
			on:click={() => { const acc = activeMailMenu?.account; closeMenu(); if (acc) handleDeleteAccount(acc); }}
		>
			<div class="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100/90 dark:bg-slate-800/90 text-slate-400 group-hover/menuitem:text-rose-500 dark:group-hover/menuitem:text-rose-400 group-hover/menuitem:bg-rose-50 dark:group-hover/menuitem:bg-rose-500/20 group-hover/menuitem:ring-1 group-hover/menuitem:ring-rose-500/30 transition-all duration-150">
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
					<path d="M3 6h18" />
					<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
					<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
				</svg>
			</div>
			<span class="text-slate-700 dark:text-slate-200 group-hover/menuitem:text-rose-600 dark:group-hover/menuitem:text-rose-400 transition-colors">Delete</span>
		</button>
	</div>
{/if}

<!-- Clean Provider Selector Modal (Zero Manual Credentials - Pure Web Login) -->
{#if showProviderPickerModal}
	<div
		role="presentation"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-150"
		on:click|self={closeProviderPicker}
		on:keydown|self={(e) => e.key === "Escape" && closeProviderPicker()}
		tabindex="-1"
	>
		<div
			role="dialog"
			aria-modal="true"
			class="relative w-full max-w-md rounded-3xl p-6 shadow-2xl border text-left bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl text-slate-900 dark:text-white border-slate-200/90 dark:border-slate-700/80 select-none"
		>
			<div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-200/80 dark:border-slate-800">
				<div>
					<h2 class="text-lg font-bold text-slate-900 dark:text-white">{language.mail?.chooseProvider || "Choose Email Provider"}</h2>
					<p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{language.mail?.chooseProviderSubtitle || "Sign in directly on the official service web page."}</p>
				</div>
				<button
					type="button"
					on:click={closeProviderPicker}
					class="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
				</button>
			</div>

			<div class="grid grid-cols-1 gap-2.5">
				<!-- Google Gmail -->
				<button
					type="button"
					class="w-full p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-500 dark:hover:border-sky-500 bg-slate-50 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-[0.98] flex items-center gap-3.5 cursor-pointer text-left"
					on:click={() => handleStartLoginDirect('gmail')}
				>
					<div class="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-sm border border-slate-200/60">
						<svg class="w-5 h-5" viewBox="0 0 24 24">
							<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
							<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
							<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
							<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
						</svg>
					</div>
					<div>
						<p class="text-sm font-bold text-slate-800 dark:text-slate-100">Google (Gmail)</p>
						<p class="text-xs text-slate-400">{language.mail?.googleDesc || "Sign in with your @gmail.com Google account"}</p>
					</div>
				</button>

				<!-- Microsoft Outlook -->
				<button
					type="button"
					class="w-full p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-500 dark:hover:border-sky-500 bg-slate-50 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-[0.98] flex items-center gap-3.5 cursor-pointer text-left"
					on:click={() => handleStartLoginDirect('outlook')}
				>
					<div class="w-10 h-10 rounded-xl bg-[#0078d4] flex items-center justify-center flex-shrink-0 shadow-sm">
						<svg class="w-5 h-5" viewBox="0 0 24 24" fill="white">
							<path d="M23.007 6.467L13.72.062a.853.853 0 00-.916.037L.426 8.358A.853.853 0 000 9.072v11.996c0 .472.383.854.854.854h22.292c.472 0 .854-.382.854-.854V7.27a.853.853 0 00-.993-.803z"/>
						</svg>
					</div>
					<div>
						<p class="text-sm font-bold text-slate-800 dark:text-slate-100">Microsoft Outlook</p>
						<p class="text-xs text-slate-400">@outlook.com, @hotmail.com, Office 365</p>
					</div>
				</button>

				<!-- Yahoo Mail -->
				<button
					type="button"
					class="w-full p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 hover:border-purple-500 dark:hover:border-purple-500 bg-slate-50 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-[0.98] flex items-center gap-3.5 cursor-pointer text-left"
					on:click={() => handleStartLoginDirect('yahoo')}
				>
					<div class="w-10 h-10 rounded-xl bg-[#6001d2] flex items-center justify-center flex-shrink-0 shadow-sm">
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="white">
							<path d="M12.983 12.068l4.498-8.918h-2.613l-3.184 6.786-3.21-6.786H5.807l4.524 8.892V19.5h2.652v-7.432zm3.842 4.932c-.754 0-1.365.61-1.365 1.365 0 .754.61 1.365 1.365 1.365.754 0 1.365-.61 1.365-1.365 0-.754-.61-1.365-1.365-1.365z"/>
						</svg>
					</div>
					<div>
						<p class="text-sm font-bold text-slate-800 dark:text-slate-100">Yahoo Mail</p>
						<p class="text-xs text-slate-400">@yahoo.com, @ymail.com</p>
					</div>
				</button>

				<!-- Proton Mail -->
				<button
					type="button"
					class="w-full p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-[0.98] flex items-center gap-3.5 cursor-pointer text-left"
					on:click={() => handleStartLoginDirect('proton')}
				>
					<div class="w-10 h-10 rounded-xl bg-[#6d4aff] flex items-center justify-center flex-shrink-0 shadow-sm">
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="white">
							<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.93V14h-2v2.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 12h2V7.07c.33-.05.66-.07 1-.07s.67.02 1 .07V12h2l4.79-4.79c.13.58.21 1.17.21 1.79 0 4.08-3.05 7.44-7 7.93z"/>
						</svg>
					</div>
					<div>
						<p class="text-sm font-bold text-slate-800 dark:text-slate-100">Proton Mail</p>
						<p class="text-xs text-slate-400">@proton.me, @pm.me</p>
					</div>
				</button>

				<!-- iCloud Mail -->
				<button
					type="button"
					class="w-full p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 hover:border-sky-500 dark:hover:border-sky-500 bg-slate-50 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-[0.98] flex items-center gap-3.5 cursor-pointer text-left"
					on:click={() => handleStartLoginDirect('icloud')}
				>
					<div class="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
						<svg class="w-5 h-5" viewBox="0 0 24 24" fill="white">
							<path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
						</svg>
					</div>
					<div>
						<p class="text-sm font-bold text-slate-800 dark:text-slate-100">iCloud Mail</p>
						<p class="text-xs text-slate-400">@icloud.com, Apple ID</p>
					</div>
				</button>

				<!-- Custom Webmail -->
				<button
					type="button"
					class="w-full p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 hover:border-amber-500 dark:hover:border-amber-500 bg-slate-50 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-[0.98] flex items-center gap-3.5 cursor-pointer text-left"
					on:click={() => handleStartLoginDirect('custom')}
				>
					<div class="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-sm">
						<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<circle cx="12" cy="12" r="10" stroke-width="2" />
							<line x1="2" y1="12" x2="22" y2="12" stroke-width="2" />
							<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke-width="2" />
						</svg>
					</div>
					<div>
						<p class="text-sm font-bold text-slate-800 dark:text-slate-100">{language.mail?.customWebmail || "Other Webmail (Custom)"}</p>
						<p class="text-xs text-slate-400">{language.mail?.customWebmailDesc || "Specify your corporate or hosting webmail URL"}</p>
					</div>
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Custom Webmail URL Input Modal -->
{#if showCustomUrlModal}
	<div
		role="presentation"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-150"
		on:click|self={() => (showCustomUrlModal = false)}
		on:keydown|self={(e) => e.key === "Escape" && (showCustomUrlModal = false)}
		tabindex="-1"
	>
		<div
			role="dialog"
			aria-modal="true"
			class="relative w-full max-w-sm rounded-3xl p-6 shadow-2xl border text-left bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl text-slate-900 dark:text-white border-slate-200/90 dark:border-slate-700/80 select-none"
		>
			<h2 class="text-lg font-bold text-slate-900 dark:text-white mb-1">{language.mail?.specifyUrl || "Specify Webmail URL"}</h2>
			<p class="text-xs text-slate-500 dark:text-slate-400 mb-4">{language.mail?.specifyUrlSubtitle || "Please enter the login URL for your webmail system"}</p>
			<input
				type="url"
				bind:value={customWebmailInput}
				placeholder="https://webmail.example.com"
				class="w-full px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm mb-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
			/>
			<div class="flex items-center justify-end gap-2">
				<button
					type="button"
					on:click={() => (showCustomUrlModal = false)}
					class="py-2 px-4 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
				>
					{language.common?.cancel || "Cancel"}
				</button>
				<button
					type="button"
					on:click={submitCustomWebmailUrl}
					class="py-2 px-4 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md cursor-pointer"
				>
					{language.mail?.goToLogin || "Go to login page"}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Edit Display Name & Label Modal -->
{#if showEditModal && editingAccount}
	<div
		role="presentation"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-150"
		on:click|self={closeEditModal}
		on:keydown|self={(e) => e.key === "Escape" && closeEditModal()}
		tabindex="-1"
	>
		<div
			role="dialog"
			aria-modal="true"
			class="relative w-full max-w-sm rounded-3xl p-6 shadow-2xl border text-left bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl text-slate-900 dark:text-white border-slate-200/90 dark:border-slate-700/80 select-none"
		>
			<h2 class="text-lg font-bold text-slate-900 dark:text-white mb-1">Edit Account Details</h2>
			<p class="text-xs text-slate-500 dark:text-slate-400 mb-4">{editingAccount.email}</p>

			<div class="space-y-4">
				<div>
					<label for="edit_account_name" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
						Display Name
					</label>
					<input
						id="edit_account_name"
						type="text"
						bind:value={editName}
						placeholder="e.g. {editingAccount.name || 'Account Name'}"
						on:keydown={(e) => e.key === "Enter" && saveAccountEdit()}
						class="w-full px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
					/>
				</div>

				<div>
					<div class="flex items-center justify-between mb-1">
						<label for="edit_account_label" class="text-xs font-semibold text-slate-700 dark:text-slate-300">
							Label
						</label>
						<div class="flex items-center gap-1">
							{#each PRESET_LABELS as l}
								<button
									type="button"
									on:click={() => (editLabel = l)}
									class="px-2 py-0.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer {editLabel === l ? 'bg-sky-500/20 text-sky-600 dark:text-sky-400 font-semibold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}"
								>
									{l}
								</button>
							{/each}
						</div>
					</div>
					<input
						id="edit_account_label"
						type="text"
						bind:value={editLabel}
						placeholder="e.g. Personal, Work"
						on:keydown={(e) => e.key === "Enter" && saveAccountEdit()}
						class="w-full px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
					/>
				</div>

				{#if editingAccount.provider === "custom"}
					<div>
						<label for="edit_account_custom_url" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
							Webmail URL
						</label>
						<input
							id="edit_account_custom_url"
							type="url"
							bind:value={editCustomUrl}
							placeholder="https://webmail.example.com"
							on:keydown={(e) => e.key === "Enter" && saveAccountEdit()}
							class="w-full px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
						/>
					</div>
				{/if}

				<div>
					<label for="edit_account_password" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
						Password (Optional - for quick copy)
					</label>
					<input
						id="edit_account_password"
						type="password"
						bind:value={editPassword}
						placeholder="Leave blank to keep unchanged"
						on:keydown={(e) => e.key === "Enter" && saveAccountEdit()}
						class="w-full px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
					/>
				</div>
			</div>

			<div class="flex items-center justify-end gap-2 mt-6 pt-3 border-t border-slate-200/80 dark:border-slate-800">
				<button
					type="button"
					on:click={closeEditModal}
					class="py-2 px-4 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
				>
					Cancel
				</button>
				<button
					type="button"
					on:click={saveAccountEdit}
					class="py-2 px-4 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md cursor-pointer"
				>
					Save Changes
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Manual Confirm Email Modal -->
{#if showManualConfirmModal}
	<div
		role="presentation"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-150"
		on:click|self={closeManualConfirmModal}
		on:keydown|self={(e) => e.key === "Escape" && closeManualConfirmModal()}
		tabindex="-1"
	>
		<div
			role="dialog"
			aria-modal="true"
			class="relative w-full max-w-sm rounded-3xl p-6 shadow-2xl border text-left bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl text-slate-900 dark:text-white border-slate-200/90 dark:border-slate-700/80 select-none"
		>
			<h2 class="text-lg font-bold text-slate-900 dark:text-white mb-1">{language.mail?.confirmEmailTitle || "Confirm Logged-in Email"}</h2>
			<p class="text-xs text-slate-500 dark:text-slate-400 mb-4">{language.mail?.confirmEmailSubtitle || "Please enter your email address to save it to your accounts list"}</p>
			<input
				type="email"
				bind:value={manualEmailInput}
				placeholder={language.mail?.emailPlaceholder || "e.g. user@gmail.com"}
				class="w-full px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm mb-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
			/>
			<div class="flex items-center justify-end gap-2">
				<button
					type="button"
					on:click={closeManualConfirmModal}
					class="py-2 px-4 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
				>
					{language.common?.cancel || "Cancel"}
				</button>
				<button
					type="button"
					on:click={submitManualLogin}
					class="py-2 px-4 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md cursor-pointer"
				>
					{language.mail?.saveAccount || "Save Account"}
				</button>
			</div>
		</div>
	</div>
{/if}
