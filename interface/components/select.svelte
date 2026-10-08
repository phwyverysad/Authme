<Listbox
	value={active}
	on:change={handleChange}
	let:open
>
	<div class="relative {open ? 'z-[9999]' : 'z-10'}">
		<span class="inline-block w-full shadow-sm">
			<ListboxButton class="select w-52">
				<span class="block truncate">{active}</span>
			</ListboxButton>
		</span>

		<Transition enter="transition duration-100 ease-out" enterFrom="transform scale-95 opacity-0" enterTo="transform scale-100 opacity-100" leave="transition duration-75 ease-out" leaveFrom="transform scale-100 opacity-100" leaveTo="transform scale-95 opacity-0">
			<div class="absolute z-[9999] mt-1.5 w-full rounded-2xl bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xl dark:shadow-black/60 dark:ring-1 dark:ring-white/10 overflow-hidden">
				<ListboxOptions class="max-h-60 overflow-auto p-1.5 text-base leading-6 focus:outline-none sm:text-sm sm:leading-5">
					{#each options as name (name)}
						<ListboxOption
							value={name}
							class={({ active, selected }) => {
								return classNames(
									"relative cursor-pointer select-none rounded-xl py-2.5 pl-3.5 pr-9 duration-150 ease-out focus:outline-none font-medium transition-colors",
									active
										? "bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-white"
										: selected
											? "text-blue-600 dark:text-sky-400 font-semibold"
											: "text-slate-700 dark:text-slate-300"
								)
							}}
							let:active
							let:selected
						>
							<span class={classNames("flex flex-row items-center truncate", selected ? "font-bold" : "font-normal")}>
								{name}
							</span>
							{#if selected}
								<span class={classNames("absolute inset-y-0 right-0 flex items-center pr-3.5", "text-blue-600 dark:text-sky-400")}>
									<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
										<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
									</svg>
								</span>
							{/if}
						</ListboxOption>
					{/each}
				</ListboxOptions>
			</div>
		</Transition>
	</div>
</Listbox>

<script lang="ts">
	import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Transition } from "@rgossiaux/svelte-headlessui"
	import { settings, setSettings } from "../stores/settings"
	import { currentLanguage, getLanguage } from "../utils/language"

	const classNames = (...classes: (string | false | null | undefined)[]) => {
		return classes.filter(Boolean).join(" ")
	}

	export let options: string[]
	export let setting: string

	let active: string | undefined

	$: active = options[$settings?.settings?.[setting]] || options[0]

	function handleChange(event: any) {
		const selected = event.detail
		active = selected
		const idx = options.indexOf(selected)
		if (idx >= 0) {
			const cur: LibSettings = { ...$settings }
			if (cur.settings) {
				;(cur.settings as any)[setting] = idx
			}
			setSettings(cur)
			if (setting === "language") {
				currentLanguage.set(getLanguage(idx))
			}
		}
	}
</script>
