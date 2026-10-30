
import { Component } from "./Component.js";

class Counter extends Component {
  init(start = 0, label = "Count") {
    this.count = start;
    this.label = label;
  }

  render() {
    const root = document.createElement("div");

    root.innerHTML = `
      <span class="label"></span>
      <span class="count"></span>
      <button class="increment">+</button>
    `;

    root.querySelector(".label").textContent = this.label;
    root.querySelector(".count").textContent = this.count;

    root.querySelector(".increment").addEventListener("click", () => {
      this.increment();
    });

    return root;
  }

  increment() {
    this.count++;
    this.$(".count").textContent = this.count;
  }

  reset() {
    this.count = 0;
    this.$(".count").textContent = this.count;
  }
}

const counter = new Counter(5, "Clicks");
counter.mount(document.body);

counter.increment();
counter.reset();
