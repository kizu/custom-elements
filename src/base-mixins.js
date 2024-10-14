// @ts-check

/**
 * @template {new (...args: any[]) => HTMLElement} TBase
 * @param {TBase} Base
 */
export const AbortableMixin = (Base) => class Abortable extends Base {
  controller = new AbortController();
  disconnectedCallback() {
    this.controller.abort();
  }
  // Aborts everything, and restores the controller, allowing reusing it
  // after the cleanup phase.
  cleanup() {
    this.controller.abort();
    this.controller = new AbortController();
  }
}

/**
 * @template {new (...args: any[]) => HTMLElement} TBase
 * @param {TBase} Base
 * @param {{
 *   defaultName: string;
 *   condition?: () => boolean;
 * }} options
 */
export const RegisterableMixin = (Base, { defaultName, condition }) => class Registerable extends Base {
  static register({
    name = defaultName,
    registry = customElements
  } = {}) {
    if (condition && !condition()) {
      return;
    }
    registry.define(name, this);
  }
}
