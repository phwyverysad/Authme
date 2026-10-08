import { textConverter } from "../../utils/convert"
import * as dialog from "interface/utils/dialog"
import { getSettings, setSettings } from "../../stores/settings"
import { navigate } from "../../utils/navigate"
import { decryptData, encryptData, setEncryptionKey } from "interface/utils/encryption"
import { getLanguage, language } from "@utils/language"
import { getServiceIcon, fetchBrandIcon } from "../../utils/icons"

let names: string[] = []
let issuers: string[] = []
let secrets: string[] = []
let uniqIds: string[] = []

if (typeof window !== "undefined") {
	window.addEventListener("authme:themechange", (e: any) => {
		const isDark = !e.detail?.isLight
		for (let i = 0; i < names.length; i++) {
			const iconData = getServiceIcon(issuers[i], names[i], isDark)
			const container = document.querySelector(`#editBrandIconContainer_${uniqIds[i]}`) as HTMLElement | null
			const inner = document.querySelector(`#editBrandIconInner_${uniqIds[i]}`) as HTMLElement | null
			if (container) container.setAttribute("style", iconData.bg)
			if (inner) inner.innerHTML = iconData.svg
		}
	})
}

/**
 * Generate the edit elements from the saved codes
 */
const generateEditElements = () => {
	const container = document.querySelector(".loadedCodes") as HTMLElement | null
	if (container) container.style.display = "block"

	const contentEl = container ? (container.querySelector(".edit-content") as HTMLElement | null) : (document.querySelector(".edit-content") as HTMLElement | null)
	if (!contentEl) return
	contentEl.innerHTML = ""

	for (let i = 0; i < names.length; i++) {
		const iconData = getServiceIcon(issuers[i], names[i])
		const element = document.createElement("div")

		element.innerHTML = `
		<div class="flex items-center gap-4 w-full flex-wrap min-[820px]:flex-nowrap p-4 rounded-2xl bg-white/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 shadow-sm backdrop-blur-sm">
			<!-- Brand Icon -->
			<div id="editBrandIconContainer_${uniqIds[i]}" class="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-2xl shadow-sm overflow-hidden select-none" style="${iconData.bg}">
				<div id="editBrandIconInner_${uniqIds[i]}" class="w-full h-full flex items-center justify-center">
					${iconData.svg}
				</div>
			</div>

			<!-- Input Fields -->
			<div class="grid grid-cols-1 min-[640px]:grid-cols-2 gap-3 flex-1 min-w-0">
				<div class="min-w-0">
					<h5 class="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 truncate">${language.edit?.serviceName || language.common.name}</h5>
					<input id="issuer${uniqIds[i]}" class="input w-full font-medium text-sm sm:text-base px-3 py-2 rounded-xl" type="text" value="${issuers[i]}" title="${issuers[i]}" readonly />
				</div>

				<div class="min-w-0">
					<h5 class="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 truncate">${language.edit?.accountName || language.common.description}</h5>
					<input id="name${uniqIds[i]}" class="input w-full font-medium text-sm sm:text-base px-3 py-2 rounded-xl" type="text" value="${names[i]}" title="${names[i]}" readonly />
				</div>
			</div>

			<!-- Action Buttons -->
			<div class="flex gap-2 items-center flex-shrink-0 ml-auto pt-2 sm:pt-0">
				<button id="editCode${uniqIds[i]}" class="button py-2 px-3 text-sm flex items-center gap-1.5" title="${language.common.edit}">
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
					${language.common.edit}
				</button>

				<button id="deleteCode${uniqIds[i]}" class="button py-2 px-3 text-sm flex items-center gap-1.5 hover:border-rose-500 hover:text-rose-500" title="${language.common.delete}">
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
					${language.common.delete}
				</button>
			</div>
		</div>`

		element.classList.add("edit", "w-full", "mb-3")
		element.setAttribute("id", `edit${uniqIds[i]}`)

		contentEl.appendChild(element)

		// Dynamic Icon Discovery for /edit list
		if (iconData.isMonogram && iconData.serviceKey) {
			const sKey = iconData.serviceKey
			const currentUniqId = uniqIds[i]
			fetchBrandIcon(sKey).then((iconUrl) => {
				if (iconUrl) {
					const inner = document.querySelector(`#editBrandIconInner_${currentUniqId}`)
					if (inner) {
						inner.innerHTML = `<img src="${iconUrl}" alt="" class="w-7 h-7 object-contain drop-shadow" />`
					}
				}
			})
		}

		document.querySelector(`#editCode${uniqIds[i]}`)?.addEventListener("click", () => {
			editCode(uniqIds[i])
		})

		document.querySelector(`#deleteCode${uniqIds[i]}`)?.addEventListener("click", () => {
			deleteCode(uniqIds[i])
		})
	}
}

/**
 * Load the saved codes
 */
export const loadSavedCodes = async () => {
	const currentSettings = getSettings()
	const codes = currentSettings.vault.codes

	if (codes === null) {
		dialog.message(language.codes.dialog.noSaveFileFound, { kind: "error" })
		return navigate("import")
	}

	if (currentSettings.security.requireAuthentication === false) {
		await setEncryptionKey()
	}

	const decryptedText = await decryptData(codes)
	if (!decryptedText || decryptedText === "error") {
		return
	}

	const data = textConverter(decryptedText, 0)
	if (!data) return

	names = data.names
	issuers = data.issuers
	secrets = data.secrets
	uniqIds = data.uniqIds

	generateEditElements()
}

/**
 * Save the current changes
 */
export const saveChanges = async () => {
	if (names.length === 0) {
		const currentSettings = getSettings()
		currentSettings.vault.codes = null
		setSettings(currentSettings)
		return
	}

	let saveText = ""

	for (let i = 0; i < names.length; i++) {
		const string = `\nName:   ${names[i]} \nSecret: ${secrets[i]} \nIssuer: ${issuers[i]} \nType:   OTP_TOTP\n`
		saveText += string
	}

	const encryptedText = await encryptData(saveText)
	if (encryptedText && encryptedText !== "error") {
		const currentSettings = getSettings()
		currentSettings.vault.codes = encryptedText
		setSettings(currentSettings)
	}
}

/**
 * Edit a specific code
 */
export const editCode = async (uniqId: string) => {
	const id = uniqIds.indexOf(uniqId)
	if (id === -1) return

	const issuer = document.querySelector(`#issuer${uniqId}`) as HTMLInputElement | null
	const name = document.querySelector(`#name${uniqId}`) as HTMLInputElement | null
	if (!issuer || !name) return

	issuer.focus()
	const length = issuer.value.length
	issuer.setSelectionRange(length, length)

	if (issuer.readOnly === true) {
		issuer.readOnly = false
		name.readOnly = false

		issuer.style.color = "#28A443"
		name.style.color = "#28A443"
	} else {
		issuer.readOnly = true
		name.readOnly = true

		issuer.style.color = ""
		name.style.color = ""

		const newIssuer = (document.querySelector(`#issuer${uniqId}`) as HTMLInputElement)?.value || ""
		const newName = (document.querySelector(`#name${uniqId}`) as HTMLInputElement)?.value || ""

		const res = await dialog.ask(language.edit.dialog.saveChanges, { kind: "warning" })

		if (res === true) {
			issuers[id] = newIssuer
			names[id] = newName
			await saveChanges()
			// Update brand icon
			const iconData = getServiceIcon(newIssuer, newName)
			const container = document.querySelector(`#editBrandIconContainer_${uniqId}`) as HTMLElement | null
			const inner = document.querySelector(`#editBrandIconInner_${uniqId}`) as HTMLElement | null
			if (container && inner) {
				container.setAttribute("style", iconData.bg)
				inner.innerHTML = iconData.svg
			}
		} else {
			issuer.value = issuers[id]
			name.value = names[id]
		}
	}
}

/**
 * Delete a specific code
 */
export const deleteCode = async (uniqId: string) => {
	const id = uniqIds.indexOf(uniqId)
	if (id === -1) return

	const res = await dialog.ask(language.edit.dialog.deleteCode, { kind: "warning" })

	if (res === true) {
		names.splice(id, 1)
		secrets.splice(id, 1)
		issuers.splice(id, 1)
		uniqIds.splice(id, 1)

		document.querySelector(`#edit${uniqId}`)?.remove()

		if (names.length === 0) {
			const currentSettings = getSettings()
			currentSettings.vault.codes = null
			setSettings(currentSettings)
		} else {
			await saveChanges()
		}
	}
}
