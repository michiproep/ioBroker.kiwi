"use strict";
const { GoogleGenAI } = require("@google/genai");
const utils = require("@iobroker/adapter-core");
//const MCPS = require("@holgerwill/iobroker-mcp-server");
// Load your modules here, e.g.:
// const fs = require("fs");

class McpServer extends utils.Adapter {
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: "mcp-server",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		//this.on("objectChange", this.onObjectChange.bind(this));
		this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	async onReady() {
		this.subscribeObjects(`system.adapter.${this.namespace}`);
		console.log(this.config);
		this.subscribeForeignObjects("*");

		import("@holgerwill/iobroker-mcp-server").then((MCPS) => {
			const server = new MCPS.IOBrokerMCPServerHttp({
				adapter: this,
				namespace: this.namespace,
				api: MCPS.ioBrokerAdapterApi,
				port: this.config.mcpPort,
				geminiApiKey: this.config.apiKey,
				dbPath: utils.getAbsoluteInstanceDataDir(this) + "/vectraIndex",
			});
			server.start();
			this.setState("info.connection", true, true);
		});

		//this.sendToUI("getGeminiModels", {}, (models) => {})
		//await this.setObjectNotExistsAsync("memory", { type: "channel", common: { name: "memory" }, native: {} });
		//this.server = new ExpressMCPServer({ adapter: this });
	}

	onUnload(callback) {
		try {
			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	onObjectChange(id, obj) {
		if (obj.type === "State" && obj.common.custom && obj.common.custom[this.namespace]) {
			this.log.info(
				`State ${id} has ${this.namespace} custom setting. it is ${obj.common.custom[this.namespace].enabled ? "enabled" : "disabled"}: ${JSON.stringify(obj.common.custom[this.namespace])}`,
			);
		}
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	//If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	/**
	 * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	 * Using this method requires "common.messagebox" property to be set to true in io-package.json
	 * @param {ioBroker.Message} obj
	 */
	/**
	 * Helper function to fetch and process models (avoids code duplication)
	 * @param {string} apiKey The API key to use
	 * @returns {Promise<Array<{value: string, label: string}>>}
	 */
	async fetchAndFilterGeminiModels(apiKey, modelType) {
		const models = [{ label: "Enter API Key & click Refresh", value: "" }];
		this.genAI = new GoogleGenAI({ apiKey: apiKey });
		const modelsPager = await this.genAI.models.list();

		for await (const m of modelsPager) {
			if (m.supportedActions && m.supportedActions.includes(modelType)) {
				models.push({ value: m.name || "", label: m.displayName || m.name || "none" });
			}
		}
		return models;
	}

	async onMessage(obj) {
		const apiKey = obj.message?.apiKey || this.config.apiKey;
		try {
			let models = [{ label: "Enter API Key & Save", value: "" }];
			switch (obj.command) {
				case "getGeminiModels": {
					if (!apiKey) return;
					models = await this.fetchAndFilterGeminiModels(apiKey, "generateContent");
					break;
				}
				case "getGeminiEmbeddingModels": {
					if (!apiKey) return;
					models = await this.fetchAndFilterGeminiModels(apiKey, "embedContent");
					break;
				}
				default:
					this.log.warn(`[onMessage] Unhandled command: ${obj.command}`);
					break;
			}
			this.sendTo(obj.from, obj.command, models, obj.callback);
		} catch (e) {
			this.log.error(`[onMessage] Error during command processing: ${e.message}`);
			this.sendTo(obj.from, obj.command, [{ label: `Error: ${e.message}`, value: "" }], obj.callback);
		}
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new McpServer(options);
} else {
	// otherwise start the instance directly
	new McpServer();
}
