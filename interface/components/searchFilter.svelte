<Popover let:open class="relative {open ? 'z-50' : ''}">
	<PopoverButton class="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors focus:outline-none" title={language.common?.filter || "Search filter"}>
		<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
	</PopoverButton>
	<Transition enter="transition ease-out duration-200" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1">
		<PopoverPanel class="absolute right-0 z-50 mt-2 w-64 transform">
			<div class="overflow-hidden rounded-2xl bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xl dark:shadow-black/60 dark:ring-1 dark:ring-white/10 text-slate-900 dark:text-white p-3">
				<div class="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
					<span>{language.common?.filter || "Search filter"}</span>
					<span class="text-[10px] lowercase text-sky-500 font-normal">smart search</span>
				</div>
				<div class="flex flex-col gap-1.5 text-sm font-medium">
					<label class="flex items-center gap-2.5 cursor-pointer px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors">
						<input
							type="checkbox"
							bind:checked={$settings.searchFilter.name}
							on:change={handleFilterChange}
							class="checkbox rounded-md"
						/>
						<div class="flex flex-col text-left">
							<span class="leading-tight">{language.edit?.serviceName || language.common.name}</span>
							<span class="text-[11px] text-slate-400 font-normal">{language.codes?.filterServiceHint || "Service / Issuer"}</span>
						</div>
					</label>
					<label class="flex items-center gap-2.5 cursor-pointer px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors">
						<input
							type="checkbox"
							bind:checked={$settings.searchFilter.description}
							on:change={handleFilterChange}
							class="checkbox rounded-md"
						/>
						<div class="flex flex-col text-left">
							<span class="leading-tight">{language.edit?.accountName || language.common.description}</span>
							<span class="text-[11px] text-slate-400 font-normal">{language.codes?.filterAccountHint || "Account / Email / Description"}</span>
						</div>
					</label>
				</div>
			</div>
		</PopoverPanel>
	</Transition>
</Popover>

<script lang="ts">
	import { Popover, PopoverButton, PopoverPanel, Transition } from "@rgossiaux/svelte-headlessui"
	import { settings } from "../stores/settings"
	import { getLanguage, currentLanguage } from "@utils/language"
	import { search } from "../windows/codes/index"

	let language = getLanguage()
	$: language = $currentLanguage || getLanguage()

	const handleFilterChange = () => {
		if ($settings.searchFilter) {
			;($settings.searchFilter as any)._customized = true
		}
		setTimeout(() => {
			search()
		}, 10)
	}
</script>
