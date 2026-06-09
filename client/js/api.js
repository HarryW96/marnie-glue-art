// client/js/api.js
// Centralised API client for the Studio portfolio frontend

const API_BASE = (() => {
  // In development (live-server / file:// / localhost:5500), point at local Express
  // In production, the frontend is served from the same origin as the API
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    return 'http://localhost:3000/api';
  }
  return '/api';
})();

// ── Auth token ───────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('studio_admin_token');
}

function setToken(token) {
  localStorage.setItem('studio_admin_token', token);
}

function clearToken() {
  localStorage.removeItem('studio_admin_token');
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Generic fetch wrapper ────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (res.status === 401) {
    clearToken();
    if (location.pathname.includes('/admin/') && !location.pathname.includes('login')) {
      location.href = '/admin/login.html';
    }
    throw new Error('Unauthorised');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Categories ────────────────────────────────────────────────────────────────

const Categories = {
  list:    ()               => apiFetch('/categories'),
  create:  (name, description = '') => apiFetch('/categories', { method: 'POST', body: JSON.stringify({ name, description }) }),
  update:  (id, data)       => apiFetch(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  rename:  (id, name)       => apiFetch(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  reorder: (id, sort_order) => apiFetch(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify({ sort_order }) }),
  delete:  (id)             => apiFetch(`/categories/${id}`, { method: 'DELETE' }),
};

// ── Works ────────────────────────────────────────────────────────────────────

const Works = {
  list:   (category) => apiFetch(`/works${category && category !== 'all' ? `?category=${category}` : ''}`),
  get:    (id)       => apiFetch(`/works/${id}`),
  delete: (id)       => apiFetch(`/works/${id}`, { method: 'DELETE' }),
  update: (id, data) => apiFetch(`/works/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  reorder:(order)    => apiFetch(`/works/batch/reorder`, { method: 'PATCH', body: JSON.stringify({ order }) }),

  // Add images to existing work
  addImages(id, formData) {
    return fetch(`${API_BASE}/works/${id}/images`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    }).then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    });
  },

  // Delete a single image from a work
  deleteImage: (workId, imageId) => apiFetch(`/works/${workId}/images/${imageId}`, { method: 'DELETE' }),

  // Reorder images
  reorderImages: (workId, order) => apiFetch(`/works/${workId}/images/reorder`, {
    method: 'PATCH', body: JSON.stringify({ order })
  }),

  // Create work with images (multipart)
  create(formData) {
    return fetch(`${API_BASE}/works`, {
      method: 'POST',
      headers: authHeaders(), // no Content-Type — browser sets multipart boundary
      body: formData,
    }).then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    });
  },
};

// ── Settings ─────────────────────────────────────────────────────────────────

const Settings = {
  get:    ()     => apiFetch('/settings'),
  update: (data) => apiFetch('/settings', { method: 'PATCH', body: JSON.stringify(data) }),

  uploadPortrait(file) {
    const fd = new FormData();
    fd.append('portrait', file);
    return fetch(`${API_BASE}/settings/portrait`, {
      method: 'POST',
      headers: authHeaders(),
      body: fd,
    }).then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    });
  },
};

// ── Collection photos ─────────────────────────────────────────────────────────

const CollectionPhotos = {
  list: (catId) => apiFetch(`/categories/${catId}/photos`),

  upload(catId, formData) {
    return fetch(`${API_BASE}/categories/${catId}/photos`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    }).then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    });
  },

  delete: (catId, photoId) => apiFetch(`/categories/${catId}/photos/${photoId}`, { method: 'DELETE' }),

  reorder: (catId, order) => apiFetch(`/categories/${catId}/photos/reorder`, {
    method: 'PATCH', body: JSON.stringify({ order }),
  }),
};

// ── Enquiries ─────────────────────────────────────────────────────────────────

const Enquiries = {
  submit: (data) => apiFetch('/enquiries', { method: 'POST', body: JSON.stringify(data) }),
  list:   ()     => apiFetch('/enquiries'),
  markRead: (id) => apiFetch(`/enquiries/${id}/read`, { method: 'PATCH' }),
  delete: (id)   => apiFetch(`/enquiries/${id}`, { method: 'DELETE' }),
};

// ── Shop ─────────────────────────────────────────────────────────────────────

const Shop = {
  list: () => apiFetch('/shop'),
  get:  (id) => apiFetch(`/shop/${id}`),

  create(formData) {
    return fetch(`${API_BASE}/shop`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    }).then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    });
  },

  update: (id, data) => apiFetch(`/shop/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id)       => apiFetch(`/shop/${id}`, { method: 'DELETE' }),

  addImages(id, formData) {
    return fetch(`${API_BASE}/shop/${id}/images`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    }).then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    });
  },

  deleteImage:   (id, imageId) => apiFetch(`/shop/${id}/images/${imageId}`, { method: 'DELETE' }),
  reorderImages: (id, order)   => apiFetch(`/shop/${id}/images/reorder`, { method: 'PATCH', body: JSON.stringify({ order }) }),
  reorder:       (order)       => apiFetch('/shop/batch/reorder', { method: 'PATCH', body: JSON.stringify({ order }) }),
};

// ── Auth ─────────────────────────────────────────────────────────────────────

const Auth = {
  async login(password) {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    setToken(data.token);
    return data;
  },
  async check() {
    try {
      await apiFetch('/auth/check');
      return true;
    } catch {
      return false;
    }
  },
  logout() {
    clearToken();
    location.href = '/admin/login.html';
  },
};

// ── SEO / meta tags ───────────────────────────────────────────────────────────

function setPageMeta({ title, description, image } = {}) {
  const upsert = (selector, content) => {
    if (!content) return;
    let el = document.querySelector(selector);
    if (!el) {
      el = document.createElement('meta');
      const m = selector.match(/\[([^=\]]+)="([^"]+)"\]/);
      if (m) el.setAttribute(m[1], m[2]);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  if (title) document.title = title;
  upsert('meta[name="description"]',         description);
  upsert('meta[property="og:title"]',        title);
  upsert('meta[property="og:description"]',  description);
  upsert('meta[property="og:image"]',        image);
  upsert('meta[property="og:url"]',          location.href);
  upsert('meta[name="twitter:title"]',       title);
  upsert('meta[name="twitter:description"]', description);
  upsert('meta[name="twitter:image"]',       image);
}

// ── Utilities ────────────────────────────────────────────────────────────────

function categoryLabel(cat) {
  return { sculpture: 'Sculpture', 'mixed-media': 'Mixed Media', installation: 'Installation' }[cat] || cat;
}

// Cloudinary responsive image URL helper
function cloudinaryUrl(url, { width = 800, quality = 'auto' } = {}) {
  if (!url || !url.includes('cloudinary.com')) return url;
  // Insert transformation before /upload/
  return url.replace('/upload/', `/upload/w_${width},q_${quality},f_auto/`);
}
