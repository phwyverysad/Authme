<div class="transparent-900 loadedCodes mx-auto my-6 sm:my-10 md:my-16 w-[96%] sm:w-[94%] md:w-[92%] lg:w-[90%] xl:w-4/5 max-w-7xl rounded-2xl p-4 sm:p-6 md:p-8 lg:p-10 text-left">
	<h1 class="px-2 sm:px-4 md:px-6">{language.edit.editCodes}</h1>
	<div class="edit-content mx-auto flex flex-col items-center justify-center rounded-2xl p-1 sm:p-4 md:p-6 w-full" />
</div>

<script lang="ts">
	import { onMount } from "svelte"
	import { loadSavedCodes } from "./index"
	import { getLanguage, currentLanguage } from "@utils/language"

	let language = getLanguage()
	$: language = $currentLanguage || getLanguage()

	onMount(() => {
		loadSavedCodes()
	})
</script>
