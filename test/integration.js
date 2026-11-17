const path = require("node:path");
const { tests } = require("@iobroker/testing");
const { expect } = require("chai");

// Run tests
tests.integration(path.join(__dirname, ".."), {
	// If the adapter may call process.exit during startup, define here which exit codes are allowed.
	// By default, termination during startup is not allowed.
	allowedExitCodes: [11],

	// Always test against the latest js-controller
	controllerVersion: "latest",

	defineAdditionalTests({ suite }) {
		suite("Startup without API key", (getHarness) => {
			let harness;
			before(() => {
				harness = getHarness();
			});

			it("starts, keeps running and reports not connected", async function () {
				this.timeout(60000);
				await harness.startAdapterAndWait();
				// give onReady time to finish
				await new Promise((resolve) => setTimeout(resolve, 5000));

				expect(harness.isAdapterRunning()).to.equal(true);
				const state = await harness.states.getStateAsync("kiwi.0.info.connection");
				expect(state && state.val).to.equal(false);
			});
		});

		suite("Full-text search without API key", (getHarness) => {
			let harness;
			before(() => {
				harness = getHarness();
			});

			function describedState(name, description) {
				return {
					type: "state",
					common: {
						name,
						type: "boolean",
						role: "switch",
						read: true,
						write: true,
						custom: { "kiwi.0": { enabled: true, description } },
					},
					native: {},
				};
			}

			it("indexes described states at startup and on change", async function () {
				this.timeout(90000);
				// described before the start: indexed by the rebuild at startup
				await harness.objects.setObjectAsync(
					"javascript.0.test.lamp",
					describedState("Wohnzimmerlampe", "Deckenlampe im Wohnzimmer"),
				);
				await harness.startAdapterAndWait();
				await new Promise((resolve) => setTimeout(resolve, 5000));
				// described while running: indexed by onObjectChange
				await harness.objects.setObjectAsync(
					"javascript.0.test.door",
					describedState("Garage", "Garagentor offen oder geschlossen"),
				);
				await new Promise((resolve) => setTimeout(resolve, 3000));

				const { FulltextSearchDB } = await import("../lib/sqlite-fulltext.mjs");
				const store = new FulltextSearchDB({
					dbPath: path.join(harness.testDir, "iobroker-data", "kiwi.0"),
					logger: { info: () => {}, error: () => {} },
				});
				await store.init();
				try {
					expect((await store.find("lampe")).map((r) => r.id)).to.deep.equal(["javascript.0.test.lamp"]);
					expect((await store.find("garagentor")).map((r) => r.id)).to.deep.equal(["javascript.0.test.door"]);

					// description removed while running: no longer found
					/** @type {any} */
					const lamp = describedState("Wohnzimmerlampe", "Deckenlampe im Wohnzimmer");
					lamp.common.custom = { "kiwi.0": null };
					await harness.objects.setObjectAsync("javascript.0.test.lamp", lamp);
					await new Promise((resolve) => setTimeout(resolve, 3000));
					expect(await store.find("lampe")).to.deep.equal([]);
				} finally {
					store.close();
				}
			});
		});
	},
});
