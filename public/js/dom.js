// Tiny DOM builder. Everything is created with createElement/textContent,
// so API or AI text can never be interpreted as HTML.

/**
 * el('p', { className: 'x', 'aria-label': 'y' }, 'text', childNode)
 * `className`, `text` and `dataset` are handled specially; other keys become attributes.
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === undefined || child === null || child === false) continue;
    node.append(child);
  }
  return node;
}

export const byId = (id) => document.getElementById(id);
