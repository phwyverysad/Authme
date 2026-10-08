<SwitchGroup as="div" class="flex items-center space-x-3 select-none">
	<SwitchLabel class={classNames("text-base font-semibold text-slate-700 dark:text-slate-200", showLabel ? "visible" : "hidden")}>{checked ? "On" : "Off"}</SwitchLabel>

	<Switch
		as="button"
		{checked}
		{disabled}
		on:click
		on:change={handleChange}
		class={({ checked }) =>
			classNames(
				"relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
				checked
					? "bg-slate-900 border-slate-900 dark:bg-white dark:border-white"
					: "bg-slate-200 border-slate-300 dark:bg-transparent dark:border-white/80",
				disabled ? "opacity-50 cursor-not-allowed" : ""
			)}
		let:checked
	>
		<span
			class={classNames(
				"pointer-events-none relative left-0.5 top-[3px] inline-block h-4 w-4 transform rounded-full transition-all duration-200 ease-in-out shadow-sm",
				checked
					? "translate-x-[20px] bg-white dark:bg-black"
					: "translate-x-0 bg-slate-400 dark:bg-white"
			)}
		/>
	</Switch>
</SwitchGroup>

<script lang="ts">
	import { Switch, SwitchGroup, SwitchLabel } from "@rgossiaux/svelte-headlessui"
	import { createEventDispatcher } from "svelte"

	const dispatch = createEventDispatcher<{ change: boolean; click: MouseEvent }>()

	const classNames = (...classes: (string | false | null | undefined)[]) => {
		return classes.filter(Boolean).join(" ")
	}

	export let showLabel = true
	export let checked = false
	export let disabled = false
	export let controlled = false

	const handleChange = (event: CustomEvent<boolean>) => {
		if (!controlled) {
			checked = event.detail
		}
		dispatch("change", event.detail)
	}
</script>
