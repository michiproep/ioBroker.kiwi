/**
 * Brings a search store (vector or full-text) in line with the current descriptions: removes states that are no
 * longer described and (re-)indexes states that are missing or whose description changed. Unchanged entries are
 * kept, so only real changes cost embedding API calls.
 *
 * @param {object} options
 * @param {{ entries(): Map<string, string>, write(id: string, text: string, obj: any): Promise<any>, deleteItem(id: string): Promise<boolean> }} options.store
 * @param {Map<string, string>} options.described current description per described state id
 * @param {(id: string) => Promise<any>} options.getObject
 * @param {{ warn: Function }} options.logger
 * @returns {Promise<{ indexed: number, removed: number, failed: number }>}
 */
export async function syncSearchIndex({ store, described, getObject, logger }) {
	const stored = store.entries();
	let removed = 0;
	for (const id of stored.keys()) {
		if (!described.has(id)) {
			await store.deleteItem(id);
			removed++;
		}
	}
	let indexed = 0;
	let failed = 0;
	for (const [id, description] of described) {
		if (stored.get(id) === description) {
			continue;
		}
		try {
			const obj = await getObject(id);
			if (obj) {
				await store.write(id, description, obj);
				indexed++;
			}
		} catch (e) {
			failed++;
			logger.warn(`[Kiwi Adapter] Could not index ${id}: ${e.message}`);
		}
	}
	return { indexed, removed, failed };
}
