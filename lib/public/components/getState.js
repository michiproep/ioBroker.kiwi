import { LitElement, html, css } from "https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js";

class GetState extends LitElement {
	static styles = css`
		:host {
			display: block;
			font-family: Arial, sans-serif;
		}
	`;

	static properties = {
		pattern: { type: String },
		app: { type: String },
	};

	constructor() {
		super();
		this.app = "";
	}
	firstUpdated() {
		this.iob = document.getElementById(this.app);
	}
	render() {
		return html`
			<div class="container">
				<h1>hallo</h1>
			</div>
		`;
	}
}

customElements.define("get-state", GetState);
