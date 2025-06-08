**early alpha**
expect things to break.
the following settings can be used to test this adapter in VSCode or Claude Desktop

```
{
	"servers": {
		"iobroker-remote": {
			"type": "stdio",
			"command": "npx",
			"args": ["-y", "mcp-remote", "http://localhost:8082/kiwi/0/mcp", "--allow-http"]
		}
	}
}
```
