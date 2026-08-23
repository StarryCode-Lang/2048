import test from "node:test";
import assert from "node:assert/strict";
import { LANGUAGES, TRANSLATIONS, isLanguage } from "../app/i18n.ts";

test("all six UN official languages have complete UI translations", () => {
  assert.deepEqual(LANGUAGES.map(({ code }) => code), ["zh", "en", "fr", "es", "ru", "ar"]);
  const referenceKeys = Object.keys(TRANSLATIONS.zh).sort();
  for (const { code, dir } of LANGUAGES) {
    const translation = TRANSLATIONS[code];
    assert.deepEqual(Object.keys(translation).sort(), referenceKeys, `${code} must have every UI key`);
    assert.equal(translation.speeds.length, 3);
    assert.match(translation.boardLabel(4, 2048), /2048/);
    assert.equal(dir, code === "ar" ? "rtl" : "ltr");
    assert.equal(isLanguage(code), true);
  }
  assert.equal(isLanguage("de"), false);
});
