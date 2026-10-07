import { describe, expect, it } from "vitest";
import { slugSuffix, slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("Acme Fleet Services")).toBe("acme-fleet-services");
  });

  it("collapses runs of punctuation into one hyphen", () => {
    expect(slugify("Acme & Sons -- Ltd.")).toBe("acme-sons-ltd");
  });

  it("trims leading and trailing separators", () => {
    expect(slugify("  --Hello World--  ")).toBe("hello-world");
  });

  it("strips diacritics instead of dropping the letter", () => {
    expect(slugify("Ñuñez Transport")).toBe("nunez-transport");
  });

  it("caps the length at 48 without leaving a trailing hyphen", () => {
    const slug = slugify(`${"a".repeat(47)} b`);
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("falls back to a default when nothing usable remains", () => {
    expect(slugify("!!!")).toBe("org");
    expect(slugify("")).toBe("org");
  });

  it("always satisfies the database slug format", () => {
    for (const name of ["Acme", "A  B", "x_y.z", "Ünï cödé", "123"]) {
      expect(slugify(name)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});

describe("slugSuffix", () => {
  it("returns a short alphanumeric suffix", () => {
    expect(slugSuffix()).toMatch(/^[a-z0-9]{1,4}$/);
  });
});
