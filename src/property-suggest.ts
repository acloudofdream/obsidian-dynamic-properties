import { AbstractInputSuggest, TFile, type App } from "obsidian";
import { getPropertyTypeWidget } from "./tags";
import type { PropertyRecommendation } from "./types";

interface PropertySuggestionItem {
  type?: string;
  text: string;
  widget?: string;
  score?: number;
  matches?: unknown;
  [key: string]: unknown;
}

interface PropertySuggestInstance {
  app: App;
  suggestEl?: HTMLElement;
  textInputEl?: HTMLElement;
  properties?: Array<{ key: string }>;
  getValue?: () => string;
}

interface PropertySuggestPrototype {
  showSuggestions(
    this: PropertySuggestInstance,
    suggestions: PropertySuggestionItem[],
  ): void;
  selectSuggestion(
    this: PropertySuggestInstance,
    value: PropertySuggestionItem | null,
    evt: MouseEvent | KeyboardEvent,
  ): void;
}

export interface PropertySuggestHost {
  app: App;
  getRecommendationsForFile(file: TFile | null): PropertyRecommendation[];
  getManagedPropertyNames(): Set<string>;
  applyPropertyType(propertyName: string, file: TFile | null): void;
}

const LOG_PREFIX = "[dynamic-properties]";

export function installPropertySuggestPatch(
  host: PropertySuggestHost,
): (() => void) | null {
  const prototype = AbstractInputSuggest.prototype as unknown as
    | PropertySuggestPrototype
    | undefined;

  if (
    !prototype ||
    typeof prototype.showSuggestions !== "function" ||
    typeof prototype.selectSuggestion !== "function"
  ) {
    console.warn(
      `${LOG_PREFIX} AbstractInputSuggest API is unavailable; native property suggestions were not patched.`,
    );
    return null;
  }

  const originalShowSuggestions = prototype.showSuggestions;
  const originalSelectSuggestion = prototype.selectSuggestion;

  const patchedShowSuggestions = function (
    this: PropertySuggestInstance,
    suggestions: PropertySuggestionItem[],
  ): void {
    if (isPropertyKeySuggest(this)) {
      try {
        suggestions = buildAugmentedSuggestions(host, this, suggestions);
      } catch (error) {
        console.error(
          `${LOG_PREFIX} Failed to augment property suggestions.`,
          error,
        );
      }
    }

    originalShowSuggestions.call(this, suggestions);
  };

  const patchedSelectSuggestion = function (
    this: PropertySuggestInstance,
    value: PropertySuggestionItem | null,
    evt: MouseEvent | KeyboardEvent,
  ): void {
    const file = isPropertyKeySuggest(this)
      ? getFileForInput(this.app, this.textInputEl)
      : null;

    originalSelectSuggestion.call(this, value, evt);

    if (file && value && typeof value.text === "string" && value.text.trim()) {
      try {
        host.applyPropertyType(value.text, file);
      } catch (error) {
        console.error(
          `${LOG_PREFIX} Failed to apply the configured property type.`,
          error,
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

function buildAugmentedSuggestions(
  host: PropertySuggestHost,
  suggest: PropertySuggestInstance,
  suggestions: PropertySuggestionItem[],
): PropertySuggestionItem[] {
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
      recommendation,
    ]),
  );
  const currentKeys = new Set(
    (suggest.properties ?? []).map((property) => property.key.toLowerCase()),
  );
  const query = (suggest.getValue?.() ?? "").trim().toLowerCase();
  const nativeSuggestions: PropertySuggestionItem[] = [];
  const seen = new Set<string>();

  for (const suggestion of suggestions) {
    if (!suggestion || typeof suggestion.text !== "string") {
      nativeSuggestions.push(suggestion);
      continue;
    }

    const key = suggestion.text.toLowerCase();

    if (allowed.has(key) || (managedNames.has(key) && !allowed.has(key))) {
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

  const extras: PropertySuggestionItem[] = [];

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
      matches: null,
    });
  }

  return [...extras, ...nativeSuggestions];
}

function isPropertyKeySuggest(suggest: PropertySuggestInstance): boolean {
  const suggestEl = suggest.suggestEl;
  if (suggestEl?.classList.contains("mod-property-key")) {
    return true;
  }

  return Boolean(
    suggest.textInputEl?.closest?.(".metadata-property-key"),
  );
}

function getFileForInput(
  app: App,
  inputEl: HTMLElement | undefined,
): TFile | null {
  if (inputEl?.closest) {
    const leafEl = inputEl.closest(".workspace-leaf");

    if (leafEl) {
      let found: TFile | null = null;

      app.workspace.iterateAllLeaves((leaf) => {
        if (found) {
          return;
        }

        const view = leaf.view as unknown as {
          containerEl?: HTMLElement;
          file?: unknown;
        };

        if (
          view.containerEl?.contains(inputEl) &&
          view.file instanceof TFile
        ) {
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

function matchesQuery(name: string, query: string): boolean {
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
