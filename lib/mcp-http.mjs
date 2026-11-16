/* eslint import/no-unresolved: "off" */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { readFileSync } from "node:fs";
import { Tools } from "./tools/allTools.mjs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)).toString());

/**
 * Creates an MCP server with all kiwi tools bound to the given API.
 * A McpServer can only be connected to one transport at a time, so the stateless HTTP endpoint needs a
 * fresh server per request. Otherwise concurrent requests (e.g. parallel tool calls) fail with
 * "Already connected to a transport" and the end of one request closes the server of the other.
 *
 * @param {any} api implementation layer the tools call
 * @param {Record<string, any>} [tools] tool definitions, defaults to all kiwi tools
 */
export function createMcpServer(api, tools = Tools) {
	const server = new McpServer({
		name: "kiwi",
		version: pkg.version,
	});
	for (const toolName in tools) {
		const tool = tools[toolName];
		server.tool(tool.name, tool.desc, tool.params, tool.call(api));
	}
	return server;
}

/**
 * Express handler for the stateless streamable HTTP MCP endpoint: one server and one transport per request.
 *
 * @param {() => McpServer} createServer
 * @param {{ error: Function, debug?: Function }} logger
 */
export function createMcpRequestHandler(createServer, logger) {
	return async (req, res) => {
		const server = createServer();
		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
		});
		res.on("close", () => {
			transport.close();
			server.close();
		});
		try {
			await server.connect(transport);
			await transport.handleRequest(req, res, req.body);
		} catch (error) {
			logger.error(`Error handling MCP request: ${error && error.message ? error.message : error}`);
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
	};
}
