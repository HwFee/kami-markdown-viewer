import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "kami.css"), "utf-8");

describe("kami.css scroll ownership contract", () => {
  it("establishes a definite viewport geometry for the shell body", () => {
    const bodyRule = css.match(/\.app-shell__body\s*\{[^}]*display:\s*flex[^}]*\}/s)?.[0] ?? "";
    expect(bodyRule).toMatch(/height:\s*100vh/);
    expect(bodyRule).toMatch(/min-height:\s*0/);
    expect(bodyRule).toMatch(/overflow:\s*hidden/);
  });

  it("gives the document scroll area its own scrolling context", () => {
    const scrollRule = css.match(/\.document-scroll\s*\{[^}]*position:\s*relative[^}]*\}/s)?.[0] ?? "";
    expect(scrollRule).toMatch(/min-height:\s*0/);
    expect(scrollRule).toMatch(/overflow-y:\s*scroll/);
  });
});

describe("kami.css code-block structure and resets", () => {
  it("declares scoped selectors for the wrapper, inner pre, and inner code", () => {
    expect(css).toMatch(/\.code-block\s*\{/s);
    expect(css).toMatch(/\.code-block\s+pre\s*\{/s);
    expect(css).toMatch(/\.code-block\s+pre\s+code\s*\{/s);
  });

  it("pushes the copy button to the top-right when no language label is present", () => {
    const rule = css.match(/\.code-block\s+\.code-block__copy\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(rule).toMatch(/margin-left:\s*auto/);
  });

  it("resets the copy button height and active transform against markdown-body button", () => {
    const rule = css.match(/\.code-block\s+\.code-block__copy\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(rule).toMatch(/min-height:\s*(0|28px)/);
    const activeRule = css.match(/\.code-block\s+\.code-block__copy:active\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(activeRule).toMatch(/transform:\s*none/);
  });
});

describe("kami.css code copy visibility", () => {
  it("hides the copy button by default and reveals it on hover or focus-within", () => {
    const rule = css.match(/\.code-block\s+\.code-block__copy\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(rule).toMatch(/opacity:\s*0/);
    const hoverRule = css.match(/\.code-block:hover\s+\.code-block__copy,\s*\.code-block:focus-within\s+\.code-block__copy\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(hoverRule).toMatch(/opacity:\s*1/);
  });

  it("keeps the copy button visible on touch/no-hover devices", () => {
    const rule = css.match(/@media\s*\(hover:\s*none\)\s*\{[^}]*\.code-block\s+\.code-block__copy\s*\{[^}]*opacity:\s*1/s)?.[0] ?? "";
    expect(rule).toBeTruthy();
  });
});

describe("kami.css code copy reduced motion", () => {
  it("disables code copy transitions under reduced motion", () => {
    const rule = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.code-block\s+\.code-block__copy[^}]*transition:\s*none/s)?.[0] ?? "";
    expect(rule).toBeTruthy();
  });
});

describe("kami.css outline frameless docked panel", () => {
  it("docks the outline flush without card chrome", () => {
    const rule = css.match(/\.outline-sidebar\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(rule).toMatch(/top:\s*46px/);
    expect(rule).toMatch(/left:\s*0/);
    expect(rule).toMatch(/bottom:\s*0/);
    expect(rule).toMatch(/background:\s*var\(--parchment\)/);
    expect(rule).toMatch(/border-right:\s*1px solid var\(--hairline\)/);
    expect(rule).not.toMatch(/border-radius/);
    expect(rule).not.toMatch(/box-shadow/);
  });

  it("declares a shared hairline color", () => {
    expect(css).toMatch(/--hairline:\s*#dddacc/);
  });

  it("defines the outline shift as width + gutter", () => {
    expect(css).toMatch(/--outline-shift:\s*calc\(var\(--outline-width\) \+ var\(--outline-gutter\)\)/);
  });

  it("draws a hairline guide on nested outline lists", () => {
    const rule = css.match(/\.outline-panel__list\s+\.outline-panel__list\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(rule).toMatch(/border-left:\s*1px solid var\(--hairline\)/);
  });

  it("marks the active link with an ink dot and no background fill", () => {
    const active = css.match(/\.outline-panel__link--active\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(active).toMatch(/color:\s*var\(--brand\)/);
    expect(active).not.toMatch(/background/);
    expect(active).not.toMatch(/border-left/);
    const dot = css.match(/\.outline-panel__link--active::before\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(dot).toMatch(/border-radius:\s*50%/);
    expect(dot).toMatch(/background:\s*var\(--brand\)/);
  });

  it("gives outline links a visible keyboard focus ring", () => {
    const rule = css.match(/\.outline-panel__link:focus-visible\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(rule).toMatch(/outline:\s*2px solid var\(--brand\)/);
  });

  it("shifts the document by the outline shift on medium/wide", () => {
    const rule = css.match(/@media\s*\(min-width:\s*720px\)\s*\{[^}]*\.app-shell__body--outline-open\s*\.document-scroll\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(rule).toMatch(/margin-left:\s*var\(--outline-shift\)/);
  });

  it("keeps the document unshifted on narrow", () => {
    const rule = css.match(/@media\s*\(max-width:\s*719px\)\s*\{[^}]*\.app-shell__body--outline-open\s*\.document-scroll\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(rule).toMatch(/margin-left:\s*0/);
  });
});

describe("kami.css outline reduced motion", () => {
  it("disables outline transitions under reduced motion", () => {
    const rule = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.outline-sidebar[^}]*transition:\s*none/s)?.[0] ?? "";
    expect(rule).toBeTruthy();
  });

  it("disables outline-scrim animation under reduced motion", () => {
    const rule = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.outline-scrim[^}]*animation:\s*none/s)?.[0] ?? "";
    expect(rule).toBeTruthy();
  });

  it("places the reduced-motion .document-scroll rule after the base rule so it wins", () => {
    const baseRuleIndex = css.search(/^\.document-scroll\s*\{/m);
    const reducedMotionRuleIndex = css.search(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.document-scroll[^}]*transition:\s*none/s);
    expect(reducedMotionRuleIndex).toBeGreaterThan(baseRuleIndex);
  });
});

describe("kami.css top bar", () => {
  it("shows the file path inline instead of hiding it", () => {
    const rule = css.match(/\.top-bar__path\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(rule).not.toMatch(/display:\s*none/);
    expect(rule).toMatch(/font-size:\s*11px/);
  });

  it("lays out the meta line as a single baseline-aligned row", () => {
    const rule = css.match(/\.top-bar__meta\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(rule).toMatch(/display:\s*flex/);
    expect(rule).toMatch(/align-items:\s*baseline/);
  });

  it("shares one ghost style between outline toggle and open button", () => {
    const rule = css.match(/\.outline-toggle,\s*\.open-button\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(rule).toMatch(/width:\s*26px/);
    expect(rule).toMatch(/height:\s*26px/);
    expect(rule).toMatch(/box-shadow:\s*inset 0 0 0 1px var\(--hairline\)/);
  });
});
