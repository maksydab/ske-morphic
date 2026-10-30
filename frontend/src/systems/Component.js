
export class Component {
  constructor(...args) {
    this.element = null;
    this.init(...args);
  }
  init(...args) {}

  render() {
    return document.createElement("div");
  }

  mount(parent) {
    if (!this.element) {
      this.element = this.render();
    }

    if (parent && this.element.parentNode !== parent) {
      parent.appendChild(this.element);
    }

    return this;
  }

  $(selector) {
    return this.element?.querySelector(selector) ?? null;
  }

  $$(selector) {
    return this.element?.querySelectorAll(selector) ?? [];
  }

  destroy() {
    this.element?.remove();
    this.element = null;
  }
}
