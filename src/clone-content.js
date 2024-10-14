// @ts-check

import { AbortableMixin, RegisterableMixin } from './base-mixins.js';

export class CloneContent extends RegisterableMixin(
  AbortableMixin(HTMLElement),
  { defaultName: 'clone-content' }
) {
  static observedAttributes = /** @type {const} */ (['count', 'root', 'target']);

  stashed = /** @type {Array<HTMLElement>} */ ([]);
  originalRoot = /** @type {HTMLElement | null} */ (null)

  connectedCallback() {
    console.log('clone-content connected!')
  }

  attributeChangedCallback(/** @type {typeof CloneContent.observedAttributes[number]} */name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }

    const getContent = () => {
      let root = this.getAttribute('root') ?? ':scope';
      if (!(root.includes(':root') || root.includes(':scope'))) {
        root = `:scope ${root}`;
      }
      const target = this.getAttribute('target') ?? ' > *';
      // const target = this.getAttribute('target') ?? ' > *:nth-last-child(1 of :not([data-clone]))';
      return this.querySelectorAll(
        `${root}${target}`
      );
    };

    if (name === 'target') {
      // Clean up clones of the previous target?
    }
    if (name === 'count' || name === 'target') {
      const count = Math.max(0, Number(this.getAttribute('count')));
      const allItems = /** @type {NodeListOf<HTMLElement>} */ (getContent());
      let originals = [];
      let clones = [];
      for (const el of allItems) {
        if (el.dataset.clone) {
          clones.push(el);
        } else {
          originals.push(el)
        }
      }
      if (count < originals.length) {
        for (let i = originals.length - 1; i >= count; i--) {
          const el = originals[i];
          this.stashed.unshift(el);
          if (i === 0) {
            this.originalRoot = el.parentElement;
          }
          el.remove();
        }
      }
      const targetOriginalsLength = Math.min(count, originals.length + this.stashed.length);
      if (this.stashed && count > originals.length) {
        const currentLength = originals.length;
        for (let i = currentLength; i < targetOriginalsLength; i++) {
          const el = this.stashed.shift();
          if (!el) {
            continue;
          }
          if (originals.length) {
            originals[originals.length - 1].after(el)
          } else {
            this.originalRoot?.prepend(el);
          }
          originals.push(el);
        }
      }
      // Maybe TODO: instead of destroying clones, we could stash them
      // This could allow maintaining changes to them in the same way as for
      // the regular elements.
      if (count >= targetOriginalsLength && count < allItems.length) {
        const targetCount = allItems.length - count;
        for (let i = 0; i < targetCount; i++) {
          const el = clones.pop();
          el?.remove();
        }
      }
      const currentTotalLength = targetOriginalsLength + clones.length;
      if (count > currentTotalLength) {
        for (let i = currentTotalLength; i < count; i++) {
          const newIndex = i + 1;
          const el = clones[clones.length - 1] || originals[originals.length - 1];
          const clone = /** @type {HTMLElement} */ (el.cloneNode(true));
          // TODO: change the id if present;
          clone.dataset.clone = String(newIndex);
          clones.push(clone);
          el.after(clone);
        }
      }
      return;
    }
  }
}
