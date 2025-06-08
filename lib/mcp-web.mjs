import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { readFileSync } from "fs";
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)).toString());

/* function log(msg){
appendFileSync( '/home/holger/errorlog', msg + '\n')
} */
const server = new McpServer({
	name: "iobroker-mcp-server",
	version: pkg.version,
	capabilities: {
		logging: {},
		resources: {},
		tools: {},
	},
});
class MCP_Web_Server {
	constructor(server, webSettings, adapter, instanceSettings, app) {
		this.server = server;
		this.webSettings = webSettings;
		this.adapter = adapter;
		this.instanceSettings = instanceSettings;
		this.app = app;
		this.readyCallback = null;
		this.init();
	}
	async handleRequest(req, res) {
		console.log("Received MCP request");
		try {
			const transport = new StreamableHTTPServerTransport({
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
			console.log("Error handling MCP request:", error);
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
	init() {
		console.log("Initializing MCP Server");
		const router = express.Router();
		router.get("/", this.handleRequest);
		this.app.use("/mcp-server/0/", router);
	}
}

export { MCP_Web_Server };
