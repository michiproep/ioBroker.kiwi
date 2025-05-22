"use strict";

//import { z } from "zod";
/*
 * Created with @iobroker/create-adapter v2.6.5
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const ExpressMCPServer = require("./lib/mcp-server.js").ExpressMCPServer;
const server = null;
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
		this.on("objectChange", this.onObjectChange.bind(this));
		// this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
		this.server = null;
		this.autodetectedDevices = {};
	}
	async listObjectsWithSettings(cb) {
		const objects = await this.getForeignObjectsAsync("*", "state");
		for (const id in objects) {
			const obj = objects[id];
			if (
				obj.common &&
				obj.common.custom &&
				obj.common.custom[this.namespace] &&
				obj.common.custom[this.namespace].enabled == true
			) {
				cb(id, obj.common);
			}
		}
	}
	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		this.subscribeObjects(`system.adapter.${this.namespace}`);

		this.subscribeForeignObjects("*");

		await this.setObjectNotExistsAsync("memory", { type: "channel", common: { name: "memory" }, native: {} });
		this.server = new ExpressMCPServer({ adapter: this });
		this.listObjectsWithSettings((id, obj) => {
			//this.server.addtool(id, obj);
		});

		this.server.start();

		try {
			const enums = await this.getEnumAsync("functions");
			if (enums) {
				for (const enumId in enums.result) {
					const functions = enums.result[enumId];
					functions.common.members.forEach((member) => {
						this.getForeignObject(member, (err, obj) => {
							if (err) {
								this.log.error(`Error getting object ${member}: ${err}`);
							} else {
								if (Object.prototype.hasOwnProperty.call(this.autodetectedDevices, member)) {
									this.autodetectedDevices[member].functions.push(functions.common.name.en);
								} else {
									this.autodetectedDevices[member] = {
										definition: obj,
										functions: [functions.common.name.en],
									};
								}

								this.log.info(`Object ${member}: ${JSON.stringify(obj)}`);
							}
						});
					});
				}
			} else {
				this.log.warn("No enums found");
			}
		} catch (err) {
			this.log.error(`Error getting enums: ${err}`);
		}
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);

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
		/* if (obj.common && obj.common.custom && obj.common.custom[this.namespace]) {
			if (this.server.tools[id]) {
				this.server.removetool(id);
				this.server.addtool(id, obj.common);
				console.log("object changed, delting and readding it");
			} else {
				this.server.addtool(id, obj.common);
				console.log("object added");
			}
		} else {
			if (this.server.tools[id]) {
				this.server.removetool(id);
				this.log.info(`object ${id} deleted`);
			}
		} */
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

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === "object" && obj.message) {
	// 		if (obj.command === "send") {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info("send command");

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
	// 		}
	// 	}
	// }
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
