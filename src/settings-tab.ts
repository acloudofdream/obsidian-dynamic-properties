import {
  App,
  PluginSettingTab,
  Setting,
  setIcon,
  type TextComponent,
} from "obsidian";
import type DynamicPropertiesPlugin from "./main";
import { normalizeTag } from "./tags";
import {
  createRule,
  getPropertyTypeLabel,
  isPropertyType,
  normalizePropertyName,
  PROPERTY_TYPE_OPTIONS,
  RESERVED_PROPERTY_NAMES,
  type PropertyRecommendation,
  type TagRule,
} from "./types";

export class DynamicPropertiesSettingTab extends PluginSettingTab {
  private readonly plugin: DynamicPropertiesPlugin;

  constructor(app: App, plugin: DynamicPropertiesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("dp-settings");

    containerEl.createEl("h2", { text: "Dynamic Properties" });

    containerEl.createEl("p", {
      cls: "dp-intro",
      text: "给笔记加上指定标签后，在原生“添加属性”的候选列表里追加你配置的属性。没有命中标签的笔记不会看到这些额外属性。",
    });

    containerEl.createEl("p", {
      cls: "dp-note",
      text: "匹配的是笔记中的全部标签：frontmatter tags 与正文里的 #标签 都算。修改设置后立即生效，无需重启。",
    });

    new Setting(containerEl)
      .setName("匹配子标签")
      .setDesc(
        "例如规则“读书笔记”也会匹配 #读书笔记/小说；关闭后只匹配完全相同的标签。",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.matchNestedTags)
          .onChange((value) => {
            this.plugin.settings.matchNestedTags = value;
            void this.plugin.saveSettings();
          }),
      );

    const rulesEl = containerEl.createDiv("dp-rules");

    if (this.plugin.settings.rules.length === 0) {
      rulesEl.createDiv({
        cls: "dp-empty-state",
        text: "还没有标签规则。点击下方“添加标签规则”开始配置。",
      });
    } else {
      for (const rule of this.plugin.settings.rules) {
        this.renderRule(rulesEl, rule);
      }
    }

    new Setting(containerEl)
      .setClass("dp-add-rule-setting")
      .addButton((button) =>
        button
          .setButtonText("+ 添加标签规则")
          .setCta()
          .onClick(() => {
            const rule = createRule();
            this.plugin.settings.rules.push(rule);
            void this.plugin.saveSettings();
            this.display();
            focusAfterRender(this.containerEl, rule.id, "tag");
          }),
      );

    containerEl.createEl("p", {
      cls: "dp-footer-note",
      text: "属性类型沿用 Obsidian 的全局类型设置（types.json）。同名属性不会重复出现；tags、aliases、cssclasses 仍由原生逻辑提供。",
    });
  }

  private renderRule(parentEl: HTMLElement, rule: TagRule): void {
    const card = parentEl.createDiv({
      cls: "dp-rule",
      attr: { "data-rule-id": rule.id },
    });

    const header = card.createDiv("dp-rule-header");
    const title = header.createEl("h3", {
      text: rule.tag ? `#${normalizeTag(rule.tag)}` : "未命名规则",
    });
    const removeButton = header.createEl("button", {
      cls: "clickable-icon dp-rule-delete",
      attr: { "aria-label": "删除这条标签规则" },
    });
    setIcon(removeButton, "trash-2");
    removeButton.addEventListener("click", () => {
      const index = this.plugin.settings.rules.findIndex(
        (candidate) => candidate.id === rule.id,
      );
      if (index >= 0) {
        this.plugin.settings.rules.splice(index, 1);
        void this.plugin.saveSettings();
        this.display();
      }
    });

    new Setting(card)
      .setClass("dp-tag-setting")
      .setName("目标标签")
      .setDesc("可写 #读书笔记 或 读书笔记。")
      .addText((text) => {
        this.configureTagInput(text, rule, title);
      });

    const propsHeader = card.createDiv("dp-props-header");
    propsHeader.createSpan({ cls: "dp-col-name", text: "属性名" });
    propsHeader.createSpan({ cls: "dp-col-type", text: "类型" });
    propsHeader.createSpan({ cls: "dp-col-action" });

    if (rule.properties.length === 0) {
      card.createDiv({
        cls: "dp-empty",
        text: "这条规则还没有推荐属性。",
      });
    } else {
      for (const property of rule.properties) {
        this.renderPropertyRow(card, rule, property);
      }
    }

    new Setting(card)
      .setClass("dp-add-property-setting")
      .addButton((button) =>
        button.setButtonText("+ 添加推荐属性").onClick(() => {
          rule.properties.push({ name: "", type: "text" });
          void this.plugin.saveSettings();
          this.display();
          focusAfterRender(this.containerEl, rule.id, "property");
        }),
      );
  }

  private configureTagInput(
    text: TextComponent,
    rule: TagRule,
    titleEl: HTMLElement,
  ): void {
    text
      .setPlaceholder("例如：读书笔记")
      .setValue(rule.tag)
      .onChange((value) => {
        rule.tag = value;
        titleEl.setText(value.trim() ? `#${normalizeTag(value)}` : "未命名规则");
      });

    text.inputEl.addClass("dp-tag-input");
    text.inputEl.dataset.ruleId = rule.id;
    text.inputEl.setAttribute("aria-label", "目标标签");

    text.inputEl.addEventListener("blur", () => {
      rule.tag = normalizeTag(rule.tag);
      if (text.inputEl.value !== rule.tag) {
        text.inputEl.value = rule.tag;
      }
      titleEl.setText(rule.tag ? `#${rule.tag}` : "未命名规则");
      void this.plugin.saveSettings();
    });

    text.inputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        text.inputEl.blur();
      }
    });
  }

  private renderPropertyRow(
    parentEl: HTMLElement,
    rule: TagRule,
    property: PropertyRecommendation,
  ): void {
    const setting = new Setting(parentEl).setClass("dp-property-setting");

    setting.addText((text) => {
      text
        .setPlaceholder("例如：author")
        .setValue(property.name)
        .onChange((value) => {
          property.name = value;
          this.validatePropertyNameInput(text.inputEl, value);
        });

      text.inputEl.addClass("dp-property-name");
      text.inputEl.setAttribute("aria-label", "推荐属性名");

      text.inputEl.addEventListener("blur", () => {
        property.name = normalizePropertyName(property.name);
        if (text.inputEl.value !== property.name) {
          text.inputEl.value = property.name;
        }
        this.validatePropertyNameInput(text.inputEl, property.name);
        void this.plugin.saveSettings();
      });

      text.inputEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          text.inputEl.blur();
        }
      });
    });

    setting.addDropdown((dropdown) => {
      dropdown.addOptions(
        Object.fromEntries(
          PROPERTY_TYPE_OPTIONS.map((option) => [option.value, option.label]),
        ),
      );
      dropdown.setValue(property.type).onChange((value) => {
        if (isPropertyType(value)) {
          property.type = value;
          dropdown.setValue(value);
          void this.plugin.saveSettings();
        }
      });
      dropdown.selectEl.setAttribute(
        "aria-label",
        `“${property.name || "属性"}”的类型`,
      );
    });

    setting.addExtraButton((button) => {
      const label = `删除属性“${property.name || "未命名"}”`;
      button
        .setIcon("trash-2")
        .setTooltip(label)
        .onClick(() => {
          const index = rule.properties.indexOf(property);
          if (index >= 0) {
            rule.properties.splice(index, 1);
            void this.plugin.saveSettings();
            this.display();
          }
        });
      button.extraSettingsEl.setAttribute("aria-label", label);
    });

    setting.settingEl.dataset.propertyType = property.type;
    setting.settingEl.setAttribute(
      "aria-label",
      `${property.name || "未命名"}，${getPropertyTypeLabel(property.type)}`,
    );
  }

  private validatePropertyNameInput(
    inputEl: HTMLInputElement,
    value: string,
  ): void {
    const normalized = normalizePropertyName(value).toLowerCase();
    const reserved = RESERVED_PROPERTY_NAMES.has(normalized);

    inputEl.toggleClass("dp-invalid", reserved);
    if (reserved) {
      inputEl.setAttribute(
        "title",
        "这是 Obsidian 内置属性，始终由原生逻辑提供，无需在这里配置。",
      );
    } else {
      inputEl.removeAttribute("title");
    }
  }
}

function focusAfterRender(
  containerEl: HTMLElement,
  ruleId: string,
  target: "tag" | "property",
): void {
  window.setTimeout(() => {
    const ruleEl = containerEl.querySelector<HTMLElement>(
      `.dp-rule[data-rule-id="${ruleId}"]`,
    );
    if (!ruleEl) {
      return;
    }

    const selector =
      target === "tag" ? ".dp-tag-input" : ".dp-property-name";
    const inputs = ruleEl.querySelectorAll<HTMLInputElement>(selector);
    inputs[inputs.length - 1]?.focus();
  }, 0);
}
