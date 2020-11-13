class Tape6HFlip extends HTMLElement {
  constructor() {
    super();
    this.value = null;
    this.inTransition = false;
    this.flipper = document.createElement('div');
    this.flipper.className = 'flipper';
    while(this.firstChild) {
      this.flipper.appendChild(this.firstChild);
    }
    this.addEventListener('transitionend', this);
    this.appendChild(this.flipper);
  }
  handleEvent(event) {
    switch (event.type) {
      case 'transitionend':
        if (event.target === this.flipper) {
          this.inTransition = false;
          if (this.value !== null) this.show(this.value);
        }
        break;
    }
  }
  show(html) {
    this.value = html;
    if (this.inTransition) return this;
    const childClass = this.flipper.style.transform !== 'rotateX(-180deg)' ? 'back' : 'front',
      child = this.querySelector('.' + childClass);
    if (!child) return this;
    child.innerHTML = this.value;
    this.value = null;
    this.flipper.style.transform = childClass == 'back' ? 'rotateX(-180deg)' : 'rotateX(0deg)';
    this.inTransition = true;
    return this;
  }
}
customElements.define('tape6-hflip', Tape6HFlip);
