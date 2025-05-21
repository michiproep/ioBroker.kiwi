const express = require("express");
const app = express();
const Transport = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const MCP = require("@modelcontextprotocol/sdk/server/mcp.js");
const z = require("zod");
let crypto = require("crypto");

const server = new MCP.McpServer({
	name: "iobroker-mcp-server",
	version: "0.0.1",
	capabilities: { tools: true },
});

let transport = null;

const getSchemaDefinitionForValue = (obj) => {
	switch (obj.type) {
		case "string":
			return z.string().describe(`a string value of a ${obj.role}`);
		case "number":
			return z
				.number()
				.describe(`a number value of a ${obj.role}: ${obj.min ? obj.min : "*"} - ${obj.max ? obj.max : "*"}`);
		case "boolean":
			return z.boolean().describe(`a boolean value of a ${obj.role}: true/false`);
		case "object":
			return z.record(z.any()).describe(`a JSON Object representation of a ${obj.role}`);
		case "array":
			return z.array(z.any()).describe(`a JSON Array representation of a ${obj.role}`);
		case "null":
			return z.null().describe(`an empty value of ${obj.role}`);
		default:
			return z.unknown().describe("The value to set");
	}
};

class ExpressMCPServer {
	constructor(options) {
		this.options = options;
		this.server = null;
		this.tools = {};
		this.miscTools();
	}
	async addtool(name, obj) {
		const tool = obj.custom[this.options.adapter.namespace];
		//console.log(name, obj);
		this.tools[name] = {};
		const hash = name.replace("ü", "ue");
		this.tools[name].getter = server.tool(
			"get_" + hash.replace(/\./g, "___"),
			{},
			{
				description: `GET the current state. name: ${obj.name} role: ${obj.role} type: ${obj.type}  ${tool.description}`,
			},
			async () => {
				const ret = await this.options.adapter.getForeignStateAsync(name);
				return {
					content: [
						{
							type: "text",
							text: ret.val.toString(),
						},
					],
				};
			},
		);
		// if tool setter is enabled create it here
		if (tool.enable_setter) {
			//console.log("create setter for " + obj);
			this.tools[name].setter = server.tool(
				"set_" + hash.replace(/\./g, "___"),
				{ value: getSchemaDefinitionForValue(obj) },
				{
					description: `SET the current state. name: ${obj.name} role: ${obj.role} type: ${obj.type}  ${tool.description}`,
				},
				async (args, _extra) => {
					await this.options.adapter.setForeignStateAsync(name, args.value);
					return {
						content: [
							{
								type: "text",
								text: `State set: ${args.value}`,
							},
						],
					};
				},
			);
		}
	}
	async removetool(name) {
		this.tools[name].getter.remove();
		if (this.tools[name].setter) this.tools[name].setter.remove();
		delete this.tools[name];
	}

	async miscTools() {
		server.tool(
			"get_all_state_IDs",
			{},
			{
				description:
					"this function returns all state IDs that available to you and information how to use them with the getState and setState tool. states can be added dynamicly. if you can not find a state at some point rerun this function to see if there are new states.",
			},
			async () => {
				const objects = await this.options.adapter.getForeignObjectsAsync("*", "state");
				const states = [];
				for (const id in objects) {
					const obj = objects[id];
					if (
						obj.common &&
						obj.common.custom &&
						obj.common.custom[this.options.adapter.namespace] &&
						obj.common.custom[this.options.adapter.namespace].enabled == true
					) {
						states.push({
							id: id,
							name: obj.common.name,
							role: obj.common.role,
							type: getSchemaDefinitionForValue(obj.common),
							description: obj.common.custom[this.options.adapter.namespace].description,
						});
					}
				}
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(states),
						},
					],
				};
			},
		);
		server.tool(
			"getState",
			{ id: z.string().describe("The ID of the state to get") },
			{
				description:
					"with this function you can retrieve the current value of a state. pass the ID of the state as a parameter. the ID must be a valid state ID. you can get all valid ids available to you by using the get_all_state_IDs tool. the user can provide state ID in the context as well",
			},
			async (args) => {
				const state = await this.options.adapter.getForeignStateAsync(args.id);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(state),
						},
					],
				};
			},
		);
		server.tool(
			"getObject",
			{ id: z.string().describe("The ID of the object to get") },
			{
				description: `This function retrieves the metadata of a specific ioBroker object.

Parameters:
  - id (string): The ID of the object to retrieve. Examples:
      - 'system.adapter.admin.0': The admin adapter instance object.
      - 'hue.0.lights.livingroom.brightness': A state object representing the brightness of a light.
      - 'enum.rooms.livingroom': An enum object representing the living room.

The function returns a JSON object containing the object's metadata, such as its type, common properties (name, description, role), and native properties. Use this information to understand the characteristics and capabilities of the object.`,
			},
			async (args) => {
				const state = await this.options.adapter.getForeignObjectAsync(args.id);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(state),
						},
					],
				};
			},
		);
		server.tool(
			"getObjects",
			{
				pattern: z.string().describe("the pattern of the objects to get. for example 'hue.0.*' or 'hue.*'"),
				type: z
					.string()
					.describe(
						"the type of object to get. valid values are: state, channel, device, enum, folder, adapter,instance, meta, user, group, script",
					),
			},
			{
				description: `This function retrieves a list of ioBroker objects matching a specified pattern and type. It's useful for discovering devices, channels, states, or other entities within the ioBroker system.

Parameters:
  - pattern (string): A glob-style pattern used to filter object IDs. Examples:
      - 'hue.0.*':  All objects under the 'hue.0' adapter instance.
      - 'hue.*.state': All objects with 'state' in their ID under any 'hue' adapter instance.
      - '*.temperature': All objects ending in '.temperature'.
      - '*': All objects in the system (use with caution, as this can return a large number of results).
  - type (string, optional): The type of ioBroker object to retrieve. Valid values are:
      - 'state': Data points with values (e.g., temperature, switch status).
      - 'channel': Logical groupings of states (often representing a device or function).
      - 'device': Physical devices or services.
      - 'enum': Enumerations like rooms or functions.
      - 'folder': Organizational folders.
      - 'adapter': Adapter objects.
      - 'instance': Adapter instance objects.
      - 'meta': Metadata objects.
      - 'user': User objects.
      - 'group': Group objects.
      - 'script': Script objects.

If the 'type' parameter is omitted, objects of all types matching the pattern will be returned.

The function returns a JSON object where the keys are the object IDs and the values are the corresponding object definitions. Use this information to understand the properties and capabilities of the discovered objects.`,
			},
			async (args) => {
				const objects = await this.options.adapter.getForeignObjectsAsync(args.pattern, args.type);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(objects),
						},
					],
				};
			},
		);
		server.tool(
			"getStates",
			{
				pattern: z
					.string()
					.describe(
						"pattern of the form 'part.*' or 'part.*.state' or '*.part' or even just '*' to get all states",
					),
			},
			{
				description:
					"with this function you can retreive all states matching a pattern. the pattern must be a valid state ID pattern in the form hue.0.some_name.* or hue.0.*.on or *.on etc. you can get all states by passing '*'.",
			},
			async (args) => {
				const states = await this.options.adapter.getForeignStatesAsync(args.pattern);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(states),
						},
					],
				};
			},
		);
		server.tool(
			"getEnums",
			{
				name: z
					.string()
					.describe(
						"the name of the enum to get. possible valid value are 'rooms' and 'functions'. these are the default values. usere may have addet more. so on user request you can pass ozher values",
					),
			},
			{
				description:
					"this function returns metadate for enums ('rooms','functions') and all their members. with this tool you can find out in wich room a device is locted: getEnum('rooms') ; which purpose it serves: getEnum('functions')",
			},
			async (args) => {
				const enums = await this.options.adapter.getEnumAsync(args.name);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(enums),
						},
					],
				};
			},
		);
		server.tool(
			"setState",
			{
				id: z.string().describe("The ID of the state to get"),
				value: z.unknown().describe("The value to set."),
			},
			{
				description:
					"with this function you can set value of a state. pass the ID of the state and the desired value as parameters. the ID must be a valid state ID. you can get all valid ids and their corresponding valid values (or value types)  by using the get_all_state_IDs tool. the user can provide state ID in the context as well. you can allways ask the user about value types and valid values if neccessary",
			},
			async (args) => {
				try {
					const obj = await this.options.adapter.getForeignObjectAsync(args.id);
					if (!obj || !obj.common) {
						throw new Error(`State with ID ${args.id} not found or invalid object`);
					}

					let value = args.value;
					switch (obj.common.type) {
						case "boolean":
							if (typeof value === "string") {
								if (value.toLowerCase() === "true") {
									value = true;
								} else if (value.toLowerCase() === "false") {
									value = false;
								} else {
									throw new Error(`Invalid boolean value: ${value}`);
								}
							} else if (typeof value !== "boolean") {
								throw new Error(`Expected boolean value, but got ${typeof value}`);
							}
							break;
						case "number":
							if (typeof value === "string") {
								const num = parseFloat(value);
								if (isNaN(num)) {
									throw new Error(`Invalid number value: ${value}`);
								}
								value = num;
							} else if (typeof value !== "number") {
								throw new Error(`Expected number value, but got ${typeof value}`);
							}
							break;
						case "string":
							value = String(value);
							break;
						default:
							// No conversion needed for other types (object, array, etc.)
							break;
					}

					await this.options.adapter.setForeignStateAsync(args.id, value);
					return {
						content: [
							{
								type: "text",
								text: `State ${args.id} set to ${value}`,
							},
						],
					};
				} catch (error) {
					this.options.adapter.log.error(`Error setting state ${args.id}: ${error.message}`);
					return {
						content: [
							{
								type: "text",
								text: `Error setting state: ${error.message}`,
							},
						],
					};
				}
			},
		);
	}

	async handleRequest(req, res) {
		// In stateless mode, create a new instance of transport and server for each request
		// to ensure complete isolation. A single instance would cause request ID collisions
		// when multiple clients connect concurrently.
		console.log("Received MCP request");
		try {
			transport = new Transport.StreamableHTTPServerTransport({
				sessionIdGenerator: undefined,
			});
			res.on("close", () => {
				console.log("Request closed");
				transport.close();
				server.close();
			});
			await server.connect(transport);
			await transport.handleRequest(req, res, req.body);
		} catch (error) {
			console.error("Error handling MCP request:", error);
			if (!res.headersSent) {
				res.status(500).json({
					jsonrpc: "2.0",
					error: {
						code: -32603,
						message: "Internal server error",
					},
					id: null,
				});
			}
		}
	}
	async start() {
		app.use(express.json());

		this.server = new MCP.McpServer({
			name: "iobroker-mcp-server",
			version: "0.0.1",
			capabilities: { tools: true },
		});

		app.post("/mcp", this.handleRequest);

		app.post("/sse", this.handleRequest);
		app.post("/message", this.handleRequest);

		app.post("/tool", this.handleRequest);
		app.get("/mcp", async (req, res) => {
			console.log("Received GET MCP request");
			res.writeHead(405).end(
				JSON.stringify({
					jsonrpc: "2.0",
					error: {
						code: -32000,
						message: "Method not allowed.",
					},
					id: null,
				}),
			);
		});

		app.delete("/mcp", async (req, res) => {
			console.log("Received DELETE MCP request");
			res.writeHead(405).end(
				JSON.stringify({
					jsonrpc: "2.0",
					error: {
						code: -32000,
						message: "Method not allowed.",
					},
					id: null,
				}),
			);
		});

		app.listen(this.options.adapter.config.port, () => {
			this.options.adapter.log.info(
				`MCP Streamable HTTP Server is listening on port ${this.options.adapter.config.port}`,
			);
		});
	}
}

module.exports = {
	ExpressMCPServer,
};
