export type PropertyType =
  | "text"
  | "number"
  | "list"
  | "date"
  | "datetime"
  | "checkbox";

export interface PropertyRecommendation {
  name: string;
  type: PropertyType;
}

export interface TagRule {
  id: string;
  tag: string;
  properties: PropertyRecommendation[];
}

export interface DynamicPropertiesSettings {
  rules: TagRule[];
  matchNestedTags: boolean;
}

export interface PropertyTypeOption {
  value: PropertyType;
  label: string;
  widget: string;
}

export const PROPERTY_TYPE_OPTIONS: readonly PropertyTypeOption[] = [
  { value: "text", label: "文本", widget: "text" },
  { value: "number", label: "数字", widget: "number" },
  { value: "list", label: "列表", widget: "multitext" },
  { value: "date", label: "日期", widget: "date" },
  { value: "datetime", label: "日期时间", widget: "datetime" },
  { value: "checkbox", label: "复选框", widget: "checkbox" },
];

const PROPERTY_TYPE_MAP = new Map<string, PropertyTypeOption>(
  PROPERTY_TYPE_OPTIONS.map((option) => [option.value, option]),
);

/** Native Obsidian properties that must keep their original behaviour. */
export const RESERVED_PROPERTY_NAMES = new Set([
  "tags",
  "aliases",
  "cssclasses",
]);

export function isPropertyType(value: unknown): value is PropertyType {
  return typeof value === "string" && PROPERTY_TYPE_MAP.has(value);
}

export function getPropertyTypeOption(
  type: PropertyType,
): PropertyTypeOption {
  return PROPERTY_TYPE_MAP.get(type) ?? PROPERTY_TYPE_OPTIONS[0];
}

export function getWidgetForPropertyType(type: PropertyType): string {
  return getPropertyTypeOption(type).widget;
}

export function getPropertyTypeLabel(type: PropertyType): string {
  return getPropertyTypeOption(type).label;
}

export function normalizePropertyName(raw: string): string {
  return raw.trim().replace(/^#+/, "").trim();
}

export function createRule(
  tag = "",
  properties: PropertyRecommendation[] = [],
): TagRule {
  return {
    id: createId(),
    tag,
    properties,
  };
}

export function createDefaultSettings(): DynamicPropertiesSettings {
  return {
    matchNestedTags: true,
    rules: [
      createRule("读书笔记", [
        { name: "author", type: "text" },
        { name: "url", type: "text" },
      ]),
    ],
  };
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
