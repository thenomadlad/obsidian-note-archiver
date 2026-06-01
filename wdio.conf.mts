import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config: WebdriverIO.Config = {
	runner: "local",
	framework: "mocha",
	specs: ["./test/specs/**/*.e2e.ts"],
	maxInstances: 1,
	capabilities: [
		{
			browserName: "obsidian",
			browserVersion: "latest",
			"wdio:obsidianOptions": {
				plugins: ["."],
				vault: path.resolve(__dirname, "test/vaults/default"),
			},
		},
	],
	services: ["obsidian"],
	reporters: ["spec"],
	cacheDir: path.resolve(__dirname, ".obsidian-cache"),
	mochaOpts: {
		ui: "bdd",
		timeout: 60000,
	},
	logLevel: "warn",
};
