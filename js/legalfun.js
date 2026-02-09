document.addEventListener('DOMContentLoaded', () => {
  // year
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // Smooth scroll for TOC
  const tocLinks = Array.from(document.querySelectorAll('.legal-toc a[data-spy]'));

  tocLinks.forEach(a => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href') || '';
      if (!href.startsWith('#')) return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();
      const y = target.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: 'smooth' });

      history.replaceState(null, '', href);
    });
  });

  // Back to top
  const backBtn = document.getElementById('backToTop');

  function updateBackBtn(){
    if (!backBtn) return;
    backBtn.classList.toggle('show', window.scrollY > 600);
  }

  if (backBtn){
    backBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Scroll spy
  const sections = tocLinks
    .map(a => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  function setActive(id){
    tocLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === id));
  }

  if ('IntersectionObserver' in window && sections.length){
    const io = new IntersectionObserver((entries) => {
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (visible?.target?.id){
        setActive('#' + visible.target.id);
      }
    }, {
      root: null,
      rootMargin: '-12% 0px -72% 0px',
      threshold: [0.08, 0.15, 0.25, 0.4, 0.6]
    });

    sections.forEach(s => io.observe(s));
  } else {
    // fallback
    const onScroll = () => {
      let current = sections[0];
      for (const s of sections){
        if (s.getBoundingClientRect().top <= 140) current = s;
      }
      if (current?.id) setActive('#' + current.id);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  window.addEventListener('scroll', updateBackBtn, { passive: true });
  window.addEventListener('resize', updateBackBtn);
  updateBackBtn();

  /* =====================
     ADDED: OPTIONAL FORM ACTIONS (non-breaking)
     Works only if those elements exist on the page.
  ===================== */

  const btnPrint = document.getElementById('btnPrint');
  const btnToday = document.getElementById('btnToday');
  const btnClear = document.getElementById('btnClear');
  const withdrawDate = document.getElementById('withdrawDate');
  const withdrawForm = document.getElementById('withdrawForm');

  const pad = (n) => String(n).padStart(2,'0');
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  };

  if (btnPrint){
    btnPrint.addEventListener('click', () => window.print());
  }

  if (btnToday){
    btnToday.addEventListener('click', () => {
      if (withdrawDate) withdrawDate.value = todayISO();
    });
  }

  if (btnClear){
    btnClear.addEventListener('click', () => {
      if (withdrawForm) withdrawForm.reset();
      if (withdrawDate) withdrawDate.value = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
});
