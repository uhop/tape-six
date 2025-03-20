import {processPieRun, addShapes} from './donut.js';

class Tape6Donut extends HTMLElement {
  constructor() {
    super();
    this.options = null;
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', this.getAttribute('width'));
    this.svg.setAttribute('height', this.getAttribute('height'));
    this.appendChild(this.svg);
  }
  clear() {
    while (this.svg.lastChild) this.svg.removeChild(this.svg.lastChild);
    return this;
  }
  show(data, options, add) {
    if (add) {
      processPieRun(data, options).map(addShapes(this.svg));
    } else {
      this.clear();
      this.options = options || this.options;
      processPieRun(data, this.options).map(addShapes(this.svg));
    }
  }
}
customElements.define('tape6-donut', Tape6Donut);
