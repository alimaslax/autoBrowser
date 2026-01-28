import { Type } from "@sinclair/typebox";

function stringEnum<T extends string[]>(values: T) {
    return Type.Union(values.map((v) => Type.Literal(v)));
}

function optionalStringEnum<T extends string[]>(values: T) {
    return Type.Optional(stringEnum(values));
}

const BROWSER_ACT_KINDS = [
    "click",
    "type",
    "scroll",
    "hover",
    "navigate",
] as const;

const BROWSER_TOOL_ACTIONS = [
    "start",
    "stop",
    "snapshot",
    "act",
] as const;

const BROWSER_SNAPSHOT_FORMATS = ["aria", "ai"] as const;

export const BrowserActSchema = Type.Object({
    kind: stringEnum(BROWSER_ACT_KINDS),
    targetId: Type.Optional(Type.String()),
    ref: Type.Optional(Type.String()),
    text: Type.Optional(Type.String()),
    pressEnter: Type.Optional(Type.Boolean()),
    url: Type.Optional(Type.String()),
    button: Type.Optional(Type.String()),
});

export const BrowserToolSchema = Type.Object({
    action: stringEnum(BROWSER_TOOL_ACTIONS),
    targetId: Type.Optional(Type.String()),
    format: optionalStringEnum(BROWSER_SNAPSHOT_FORMATS),
    maxChars: Type.Optional(Type.Number()),
    headless: Type.Optional(Type.Boolean()),
    request: Type.Optional(BrowserActSchema),
});

export type BrowserToolParams = typeof BrowserToolSchema.static;
