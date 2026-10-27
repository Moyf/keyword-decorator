import assert from "node:assert/strict";
import test from "node:test";
import Ajv from "ajv";
import { App } from "obsidian";
import { parseImageSize } from "../src/image-size";
import { queriesSchema } from "../src/schema/queries";
import { renderAppearance } from "../src/settings/appearance-editor";
import { RuleAppearance } from "../src/settings/settings";
import { createTestDocument } from "./dom-fixture";

void test("all image size schema fields agree with runtime limits and case-insensitive units", () => {
  const validate = new Ajv({ strict: false, strictNumbers: true }).compile(queriesSchema);
  const values: (number | string)[] = [
    0, 1, 512, 513, 1.5, "0", "0em", "0.01em", "0.0em", "1.5em", "31.99EM", "32em", "32.0Em", "32.01em",
    "1px", "512PX", "513px", "1.5px", "1.0Px", "0001.00PX", "000.001EM", "0032.000em", " 24PX ", "2rem", "1e2px", ".5em", "-1px", "",
  ];
  for (let amount = 0; amount <= 514; amount++) for (const unit of ["", "px", "PX", "em", "Em"]) values.push(`${amount}${unit}`);
  for (const field of ["imageWidth", "imageHeight", "imageCornerRadius"]) {
    for (const value of values) {
      assert.equal(validate({ rule: { query: "x", regex: false, [field]: value } }), parseImageSize(value) !== null, `${field}: ${JSON.stringify(value)}`);
    }
  }
});

function appearanceFixture(style: RuleAppearance, inherited: RuleAppearance = {}) {
  const { document, window } = createTestDocument();
  let changes = 0;
  const cleanup = renderAppearance(document.body, {} as App, style, () => { changes++; }, {
    inherited: true,
    effective: () => ({ ...inherited, ...style }),
  });
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(".kd-dimensions input"));
  assert.equal(inputs.length, 3);
  return {
    inputs, cleanup, changes: () => changes,
    input(index: number, value: string) {
      inputs[index].value = value;
      inputs[index].dispatchEvent(new window.Event("input"));
    },
    blur(index: number) { inputs[index].dispatchEvent(new window.Event("blur")); },
  };
}

void test("appearance inputs restore the current effective size on blur after an invalid draft", () => {
  const style: RuleAppearance = { prefixType: "url", imageWidth: 32, imageHeight: "1.5em", imageCornerRadius: 5 };
  const fixture = appearanceFixture(style);
  for (const [index, invalid, expected] of [[0, "513px", "32"], [1, "33em", "1.5em"], [2, "2rem", "5"]] as const) {
    fixture.input(index, invalid);
    assert.equal(fixture.inputs[index].getAttribute("aria-invalid"), "true");
    assert.equal(fixture.changes(), 0);
    fixture.blur(index);
    assert.equal(fixture.inputs[index].value, expected);
    assert.equal(fixture.inputs[index].getAttribute("aria-invalid"), "false");
  }
  fixture.input(0, "1.");
  assert.equal(fixture.inputs[0].value, "1."); // Do not destroy partially typed em values.
  fixture.input(0, "1.5EM");
  assert.equal(style.imageWidth, "1.5em");
  fixture.blur(0);
  assert.equal(fixture.inputs[0].value, "1.5em");
  fixture.cleanup();
});

void test("clearing width and height selects default 24 while clearing radius removes its override", () => {
  const style: RuleAppearance = { prefixType: "url", imageCornerRadius: 5 };
  const fixture = appearanceFixture(style, { imageWidth: "2em", imageHeight: 50 });
  for (const index of [0, 1, 2]) { fixture.input(index, ""); fixture.blur(index); }
  assert.equal(style.imageWidth, 24);
  assert.equal(style.imageHeight, 24);
  assert.equal(style.imageCornerRadius, undefined);
  assert.deepEqual(fixture.inputs.map(input => input.value), ["24", "24", ""]);
  assert.equal(fixture.changes(), 3);
  fixture.cleanup();
});
