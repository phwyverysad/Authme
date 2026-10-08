<div class="transparent-900 main codes-page mx-auto my-6 sm:my-10 md:my-16 w-[96%] sm:w-[94%] md:w-[92%] lg:w-[90%] xl:w-4/5 max-w-7xl rounded-2xl p-4 sm:p-6 md:p-8 lg:p-10 text-center">
	<h1>Authme</h1>

	<div class="searchContainer codesSearchContainer mx-auto mb-5 mt-4 items-center justify-center px-1 sm:px-4 w-full gap-2.5 sm:gap-3" class:flex={$hasCodesStore} class:hidden={!$hasCodesStore}>
		<div class="relative flex items-center justify-center w-full max-w-xl md:max-w-2xl flex-1">
			<!-- Magnifying Glass Icon -->
			<svg class="pointer-events-none absolute left-4 h-5 w-5 text-slate-400 dark:text-slate-500 z-10" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>

			<!-- Search Input -->
			<input
				on:input={search}
				on:keyup={search}
				spellcheck="false"
				class="search input w-full pl-11 sm:pl-12 pr-16 sm:pr-20 py-2.5 sm:py-3 rounded-2xl text-sm sm:text-base shadow-sm border border-slate-200/80 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md focus:ring-2 focus:ring-slate-400/50 dark:focus:ring-slate-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
				type="text"
				placeholder={language.codes?.searchPlaceholder || "Search 2FA accounts..."}
			/>

			<!-- Right Control Group: Count Badge, Clear Button -->
			<div class="absolute right-3 flex items-center gap-1.5 z-10">
				<!-- Live Match Counter Badge -->
				<span class="searchCountBadge hidden px-2 py-0.5 text-xs font-semibold rounded-full select-none" />

				<!-- Clear Button (✕) -->
				<button
					type="button"
					class="searchClearBtn hidden p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors focus:outline-none"
					title={language.codes?.clearSearchTooltip || "Clear search"}
					on:click={clearSearch}
				>
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
				</button>
			</div>
		</div>

		<!-- Add New 2FA Account Button -->
		<button
			type="button"
			class="button py-2.5 sm:py-3 px-3.5 sm:px-4 rounded-2xl flex items-center gap-2 text-sm font-semibold flex-shrink-0 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95 transition-all"
			title={language.codes?.addAccount || "Add new 2FA account"}
			on:click={() => navigate("import?category=2fa")}
		>
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
			<span class="hidden min-[480px]:inline whitespace-nowrap">{language.codes?.addAccount || "Add account"}</span>
		</button>
	</div>

	{#if $hasCodesStore && $availableCodeCategories.length > 1}
		<!-- Category Filter Pills Bar with App Icons, Mouse Drag & Wheel Scroll -->
		<div
			use:horizontalScrollAction
			class="codes-category-bar mx-auto mb-5 -mt-2 flex items-center px-2 sm:px-4 w-full max-w-4xl overflow-x-auto no-scrollbar py-2 select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
		>
			<div class="flex items-center gap-2.5 flex-nowrap min-w-max px-2 py-0.5 justify-start">
				{#each $availableCodeCategories as cat (cat.id)}
					<button
						type="button"
						class="category-pill group h-10 px-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 transition-all duration-150 cursor-pointer select-none flex-shrink-0 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 active:translate-y-[0.5px]
						{$activeCodeCategory === cat.id
							? 'bg-slate-900 text-white border border-slate-900 shadow-sm dark:bg-white dark:text-slate-900 dark:border-white'
							: 'bg-white/95 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'}"
						on:click={(e) => handleCategoryClick(e, cat.id)}
					>
						{#if cat.id === 'all'}
							<!-- All Categories Icon -->
							<span class="w-6 h-6 rounded-[7px] flex items-center justify-center flex-shrink-0 shadow-xs
								{$activeCodeCategory === 'all'
									? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900'
									: 'bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300'}"
							>
								<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<rect x="3" y="3" width="7" height="7" rx="1.5" />
									<rect x="14" y="3" width="7" height="7" rx="1.5" />
									<rect x="14" y="14" width="7" height="7" rx="1.5" />
									<rect x="3" y="14" width="7" height="7" rx="1.5" />
								</svg>
							</span>
						{:else}
							<!-- App Icon Badge -->
							<span
								class="w-6 h-6 rounded-[7px] flex items-center justify-center flex-shrink-0 overflow-hidden shadow-xs border border-black/8 dark:border-white/12"
								style="{cat.bg || 'background: #64748b;'}"
							>
								{#if cat.iconUrl}
									<img src="{cat.iconUrl}" alt="{cat.name}" class="w-4 h-4 object-contain rounded-xs" />
								{:else if cat.isMonogram}
									<span class="text-[11px] font-extrabold text-white leading-none select-none tracking-tight">
										{cat.monogramChar || cat.name.charAt(0).toUpperCase()}
									</span>
								{:else if cat.iconSvg}
									<span class="w-4 h-4 flex items-center justify-center flex-shrink-0 [&>svg]:w-4 [&>svg]:h-4 [&>svg]:max-w-full [&>svg]:max-h-full">
										{@html cat.iconSvg}
									</span>
								{/if}
							</span>
						{/if}
						<span class="whitespace-nowrap tracking-tight font-semibold text-[13px]">{cat.name}</span>
						<span class="text-[11px] px-2 py-0.5 rounded-full font-bold min-w-[20px] text-center
							{$activeCodeCategory === cat.id
								? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900 font-bold'
								: 'bg-slate-100 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400 font-bold'}"
						>
							{cat.count}
						</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<div class="content codes-content mx-auto grid grid-cols-1 card2:grid-cols-2 card3:grid-cols-3 gap-3.5 sm:gap-4 md:gap-5 rounded-2xl p-1 sm:p-2 md:p-4 w-full">
		{#if !$hasCodesStore}
			<div class="importCodes col-span-full transparent-800 w-full max-w-2xl mx-auto rounded-2xl p-6 sm:p-8 text-center my-4">
				<h2>{language.codes.importCodes}</h2>
				<h3>{language.codes.importCodesText}</h3>
				<div class="mx-auto mt-6 flex flex-row items-center justify-center gap-3 sm:flex-wrap">
					<button class="button px-6 py-2.5 rounded-full flex items-center gap-2 text-sm font-semibold shadow-md bg-white text-slate-900 hover:bg-slate-100 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-all mx-auto active:scale-95" on:click={() => navigate("import")}>
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
							<polyline points="10 17 15 12 10 7" />
							<line x1="15" y1="12" x2="3" y2="12" />
						</svg>
						<span>{language.codes.importCodesButton}</span>
					</button>
				</div>
			</div>
		{/if}

		<div class="noSearchResults col-span-full transparent-800 hidden w-full max-w-2xl mx-auto rounded-2xl p-8 text-center border border-slate-200/80 dark:border-slate-700/60 shadow-lg">
			<div class="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
				<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
			</div>
			<h2 class="text-xl font-bold mb-1 text-slate-900 dark:text-white">{language.codes.noSearchResultsFound}</h2>
			<h3 class="text-sm text-slate-500 dark:text-slate-400 mb-4">{language.codes.noSearchResultsFoundText} "<span class="searchResult font-semibold text-slate-700 dark:text-slate-200" />"</h3>
			<button class="button mx-auto py-2 px-4 text-sm inline-flex items-center gap-2" on:click={clearSearch}>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
				<span>{language.codes?.clearSearch || "Clear search (Show all)"}</span>
			</button>
		</div>
	</div>
</div>

<script lang="ts">
	import { onMount, onDestroy } from "svelte"
	import { router } from "@baileyherbert/tinro"
	import { stopCodesRefresher, search, clearSearch, loadCodes, availableCodeCategories, activeCodeCategory, setCodesCategory, hasCodesStore } from "./index"
	import { navigate } from "../../utils/navigate"
	import { getLanguage, currentLanguage } from "@utils/language"
	import { state } from "../../stores/state"

	let language = getLanguage()
	$: language = $currentLanguage || getLanguage()

	// Ensure codes are reloaded whenever on /codes or /idle or when new codes are imported
	let lastLoadedRoute = ""
	$: if ($router.path === "/codes" || $router.path === "/idle") {
		if (lastLoadedRoute !== $router.path || $state.importData !== null) {
			lastLoadedRoute = $router.path
			loadCodes()
		}
	} else {
		lastLoadedRoute = ""
	}

	let isCategoryOverflowing = false
	let isDraggingCategory = false
	let categoryDragStartX = 0
	let categoryDragStartScrollLeft = 0
	let categoryHasDragged = false
	let categoryJustDragged = false

	function handleCategoryClick(e: MouseEvent, catId: string) {
		if (categoryJustDragged || categoryHasDragged) {
			e.preventDefault()
			e.stopPropagation()
			return
		}
		setCodesCategory(catId)
	}

	function horizontalScrollAction(node: HTMLElement) {
		const updateOverflow = () => {
			isCategoryOverflowing = node.scrollWidth > node.clientWidth + 4
		}

		const resizeObserver = new ResizeObserver(() => {
			updateOverflow()
		})
		resizeObserver.observe(node)
		setTimeout(updateOverflow, 60)

		const onWheel = (e: WheelEvent) => {
			if (e.deltaY !== 0) {
				e.preventDefault()
				node.scrollLeft += e.deltaY
			} else if (e.deltaX !== 0) {
				e.preventDefault()
				node.scrollLeft += e.deltaX
			}
		}

		const onPointerDown = (e: PointerEvent) => {
			if (e.button !== 0) return
			isDraggingCategory = true
			categoryHasDragged = false
			categoryDragStartX = e.clientX
			categoryDragStartScrollLeft = node.scrollLeft

			const onPointerMove = (me: PointerEvent) => {
				if (!isDraggingCategory) return
				const dx = me.clientX - categoryDragStartX
				if (!categoryHasDragged && Math.abs(dx) > 3) {
					categoryHasDragged = true
					node.classList.add("cursor-grabbing")
					node.classList.remove("cursor-grab")
				}
				if (categoryHasDragged) {
					node.scrollLeft = categoryDragStartScrollLeft - dx
					me.preventDefault()
				}
			}

			const onPointerUp = () => {
				isDraggingCategory = false
				window.removeEventListener("pointermove", onPointerMove)
				window.removeEventListener("pointerup", onPointerUp)
				window.removeEventListener("pointercancel", onPointerUp)

				node.classList.remove("cursor-grabbing")
				node.classList.add("cursor-grab")

				if (categoryHasDragged) {
					categoryJustDragged = true
					setTimeout(() => {
						categoryJustDragged = false
						categoryHasDragged = false
					}, 120)
				}
			}

			window.addEventListener("pointermove", onPointerMove)
			window.addEventListener("pointerup", onPointerUp)
			window.addEventListener("pointercancel", onPointerUp)
		}

		node.addEventListener("wheel", onWheel, { passive: false })
		node.addEventListener("pointerdown", onPointerDown)
		node.classList.add("cursor-grab")

		return {
			update() {
				updateOverflow()
			},
			destroy() {
				resizeObserver.disconnect()
				node.removeEventListener("wheel", onWheel)
				node.removeEventListener("pointerdown", onPointerDown)
			}
		}
	}

	onMount(() => {
		loadCodes()
	})

	onDestroy(() => {
		stopCodesRefresher()
	})
</script>
