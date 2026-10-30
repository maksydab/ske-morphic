
export class SkeForm extends HTMLElement {
  constructor() {
    super();
  }
  
  connectedCallback() {
    if (this.querySelector(":scope > form")) return;

    const submittext = this.getAttribute("submit-text");
    const dest = this.getAttribute("dest");

    const form = document.createElement("form");
    form.className = "ske-form";
    while (this.firstChild) {
      form.appendChild(this.firstChild);
    }
    const submitbtn = document.createElement("button");
    submitbtn.type = "submit";
    submitbtn.className = "btn sbmtbtn21";
    submitbtn.textContent = submittext || "Submit";
    form.appendChild(submitbtn);
    this.appendChild(form);
    form.querySelectorAll("input").forEach(input => {
      input.classList.add("inp");
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!dest) {
        console.error("please provide a dest url on <ske-form>.");
        return;
      }

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      submitbtn.disabled = true;

      try {
        const response = await fetch(dest, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        console.log("form submitted successfully!");
      } catch (error) {
        console.error("form submission failed:", error);
      } finally {
        submitbtn.disabled = false;
      }
    });
  }
}

customElements.define("ske-form", SkeForm);
