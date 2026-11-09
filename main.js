"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => DynamicPropertiesPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");

// src/property-suggest.ts
var import_obsidian = require("obsidian");

// src/types.ts
var PROPERTY_TYPE_OPTIONS = [
  { value: "text", label: "\u6587\u672C", widget: "text" },
  { value: "number", label: "\u6570\u5B57", widget: "number" },
  { value: "list", label: "\u5217\u8868", widget: "multitext" },
  { value: "date", label: "\u65E5\u671F", widget: "date" },
  { value: "datetime", label: "\u65E5\u671F\u65F6\u95F4", widget: "datetime" },
  { value: "checkbox", label: "\u590D\u9009\u6846", widget: "checkbox" }
];
var PROPERTY_TYPE_MAP = new Map(
  PROPERTY_TYPE_OPTIONS.map((option) => [option.value, option])
);
var RESERVED_PROPERTY_NAMES = /* @__PURE__ */ new Set([
  "tags",
  "aliases",
  "cssclasses"
]);
function isPropertyType(value) {
  return typeof value === "string" && PROPERTY_TYPE_MAP.has(value);
}
function getPropertyTypeOption(type) {
  var _a;
  return (_a = PROPERTY_TYPE_MAP.get(type)) != null ? _a : PROPERTY_TYPE_OPTIONS[0];
}
function getPropertyTypeLabel(type) {
  return getPropertyTypeOption(type).label;
}
function normalizePropertyName(raw) {
  return raw.trim().replace(/^#+/, "").trim();
}
function createRule(tag = "", properties = []) {
  return {
    id: createId(),
    tag,
    properties
  };
}
function createDefaultSettings() {
  return {
    matchNestedTags: true,
    rules: [
      createRule("\u8BFB\u4E66\u7B14\u8BB0", [
        { name: "author", type: "text" },
        { name: "url", type: "text" }
      ])
    ]
  };
}
function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// src/tags.ts
function normalizeTag(raw) {
  return raw.trim().replace(/^#+/, "").replace(/\/+$/, "").toLowerCase();
}
function collectDocumentTags(cache) {
  var _a;
  const tags = /* @__PURE__ */ new Set();
  const frontmatter = cache == null ? void 0 : cache.frontmatter;
  if (frontmatter) {
    addFrontmatterValue(tags, frontmatter.tags);
    addFrontmatterValue(tags, frontmatter.tag);
  }
  for (const tag of (_a = cache == null ? void 0 : cache.tags) != null ? _a : []) {
    const normalized = normalizeTag(tag.tag);
    if (normalized) {
      tags.add(normalized);
    }
  }
  return tags;
}
function addFrontmatterValue(tags, value) {
  if (typeof value === "string") {
    for (const part of value.split(/[\s,]+/)) {
      const normalized = normalizeTag(part);
      if (normalized) {
        tags.add(normalized);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      addFrontmatterValue(tags, item);
    }
  }
}
function ruleMatchesTag(ruleTag, documentTags, matchNestedTags) {
  const normalizedRuleTag = normalizeTag(ruleTag);
  if (!normalizedRuleTag) {
    return false;
  }
  for (const tag of documentTags) {
    if (tag === normalizedRuleTag) {
      return true;
    }
    if (matchNestedTags && tag.startsWith(`${normalizedRuleTag}/`)) {
      return true;
    }
  }
  return false;
}
function resolveRecommendations(cache, settings) {
  const documentTags = collectDocumentTags(cache);
  const recommendations = /* @__PURE__ */ new Map();
  for (const rule of settings.rules) {
    if (!ruleMatchesTag(rule.tag, documentTags, settings.matchNestedTags)) {
      continue;
    }
    for (const property of rule.properties) {
      const name = normalizePropertyName(property.name);
      const key = name.toLowerCase();
      if (!name || RESERVED_PROPERTY_NAMES.has(key) || recommendations.has(key)) {
        continue;
      }
      recommendations.set(key, {
        name,
        type: isPropertyType(property.type) ? property.type : "text"
      });
    }
  }
  return Array.from(recommendations.values());
}
function getManagedPropertyNames(settings) {
  const names = /* @__PURE__ */ new Set();
  for (const rule of settings.rules) {
    for (const property of rule.properties) {
      const name = normalizePropertyName(property.name).toLowerCase();
      if (name && !RESERVED_PROPERTY_NAMES.has(name)) {
        names.add(name);
      }
    }
  }
  return names;
}
function findRecommendation(recommendations, propertyName) {
  const key = normalizePropertyName(propertyName).toLowerCase();
  return recommendations.find(
    (recommendation) => recommendation.name.toLowerCase() === key
  );
}
function sanitizeSettings(raw) {
  if (!raw) {
    return createDefaultSettings();
  }
  const fallback = createDefaultSettings();
  const rawRules = Array.isArray(raw.rules) ? raw.rules : fallback.rules;
  return {
    matchNestedTags: raw.matchNestedTags !== false,
    rules: rawRules.map((rule) => sanitizeRule(rule)).filter((rule) => rule !== null)
  };
}
function sanitizeRule(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const candidate = raw;
  const properties = [];
  const seen = /* @__PURE__ */ new Set();
  if (Array.isArray(candidate.properties)) {
    for (const rawProperty of candidate.properties) {
      if (!rawProperty || typeof rawProperty !== "object") {
        continue;
      }
      const property = rawProperty;
      const name = typeof property.name === "string" ? normalizePropertyName(property.name) : "";
      const key = name.toLowerCase();
      if (!name || seen.has(key)) {
        continue;
      }
      seen.add(key);
      properties.push({
        name,
        type: isPropertyType(property.type) ? property.type : "text"
      });
    }
  }
  const rule = createRule(
    typeof candidate.tag === "string" ? candidate.tag : "",
    properties
  );
  if (typeof candidate.id === "string" && candidate.id.trim()) {
    rule.id = candidate.id;
  }
  return rule;
}
function getPropertyTypeWidget(recommendation) {
  return getPropertyTypeOption(recommendation.type).widget;
}

// src/property-suggest.ts
var LOG_PREFIX = "[dynamic-properties]";
function installPropertySuggestPatch(host) {
  const prototype = import_obsidian.AbstractInputSuggest.prototype;
  if (!prototype || typeof prototype.showSuggestions !== "function" || typeof prototype.selectSuggestion !== "function") {
    console.warn(
      `${LOG_PREFIX} AbstractInputSuggest API is unavailable; native property suggestions were not patched.`
    );
    return null;
  }
  const originalShowSuggestions = prototype.showSuggestions;
  const originalSelectSuggestion = prototype.selectSuggestion;
  const patchedShowSuggestions = function(suggestions) {
    if (isPropertyKeySuggest(this)) {
      try {
        suggestions = buildAugmentedSuggestions(host, this, suggestions);
      } catch (error) {
        console.error(
          `${LOG_PREFIX} Failed to augment property suggestions.`,
          error
        );
      }
    }
    originalShowSuggestions.call(this, suggestions);
  };
  const patchedSelectSuggestion = function(value, evt) {
    const file = isPropertyKeySuggest(this) ? getFileForInput(this.app, this.textInputEl) : null;
    originalSelectSuggestion.call(this, value, evt);
    if (file && value && typeof value.text === "string" && value.text.trim()) {
      try {
        host.applyPropertyType(value.text, file);
      } catch (error) {
        console.error(
          `${LOG_PREFIX} Failed to apply the configured property type.`,
          error
        );
      }
    }
  };
  prototype.showSuggestions = patchedShowSuggestions;
  prototype.selectSuggestion = patchedSelectSuggestion;
  return () => {
    if (prototype.showSuggestions === patchedShowSuggestions) {
      prototype.showSuggestions = originalShowSuggestions;
    }
    if (prototype.selectSuggestion === patchedSelectSuggestion) {
      prototype.selectSuggestion = originalSelectSuggestion;
    }
  };
}
function buildAugmentedSuggestions(host, suggest, suggestions) {
  var _a, _b, _c;
  if (!Array.isArray(suggestions)) {
    return suggestions;
  }
  const file = getFileForInput(host.app, suggest.textInputEl);
  if (!file) {
    return suggestions;
  }
  const recommendations = host.getRecommendationsForFile(file);
  const managedNames = host.getManagedPropertyNames();
  const allowed = new Map(
    recommendations.map((recommendation) => [
      recommendation.name.toLowerCase(),
      recommendation
    ])
  );
  const currentKeys = new Set(
    ((_a = suggest.properties) != null ? _a : []).map((property) => property.key.toLowerCase())
  );
  const query = ((_c = (_b = suggest.getValue) == null ? void 0 : _b.call(suggest)) != null ? _c : "").trim().toLowerCase();
  const nativeSuggestions = [];
  const seen = /* @__PURE__ */ new Set();
  for (const suggestion of suggestions) {
    if (!suggestion || typeof suggestion.text !== "string") {
      nativeSuggestions.push(suggestion);
      continue;
    }
    const key = suggestion.text.toLowerCase();
    if (allowed.has(key) || managedNames.has(key) && !allowed.has(key)) {
      continue;
    }
    if (currentKeys.has(key)) {
      continue;
    }
    if (!seen.has(key)) {
      seen.add(key);
      nativeSuggestions.push(suggestion);
    }
  }
  const extras = [];
  for (const recommendation of recommendations) {
    const key = recommendation.name.toLowerCase();
    if (currentKeys.has(key) || seen.has(key)) {
      continue;
    }
    if (!matchesQuery(recommendation.name, query)) {
      continue;
    }
    extras.push({
      type: "text",
      text: recommendation.name,
      widget: getPropertyTypeWidget(recommendation),
      score: 0,
      matches: null
    });
  }
  return [...extras, ...nativeSuggestions];
}
function isPropertyKeySuggest(suggest) {
  var _a, _b;
  const suggestEl = suggest.suggestEl;
  if (suggestEl == null ? void 0 : suggestEl.classList.contains("mod-property-key")) {
    return true;
  }
  return Boolean(
    (_b = (_a = suggest.textInputEl) == null ? void 0 : _a.closest) == null ? void 0 : _b.call(_a, ".metadata-property-key")
  );
}
function getFileForInput(app, inputEl) {
  if (inputEl == null ? void 0 : inputEl.closest) {
    const leafEl = inputEl.closest(".workspace-leaf");
    if (leafEl) {
      let found = null;
      app.workspace.iterateAllLeaves((leaf) => {
        var _a;
        if (found) {
          return;
        }
        const view = leaf.view;
        if (((_a = view.containerEl) == null ? void 0 : _a.contains(inputEl)) && view.file instanceof import_obsidian.TFile) {
          found = view.file;
        }
      });
      if (found) {
        return found;
      }
    }
  }
  return app.workspace.getActiveFile();
}
function matchesQuery(name, query) {
  if (!query) {
    return true;
  }
  const normalizedName = name.toLowerCase();
  if (normalizedName.includes(query)) {
    return true;
  }
  let queryIndex = 0;
  for (const character of normalizedName) {
    if (character === query[queryIndex]) {
      queryIndex++;
      if (queryIndex === query.length) {
        return true;
      }
    }
  }
  return false;
}

// src/settings-tab.ts
var import_obsidian2 = require("obsidian");
var DynamicPropertiesSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("dp-settings");
    new import_obsidian2.Setting(containerEl).setName("Dynamic Properties").setHeading();
    containerEl.createEl("p", {
      cls: "dp-intro",
      text: "\u7ED9\u7B14\u8BB0\u52A0\u4E0A\u6307\u5B9A\u6807\u7B7E\u540E\uFF0C\u5728\u539F\u751F\u201C\u6DFB\u52A0\u5C5E\u6027\u201D\u7684\u5019\u9009\u5217\u8868\u91CC\u8FFD\u52A0\u4F60\u914D\u7F6E\u7684\u5C5E\u6027\u3002\u6CA1\u6709\u547D\u4E2D\u6807\u7B7E\u7684\u7B14\u8BB0\u4E0D\u4F1A\u770B\u5230\u8FD9\u4E9B\u989D\u5916\u5C5E\u6027\u3002"
    });
    containerEl.createEl("p", {
      cls: "dp-note",
      text: "\u5339\u914D\u7684\u662F\u7B14\u8BB0\u4E2D\u7684\u5168\u90E8\u6807\u7B7E\uFF1Afrontmatter tags \u4E0E\u6B63\u6587\u91CC\u7684 #\u6807\u7B7E \u90FD\u7B97\u3002\u4FEE\u6539\u8BBE\u7F6E\u540E\u7ACB\u5373\u751F\u6548\uFF0C\u65E0\u9700\u91CD\u542F\u3002"
    });
    new import_obsidian2.Setting(containerEl).setName("\u5339\u914D\u5B50\u6807\u7B7E").setDesc(
      "\u4F8B\u5982\u89C4\u5219\u201C\u8BFB\u4E66\u7B14\u8BB0\u201D\u4E5F\u4F1A\u5339\u914D #\u8BFB\u4E66\u7B14\u8BB0/\u5C0F\u8BF4\uFF1B\u5173\u95ED\u540E\u53EA\u5339\u914D\u5B8C\u5168\u76F8\u540C\u7684\u6807\u7B7E\u3002"
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.matchNestedTags).onChange((value) => {
        this.plugin.settings.matchNestedTags = value;
        void this.plugin.saveSettings();
      })
    );
    const rulesEl = containerEl.createDiv("dp-rules");
    if (this.plugin.settings.rules.length === 0) {
      rulesEl.createDiv({
        cls: "dp-empty-state",
        text: "\u8FD8\u6CA1\u6709\u6807\u7B7E\u89C4\u5219\u3002\u70B9\u51FB\u4E0B\u65B9\u201C\u6DFB\u52A0\u6807\u7B7E\u89C4\u5219\u201D\u5F00\u59CB\u914D\u7F6E\u3002"
      });
    } else {
      for (const rule of this.plugin.settings.rules) {
        this.renderRule(rulesEl, rule);
      }
    }
    new import_obsidian2.Setting(containerEl).setClass("dp-add-rule-setting").addButton(
      (button) => button.setButtonText("+ \u6DFB\u52A0\u6807\u7B7E\u89C4\u5219").setCta().onClick(() => {
        const rule = createRule();
        this.plugin.settings.rules.push(rule);
        void this.plugin.saveSettings();
        this.display();
        focusAfterRender(this.containerEl, rule.id, "tag");
      })
    );
    containerEl.createEl("p", {
      cls: "dp-footer-note",
      text: "\u5C5E\u6027\u7C7B\u578B\u6CBF\u7528 Obsidian \u7684\u5168\u5C40\u7C7B\u578B\u8BBE\u7F6E\uFF08types.json\uFF09\u3002\u540C\u540D\u5C5E\u6027\u4E0D\u4F1A\u91CD\u590D\u51FA\u73B0\uFF1Btags\u3001aliases\u3001cssclasses \u4ECD\u7531\u539F\u751F\u903B\u8F91\u63D0\u4F9B\u3002"
    });
  }
  renderRule(parentEl, rule) {
    const card = parentEl.createDiv({
      cls: "dp-rule",
      attr: { "data-rule-id": rule.id }
    });
    const header = card.createDiv("dp-rule-header");
    const title = header.createDiv({
      cls: "dp-rule-title",
      text: rule.tag ? `#${normalizeTag(rule.tag)}` : "\u672A\u547D\u540D\u89C4\u5219"
    });
    const removeButton = header.createEl("button", {
      cls: "clickable-icon dp-rule-delete",
      attr: { "aria-label": "\u5220\u9664\u8FD9\u6761\u6807\u7B7E\u89C4\u5219" }
    });
    (0, import_obsidian2.setIcon)(removeButton, "trash-2");
    removeButton.addEventListener("click", () => {
      const index = this.plugin.settings.rules.findIndex(
        (candidate) => candidate.id === rule.id
      );
      if (index >= 0) {
        this.plugin.settings.rules.splice(index, 1);
        void this.plugin.saveSettings();
        this.display();
      }
    });
    new import_obsidian2.Setting(card).setClass("dp-tag-setting").setName("\u76EE\u6807\u6807\u7B7E").setDesc("\u53EF\u5199 #\u8BFB\u4E66\u7B14\u8BB0 \u6216 \u8BFB\u4E66\u7B14\u8BB0\u3002").addText((text) => {
      this.configureTagInput(text, rule, title);
    });
    const propsHeader = card.createDiv("dp-props-header");
    propsHeader.createSpan({ cls: "dp-col-name", text: "\u5C5E\u6027\u540D" });
    propsHeader.createSpan({ cls: "dp-col-type", text: "\u7C7B\u578B" });
    propsHeader.createSpan({ cls: "dp-col-action" });
    if (rule.properties.length === 0) {
      card.createDiv({
        cls: "dp-empty",
        text: "\u8FD9\u6761\u89C4\u5219\u8FD8\u6CA1\u6709\u63A8\u8350\u5C5E\u6027\u3002"
      });
    } else {
      for (const property of rule.properties) {
        this.renderPropertyRow(card, rule, property);
      }
    }
    new import_obsidian2.Setting(card).setClass("dp-add-property-setting").addButton(
      (button) => button.setButtonText("+ \u6DFB\u52A0\u63A8\u8350\u5C5E\u6027").onClick(() => {
        rule.properties.push({ name: "", type: "text" });
        void this.plugin.saveSettings();
        this.display();
        focusAfterRender(this.containerEl, rule.id, "property");
      })
    );
  }
  configureTagInput(text, rule, titleEl) {
    text.setPlaceholder("\u4F8B\u5982\uFF1A\u8BFB\u4E66\u7B14\u8BB0").setValue(rule.tag).onChange((value) => {
      rule.tag = value;
      titleEl.setText(value.trim() ? `#${normalizeTag(value)}` : "\u672A\u547D\u540D\u89C4\u5219");
    });
    text.inputEl.addClass("dp-tag-input");
    text.inputEl.dataset.ruleId = rule.id;
    text.inputEl.setAttribute("aria-label", "\u76EE\u6807\u6807\u7B7E");
    text.inputEl.addEventListener("blur", () => {
      rule.tag = normalizeTag(rule.tag);
      if (text.inputEl.value !== rule.tag) {
        text.inputEl.value = rule.tag;
      }
      titleEl.setText(rule.tag ? `#${rule.tag}` : "\u672A\u547D\u540D\u89C4\u5219");
      void this.plugin.saveSettings();
    });
    text.inputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        text.inputEl.blur();
      }
    });
  }
  renderPropertyRow(parentEl, rule, property) {
    const setting = new import_obsidian2.Setting(parentEl).setClass("dp-property-setting");
    setting.addText((text) => {
      text.setPlaceholder("\u4F8B\u5982\uFF1Aauthor").setValue(property.name).onChange((value) => {
        property.name = value;
        this.validatePropertyNameInput(text.inputEl, value);
      });
      text.inputEl.addClass("dp-property-name");
      text.inputEl.setAttribute("aria-label", "\u63A8\u8350\u5C5E\u6027\u540D");
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
          PROPERTY_TYPE_OPTIONS.map((option) => [option.value, option.label])
        )
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
        `\u201C${property.name || "\u5C5E\u6027"}\u201D\u7684\u7C7B\u578B`
      );
    });
    setting.addExtraButton((button) => {
      const label = `\u5220\u9664\u5C5E\u6027\u201C${property.name || "\u672A\u547D\u540D"}\u201D`;
      button.setIcon("trash-2").setTooltip(label).onClick(() => {
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
      `${property.name || "\u672A\u547D\u540D"}\uFF0C${getPropertyTypeLabel(property.type)}`
    );
  }
  validatePropertyNameInput(inputEl, value) {
    const normalized = normalizePropertyName(value).toLowerCase();
    const reserved = RESERVED_PROPERTY_NAMES.has(normalized);
    inputEl.toggleClass("dp-invalid", reserved);
    if (reserved) {
      inputEl.setAttribute(
        "title",
        "\u8FD9\u662F Obsidian \u5185\u7F6E\u5C5E\u6027\uFF0C\u59CB\u7EC8\u7531\u539F\u751F\u903B\u8F91\u63D0\u4F9B\uFF0C\u65E0\u9700\u5728\u8FD9\u91CC\u914D\u7F6E\u3002"
      );
    } else {
      inputEl.removeAttribute("title");
    }
  }
};
function focusAfterRender(containerEl, ruleId, target) {
  window.setTimeout(() => {
    var _a;
    const ruleEl = containerEl.querySelector(
      `.dp-rule[data-rule-id="${ruleId}"]`
    );
    if (!ruleEl) {
      return;
    }
    const selector = target === "tag" ? ".dp-tag-input" : ".dp-property-name";
    const inputs = ruleEl.querySelectorAll(selector);
    (_a = inputs[inputs.length - 1]) == null ? void 0 : _a.focus();
  }, 0);
}

// src/main.ts
var DynamicPropertiesPlugin = class extends import_obsidian3.Plugin {
  constructor() {
    super(...arguments);
    this.recommendationCache = /* @__PURE__ */ new Map();
    this.uninstallSuggestPatch = null;
    this.warnedAboutTypeManager = false;
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new DynamicPropertiesSettingTab(this.app, this));
    this.registerEvent(
      this.app.metadataCache.on("changed", (file, _data, cache) => {
        this.recommendationCache.set(
          file.path,
          resolveRecommendations(cache, this.settings)
        );
      })
    );
    this.registerEvent(
      this.app.metadataCache.on("deleted", (file) => {
        this.recommendationCache.delete(file.path);
      })
    );
    this.registerEvent(
      this.app.metadataCache.on("resolved", () => {
        this.recommendationCache.clear();
      })
    );
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (file) {
          this.refreshRecommendations(file);
        }
      })
    );
    this.uninstallSuggestPatch = installPropertySuggestPatch(this);
    if (!this.uninstallSuggestPatch) {
      new import_obsidian3.Notice(
        "Dynamic Properties: \u5F53\u524D Obsidian \u7248\u672C\u4E0D\u652F\u6301\u539F\u751F\u5019\u9009\u6CE8\u5165\uFF0C\u63D2\u4EF6\u672A\u751F\u6548\u3002"
      );
    }
  }
  onunload() {
    var _a;
    (_a = this.uninstallSuggestPatch) == null ? void 0 : _a.call(this);
    this.uninstallSuggestPatch = null;
    this.recommendationCache.clear();
  }
  getRecommendationsForFile(file) {
    if (!file) {
      return [];
    }
    const cached = this.recommendationCache.get(file.path);
    if (cached) {
      return cached;
    }
    const recommendations = resolveRecommendations(
      this.app.metadataCache.getFileCache(file),
      this.settings
    );
    this.recommendationCache.set(file.path, recommendations);
    return recommendations;
  }
  getManagedPropertyNames() {
    return getManagedPropertyNames(this.settings);
  }
  applyPropertyType(propertyName, file) {
    var _a;
    const recommendation = findRecommendation(
      this.getRecommendationsForFile(file),
      propertyName
    );
    if (!recommendation) {
      return;
    }
    const manager = this.app.metadataTypeManager;
    if (!(manager == null ? void 0 : manager.setType)) {
      if (!this.warnedAboutTypeManager) {
        this.warnedAboutTypeManager = true;
        console.warn(
          "[dynamic-properties] app.metadataTypeManager.setType() is unavailable; property values will use Obsidian's inferred type."
        );
      }
      return;
    }
    const widget = getPropertyTypeOption(recommendation.type).widget;
    if (((_a = manager.getAssignedWidget) == null ? void 0 : _a.call(manager, recommendation.name)) === widget) {
      return;
    }
    void manager.setType(recommendation.name, widget).catch((error) => {
      console.error("[dynamic-properties] Failed to save property type.", error);
      new import_obsidian3.Notice(`\u65E0\u6CD5\u8BBE\u7F6E\u5C5E\u6027 \u201C${recommendation.name}\u201D \u7684\u7C7B\u578B\u3002`);
    });
  }
  async saveSettings() {
    try {
      await this.saveData(this.settings);
      this.recommendationCache.clear();
      this.refreshRecommendations(this.app.workspace.getActiveFile());
    } catch (error) {
      console.error("[dynamic-properties] Failed to save settings.", error);
      new import_obsidian3.Notice("\u4FDD\u5B58 Dynamic Properties \u8BBE\u7F6E\u5931\u8D25\u3002");
    }
  }
  async reloadSettingsFromDisk() {
    await this.loadSettings();
    this.recommendationCache.clear();
    this.refreshRecommendations(this.app.workspace.getActiveFile());
  }
  async loadSettings() {
    const data = await this.loadData();
    this.settings = sanitizeSettings(data);
  }
  refreshRecommendations(file) {
    if (!file) {
      return;
    }
    this.recommendationCache.set(
      file.path,
      resolveRecommendations(
        this.app.metadataCache.getFileCache(file),
        this.settings
      )
    );
  }
};
