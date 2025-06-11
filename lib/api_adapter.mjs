//import { iobrokerRoleDescriptions } from "./iobrokerRoles.js";
// eslint-disable-next-line
import { VectorDB } from "./sqlite-vectorize.mjs";
import { Query } from "mingo";
//const delay = ms => new Promise(resolve => setTimeout(resolve, ms)); // Add this line

export class ioBrokerAdapterApi {
	constructor(options) {
		this.options = options;
		this.namespace = options.namespace || "kiwi.0";
		this.adapter = options.adapter;
		this.logger = options.logger || console;
		//this.adapter.on("objectChange", this.onObjectChange.bind(this));
		this.vectorDB = new VectorDB({
			logger: this.logger,
			apiKey: options.apiKey,
			embeddingModel: options.embeddingModdel,
			dimensionality: options.dimensionality,
			namespace: options.namespace,
			dbPath: options.dbPath,
		});
	}

	async init() {
		await this.vectorDB.init();
	}

	async search(text, filter = {}, limit = 10) {
		try {
			const items = await this.vectorDB.find(text, filter, limit);
			const results = await Promise.all(
				items.map(async (item) => {
					const state = await this.adapter.getForeignStateAsync(item.id);
					return { id: item.id, object: item.metadata, distance: item.distance, currentValue: state };
				}),
			);
			return results;
		} catch (error) {
			this.logger.error(`Search failed: ${error.message}`);
			return { status: "error", message: `Search failed: ${error.message}` };
		}
	}

	async mingoSearch(query, limit = 100, skip = 0) {
		const objects = await this.adapter.getForeignObjectsAsync("*");
		const q = new Query(query);
		const arr = Object.values(objects);
		//this.logger.debug(`---------------------------${arr.length}---------------------------------------`);
		const cursor = q.find(arr);
		return cursor.skip(skip).limit(limit).all();
	}

	async deleteItemFromIndex(id) {
		try {
			await this.vectorDB.deleteItem(id);
			return { status: "success", message: `Item with id ${id} deleted from index.` };
		} catch (error) {
			this.logger.error(`Failed to delete item with id ${id}: ${error.message}`);
			return { status: "error", message: `Failed to delete item with id ${id}: ${error.message}` };
		}
	}

	async getAllRooms() {
		return this.adapter.getEnumAsync("rooms");
	}

	async getAdapters() {
		return { status: "not implemented", message: `not implementd` };
	}
	async getRunningInstances() {}
	/* async search(args){
        args.type = args.type || "device, channel, state, folder";
        if (!args.searchterm) {
            args.searchterm = ""; // Default to empty string if not provided
        }
        if (!args.limit) {
            args.limit = 100; // Default limit
        }
        if (!args.page) {
            args.page = 0; // Default page
        }
        if (!args.instancePattern) {
            args.instancePattern = "*"; // Default instance pattern
        }
        if (!args.operator) {
            args.operator = "or"; // Default operator
        }
        // Ensure args.type is an object with keys as types
        let results = []
        const types = args.type.split(",").map(type => type.trim());
        for(let i = 0; i < types.length; i++) {
            const data = await this.fetch("/v1/objects",'GET',{filter: args.instancePattern, type:types[i] })
            results.push(searchHelper(data,args))
        }
        return results.flat().slice(args.limit*args.page,args.page*args.limit+args.limit);
    } */
	async getState(args) {
		try {
			const states = await this.adapter.getForeignStatesAsync(args.id);

			if (args.withInfo) {
				for (const key in states) {
					states[key].info = await this.adapter.getForeignObjectAsync(key);
				}
			}
			return states;
		} catch (error) {
			this.logger.error(`Error in getState: ${error}`);
			return { status: "error", error: `${error}` };
		}
	}
	async getStateBulk(args) {
		const ret = [];
		for (let i = 0; i < args.length; i++) {
			ret.push(await this.getState(args[i]));
		}
		return ret;
	}
	async setState(args) {
		try {
			await this.adapter.setForeignStateAsync(args.id, args.value, args.ack || false);
			const newState = await this.getState({ id: args.id });
			return { status: "success", state: newState };
		} catch (error) {
			this.logger.error(`Error in setState: ${error}`);
			return { status: "error", error: `${error}` };
		}
	}
	async setStateBulk(args) {
		const ret = [];
		for (let i = 0; i < args.length; i++) {
			ret.push(await this.setState(args[i]));
		}
		return ret;
	}
	async getStatesWithValues(_args) {
		return { status: "not implemented", message: `use getStateBulk with withInfo=true` };
		// return await this.fetch('/v1/states', 'GET', { filter: args.instancePattern || '*' });
	}
	async anotate(_args) {
		return { status: "not implemented", message: `use describe tool` };
		// let body = {"common":{"custom":{"kiwi.0":{"meta": args.anotation}}}}
		// return await this.fetch(`/v1/object/${args.id}`, 'PUT', {}, body);
	}
	async describe(args) {
		try {
			const body = JSON.parse(
				`{"common":{"custom": {"${this.namespace}":{"enabled":true, "description": "${args.desc}"}}}}`,
			);
			await this.adapter.extendForeignObjectAsync(args.id, body);
			const obj = await this.adapter.getForeignObjectAsync(args.id);
			return { status: "success", object: obj };
		} catch (error) {
			this.logger.error("Error in describe:", error);
			return { status: "error", error: `${error}` };
		}
		// if (!args.id || !args.desc) {
		// return await this.fetch(`/v1/object/${args.id}`, 'PUT', {}, body);
	}
	async describeBulk(args) {
		const ret = [];
		for (const arg of args) {
			ret.push(await this.describe(arg));
		}
		return ret;
	}

	async getObject(args) {
		try {
			const obj = await this.adapter.getForeignObjectAsync(args.id);
			return { status: "success", object: obj };
		} catch (error) {
			this.logger.error(`Error in getObject: ${error}`);
			return { status: "error", error: `${error}` };
		}
	}

	async setObject(args) {
		try {
			await this.adapter.extendForeignObjectAsync(args.id, args.obj);
			const obj = await this.adapter.getForeignObjectAsync(args.id);
			return { status: "success", object: obj };
		} catch (error) {
			this.logger.error(`Error in setObject: ${error}`);
			return { status: "error", error: `${error}` };
		}
	}

	async createState(_args) {
		return { status: "not implemented", message: `use setObject to create a states` };
	}
	async createScene(_args) {
		return { status: "not implemented", message: `not implemented` };
		// for scenes to work we need a custom script. check if it existst and if not create it
		// this.setObject({id:"script.js.mcp_scene_script",obj:{
		//     "type": "script",
		//     "common": {
		//     "name": "mcp_scene_script",
		//     "expert": true,
		//     "engineType": "Javascript/js",
		//     "enabled": true,
		//     "engine": "system.adapter.javascript.0",
		//     "source": "on(/^0_userdata.0.mcp_server.scene.*/,data=>{\r\n    if(data.state.val ==true){\r\n        setState(data.id,false,true)\r\n        let obj = getObject(data.id)\r\n        obj.native.members.forEach(m=>{\r\n            setState(m.id,m.value)\r\n        })\r\n    }\r\n})",
		//     "debug": false,
		//     "verbose": false
		//     },
		//     "native": {}
		// }})
		// const prefix = "0_userdata.0.mcp_server.scenes."
		// const ret = await this.createState({id:prefix + args.name, name: args.name, type: "boolean", role: "button.trigger",native:{members:args.members || []}});
		// this.setState({id:prefix + args.name, value: false}); // Initialize the scene state to false
		// return ret
	}

	async getHistory(args) {
		try {
			const defaults = {
				start: 0,
				end: 0,
				count: 0,
				aggregate: "none",
			};
			return this.adapter.getHistoryAsync(args.id, { ...defaults, ...args.options });
		} catch (error) {
			this.logger.error(`Error in getHistory: ${error}`);
			return { status: "error", error: `${error}` };
		}
	}

	async onObjectChange(id, obj) {
		if (
			obj.common.custom &&
			obj.common.custom[this.namespace] &&
			obj.common.custom[this.namespace].enabled == true &&
			obj.common.custom[this.namespace].description &&
			obj.type == "state"
		) {
			this.vectorDB.write(id, obj.common.custom[this.namespace].description, obj);
			this.logger.info(
				`[State Indexed] ${id} has ${this.namespace} custom setting. storing in Index: ${this.options.dbPath}`,
			);
		} else {
			try {
				await this.vectorDB.deleteItem(id);
			} catch (e) {
				this.logger.error(`Error deleting item from index: ${id} - ${e.message}`);
			}
		}
	}
}
