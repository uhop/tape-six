class Tape6Spinner extends HTMLElement {
  constructor() {
    super();
    this.nextState = '';
    this.inTransition = false;
    // create squares
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
    // watch for transitions
    this.addEventListener('transitionend', this);
  }
  handleEvent(event) {
    switch (event.type) {
      case 'transitionend':
        if (event.target === this) {
          this.inTransition = false;
          if (this.nextState) {
            if (this.classList.contains(this.nextState)) {
              this.nextState = '';
            } else {
              const nextState = this.nextState;
              this.nextState = '';
              this[nextState]();
              break;
            }
          }
          if (this.classList.contains('hide')) {
            this.classList.remove('hide');
            this.classList.add('stop');
          }
        }
        break;
    }
  }
  show() {
    if (this.classList.contains('show')) return this;
    if (this.inTransition) {
      this.nextState = 'show';
      return this;
    }
    this.style.display = 'block';
    this.classList.remove('stop');
    this.classList.remove('hide');
    this.classList.add('show');
    this.inTransition = true;
    return this;
  }
  hide() {
    if (!this.classList.contains('show')) return this;
    if (this.inTransition) {
      this.nextState = 'hide';
      return this;
    }
    this.classList.remove('stop');
    this.classList.remove('show');
    this.classList.add('hide');
    this.inTransition = true;
    return this;
  }
}
customElements.define('tape6-spinner', Tape6Spinner);
