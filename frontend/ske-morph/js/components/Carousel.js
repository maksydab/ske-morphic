
class Carousel extends HTMLElement {
  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;

    const autos = Number(this.getAttribute("autoscroll")) || 3000;
    const children = [...this.children].filter(
      el => el.tagName !== "STYLE"
    );

    if (!children.length) return;

    this.curi = 0;
    this.realCount = children.length;
    this.isMoving = false;

    const style = document.createElement("style");
    style.textContent = `
      ske-carousel {
        display: block;
        width: 100%;
      }

      .carousel {
        position: relative;
        width: 100%;
        overflow: hidden;
      }

      .children {
        display: flex;
        width: 100%;
        transform: translateX(-100%);
        transition: transform 0.4s ease;
        will-change: transform;
      }

      .children.no-transition {
        transition: none;
      }

      .children > * {
        display: block;
        flex: 0 0 100%;
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
        object-fit: cover;
      }

      .ske-ca {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
        border:none;
        opacity:30%;
        width: 40px;
        height: 40px;
        padding: 0;
        opacity
        border: none;
        color: white;
        font-size: 22px;
        cursor: pointer;
        
      }
      .ske-ca span {
        display: inline-block;
        transform: translateY(-2px);
      }
      #ske-ca-left {
        left: 8px;
      }

      #ske-ca-right {
        right: 8px;
      }

    `;

    const carousel = document.createElement("div");
    carousel.className = "carousel";
    carousel.innerHTML = `
      <button class="btn ske-ca" id="ske-ca-left" type="button"><span>&lt;</span></button>
      <button class="btn ske-ca" id="ske-ca-right" type="button"><span>&gt;</span></button>
      <div class="children"></div>
    `;

    this.replaceChildren(style, carousel);

    const container = this.querySelector(".children");
    const left = this.querySelector("#ske-ca-left");
    const right = this.querySelector("#ske-ca-right");
    const firstClone = children[0].cloneNode(true);
    const lastClone = children[children.length - 1].cloneNode(true);

    container.append(lastClone, ...children, firstClone);

    this.curi = 1;
    container.style.transform = `translateX(-${this.curi * 100}%)`;

    const move = (step) => {
      if (this.isMoving || this.realCount < 2) return;

      this.isMoving = true;
      this.curi += step;

      container.classList.remove("no-transition");
      container.style.transform = `translateX(-${this.curi * 100}%)`;
    };

    container.addEventListener("transitionend", (event) => {
      if (event.target !== container || event.propertyName !== "transform") {
        return;
      }
      if (this.curi === 0) {
        container.classList.add("no-transition");
        this.curi = this.realCount;
        container.style.transform =
          `translateX(-${this.curi * 100}%)`;
      } else if (this.curi === this.realCount + 1) {
        container.classList.add("no-transition");
        this.curi = 1;
        container.style.transform =
          `translateX(-${this.curi * 100}%)`;
      }

      this.isMoving = false;
    });

    left.addEventListener("click", () => move(-1));
    right.addEventListener("click", () => move(1));

    if (this.hasAttribute("autoscroll") && this.realCount > 1) {
      this.timer = setInterval(() => move(1), Math.max(autos, 500));
    }
  }

  disconnectedCallback() {
    clearInterval(this.timer);
    this.initialized = false;
  }
}

customElements.define("ske-carousel", Carousel);
