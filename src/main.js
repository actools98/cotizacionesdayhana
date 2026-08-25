// ============================================================
//  main.js - Con autenticación por contraseña (1998)
//  y persistencia de datos en Coolify (SQLite + volumen)
// ============================================================

// ---- Imports ----
import { getModules, addModule, deleteModule, editModule, reorderModules, getCategories, addCategory, editCategory, deleteCategory, reorderCategories, getPortfolios, addPortfolio, editPortfolio, deletePortfolio } from './state.js';
import { calculateTotal, getSelectedModules } from './components/quoteCalculator.js';
import { fetchExchangeRates, convertCurrency, startAutoRefresh, saveManualRates, getCurrentRates } from './components/currencyConverter.js';
import { generateQuotePDF } from './components/exportPDF.js';
import { renderModulesByCategory, renderAdminModulesByCategory } from './utils/domHelpers.js';
import { formatCurrency } from './utils/formatters.js';
import Sortable from 'sortablejs';

// ============================================================
//  AUTENTICACIÓN (LOGIN)
// ============================================================
const PASSWORD = '1998';
const loginOverlay = document.getElementById('login-overlay');
const appWrapper = document.getElementById('app-wrapper');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

// Verificar si ya está autenticado
const auth = localStorage.getItem('auth');
if (auth === 'true') {
  loginOverlay.style.display = 'none';
  appWrapper.style.display = 'block';
} else {
  loginOverlay.style.display = 'flex';
  appWrapper.style.display = 'none';
}

loginBtn.addEventListener('click', () => {
  const pass = passwordInput.value;
  if (pass === PASSWORD) {
    localStorage.setItem('auth', 'true');
    loginOverlay.style.display = 'none';
    appWrapper.style.display = 'block';
    if (!window.appInitialized) {
      window.appInitialized = true;
      initApp();
    }
  } else {
    loginError.style.display = 'block';
    passwordInput.value = '';
    passwordInput.focus();
  }
});

passwordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('auth');
  location.reload();
});

// ============================================================
//  ESTADO GLOBAL Y DOM
// ============================================================
const modulesContainer = document.getElementById('modules-container');
const totalDisplay = document.getElementById('total-display');
const currencySelect = document.getElementById('currency-select');
const toggleModeBtn = document.getElementById('toggle-mode-btn');
const addModuleContainer = document.getElementById('add-module-container');
const addModuleForm = document.getElementById('add-module-form');
const moduleDescInput = document.getElementById('module-desc');
const modulePriceInput = document.getElementById('module-price');
const moduleCategorySelect = document.getElementById('module-category-select');
const quoteActionBtn = document.getElementById('quote-action-btn');
const clientDialog = document.getElementById('client-dialog');
const clientNameInput = document.getElementById('client-name-input');
const productNameInput = document.getElementById('product-name-input');
const dialogConfirm = document.getElementById('dialog-confirm');
const dialogCancel = document.getElementById('dialog-cancel');
const portfoliosCard = document.getElementById('portfolios-card');

const portfoliosOpenBtn = document.getElementById('portfolios-open-btn');
const portfoliosDialog = document.getElementById('portfolios-dialog');
const portfoliosListModal = document.getElementById('portfolios-list-modal');
const portfoliosDialogClose = document.getElementById('portfolios-dialog-close');

const ratesToggleBtn = document.getElementById('rates-toggle-btn');
const ratesDialog = document.getElementById('rates-dialog');
const rateUsdInput = document.getElementById('rate-usd');
const rateEurInput = document.getElementById('rate-eur');
const ratesDialogSave = document.getElementById('rates-dialog-save');
const ratesDialogCancel = document.getElementById('rates-dialog-cancel');
const ratesDialogReset = document.getElementById('rates-dialog-reset');
const ratesDialogClose = document.getElementById('rates-dialog-close');

// ---- Estado ----
let currentModules = [];
let currentCategories = [];
let currentPortfolios = [];
let currentCurrency = 'COP';
let currentCheckedIds = new Set();
let isEditMode = false;
let sortableInstances = [];
let openPortfolioId = null;

// ============================================================
//  INICIALIZACIÓN DE LA APP (solo se ejecuta tras login)
// ============================================================
async function initApp() {
  try {
    await loadData();
    startAutoRefresh();
    currencySelect.value = currentCurrency;
    setEditMode(false);
    bindEvents();
    renderPortfoliosModal();
    updatePortfoliosVisibility();
  } catch (error) {
    console.error('Error en inicialización:', error);
    alert('No se pudo cargar la aplicación.');
  }
}

async function loadData() {
  currentCategories = await getCategories();
  currentModules = await getModules();
  currentPortfolios = await getPortfolios();
  if (currentCategories.length > 0) {
    const firstCatId = currentCategories[0].id;
    for (const mod of currentModules) {
      if (!mod.category_id) mod.category_id = firstCatId;
    }
  }
  populateCategorySelect();
}

function populateCategorySelect() {
  moduleCategorySelect.innerHTML = '';
  currentCategories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    moduleCategorySelect.appendChild(opt);
  });
}

function bindEvents() {
  modulesContainer.addEventListener('change', onModuleCheckChange);
  currencySelect.addEventListener('change', onCurrencyChange);
  toggleModeBtn.addEventListener('click', onToggleMode);
  addModuleForm.addEventListener('submit', onAddModule);
  quoteActionBtn.addEventListener('click', onQuoteAction);
  dialogConfirm.addEventListener('click', onDialogConfirm);
  dialogCancel.addEventListener('click', () => clientDialog.close());

  portfoliosOpenBtn.addEventListener('click', openPortfoliosDialog);
  portfoliosDialogClose.addEventListener('click', closePortfoliosDialog);

  ratesToggleBtn.addEventListener('click', openRatesDialog);
  ratesDialogClose.addEventListener('click', closeRatesDialog);
  ratesDialogCancel.addEventListener('click', closeRatesDialog);
  ratesDialogSave.addEventListener('click', onSaveRates);
  ratesDialogReset.addEventListener('click', onResetRates);

  // Cerrar panel de portafolios al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (openPortfolioId) {
      const item = document.querySelector(`.portfolio-item-modal[data-id="${openPortfolioId}"]`);
      if (item && !item.contains(e.target)) {
        closePortfolioActions();
      }
    }
  });
}

// ============================================================
//  RENDER Y MODO EDICIÓN
// ============================================================
function renderAll() {
  if (isEditMode) {
    renderAdminModulesByCategory(modulesContainer, currentModules, currentCategories, handleDeleteModule, handleEditModule, handleEditCategory, handleDeleteCategory);
    addModuleContainer.style.display = 'block';
    document.getElementById('total-card').style.display = 'none';
    renderCategoryControls();
  } else {
    renderModulesByCategory(modulesContainer, currentModules, currentCategories, currentCurrency, convertCurrency, formatCurrency);
    addModuleContainer.style.display = 'none';
    document.getElementById('total-card').style.display = 'flex';
    const catControls = document.getElementById('category-controls');
    if (catControls) catControls.remove();
  }
  updateTotal();
  if (isEditMode) {
    initSortable();
  } else {
    destroySortable();
  }
  renderPortfoliosModal();
  updatePortfoliosVisibility();
}

function updatePortfoliosVisibility() {
  if (portfoliosCard) {
    portfoliosCard.style.display = isEditMode ? 'none' : 'flex';
  }
}

function renderCategoryControls() {
  const existing = document.getElementById('category-controls');
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.id = 'category-controls';
  container.style.marginBottom = 'var(--space-md)';
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'new-category-input';
  input.placeholder = 'Nueva categoría';
  const btn = document.createElement('button');
  btn.className = 'btn btn-secondary';
  btn.textContent = 'Agregar categoría';
  btn.addEventListener('click', onAddCategory);
  container.appendChild(input);
  container.appendChild(btn);
  addModuleContainer.parentNode.insertBefore(container, addModuleContainer);
}

function updateTotal() {
  if (!isEditMode) {
    const checkboxes = modulesContainer.querySelectorAll('input[type="checkbox"]:checked');
    const checkedIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    currentCheckedIds = new Set(checkedIds);
  }
  const totalCOP = calculateTotal(Array.from(currentCheckedIds), currentModules);
  const totalConverted = convertCurrency(totalCOP, currentCurrency);
  totalDisplay.textContent = formatCurrency(totalConverted, currentCurrency);
}

function setEditMode(enabled) {
  isEditMode = enabled;
  toggleModeBtn.textContent = isEditMode ? 'Cotizar' : 'Editar';
  toggleModeBtn.classList.toggle('active', isEditMode);
  renderAll();
}

function onToggleMode() { setEditMode(!isEditMode); }

// ============================================================
//  SORTABLE (DRAG & DROP)
// ============================================================
function initSortable() {
  destroySortable();
  const lists = document.querySelectorAll('.module-list');
  lists.forEach(list => {
    const sortable = new Sortable(list, {
      group: 'modules',
      animation: 150,
      handle: '.module-card',
      draggable: '.module-card',
      ghostClass: 'sortable-ghost',
      onEnd: async (evt) => {
        const fromCategory = evt.from.dataset.categoryId;
        const toCategory = evt.to.dataset.categoryId;
        const newOrder = Array.from(evt.to.children).map(el => el.dataset.id);
        const items = newOrder.map((id, index) => ({
          id,
          category_id: toCategory,
          sort_order: index
        }));
        try {
          await reorderModules(items);
          currentModules = await getModules();
          renderAll();
        } catch (error) {
          console.error('Error al reordenar:', error);
          alert('Error al guardar el nuevo orden. Recargando...');
          loadData().then(renderAll);
        }
      }
    });
    sortableInstances.push(sortable);
  });
}

function destroySortable() {
  sortableInstances.forEach(s => s.destroy());
  sortableInstances = [];
}

// ============================================================
//  CRUD: MÓDULOS
// ============================================================
async function onAddModule(e) {
  e.preventDefault();
  const desc = moduleDescInput.value.trim();
  const price = parseFloat(modulePriceInput.value);
  if (!desc || isNaN(price) || price <= 0) {
    alert('Ingrese descripción y precio válido.');
    return;
  }
  const categoryId = moduleCategorySelect.value || currentCategories[0]?.id || null;
  try {
    await addModule(desc, price, categoryId);
    await loadData();
    renderAll();
    moduleDescInput.value = '';
    modulePriceInput.value = '';
  } catch (error) {
    console.error('Error al agregar módulo:', error);
    alert('Error al agregar el módulo.');
  }
}

async function handleDeleteModule(id) {
  if (!confirm('¿Eliminar este módulo?')) return;
  try {
    await deleteModule(id);
    await loadData();
    renderAll();
  } catch (error) {
    console.error('Error al eliminar:', error);
    alert('Error al eliminar el módulo.');
  }
}

async function handleEditModule(id) {
  const module = currentModules.find(m => m.id === id);
  if (!module) return;
  const newDesc = prompt('Nueva descripción:', module.description);
  if (newDesc === null) return;
  const newPriceStr = prompt('Nuevo precio (COP):', module.price);
  if (newPriceStr === null) return;
  const newPrice = parseFloat(newPriceStr);
  if (isNaN(newPrice) || newPrice <= 0) {
    alert('Precio inválido.');
    return;
  }
  const catOptions = currentCategories.map(c => `${c.id}:${c.name}`).join(', ');
  const newCatId = prompt(`Nueva categoría (ID):\n${catOptions}`, module.category_id);
  const category_id = (newCatId && currentCategories.some(c => c.id === newCatId)) ? newCatId : module.category_id;
  try {
    await editModule(id, newDesc, newPrice, category_id);
    await loadData();
    renderAll();
  } catch (error) {
    console.error('Error al editar:', error);
    alert('Error al editar el módulo.');
  }
}

// ============================================================
//  CRUD: CATEGORÍAS
// ============================================================
async function onAddCategory() {
  const input = document.getElementById('new-category-input');
  const name = input.value.trim();
  if (!name) return alert('Ingrese un nombre.');
  try {
    await addCategory(name);
    input.value = '';
    await loadData();
    renderAll();
  } catch (error) {
    console.error('Error al agregar categoría:', error);
    alert('Error al agregar categoría.');
  }
}

async function handleEditCategory(id) {
  const cat = currentCategories.find(c => c.id === id);
  if (!cat) return;
  const newName = prompt('Nuevo nombre de categoría:', cat.name);
  if (newName === null || newName.trim() === '') return;
  try {
    await editCategory(id, newName.trim());
    await loadData();
    renderAll();
  } catch (error) {
    console.error('Error al editar categoría:', error);
    alert('Error al editar categoría.');
  }
}

async function handleDeleteCategory(id) {
  const modulesInCat = currentModules.filter(m => m.category_id === id);
  let confirmMsg = '¿Eliminar esta categoría?';
  if (modulesInCat.length > 0) {
    confirmMsg = `La categoría tiene ${modulesInCat.length} módulo(s). ¿Eliminar de todos modos? Se moverán a la categoría por defecto.`;
  }
  if (!confirm(confirmMsg)) return;
  try {
    await deleteCategory(id);
    await loadData();
    renderAll();
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    alert('Error al eliminar categoría.');
  }
}

// ============================================================
//  PORTAFOLIOS: MODAL + ACRORDEÓN
// ============================================================
function openPortfoliosDialog() {
  renderPortfoliosModal();
  portfoliosDialog.showModal();
}

function closePortfoliosDialog() {
  portfoliosDialog.close();
  closePortfolioActions();
}

function renderPortfoliosModal() {
  portfoliosListModal.innerHTML = '';
  if (currentPortfolios.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-message';
    empty.textContent = 'No hay portafolios. Añade uno.';
    portfoliosListModal.appendChild(empty);
    appendAddPortfolioButton();
    return;
  }

  currentPortfolios.forEach(pf => {
    const item = document.createElement('div');
    item.className = 'portfolio-item-modal';
    item.dataset.id = pf.id;

    const nameBtn = document.createElement('button');
    nameBtn.className = 'pf-name-btn';
    nameBtn.textContent = pf.name;
    nameBtn.dataset.id = pf.id;
    nameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePortfolioActions(pf.id);
    });

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'pf-actions-container';
    actionsContainer.dataset.id = pf.id;
    actionsContainer.style.maxHeight = '0';
    actionsContainer.style.opacity = '0';
    actionsContainer.style.overflow = 'hidden';
    actionsContainer.style.transition = 'max-height 0.3s ease, opacity 0.25s ease, margin 0.3s ease';
    actionsContainer.style.marginTop = '0';

    const actionsWrapper = document.createElement('div');
    actionsWrapper.className = 'pf-actions-wrapper';

    const actions = [
      { label: 'Abrir', action: 'open', icon: '🔗' },
      { label: 'Copiar', action: 'copy', icon: '📋' },
      { label: 'Editar', action: 'edit', icon: '✏️' },
      { label: 'Borrar', action: 'delete', icon: '🗑️', danger: true }
    ];
    actions.forEach(a => {
      const btn = document.createElement('button');
      btn.className = `pf-action-btn ${a.danger ? 'danger' : ''}`;
      btn.innerHTML = `${a.icon} ${a.label}`;
      btn.dataset.action = a.action;
      btn.dataset.id = pf.id;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handlePortfolioAction(a.action, pf.id);
        if (a.action !== 'edit') {
          closePortfolioActions();
        }
      });
      actionsWrapper.appendChild(btn);
    });

    actionsContainer.appendChild(actionsWrapper);
    item.appendChild(nameBtn);
    item.appendChild(actionsContainer);

    const editForm = document.createElement('div');
    editForm.className = 'pf-edit-form';
    editForm.dataset.id = pf.id;
    editForm.style.display = 'none';

    const editNameInput = document.createElement('input');
    editNameInput.type = 'text';
    editNameInput.placeholder = 'Nombre';
    editNameInput.value = pf.name;

    const editLinkInput = document.createElement('input');
    editLinkInput.type = 'url';
    editLinkInput.placeholder = 'Enlace';
    editLinkInput.value = pf.link;

    const saveEditBtn = document.createElement('button');
    saveEditBtn.className = 'btn btn-success';
    saveEditBtn.textContent = 'Guardar';
    saveEditBtn.addEventListener('click', () => {
      const newName = editNameInput.value.trim();
      const newLink = editLinkInput.value.trim();
      if (!newName || !newLink) {
        alert('Complete ambos campos.');
        return;
      }
      onEditPortfolio(pf.id, newName, newLink);
    });

    const cancelEditBtn = document.createElement('button');
    cancelEditBtn.className = 'btn btn-secondary';
    cancelEditBtn.textContent = 'Cancelar';
    cancelEditBtn.addEventListener('click', () => {
      editForm.style.display = 'none';
      actionsContainer.style.maxHeight = actionsContainer.scrollHeight + 'px';
      actionsContainer.style.opacity = '1';
      actionsContainer.style.marginTop = 'var(--space-sm)';
    });

    editForm.appendChild(editNameInput);
    editForm.appendChild(editLinkInput);
    editForm.appendChild(saveEditBtn);
    editForm.appendChild(cancelEditBtn);

    item.appendChild(editForm);
    portfoliosListModal.appendChild(item);
  });

  appendAddPortfolioButton();
}

function appendAddPortfolioButton() {
  const addContainer = document.createElement('div');
  addContainer.className = 'add-portfolio-container';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary';
  addBtn.textContent = '+ Añadir portafolio';
  addBtn.id = 'add-portfolio-main-btn';
  addBtn.addEventListener('click', () => {
    const container = addBtn.parentElement;
    let form = container.querySelector('.add-portfolio-form-inline');
    if (!form) {
      form = document.createElement('div');
      form.className = 'add-portfolio-form-inline pf-edit-form';
      form.style.display = 'none';
      const inputName = document.createElement('input');
      inputName.type = 'text';
      inputName.placeholder = 'Nombre';
      inputName.id = 'new-pf-name';
      const inputLink = document.createElement('input');
      inputLink.type = 'url';
      inputLink.placeholder = 'Enlace';
      inputLink.id = 'new-pf-link';
      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn btn-success';
      saveBtn.textContent = 'Guardar';
      saveBtn.addEventListener('click', () => {
        const name = inputName.value.trim();
        const link = inputLink.value.trim();
        if (!name || !link) {
          alert('Complete ambos campos.');
          return;
        }
        onAddPortfolio(name, link);
      });
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-secondary';
      cancelBtn.textContent = 'Cancelar';
      cancelBtn.addEventListener('click', () => {
        form.style.display = 'none';
        addBtn.style.display = 'block';
      });
      form.appendChild(inputName);
      form.appendChild(inputLink);
      form.appendChild(saveBtn);
      form.appendChild(cancelBtn);
      container.appendChild(form);
    }
    addBtn.style.display = 'none';
    form.style.display = 'flex';
  });
  addContainer.appendChild(addBtn);
  portfoliosListModal.appendChild(addContainer);
}

function togglePortfolioActions(id) {
  const item = document.querySelector(`.portfolio-item-modal[data-id="${id}"]`);
  if (!item) return;
  const actionsContainer = item.querySelector('.pf-actions-container');
  if (!actionsContainer) return;

  if (openPortfolioId === id && actionsContainer.style.maxHeight !== '0px') {
    closePortfolioActions();
    return;
  }

  closePortfolioActions();

  // Forzar reflow para que la transición funcione
  actionsContainer.style.maxHeight = '0';
  actionsContainer.style.opacity = '0';
  actionsContainer.style.marginTop = '0';
  requestAnimationFrame(() => {
    actionsContainer.style.maxHeight = actionsContainer.scrollHeight + 'px';
    actionsContainer.style.opacity = '1';
    actionsContainer.style.marginTop = 'var(--space-sm)';
  });
  openPortfolioId = id;
}

function closePortfolioActions() {
  if (openPortfolioId) {
    const item = document.querySelector(`.portfolio-item-modal[data-id="${openPortfolioId}"]`);
    if (item) {
      const actionsContainer = item.querySelector('.pf-actions-container');
      if (actionsContainer) {
        actionsContainer.style.maxHeight = '0';
        actionsContainer.style.opacity = '0';
        actionsContainer.style.marginTop = '0';
      }
      const editForm = item.querySelector('.pf-edit-form');
      if (editForm) editForm.style.display = 'none';
    }
    openPortfolioId = null;
  }
}

function handlePortfolioAction(action, id) {
  const pf = currentPortfolios.find(p => p.id === id);
  if (!pf) return;

  if (action === 'open') {
    if (pf.link) window.open(pf.link, '_blank');
  } else if (action === 'copy') {
    if (pf.link) {
      navigator.clipboard.writeText(pf.link).then(() => {
        alert('Enlace copiado al portapapeles.');
      }).catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = pf.link;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Enlace copiado al portapapeles.');
      });
    }
  } else if (action === 'edit') {
    const item = document.querySelector(`.portfolio-item-modal[data-id="${id}"]`);
    if (item) {
      const actionsContainer = item.querySelector('.pf-actions-container');
      const editForm = item.querySelector('.pf-edit-form');
      if (actionsContainer && editForm) {
        actionsContainer.style.maxHeight = '0';
        actionsContainer.style.opacity = '0';
        actionsContainer.style.marginTop = '0';
        editForm.style.display = 'flex';
        const inputs = editForm.querySelectorAll('input');
        if (inputs.length >= 2) {
          inputs[0].value = pf.name;
          inputs[1].value = pf.link;
        }
      }
    }
    closePortfolioActions();
  } else if (action === 'delete') {
    if (confirm('¿Eliminar este portafolio?')) {
      onDeletePortfolio(id);
    }
  }
}

async function onAddPortfolio(name, link) {
  try {
    await addPortfolio(name, link);
    currentPortfolios = await getPortfolios();
    renderPortfoliosModal();
  } catch (error) {
    console.error('Error al agregar portafolio:', error);
    alert('Error al agregar portafolio.');
  }
}

async function onEditPortfolio(id, name, link) {
  try {
    await editPortfolio(id, name, link);
    currentPortfolios = await getPortfolios();
    renderPortfoliosModal();
  } catch (error) {
    console.error('Error al editar portafolio:', error);
    alert('Error al editar portafolio.');
  }
}

async function onDeletePortfolio(id) {
  try {
    await deletePortfolio(id);
    currentPortfolios = await getPortfolios();
    renderPortfoliosModal();
  } catch (error) {
    console.error('Error al eliminar portafolio:', error);
    alert('Error al eliminar portafolio.');
  }
}

// ============================================================
//  TASAS DE CAMBIO
// ============================================================
function openRatesDialog() {
  const rates = getCurrentRates();
  if (rates) {
    rateUsdInput.value = rates.USD * 1000;
    rateEurInput.value = rates.EUR * 1000;
  } else {
    rateUsdInput.value = '';
    rateEurInput.value = '';
  }
  ratesDialog.showModal();
}

function closeRatesDialog() {
  ratesDialog.close();
}

function onSaveRates() {
  const usd = parseFloat(rateUsdInput.value);
  const eur = parseFloat(rateEurInput.value);
  if (isNaN(usd) || isNaN(eur) || usd <= 0 || eur <= 0) {
    alert('Ingrese valores numéricos positivos.');
    return;
  }
  saveManualRates(usd / 1000, eur / 1000);
  fetchExchangeRates(true);
  renderAll();
  closeRatesDialog();
  alert('Tasas guardadas correctamente.');
}

function onResetRates() {
  if (confirm('¿Restablecer a las tasas de la API? Se perderán las tasas manuales.')) {
    localStorage.removeItem('actols_manual_rates');
    fetchExchangeRates(true);
    renderAll();
    closeRatesDialog();
    alert('Tasas restablecidas.');
  }
}

// ============================================================
//  COTIZACIÓN
// ============================================================
function onQuoteAction() {
  if (currentCheckedIds.size === 0) {
    alert('Seleccione al menos un módulo.');
    return;
  }
  clientNameInput.value = '';
  productNameInput.value = '';
  clientDialog.showModal();
  clientNameInput.focus();
}

async function onDialogConfirm(e) {
  e.preventDefault();
  const clientName = clientNameInput.value.trim();
  const productName = productNameInput.value.trim();
  if (!clientName || !productName) {
    alert('Complete todos los campos.');
    return;
  }
  const totalCOP = calculateTotal(Array.from(currentCheckedIds), currentModules);
  try {
    await generateQuotePDF(clientName, productName, Array.from(currentCheckedIds), currentCurrency, totalCOP, currentModules);
    clientDialog.close();
  } catch (error) {
    console.error('Error al generar PDF:', error);
    alert('Error al generar el PDF.');
  }
}

// ============================================================
//  EVENTOS VARIOS
// ============================================================
function onModuleCheckChange() {
  if (!isEditMode) updateTotal();
}

async function onCurrencyChange(e) {
  currentCurrency = e.target.value;
  await fetchExchangeRates(true);
  renderAll();
}

// ============================================================
//  INICIO (condicional según autenticación)
// ============================================================
if (localStorage.getItem('auth') === 'true') {
  initApp();
}
