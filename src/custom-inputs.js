// @ts-check

import { AbortableMixin, RegisterableMixin } from './base-mixins.js';

const inputMap = new Map();

const INPUT_UPDATE = 'input update';

const updateInputSource = (/** @type {HTMLInputElement} */ element) => {
  const inputUpdateEvent = new CustomEvent(INPUT_UPDATE, { detail: element });
  const value = element.max
    ? Math.min(Number(element.max), Number(element.value))
    : element.value;
  inputMap.set(element, value);
  document.dispatchEvent(inputUpdateEvent);
};

const matchesScope = ({ outputElement, inputElement, selector }) => {
  // Should we also consider a data-attribute for this, like data-input-scope?
  // And then if it is an input-scope element, compare the `name` attribute if present
  // If data-attribute, compare with its value.
  //
  const closestScope = outputElement.closest('input-scope');
  return closestScope
    ? inputElement.closest('input-scope') === closestScope && inputElement.matches(selector)
    : inputElement.matches(selector)
}

const getInputValue = ({ outputElement, selector = '*', handler, signal }) => {
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
  static observedAttributes = /** @type {const} */ (['from', 'to', 'as']);

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
      const outputs = /** @type {HTMLElement[]} */ (to === 'self' ? [this] : [...this.querySelectorAll(to)]);
      if (outputs.length) {
        for (const output of outputs) {
          if (as === 'textContent') {
            output.textContent = this.value || null;
          } else if (as === '@value' && 'value' in output) {
            output.value = this.value;
          } else if (as[0] === '@') {
            output.setAttribute(as.substring(1), this.value || '');
          } else if (as.startsWith('--')) {
            output.style.setProperty(as, this.value || '');
          }
        }
      }
    }

    if (name === 'to' || name === 'as') {
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

    getInputValue({
      outputElement: this,
      selector: newValue,
      handler,
      signal: this.controller.signal,
    });
  }
}
