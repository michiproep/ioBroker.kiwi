/* eslint import/no-unresolved: "off" */
import { GoogleGenAI, mcpToTool } from "@google/genai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DirectTransport, DirectClientTransport } from "./mcp-direct-transport.mjs";
import { Tools } from "./tools/allTools.mjs";
import { ioBrokerAdapterApi } from "./api_adapter.mjs";

let CHAT = null;

export class Chatbot {
	constructor(options) {
		this.options = options || {};
		this.genAI = new GoogleGenAI({ apiKey: options.apiKey });
		this.modelName = options.modelName || "gemini-1.5-flash";
		this.temperature = options.temperature || 0.1;
		this.systemPrompt = options.systemPrompt;
		this.adapter = options.adapter;
		this.dbPath = options.dbPath;
		this.logger = options.logger || console;
		// MCP components
		this.mcpServer = null;
		this.localClient = null;
		this.API = null;
		this.isInitialized = false;
		this.onChunk = (_chunk) => {};
	}
	async init() {
		try {
			this.logger.info("[Kiwi Chatbot] DataDir: " + this.options.dbPath);
			this.API = new ioBrokerAdapterApi({
				adapter: this.adapter,
				namespace: this.adapter.namespace,
				apiKey: this.options.apiKey,
				embeddingModel: this.options.embeddingModel || "text-embedding-004",
				dbPath: this.options.dbPath,
				logger: this.logger,
			});

			await this.API.init();

			this.mcpServer = new McpServer({
				name: "kiwi-chatbot",
				version: "1.0.0",
				capabilities: {
					logging: {},
					resources: {},
					tools: {},
				},
			});

			for (const toolName in Tools) {
				const tool = Tools[toolName];
				const toolHandler = tool.call(this.API);
				this.mcpServer.tool(tool.name, tool.desc, tool.params, toolHandler);
			}

			const serverTransport = new DirectTransport();
			await this.mcpServer.connect(serverTransport);

			const clientTransport = new DirectClientTransport(serverTransport);

			this.localClient = new Client({
				name: "kiwi-chatbot-client",
				version: "1.0.0",
			});

			await this.localClient.connect(clientTransport);

			CHAT = this.genAI.chats.create({
				model: this.modelName,
				config: {
					tools: this.localClient ? [mcpToTool(this.localClient)] : [],
					temperature: this.temperature,
					systemInstruction:
						this.systemPrompt ||
						`Your Name is Kiwi. You are a helpful assistant, helping control and maintain the user's ioBroker system. 
                        You have access to several tools to help you fulfill user requests and provide accurate information.
                        Use the search tool to find states in ioBroker you can interact with, like switching lights on and off or reading temperatures.
                        All other tools are for administrative purposes, like discovering and describing states that are not in the semantic search index yet,
                        or creating scripts that run on the ioBroker server etc.
                        For discovering new devices and states etc. for administrative purposes, use the appropriate tools.`,
					thinkingConfig: {
						includeThoughts: true,
					},
				},
				history: [],
			});

			this.isInitialized = true;
		} catch (error) {
			this.logger.error("Failed to initialize chatbot:", error);
			throw error;
		}
	}

	async prompt(prompt) {
		try {
			if (!this.isInitialized || !CHAT) {
				throw new Error("Chatbot not initialized. Call init() first and wait for it to complete.");
			}

			const response = await CHAT.sendMessage({
				message: prompt,
			});

			return response.text;
		} catch (error) {
			this.logger.error("Error in chat:", error);
			throw error;
		}
	}

	async promptStream(prompt) {
		try {
			if (!this.isInitialized || !CHAT) {
				throw new Error("Chatbot not initialized. Call init() first and wait for it to complete.");
			}

			const response = await CHAT.sendMessageStream({
				message: prompt,
			});

			for await (const chunk of response) {
				this.onChunk(chunk);
			}
		} catch (error) {
			this.logger.error("Error in chat stream:", error);
			throw error;
		}
	}

	// Get access to the local MCP client for advanced usage
	getClient() {
		return this.localClient;
	}

	// Get access to the ioBroker API for direct usage
	getAPI() {
		return this.API;
	}

	// Get list of available tools
	async getAvailableTools() {
		try {
			if (!this.localClient) {
				throw new Error("Client not initialized");
			}
			return await this.localClient.listTools();
		} catch (error) {
			this.logger?.error("Error getting tools:", error);
			return [];
		}
	}

	// Call a specific tool directly
	async callTool(toolName, parameters) {
		try {
			if (!this.localClient) {
				throw new Error("Client not initialized");
			}
			return await this.localClient.callTool({ name: toolName, arguments: parameters });
		} catch (error) {
			this.logger.error(`Error calling tool ${toolName}:`, error);
			throw error;
		}
	}

	// Cleanup method
	async cleanup() {
		try {
			if (this.localClient) {
				await this.localClient.close();
			}
			CHAT = null;
			this.logger.info("Chatbot cleanup completed");
		} catch (error) {
			this.logger.error("Error during cleanup:", error);
		}
	}

	// Reset chat history
	resetHistory() {
		if (CHAT) {
			CHAT = this.genAI.chats.create({
				model: this.modelName,
				config: {
					tools: this.localClient ? [mcpToTool(this.localClient)] : [],
					temperature: this.temperature,
					systemInstruction:
						this.systemPrompt ||
						`Your Name is Kiwi. You are a helpful assistant, helping control and maintain the user's ioBroker system. 
                        You have access to several tools to help you fulfill user requests and provide accurate information.
                        Use the search tool to find states in ioBroker you can interact with, like switching lights on and off or reading temperatures.
                        All other tools are for administrative purposes, like discovering and describing states that are not in the semantic search index yet,
                        or creating scripts that run on the ioBroker server etc.
                        For discovering new devices and states etc. for administrative purposes, use the appropriate tools.`,
					thinkingConfig: {
						includeThoughts: true,
					},
				},
				history: [],
			});
		}
	}

	// Get chat statistics
	getStats() {
		return {
			initialized: this.isInitialized,
			chatReady: !!CHAT,
			clientConnected: !!this.localClient,
			apiInitialized: !!this.API,
		};
	}
}
