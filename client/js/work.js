// client/js/work.js

async function initWork() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { location.href = 'index.html'; return; }

  try {
    const [work, allWorks, settings, categories] = await Promise.all([
      Works.get(id), Works.list(), Settings.get(), Categories.list(),
    ]);

    const artistName = settings.artist_name || 'Studio';
    const logo = document.getElementById('nav-logo');
    if (logo) logo.textContent = artistName;

    const images = work.images || [];

    setPageMeta({
      title: `${work.title} — ${artistName}`,
      description: work.description || [work.year, work.medium].filter(Boolean).join('. '),
      image: images[0]?.image_url || '',
    });
    const detail = document.getElementById('work-detail');

    // Build image display — gallery if multiple, single if one, placeholder if none
    let imageHtml;
    if (images.length === 0) {
      imageHtml = `
        <div class="work-detail-image">
          <div class="work-detail-placeholder" style="background:${work.colour}22">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" opacity="0.3">
              <rect x="10" y="10" width="60" height="60" rx="2" stroke="${work.colour}" stroke-width="2" fill="none"/>
              <circle cx="28" cy="28" r="7" stroke="${work.colour}" stroke-width="2" fill="none"/>
              <path d="M10 52l16-14 14 11 10-8 20 19" stroke="${work.colour}" stroke-width="2" fill="none"/>
            </svg>
          </div>
        </div>`;
    } else if (images.length === 1) {
      imageHtml = `
        <div class="work-detail-image">
          <img src="${cloudinaryUrl(images[0].image_url, { width: 1200 })}"
               alt="${work.title}" style="width:100%;display:block;cursor:zoom-in;"
               onclick="openLightbox(0)" />
          ${!work.available ? '<div class="sold-badge" style="font-size:0.75rem;padding:0.6rem 0;">Sold</div>' : ''}
        </div>`;
    } else {
      // Multi-image gallery: large primary + thumbnail strip
      imageHtml = `
        <div class="work-detail-image">
          <div class="work-gallery">
            <div class="work-gallery-main" id="gallery-main">
              <img id="gallery-main-img"
                   src="${cloudinaryUrl(images[0].image_url, { width: 1200 })}"
                   alt="${work.title}" style="width:100%;display:block;cursor:zoom-in;"
                   onclick="openLightbox(currentThumb)" />
            </div>
            <div class="work-gallery-thumbs" id="gallery-thumbs">
              ${images.map((img, i) => `
                <div class="gallery-thumb-item ${i === 0 ? 'active' : ''}" data-index="${i}"
                     onclick="setThumb(${i})">
                  <img src="${cloudinaryUrl(img.image_url, { width: 200 })}" alt="View ${i+1}" />
                </div>`).join('')}
            </div>
          </div>
        </div>`;
    }

    detail.innerHTML = `
      ${imageHtml}
      <div class="work-detail-info">
        ${(() => { const cat = categories.find(c => c.slug === work.category); return cat ? `<a href="collection.html?slug=${cat.slug}" class="work-collection-link">${cat.name} collection →</a>` : `<p class="work-detail-category">${work.category}</p>`; })()}
        <h1 class="work-detail-title">${work.title}</h1>
        <div class="work-specs">
          <div>
            <p class="work-spec-label">Year</p>
            <p class="work-spec-value">${work.year}</p>
          </div>
          <div>
            <p class="work-spec-label">Price</p>
            <p class="work-spec-value" style="color:${work.available ? 'var(--rust)' : 'var(--muted)'}">${work.price}</p>
          </div>
          <div>
            <p class="work-spec-label">Medium</p>
            <p class="work-spec-value">${work.medium || '—'}</p>
          </div>
          <div>
            <p class="work-spec-label">Dimensions</p>
            <p class="work-spec-value">${work.dimensions || '—'}</p>
          </div>
        </div>
        ${work.description ? `<p class="work-detail-desc">${work.description}</p>` : ''}
        ${work.shopify_embed ? `<div class="shopify-embed" id="shopify-embed"></div>` : ''}
        ${work.available
          ? `<a href="contact.html?work=${work.id}&title=${encodeURIComponent(work.title)}" class="work-enquire">Enquire about this work</a>`
          : `<span class="work-sold-notice">This work has sold</span>`}
      </div>`;

    // Related works
    const related = allWorks.filter(w => w.category === work.category && w.id !== id).slice(0, 3);
    if (related.length > 0) {
      const grid = document.getElementById('related-grid');
      related.forEach(w => {
        const coverImg = w.images?.[0];
        const el = document.createElement('div');
        el.className = 'gallery-item';
        el.style.cursor = 'pointer';
        el.innerHTML = coverImg
          ? `<img class="gallery-thumb" src="${cloudinaryUrl(coverImg.image_url, { width: 400 })}" alt="${w.title}" loading="lazy" />`
          : `<div class="gallery-thumb-placeholder" style="background:${w.colour}22"></div>`;
        el.innerHTML += `<div class="gallery-caption">
          <div class="gallery-caption-title">${w.title}</div>
          <div class="gallery-caption-meta">${w.year}</div>
        </div>`;
        el.addEventListener('click', () => { location.href = `work.html?id=${w.id}`; });
        grid.appendChild(el);
      });
    } else {
      document.getElementById('related-works').style.display = 'none';
    }

    // Shopify embed — innerHTML doesn't execute scripts, so inject them explicitly
    if (work.shopify_embed) {
      const wrap = document.getElementById('shopify-embed');
      if (wrap) injectEmbed(wrap, work.shopify_embed);
    }

    // Set up lightbox
    initLightbox(images);

  } catch (e) {
    document.getElementById('work-detail').innerHTML =
      '<p style="padding:2rem;color:var(--muted)">Work not found.</p>';
  }
}

// ── Shopify embed helper — re-executes <script> tags that innerHTML won't run ─

function injectEmbed(container, html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  Array.from(tmp.childNodes).forEach(node => {
    if (node.nodeName === 'SCRIPT') {
      const s = document.createElement('script');
      if (node.src) { s.src = node.src; s.async = true; }
      else s.textContent = node.textContent;
      container.appendChild(s);
    } else {
      container.appendChild(node.cloneNode(true));
    }
  });
}

// ── Thumbnail switching ───────────────────────────────────────────────────────

let currentThumb = 0;
let lightboxImages = [];

function setThumb(index) {
  currentThumb = index;
  const mainImg = document.getElementById('gallery-main-img');
  if (mainImg) mainImg.src = cloudinaryUrl(lightboxImages[index].image_url, { width: 1200 });
  document.querySelectorAll('.gallery-thumb-item').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });
}

// ── Lightbox ─────────────────────────────────────────────────────────────────

function initLightbox(images) {
  lightboxImages = images;

  const lb = document.createElement('div');
  lb.id = 'lightbox';
  lb.innerHTML = `
    <div id="lb-backdrop"></div>
    <div id="lb-content">
      <button id="lb-close" onclick="closeLightbox()">✕</button>
      <button id="lb-prev" onclick="lbNav(-1)">&#8249;</button>
      <img id="lb-img" src="" alt="" />
      <button id="lb-next" onclick="lbNav(1)">&#8250;</button>
      <p id="lb-counter"></p>
    </div>`;
  document.body.appendChild(lb);
  document.getElementById('lb-backdrop').addEventListener('click', closeLightbox);

  document.addEventListener('keydown', e => {
    const lb = document.getElementById('lightbox');
    if (!lb || lb.style.display === 'none' || !lb.style.display) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft')  lbNav(-1);
    if (e.key === 'ArrowRight') lbNav(1);
  });
}

function openLightbox(index) {
  currentThumb = index;
  const lb = document.getElementById('lightbox');
  if (!lb) return;
  lb.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  lbShow(index);
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (lb) lb.style.display = 'none';
  document.body.style.overflow = '';
}

function lbNav(dir) {
  currentThumb = (currentThumb + dir + lightboxImages.length) % lightboxImages.length;
  lbShow(currentThumb);
  setThumb(currentThumb);
}

function lbShow(index) {
  document.getElementById('lb-img').src = cloudinaryUrl(lightboxImages[index].image_url, { width: 1600 });
  document.getElementById('lb-counter').textContent =
    lightboxImages.length > 1 ? `${index + 1} / ${lightboxImages.length}` : '';
  document.getElementById('lb-prev').style.display = lightboxImages.length > 1 ? 'flex' : 'none';
  document.getElementById('lb-next').style.display = lightboxImages.length > 1 ? 'flex' : 'none';
}

initWork();
