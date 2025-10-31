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
		this.logger = options.logger || options.adapter.log || console;
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
			const items = (await this.vectorDB.find(text, limit)) || [];
			const results = await Promise.all(
				items.map(async (item) => {
					const state = await this.adapter.getForeignStateAsync(item.id);
					return { id: item.id, object: item.metadata, distance: item.distance, currentValue: state };
				}),
			);
			const q = new Query(filter);
			return q.find(results).all();
		} catch (error) {
			this.logger.error(`Search failed: ${error.message}`);
			return { status: "error", message: `Search failed: ${error.message}` };
		}
	}

	async mingoSearch(query, limit = 100, skip = 0) {
		const types = [
			"state",
			"instance",
			"adapter",
			"device",
			"channel",
			"folder",
			"enum",
			"script",
			"config",
			"host",
			"user",
			"group",
		];
		this.logger.debug(`Starting mingoSearch with query: ${query}`);
		const objects = [];
		for (const type of types) {
			objects.push(...Object.values(await this.adapter.getForeignObjectsAsync("*", type)));
		}
		const q = new Query(query);
		const arr = Object.values(objects);
		//this.logger.debug(`---------------------------${arr.length}---------------------------------------`);
		const cursor = q.find(arr);
		var res = cursor.skip(skip).limit(limit).all();
		this.logger.debug(`mingoSearch found ${res} results.`);
		return res;
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
		return Object.values((await this.adapter.getEnumAsync("rooms")).result).map((room) => {
			return {
				name: !room.common.name.en ? room.common.name : room.common.name.en,
				id: room._id,
				members: room.common.members || [],
			};
		});
	}

	async getAdapters() {
		try {
			return await this.adapter.getForeignObjectsAsync("*", "adapter");
		} catch (error) {
			this.logger.error(`Error in getAdapters: ${error}`);
		}
	}

	async getRunningInstances() {
		try {
			return await this.mingoSearch({ type: "instance" });
		} catch (error) {
			this.logger.error(`Error in getAdapters: ${error}`);
		}
	}

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
			const stateObjectResult = await this.getObject({ id: args.id });

			if (
				stateObjectResult.status !== "success" ||
				!stateObjectResult.object ||
				!stateObjectResult.object.common
			) {
				return {
					status: "error",
					error: `State ${args.id} not found or has no common properties`,
				};
			}

			const convertedValue = this.autoConvertType(args.value, stateObjectResult.object);

			await this.adapter.setForeignStateAsync(args.id, convertedValue, args.ack || false);

			const newState = await this.getState({ id: args.id });
			const currentState = newState[args.id];

			return {
				status: currentState.ack ? "success" : "sent",
				state: newState,
			};
		} catch (error) {
			this.logger.error(`Error in setState: ${error}`);
			return { status: "error", error: `${error}` };
		}
	}

	autoConvertType(value, stateObject) {
		const actualType = typeof value;
		const expectedType = stateObject.common.type;

		if (actualType !== expectedType) {
			switch (expectedType) {
				case "boolean":
					if (actualType === "string" && (value === "true" || value === "false")) {
						return value === "true";
					}
					break;
				case "number":
					if (actualType === "string" && !isNaN(Number(value))) {
						return Number(value);
					}
					break;
				case "string":
					return String(value);
			}
		}

		return value; // No conversion needed/possible
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
		this.logger.info(`getHistory: ${args}`);
		try {
			const defaults = {
				start: 0,
				end: 0,
				count: 0,
				aggregate: "none",
			};
			return await this.adapter.getHistoryAsync(args.id, { ...defaults, ...args.options });
		} catch (error) {
			this.logger.error(`Error in getHistory: ${error}`);
			return { status: "error", error: `${error}` };
		}
	}
	async deleteObject(args) {
		try {
			await this.adapter.delForeignObjectAsync(args.id);
			return { status: "success", message: `Object with id ${args.id} deleted.` };
		} catch (error) {
			this.logger.error(`Failed to delete object with id ${args.id}: ${error.message}`);
			return { status: "error", message: `Failed to delete object with id ${args.id}: ${error.message}` };
		}
	}
	async readDir(args) {
		try {
			const files = await this.adapter.readDirAsync(this.namespace, args.path);
			return { status: "success", files: files };
		} catch (error) {
			this.logger.error(`Failed to read directory ${args.path}: ${error.message}`);
			return { status: "error", message: `Failed to read directory ${args.dir}: ${error.message}` };
		}
	}
	async readFile(args) {
		try {
			const fileContent = await this.adapter.readFileAsync(this.namespace, args.path);
			return { status: "success", content: fileContent };
		} catch (error) {
			this.logger.error(`Failed to read file ${args.path}: ${error.message}`);
			return { status: "error", message: `Failed to read file ${args.path}: ${error.message}` };
		}
		// return {status:"not implemented", message:`use readDir and readFile`};
	}
	async writeFile(args) {
		try {
			await this.adapter.writeFileAsync(this.namespace, args.path, args.content);
			return { status: "success", message: `File ${args.path} written successfully.` };
		} catch (error) {
			this.logger.error(`Failed to write file ${args.path}: ${error.message}`);
			return { status: "error", message: `Failed to write file ${args.path}: ${error.message}` };
		}
	}
	async fileExists(args) {
		try {
			const exists = await this.adapter.fileExistsAsync(this.namespace, args.path);
			return { status: "success", exists: exists };
		} catch (error) {
			this.logger.error(`Failed to check if file ${args.path} exists: ${error.message}`);
			return { status: "error", message: `Failed to check if file ${args.path} exists: ${error.message}` };
		}
	}
	async mkdir(args) {
		try {
			await this.adapter.mkdirAsync(this.namespace, args.path);
			return { status: "success", message: `Directory '${args.path}' created.` };
		} catch (error) {
			this.logger.error(`Failed to create directory ${args.path}: ${error.message}`);
			return { status: "error", message: `Failed to create directory ${args.path}: ${error.message}` };
		}
	}
	async renameFile(args) {
		try {
			await this.adapter.renameAsync(this.namespace, args.oldPath, args.newPath);
			return { status: "success", message: `File renamed from '${args.oldPath}' to '${args.newPath}'.` };
		} catch (error) {
			this.logger.error(`Failed to rename file from ${args.oldPath} to ${args.newPath}: ${error.message}`);
			return {
				status: "error",
				message: `Failed to rename file from ${args.oldPath} to ${args.newPath}: ${error.message}`,
			};
		}
	}
	async deleteFile(args) {
		try {
			await this.adapter.delFileAsync(this.namespace, args.path);
			return { status: "success", message: `File '${args.path}' deleted.` };
		} catch (error) {
			this.logger.error(`Failed to delete file ${args.path}: ${error.message}`);
			return { status: "error", message: `Failed to delete object with id ${args.id}: ${error.message}` };
		}
	}
}
