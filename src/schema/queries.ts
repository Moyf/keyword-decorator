export const queriesSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  additionalProperties: {
    $ref: "#/definitions/SearchQuery",
  },
  definitions: {
    SearchQuery: {
      properties: {
        class: {
          type: "string",
        },
        name: {
          type: "string",
        },
        color: {
          type: ["null", "string"],
        },
        textColor: {
          type: ["null", "string"],
        },
        fontWeight: {
          type: "string",
        },
        italic: {
          type: "boolean",
        },
        underline: {
          type: "boolean",
        },
        prefixType: {
          enum: ["none", "emoji", "icon", "image", "url", "svg"],
          type: "string",
        },
        prefixValue: {
          type: "string",
        },
        prefixValues: {
          additionalProperties: { type: "string" },
          type: "object",
        },
        css: {
          type: "string",
        },
        enabled: {
          type: "boolean",
        },
        groupId: {
          type: "string",
        },
        iconInheritColor: {
          type: "boolean",
        },
        backgroundIncludesMarker: {
          type: "boolean",
        },
        styleWholeLine: {
          type: "boolean",
        },
        decorateOnce: {
          type: "boolean",
        },
        hideText: {
          type: "boolean",
        },
        imageWidth: {
          anyOf: [
            { type: "integer", minimum: 1, maximum: 512 },
            { type: "string", pattern: "^\\d+(?:\\.\\d+)?(?:px|em)?$" },
          ],
        },
        imageHeight: {
          anyOf: [
            { type: "integer", minimum: 1, maximum: 512 },
            { type: "string", pattern: "^\\d+(?:\\.\\d+)?(?:px|em)?$" },
          ],
        },
        imageCornerRadius: {
          anyOf: [
            { type: "integer", minimum: 1, maximum: 512 },
            { type: "string", pattern: "^\\d+(?:\\.\\d+)?(?:px|em)?$" },
          ],
        },
        queryMode: {
          enum: ["keywords", "single", "multiple", "regex", "emoji-shortcodes"],
          type: "string",
        },
        mark: {
          items: {
            enum: ["end", "group", "line", "match", "start"],
            type: "string",
          },
          type: "array",
        },
        query: {
          type: "string",
        },
        regex: {
          type: "boolean",
        },
      },
      required: ["query", "regex"],
      type: "object",
    },
  },
  type: "object",
};
