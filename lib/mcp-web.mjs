/* eslint-disable */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { Tools } from "./tools/allTools.mjs";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ioBrokerAdapterApi } from "./api_adapter.mjs";
import * as utils from "@iobroker/adapter-core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)).toString());
/* function log(msg){
appendFileSync( '/home/holger/errorlog', msg + '\n')
} */
const server = new McpServer({
	name: "kiwi",
	version: pkg.version,
	capabilities: {
		logging: {},
		resources: {},
		tools: {},
	},
});
class MCP_Web_Server {
	constructor(server, webSettings, adapter, instanceSettings, app, ref) {
		this.server = server;
		this.webSettings = webSettings;
		this.adapter = adapter;
		this.instanceSettings = instanceSettings;
		this.app = app;
		this.readyCallback = null;
		this.ref = ref;
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
	async methodNotAllowed(req, res) {
		console.log("Method not allowed:", req.method);
		res.writeHead(405).end(
			JSON.stringify({
				jsonrpc: "2.0",
				error: {
					code: -32000,
					message: "Method not allowed: " + req.method,
				},
				id: null,
			}),
		);
	}
	init() {
		const splitedId = this.instanceSettings._id.split(".");
		const base = `/${splitedId[2]}/${splitedId[3]}/`;
		this.adapter.log.info(`[Kiwi Web] MCP Web Server started at ${base}`);
		this.API = new ioBrokerAdapterApi({
			adapter: this.adapter,
			namespace: this.ref.config.namespace,
			geminiApiKey: this.instanceSettings.geminiApiKey,
			embeddingModel: this.instanceSettings.embeddingModel,
			dbPath: this.ref.config.dataDir + "/vectraIndex",
		});

		this.API.init();
		this.adapter.log.info(`[Kiwi Web] API initialized with namespace: ${this.API.namespace}`);
		this.Tools = Tools;
		for (const toolName in this.Tools) {
			const tool = this.Tools[toolName];
			server.tool(tool.name, tool.desc, tool.params, tool.call(this.API));
		}
		this.adapter.log.info(`[Kiwi Web] Tools registered: ${Object.keys(this.Tools).join(", ")}`);
		const router = express.Router();
		router.use(express.static(path.join(__dirname, "public")));
		this.adapter.log.info(`Static files served from: ${path.join(__dirname, "public")}`);
		const noCache = (req, res, next) => {
			res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
			res.setHeader("Pragma", "no-cache");
			res.setHeader("Expires", "0");
			next();
		};
		this.adapter.log.info(`[Kiwi Web] No-cache middleware set up`);
		try {
			router.use(noCache);
			router.post("/mcp", this.handleRequest);
			router.post("/message", this.handleRequest);
			router.post("/tool", this.handleRequest);
			router.post("/sse", this.handleRequest);
			router.get("/mcp", this.methodNotAllowed);
			router.delete("/mcp", this.methodNotAllowed);
			this.app.use(base, router);
			this.app.get("/test", (req, res) => {
				res.send("Kiwi Web Server is running!");
			});
			this.adapter.log.info(`[Kiwi Web] Router attached`);
		} catch (error) {
			this.adapter.log.error(`[Kiwi Web] Error attaching router: ${error.message}`);
		}
	}
}

export { MCP_Web_Server };
