document.addEventListener("DOMContentLoaded", () => {
  const footer = document.createElement("footer");
  footer.className = "site-footer";

  footer.innerHTML = `
    <div class="footer-inner">

      <div class="footer-brand">
        <h3>PokeKusovky</h3>
        <p>Kusové Pokémon karty. Čistě, rychle, bezpečně.</p>
      </div>

      <div class="footer-links">
        <h4>Menu</h4>
        <a href="collection.html">Karty</a>
        <a href="auctions.html">Aukce</a>
        <a href="contact.html">Kontakt</a>
      </div>

      <div class="footer-links">
        <h4>Info</h4>
        <a href="terms.html">Obchodní podmínky</a>
        <a href="reklamace.html">Reklamace</a>
        <a href="gdpr.html">GDPR</a>
        <a href="cookies.html">Cookies</a>
      </div>

    </div>

    <div class="footer-bottom">
      © ${new Date().getFullYear()} PokeKusovky — všechna práva vyhrazena
    </div>
  `;

  document.body.appendChild(footer);
});
