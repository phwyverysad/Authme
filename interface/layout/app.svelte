<div class="flex h-full w-full overflow-hidden select-none bg-inherit">
	{#if $state.authenticated}
		<div class="h-full flex-shrink-0">
			<Navigation />
		</div>
	{/if}

	<div class="w-full h-full overflow-hidden overflow-y-auto bg-inherit">
		{#if $state.updateAvailable}
			<UpdateAlert />
		{/if}

		<Banners />

		<div class="top" />

		{#if $state.authenticated}
			<!-- Persistent Codes & Mail views to keep webmail loaded without flashing and prevent 2FA reload lag -->
			<div class="h-full w-full" class:hidden={$router.path !== "/codes" && $router.path !== "/idle"}>
				<Codes />
			</div>

			<div class="h-full w-full" class:bg-white={$router.path === "/mail" && $mailViewActive} class:hidden={$router.path !== "/mail"}>
				<Mail />
			</div>
		{/if}

		<div class="h-full w-full" class:hidden={$router.path === "/codes" || $router.path === "/idle" || $router.path === "/mail"}>
			<RouteTransition>
				<Route path="/"><Landing /></Route>
				<Route path="/index.html"><Landing /></Route>
				<Route path="/confirm"><Confirm /></Route>

				<Route path="/codes"><span class="hidden" /></Route>
				<Route path="/mail"><span class="hidden" /></Route>
				<Route path="/import"><Import /></Route>
				<Route path="/export"><Export /></Route>
				<Route path="/edit"><Edit /></Route>
				<Route path="/settings"><Settings /></Route>

				<Route path="/idle"><span class="hidden" /></Route>
				<Route fallback><Landing /></Route>
			</RouteTransition>
		</div>
	</div>

	<InAppDialogs />
</div>

<script lang="ts">
	import { Route, router } from "@baileyherbert/tinro"
	import { onMount } from "svelte"
	import { state, getState, setState } from "../stores/state"
	import { number, version } from "../../build.json"
	import logger from "interface/utils/logger"

	import UpdateAlert from "../components/updateAlert.svelte"
	import RouteTransition from "../components/routeTransition.svelte"

	import Landing from "../windows/landing/landing.svelte"
	import Codes from "../windows/codes/codes.svelte"
	import Settings from "../windows/settings/settings.svelte"
	import Import from "../windows/import/import.svelte"
	import Export from "../windows/export/export.svelte"
	import Confirm from "../windows/confirm/confirm.svelte"
	import Navigation from "../components/navigation.svelte"
	import Edit from "../windows/edit/edit.svelte"
	import Mail from "../windows/mail/mail.svelte"
	import Banners from "@components/banners.svelte"
	import { invoke } from "@tauri-apps/api/core"
	import InAppDialogs from "../components/inAppDialogs.svelte"
	import { getSettings } from "../stores/settings"
	import { setEncryptionKey } from "interface/utils/encryption"
	import { closeMailView, setMailViewVisible, preloadMailView, mailViewActive, initMailStore } from "../stores/mail"
	import { get } from "svelte/store"
	import { flushClipboardNow } from "../utils/clipboardGuard"

	// Auto-lock privacy guard: hide mail webview and clear clipboard if app is locked or logged out; preload mail on login
	let prevAuthenticated = false
	state.subscribe((s) => {
		if (!s.authenticated) {
			setMailViewVisible(false)
			flushClipboardNow()
			prevAuthenticated = false
		} else if (!prevAuthenticated) {
			prevAuthenticated = true
			initMailStore().catch(() => {})
		}
	})

	onMount(async () => {
		// Ensure backend encryption key is primed and route directly to /codes if user does not require master password
		const currentSettings = getSettings()
		if (currentSettings.security?.requireAuthentication === false) {
			await setEncryptionKey()
			const s = getState()
			if (!s.authenticated) {
				s.authenticated = true
				setState(s)
			}
			if ($router.path === "/" || $router.path === "/index.html") {
				router.goto("/codes")
			}
		} else if (currentSettings.security?.password) {
			if ($router.path === "/" || $router.path === "/index.html") {
				router.goto("/confirm")
			}
		} else {
			if (typeof location !== "undefined" && (location.pathname.endsWith("index.html") || location.pathname === "")) {
				router.goto("/")
			}
		}

		// Debug info
		logger.log(`Authme ${version} ${number}`)

		// Listen for router events
		router.subscribe((data) => {
			logger.log(`Path changed: ${data.path}`)

			if (data.path !== "/mail") {
				setMailViewVisible(false)
			} else {
				if (get(mailViewActive)) {
					setMailViewVisible(true).catch(() => {})
				}
			}

			document.querySelector(".top")?.scrollIntoView()
		})

		// Listen for errors
		window.addEventListener("unhandledrejection", (error) => {
			logger.error(`Unknown runtime error occurred: ${error.reason}`)
		})
	})
</script>
