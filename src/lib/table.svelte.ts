/**
 * Minimal Svelte 5 runes glue for @tanstack/table-core (stable v8).
 * The framework-agnostic core plus ~40 lines of glue has fewer moving parts
 * than a framework adapter — chosen deliberately for longevity.
 */
import {
	createTable,
	getCoreRowModel,
	getSortedRowModel,
	type RowData,
	type TableOptions,
	type TableOptionsResolved,
	type TableState,
	type Updater
} from '@tanstack/table-core';

type Options<TData extends RowData> = Omit<
	TableOptions<TData>,
	'getCoreRowModel' | 'state' | 'onStateChange' | 'renderFallbackValue'
>;

export function createSvelteTable<TData extends RowData>(getOptions: () => Options<TData>) {
	let state = $state<Partial<TableState>>({ sorting: [] });

	function applyUpdater<T>(updater: Updater<T>, current: T): T {
		return typeof updater === 'function' ? (updater as (old: T) => T)(current) : updater;
	}

	const table = $derived.by(() => {
		const resolved: TableOptionsResolved<TData> = {
			...getOptions(),
			state,
			onStateChange: (updater) => {
				state = applyUpdater(updater, { ...(state as TableState) });
			},
			getCoreRowModel: getCoreRowModel(),
			getSortedRowModel: getSortedRowModel(),
			renderFallbackValue: null
		};
		const instance = createTable(resolved);
		instance.setOptions((prev) => ({ ...prev, ...resolved, state: { ...instance.initialState, ...state } }));
		return instance;
	});

	return {
		get table() {
			return table;
		}
	};
}
