<div class="transparent-900 mx-auto my-6 sm:my-10 md:my-14 w-[96%] sm:w-[94%] md:w-[92%] lg:w-[90%] xl:w-4/5 max-w-7xl rounded-2xl p-4 sm:p-6 md:p-8 lg:p-10 text-left">
	<h1 class="px-2 sm:px-4 md:px-6">{language.settings.general}</h1>

	<div class="mx-auto flex flex-col items-center justify-center rounded-2xl p-2 sm:p-4 md:p-6">
		<div class="transparent-800 mb-4 flex w-full flex-row items-center justify-between rounded-xl p-4 sm:p-5 text-left">
			<div>
				<h2>{language.settings.launchOnStartup}</h2>
				<h3>{language.settings.launchOnStartupText}</h3>
			</div>
			<div class="ml-4 sm:ml-8 md:ml-12 flex-shrink-0 flex gap-3">
				<Toggle bind:checked={$settings.settings.launchOnStartup} on:change={(e) => setLaunchOnStartup(e.detail)} />
			</div>
		</div>

		<div class="transparent-800 mb-4 flex w-full flex-row items-center justify-between rounded-xl p-4 sm:p-5 text-left">
			<div>
				<h2>{language.settings.minimizeToTray}</h2>
				<h3>{language.settings.minimizeToTrayText}</h3>
			</div>
			<div class="ml-4 sm:ml-8 md:ml-12 flex-shrink-0 flex gap-3">
				<Toggle bind:checked={$settings.settings.minimizeToTray} on:change={(e) => setMinimizeToTray(e.detail)} />
			</div>
		</div>

		<div class="transparent-800 mb-4 flex w-full flex-row items-center justify-between rounded-xl p-4 sm:p-5 text-left">
			<div>
				<h2>{language.settings.optionalAnalytics}</h2>
				<h3>{language.settings.optionalAnalyticsText}</h3>
			</div>
			<div class="ml-4 sm:ml-8 md:ml-12 flex-shrink-0 flex gap-3">
				<Toggle bind:checked={$settings.settings.optionalAnalytics} />
			</div>
		</div>

		<div class="transparent-800 mb-4 flex w-full flex-row items-center justify-between rounded-xl p-4 sm:p-5 text-left">
			<div>
				<h2>{language.settings.windowCapture}</h2>
				<h3>{language.settings.windowCaptureText}</h3>
			</div>
			<div class="ml-4 sm:ml-8 md:ml-12 flex-shrink-0 flex gap-3">
				<Toggle bind:checked={$settings.settings.windowCapture} on:change={(e) => setWindowCapture(e.detail)} />
			</div>
		</div>

		<div class="transparent-800 mb-4 flex w-full flex-row items-center justify-between rounded-xl p-4 sm:p-5 text-left relative focus-within:z-30">
			<div>
				<h2>{language.settings.language}</h2>
				<h3>{language.settings.languageText}</h3>
			</div>
			<div class="ml-4 sm:ml-8 md:ml-12 flex-shrink-0 flex gap-3">
				<Select options={["Default", "English", "Hungarian", "Spanish", "French", "Russian", "German", "Chinese", "Polish", "Japanese", "Arabic", "Thai"]} setting={"language"} />
			</div>
		</div>

		<div class="transparent-800 mb-4 flex w-full flex-row items-center justify-between rounded-xl p-4 sm:p-5 text-left relative focus-within:z-30">
			<div>
				<h2>{language.settings.theme || "Theme"}</h2>
				<h3>{language.settings.themeText || "Change application appearance (Dark / Light mode)."}</h3>
			</div>
			<div class="ml-4 sm:ml-8 md:ml-12 flex-shrink-0 flex gap-3">
				<Select options={[language.settings.darkTheme || "Dark", language.settings.lightTheme || "Light"]} setting={"theme"} />
			</div>
		</div>

		<div class="transparent-800 mb-4 flex w-full flex-row items-center justify-between rounded-xl p-4 sm:p-5 text-left relative focus-within:z-30">
			<div>
				<h2>{language.settings.appScale || "App scale"}</h2>
				<h3>{language.settings.appScaleText || "Adjust application display scaling (Small, Medium, Large)."}</h3>
			</div>
			<div class="ml-4 sm:ml-8 md:ml-12 flex-shrink-0 flex gap-3">
				<Select options={[language.settings.appScaleSmall || "Small (90%)", language.settings.appScaleMedium || "Medium (100%)", language.settings.appScaleLarge || "Large (115%)"]} setting={"appScale"} />
			</div>
		</div>

		<div class="transparent-800 mb-4 flex w-full flex-row items-center justify-between rounded-xl p-4 sm:p-5 text-left">
			<div>
				<h2>{language.settings.rememberWindowPosition || "Remember window position"}</h2>
				<h3>{language.settings.rememberWindowPositionText || "Restore the last window size and position upon starting Authme."}</h3>
			</div>
			<div class="ml-4 sm:ml-8 md:ml-12 flex-shrink-0 flex gap-3">
				<Toggle bind:checked={$settings.settings.rememberWindowPosition} on:change={(e) => setRememberWindowPosition(e.detail)} />
			</div>
		</div>

		<div class="transparent-800 mb-4 flex w-full flex-row items-center justify-between rounded-xl p-4 sm:p-5 text-left">
			<div>
				<h2>{language.settings.clearData}</h2>
				<h3>{language.settings.clearDataText}</h3>
			</div>
			<div class="ml-4 sm:ml-8 md:ml-12 flex-shrink-0 flex flex-col items-end gap-3">
				<button class="button" on:click={showClearDataDialog}>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
					{language.settings.clearDataButton}
				</button>
			</div>
		</div>
	</div>
</div>

<div class="transparent-900 mx-auto my-6 sm:my-10 md:my-14 w-[96%] sm:w-[94%] md:w-[92%] lg:w-[90%] xl:w-4/5 max-w-7xl rounded-2xl p-4 sm:p-6 md:p-8 lg:p-10 text-left">
	<h1 class="px-2 sm:px-4 md:px-6">{language.settings.codes}</h1>

	<div class="mx-auto flex flex-col items-center justify-center rounded-2xl p-2 sm:p-4 md:p-6">
		<div class="transparent-800 mb-4 flex w-full flex-row items-center justify-between rounded-xl p-4 sm:p-5 text-left">
			<div>
				<h2>{language.settings.codesDescription}</h2>
				<h3>{language.settings.codesDescriptionText}</h3>
			</div>
			<div class="ml-4 sm:ml-8 md:ml-12 flex-shrink-0 flex gap-3">
				<Toggle bind:checked={$settings.settings.codesDescription} />
			</div>
		</div>

		<div class="transparent-800 mb-4 flex w-full flex-row items-center justify-between rounded-xl p-4 sm:p-5 text-left relative focus-within:z-30">
			<div>
				<h2>{language.settings.sortCodes}</h2>
				<h3>{language.settings.sortCodesText}</h3>
			</div>
			<div class="ml-4 sm:ml-8 md:ml-12 flex-shrink-0 flex gap-3">
				<Select options={["Default", "A-Z", "Z-A"]} setting={"sortCodes"} />
			</div>
		</div>
	</div>
</div>

<div class="transparent-900 mx-auto my-6 sm:my-10 md:my-14 w-[96%] sm:w-[94%] md:w-[92%] lg:w-[90%] xl:w-4/5 max-w-7xl rounded-2xl p-4 sm:p-6 md:p-8 lg:p-10 text-left">
	<h1 class="px-2 sm:px-4 md:px-6">{language.settings.security || "Security"}</h1>

	<div class="mx-auto flex flex-col items-center justify-center rounded-2xl p-2 sm:p-4 md:p-6">
		<!-- Lock Timer -->
		<div class="transparent-800 mb-4 flex w-full flex-row items-center justify-between rounded-xl p-4 sm:p-5 text-left relative focus-within:z-30">
			<div>
				<h2>{language.settings.lockTimer || "Lock timer"}</h2>
				<h3>{language.settings.lockTimerText || "Automatically lock Authme after inactivity or when minimized."}</h3>
			</div>
			<div class="ml-4 sm:ml-8 md:ml-12 flex-shrink-0 flex gap-3">
				<Select options={["Never", "30 seconds", "1 minute", "5 minutes", "10 minutes", "30 minutes", "1 hour"]} setting={"lockTimer"} />
			</div>
		</div>

		<!-- Clear Clipboard Timer -->
		<div class="transparent-800 mb-4 flex w-full flex-row items-center justify-between rounded-xl p-4 sm:p-5 text-left relative focus-within:z-30">
			<div>
				<h2>{language.settings.clearClipboard || "Clear clipboard"}</h2>
				<h3>{language.settings.clearClipboardText || "Automatically clear copied 2FA code from clipboard."}</h3>
			</div>
			<div class="ml-4 sm:ml-8 md:ml-12 flex-shrink-0 flex gap-3">
				<Select options={["Never", "10 seconds", "20 seconds", "30 seconds", "1 minute"]} setting={"clearClipboard"} />
			</div>
		</div>

		<!-- Require Password on App Startup Toggle -->
		<div class="transparent-800 mb-4 flex w-full flex-row items-center justify-between rounded-xl p-4 sm:p-5 text-left">
			<div>
				<h2>{language.settings.requirePassword || "Require password on startup"}</h2>
				<h3>{language.settings.requirePasswordText || "Require entering master password to unlock before accessing Authme"}</h3>
			</div>
			<div class="ml-4 sm:ml-8 md:ml-12 flex-shrink-0 flex gap-3">
				<Toggle controlled checked={$settings.security?.requireAuthentication === true} on:click={handleTogglePasswordRequirement} />
			</div>
		</div>

		<!-- Master Password Change (only when password is enabled) -->
		{#if $settings.security?.requireAuthentication === true}
			<div class="transparent-800 mb-4 flex w-full flex-row items-center justify-between rounded-xl p-4 sm:p-5 text-left">
				<div>
					<h2>{language.settings.passwordTitle || "Master password"}</h2>
					<h3>{language.settings.passwordSubtitle || "Change the master password protecting your 2FA vault."}</h3>
				</div>
				<div class="ml-4 sm:ml-8 md:ml-12 flex-shrink-0 flex gap-3">
					<button class="button" on:click={() => activePasswordModal.set(true)}>
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
							<path d="M7 11V7a5 5 0 0 1 10 0v4"/>
						</svg>
						{language.settings.changePasswordButton || "Change"}
					</button>
				</div>
			</div>
		{/if}

		<!-- Reset App (Danger Zone) -->
		<div class="transparent-800 mb-4 flex w-full flex-row items-center justify-between rounded-xl p-4 sm:p-5 text-left border border-rose-500/20">
			<div>
				<h2 class="text-rose-500 font-bold">{language.settings.resetApp || "Reset app"}</h2>
				<h3>{language.settings.resetAppText || "Erase all 2FA accounts and settings to start fresh."}</h3>
			</div>
			<div class="ml-4 sm:ml-8 md:ml-12 flex-shrink-0 flex gap-3">
				<button
					class="button bg-rose-600/20 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-500/30 transition-all active:scale-95"
					on:click={() => activeResetModal.set(true)}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
						<line x1="12" y1="9" x2="12" y2="13" />
						<line x1="12" y1="17" x2="12.01" y2="17" />
					</svg>
					{language.settings.resetAppButton || "Reset"}
				</button>
			</div>
		</div>
	</div>
</div>

<div class="transparent-900 mx-auto my-6 sm:my-10 md:my-14 w-[96%] sm:w-[94%] md:w-[92%] lg:w-[90%] xl:w-4/5 max-w-7xl rounded-2xl p-4 sm:p-6 md:p-8 lg:p-10 text-left">
	<h1 class="px-2 sm:px-4 md:px-6">{language.settings.about}</h1>

	<div class="mx-auto flex flex-col items-center justify-center rounded-2xl p-2 sm:p-4 md:p-6">
		<div class="transparent-800 mb-4 flex w-full flex-row items-center justify-between rounded-xl p-4 sm:p-5 text-left">
			<div>
				<h2>{language.settings.feedback}</h2>
				<h3>{language.settings.feedbackText}</h3>
			</div>
			<div class="ml-4 sm:ml-8 md:ml-12 flex-shrink-0 flex gap-3">
				<button
					class="button"
					on:click={() => {
						open("https://github.com/phwyverysad/Authme/issues")
					}}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>
					GitHub
				</button>
			</div>
		</div>
		<div class="transparent-800 mb-4 flex w-full flex-row items-center justify-between rounded-xl p-4 sm:p-5 text-left">
			<div>
				<h2>{language.settings.logs}</h2>
				<h3>{language.settings.logsText}</h3>
			</div>
			<div class="ml-4 sm:ml-8 md:ml-12 flex-shrink-0 flex gap-3">
				<button class="button" on:click={showLogs}>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" /></svg>
					{language.settings.showLogsButton}
				</button>
			</div>
		</div>

		<div class="transparent-800 mb-4 flex w-full flex-row items-center justify-between rounded-xl p-4 sm:p-5 text-left">
			<div>
				<h2>{language.settings.aboutAuthme}</h2>
				<h3>{language.settings.aboutAuthmeText}</h3>
			</div>
			<div class="ml-4 sm:ml-8 md:ml-12 flex-shrink-0 flex gap-3">
				<button
					class="button"
					on:click={() => {
						open("https://github.com/phwyverysad/Authme")
					}}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>
					GitHub
				</button>
				<button class="button" on:click={about}>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
					{language.settings.aboutAuthme}
				</button>
			</div>
		</div>
	</div>
</div>

<dialog class="dialog dialogClearData">
	<h2>{language.settings.clearData}</h2>
	<h3>{language.settings.clearDataText}</h3>

	<div class="transparent-800 mt-5 flex flex-row items-center justify-between rounded-xl p-5">
		<div>
			<h3>2FA Codes</h3>
		</div>
		<div class="ml-20 flex gap-3">
			<Toggle showLabel={false} bind:checked={clearCodesOption} />
		</div>
	</div>

	<div class="transparent-800 mt-5 flex flex-row items-center justify-between rounded-xl p-5">
		<div>
			<h3>Other Settings</h3>
		</div>
		<div class="ml-20 flex gap-3">
			<Toggle showLabel={false} bind:checked={clearSettingsOption} />
		</div>
	</div>

	<div class="mt-10 flex space-x-5">
		<button class="button dialogClearDataClose">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			{language.common.cancel}
		</button>
		<button class="button" on:click={() => clearData(clearCodesOption, clearSettingsOption)}>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			{language.common.confirm}
		</button>
	</div>
</dialog>

<script lang="ts">
	import Select from "../../components/select.svelte"
	import Toggle from "../../components/toggle.svelte"
	import {
		about,
		clearData,
		showClearDataDialog,
		showLogs,
		setLaunchOnStartup,
		setMinimizeToTray,
		setRememberWindowPosition,
		setWindowCapture,
	} from "./index"
	import { settings } from "../../stores/settings"
	import {
		activePasswordModal,
		activeDisablePasswordModal,
		activeEnablePasswordModal,
		activeResetModal,
	} from "../../stores/dialog"
	import { open } from "../../utils/navigate"
	import { getLanguage, currentLanguage } from "@utils/language"

	let language = getLanguage()
	$: language = $currentLanguage || getLanguage()

	$: clearCodesOption = true
	$: clearSettingsOption = true

	const handleTogglePasswordRequirement = () => {
		const isCurrentlyRequired = $settings.security?.requireAuthentication === true
		if (isCurrentlyRequired) {
			activeDisablePasswordModal.set(true)
		} else {
			activeEnablePasswordModal.set(true)
		}
	}
</script>
