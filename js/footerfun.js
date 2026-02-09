document.addEventListener("DOMContentLoaded", () => {
  const footer = document.createElement("footer");
  footer.className = "site-footer";

  footer.innerHTML = `
    <div class="footer-inner">

      <div class="footer-brand">
        <h3>PokeKusovky</h3>
        <p>Kusové Pokémon karty.</p>
      </div>

      <div class="footer-links">
        <h4>Info</h4>
        <a href="terms.html">Obchodní podmínky</a>
        <a href="odstoupeni.html">Odstoupení od kupní smlouvy</a>
        <a href="doprava-a-platba.html">Doprava a platba</a>
        <a href="reklamace.html">Reklamace</a>
        <a href="gdpr.html">GDPR</a>
        <a href="cookies.html">Cookies</a>
      </div>

    </div>

    <div class="footer-bottom">
      © ${new Date().getFullYear()} PokeKusovky
    </div>
  `;

  document.body.appendChild(footer);
});
