<Popover let:open class="relative {open ? 'z-50' : ''}">
	<PopoverButton
		class="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors focus:outline-none relative cursor-pointer"
		title={language.common?.filter || "Filter"}
	>
		<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
		</svg>
		{#if isFilterActive}
			<span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-sky-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
		{/if}
	</PopoverButton>

	<Transition
		enter="transition ease-out duration-200"
		enterFrom="opacity-0 translate-y-1 scale-95"
		enterTo="opacity-100 translate-y-0 scale-100"
		leave="transition ease-in duration-150"
		leaveFrom="opacity-100 translate-y-0 scale-100"
		leaveTo="opacity-0 translate-y-1 scale-95"
	>
		<PopoverPanel class="absolute right-0 z-50 mt-2 w-72 transform">
			<div class="overflow-hidden rounded-2xl bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xl dark:shadow-black/70 text-slate-900 dark:text-white p-3.5 select-none">
				<!-- Header with Reset option -->
				<div class="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/80 dark:border-slate-800">
					<div class="flex items-center gap-1.5">
						<svg class="w-3.5 h-3.5 text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
						<span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
							{language.common?.filter || "Filter"}
						</span>
					</div>
					{#if isFilterActive}
						<button
							type="button"
							class="text-[11px] font-semibold text-sky-500 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer transition-colors"
							on:click={resetFilters}
						>
							{language.mail?.resetFilter || "Reset"}
						</button>
					{/if}
				</div>

				<!-- Provider Filter Pills -->
				<div class="mb-3">
					<span class="text-[11px] font-semibold text-slate-400 block mb-1.5">
						{language.mail?.filterByProvider || "Service / Provider"}
					</span>
					<div class="flex flex-wrap gap-1.5">
						{#each providers as p}
							<button
								type="button"
								class="px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer {selectedProvider === p.id ? 'bg-sky-500 text-white shadow-sm scale-[1.02]' : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}"
								on:click={() => (selectedProvider = p.id)}
							>
								{p.label}
							</button>
						{/each}
					</div>
				</div>

				<!-- Unread Only Toggle -->
				<label class="flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer">
					<div class="flex items-center gap-2">
						<span class="w-2 h-2 rounded-full bg-emerald-500" />
						<span class="text-xs font-medium text-slate-700 dark:text-slate-200">
							{language.mail?.unreadOnly || "Unread mail only"}
						</span>
					</div>
					<input
						type="checkbox"
						bind:checked={unreadOnly}
						class="checkbox rounded-md"
					/>
				</label>
			</div>
		</PopoverPanel>
	</Transition>
</Popover>

<script lang="ts">
	import { Popover, PopoverButton, PopoverPanel, Transition } from "@rgossiaux/svelte-headlessui"
	import { getLanguage, currentLanguage } from "@utils/language"

	export let selectedProvider: string = "all"
	export let unreadOnly: boolean = false

	let language = getLanguage()
	$: language = $currentLanguage || getLanguage()

	$: isFilterActive = selectedProvider !== "all" || unreadOnly

	$: providers = [
		{ id: "all", label: language.mail?.allProviders || "All" },
		{ id: "gmail", label: "Gmail" },
		{ id: "outlook", label: "Outlook" },
		{ id: "yahoo", label: "Yahoo" },
		{ id: "proton", label: "Proton" },
		{ id: "icloud", label: "iCloud" },
		{ id: "custom", label: language.mail?.customWebmail || "Webmail" },
	]

	function resetFilters() {
		selectedProvider = "all"
		unreadOnly = false
	}
</script>
