(async () => {
	const adapter = await import("./adapter.mjs");
	if (require.main !== module) {
		module.exports = (options) => new adapter.McpServer(options);
	} else {
		new adapter.McpServer();
	}
})();
