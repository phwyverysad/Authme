import { writable } from "svelte/store"
import { localeEN } from "@utils/language/en"
import { localeHU } from "@utils/language/hu"
import { localeES } from "@utils/language/es"
import { localeFR } from "@utils/language/fr"
import { localeRU } from "@utils/language/ru"
import { localeDE } from "@utils/language/de"
import { localeZH } from "@utils/language/zh"
import { localePL } from "@utils/language/pl"
import { localeJA } from "@utils/language/ja"
import { settings, getSettings } from "@stores/settings"
import { localeAR } from "@utils/language/ar"
import { localeTH } from "@utils/language/th"

export const getLanguage = (forcedLang?: number): typeof localeEN => {
	const sysLang = typeof navigator !== "undefined" ? navigator.language : "en"
	const curSettings = getSettings()
	const langSetting = forcedLang !== undefined ? forcedLang : Number(curSettings?.settings?.language ?? 0)

	if (langSetting === 0) {
		if (sysLang.startsWith("hu")) return localeHU as typeof localeEN
		if (sysLang.startsWith("es")) return localeES as typeof localeEN
		if (sysLang.startsWith("fr")) return localeFR as typeof localeEN
		if (sysLang.startsWith("ru")) return localeRU as typeof localeEN
		if (sysLang.startsWith("de")) return localeDE as typeof localeEN
		if (sysLang.startsWith("zh")) return localeZH as typeof localeEN
		if (sysLang.startsWith("pl")) return localePL as typeof localeEN
		if (sysLang.startsWith("ja")) return localeJA as typeof localeEN
		if (sysLang.startsWith("ar")) return localeAR as typeof localeEN
		if (sysLang.startsWith("th")) return localeTH as typeof localeEN
		return localeEN
	} else {
		const languages = [localeEN, localeHU, localeES, localeFR, localeRU, localeDE, localeZH, localePL, localeJA, localeAR, localeTH]
		return (languages[langSetting - 1] || localeEN) as typeof localeEN
	}
}

export const currentLanguage = writable<typeof localeEN>(getLanguage())

// Keep currentLanguage synchronized with settings store changes
settings.subscribe((s) => {
	if (s && s.settings && s.settings.language !== undefined) {
		currentLanguage.set(getLanguage(s.settings.language))
	}
})

function getNestedValue(obj: any, path: string[]): any {
	let curr = obj
	for (const key of path) {
		if (curr === null || curr === undefined) return undefined
		curr = curr[key]
	}
	return curr
}

function createLanguageProxy(getter: () => any, path: string[] = []): any {
	return new Proxy({} as any, {
		get(_target, prop) {
			if (typeof prop === "symbol" || prop === "$$typeof") return undefined
			const key = prop as string
			const currentPath = [...path, key]
			const cur = getter()
			const val = cur ? cur[key] : undefined
			if (val !== null && typeof val === "object" && !Array.isArray(val)) {
				return createLanguageProxy(() => {
					const c = getter()
					return c ? c[key] : undefined
				}, currentPath)
			}
			if (val !== undefined) return val
			return getNestedValue(localeEN, currentPath)
		}
	})
}

export const language: typeof localeEN = createLanguageProxy(() => getLanguage())


