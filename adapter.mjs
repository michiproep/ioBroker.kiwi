import { Chatbot } from "./lib/chatbot.mjs";
import { syncSearchIndex } from "./lib/search-index.mjs";
import { PROVIDERS, createVectorDB, listChatModels, normalizeProvider, resolveModel } from "./lib/ai-provider.mjs";
// eslint-disable-next-line
import * as utils from "@iobroker/adapter-core";

// Load your modules here, e.g.:
// import fs from "node:fs";
class McpServer extends utils.Adapter {
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: "kiwi",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		this.on("objectChange", this.onObjectChange.bind(this));
		this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
		this.vectorDB = null;
		this._indexedObjects = new Map();
	}

	async onReady() {
		//const webInstance = this.config.webInstance == "*" ? "web.0" : this.config.webInstance;
		const newPath = utils.getAbsoluteInstanceDataDir(this);
		// Ensure the directory exists, including all ancestors

		//add all objects with custom.kiwi.description to the index
		const objects = await this.getForeignObjectsAsync("*");
		for (const [id, obj] of Object.entries(objects)) {
			try {
				const nsCustom = obj && obj.common && obj.common.custom && obj.common.custom[this.namespace];
				const enabled = !!(nsCustom && nsCustom.enabled);
				const description = nsCustom && nsCustom.description ? String(nsCustom.description) : null;
				// store normalized shape expected by onObjectChange
				this._indexedObjects.set(id, { enabled, description, type: obj?.type || null });
			} catch (e) {
				this.log.error(`[Kiwi Adapter] Error indexing object ${id}: ${e.message}`);
			}
		}

		try {
			await import("node:fs/promises").then((fs) => fs.mkdir(newPath, { recursive: true }));
			this.log.info(`[Kiwi Adapter] Ensured data directory exists: ${newPath}`);
		} catch (e) {
			this.log.error(`[Kiwi Adapter] Failed to create data directory: ${e.message}`);
		}
		if (this.config.dataDir !== newPath) {
			this.updateConfig({ dataDir: newPath, namespace: this.namespace });
			/* try {
				// 1. Get the current instance object
				const instanceObj = await this.getForeignObjectAsync(`system.adapter.${this.namespace}`);

				if (instanceObj) {
					instanceObj.native.dataDir = utils.getAbsoluteInstanceDataDir(this);
					instanceObj.native.namespace = this.namespace;
					await this.setForeignObject(`system.adapter.${this.namespace}`, instanceObj);
					this.log.info(
						`[Kiwi Adapter] Successfully updated 'myCustomDataPath' to '${newPath}'. Adapter will restart.`,
					);
					return;
				} else {
					this.log.error(`Could not find instance object for ${this.namespace}`);
				}
			} catch (e) {
				this.log.error(`Error updating configuration: ${e.message}`);
			} */
		}
		const provider = normalizeProvider(this.config.aiProvider);
		const hasKey = !!this.config.apiKey;
		if (hasKey) {
			this.log.info(`[Kiwi Adapter] AI provider: ${PROVIDERS[provider].label}`);
		} else {
			this.log.warn(
				`[Kiwi Adapter] No ${PROVIDERS[provider].label} API key configured: the chat bot is disabled and the state search uses full-text search instead of embeddings. The MCP server still works.`,
			);
		}
		// without an API key this is the full-text store (see createVectorDB)
		this.vectorDB = createVectorDB({
			provider,
			apiKey: this.config.apiKey,
			namespace: this.namespace,
			// the instance data dir itself: on the first start config.dataDir still holds the io-package default
			dbPath: newPath,
			logger: this.log,
		});
		await this.vectorDB.init();
		this.subscribeForeignObjects("*");
		this.log.info(`[Kiwi Adapter] register Object Change Listener`);
		this.setState("info.connection", { val: hasKey, ack: true });
		// the full-text store is cheap to build: rebuild it, so changes made while a key was set are not missed
		if (typeof this.vectorDB.clear === "function") {
			this.vectorDB.clear();
		}
		// only the active store follows object changes: after switching the provider or removing/entering the key,
		// bring it in line with the current descriptions in the background
		this.syncIndex().catch((e) => this.log.error(`[Kiwi Adapter] Syncing the search index failed: ${e.message}`));
		if (!hasKey) {
			return;
		}
		this.subscribeStates("chat.prompt");
		this.chatbot = new Chatbot({
			provider,
			apiKey: this.config.apiKey,
			modelName: resolveModel(provider, this.config.models),
			systemPrompt: this.config.systemPrompt,
			temperature: this.config.temperature ?? 0.7,
			adapter: this,
			logger: this.log,
			// the instance data dir itself: on the first start config.dataDir still holds the io-package default
			dbPath: newPath,
		});
		// Initialize
		await this.chatbot.init();
		//const api = this.chatbot.API;
	}

	async onStateChange(id, state) {
		this.log.info(`[Kiwi Adapter] State changed: ${id} to ${state.val}`);
		if (state && !state.ack) {
			const stateName = id.replace(`${this.namespace}.`, "");
			if (stateName === "chat.prompt") {
				const response = await this.chatbot?.prompt(state.val);
				this.setState("chat.response", {
					val: response,
					ack: true,
				});
			}
			this.setState(stateName, { val: state.val, ack: true });
		} else {
			this.log.debug(
				`[Kiwi Adapter] State ${id} changed to ${state ? state.val : "undefined"} (ack: ${state ? state.ack : "undefined"})`,
			);
		}
	}
	async onUnload(callback) {
		try {
			this.chatbot ? await this.chatbot.cleanup() : null;
			this.unsubscribeForeignObjectsAsync("*");
			this.unsubscribeStates("chat.prompt");
			callback();
		} catch (e) {
			callback();
		}
	}
	/**
	 * Brings the search store of the active provider in line with the current descriptions: removes states that are
	 * no longer described and (re-)indexes states that are missing or whose description changed. Only these cost
	 * embedding API calls.
	 */
	async syncIndex() {
		const described = new Map();
		for (const [id, entry] of this._indexedObjects) {
			if (entry.enabled && entry.description && entry.type === "state") {
				described.set(id, entry.description);
			}
		}
		const { indexed, removed } = await syncSearchIndex({
			store: this.vectorDB,
			described,
			getObject: (id) => this.getForeignObjectAsync(id),
			logger: this.log,
		});
		if (indexed || removed) {
			this.log.info(
				`[Kiwi Adapter] Search index synced: ${indexed} state(s) indexed, ${removed} no longer described state(s) removed.`,
			);
		}
	}

	async onObjectChange(id, obj) {
		try {
			// Deleted object
			if (!obj) {
				const prev = this._indexedObjects.get(id);
				if (prev && prev.enabled && this.vectorDB) {
					await this.vectorDB.deleteItem(id);
					this.log.info(`[Kiwi Adapter] Object deleted; removed from index: ${id}`);
				}
				this._indexedObjects.delete(id);
				return;
			}

			const nsCustom = obj.common && obj.common.custom && obj.common.custom[this.namespace];
			const enabled = !!(nsCustom && nsCustom.enabled);
			const description = nsCustom && nsCustom.description ? String(nsCustom.description) : null;
			const prev = this._indexedObjects.get(id) || { enabled: null, description: null };

			// Nothing changed with respect to our indexing-relevant fields
			if (prev.enabled === enabled && prev.description === description) {
				//this.log.(`[Kiwi Adapter] No index-relevant change for ${id}`);
				return;
			}

			// If enabled + description present -> write/update index
			if (enabled && description && obj.type === "state") {
				if (this.vectorDB) {
					await this.vectorDB.write(id, description, obj);
					this.log.info(`[Kiwi Adapter] State Indexed ${id} (updated): ${description}`);
				} else {
					this.log.warn(`[Kiwi Adapter] vectorDB not initialized; cannot write index for ${id}.`);
				}
				this._indexedObjects.set(id, { enabled, description, type: obj.type });
				return;
			}

			// Otherwise remove from index if it was previously indexed
			if (prev.enabled && this.vectorDB) {
				await this.vectorDB.deleteItem(id);
				this.log.info(`[Kiwi Adapter] Removed from index: ${id}`);
			}
			this._indexedObjects.set(id, { enabled, description, type: obj.type });
		} catch (e) {
			this.log.error(`[Kiwi Adapter] Error handling object change for ${id}: ${e.message}`);
		}
	}
	//If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	/**
	 * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	 * Using this method requires "common.messagebox" property to be set to true in io-package.json
	 * @param {ioBroker.Message} obj
	 */

	async onMessage(obj) {
		this.log.debug(`[Kiwi Adapter onMessage] Received command: ${obj.command}`);
		try {
			// the settings page sends the current (possibly unsaved) provider and key
			const message = obj.message && typeof obj.message === "object" ? obj.message : {};
			const provider = normalizeProvider(message.provider || this.config.aiProvider);
			const apiKey = message.apiKey || this.config.apiKey;
			let models = [{ label: "Enter API Key", value: "" }];
			switch (obj.command) {
				case "getModels":
				case "getGeminiModels": {
					if (apiKey) {
						models = await listChatModels(provider, apiKey);
					}
					break;
				}
				default:
					this.log.warn(`[Kiwi Adapter onMessage] Unhandled command: ${obj.command}`);
					break;
			}
			this.sendTo(obj.from, obj.command, models, obj.callback);
		} catch (e) {
			this.log.error(`[Kiwi Adapter onMessage] Error during command processing: ${e.message}`);
			this.sendTo(obj.from, obj.command, [{ label: `Error: ${e.message}`, value: "" }], obj.callback);
		}
	}
}

export default (options) => new McpServer(options);
export { McpServer };
