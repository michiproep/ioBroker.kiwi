"use strict";

const { expect } = require("chai");

describe("search index sync", () => {
	let syncSearchIndex;
	before(async () => {
		({ syncSearchIndex } = await import("./search-index.mjs"));
	});

	function fakeStore(initial) {
		const data = new Map(Object.entries(initial));
		/** @type {{ write: string[], deleteItem: string[] }} */
		const calls = { write: [], deleteItem: [] };
		return {
			data,
			calls,
			entries: () => new Map(data),
			write: async (id, text) => {
				if (text === "fails") {
					throw new Error("quota exceeded");
				}
				calls.write.push(id);
				data.set(id, text);
			},
			deleteItem: async (id) => {
				calls.deleteItem.push(id);
				return data.delete(id);
			},
		};
	}

	const logger = { warn: () => {} };
	const getObject = async (id) => (id === "gone.0.x" ? null : { _id: id });

	it("removes undescribed states, re-indexes only missing or changed descriptions", async () => {
		// state of the store when it was last in use (e.g. before the API key was removed)
		const store = fakeStore({ "a.0.same": "Lampe", "a.0.changed": "alter Text", "a.0.removed": "Garage" });
		const described = new Map([
			["a.0.same", "Lampe"],
			["a.0.changed", "neuer Text"],
			["a.0.new", "Heizung"],
		]);
		const result = await syncSearchIndex({ store, described, getObject, logger });

		expect(result).to.deep.equal({ indexed: 2, removed: 1, failed: 0 });
		expect(store.calls.write).to.have.members(["a.0.changed", "a.0.new"]);
		expect(store.calls.deleteItem).to.deep.equal(["a.0.removed"]);
		expect(Object.fromEntries(store.data)).to.deep.equal({
			"a.0.same": "Lampe",
			"a.0.changed": "neuer Text",
			"a.0.new": "Heizung",
		});
	});

	it("does nothing when the store is up to date", async () => {
		const store = fakeStore({ "a.0.same": "Lampe" });
		const result = await syncSearchIndex({ store, described: new Map([["a.0.same", "Lampe"]]), getObject, logger });
		expect(result).to.deep.equal({ indexed: 0, removed: 0, failed: 0 });
		expect(store.calls.write).to.deep.equal([]);
	});

	it("keeps going when single states cannot be indexed", async () => {
		const store = fakeStore({});
		const described = new Map([
			["a.0.bad", "fails"],
			["gone.0.x", "object deleted meanwhile"],
			["a.0.ok", "Licht"],
		]);
		const result = await syncSearchIndex({ store, described, getObject, logger });
		expect(result).to.deep.equal({ indexed: 1, removed: 0, failed: 1 });
		expect([...store.data.keys()]).to.deep.equal(["a.0.ok"]);
	});
});
