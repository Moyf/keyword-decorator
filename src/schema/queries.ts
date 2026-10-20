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
        hideText: {
          type: "boolean",
        },
        imageWidth: {
          maximum: 512,
          minimum: 1,
          type: "integer",
        },
        imageHeight: {
          maximum: 512,
          minimum: 1,
          type: "integer",
        },
        queryMode: {
          enum: ["keywords", "single", "multiple", "regex"],
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
