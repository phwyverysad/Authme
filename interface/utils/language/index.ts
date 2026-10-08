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

function deepMerge(target: any, source: any): any {
	if (!source) return target
	const output = Array.isArray(target) ? [...target] : { ...target }
	for (const key of Object.keys(source)) {
		const srcVal = source[key]
		if (srcVal !== undefined && srcVal !== null) {
			if (
				typeof srcVal === "object" &&
				!Array.isArray(srcVal) &&
				output[key] &&
				typeof output[key] === "object" &&
				!Array.isArray(output[key])
			) {
				output[key] = deepMerge(output[key], srcVal)
			} else {
				output[key] = srcVal
			}
		}
	}
	return output
}

export const getLanguage = (forcedLang?: number): typeof localeEN => {
	const sysLang = typeof navigator !== "undefined" ? navigator.language : "en"
	const curSettings = getSettings()
	const langSetting = forcedLang !== undefined ? forcedLang : Number(curSettings?.settings?.language ?? 0)

	let selected: any = localeEN
	if (langSetting === 0) {
		if (sysLang.startsWith("hu")) selected = localeHU
		else if (sysLang.startsWith("es")) selected = localeES
		else if (sysLang.startsWith("fr")) selected = localeFR
		else if (sysLang.startsWith("ru")) selected = localeRU
		else if (sysLang.startsWith("de")) selected = localeDE
		else if (sysLang.startsWith("zh")) selected = localeZH
		else if (sysLang.startsWith("pl")) selected = localePL
		else if (sysLang.startsWith("ja")) selected = localeJA
		else if (sysLang.startsWith("ar")) selected = localeAR
		else if (sysLang.startsWith("th")) selected = localeTH
		else selected = localeEN
	} else {
		const languages = [localeEN, localeHU, localeES, localeFR, localeRU, localeDE, localeZH, localePL, localeJA, localeAR, localeTH]
		selected = languages[langSetting - 1] || localeEN
	}

	if (selected === localeEN) return localeEN
	return deepMerge(localeEN, selected) as typeof localeEN
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
