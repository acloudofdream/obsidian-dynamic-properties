import { Notice, Plugin, TFile, type App } from "obsidian";
import {
  installPropertySuggestPatch,
  type PropertySuggestHost,
} from "./property-suggest";
import { DynamicPropertiesSettingTab } from "./settings-tab";
import {
  findRecommendation,
  getManagedPropertyNames,
  resolveRecommendations,
  sanitizeSettings,
} from "./tags";
import {
  getPropertyTypeOption,
  type DynamicPropertiesSettings,
  type PropertyRecommendation,
} from "./types";

interface MetadataTypeManagerLike {
  setType(property: string, type: string): Promise<void>;
  getAssignedWidget?(property: string): string | null;
}

type AppWithMetadataTypeManager = App & {
  metadataTypeManager?: MetadataTypeManagerLike;
};

export default class DynamicPropertiesPlugin
  extends Plugin
  implements PropertySuggestHost
{
  settings!: DynamicPropertiesSettings;

  private recommendationCache = new Map<string, PropertyRecommendation[]>();
  private uninstallSuggestPatch: (() => void) | null = null;
  private warnedAboutTypeManager = false;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new DynamicPropertiesSettingTab(this.app, this));

    this.registerEvent(
      this.app.metadataCache.on("changed", (file, _data, cache) => {
        this.recommendationCache.set(
          file.path,
          resolveRecommendations(cache, this.settings),
        );
      }),
    );

    this.registerEvent(
      this.app.metadataCache.on("deleted", (file) => {
        this.recommendationCache.delete(file.path);
      }),
    );

    this.registerEvent(
      this.app.metadataCache.on("resolved", () => {
        this.recommendationCache.clear();
      }),
    );

    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (file) {
          this.refreshRecommendations(file);
        }
      }),
    );

    this.uninstallSuggestPatch = installPropertySuggestPatch(this);

    if (!this.uninstallSuggestPatch) {
      new Notice(
        "Dynamic Properties: 当前 Obsidian 版本不支持原生候选注入，插件未生效。",
      );
    }
  }

  onunload(): void {
    this.uninstallSuggestPatch?.();
    this.uninstallSuggestPatch = null;
    this.recommendationCache.clear();
  }

  getRecommendationsForFile(file: TFile | null): PropertyRecommendation[] {
    if (!file) {
      return [];
    }

    const cached = this.recommendationCache.get(file.path);
    if (cached) {
      return cached;
    }

    const recommendations = resolveRecommendations(
      this.app.metadataCache.getFileCache(file),
      this.settings,
    );
    this.recommendationCache.set(file.path, recommendations);
    return recommendations;
  }

  getManagedPropertyNames(): Set<string> {
    return getManagedPropertyNames(this.settings);
  }

  applyPropertyType(propertyName: string, file: TFile | null): void {
    const recommendation = findRecommendation(
      this.getRecommendationsForFile(file),
      propertyName,
    );

    if (!recommendation) {
      return;
    }

    const manager = (this.app as AppWithMetadataTypeManager).metadataTypeManager;
    if (!manager?.setType) {
      if (!this.warnedAboutTypeManager) {
        this.warnedAboutTypeManager = true;
        console.warn(
          "[dynamic-properties] app.metadataTypeManager.setType() is unavailable; property values will use Obsidian's inferred type.",
        );
      }
      return;
    }

    const widget = getPropertyTypeOption(recommendation.type).widget;
    if (manager.getAssignedWidget?.(recommendation.name) === widget) {
      return;
    }

    void manager.setType(recommendation.name, widget).catch((error) => {
      console.error("[dynamic-properties] Failed to save property type.", error);
      new Notice(`无法设置属性 “${recommendation.name}” 的类型。`);
    });
  }

  async saveSettings(): Promise<void> {
    try {
      await this.saveData(this.settings);
      this.recommendationCache.clear();
      this.refreshRecommendations(this.app.workspace.getActiveFile());
    } catch (error) {
      console.error("[dynamic-properties] Failed to save settings.", error);
      new Notice("保存 Dynamic Properties 设置失败。");
    }
  }

  async reloadSettingsFromDisk(): Promise<void> {
    await this.loadSettings();
    this.recommendationCache.clear();
    this.refreshRecommendations(this.app.workspace.getActiveFile());
  }

  private async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as
      | Partial<DynamicPropertiesSettings>
      | null;
    this.settings = sanitizeSettings(data);
  }

  private refreshRecommendations(file: TFile | null): void {
    if (!file) {
      return;
    }

    this.recommendationCache.set(
      file.path,
      resolveRecommendations(
        this.app.metadataCache.getFileCache(file),
        this.settings,
      ),
    );
  }
}
