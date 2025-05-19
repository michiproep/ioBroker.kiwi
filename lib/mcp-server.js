const express = require("express");
const app = express();
const Transport = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const MCP = require("@modelcontextprotocol/sdk/server/mcp.js");
const z = require("zod");

const server = new MCP.McpServer({
	name: "iobroker-mcp-server",
	version: "0.0.1",
	capabilities: { tools: true },
});

let transport = null;

class ExpressMCPServer {
	constructor(options) {
		this.options = options;
		this.server = null;
		this.tools = {};
	}
	async addtool(name, tool) {
		console.log(name, tool);
		this.tools[name] = {};
		this.tools[name].getter = server.tool(
			"get_" + name.replace(/\./g, "___"),
			{},
			{ description: "gets the current state. " + tool.description },
			async () => {
				const ret = await this.options.adapter.getForeignStateAsync(name);
				console.log("get_" + name.replace(/\./g, "___"), ret);
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
			console.log("create setter for " + name);
			this.tools[name].setter = server.tool(
				"set_" + name.replace(/\./g, "___"),
				{ value: z.string().describe("The value to set") },
				{ description: "sets the current state. " + tool.description },
				async (args, _extra) => {
					console.log("set_" + name.replace(/\./g, "___"), args);
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
		delete this.tools[name];
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
		//console.log("ExpressMCPServer ", this.options.adapter.config.port);
		app.listen(this.options.adapter.config.port, () => {
			this.options.adapter.log.info(
				`MCP Streamable HTTP Server is listening on port ${this.options.adapter.config.port}`,
			);
		});
	}
}

/* let t = server.tool(
	"my-echo-tool",
	{ message: z.string().describe("The message to echo") },
	{ description: "Repeats the provided message." },
	async (args, _extra) => {
		return {
			content: [
				{
					type: "text",
					text: `Tool echo: ${args.message}`,
				},
			],
		};
	},
); */

module.exports = {
	ExpressMCPServer,
};
