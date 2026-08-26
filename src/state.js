// state.js - Comunicación con la API

const API_URL = '/api';

// ---- Módulos ----
export async function getModules() {
  const res = await fetch(`${API_URL}/modules`);
  if (!res.ok) throw new Error('Error al obtener módulos');
  return res.json();
}

export async function addModule(description_es, description_fr, description_en, price, category_id = null, detail_es = null, detail_fr = null, detail_en = null) {
  const res = await fetch(`${API_URL}/modules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      description_es, description_fr, description_en,
      detail_es, detail_fr, detail_en,
      price: Number(price), category_id 
    })
  });
  if (!res.ok) throw new Error('Error al agregar módulo');
  return res.json();
}

export async function deleteModule(id) {
  const res = await fetch(`${API_URL}/modules/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error al eliminar módulo');
  return true;
}

export async function editModule(id, description_es, description_fr, description_en, price, category_id = null, detail_es = null, detail_fr = null, detail_en = null) {
  const res = await fetch(`${API_URL}/modules/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      description_es, description_fr, description_en,
      detail_es, detail_fr, detail_en,
      price: Number(price), category_id 
    })
  });
  if (!res.ok) throw new Error('Error al editar módulo');
  return res.json();
}

export async function reorderModules(items) {
  const res = await fetch(`${API_URL}/modules/reorder`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items })
  });
  if (!res.ok) throw new Error('Error al reordenar módulos');
  return res.json();
}

// ---- Categorías (sin cambios) ----
export async function getCategories() {
  const res = await fetch(`${API_URL}/categories`);
  if (!res.ok) throw new Error('Error al obtener categorías');
  return res.json();
}

export async function addCategory(name) {
  const res = await fetch(`${API_URL}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  if (!res.ok) throw new Error('Error al agregar categoría');
  return res.json();
}

export async function editCategory(id, name) {
  const res = await fetch(`${API_URL}/categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  if (!res.ok) throw new Error('Error al editar categoría');
  return res.json();
}

export async function deleteCategory(id) {
  const res = await fetch(`${API_URL}/categories/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error al eliminar categoría');
  return true;
}

export async function reorderCategories(items) {
  const res = await fetch(`${API_URL}/categories/reorder`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items })
  });
  if (!res.ok) throw new Error('Error al reordenar categorías');
  return res.json();
}

// ---- Portafolios (sin cambios) ----
export async function getPortfolios() {
  const res = await fetch(`${API_URL}/portfolios`);
  if (!res.ok) throw new Error('Error al obtener portafolios');
  return res.json();
}

export async function addPortfolio(name, link) {
  const res = await fetch(`${API_URL}/portfolios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, link })
  });
  if (!res.ok) throw new Error('Error al agregar portafolio');
  return res.json();
}

export async function editPortfolio(id, name, link) {
  const res = await fetch(`${API_URL}/portfolios/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, link })
  });
  if (!res.ok) throw new Error('Error al editar portafolio');
  return res.json();
}

export async function deletePortfolio(id) {
  const res = await fetch(`${API_URL}/portfolios/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error al eliminar portafolio');
  return true;
}
