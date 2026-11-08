import type { CachedMetadata } from "obsidian";
import {
  createDefaultSettings,
  createRule,
  getPropertyTypeOption,
  isPropertyType,
  normalizePropertyName,
  RESERVED_PROPERTY_NAMES,
  type DynamicPropertiesSettings,
  type PropertyRecommendation,
  type TagRule,
} from "./types";

export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, "").replace(/\/+$/, "").toLowerCase();
}

export function collectDocumentTags(
  cache: CachedMetadata | null | undefined,
): Set<string> {
  const tags = new Set<string>();
  const frontmatter = cache?.frontmatter;

  if (frontmatter) {
    addFrontmatterValue(tags, frontmatter.tags);
    addFrontmatterValue(tags, frontmatter.tag);
  }

  for (const tag of cache?.tags ?? []) {
    const normalized = normalizeTag(tag.tag);
    if (normalized) {
      tags.add(normalized);
    }
  }

  return tags;
}

function addFrontmatterValue(tags: Set<string>, value: unknown): void {
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

export function ruleMatchesTag(
  ruleTag: string,
  documentTags: Set<string>,
  matchNestedTags: boolean,
): boolean {
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

export function resolveRecommendations(
  cache: CachedMetadata | null | undefined,
  settings: DynamicPropertiesSettings,
): PropertyRecommendation[] {
  const documentTags = collectDocumentTags(cache);
  const recommendations = new Map<string, PropertyRecommendation>();

  for (const rule of settings.rules) {
    if (!ruleMatchesTag(rule.tag, documentTags, settings.matchNestedTags)) {
      continue;
    }

    for (const property of rule.properties) {
      const name = normalizePropertyName(property.name);
      const key = name.toLowerCase();

      if (
        !name ||
        RESERVED_PROPERTY_NAMES.has(key) ||
        recommendations.has(key)
      ) {
        continue;
      }

      recommendations.set(key, {
        name,
        type: isPropertyType(property.type) ? property.type : "text",
      });
    }
  }

  return Array.from(recommendations.values());
}

export function getManagedPropertyNames(
  settings: DynamicPropertiesSettings,
): Set<string> {
  const names = new Set<string>();

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

export function findRecommendation(
  recommendations: PropertyRecommendation[],
  propertyName: string,
): PropertyRecommendation | undefined {
  const key = normalizePropertyName(propertyName).toLowerCase();
  return recommendations.find(
    (recommendation) => recommendation.name.toLowerCase() === key,
  );
}

export function sanitizeSettings(
  raw: Partial<DynamicPropertiesSettings> | null | undefined,
): DynamicPropertiesSettings {
  if (!raw) {
    return createDefaultSettings();
  }

  const fallback = createDefaultSettings();
  const rawRules = Array.isArray(raw.rules) ? raw.rules : fallback.rules;

  return {
    matchNestedTags: raw.matchNestedTags !== false,
    rules: rawRules
      .map((rule) => sanitizeRule(rule))
      .filter((rule): rule is TagRule => rule !== null),
  };
}

function sanitizeRule(raw: unknown): TagRule | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Partial<TagRule>;
  const properties: PropertyRecommendation[] = [];
  const seen = new Set<string>();

  if (Array.isArray(candidate.properties)) {
    for (const rawProperty of candidate.properties) {
      if (!rawProperty || typeof rawProperty !== "object") {
        continue;
      }

      const property = rawProperty as Partial<PropertyRecommendation>;
      const name =
        typeof property.name === "string"
          ? normalizePropertyName(property.name)
          : "";
      const key = name.toLowerCase();

      if (!name || seen.has(key)) {
        continue;
      }

      seen.add(key);
      properties.push({
        name,
        type: isPropertyType(property.type) ? property.type : "text",
      });
    }
  }

  const rule = createRule(
    typeof candidate.tag === "string" ? candidate.tag : "",
    properties,
  );

  if (typeof candidate.id === "string" && candidate.id.trim()) {
    rule.id = candidate.id;
  }

  return rule;
}

export function getPropertyTypeWidget(
  recommendation: PropertyRecommendation,
): string {
  return getPropertyTypeOption(recommendation.type).widget;
}
