import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { Markdown } from "@/components/markdown";

function render(md: string): string {
  return renderToStaticMarkup(<Markdown content={md} />);
}

describe("Markdown renderer", () => {
  it("renders headings", () => {
    expect(render("## Hello")).toContain("<h2");
  });

  it("renders bold and inline code", () => {
    const html = render("This is **bold** and `code`.");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("md-inline-code");
    expect(html).toContain("code");
  });

  it("renders bulleted lists", () => {
    const html = render("- one\n- two");
    expect(html).toContain("<ul");
    expect((html.match(/<li/g) ?? []).length).toBe(2);
  });

  it("renders numbered lists", () => {
    const html = render("1. one\n2. two");
    expect(html).toContain("<ol");
  });

  it("renders fenced code blocks with a language label and copy control", () => {
    const html = render('```js\nconsole.log("hi");\n```');
    expect(html).toContain("js");
    expect(html).toContain("Copy");
    expect(html).toContain("console.log");
  });

  it("renders GFM tables", () => {
    const html = render("| a | b |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain("<table");
    expect(html).toContain("<th");
    expect(html).toContain("<td");
  });

  it("renders blockquotes", () => {
    expect(render("> quoted")).toContain("<blockquote");
  });

  it("renders GFM strikethrough", () => {
    expect(render("~~gone~~")).toContain("<del");
  });

  it("opens links in a new tab safely", () => {
    const html = render("[site](https://example.com)");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("noreferrer");
  });

  it("does not render raw HTML (no injection)", () => {
    const html = render("<script>alert(1)</script> and <b>x</b>");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>x</b>");
  });

  it("renders a realistic mixed answer without throwing", () => {
    const md = [
      "# Mac mini",
      "",
      "A **compact** desktop. Key points:",
      "",
      "- Runs `macOS`",
      "- Apple Silicon",
      "",
      "```bash\nsoftwareupdate -l\n```",
      "",
      "> Needs your own monitor.",
    ].join("\n");
    const html = render(md);
    expect(html).toContain("<h1");
    expect(html).toContain("<ul");
    expect(html).toContain("Copy");
    expect(html).toContain("<blockquote");
  });
});
