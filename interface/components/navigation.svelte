<div class="transparent-900 flex h-full flex-col justify-between overflow-visible rounded-tr-xl shadow-2xl">
	<div class="flex flex-col">
		<a href="/codes" use:active data-active-class="selectedMenuButton" class="menuButton mt-3" title={language.codes?.importCodesButton ? `${language.codes.importCodesButton} (Codes)` : "2FA Codes"}>
			<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z" /><circle cx="16.5" cy="7.5" r=".5" fill="currentColor" /></svg>
		</a>

		<!-- Mail Hub Button -->
		<a
			href="/mail"
			use:active
			data-active-class="selectedMenuButton"
			class="menuButton relative"
			title={language.mail?.mailHub || "Mail Hub"}
			on:click={handleMailClick}
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<rect width="20" height="16" x="2" y="4" rx="2" />
				<path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
			</svg>
			{#if $pendingLogin}
				<span class="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-sky-400 ring-2 ring-slate-900 animate-pulse" title={language.mail?.pendingLoginSession || "Login session in progress"} />
			{:else if totalUnread > 0}
				<span class="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-slate-900 animate-pulse" />
			{/if}
		</a>

		<a href="/import" use:active data-active-class="selectedMenuButton" class="menuButton" title={language.import?.supportedTypes || "Import"}>
			<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4" /><polyline points="14 2 14 8 20 8" /><path d="M2 15h10" /><path d="m9 18 3-3-3-3" /></svg>
		</a>

		<a href="/export" use:active data-active-class="selectedMenuButton" class="menuButton" title={language.export?.exportCodes || "Export"}>
			<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4" /><polyline points="14 2 14 8 20 8" /><path d="M2 15h10" /><path d="m5 12-3 3 3 3" /></svg>
		</a>

		<a href="/edit" use:active data-active-class="selectedMenuButton" class="menuButton" title={language.edit?.editCodes || "Edit"}>
			<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
		</a>
	</div>

	<div class="flex flex-col">
		<!-- Lock App Button -->
		<button
			type="button"
			on:click={() => lockApp(true)}
			title={language.confirm?.locked || "Lock app (Ctrl+L)"}
			class="menuButton transition-transform duration-200 active:scale-90 hover:text-amber-500"
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
				<path d="M7 11V7a5 5 0 0 1 10 0v4" />
			</svg>
		</button>

		<button
			type="button"
			on:click={toggleTheme}
			title={$settings.settings.theme === 1 ? (language.settings?.darkTheme || "Dark") : (language.settings?.lightTheme || "Light")}
			class="menuButton transition-transform duration-200 active:scale-90"
		>
			{#if $settings.settings.theme === 1}
				<!-- Moon Icon for Light Mode -->
				<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
				</svg>
			{:else}
				<!-- Sun Icon for Dark Mode -->
				<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="4" />
					<path d="M12 2v2" />
					<path d="M12 20v2" />
					<path d="m4.93 4.93 1.41 1.41" />
					<path d="m17.66 17.66 1.41 1.41" />
					<path d="M2 12h2" />
					<path d="M20 12h2" />
					<path d="m6.34 17.66-1.41 1.41" />
					<path d="m19.07 4.93-1.41 1.41" />
				</svg>
			{/if}
		</button>

		<a href="/settings" use:active data-active-class="selectedMenuButton" class="menuButton" title={language.settings?.general || "Settings"}>
			<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
		</a>
	</div>
</div>

<script lang="ts">
	import { active, router } from "@baileyherbert/tinro"
	import { settings, toggleTheme } from "../stores/settings"
	import { lockApp } from "../utils/lockTimer"
	import { mailAccounts, activeMailAccount, pendingLogin, mailViewActive, exitMailViewToDashboard, cancelLoginSession, setMailViewVisible } from "../stores/mail"
	import { askModal } from "../stores/dialog"
	import { getLanguage, currentLanguage } from "@utils/language"

	let language = getLanguage()
	$: language = $currentLanguage || getLanguage()

	$: totalUnread = ($mailAccounts || []).reduce((sum, a) => sum + (a.unread_count || 0), 0)

	async function handleMailClick(e: MouseEvent) {
		if ($router.path === "/mail") {
			// If on /mail and in a login session, ask for confirmation first
			if ($pendingLogin) {
				e.preventDefault()
				e.stopPropagation()
				// Temporarily hide native child webview so the confirmation modal is clearly visible and clickable
				await setMailViewVisible(false)
				const confirmed = await askModal(
					language.mail?.confirmCancelLogin || "You are currently on the login page. Do you want to cancel login and return to the Mail Hub?",
					{
						title: language.mail?.cancelLoginTitle || "Cancel Login",
						kind: "warning",
						okLabel: language.common?.confirm || "Confirm",
						cancelLabel: language.common?.cancel || "Cancel",
					}
				)
				if (confirmed) {
					await cancelLoginSession()
					await exitMailViewToDashboard()
					router.goto("/mail")
				} else {
					// Restore native login webview if user cancelled
					await setMailViewVisible(true)
				}
				return
			}

			// If on /mail and viewing an inbox/webmail, return to Mail Hub dashboard
			if ($activeMailAccount || $mailViewActive) {
				e.preventDefault()
				e.stopPropagation()
				await exitMailViewToDashboard()
				router.goto("/mail")
				return
			}
		}
		// If clicking Mail from another page (e.g. /codes, /settings), allow normal navigation to /mail.
		// Never call exitMailViewToDashboard() so the active mail view or pending login session remains alive!
	}
</script>
