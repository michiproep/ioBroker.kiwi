# ioBroker.kiwi

**ATTENTION! early alpha**
expect things to break.
the following settings can be used to test this adapter in VSCode or Claude Desktop

## connecting

```
{
	"servers": {
		"iobroker-remote": {
			"type": "stdio",
			"command": "npx",
			"args": ["-y", "mcp-remote", "http://<your-iobroker-ip>:<web-adpater-port>/kiwi/0/mcp", "--allow-http"]
		}
	}
}
```

it might work without using `npx mcp-remote`. I'm using [StreamableHTTPServerTransport](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http) which is not supported by all clients yet

## Basic usage

![image](https://github.com/user-attachments/assets/2a2c5aab-afb1-49a8-866c-323f01a23e28)


## Changelog

not much here yet. still early alpha. consider this the frist release

## License

MIT License

Copyright (c) 2025 Holger Will <h.will@klimapartner.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
