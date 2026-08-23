// Namespace e lista de tags SVG: `createElement("svg")` produz um
// HTMLUnknownElement que não renderiza, então as tags de desenho têm de passar
// por `createElementNS`. Só as que o projeto usa estão aqui.
const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_TAGS = new Set(["svg", "path", "g", "circle", "rect", "line"]);

/**
 * Anexa filhos a um elemento, ignorando os vazios.
 * `null` / `undefined` / `false` são pulados para que o chamador possa escrever
 * `cond && el(...)` direto na lista de filhos.
 * @param {Element} node - Elemento que recebe os filhos.
 * @param {Array<Node|string|number|null|undefined|false>|Node|string|number} children - Filho ou lista de filhos.
 */
function appendChildren(node, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    // `append` com string cria um nó de texto — não parseia HTML, então não
    // esbarra na CSP do YouTube como `innerHTML` esbarraria.
    node.append(child);
  }
}

/**
 * Cria um elemento com propriedades, atributos, estilo, dataset, listeners e
 * filhos numa única chamada. Existe para encurtar as dezenas de sequências
 * `createElement` + `classList.add` + `title` + `appendChild` da UI.
 *
 * Chaves reservadas em `props`:
 * - `dataset`: objeto copiado para `node.dataset`.
 * - `style`: objeto copiado para `node.style`.
 * - `attrs`: objeto aplicado com `setAttribute` (para atributos sem propriedade
 *   equivalente, como `viewBox` e `d` de SVG).
 * - `on`: objeto de listeners; o valor pode ser a função ou `[função, options]`.
 *
 * Qualquer outra chave é atribuída como propriedade (`node[key] = valor`), que é
 * o caminho certo para `value`, `checked`, `disabled` e afins. A exceção é
 * `className` em SVG, onde a propriedade é somente leitura e vira `setAttribute`.
 *
 * Valores `null` e `undefined` em `props` são ignorados, para permitir props
 * condicionais sem `if`. O próprio `props` também pode ser `null` — o resultado
 * natural de `cond ? { ... } : null` —, e aí só os filhos são aplicados.
 *
 * @param {string} tag - Nome da tag.
 * @param {object|Array|Node|string|number|null} [props={}] - Propriedades, ou os filhos direto quando não houver props.
 * @param {Array<Node|string|number|null|undefined|false>|Node|string|number} [children=[]] - Filhos a anexar.
 * @returns {Element} Elemento criado.
 */
export function el(tag, props = {}, children = []) {
  const isSvg = SVG_TAGS.has(tag);
  const node = isSvg
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag);

  // Chamada sem props: `el("li", [filho])`, `el("span", "texto")` ou
  // `el("span", 3)`. Número entra aqui porque `append` o converte em texto, o
  // mesmo que aconteceria se viesse dentro de um array.
  if (
    Array.isArray(props) ||
    typeof props === "string" ||
    typeof props === "number" ||
    props instanceof Node
  ) {
    appendChildren(node, props);
    return node;
  }

  // `props` nulo não tem nada a aplicar, mas o terceiro argumento continua
  // valendo — por isso segue para o `appendChildren` do fim em vez de sair aqui.
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined) continue;

    if (key === "dataset") {
      Object.assign(node.dataset, value);
    } else if (key === "style") {
      // `CSSStyleDeclaration` só expõe as propriedades em camelCase: uma chave
      // com hífen atribuída direto viraria um campo solto no objeto, sem
      // aplicar CSS nenhum e sem erro. Ela tem de passar por `setProperty`.
      for (const [name, styleValue] of Object.entries(value)) {
        if (name.includes("-")) {
          node.style.setProperty(name, styleValue);
        } else {
          node.style[name] = styleValue;
        }
      }
    } else if (key === "attrs") {
      for (const [name, attrValue] of Object.entries(value)) {
        node.setAttribute(name, attrValue);
      }
    } else if (key === "on") {
      for (const [type, listener] of Object.entries(value)) {
        const [fn, options] = Array.isArray(listener) ? listener : [listener];
        node.addEventListener(type, fn, options);
      }
    } else if (key === "children") {
      appendChildren(node, value);
    } else if (key === "className" && isSvg) {
      // Em SVG `className` é um `SVGAnimatedString` somente leitura.
      node.setAttribute("class", value);
    } else {
      node[key] = value;
    }
  }

  appendChildren(node, children);
  return node;
}
