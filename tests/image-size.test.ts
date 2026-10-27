import assert from "node:assert/strict";
import test from "node:test";
import Ajv from "ajv";
import { App } from "obsidian";
import { parseImageSize } from "../src/image-size";
import { queriesSchema } from "../src/schema/queries";
import { renderAppearance } from "../src/settings/appearance-editor";
import { RuleAppearance } from "../src/settings/settings";
import { createTestDocument } from "./dom-fixture";
import { setLanguage } from "./obsidian-mock";

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

function appearanceFixture(style: RuleAppearance, inherited?: RuleAppearance, language = "en") {
  const { document, window } = createTestDocument();
  setLanguage(language);
  let changes = 0;
  let cleanup: (() => void) | undefined;
  const render = () => {
    cleanup?.(); document.body.empty();
    cleanup = renderAppearance(document.body, {} as App, style, () => { changes++; }, {
      inherited: inherited !== undefined,
      effective: () => ({ ...inherited, ...style }),
      refresh: inherited === undefined ? undefined : render,
    });
  };
  render();
  const inputs = () => Array.from(document.querySelectorAll<HTMLInputElement>(".kd-dimensions input"));
  assert.equal(inputs().length, 3);
  assert.equal(document.querySelectorAll(".kd-dimensions .kd-inherit-reset").length, 0);
  return {
    document,
    get inputs() { return inputs(); },
    get reset() {
      const button = document.querySelector<HTMLButtonElement>(".kd-dimensions-heading > .kd-inherit-reset");
      assert.ok(button);
      return button;
    },
    cleanup() { cleanup?.(); setLanguage("en"); },
    changes: () => changes,
    input(index: number, value: string) {
      inputs()[index].value = value;
      inputs()[index].dispatchEvent(new window.Event("input"));
    },
    blur(index: number) { inputs()[index].dispatchEvent(new window.Event("blur")); },
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

void test("image size heading reset clears all three overrides and restores inherited values or defaults", () => {
  const cases: (RuleAppearance | undefined)[] = [undefined, { imageWidth: "2em", imageHeight: 50, imageCornerRadius: "0.5em" }];
  for (const inherited of cases) {
    const style: RuleAppearance = { prefixType: "url", prefixValue: "https://example.com/image.png", imageWidth: 32, imageHeight: "1.5em", imageCornerRadius: 5 };
    const fixture = appearanceFixture(style, inherited);
    assert.equal(fixture.document.querySelectorAll(".kd-image-size .kd-inherit-reset").length, 1);
    assert.equal(fixture.reset.disabled, false);
    fixture.reset.click();
    assert.deepEqual(style, { prefixType: "url", prefixValue: "https://example.com/image.png" });
    assert.deepEqual(fixture.inputs.map(input => input.value), inherited ? ["2em", "50", "0.5em"] : ["24", "24", ""]);
    assert.equal(fixture.changes(), 1);
    assert.equal(fixture.reset.disabled, true);
    fixture.input(2, "6");
    assert.equal(fixture.reset.disabled, false);
    assert.equal(style.imageWidth, undefined);
    assert.equal(style.imageHeight, undefined);
    assert.equal(style.imageCornerRadius, 6);
    fixture.cleanup();
  }
});

void test("image size labels and concise descriptions render in English and Chinese", () => {
  for (const [language, heading, labels, descriptions] of [
    ["en", "Image size", ["Width", "Height", "Radius"], ["px or em; plain number = px.", "Show only the emoji, image or SVG.", "Decorate only the first occurrence in the note."]],
    ["zh", "图片大小", ["宽度", "高度", "圆角"], ["px 或 em；纯数字按 px 处理。", "只显示 Emoji、图片或 SVG。", "仅装饰笔记中首次出现的匹配。"]],
  ] as const) {
    const fixture = appearanceFixture({ prefixType: "url" }, undefined, language);
    assert.equal(fixture.document.querySelector(".kd-dimensions-heading > span")?.textContent, heading);
    assert.deepEqual(Array.from(fixture.document.querySelectorAll(".kd-dimensions label"), label => label.textContent), labels);
    const captions = Array.from(fixture.document.querySelectorAll(".kd-caption"), caption => caption.textContent);
    for (const description of descriptions) assert.ok(captions.includes(description), description);
    fixture.cleanup();
  }
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
