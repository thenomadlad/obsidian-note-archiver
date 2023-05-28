import {
	App,
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	normalizePath,
} from "obsidian";
import { join, dirname } from "path";

const ARCHIVE_FOLDER_GROUPINGS = ["NoGrouping", "Year", "Month"] as const;
type ArchiveFolderGrouping = (typeof ARCHIVE_FOLDER_GROUPINGS)[number];

interface NoteArchiverSettings {
	version: string;
	archiveFolderName: string;
	grouping: ArchiveFolderGrouping;
}

const DEFAULT_SETTINGS: NoteArchiverSettings = {
	version: "0.1.0",
	archiveFolderName: "Archive",
	grouping: "NoGrouping",
};

export default class NoteArchiverPlugin extends Plugin {
	settings: NoteArchiverSettings;

	async onload() {
		await this.loadSettings();

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: "note-archiver-archive-current-note",
			name: "Archive current note",
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				view: MarkdownView
			) => {
				if (checking) {
					return !view.file.path.startsWith(
						this.settings.archiveFolderName
					);
				} else {
					this.archivePage(view.file.path);
					return true;
				}
			},
		});

		// on right-clicking a file
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (!file.path.startsWith(this.settings.archiveFolderName)) {
					menu.addItem((item) => {
						item.setTitle("📤 Archive file")
							.setIcon("document")
							.onClick(async () => {
								this.archivePage(file.path);
							});
					});
				}
			})
		);

		// on clicking the 3-dots on the top right of an editor
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor, view) => {
				menu.addItem((item) => {
					let path = view.file?.path;

					if (
						path &&
						!path.startsWith(this.settings.archiveFolderName)
					) {
						item.setTitle("📤 Archive file")
							.setIcon("document")
							.onClick(async () => {
								this.archivePage(path ?? "");
							});
					}
				});
			})
		);

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new NoteArchiverSettingTab(this.app, this));
	}

	onunload() {}

	async archivePage(path: string) {
		let targetFile = this.app.vault.getAbstractFileByPath(path) as TFile;

		// get and create archive folder
		let archiveFolder = this.settings.archiveFolderName;
		if (this.settings.grouping === "NoGrouping") {
			archiveFolder = this.settings.archiveFolderName;
		} else {
			if (this.settings.grouping === "Year") {
				let year = new Date().getFullYear();

				archiveFolder = normalizePath(
					join(this.settings.archiveFolderName, `${year}`)
				);
			} else if (this.settings.grouping === "Month") {
				let now = new Date();
				let year = now.getFullYear();
				let paddedMonthNumber = (now.getMonth() + 1)
					.toString()
					.padStart(2, "0");
				let monthName = now.toLocaleString("default", {
					month: "long",
				});

				archiveFolder = normalizePath(
					join(
						this.settings.archiveFolderName,
						`${year}`,
						`${paddedMonthNumber}-${monthName}`
					)
				);
			}
		}

		// new path for archived file
		let newPath = normalizePath(join(archiveFolder, path));

		// make sure the folder for the file exists
		let newFolder = dirname(newPath);
		console.log("Attempting to check and create folder " + newFolder);
		console.log(this.app.vault.getAbstractFileByPath(newFolder));
		if (this.app.vault.getAbstractFileByPath(newFolder) === null) {
			console.log("Attempting to create it");
			await this.app.vault.createFolder(newFolder);
		}

		// move the file
		await this.app.vault.copy(targetFile, newPath);
		await this.app.vault.delete(targetFile);

		new Notice(`${path} moved to ${newPath}`);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class NoteArchiverSettingTab extends PluginSettingTab {
	plugin: NoteArchiverPlugin;

	constructor(app: App, plugin: NoteArchiverPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Settings for my awesome plugin." });

		// folder path
		let folderPathSetting = new Setting(containerEl)
			.setName("Archive folder")
			.setDesc("Where should I put your archived files?")
			.addText((text) =>
				text
					.setPlaceholder("Enter your secret")
					.setValue(this.plugin.settings.archiveFolderName)
					.onChange(async (value) => {
						let folder = normalizePath(value);
						this.plugin.settings.archiveFolderName = folder;
						await this.plugin.saveSettings();

						updateFolderPathHelpMessage(
							this.plugin.settings.archiveFolderName
						);
					})
			);

		// helper message for folder path not existing
		let folderPathHelpMessage = folderPathSetting.infoEl.createEl("p", {
			text: "",
			cls: ["setting-item-description", "setting-item-extra-info"],
		});
		let updateFolderPathHelpMessage = (folder: string) => {
			let abstractFile = this.app.vault.getAbstractFileByPath(
				normalizePath(folder)
			);
			console.log(abstractFile);
			if (!abstractFile) {
				folderPathHelpMessage.textContent =
					"Folder not in vault, it will be created when you archive a note here";
			} else {
				if (abstractFile instanceof TFile) {
					folderPathHelpMessage.textContent =
						"File exists with this name, you can't archive anything until you change this";
				} else {
					folderPathHelpMessage.textContent =
						"Folder exists, all good";
				}
			}
		};
		updateFolderPathHelpMessage(this.plugin.settings.archiveFolderName);

		new Setting(containerEl)
			.setName("Group by")
			.setDesc("Should I group your archived files?")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("NoGrouping", "Don't group my files")
					.addOption("Year", "Group by year file is archived")
					.addOption(
						"Month",
						"Group by year and month file is archived"
					)
					.setValue(this.plugin.settings.grouping)
					.onChange(async (value) => {
						if (
							!ARCHIVE_FOLDER_GROUPINGS.find(
								(validName) => value === validName
							)
						) {
							throw new Error(
								"Unable to parse ArchiveFolderGrouping from value " +
									value
							);
						}

						this.plugin.settings.grouping =
							value as ArchiveFolderGrouping;
						await this.plugin.saveSettings();
					})
			);
	}
}
