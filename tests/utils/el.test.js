import { describe, it, expect, vi } from "vitest";
import { el } from "../../src/utils/el.js";

describe("el", () => {
  it("cria o elemento da tag pedida", () => {
    expect(el("div").tagName).toBe("DIV");
  });

  it("atribui propriedades diretas", () => {
    const input = el("input", {
      type: "checkbox",
      id: "x",
      checked: true,
      disabled: true,
      title: "t",
    });

    expect(input.type).toBe("checkbox");
    expect(input.id).toBe("x");
    expect(input.checked).toBe(true);
    expect(input.disabled).toBe(true);
    expect(input.title).toBe("t");
  });

  it("atribui value como propriedade, não como atributo", () => {
    const input = el("input", { type: "text", value: "nota" });
    expect(input.value).toBe("nota");
  });

  it("ignora props null e undefined", () => {
    const a = el("a", { href: null, title: undefined, id: "keep" });
    expect(a.hasAttribute("href")).toBe(false);
    expect(a.id).toBe("keep");
  });

  it("copia dataset", () => {
    const li = el("li", { dataset: { videoId: "abc", time: 12 } });
    expect(li.dataset.videoId).toBe("abc");
    expect(li.dataset.time).toBe("12");
  });

  it("copia style", () => {
    const div = el("div", { style: { display: "none", marginTop: "12px" } });
    expect(div.style.display).toBe("none");
    expect(div.style.marginTop).toBe("12px");
  });

  it("aplica style em kebab-case", () => {
    const div = el("div", { style: { "margin-top": "12px" } });
    expect(div.style.marginTop).toBe("12px");
  });

  it("aplica attrs com setAttribute", () => {
    const svg = el("svg", { attrs: { viewBox: "0 0 16 16" } });
    expect(svg.getAttribute("viewBox")).toBe("0 0 16 16");
  });

  it("registra listeners de on", () => {
    const spy = vi.fn();
    const btn = el("button", { on: { click: spy } });
    btn.dispatchEvent(new Event("click"));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("aceita [fn, options] em on", () => {
    const spy = vi.fn();
    const div = el("div", { on: { touchstart: [spy, { passive: true }] } });
    div.dispatchEvent(new Event("touchstart"));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("anexa filhos passados no terceiro argumento", () => {
    const ul = el("ul", { className: "list" }, [el("li"), el("li")]);
    expect(ul.className).toBe("list");
    expect(ul.children.length).toBe(2);
  });

  it("anexa filhos passados na prop children", () => {
    const ul = el("ul", { children: [el("li")] });
    expect(ul.children.length).toBe(1);
  });

  it("aceita array de filhos como segundo argumento", () => {
    const ul = el("ul", [el("li"), el("li")]);
    expect(ul.children.length).toBe(2);
  });

  it("aceita string como segundo argumento", () => {
    expect(el("span", "oi").textContent).toBe("oi");
  });

  it("aceita nó único como segundo argumento", () => {
    const div = el("div", el("span"));
    expect(div.children.length).toBe(1);
  });

  it("aceita número como segundo argumento", () => {
    expect(el("span", 3).textContent).toBe("3");
  });

  it("aceita props null e ainda anexa os filhos", () => {
    const div = el("div", null, [el("span"), "texto"]);
    expect(div.children.length).toBe(1);
    expect(div.textContent).toBe("texto");
  });

  it("string filha vira texto, não HTML", () => {
    const span = el("span", ["<b>x</b>"]);
    expect(span.children.length).toBe(0);
    expect(span.textContent).toBe("<b>x</b>");
  });

  it("pula filhos null, undefined e false", () => {
    const div = el("div", {}, [null, undefined, false, el("span")]);
    expect(div.children.length).toBe(1);
  });

  it("cria tags SVG no namespace certo", () => {
    const svg = el("svg");
    expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(el("path").namespaceURI).toBe("http://www.w3.org/2000/svg");
  });

  it("usa setAttribute para className em SVG", () => {
    const svg = el("svg", { className: "icon" });
    expect(svg.getAttribute("class")).toBe("icon");
  });
});
