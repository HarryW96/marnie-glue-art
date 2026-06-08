// client/js/gallery.js

let _allWorks = [];

async function initGallery() {
  try {
    const [works, categories] = await Promise.all([Works.list(), Categories.list()]);
    _allWorks = works;
    renderFilters(categories, works);
    const featured = works.filter(w => w.featured);
    renderGallery(featured.length > 0 ? featured : works);
  } catch (e) {
    document.getElementById('gallery').innerHTML =
      '<p class="gallery-empty">Could not load works. Make sure the server is running.</p>';
  }
}

function renderFilters(categories, works) {
  const bar = document.querySelector('.filter-bar');
  if (!bar) return;

  const counts = {};
  works.forEach(w => { counts[w.category] = (counts[w.category] || 0) + 1; });

  const featuredCount = works.filter(w => w.featured).length;

  // Map slug → category object for the description panel
  const catMap = {};
  categories.forEach(cat => { catMap[cat.slug] = cat; });

  bar.innerHTML = `<button class="filter-btn active" data-filter="all">Featured Works <span class="filter-count">${featuredCount || works.length}</span></button>`;
  categories.forEach(cat => {
    const n = counts[cat.slug] || 0;
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.filter = cat.slug;
    btn.innerHTML = `${cat.name} <span class="filter-count">${n}</span>`;
    bar.appendChild(btn);
  });

  bar.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      setCollectionPanel(filter === 'all' ? null : catMap[filter]);
      if (filter === 'all') {
        const featured = _allWorks.filter(w => w.featured);
        renderGallery(featured.length > 0 ? featured : _allWorks);
      } else {
        try {
          const filtered = await Works.list(filter);
          renderGallery(filtered);
        } catch {}
      }
    });
  });
}

function setCollectionPanel(cat) {
  const el = document.getElementById('collection-desc');
  if (!el) return;

  if (!cat) {
    el.classList.remove('visible');
    el.innerHTML = '';
    return;
  }

  el.innerHTML = '';

  if (cat.description) {
    const p = document.createElement('p');
    p.className = 'collection-desc-text';
    p.textContent = cat.description;
    el.appendChild(p);
  }

  const a = document.createElement('a');
  a.href = `collection.html?slug=${cat.slug}`;
  a.className = 'collection-view-link';
  a.textContent = 'View full collection →';
  el.appendChild(a);

  el.classList.add('visible');
}

function renderGallery(works) {
  const gallery = document.getElementById('gallery');
  gallery.innerHTML = '';

  if (works.length === 0) {
    gallery.innerHTML = '<p class="gallery-empty">No works in this category yet.</p>';
    return;
  }

  works.forEach((work, i) => {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.dataset.category = work.category;
    item.style.animationDelay = `${i * 0.06}s`;

    const coverImg = work.images?.[0];
    const soldBadge = !work.available ? '<div class="sold-badge">Sold</div>' : '';
    const imgHtml = coverImg
      ? `<div class="gallery-thumb-wrap"><img class="gallery-thumb" src="${cloudinaryUrl(coverImg.image_url, { width: 600 })}" alt="${work.title}" loading="lazy" />${soldBadge}</div>`
      : `<div class="gallery-thumb-wrap"><div class="gallery-thumb-placeholder" style="background:${work.colour}22">
           <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" opacity="0.35">
             <rect x="8" y="8" width="44" height="44" rx="2" stroke="${work.colour}" stroke-width="1.5" fill="none"/>
             <circle cx="22" cy="22" r="5" stroke="${work.colour}" stroke-width="1.5" fill="none"/>
             <path d="M8 38l12-10 10 8 8-6 14 14" stroke="${work.colour}" stroke-width="1.5" fill="none"/>
           </svg>
         </div>${soldBadge}</div>`;

    item.innerHTML = `
      ${imgHtml}
      <div class="gallery-caption">
        <div class="gallery-caption-title">${work.title}</div>
        <div class="gallery-caption-meta">${work.year} &nbsp;·&nbsp; ${work.category_name || work.category}</div>
      </div>`;

    item.addEventListener('click', () => { location.href = `work.html?id=${work.id}`; });
    gallery.appendChild(item);
  });
}

async function applySettings() {
  try {
    const s = await Settings.get();
    if (s.artist_name) {
      const logo = document.getElementById('nav-logo');
      if (logo) logo.textContent = s.artist_name;
    }
    if (s.tagline) {
      const sub = document.getElementById('hero-sub');
      if (sub) sub.textContent = s.tagline;
    }
    if (s.hero_title) {
      const h = document.getElementById('hero-title');
      if (h) h.textContent = s.hero_title;
    }
    setPageMeta({
      title: `${s.artist_name || 'Studio'} — Portfolio`,
      description: s.tagline || s.bio || '',
      image: s.portrait_url || '',
    });
  } catch {}
}

applySettings();
initGallery();
