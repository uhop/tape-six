import {processPieRun, addShapes} from './donut.js';

class Tape6Donut extends HTMLElement {
  constructor() {
    super();
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', this.getAttribute('width'));
    this.svg.setAttribute('height', this.getAttribute('height'));
    this.appendChild(this.svg);
  }
  clear() {
    while(this.svg.lastChild) this.svg.removeChild(this.svg.lastChild);
    return this;
  }
  add(data, options) {
    processPieRun(data, options).map(addShapes(this.svg));
  }
}
customElements.define('tape6-donut', Tape6Donut);
