class Tape6Spinner extends HTMLElement {
  constructor() {
    super();
    let child = null;
    for (let depth = this.getAttribute('depth') || 3; depth > 0; --depth) {
      const node1 = document.createElement('div');
      node1.className = 'square';
      const node2 = document.createElement('div');
      node2.className = 'square black';
      child && node2.appendChild(child);
      node1.appendChild(node2);
      child = node1;
    }
    const node = document.createElement('div');
    node.className = 'square black';
    child && node.appendChild(child);
    this.appendChild(node);
  }
}
customElements.define('tape6-spinner', Tape6Spinner);
