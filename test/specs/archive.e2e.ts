import { browser } from "@wdio/globals";

const PLUGIN_ID = "note-archiver";
const ARCHIVE_COMMAND = `${PLUGIN_ID}:archive-current-note`;

async function openNote(path: string) {
	await browser.execute(async (path) => {
		const file = app.vault.getAbstractFileByPath(path);
		if (!file) throw new Error(`File not found in vault: ${path}`);
		await app.workspace.openLinkText(path, "/", false);
	}, path);
	// Give Obsidian time to finish opening the file and setting up the editor
	await browser.pause(500);
}

async function setGrouping(grouping: string) {
	await browser.execute(async (grouping) => {
		const plugin = (app as any).plugins.getPlugin(PLUGIN_ID);
		if (!plugin) throw new Error(`Plugin ${PLUGIN_ID} not found`);
		plugin.settings.grouping = grouping;
		await plugin.saveSettings();
	}, grouping);
}

async function setArchiveFolder(folder: string) {
	await browser.execute(async (folder) => {
		const plugin = (app as any).plugins.getPlugin(PLUGIN_ID);
		if (!plugin) throw new Error(`Plugin ${PLUGIN_ID} not found`);
		plugin.settings.archiveFolderName = folder;
		await plugin.saveSettings();
	}, folder);
}

async function fileExistsInVault(path: string): Promise<boolean> {
	return browser.execute((path) => {
		return app.vault.getAbstractFileByPath(path) !== null;
	}, path);
}

// getAbstractFileByPath returns null for hidden (dot-prefixed) folders since
// Obsidian doesn't index them. Use the vault adapter for filesystem-level checks.
async function fileExistsOnDisk(path: string): Promise<boolean> {
	return browser.execute((path) => {
		return app.vault.adapter.exists(path);
	}, path);
}

describe("Note Archiver", function () {
	before(async function () {
		await browser.reloadObsidian({ vault: "./test/vaults/default" });
	});

	describe("NoGrouping", function () {
		before(async function () {
			await setGrouping("NoGrouping");
		});

		it("moves note directly into Archive/", async function () {
			await openNote("test-notes/no-grouping.md");
			await browser.executeObsidianCommand(ARCHIVE_COMMAND);

			expect(
				await fileExistsInVault("Archive/test-notes/no-grouping.md")
			).toBe(true);
			expect(
				await fileExistsInVault("test-notes/no-grouping.md")
			).toBe(false);
		});
	});

	describe("Year grouping", function () {
		before(async function () {
			await setGrouping("Year");
		});

		it("moves note into Archive/YYYY/", async function () {
			await openNote("test-notes/year-grouping.md");
			await browser.executeObsidianCommand(ARCHIVE_COMMAND);

			const year = new Date().getFullYear();
			expect(
				await fileExistsInVault(
					`Archive/${year}/test-notes/year-grouping.md`
				)
			).toBe(true);
			expect(
				await fileExistsInVault("test-notes/year-grouping.md")
			).toBe(false);
		});
	});

	describe("Hidden archive folder", function () {
		before(async function () {
			await setGrouping("NoGrouping");
			await setArchiveFolder(".archive");
		});

		after(async function () {
			await setArchiveFolder("Archive");
		});

		it("archives first note into hidden folder", async function () {
			await openNote("test-notes/hidden-folder-1.md");
			await browser.executeObsidianCommand(ARCHIVE_COMMAND);

			expect(
				await fileExistsOnDisk(".archive/test-notes/hidden-folder-1.md")
			).toBe(true);
			expect(
				await fileExistsInVault("test-notes/hidden-folder-1.md")
			).toBe(false);
		});

		it("archives second note without 'folder already exists' error", async function () {
			// The hidden folder now exists on disk but getAbstractFileByPath returns null,
			// so createFolder will be called again — this exercises the try/catch fix.
			await openNote("test-notes/hidden-folder-2.md");
			await browser.executeObsidianCommand(ARCHIVE_COMMAND);

			expect(
				await fileExistsOnDisk(".archive/test-notes/hidden-folder-2.md")
			).toBe(true);
			expect(
				await fileExistsInVault("test-notes/hidden-folder-2.md")
			).toBe(false);
		});
	});

	describe("Month grouping", function () {
		before(async function () {
			await setGrouping("Month");
		});

		it("moves note into Archive/YYYY/MM-Month/", async function () {
			await openNote("test-notes/month-grouping.md");
			await browser.executeObsidianCommand(ARCHIVE_COMMAND);

			const now = new Date();
			const year = now.getFullYear();
			const paddedMonth = (now.getMonth() + 1)
				.toString()
				.padStart(2, "0");
			const monthName = now.toLocaleString("default", { month: "long" });

			expect(
				await fileExistsInVault(
					`Archive/${year}/${paddedMonth}-${monthName}/test-notes/month-grouping.md`
				)
			).toBe(true);
			expect(
				await fileExistsInVault("test-notes/month-grouping.md")
			).toBe(false);
		});
	});
});
