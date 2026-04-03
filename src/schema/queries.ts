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
          enum: ["none", "emoji", "icon"],
          type: "string",
        },
        prefixValue: {
          type: "string",
        },
        css: {
          type: "string",
        },
        enabled: {
          type: "boolean",
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
