<script lang="ts">
	import { toasts, activeModal, removeToast, showToast, pauseToast, resumeToast } from "../stores/dialog"
	import {
		activeEditModal,
		activeQrModal,
		activePasswordModal,
		activeDisablePasswordModal,
		activeEnablePasswordModal,
		activeResetModal,
		activeContextMenu,
	} from "../stores/dialog"
	import ContextMenu from "./contextMenu.svelte"
	import { fade, scale, fly } from "svelte/transition"

	if (typeof window !== "undefined") {
		;(window as any).__authme_dialogs = {
			activeContextMenu,
			activeEditModal,
			activeQrModal,
			activePasswordModal,
			activeDisablePasswordModal,
			activeEnablePasswordModal,
			activeResetModal,
		}
	}
	import { getSettings, setSettings } from "../stores/settings"
	import { navigate } from "../utils/navigate"
	import { decodeBase64, encodeBase64, encodeBytesToBase64 } from "../utils/convert"
	import {
		decryptData,
		encryptData,
		sendEncryptionKey,
		deleteEncryptionKey,
		generateRandomKey,
		setEntry,
		setEncryptionKey,
	} from "../utils/encryption"
	import { search as checkCommonPassword } from "../utils/password"
	import { invoke } from "@tauri-apps/api/core"
	import * as clipboard from "@tauri-apps/plugin-clipboard-manager"
	import * as process from "@tauri-apps/plugin-process"
	import * as fs from "@tauri-apps/plugin-fs"
	import * as dialog from "../utils/dialog"
	import build from "../../build.json"
	import { getLanguage, currentLanguage } from "@utils/language"
	import { getServiceIcon, fetchBrandIcon, cleanAccountName } from "../utils/icons"
	import { TOTP } from "otpauth"
	import { invalidateVaultCache } from "../windows/codes/index"
	import { loadMailAccounts, mailViewActive, setMailViewVisible } from "../stores/mail"
	import { router } from "@baileyherbert/tinro"

	let language = getLanguage()
	$: language = $currentLanguage || getLanguage()

	let anyModalActive = false
	$: anyModalActive = !!(
		$activeModal ||
		$activeEditModal ||
		$activeQrModal ||
		$activePasswordModal ||
		$activeDisablePasswordModal ||
		$activeEnablePasswordModal ||
		$activeResetModal
	)

	let wasMailVisibleBeforeModal = false
	$: if (anyModalActive) {
		if ($mailViewActive && !wasMailVisibleBeforeModal) {
			wasMailVisibleBeforeModal = true
			setMailViewVisible(false).catch(() => {})
		}
	} else if (wasMailVisibleBeforeModal) {
		wasMailVisibleBeforeModal = false
		if ($mailViewActive && $router.path === "/mail") {
			setMailViewVisible(true).catch(() => {})
		}
	}

	interface ParsedToastInfo {
		isStructured: boolean
		badge?: string
		title?: string
		code?: string
	}

	const parseToast = (toast: { message: string; title?: string; code?: string }): ParsedToastInfo => {
		if (toast.code) {
			return {
				isStructured: true,
				badge: language.common?.copied || "Copied",
				title: toast.title || toast.message,
				code: toast.code,
			}
		}

		const msg = toast.message || ""

		// Match: "Copied: Discord (123 456)"
		const copyWithCode = msg.match(/^([^:]+):\s*(.*?)\s*\(([0-9\s]{6,9})\)$/)
		if (copyWithCode) {
			return {
				isStructured: true,
				badge: copyWithCode[1].trim(),
				title: copyWithCode[2].trim(),
				code: copyWithCode[3].trim(),
			}
		}

		// Match: "2FA code copied successfully: 123 456"
		const simpleCode = msg.match(/^([^:]+):\s*([0-9]{3}\s*[0-9]{3,4})$/)
		if (simpleCode) {
			return {
				isStructured: true,
				badge: simpleCode[1].trim(),
				code: simpleCode[2].trim(),
			}
		}

		// Match: "Email copied: user@gmail.com" or "Copied: Secret key"
		const copyKeywords = [
			language.common?.copied,
			language.codes?.copyAccountSuccess,
			language.codes?.copySecret,
			language.mail?.toastCopied2FA,
			"Copied",
			"Email copied",
			"Password copied",
		].filter(Boolean) as string[]
		const escapedKeywords = copyKeywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
		const simpleCopy = escapedKeywords ? msg.match(new RegExp(`^(${escapedKeywords}):\\s*(.+)$`, "i")) : null
		if (simpleCopy) {
			return {
				isStructured: true,
				badge: simpleCopy[1].trim(),
				title: simpleCopy[2].trim(),
			}
		}

		return { isStructured: false }
	}

	// --- EDIT MODAL STATE ---
	let editIssuer = ""
	let editName = ""
	let editSecret = ""
	let showEditSecret = false
	let editError = ""
	let isSavingEdit = false
	let dynamicBrandLogoUrl = ""

	$: if ($activeEditModal) {
		editIssuer = $activeEditModal.issuer || ""
		editName = cleanAccountName($activeEditModal.name || "", editIssuer)
		editSecret = $activeEditModal.secret || ""
		showEditSecret = false
		editError = ""
		isSavingEdit = false
		dynamicBrandLogoUrl = ""
	}

	$: liveIcon = getServiceIcon(editIssuer, editName)

	$: {
		if (liveIcon.isMonogram && liveIcon.serviceKey) {
			const sKey = liveIcon.serviceKey
			fetchBrandIcon(sKey).then((url) => {
				if (liveIcon.serviceKey === sKey) {
					dynamicBrandLogoUrl = url || ""
				}
			})
		} else {
			dynamicBrandLogoUrl = ""
		}
	}

	const isValidSecret = (sec: string): boolean => {
		if (!sec || sec.trim() === "") return true
		if ($activeEditModal?.secret && sec === $activeEditModal.secret) return true
		const clean = sec.replace(/[\s-]+/g, "").toUpperCase()
		try {
			new TOTP({ secret: clean }).generate()
			return true
		} catch {
			return false
		}
	}

	$: isSecretValid = isValidSecret(editSecret)

	const copyEditSecret = async () => {
		if (!editSecret) return
		const clean = editSecret.replace(/[\s-]+/g, "").toUpperCase()
		await clipboard.writeText(clean)
		showToast(language.edit?.copySecretSuccess || "Secret key copied to clipboard", "success")
	}

	const selectIssuerSuggestion = (brand: string) => {
		editIssuer = brand
	}

	const saveEditModal = async () => {
		if (!$activeEditModal || isSavingEdit) return
		const idx = $activeEditModal.index
		const newIssuer = editIssuer.trim()
		const newName = cleanAccountName(editName.trim(), newIssuer)
		const newSecret = editSecret.replace(/[\s-]+/g, "").toUpperCase()

		if (newSecret && !isValidSecret(newSecret)) {
			editError = language.edit?.invalidSecret || "Secret key must be a valid Base32 string (A-Z, 2-7)"
			return
		}

		isSavingEdit = true
		editError = ""
		try {
			if (typeof (window as any).__authme_codes?.editCodeAtIndex === "function") {
				await (window as any).__authme_codes.editCodeAtIndex(idx, newIssuer, newName, newSecret)
			} else {
				window.dispatchEvent(
					new CustomEvent("authme:edit-code-save", {
						detail: { index: idx, issuer: newIssuer, name: newName, secret: newSecret },
					})
				)
			}
			activeEditModal.set(null)
		} catch (err) {
			console.error("Save edit error:", err)
			editError = language.dialogs?.saveError || "Failed to save data"
		} finally {
			isSavingEdit = false
		}
	}

	// --- QR MODAL STATE ---
	let showPlainSecret = false

	$: if ($activeQrModal) {
		showPlainSecret = false
	}

	const copySecret = async (secret: string) => {
		await clipboard.writeText(secret)
		showToast((language.common?.copied || "Copied") + ": " + (language.codes?.secretKey || "Secret key"), "success")
	}

	const copyUri = async (issuer: string, name: string, secret: string) => {
		const encodedIssuer = encodeURIComponent(issuer || "Authme")
		const encodedName = encodeURIComponent(name || "2FA")
		const uri = `otpauth://totp/${encodedIssuer}:${encodedName}?secret=${secret}&issuer=${encodedIssuer}`
		await clipboard.writeText(uri)
		showToast(language.common?.copied + ": URI", "success")
	}

	let isDownloadingQr = false

	const downloadQrCode = async (modal: { issuer?: string; name?: string; qrDataUrl: string } | null) => {
		if (!modal || !modal.qrDataUrl || isDownloadingQr) return
		isDownloadingQr = true

		try {
			const rawTitle = modal.issuer || modal.name || "authme_2fa"
			const safeTitle = rawTitle.replace(/[/\\?%*:|"<>]/g, "_").trim() || "2fa"
			const fileName = `${safeTitle}_qrcode.png`

			// Create a high-resolution canvas (600x600) for pristine scanning quality
			const img = new Image()
			await new Promise<void>((resolve, reject) => {
				img.onload = () => resolve()
				img.onerror = (e) => reject(e)
				img.src = modal.qrDataUrl
			})

			const canvas = document.createElement("canvas")
			const size = 600
			canvas.width = size
			canvas.height = size
			const ctx = canvas.getContext("2d")
			if (!ctx) throw new Error("Failed to create canvas context")

			// Clean solid white background
			ctx.fillStyle = "#ffffff"
			ctx.fillRect(0, 0, size, size)

			// Center QR code with clean margins
			const pad = 40
			ctx.imageSmoothingEnabled = false
			ctx.drawImage(img, pad, pad, size - pad * 2, size - pad * 2)

			const pngDataUrl = canvas.toDataURL("image/png")
			const base64Data = pngDataUrl.replace(/^data:image\/png;base64,/, "")
			const binaryString = atob(base64Data)
			const bytes = new Uint8Array(binaryString.length)
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i)
			}

			let saved = false
			try {
				const filePath = await dialog.save({
					defaultPath: fileName,
					filters: [{ name: "PNG Image (*.png)", extensions: ["png"] }],
				})
				if (filePath) {
					await fs.writeFile(filePath, bytes)
					saved = true
					showToast(
						`${language.codes?.downloadQrSuccess || "QR Code downloaded successfully"}: ${fileName}`,
						"success"
					)
				}
			} catch (dialogErr) {
				console.warn("dialog.save failed or unavailable, using browser download:", dialogErr)
			}

			// If native dialog didn't trigger or was in browser environment
			if (!saved) {
				const a = document.createElement("a")
				a.href = pngDataUrl
				a.download = fileName
				document.body.appendChild(a)
				a.click()
				document.body.removeChild(a)
				showToast(
					`${language.codes?.downloadQrSuccess || "QR Code downloaded successfully"}: ${fileName}`,
					"success"
				)
			}
		} catch (err) {
			console.error("Download QR code error:", err)
			showToast(language.dialogs?.downloadQrError || language.common?.error || "Failed to download QR code", "error")
		} finally {
			isDownloadingQr = false
		}
	}

	// --- PASSWORD MODAL STATE ---
	let currentPass = ""
	let newPass = ""
	let confirmPass = ""
	let showCurrentPass = false
	let showNewPass = false
	let showConfirmPass = false
	let passwordError = ""
	let isChangingPassword = false

	$: if ($activePasswordModal) {
		currentPass = ""
		newPass = ""
		confirmPass = ""
		showCurrentPass = false
		showNewPass = false
		showConfirmPass = false
		passwordError = ""
		isChangingPassword = false
	}

	// Calculate password strength: 0 = too short, 1 = weak, 2 = medium, 3 = strong, 4 = very strong
	$: passwordStrength = (() => {
		if (!newPass || newPass.length < 8) return 0
		let score = 1
		if (newPass.length >= 12) score++
		if (/[A-Z]/.test(newPass) && /[a-z]/.test(newPass)) score++
		if (/[0-9]/.test(newPass) && /[^A-Za-z0-9]/.test(newPass)) score++
		return Math.min(score, 4)
	})()

	const handleChangePassword = async () => {
		passwordError = ""
		if (!currentPass) {
			passwordError = language.dialogs?.enterCurrentPassword || "Please enter current password"
			return
		}
		if (newPass !== confirmPass) {
			passwordError = language.landing?.dialog?.passwordsNotMatch || "Passwords don't match. Please try again!"
			return
		}
		if (newPass.length < 8) {
			passwordError = language.landing?.dialog?.passwordMinLength || "Minimum password length is 8 characters."
			return
		}
		if (newPass.length > 64) {
			passwordError = language.landing?.dialog?.passwordMaxLength || "Maximum password length is 64 characters."
			return
		}
		if (checkCommonPassword(newPass)) {
			passwordError = language.landing?.dialog?.commonPassword || "This password is on the list of common passwords. Please choose a more secure password!"
			return
		}

		isChangingPassword = true
		try {
			const settings = getSettings()

			// 1. Verify current password
			if (settings.security?.password) {
				const isCorrect = await invoke("verify_password", {
					password: currentPass,
					hash: decodeBase64(settings.security.password),
				})
				if (!isCorrect) {
					passwordError = language.confirm?.dialog?.wrongPassword || "Wrong password! Please try again!"
					isChangingPassword = false
					return
				}
			}

			// 2. Decrypt existing vault if any
			let decryptedVaultText = ""
			if (settings.vault?.codes) {
				decryptedVaultText = await decryptData(settings.vault.codes)
				if (!decryptedVaultText || decryptedVaultText === "error") {
					passwordError = language.confirm?.dialog?.wrongPassword || "Failed to decrypt existing vault"
					isChangingPassword = false
					return
				}
			}

			// 3. Rekey mail account passwords to new key
			try {
				await invoke("rekey_mail_passwords", { oldKey: currentPass, newKey: newPass })
				await loadMailAccounts()
			} catch (e) {
				console.warn("Failed to rekey mail passwords:", e)
			}

			// 4. Rekey backend memory with new password
			await sendEncryptionKey(newPass)

			// 5. Re-encrypt vault with new key
			if (settings.vault?.codes) {
				if (!decryptedVaultText || decryptedVaultText === "error") {
					throw new Error("Failed to re-encrypt vault: decrypted vault text is invalid")
				}
				const newEncrypted = await encryptData(decryptedVaultText)
				if (!newEncrypted || newEncrypted === "error") {
					throw new Error("Failed to re-encrypt vault with new password")
				}
				settings.vault.codes = newEncrypted
			}

			// 6. Generate new Argon2 hash for the new password
			const newHash = await invoke("encrypt_password", { password: newPass })
			settings.security.password = encodeBase64(newHash as string)
			settings.security.requireAuthentication = true

			invalidateVaultCache()
			setSettings(settings)

			showToast(language.dialogs?.passwordChangedSuccess || "Master password changed successfully", "success")
			activePasswordModal.set(false)
		} catch (err: any) {
			console.error("Change password error:", err)
			passwordError = (language.dialogs?.passwordChangeError || "Failed to change password") + ": " + (err?.message || err)
		} finally {
			isChangingPassword = false
		}
	}

	// --- DISABLE PASSWORD MODAL STATE ---
	let disablePassInput = ""
	let showDisablePass = false
	let disablePassError = ""
	let isDisablingPassword = false

	$: if ($activeDisablePasswordModal) {
		disablePassInput = ""
		showDisablePass = false
		disablePassError = ""
		isDisablingPassword = false
	}

	const handleConfirmDisablePassword = async () => {
		disablePassError = ""
		if (!disablePassInput) {
			disablePassError = language.dialogs?.enterCurrentPassword || "Please enter current password"
			return
		}

		isDisablingPassword = true
		try {
			const curSettings = getSettings()
			// 1. Verify current password
			if (curSettings.security?.password) {
				const isCorrect = await invoke("verify_password", {
					password: disablePassInput,
					hash: decodeBase64(curSettings.security.password),
				})
				if (!isCorrect) {
					disablePassError = language.confirm?.dialog?.wrongPassword || "Wrong password! Please try again!"
					isDisablingPassword = false
					return
				}
			}

			// 2. Decrypt existing vault codes with current password
			let decryptedVault = ""
			if (curSettings.vault?.codes) {
				decryptedVault = await decryptData(curSettings.vault.codes)
				if (!decryptedVault || decryptedVault === "error") {
					disablePassError = language.confirm?.dialog?.wrongPassword || "Failed to decrypt vault with current password"
					isDisablingPassword = false
					return
				}
			}

			// 3. Generate random 32-byte key for system keychain
			const key = await generateRandomKey(32)
			const encodedKey = encodeBytesToBase64(key)
			await setEntry("encryptionKey", encodedKey)
			await setEncryptionKey()

			// Rekey mail account passwords to new keychain key
			try {
				await invoke("rekey_mail_passwords", { oldKey: disablePassInput, newKey: encodedKey })
				await loadMailAccounts()
			} catch (e) {
				console.warn("Failed to rekey mail passwords:", e)
			}

			// 4. Re-encrypt vault codes with the new keychain key
			if (curSettings.vault?.codes) {
				if (!decryptedVault || decryptedVault === "error") {
					throw new Error("Failed to re-encrypt vault: decrypted vault data is invalid")
				}
				const newEncrypted = await encryptData(decryptedVault)
				if (!newEncrypted || newEncrypted === "error") {
					throw new Error("Failed to re-encrypt vault with new key")
				}
				curSettings.vault.codes = newEncrypted
			}

			// 5. Update settings
			curSettings.security.requireAuthentication = false
			invalidateVaultCache()
			setSettings(curSettings)

			showToast(language.settings?.disablePasswordSuccess || "Password protection on startup disabled successfully", "success")
			activeDisablePasswordModal.set(false)
			disablePassInput = ""
		} catch (err: any) {
			console.error("Disable password error:", err)
			disablePassError = (language.common?.error || "Error") + ": " + (err?.message || err)
		} finally {
			isDisablingPassword = false
		}
	}

	// --- ENABLE PASSWORD MODAL STATE ---
	let enableNewPass = ""
	let enableConfirmPass = ""
	let showEnableNewPass = false
	let showEnableConfirmPass = false
	let enablePassError = ""
	let isEnablingPassword = false

	$: if ($activeEnablePasswordModal) {
		enableNewPass = ""
		enableConfirmPass = ""
		showEnableNewPass = false
		showEnableConfirmPass = false
		enablePassError = ""
		isEnablingPassword = false
	}

	$: enablePasswordStrength = (() => {
		if (!enableNewPass || enableNewPass.length < 8) return 0
		let score = 1
		if (enableNewPass.length >= 12) score++
		if (/[A-Z]/.test(enableNewPass) && /[a-z]/.test(enableNewPass)) score++
		if (/[0-9]/.test(enableNewPass) && /[^A-Za-z0-9]/.test(enableNewPass)) score++
		return Math.min(score, 4)
	})()

	const handleConfirmEnablePassword = async () => {
		enablePassError = ""
		if (!enableNewPass) {
			enablePassError = language.dialogs?.enterNewPassword || "Please enter new password"
			return
		}
		if (enableNewPass !== enableConfirmPass) {
			enablePassError = language.landing?.dialog?.passwordsNotMatch || "Passwords don't match. Please try again!"
			return
		}
		if (enableNewPass.length < 8) {
			enablePassError = language.landing?.dialog?.passwordMinLength || "Minimum password length is 8 characters."
			return
		}
		if (enableNewPass.length > 64) {
			enablePassError = language.landing?.dialog?.passwordMaxLength || "Maximum password length is 64 characters."
			return
		}
		if (checkCommonPassword(enableNewPass)) {
			enablePassError = language.landing?.dialog?.commonPassword || "This password is on the list of common passwords. Please choose a more secure password!"
			return
		}

		isEnablingPassword = true
		try {
			const curSettings = getSettings()

			// 1. Decrypt existing vault codes (currently encrypted with keychain key)
			let decryptedVault = ""
			if (curSettings.vault?.codes) {
				decryptedVault = await decryptData(curSettings.vault.codes)
				if (!decryptedVault || decryptedVault === "error") {
					throw new Error("Failed to decrypt current vault with keychain key")
				}
			}

			// Rekey mail account passwords to new master password
			try {
				let keychainKey = ""
				try {
					keychainKey = (await invoke<string>("get_entry", { name: "encryptionKey", service: "authme" })) || ""
				} catch {}
				if (!keychainKey || keychainKey === "error") {
					try {
						keychainKey = (await invoke<string>("get_entry", { name: "encryptionKey", service: "authme_dev" })) || ""
					} catch {}
				}
				await invoke("rekey_mail_passwords", { oldKey: keychainKey, newKey: enableNewPass })
				await loadMailAccounts()
			} catch (e) {
				console.warn("Failed to rekey mail passwords:", e)
			}

			// 2. Send new password to backend memory
			await sendEncryptionKey(enableNewPass)

			// 3. Re-encrypt vault codes with the new password
			if (curSettings.vault?.codes) {
				if (!decryptedVault || decryptedVault === "error") {
					throw new Error("Failed to encrypt vault: decrypted vault data is invalid")
				}
				const newEncrypted = await encryptData(decryptedVault)
				if (!newEncrypted || newEncrypted === "error") {
					throw new Error("Failed to encrypt vault with new password")
				}
				curSettings.vault.codes = newEncrypted
			}

			// 4. Generate Argon2 hash for new password
			const newHash = await invoke("encrypt_password", { password: enableNewPass })
			curSettings.security.password = encodeBase64(newHash as string)
			curSettings.security.requireAuthentication = true
			invalidateVaultCache()
			setSettings(curSettings)

			// 5. Clean up keychain key
			await deleteEncryptionKey("encryptionKey")

			showToast(language.settings?.enablePasswordSuccess || "Password protection on startup enabled successfully", "success")
			activeEnablePasswordModal.set(false)
			enableNewPass = ""
			enableConfirmPass = ""
		} catch (err: any) {
			console.error("Enable password error:", err)
			enablePassError = (language.common?.error || "Error") + ": " + (err?.message || err)
		} finally {
			isEnablingPassword = false
		}
	}

	// --- RESET MODAL STATE ---
	let resetConfirmText = ""
	let isResetting = false

	$: if ($activeResetModal) {
		resetConfirmText = ""
		isResetting = false
	}

	const handleResetApp = async () => {
		if (resetConfirmText.trim().toUpperCase() !== "RESET") return
		isResetting = true
		try {
			if (typeof localStorage !== "undefined") localStorage.clear()
			if (typeof sessionStorage !== "undefined") sessionStorage.clear()
			await deleteEncryptionKey("encryptionKey")

			activeResetModal.set(false)
			showToast(language.dialogs?.appResetSuccess || "App reset successfully", "info")

			if (build.dev === false) {
				try {
					await invoke("disable_auto_launch")
				} catch {}
				process.exit()
			} else {
				navigate("/")
				location.reload()
			}
		} catch (err) {
			console.error("Reset app error:", err)
			isResetting = false
		}
	}
</script>

<!-- Bottom-Right Toast Notifications Stack -->
<div class="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2.5 pointer-events-none px-4 sm:px-0 max-w-[92vw]">
	{#each $toasts as toast (toast.id)}
		{@const parsed = parseToast(toast)}
		<div
			role="status"
			in:fly={{ y: 16, duration: 220 }}
			out:fade={{ duration: 150 }}
			on:mouseenter={() => pauseToast(toast.id)}
			on:mouseleave={() => resumeToast(toast.id)}
			class="toast-card group pointer-events-auto relative flex items-center gap-2.5 py-2 px-3.5 rounded-2xl transition-all duration-200 select-none
				min-w-[200px] max-w-[440px] w-auto shadow-xl
				bg-white/95 text-slate-800 border border-slate-200/90 shadow-slate-900/10
				dark:bg-slate-900/95 dark:text-slate-100 dark:border-white/10 dark:shadow-[0_16px_36px_-6px_rgba(0,0,0,0.5)]
				backdrop-blur-xl hover:translate-y-[-1px]"
		>
			<!-- Status Icon -->
			<div class="flex-shrink-0">
				{#if toast.kind === "success"}
					<div class="w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-500 dark:text-emerald-400">
						<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="20 6 9 17 4 12" />
						</svg>
					</div>
				{:else if toast.kind === "warning"}
					<div class="w-6 h-6 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-500 dark:text-amber-400">
						<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
							<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
							<line x1="12" y1="9" x2="12" y2="13" />
							<line x1="12" y1="17" x2="12.01" y2="17" />
						</svg>
					</div>
				{:else if toast.kind === "error"}
					<div class="w-6 h-6 rounded-full bg-rose-500/15 flex items-center justify-center text-rose-500 dark:text-rose-400">
						<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</div>
				{:else}
					<div class="w-6 h-6 rounded-full bg-slate-500/15 flex items-center justify-center text-slate-600 dark:text-slate-300">
						<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="10" />
							<line x1="12" y1="16" x2="12" y2="12" />
							<line x1="12" y1="8" x2="12.01" y2="8" />
						</svg>
					</div>
				{/if}
			</div>

			<!-- Message Content -->
			<div class="flex-grow min-w-0 pr-0.5">
				{#if parsed.isStructured}
					<div class="flex items-center gap-2 min-w-0 flex-nowrap">
						{#if parsed.code}
							{#if parsed.title}
								<span class="text-[13px] font-semibold text-slate-900 dark:text-white truncate max-w-[140px] tracking-tight">
									{parsed.title}
								</span>
							{/if}
							<span class="font-mono text-xs font-semibold tracking-wider px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 flex-shrink-0">
								{parsed.code}
							</span>
							{#if parsed.badge}
								<span class="text-xs font-medium text-slate-400 dark:text-slate-400 flex-shrink-0">
									{parsed.badge}
								</span>
							{/if}
						{:else}
							{#if parsed.badge}
								<span class="text-xs font-medium text-slate-400 dark:text-slate-400 flex-shrink-0">
									{parsed.badge}:
								</span>
							{/if}
							{#if parsed.title}
								<span class="text-[13px] font-semibold text-slate-900 dark:text-white truncate max-w-[200px] tracking-tight">
									{parsed.title}
								</span>
							{/if}
						{/if}
					</div>
				{:else}
					<div class="min-w-0">
						{#if toast.title}
							<p class="font-semibold text-xs leading-tight mb-0.5 text-slate-900 dark:text-white truncate">{toast.title}</p>
						{/if}
						<p class="text-xs sm:text-sm font-medium leading-snug tracking-tight text-slate-700 dark:text-slate-200 break-words">{toast.message}</p>
					</div>
				{/if}
			</div>

			<!-- Close Button -->
			<button
				type="button"
				on:click={() => removeToast(toast.id)}
				class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
				title={language.common?.close || "Close"}
			>
				<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</div>
	{/each}
</div>

<!-- Center Confirmation Modal Dialog -->
{#if $activeModal}
	<div
		role="presentation"
		tabindex="-1"
		transition:fade={{ duration: 180 }}
		class="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
		on:click|self={() => $activeModal?.resolve(false)}
		on:keydown|self={(e) => e.key === "Escape" && $activeModal?.resolve(false)}
	>
		<div
			transition:scale={{ start: 0.92, duration: 200 }}
			class="relative w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl border transition-all text-center bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl text-slate-900 dark:text-white border-slate-200/90 dark:border-slate-700/80 dark:ring-1 dark:ring-white/10"
		>
			<!-- Icon Header -->
			<div class="mx-auto mb-4 flex items-center justify-center w-14 h-14 rounded-2xl shadow-inner
				{$activeModal.kind === 'error' ? 'bg-rose-500/15 text-rose-500' :
				$activeModal.kind === 'warning' ? 'bg-amber-500/15 text-amber-500' :
				'bg-blue-500/15 text-blue-500'}"
			>
				{#if $activeModal.kind === "error"}
					<svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10" />
						<line x1="15" y1="9" x2="9" y2="15" />
						<line x1="9" y1="9" x2="15" y2="15" />
					</svg>
				{:else if $activeModal.kind === "warning"}
					<svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
						<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
						<line x1="12" y1="9" x2="12" y2="13" />
						<line x1="12" y1="17" x2="12.01" y2="17" />
					</svg>
				{:else}
					<svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10" />
						<line x1="12" y1="16" x2="12" y2="12" />
						<line x1="12" y1="8" x2="12.01" y2="8" />
					</svg>
				{/if}
			</div>

			<!-- Title & Message -->
			<h3 class="text-xl font-bold mb-2 tracking-tight text-slate-900 dark:text-white">{$activeModal.title || "Authme"}</h3>
			<p class="text-base text-slate-600 dark:text-slate-300 mb-6 whitespace-pre-line leading-relaxed font-normal">
				{$activeModal.message}
			</p>

			<!-- Action Buttons -->
			<div class="flex items-center justify-center gap-3">
				<button
					type="button"
					on:click={() => $activeModal?.resolve(false)}
					class="w-1/2 py-3 px-5 rounded-xl font-medium border border-slate-300 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all text-slate-700 dark:text-slate-200 active:scale-95"
				>
					{$activeModal.cancelLabel || language.common?.no || "No"}
				</button>
				<button
					type="button"
					on:click={() => $activeModal?.resolve(true)}
					class="w-1/2 py-3 px-5 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all active:scale-95"
				>
					{$activeModal.okLabel || language.common?.yes || "Yes"}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Custom Context Menu for 2FA Cards -->
<ContextMenu />

<!-- In-App Modal: Edit 2FA Code -->
{#if $activeEditModal}
	<div
		role="presentation"
		tabindex="-1"
		transition:fade={{ duration: 160 }}
		class="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/65 backdrop-blur-md overflow-y-auto"
		on:click|self={() => activeEditModal.set(null)}
		on:keydown|self={(e) => e.key === "Escape" && activeEditModal.set(null)}
	>
		<div
			transition:scale={{ start: 0.94, duration: 200 }}
			class="relative w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl border text-left my-8 transition-all
				bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl text-slate-900 dark:text-white
				border-slate-200/90 dark:border-slate-700/80 dark:ring-1 dark:ring-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)]"
		>
			<!-- Top Header: Dynamic Brand Badge + Title + Close Button -->
			<div class="flex items-start justify-between mb-5">
				<div class="flex items-center gap-3.5 min-w-0">
					<!-- Real-time Brand Icon Badge -->
					<div
						class="w-[52px] h-[52px] min-w-[52px] rounded-2xl flex items-center justify-center overflow-hidden shadow-md select-none transition-all duration-300 ring-2 ring-white/10"
						style={liveIcon.bg}
					>
						{#if dynamicBrandLogoUrl}
							<img src={dynamicBrandLogoUrl} alt={editIssuer || "Brand"} class="w-8 h-8 object-contain drop-shadow" />
						{:else}
							<div class="w-full h-full flex items-center justify-center scale-105">
								{@html liveIcon.svg}
							</div>
						{/if}
					</div>

					<div class="min-w-0">
						<h3 class="text-xl font-bold leading-tight tracking-tight truncate text-slate-900 dark:text-white">
							{language.edit?.editModalTitle || "Edit 2FA Details"}
						</h3>
						<p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
							{language.edit?.editModalSubtitle || "Customize service name, account, and secret key"}
						</p>
					</div>
				</div>

				<button
					type="button"
					on:click={() => activeEditModal.set(null)}
					class="text-slate-400 hover:text-slate-700 dark:hover:text-white p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors -mr-1 -mt-1"
					title={language.common?.close || "Close"}
				>
					<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			<!-- Live Card Preview -->
			<div class="mb-5 rounded-2xl p-3.5 bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/60 backdrop-blur-sm">
				<div class="flex items-center justify-between mb-2">
					<span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
						<span class="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
						{language.edit?.livePreview || "Live Preview"}
					</span>
					<span class="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-200/80 dark:bg-slate-700/80 px-2 py-0.5 rounded-md">
						{language.edit?.livePreview || "2FA Preview"}
					</span>
				</div>

				<div class="flex items-center gap-3 bg-white/95 dark:bg-[#0b1120]/80 rounded-xl p-3 border border-slate-200/80 dark:border-slate-700/50 shadow-sm">
					<!-- Preview Icon -->
					<div
						class="w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm"
						style={liveIcon.bg}
					>
						{#if dynamicBrandLogoUrl}
							<img src={dynamicBrandLogoUrl} alt="" class="w-6 h-6 object-contain" />
						{:else}
							<div class="w-full h-full flex items-center justify-center scale-90">
								{@html liveIcon.svg}
							</div>
						{/if}
					</div>

					<!-- Preview Info -->
					<div class="min-w-0 flex-1 text-left">
						<p class="text-sm font-bold text-slate-900 dark:text-white truncate">
							{editIssuer.trim() || cleanAccountName(editName.trim(), editIssuer) || "2FA Service"}
						</p>
						{#if editIssuer.trim() && cleanAccountName(editName.trim(), editIssuer)}
							<p class="text-xs text-slate-500 dark:text-slate-400 truncate">
								{cleanAccountName(editName.trim(), editIssuer)}
							</p>
						{/if}
					</div>

					<!-- Preview Code Sample -->
					<div class="text-right flex-shrink-0">
						<span class="font-mono text-sm sm:text-base font-bold text-blue-600 dark:text-blue-400 tracking-wider">
							••• •••
						</span>
					</div>
				</div>
			</div>

			<!-- Edit Form -->
			<form on:submit|preventDefault={saveEditModal} class="space-y-4">
				{#if editError}
					<div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-medium flex items-center gap-2">
						<svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
						<span>{editError}</span>
					</div>
				{/if}

				<!-- Field 1: Service / Issuer -->
				<div>
					<div class="flex items-center justify-between mb-1.5">
						<label for="edit-issuer" class="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
							{language.edit?.serviceName || "Service / Issuer"}
						</label>
						{#if editIssuer}
							<button
								type="button"
								on:click={() => (editIssuer = "")}
								class="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
							>
								{language.dialogs?.clearText || language.common?.clear || "Clear"}
							</button>
						{/if}
					</div>

					<div class="relative">
						<div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect width="16" height="20" x="4" y="2" rx="2" ry="2"/>
								<path d="M9 22v-4h6v4"/>
								<path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/>
								<path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>
							</svg>
						</div>
						<input
							id="edit-issuer"
							type="text"
							bind:value={editIssuer}
							placeholder={language.edit?.serviceNamePlaceholder || "e.g. Google, GitHub, Discord, Vercel"}
							class="w-full pl-10 pr-4 py-2.5 rounded-xl border font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500
								bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
						/>
					</div>

					<!-- Quick Service Suggestion Chips -->
					<div class="flex flex-wrap items-center gap-1.5 mt-2">
						<span class="text-[11px] text-slate-400 dark:text-slate-500 mr-0.5">{language.dialogs?.suggested || "Suggested:"}</span>
						{#each ["Discord", "Google", "GitHub", "Microsoft", "Vercel", "Stripe", "Roblox", "Steam"] as brand}
							<button
								type="button"
								on:click={() => selectIssuerSuggestion(brand)}
								class="px-2 py-0.5 text-[11px] rounded-lg font-medium transition-all active:scale-95
									{editIssuer.toLowerCase() === brand.toLowerCase()
										? 'bg-blue-600 text-white shadow-sm'
										: 'bg-slate-200/60 dark:bg-slate-800/60 hover:bg-slate-300/80 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300'}"
							>
								{brand}
							</button>
						{/each}
					</div>
				</div>

				<!-- Field 2: Account / Email -->
				<div>
					<div class="flex items-center justify-between mb-1.5">
						<label for="edit-name" class="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
							{language.edit?.accountName || "Account / Email"}
						</label>
						{#if editName}
							<button
								type="button"
								on:click={() => (editName = "")}
								class="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
							>
								{language.dialogs?.clearText || language.common?.clear || "Clear"}
							</button>
						{/if}
					</div>

					<div class="relative">
						<div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
								<circle cx="12" cy="7" r="4"/>
							</svg>
						</div>
						<input
							id="edit-name"
							type="text"
							bind:value={editName}
							placeholder={language.edit?.accountNamePlaceholder || "e.g. user@example.com or @username"}
							class="w-full pl-10 pr-4 py-2.5 rounded-xl border font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500
								bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
						/>
					</div>
				</div>

				<!-- Field 3: Secret Key -->
				<div>
					<div class="flex items-center justify-between mb-1.5">
						<label for="edit-secret" class="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
							<span>{language.edit?.secretKey || "2FA Secret Key"}</span>
							{#if editSecret && isSecretValid}
								<span class="text-[10px] normal-case text-emerald-500 font-medium">{language.dialogs?.valid || "✓ Valid"}</span>
							{:else if editSecret && !isSecretValid}
								<span class="text-[10px] normal-case text-rose-500 font-medium">{language.dialogs?.base32Only || "⚠ Base32 only"}</span>
							{/if}
						</label>

						{#if editSecret}
							<button
								type="button"
								on:click={copyEditSecret}
								class="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
							>
								<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
								{language.dialogs?.copyKey || language.codes?.copySecret || "Copy key"}
							</button>
						{/if}
					</div>

					<div class="relative">
						<div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="7.5" cy="15.5" r="5.5"/>
								<path d="m21 2-9.6 9.6"/>
								<path d="m15.5 7.5 3 3L22 7l-3-3"/>
							</svg>
						</div>

						{#if showEditSecret}
							<input
								id="edit-secret"
								type="text"
								bind:value={editSecret}
								placeholder={language.edit?.secretKeyPlaceholder || "Base32 secret (e.g. JBSWY3DPEHPK3PXP)"}
								class="w-full pl-10 pr-10 py-2.5 rounded-xl border font-mono text-xs sm:text-sm tracking-wider transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500
									bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500
									{!isSecretValid && editSecret ? 'border-rose-500 focus:ring-rose-500/50' : ''}"
							/>
						{:else}
							<input
								id="edit-secret"
								type="password"
								bind:value={editSecret}
								placeholder={language.edit?.secretKeyPlaceholder || "Base32 secret (e.g. JBSWY3DPEHPK3PXP)"}
								class="w-full pl-10 pr-10 py-2.5 rounded-xl border font-mono text-xs sm:text-sm tracking-wider transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500
									bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500
									{!isSecretValid && editSecret ? 'border-rose-500 focus:ring-rose-500/50' : ''}"
							/>
						{/if}

						<button
							type="button"
							on:click={() => (showEditSecret = !showEditSecret)}
							class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
							title={showEditSecret ? (language.dialogs?.hideSecret || "Hide secret key") : (language.dialogs?.showSecret || "Show secret key")}
						>
							{#if showEditSecret}
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
							{:else}
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
							{/if}
						</button>
					</div>
				</div>

				<!-- Action Buttons -->
				<div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/70 dark:border-slate-700/50">
					<button
						type="button"
						on:click={() => activeEditModal.set(null)}
						class="px-5 py-2.5 rounded-xl font-medium text-sm border border-slate-300 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all text-slate-700 dark:text-slate-200 active:scale-95"
					>
						{language.common?.cancel || "Cancel"}
					</button>
					<button
						type="submit"
						disabled={!isSecretValid || isSavingEdit}
						class="px-6 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
					>
						{#if isSavingEdit}
							<svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
							<span>{language.common?.saving || "Saving..."}</span>
						{:else}
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="20 6 9 17 4 12"/>
							</svg>
							<span>{language.edit?.saveChanges || "Save Changes"}</span>
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- In-App Modal: Display QR Code -->
{#if $activeQrModal}
	<div
		role="presentation"
		tabindex="-1"
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
		on:click|self={() => activeQrModal.set(null)}
		on:keydown|self={(e) => e.key === "Escape" && activeQrModal.set(null)}
	>
		<div
			transition:scale={{ start: 0.92, duration: 180 }}
			class="relative w-full max-w-sm rounded-3xl p-6 sm:p-7 shadow-2xl border text-center bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl text-slate-900 dark:text-white border-slate-200/90 dark:border-slate-700/80 dark:ring-1 dark:ring-white/10"
		>
			<div class="flex items-center justify-between mb-4">
				<div class="text-left truncate flex-1 pr-2">
					<h3 class="text-lg font-bold leading-tight truncate">{$activeQrModal.issuer || "2FA Service"}</h3>
					{#if $activeQrModal.name}
						<p class="text-xs text-slate-500 dark:text-slate-400 truncate">{$activeQrModal.name}</p>
					{/if}
				</div>
				<button
					type="button"
					on:click={() => activeQrModal.set(null)}
					class="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-xl"
				>
					<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
				</button>
			</div>

			<!-- QR Code Card Box -->
			<div class="my-4 p-4 rounded-2xl bg-white shadow-inner border border-slate-100 dark:border-transparent flex items-center justify-center">
				<img
					src={$activeQrModal.qrDataUrl}
					alt={language.export?.qrModalTitle || "2FA QR Code"}
					class="w-52 h-52 object-contain select-none"
				/>
			</div>

			<!-- Masked Secret Key Display with Eye Toggle -->
			<div class="rounded-2xl p-3 mb-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-left">
				<div class="flex items-center justify-between mb-1">
					<span class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{language.codes?.secretKey || "Secret Key"}</span>
					<button
						type="button"
						on:click={() => (showPlainSecret = !showPlainSecret)}
						class="text-xs text-blue-600 dark:text-sky-400 hover:underline flex items-center gap-1"
					>
						{#if showPlainSecret}
							<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
							{language.common?.hide || "Hide"}
						{:else}
							<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
							{language.common?.show || "Show"}
						{/if}
					</button>
				</div>
				<p class="font-mono text-xs font-semibold tracking-wider select-all break-all text-slate-900 dark:text-white">
					{showPlainSecret ? $activeQrModal.secret : "•••• •••• •••• •••• ••••"}
				</p>
			</div>

			<!-- Action Buttons -->
			<div class="space-y-2 mt-4">
				<!-- Download QR Code Button -->
				<button
					type="button"
					disabled={isDownloadingQr}
					on:click={() => downloadQrCode($activeQrModal)}
					class="w-full py-2.5 px-4 rounded-xl font-semibold text-xs bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 select-none"
				>
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
						<polyline points="7 10 12 15 17 10" />
						<line x1="12" y1="15" x2="12" y2="3" />
					</svg>
					{isDownloadingQr ? (language.common?.processing || "Processing...") : (language.codes?.downloadQr || "Download QR Code (PNG)")}
				</button>

				<!-- Copy Action Buttons -->
				<div class="flex items-center gap-2">
					<button
						type="button"
						on:click={() => copySecret($activeQrModal.secret)}
						class="w-1/2 py-2 px-3 rounded-xl font-medium text-xs border border-slate-300 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 transition-all flex items-center justify-center gap-1.5 active:scale-95"
					>
						<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
						{language.codes?.copySecret || "Copy Secret"}
					</button>
					<button
						type="button"
						on:click={() => copyUri($activeQrModal.issuer, $activeQrModal.name, $activeQrModal.secret)}
						class="w-1/2 py-2 px-3 rounded-xl font-medium text-xs border border-slate-300 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 transition-all flex items-center justify-center gap-1.5 active:scale-95"
					>
						<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
						{language.codes?.copyUri || "Copy URI"}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- In-App Modal: Change Master Password -->
{#if $activePasswordModal}
	<div
		role="presentation"
		tabindex="-1"
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
		on:click|self={() => !isChangingPassword && activePasswordModal.set(false)}
		on:keydown|self={(e) => e.key === "Escape" && !isChangingPassword && activePasswordModal.set(false)}
	>
		<div
			transition:scale={{ start: 0.92, duration: 180 }}
			class="relative w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl border text-left bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl text-slate-900 dark:text-white border-slate-200/90 dark:border-slate-700/80 dark:ring-1 dark:ring-white/10"
		>
			<div class="flex items-center justify-between mb-5">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-2xl bg-blue-500/15 flex items-center justify-center text-blue-500">
						<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
							<path d="M7 11V7a5 5 0 0 1 10 0v4" />
						</svg>
					</div>
					<div>
						<h3 class="text-lg font-bold leading-tight">{language.settings?.passwordTitle || "Master password"}</h3>
						<p class="text-xs text-slate-500 dark:text-slate-400">{language.settings?.passwordSubtitle || "Change the master password protecting your 2FA vault."}</p>
					</div>
				</div>
				<button
					type="button"
					disabled={isChangingPassword}
					on:click={() => activePasswordModal.set(false)}
					class="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-xl"
				>
					<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
				</button>
			</div>

			<form on:submit|preventDefault={handleChangePassword} class="space-y-3.5">
				{#if passwordError}
					<div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
						{passwordError}
					</div>
				{/if}

				<!-- Current Password -->
				<div>
					<label for="current-pass" class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{language.settings?.currentPassword || "Current password"}</label>
					<div class="relative">
						<input
							id="current-pass"
							type={showCurrentPass ? "text" : "password"}
							value={currentPass}
							on:input={(e) => (currentPass = e.currentTarget.value)}
							required
							placeholder={language.dialogs?.currentPasswordPlaceholder || "Enter your current password"}
							class="w-full px-4 py-2.5 pr-11 rounded-xl border font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50
								bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white"
						/>
						<button
							type="button"
							on:click={() => (showCurrentPass = !showCurrentPass)}
							class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
						>
							{#if showCurrentPass}
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
							{:else}
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
							{/if}
						</button>
					</div>
				</div>

				<!-- New Password -->
				<div>
					<label for="new-pass" class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{language.dialogs?.passwordMinChars || "New password (at least 8 characters)"}</label>
					<div class="relative">
						<input
							id="new-pass"
							type={showNewPass ? "text" : "password"}
							value={newPass}
							on:input={(e) => (newPass = e.currentTarget.value)}
							required
							placeholder={language.dialogs?.newPasswordPlaceholder || "Enter new password"}
							class="w-full px-4 py-2.5 pr-11 rounded-xl border font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50
								bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white"
						/>
						<button
							type="button"
							on:click={() => (showNewPass = !showNewPass)}
							class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
						>
							{#if showNewPass}
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
							{:else}
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
							{/if}
						</button>
					</div>

					<!-- Password Strength Bar -->
					{#if newPass}
						<div class="mt-2">
							<div class="flex items-center justify-between text-[11px] font-semibold mb-1">
								<span class="text-slate-500">{language.dialogs?.passwordStrength || "Security:"}</span>
								{#if passwordStrength === 0}
									<span class="text-rose-500">{language.dialogs?.strengthTooShort || "Too short (< 8 chars)"}</span>
								{:else if passwordStrength === 1}
									<span class="text-rose-500">{language.dialogs?.strengthWeak || "Weak"}</span>
								{:else if passwordStrength === 2}
									<span class="text-amber-500">{language.dialogs?.strengthMedium || "Medium"}</span>
								{:else if passwordStrength === 3}
									<span class="text-blue-500">{language.dialogs?.strengthStrong || "Strong"}</span>
								{:else}
									<span class="text-emerald-500 font-bold">{language.dialogs?.strengthVeryStrong || "Very Strong"}</span>
								{/if}
							</div>
							<div class="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex gap-1">
								<div class="h-full rounded-full transition-all duration-300 w-1/4
									{passwordStrength >= 1 ? (passwordStrength === 1 ? 'bg-rose-500' : passwordStrength === 2 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-transparent'}" />
								<div class="h-full rounded-full transition-all duration-300 w-1/4
									{passwordStrength >= 2 ? (passwordStrength === 2 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-transparent'}" />
								<div class="h-full rounded-full transition-all duration-300 w-1/4
									{passwordStrength >= 3 ? 'bg-emerald-500' : 'bg-transparent'}" />
								<div class="h-full rounded-full transition-all duration-300 w-1/4
									{passwordStrength >= 4 ? 'bg-emerald-500' : 'bg-transparent'}" />
							</div>
						</div>
					{/if}
				</div>

				<!-- Confirm New Password -->
				<div>
					<label for="confirm-pass" class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{language.settings?.confirmNewPassword || "Confirm new password"}</label>
					<div class="relative">
						<input
							id="confirm-pass"
							type={showConfirmPass ? "text" : "password"}
							value={confirmPass}
							on:input={(e) => (confirmPass = e.currentTarget.value)}
							required
							placeholder={language.dialogs?.confirmPasswordPlaceholder || "Enter new password again"}
							class="w-full px-4 py-2.5 pr-11 rounded-xl border font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50
								bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white"
						/>
						<button
							type="button"
							on:click={() => (showConfirmPass = !showConfirmPass)}
							class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
						>
							{#if showConfirmPass}
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
							{:else}
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
							{/if}
						</button>
					</div>
				</div>

				<div class="flex items-center justify-end gap-3 pt-3">
					<button
						type="button"
						disabled={isChangingPassword}
						on:click={() => activePasswordModal.set(false)}
						class="px-5 py-2.5 rounded-xl font-medium text-sm border border-slate-300 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all text-slate-700 dark:text-slate-200"
					>
						{language.common?.cancel || "Cancel"}
					</button>
					<button
						type="submit"
						disabled={isChangingPassword}
						class="px-6 py-2.5 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all active:scale-95 flex items-center gap-2"
					>
						{#if isChangingPassword}
							<svg class="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
							{language.dialogs?.changing || "Changing..."}
						{:else}
							{language.common?.confirm || "Change password"}
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- In-App Modal: Confirm Disabling App Password -->
{#if $activeDisablePasswordModal}
	<div
		role="presentation"
		tabindex="-1"
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
		on:click|self={() => !isDisablingPassword && activeDisablePasswordModal.set(false)}
		on:keydown|self={(e) => e.key === "Escape" && !isDisablingPassword && activeDisablePasswordModal.set(false)}
	>
		<div
			transition:scale={{ start: 0.92, duration: 180 }}
			class="relative w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl border text-left bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl text-slate-900 dark:text-white border-amber-300 dark:border-amber-900/60 dark:ring-1 dark:ring-amber-500/20"
		>
			<div class="flex items-center gap-3 mb-4">
				<div class="w-12 h-12 rounded-2xl bg-amber-500/15 flex items-center justify-center text-amber-500 flex-shrink-0">
					<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
						<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
						<path d="M7 11V7a5 5 0 0 1 9.9-1"/>
					</svg>
				</div>
				<div>
					<h3 class="text-lg font-bold leading-tight">{language.settings?.disablePasswordModalTitle || "Confirm Disabling App Password"}</h3>
					<p class="text-xs text-slate-500 dark:text-slate-400">{language.settings?.disablePasswordModalText || "For security, please enter your current master password to confirm."}</p>
				</div>
			</div>

			{#if disablePassError}
				<div class="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold flex items-center gap-2">
					<svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
					<span>{disablePassError}</span>
				</div>
			{/if}

			<form on:submit|preventDefault={handleConfirmDisablePassword} class="space-y-4">
				<div>
					<label for="disable-pass-input" class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{language.settings?.currentPassword || "Current password"}</label>
					<div class="relative">
						<input
							id="disable-pass-input"
							type={showDisablePass ? "text" : "password"}
							value={disablePassInput}
							on:input={(e) => (disablePassInput = e.currentTarget.value)}
							required
							placeholder={language.dialogs?.currentPasswordPlaceholder || "Enter your current password"}
							class="w-full px-4 py-2.5 pr-11 rounded-xl border font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50
								bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white"
						/>
						<button
							type="button"
							on:click={() => (showDisablePass = !showDisablePass)}
							class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
						>
							{#if showDisablePass}
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
							{:else}
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
							{/if}
						</button>
					</div>
				</div>

				<div class="flex items-center justify-end gap-3 pt-3">
					<button
						type="button"
						disabled={isDisablingPassword}
						on:click={() => activeDisablePasswordModal.set(false)}
						class="px-5 py-2.5 rounded-xl font-medium text-sm border border-slate-300 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all text-slate-700 dark:text-slate-200"
					>
						{language.common?.cancel || "Cancel"}
					</button>
					<button
						type="submit"
						disabled={isDisablingPassword}
						class="px-6 py-2.5 rounded-xl font-semibold text-sm bg-amber-600 hover:bg-amber-700 text-white shadow-md transition-all active:scale-95 flex items-center gap-2"
					>
						{#if isDisablingPassword}
							<svg class="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
							{language.dialogs?.checking || "Checking..."}
						{:else}
							{language.settings?.confirmDisableButton || "Disable password"}
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- In-App Modal: Set Master Password to Enable Startup Protection -->
{#if $activeEnablePasswordModal}
	<div
		role="presentation"
		tabindex="-1"
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
		on:click|self={() => !isEnablingPassword && activeEnablePasswordModal.set(false)}
		on:keydown|self={(e) => e.key === "Escape" && !isEnablingPassword && activeEnablePasswordModal.set(false)}
	>
		<div
			transition:scale={{ start: 0.92, duration: 180 }}
			class="relative w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl border text-left bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl text-slate-900 dark:text-white border-blue-200 dark:border-slate-700/80 dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)]"
		>
			<div class="flex items-center gap-3 mb-4">
				<div class="w-12 h-12 rounded-2xl bg-blue-500/15 flex items-center justify-center text-blue-500 flex-shrink-0">
					<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
						<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
						<path d="M7 11V7a5 5 0 0 1 10 0v4"/>
					</svg>
				</div>
				<div>
					<h3 class="text-lg font-bold leading-tight">{language.settings?.enablePasswordModalTitle || "Set Master Password for App"}</h3>
					<p class="text-xs text-slate-500 dark:text-slate-400">{language.settings?.enablePasswordModalText || "Create a new password to protect your 2FA vault and data on startup."}</p>
				</div>
			</div>

			{#if enablePassError}
				<div class="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold flex items-center gap-2">
					<svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
					<span>{enablePassError}</span>
				</div>
			{/if}

			<form on:submit|preventDefault={handleConfirmEnablePassword} class="space-y-4">
				<!-- New Password -->
				<div>
					<label for="enable-new-pass" class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{language.dialogs?.passwordMinChars || "New password (at least 8 characters)"}</label>
					<div class="relative">
						<input
							id="enable-new-pass"
							type={showEnableNewPass ? "text" : "password"}
							value={enableNewPass}
							on:input={(e) => (enableNewPass = e.currentTarget.value)}
							required
							placeholder={language.dialogs?.newPasswordPlaceholder || "Enter new password"}
							class="w-full px-4 py-2.5 pr-11 rounded-xl border font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50
								bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white"
						/>
						<button
							type="button"
							on:click={() => (showEnableNewPass = !showEnableNewPass)}
							class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
						>
							{#if showEnableNewPass}
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
							{:else}
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
							{/if}
						</button>
					</div>

					<!-- Password Strength Bar -->
					{#if enableNewPass}
						<div class="mt-2">
							<div class="flex items-center justify-between text-[11px] font-semibold mb-1">
								<span class="text-slate-500">{language.dialogs?.passwordStrength || "Security:"}</span>
								{#if enablePasswordStrength === 0}
									<span class="text-rose-500">{language.dialogs?.strengthTooShort || "Too short (< 8 chars)"}</span>
								{:else if enablePasswordStrength === 1}
									<span class="text-rose-500">{language.dialogs?.strengthWeak || "Weak"}</span>
								{:else if enablePasswordStrength === 2}
									<span class="text-amber-500">{language.dialogs?.strengthMedium || "Medium"}</span>
								{:else if enablePasswordStrength === 3}
									<span class="text-blue-500">{language.dialogs?.strengthStrong || "Strong"}</span>
								{:else}
									<span class="text-emerald-500 font-bold">{language.dialogs?.strengthVeryStrong || "Very Strong"}</span>
								{/if}
							</div>
							<div class="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex gap-1">
								<div class="h-full rounded-full transition-all duration-300 w-1/4
									{enablePasswordStrength >= 1 ? (enablePasswordStrength === 1 ? 'bg-rose-500' : enablePasswordStrength === 2 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-transparent'}" />
								<div class="h-full rounded-full transition-all duration-300 w-1/4
									{enablePasswordStrength >= 2 ? (enablePasswordStrength === 2 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-transparent'}" />
								<div class="h-full rounded-full transition-all duration-300 w-1/4
									{enablePasswordStrength >= 3 ? 'bg-emerald-500' : 'bg-transparent'}" />
								<div class="h-full rounded-full transition-all duration-300 w-1/4
									{enablePasswordStrength >= 4 ? 'bg-emerald-500' : 'bg-transparent'}" />
							</div>
						</div>
					{/if}
				</div>

				<!-- Confirm New Password -->
				<div>
					<label for="enable-confirm-pass" class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{language.settings?.confirmNewPassword || "Confirm new password"}</label>
					<div class="relative">
						<input
							id="enable-confirm-pass"
							type={showEnableConfirmPass ? "text" : "password"}
							value={enableConfirmPass}
							on:input={(e) => (enableConfirmPass = e.currentTarget.value)}
							required
							placeholder={language.dialogs?.confirmPasswordPlaceholder || "Enter new password again"}
							class="w-full px-4 py-2.5 pr-11 rounded-xl border font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50
								bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white"
						/>
						<button
							type="button"
							on:click={() => (showEnableConfirmPass = !showEnableConfirmPass)}
							class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
						>
							{#if showEnableConfirmPass}
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
							{:else}
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
							{/if}
						</button>
					</div>
				</div>

				<div class="flex items-center justify-end gap-3 pt-3">
					<button
						type="button"
						disabled={isEnablingPassword}
						on:click={() => activeEnablePasswordModal.set(false)}
						class="px-5 py-2.5 rounded-xl font-medium text-sm border border-slate-300 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all text-slate-700 dark:text-slate-200"
					>
						{language.common?.cancel || "Cancel"}
					</button>
					<button
						type="submit"
						disabled={isEnablingPassword}
						class="px-6 py-2.5 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all active:scale-95 flex items-center gap-2"
					>
						{#if isEnablingPassword}
							<svg class="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
							{language.dialogs?.enabling || "Enabling..."}
						{:else}
							{language.settings?.confirmEnableButton || "Enable password"}
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- In-App Modal: Reset App Confirmation (Danger Zone) -->
{#if $activeResetModal}
	<div
		role="presentation"
		tabindex="-1"
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
		on:click|self={() => !isResetting && activeResetModal.set(false)}
		on:keydown|self={(e) => e.key === "Escape" && !isResetting && activeResetModal.set(false)}
	>
		<div
			transition:scale={{ start: 0.94, duration: 180 }}
			class="relative w-full max-w-sm rounded-3xl p-6 sm:p-7 shadow-2xl border text-center bg-white/95 dark:bg-[#0b1120]/95 backdrop-blur-2xl text-slate-900 dark:text-white border-slate-200/80 dark:border-slate-800"
		>
			<!-- Close button -->
			<button
				type="button"
				disabled={isResetting}
				on:click={() => activeResetModal.set(false)}
				class="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors focus:outline-none"
				title={language.common?.cancel || "Close"}
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>

			<!-- Danger Icon Badge -->
			<div class="w-12 h-12 mx-auto rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center mb-3.5 shadow-sm">
				<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M3 6h18" />
					<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
					<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
					<line x1="10" y1="11" x2="10" y2="17" />
					<line x1="14" y1="11" x2="14" y2="17" />
				</svg>
			</div>

			<!-- Title & Description -->
			<h3 class="text-lg font-bold text-slate-900 dark:text-white tracking-tight mb-1.5">{language.settings?.resetApp || "Reset app"}</h3>
			<p class="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed mb-5">
				{language.dialogs?.resetWarningText || "Resetting will erase all 2FA codes, master password, and all settings back to default. All data will be permanently deleted."}
			</p>

			<form on:submit|preventDefault={handleResetApp} class="space-y-4">
				<div>
					<input
						id="reset-confirm"
						type="text"
						bind:value={resetConfirmText}
						placeholder={language.dialogs?.typeResetToConfirm || "Type RESET to confirm"}
						autocomplete="off"
						spellcheck="false"
						class="w-full px-4 py-2.5 rounded-xl border font-mono font-bold text-sm tracking-widest text-center uppercase transition-all bg-slate-50 dark:bg-slate-900/90 border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:normal-case placeholder:font-sans placeholder:tracking-normal focus:outline-none focus:border-rose-500/70 focus:ring-2 focus:ring-rose-500/20"
					/>
				</div>

				<div class="grid grid-cols-2 gap-2.5 pt-1">
					<button
						type="button"
						disabled={isResetting}
						on:click={() => activeResetModal.set(false)}
						class="w-full py-2.5 rounded-xl font-medium text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 transition-all active:scale-95 cursor-pointer"
					>
						{language.common?.cancel || "Cancel"}
					</button>
					<button
						type="submit"
						disabled={resetConfirmText.trim().toUpperCase() !== "RESET" || isResetting}
						class="w-full py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-1.5
							{resetConfirmText.trim().toUpperCase() === 'RESET' && !isResetting
								? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-950/40 cursor-pointer'
								: 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-400/40 border border-rose-500/20 cursor-not-allowed'}"
					>
						{#if isResetting}
							<svg class="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
							<span>{language.dialogs?.resetting || "Resetting..."}</span>
						{:else}
							<span>{language.dialogs?.confirmReset || "Confirm Reset All"}</span>
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

