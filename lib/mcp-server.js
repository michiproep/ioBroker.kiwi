const express = require("express");
const app = express();
const Transport = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const MCP = require("@modelcontextprotocol/sdk/server/mcp.js");
const z = require("zod");
//let crypto = require("crypto");

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
		this.createTools();
	}

	async createTools() {
		server.tool(
			"init",
			{},
			{
				description: `this function is essential to understand the API, Tools ect. it provides you with basic information about how to do things. ALLWAYS CALL THIS FIRST! this has to be called once per session.`,
			},
			async () => {
				const functions = await this.options.adapter.getEnumAsync("functions");
				const rooms = await this.options.adapter.getEnumAsync("rooms");
				const memory = await this.options.adapter.getStatesAsync("mcp-server.0.memory.*");
				const states = [
					{
						id: this.options.adapter.namespace,
						description:
							"base namespace of this adapter. create all obect in here if not otherwise told to",
					},
					{
						id: this.options.adapter.namespace + ".memory",
						description: `this is where you can create states to store information you get about this system during conversation. 
							so you keep the information accross sessions. remember to use cretateObject to create the state first before you can use it`,
					},
				];
				return {
					content: [
						{
							type: "text",
							text: `this is an API to access and controll an IOBroker system. 

							Rooms: ${JSON.stringify(rooms)}

							Functions: ${JSON.stringify(functions)}

							States: ${JSON.stringify(states)}
							
							Memory: ${JSON.stringify(memory)}
							
							`,
						},
					],
				};
			},
		);

		server.tool(
			"getState",
			{ id: z.string().describe("The ID of the state to retrieve") },
			{
				description: `This function retrieves the current value and metadata of a specific ioBroker state.

Parameters:
  - id (string): The ID of the state to retrieve. This must be a valid state ID. You can obtain a list of valid state IDs using the get_all_state_IDs tool. The user can also provide the state ID in the context.

The function returns a JSON object containing the state's value, timestamp, quality, and other metadata.`,
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
			{ id: z.string().describe("The ID of the object to retrieve") },
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
		console.log(`obj.common.custom.['${this.options.adapter.namespace}']`);
		server.tool(
			"setObject",
			{
				id: z.string().describe("The ID of the object to create or update"),
				obj: z.record(z.any()).describe("The object definition to set"),
			},
			{
				description: `This function creates or updates an ioBroker object with the specified ID. It's primarily intended for storing custom information or metadata related to states, devices, or other entities within the ioBroker system.

Parameters:
  - id (string): The ID of the object to create or update. This must be a valid object ID. Examples:
      - 'system.adapter.myadapter.0.myCustomObject': A custom object under your adapter's instance.
      - 'hue.0.lights.livingroom.myCustomInfo': Custom information related to a specific device.
  - obj (object): A JSON object containing the object definition to set. This object should conform to the ioBroker object structure.  Use "obj.common.custom.['${this.options.adapter.namespace}'].info" to store information specific to your adapter. You can structure the info as plain text or structured JSON. General information that should persist across multiple sessions should be stored under "system.adapter.${this.namespace}.*", expanding this object with further states and channels as needed.

  **Note:** when in doubt allways create objects in the current adapter's namespace 'mcp-server.0' (!!!!). You can specify a different namespace by including it in the object ID.

  **Valid Object Types:**
  The \`type\` property of the object can be one of the following values:
    - \`"state"\`: A data point with a value (e.g., temperature, switch status).
    - \`"channel"\`: A logical grouping of states (often representing a device or function).
    - \`"device"\`: A physical device or service.
    - \`"enum"\`: An enumeration like rooms or functions.
    - \`"folder"\`: An organizational folder.
    - \`"adapter"\`: An adapter object.
    - \`"instance"\`: An adapter instance object.
    - \`"meta"\`: A metadata object.
    - \`"user"\`: A user object.
    - \`"group"\`: A group object.
    - \`"script"\`: A script object.

  **Valid State Types:**
  If the object type is \`"state"\`, the \`common.type\` property can be one of the following values:
    - \`"string"\`: A text value.
    - \`"number"\`: A numerical value.
    - \`"boolean"\`: A true/false value.
    - \`"object"\`: A JSON object.
    - \`"array"\`: A JSON array.
    - \`"mixed"\`: A value of any type.
    - \`"null"\`: A null value.

  **Valid State Roles:**
  If the object type is \`"state"\`, the \`common.role\` property should be one of the following values (or a custom role):
    - \`"value"\`: A generic value.
    - \`"value.temperature"\`: A temperature value.
    - \`"switch"\`: An on/off switch.
    - \`"button"\`: A momentary button.
    - \`"indicator"\`: A generic indicator.
    - See [ioBroker documentation](https://github.com/ioBroker/ioBroker/blob/master/doc/STATE_ROLES.md) for a complete list.

  **Examples of ioBroker Objects:**
  \`\`\`json
  // Example of a state object
  {
    "type": "state",
    "common": {
      "name": "My Custom State",
      "type": "number",
      "role": "value",
      "unit": "°C",
      "read": true,
      "write": true,
      "def": 20,
      "custom": {
        "myadapter.0": {
          "enabled": true,
          "description": "A custom state for my adapter"
        }
      }
    },
    "native": {}
  }
  \`\`\`

  \`\`\`json
  // Example of a channel object
  {
    "type": "channel",
    "common": {
      "name": "My Custom Channel",
      "desc": "A channel for grouping related states"
    },
    "native": {}
  }
  \`\`\`

  \`\`\`json
  // Example of a device object
  {
    "type": "device",
    "common": {
      "name": "My Custom Device",
      "desc": "A device representing a physical device"
    },
    "native": {}
  }
  \`\`\`

The function returns a success message if the object was created or updated successfully, or an error message if the operation failed.`,
			},
			async (args) => {
				let ret = "set object successfully";
				try {
					await this.options.adapter.setForeignObjectAsync(args.id, args.obj);
				} catch (error) {
					ret = `Error setting object: ${error.message}`;
				}

				return {
					content: [
						{
							type: "text",
							text: ret,
						},
					],
				};
			},
		);
		server.tool(
			"getObjects",
			{
				pattern: z
					.string()
					.describe("A glob-style pattern to filter object IDs (e.g., 'hue.0.*', 'hue.*.state')"),
				type: z
					.string()
					.describe(
						"The type of object to retrieve (state, channel, device, enum, folder, adapter, instance, meta, user, group, script)",
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
						"A glob-style pattern to filter state IDs (e.g., 'hue.0.*', 'hue.*.state', '*.temperature', '*')",
					),
			},
			{
				description: `This function retrieves the current values of multiple ioBroker states matching a specified pattern.

Parameters:
  - pattern (string): A glob-style pattern used to filter state IDs. Examples:
      - 'hue.0.*':  All states under the 'hue.0' adapter instance.
      - 'hue.*.state': All states with 'state' in their ID under any 'hue' adapter instance.
      - '*.temperature': All states ending in '.temperature'.
      - '*': All states in the system (use with caution, as this can return a large number of results).

The function returns a JSON object where the keys are the state IDs and the values are the corresponding state objects (including the value, timestamp, quality, etc.).`,
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
						"The name of the enum to retrieve (e.g., 'rooms', 'functions').  User-defined enums are also valid.",
					),
			},
			{
				description: `This function retrieves the members of a specific ioBroker enum (enumeration). Enums are used to group objects, such as devices or states, into logical categories (e.g., rooms, functions).

Parameters:
  - name (string): The name of the enum to retrieve. Common values are 'rooms' and 'functions', but user-defined enums are also valid.

The function returns a JSON object where the keys are the enum member IDs and the values are the corresponding object IDs that belong to the enum.`,
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
				id: z.string().describe("The ID of the state to set"),
				value: z.unknown().describe("The value to set for the state"),
			},
			{
				description: `This function sets the value of a specific ioBroker state.

Parameters:
  - id (string): The ID of the state to set. This must be a valid state ID. You can obtain a list of valid state IDs and their corresponding value types using the get_all_state_IDs tool. The user can also provide the state ID in the context.
  - value (any): The value to set for the state. The value must be compatible with the state's data type (e.g., boolean, number, string). You can determine the expected data type using the get_all_state_IDs tool or by inspecting the state's metadata using the getObject tool.  Always validate the value against the state's type before setting it.

The function returns a success message if the state was set successfully, or an error message if the state could not be set.`,
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
