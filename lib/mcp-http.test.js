"use strict";

const { expect } = require("chai");

describe("MCP HTTP endpoint", function () {
	this.timeout(30000);

	let mcpWeb;
	let McpServer;
	let Client;
	let StreamableHTTPClientTransport;
	let express;
	let z;

	before(async () => {
		mcpWeb = await import("./mcp-http.mjs");
		({ McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js"));
		({ Client } = await import("@modelcontextprotocol/sdk/client/index.js"));
		({ StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js"));
		express = (await import("express")).default;
		({ z } = await import("zod"));
	});

	const logger = { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} };

	async function answerLater({ ms, tag }) {
		await new Promise((resolve) => setTimeout(resolve, ms));
		return { content: [{ type: "text", text: tag }] };
	}

	function slowTools() {
		return {
			slow: {
				name: "slow",
				desc: "answers after a delay",
				params: { ms: z.number(), tag: z.string() },
				call: () => answerLater,
			},
		};
	}

	async function withEndpoint(handler, fn) {
		const app = express();
		app.use(express.json());
		app.post("/mcp", handler);
		const http = await new Promise((resolve) => {
			const s = app.listen(0, "127.0.0.1", () => resolve(s));
		});
		const client = new Client({ name: "test", version: "1.0.0" });
		try {
			await client.connect(
				new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${http.address().port}/mcp`)),
			);
			return await fn(client);
		} finally {
			await client.close();
			http.closeAllConnections();
			await new Promise((resolve) => http.close(resolve));
		}
	}

	function callBoth(client) {
		return Promise.allSettled([
			client.callTool({ name: "slow", arguments: { ms: 300, tag: "a" } }, undefined, { timeout: 3000 }),
			client.callTool({ name: "slow", arguments: { ms: 100, tag: "b" } }, undefined, { timeout: 3000 }),
		]);
	}

	it("answers parallel tool calls with a server per request", async () => {
		const handler = mcpWeb.createMcpRequestHandler(() => mcpWeb.createMcpServer({}, slowTools()), logger);
		const results = await withEndpoint(handler, callBoth);
		expect(results.map((r) => r.status)).to.deep.equal(["fulfilled", "fulfilled"]);
		expect(results.map((r) => r.value.content[0].text)).to.deep.equal(["a", "b"]);
	});

	it("documents the root cause: one shared server cannot serve concurrent requests", async () => {
		const shared = mcpWeb.createMcpServer({}, slowTools());
		const handler = mcpWeb.createMcpRequestHandler(() => shared, logger);
		const results = await withEndpoint(handler, callBoth);
		// the observed failure: one call gets "500 Internal server error" (id: null), the other never answers
		const errors = results.filter((r) => r.status === "rejected").map((r) => r.reason.message);
		expect(errors.some((m) => m.includes("Internal server error"))).to.equal(true);
	});

	it("registers all kiwi tools on a new server", async () => {
		const server = mcpWeb.createMcpServer({});
		expect(server).to.be.instanceOf(McpServer);
		expect(Object.keys(server._registeredTools)).to.include("getIobrokerState");
	});
});
