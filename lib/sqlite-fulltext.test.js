"use strict";

const { expect } = require("chai");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

describe("full-text search store (no API key)", function () {
	this.timeout(30000);

	const logger = { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} };
	let mod;
	let provider;
	let dir;
	let db;

	before(async () => {
		mod = await import("./sqlite-fulltext.mjs");
		provider = await import("./ai-provider.mjs");
	});

	beforeEach(async () => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "kiwi-fts-"));
		db = new mod.FulltextSearchDB({ dbPath: dir, logger });
		await db.init();
		await db.write("hue.0.wohnzimmer.on", "Deckenlampe im Wohnzimmer, schaltet das Licht", {
			common: { name: "Wohnzimmerlampe" },
		});
		await db.write("mqtt.0.kueche.temp", "Temperatur in der Küche", {
			common: { name: { de: "Küche Temperatur" } },
		});
		await db.write("shelly.0.garage.door", "Garagentor offen oder geschlossen", { common: { name: "Garage" } });
	});

	afterEach(() => {
		db.close();
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it("is chosen by createVectorDB when no API key is configured", () => {
		const store = provider.createVectorDB({ provider: "openai", apiKey: "", dbPath: dir, logger });
		expect(store).to.be.instanceOf(mod.FulltextSearchDB);
		expect(
			provider.createVectorDB({ provider: "openai", apiKey: "sk-x", dbPath: dir, logger }),
		).to.not.be.instanceOf(mod.FulltextSearchDB);
	});

	it("finds words inside compound words and ignores case and umlauts", async () => {
		expect((await db.find("lampe")).map((r) => r.id)).to.deep.equal(["hue.0.wohnzimmer.on"]);
		expect((await db.find("KUCHE")).map((r) => r.id)).to.deep.equal(["mqtt.0.kueche.temp"]);
	});

	it("matches any keyword and ranks the best match first", async () => {
		const ids = (await db.find("Wie ist die Temperatur in der Garage?")).map((r) => r.id);
		expect(ids).to.have.members(["mqtt.0.kueche.temp", "shelly.0.garage.door"]);
		const best = await db.find("garage tor offen", 1);
		expect(best.map((r) => r.id)).to.deep.equal(["shelly.0.garage.door"]);
		expect(best[0].metadata).to.deep.equal({ common: { name: "Garage" } });
	});

	it("searches the name and the id as well", async () => {
		expect((await db.find("wohnzimmerlampe")).map((r) => r.id)).to.deep.equal(["hue.0.wohnzimmer.on"]);
		expect((await db.find("shelly")).map((r) => r.id)).to.deep.equal(["shelly.0.garage.door"]);
	});

	it("returns nothing for queries without usable words, also with FTS syntax characters", async () => {
		expect(await db.find("an im zu")).to.deep.equal([]);
		expect(await db.find('" OR * ( NEAR')).to.deep.equal([]);
		expect(await db.find('lampe" OR "x')).to.have.length(1);
	});

	it("updates, deletes and clears entries", async () => {
		await db.write("hue.0.wohnzimmer.on", "Stehleuchte im Flur", { common: { name: "Flur" } });
		expect(await db.find("lampe")).to.deep.equal([]);
		expect((await db.find("flur")).map((r) => r.id)).to.deep.equal(["hue.0.wohnzimmer.on"]);
		expect(await db.deleteItem("hue.0.wohnzimmer.on")).to.equal(true);
		expect(db.has("hue.0.wohnzimmer.on")).to.equal(false);
		expect(await db.find("flur")).to.deep.equal([]);
		expect(await db.deleteItem("hue.0.wohnzimmer.on")).to.equal(false);
		expect([...db.entries()]).to.deep.equal([
			["mqtt.0.kueche.temp", "Temperatur in der Küche"],
			["shelly.0.garage.door", "Garagentor offen oder geschlossen"],
		]);
		db.clear();
		expect(db.has("shelly.0.garage.door")).to.equal(false);
		expect(await db.find("garage")).to.deep.equal([]);
	});
});
