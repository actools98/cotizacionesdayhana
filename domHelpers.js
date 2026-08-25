// domHelpers.js - Funciones para creación y manipulación del DOM

export function createModuleCard(module, currency, convertFn, formatFn) {
  const { id, description, price } = module;
  const priceConverted = convertFn(price, currency);
  const priceFormatted = formatFn(priceConverted, currency);

  const card = document.createElement('div');
  card.className = 'module-card';
  card.dataset.id = id;
  card.dataset.categoryId = module.category_id || '';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.dataset.id = id;
  checkbox.id = `mod-${id}`;
  checkbox.setAttribute('aria-label', `Seleccionar ${description}`);

  const label = document.createElement('label');
  label.className = 'module-label';
  label.htmlFor = `mod-${id}`;
  label.textContent = description;

  const priceSpan = document.createElement('span');
  priceSpan.className = 'module-price';
  priceSpan.textContent = priceFormatted;

  card.appendChild(checkbox);
  card.appendChild(label);
  card.appendChild(priceSpan);

  return card;
}

export function renderModulesByCategory(container, modules, categories, currency, convertFn, formatFn) {
  container.innerHTML = '';
  if (!categories || categories.length === 0) {
    const msg = document.createElement('p');
    msg.textContent = 'No hay categorías. Agrega una desde el modo Editar.';
    container.appendChild(msg);
    return;
  }
  const grouped = {};
  categories.forEach(cat => {
    grouped[cat.id] = {
      category: cat,
      modules: modules.filter(m => m.category_id === cat.id) || []
    };
  });
  for (const catId in grouped) {
    const { category, modules: mods } = grouped[catId];
    const section = document.createElement('div');
    section.className = 'category-section';
    section.dataset.categoryId = category.id;

    const header = document.createElement('div');
    header.className = 'category-header';
    const title = document.createElement('h3');
    title.textContent = category.name;
    header.appendChild(title);
    section.appendChild(header);

    const list = document.createElement('div');
    list.className = 'module-list';
    list.dataset.categoryId = category.id;

    if (mods.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-message';
      empty.textContent = 'No hay módulos en esta categoría.';
      list.appendChild(empty);
    } else {
      mods.forEach(mod => {
        const card = createModuleCard(mod, currency, convertFn, formatFn);
        list.appendChild(card);
      });
    }
    section.appendChild(list);
    container.appendChild(section);
  }
}

export function createAdminModuleCard(module, onDelete, onEdit) {
  const { id, description, price } = module;
  const card = document.createElement('div');
  card.className = 'module-card admin-mode';
  card.dataset.id = id;
  card.dataset.categoryId = module.category_id || '';

  const info = document.createElement('span');
  info.className = 'module-label';
  info.textContent = description;

  const priceSpan = document.createElement('span');
  priceSpan.className = 'module-price';
  priceSpan.textContent = `$ ${Number(price).toLocaleString('es-CO')}`;

  const actions = document.createElement('div');
  actions.className = 'admin-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-edit';
  editBtn.textContent = 'Editar';
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    onEdit(id);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-delete';
  deleteBtn.textContent = 'Eliminar';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    onDelete(id);
  });

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  card.appendChild(info);
  card.appendChild(priceSpan);
  card.appendChild(actions);

  return card;
}

export function renderAdminModulesByCategory(container, modules, categories, onDeleteModule, onEditModule, onEditCategory, onDeleteCategory) {
  container.innerHTML = '';
  if (!categories || categories.length === 0) {
    const msg = document.createElement('p');
    msg.textContent = 'No hay categorías. Agrega una.';
    container.appendChild(msg);
    return;
  }
  const grouped = {};
  categories.forEach(cat => {
    grouped[cat.id] = {
      category: cat,
      modules: modules.filter(m => m.category_id === cat.id) || []
    };
  });
  for (const catId in grouped) {
    const { category, modules: mods } = grouped[catId];
    const section = document.createElement('div');
    section.className = 'category-section';
    section.dataset.categoryId = category.id;

    const header = document.createElement('div');
    header.className = 'category-header';

    const title = document.createElement('h3');
    title.textContent = category.name;
    header.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'category-actions';

    const editCatBtn = document.createElement('button');
    editCatBtn.className = 'btn btn-edit-cat';
    editCatBtn.textContent = 'Editar';
    editCatBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onEditCategory(category.id);
    });

    const deleteCatBtn = document.createElement('button');
    deleteCatBtn.className = 'btn btn-delete-cat';
    deleteCatBtn.textContent = 'Eliminar';
    deleteCatBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onDeleteCategory(category.id);
    });

    actions.appendChild(editCatBtn);
    actions.appendChild(deleteCatBtn);
    header.appendChild(actions);
    section.appendChild(header);

    const list = document.createElement('div');
    list.className = 'module-list';
    list.dataset.categoryId = category.id;

    if (mods.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-message';
      empty.textContent = 'No hay módulos en esta categoría.';
      list.appendChild(empty);
    } else {
      mods.forEach(mod => {
        const card = createAdminModuleCard(mod, onDeleteModule, onEditModule);
        list.appendChild(card);
      });
    }
    section.appendChild(list);
    container.appendChild(section);
  }
}
