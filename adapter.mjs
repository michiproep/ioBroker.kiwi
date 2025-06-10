import { GoogleGenAI } from "@google/genai";
import { Chatbot } from "./lib/chatbot.mjs";

// eslint-disable-next-line
import * as utils from "@iobroker/adapter-core";
// Load your modules here, e.g.:
// import fs from "fs";
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
		this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	async onReady() {
		//const webInstance = this.config.webInstance == "*" ? "web.0" : this.config.webInstance;
		const newPath = utils.getAbsoluteInstanceDataDir(this);
		// Ensure the directory exists, including all ancestors
		try {
			await import("fs/promises").then((fs) => fs.mkdir(newPath, { recursive: true }));
			this.log.info(`[Kiwi Adapter] Ensured data directory exists: ${newPath}`);
		} catch (e) {
			this.log.error(`[Kiwi Adapter] Failed to create data directory: ${e.message}`);
		}
		if (this.config.dataDir !== newPath) {
			try {
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
			}
		}
		this.subscribeObjects("*");
		this.subscribeStates("chat.prompt");
		this.subscribeForeignObjects("*");
		this.setState("info.connection", { val: true, ack: true });
		this.chatbot = new Chatbot({
			apiKey: this.config.apiKey,
			modelName: this.config.models,
			systemPrompt: this.config.systemPrompt,
			temperature: this.config.temperature || 0.7,
			adapter: this,
			dbPath: this.config.dataDir + "/vectraIndex",
		});
		// Initialize
		await this.chatbot.init();
	}

	async onStateChange(id, state) {
		this.log.info(`State changed: ${id} to ${state.val}`);
		if (state && !state.ack) {
			const stateName = id.replace(`${this.namespace}.`, "");
			//this.log.info(`Ack: ${stateName} to ${state.val}`);
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
				`State ${id} changed to ${state ? state.val : "undefined"} (ack: ${state ? state.ack : "undefined"})`,
			);
		}
	}
	async onUnload(callback) {
		try {
			this.chatbot ? await this.chatbot.cleanup() : null;
			callback();
		} catch (e) {
			callback();
		}
	}
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
	//If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	/**
	 * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	 * Using this method requires "common.messagebox" property to be set to true in io-package.json
	 * @param {ioBroker.Message} obj
	 */

	async onMessage(obj) {
		this.log.info(`[onMessage] Received command: ${JSON.stringify(obj)} `);
		try {
			const apiKey = this.config.apiKey;
			let models = [{ label: "Enter API Key & Save", value: "" }];
			switch (obj.command) {
				case "getGeminiModels": {
					if (!apiKey) return;
					models = await this.fetchAndFilterGeminiModels(apiKey, "generateContent");
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

export default (options) => new McpServer(options);
export { McpServer };
