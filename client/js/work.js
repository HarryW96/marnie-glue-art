// client/js/work.js

async function initWork() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { location.href = 'index.html'; return; }

  try {
    const [work, allWorks, settings] = await Promise.all([
      Works.get(id), Works.list(), Settings.get(),
    ]);

    const artistName = settings.artist_name || 'Studio';
    document.title = `${work.title} — ${artistName}`;
    const logo = document.getElementById('nav-logo');
    if (logo) logo.textContent = artistName;

    const images = work.images || [];
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
        <p class="work-detail-category">${work.category}</p>
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
        <a href="contact.html?work=${work.id}&title=${encodeURIComponent(work.title)}" class="work-enquire">Enquire about this work</a>
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

    // Set up lightbox
    initLightbox(images);

  } catch (e) {
    document.getElementById('work-detail').innerHTML =
      '<p style="padding:2rem;color:var(--muted)">Work not found.</p>';
  }
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
