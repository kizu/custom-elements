// @ts-check

import { AbortableMixin, RegisterableMixin } from './base-mixins.js';

const inputMap = new Map();

const INPUT_UPDATE = 'input update';

const updateInputSource = (/** @type {HTMLInputElement} */ element) => {
  const inputUpdateEvent = new CustomEvent(INPUT_UPDATE, { detail: element });
  let value = /** @type {unknown} */(element.value);
  const type = element.getAttribute('type') || 'text';
  if (type === 'number' || type === 'range') {
    value = Number(value);
  }
  if (element.max) {
    value = Math.min(Number(element.max), Number(value))
  }
  if (element.min) {
    value = Math.max(Number(element.min), Number(value))
  }
  if (type === 'checkbox') {
    value = element.checked;
  }
  inputMap.set(element, value);
  document.dispatchEvent(inputUpdateEvent);
};

const matchesScope = ({ outputElement, inputElement, selector }) => {
  // Should we also consider a data-attribute for this, like data-input-scope?
  // And then if it is an input-scope element, compare the `name` attribute if present
  // If data-attribute, compare with its value.
  //
  const closestScope = outputElement.closest('input-scope');
  const matchesSelector = (inputElement.matches(selector) || inputElement.closest('input-source').matches(selector));
  return closestScope
    ? inputElement.closest('input-scope') === closestScope && matchesSelector
    // TODO: Should we check against the input+closest input-source, or could
    // we just get the closest element that matches the desired selector?
    : matchesSelector;
}

const subscribeToUpdates = ({ outputElement, selector = '*', handler, signal }) => {
  let value;
  const handleUpdate = (newValue) => {
    if (newValue !== value) {
      handler(newValue);
      value = newValue;
    }
  }

  // Init
  const allSources = [...inputMap.entries()];
  const inputSource = allSources.find(
      ([source]) => matchesScope({
        outputElement,
        inputElement: source,
        selector
      })
  );
  if (inputSource) {
    handleUpdate(inputSource[1]);
  }

  // Updates
  const updateCallback = (/** @type {Event|CustomEvent<HTMLElement>} */event) => {
    if (!('detail' in event)) {
      return;
    }
    if (!matchesScope({
      outputElement,
      inputElement: event.detail,
      selector,
    })) {
      return;
    }
    const value = inputMap.get(event.detail);
    handleUpdate(value);
  };
  document.addEventListener(
    INPUT_UPDATE,
    updateCallback,
    { signal },
  );
};

export class InputSource extends RegisterableMixin(
  AbortableMixin(HTMLElement),
  { defaultName: 'input-source' }
) {
  // TODO: add a `from` attribute that would select what to treat as the source.
  // TODO: add a `to` attribute that would allow selecting what to subscribe to.
  connectedCallback() {
    const input = this.querySelector('input');
    if (input) {
      updateInputSource(input);
      input.addEventListener('input', () => {
        updateInputSource(input);
      });
    }
  }
}

export class InputValue extends RegisterableMixin(
  AbortableMixin(HTMLElement),
  { defaultName: 'input-value' }
) {
  static observedAttributes = /** @type {const} */ (['from', 'to', 'as', 'root']);

  value = undefined;

  connectedCallback() {
    // Could this be a mixin as well?
    // Like, for every default attribute, if it is null, then call its callback with the default value.
    if (this.getAttribute('from') === null) {
      this.attributeChangedCallback('from', null, '*');
    }
  }

  attributeChangedCallback(/** @type {typeof InputValue.observedAttributes[number]} */name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }

    const applyValue = () => {
      const to = this.getAttribute('to') || 'output';
      const as = this.getAttribute('as') || 'textContent';
      const root = this.getAttribute('root') || '*';
      // TODO: make this bounded by scope?
      const rootElement = this.matches(root) ? this : this.closest(root);
      if (!rootElement) {
        return;
      }
      const outputs = /** @type {HTMLElement[]} */ (
        to === 'self'
          ? [this]
          : [...rootElement.querySelectorAll(to)]
      );
      if (outputs.length) {
        for (const output of outputs) {
          if (as === 'textContent') {
            output.textContent = this.value || null;
          } else if (as === '@value' && 'value' in output) {
            output.value = this.value;
          } else if (as[0] === '@') {
            output.setAttribute(as.substring(1), this.value ?? '');
          } else if (as.startsWith('--')) {
            output.style.setProperty(as, this.value || '');
          } else if (as.startsWith('.')) {
            const classNames = as.split('.').filter(v=>v).map(v=>v.trim());
            if (this.value) {
              output.classList.add(...classNames);
            } else {
              output.classList.remove(...classNames);
            }
          }
        }
      }
    }

    if (name === 'to' || name === 'as' || name === 'root') {
      applyValue();
      return;
    }
    // Need to do only for the attributes that the signal depends on.
    this.cleanup();

    // Do we want to have a local state, so when changing the output, we could just call the handler with the local state?
    const handler = (value) => {
      this.value = value;
      applyValue();
    };

    subscribeToUpdates({
      outputElement: this,
      selector: this.getAttribute('from') || '*',
      handler,
      signal: this.controller.signal,
    });
  }
}
