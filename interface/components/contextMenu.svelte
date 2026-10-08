<script lang="ts">
	import { activeContextMenu, activeEditModal, activeQrModal, askModal, showToast } from "../stores/dialog"
	import { fade, scale } from "svelte/transition"
	import { getLanguage, currentLanguage } from "@utils/language"
	import qrcode from "qrcode-generator"
	import { onMount, onDestroy } from "svelte"
	import * as clipboard from "@tauri-apps/plugin-clipboard-manager"
	import { cleanAccountName } from "../utils/icons"

	let language = getLanguage()
	$: language = $currentLanguage || getLanguage()

	let menuEl: HTMLDivElement
	let posX = 0
	let posY = 0
	let openedAt = 0

	$: if ($activeContextMenu) {
		openedAt = Date.now()
		const pad = 12
		const menuWidth = 220
		const menuHeight = 210
		const winW = typeof window !== "undefined" ? window.innerWidth : 1000
		const winH = typeof window !== "undefined" ? window.innerHeight : 700

		posX = Math.min($activeContextMenu.x, winW - menuWidth - pad)
		posY = Math.min($activeContextMenu.y, winH - menuHeight - pad)
		if (posX < pad) posX = pad
		if (posY < pad) posY = pad
	}

	const closeMenu = () => {
		activeContextMenu.set(null)
	}

	const handleOutside = (e: MouseEvent | PointerEvent) => {
		if (!$activeContextMenu) return
		// Don't close within 60ms to prevent the triggering pointerdown from immediately closing
		if (Date.now() - openedAt < 60) return
		if (menuEl && !menuEl.contains(e.target as Node)) {
			closeMenu()
		}
	}

	const handleCopy = () => {
		if (!$activeContextMenu) return
		const item = $activeContextMenu
		closeMenu()
		window.dispatchEvent(new CustomEvent("authme:copy-code", { detail: { index: item.index, token: item.token } }))
	}

	const handleCopyAccount = async () => {
		if (!$activeContextMenu) return
		const item = $activeContextMenu
		closeMenu()
		const clean = cleanAccountName(item.name, item.issuer)
		if (clean) {
			await clipboard.writeText(clean)
			showToast(`${language.codes?.copyAccountSuccess || "Account / Email copied to clipboard"}: ${clean}`, "success")
		}
	}

	const handleTogglePin = () => {
		if (!$activeContextMenu) return
		const item = $activeContextMenu
		closeMenu()
		window.dispatchEvent(new CustomEvent("authme:toggle-pin-code", { detail: { index: item.index } }))
	}

	const handleEdit = () => {
		if (!$activeContextMenu) return
		const item = $activeContextMenu
		closeMenu()
		activeEditModal.set({
			index: item.index,
			issuer: item.issuer,
			name: item.name,
			secret: item.secret,
		})
	}

	const handleDisplayQr = () => {
		if (!$activeContextMenu) return
		const item = $activeContextMenu
		closeMenu()

		try {
			const qr = qrcode(0, "M")
			const encodedIssuer = encodeURIComponent(item.issuer || "Authme")
			const encodedName = encodeURIComponent(item.name || "2FA")
			const uri = `otpauth://totp/${encodedIssuer}:${encodedName}?secret=${item.secret}&issuer=${encodedIssuer}`
			qr.addData(uri)
			qr.make()
			const qrDataUrl = qr.createDataURL(6, 4)

			activeQrModal.set({
				issuer: item.issuer,
				name: item.name,
				secret: item.secret,
				qrDataUrl,
			})
		} catch (e) {
			console.error("Failed to generate QR code:", e)
		}
	}

	const handleDelete = async () => {
		if (!$activeContextMenu) return
		const item = $activeContextMenu
		closeMenu()

		const confirmed = await askModal(
			`${language.edit?.dialog?.deleteCode || "Are you sure you want to delete this code?"}\n\n"${item.issuer}${item.name ? ` (${item.name})` : ""}"`,
			{
				title: language.common?.delete || "Delete",
				kind: "error",
				okLabel: language.common?.delete || "Delete",
				cancelLabel: language.common?.cancel || "Cancel",
			}
		)

		if (confirmed) {
			window.dispatchEvent(new CustomEvent("authme:delete-code", { detail: { index: item.index } }))
		}
	}

	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === "Escape" && $activeContextMenu) {
			closeMenu()
		}
	}

	const handleScrollCloseMenu = () => {
		if ($activeContextMenu) {
			closeMenu()
		}
	}

	onMount(() => {
		window.addEventListener("pointerdown", handleOutside, true)
		window.addEventListener("keydown", handleKeydown)
		window.addEventListener("scroll", handleScrollCloseMenu, true)
		window.addEventListener("wheel", handleScrollCloseMenu, { passive: true })
		window.addEventListener("touchmove", handleScrollCloseMenu, { passive: true })
	})

	onDestroy(() => {
		if (typeof window !== "undefined") {
			window.removeEventListener("pointerdown", handleOutside, true)
			window.removeEventListener("keydown", handleKeydown)
			window.removeEventListener("scroll", handleScrollCloseMenu, true)
			window.removeEventListener("wheel", handleScrollCloseMenu)
			window.removeEventListener("touchmove", handleScrollCloseMenu)
		}
	})
</script>

{#if $activeContextMenu}
	<!-- Custom Floating Context Menu (No blocking full-screen backdrop, allowing seamless right-clicks on other cards) -->
	<div
		bind:this={menuEl}
		in:scale={{ start: 0.95, duration: 150 }}
		out:fade={{ duration: 100 }}
		style="left: {posX}px; top: {posY}px;"
		class="fixed z-[99999] w-56 rounded-2xl p-1.5 shadow-2xl backdrop-blur-2xl border select-none
			bg-white/95 text-slate-800 border-slate-200/90 shadow-slate-900/10
			dark:bg-[#0f172a]/95 dark:text-slate-100 dark:border-slate-700/80 dark:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.7)] dark:ring-1 dark:ring-white/10"
	>
		<!-- Copy Action -->
		<button
			type="button"
			on:click={handleCopy}
			class="flex w-full items-center justify-between px-2.5 py-2 rounded-xl font-medium text-sm transition-all duration-150 group
				hover:bg-slate-100 dark:hover:bg-slate-800/90 hover:text-slate-900 dark:hover:text-white active:scale-[0.98]"
		>
			<div class="flex items-center gap-2.5">
				<div class="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100/90 dark:bg-slate-800/90 text-slate-400 group-hover:text-sky-500 dark:group-hover:text-sky-400 group-hover:bg-sky-50 dark:group-hover:bg-slate-700/80 transition-colors">
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
						<rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
						<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
					</svg>
				</div>
				<span class="text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white">{language.common?.copy || "Copy"}</span>
			</div>
			<span class="text-[11px] font-mono text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300">Ctrl+C</span>
		</button>

		<!-- Copy Account / Email Action -->
		{#if $activeContextMenu.name}
			<button
				type="button"
				on:click={handleCopyAccount}
				class="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-xl font-medium text-sm transition-all duration-150 group
					hover:bg-slate-100 dark:hover:bg-slate-800/90 hover:text-slate-900 dark:hover:text-white active:scale-[0.98]"
			>
				<div class="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100/90 dark:bg-slate-800/90 text-slate-400 group-hover:text-sky-500 dark:group-hover:text-sky-400 group-hover:bg-sky-50 dark:group-hover:bg-slate-700/80 transition-colors">
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
						<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
						<circle cx="12" cy="7" r="4" />
					</svg>
				</div>
				<span class="text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white truncate">
					{language.codes?.copyAccount || "Copy Account / Email"}
				</span>
			</button>
		{/if}

		<!-- Edit Action -->
		<button
			type="button"
			on:click={handleEdit}
			class="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-xl font-medium text-sm transition-all duration-150 group
				hover:bg-slate-100 dark:hover:bg-slate-800/90 hover:text-slate-900 dark:hover:text-white active:scale-[0.98]"
		>
			<div class="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100/90 dark:bg-slate-800/90 text-slate-400 group-hover:text-sky-500 dark:group-hover:text-sky-400 group-hover:bg-sky-50 dark:group-hover:bg-slate-700/80 transition-colors">
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
					<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
					<path d="m15 5 4 4" />
				</svg>
			</div>
			<span class="text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white">{language.common?.edit || "Edit"}</span>
		</button>

		<!-- Display QR Action -->
		<button
			type="button"
			on:click={handleDisplayQr}
			class="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-xl font-medium text-sm transition-all duration-150 group
				hover:bg-slate-100 dark:hover:bg-slate-800/90 hover:text-slate-900 dark:hover:text-white active:scale-[0.98]"
		>
			<div class="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100/90 dark:bg-slate-800/90 text-slate-400 group-hover:text-sky-500 dark:group-hover:text-sky-400 group-hover:bg-sky-50 dark:group-hover:bg-slate-700/80 transition-colors">
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
					<rect x="3" y="3" width="7" height="7" rx="1" />
					<rect x="14" y="3" width="7" height="7" rx="1" />
					<rect x="14" y="14" width="7" height="7" rx="1" />
					<rect x="3" y="14" width="7" height="7" rx="1" />
				</svg>
			</div>
			<span class="text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white">{language.codes?.displayQr || "Display QR code"}</span>
		</button>

		<!-- Toggle Pin / Star Action -->
		<button
			type="button"
			on:click={handleTogglePin}
			class="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-xl font-medium text-sm transition-all duration-150 group
				hover:bg-slate-100 dark:hover:bg-slate-800/90 hover:text-slate-900 dark:hover:text-white active:scale-[0.98]"
		>
			<div class="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100/90 dark:bg-slate-800/90 text-slate-400 group-hover:text-amber-500 dark:group-hover:text-amber-400 group-hover:bg-amber-50 dark:group-hover:bg-slate-700/80 transition-colors">
				{#if $activeContextMenu.pinned}
					<svg class="w-4 h-4 text-amber-500 fill-amber-500" viewBox="0 0 24 24">
						<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
					</svg>
				{:else}
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
						<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
					</svg>
				{/if}
			</div>
			<span class="text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white">
				{$activeContextMenu.pinned ? (language.codes?.unpin || "Unpin from top") : (language.codes?.pinToTop || "Pin to top")}
			</span>
		</button>

		<div class="h-px bg-slate-200/90 dark:bg-slate-700/70 my-1 mx-1.5" />

		<!-- Delete Action -->
		<button
			type="button"
			on:click={handleDelete}
			class="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-xl font-medium text-sm transition-all duration-150 group
				hover:bg-rose-500/10 dark:hover:bg-rose-500/15 active:scale-[0.98]"
		>
			<div class="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100/90 dark:bg-slate-800/90 text-slate-400 group-hover:text-rose-500 dark:group-hover:text-rose-400 group-hover:bg-rose-50 dark:group-hover:bg-rose-950/40 transition-colors">
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
					<path d="M3 6h18" />
					<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
					<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
				</svg>
			</div>
			<span class="text-slate-700 dark:text-slate-200 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">{language.common?.delete || "Delete"}</span>
		</button>
	</div>
{/if}
