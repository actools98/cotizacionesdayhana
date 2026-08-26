// ============================================================
//  main.js - Con autenticación por contraseña (1998)
//  + Detalle en módulos y edición con diálogo
// ============================================================

import { getModules, addModule, deleteModule, editModule, reorderModules, getCategories, addCategory, editCategory, deleteCategory, reorderCategories, getPortfolios, addPortfolio, editPortfolio, deletePortfolio } from './state.js';
import { calculateTotal, getSelectedModules } from './components/quoteCalculator.js';
import { fetchExchangeRates, convertCurrency, startAutoRefresh, saveManualRates, getCurrentRates } from './components/currencyConverter.js';
import { generateQuotePDF } from './components/exportPDF.js';
import { renderModulesByCategory, renderAdminModulesByCategory } from './utils/domHelpers.js';
import { formatCurrency } from './utils/formatters.js';
import Sortable from 'sortablejs';

// ============================================================
//  AUTENTICACIÓN
// ============================================================
const PASSWORD = '1998';
const loginOverlay = document.getElementById('login-overlay');
const appWrapper = document.getElementById('app-wrapper');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

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
//  DOM REFS
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
const moduleDetailInput = document.getElementById('module-detail');
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

// Edición de módulo
const editModuleDialog = document.getElementById('edit-module-dialog');
const editModuleName = document.getElementById('edit-module-name');
const editModulePrice = document.getElementById('edit-module-price');
const editModuleCategory = document.getElementById('edit-module-category');
const editModuleDetail = document.getElementById('edit-module-detail');
const editModuleSave = document.getElementById('edit-module-save');
const editModuleCancel = document.getElementById('edit-module-cancel');

let currentEditingModuleId = null;

// ============================================================
//  ESTADO
// ============================================================
let currentModules = [];
let currentCategories = [];
let currentPortfolios = [];
let currentCurrency = 'COP';
let currentCheckedIds = new Set();
let isEditMode = false;
let sortableInstances = [];
let openPortfolioId = null;

// ============================================================
//  INICIALIZACIÓN
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
  populateEditCategorySelect();
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

function populateEditCategorySelect() {
  editModuleCategory.innerHTML = '';
  currentCategories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    editModuleCategory.appendChild(opt);
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

  editModuleSave.addEventListener('click', saveEditModule);
  editModuleCancel.addEventListener('click', () => editModuleDialog.close());

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
//  SORTABLE
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
  const detail = moduleDetailInput.value.trim() || null;
  if (!desc || isNaN(price) || price <= 0) {
    alert('Ingrese nombre y precio válido.');
    return;
  }
  const categoryId = moduleCategorySelect.value || currentCategories[0]?.id || null;
  try {
    await addModule(desc, price, categoryId, detail);
    await loadData();
    renderAll();
    moduleDescInput.value = '';
    modulePriceInput.value = '';
    moduleDetailInput.value = '';
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

function handleEditModule(id) {
  const module = currentModules.find(m => m.id === id);
  if (!module) return;
  currentEditingModuleId = id;
  editModuleName.value = module.description;
  editModulePrice.value = module.price;
  editModuleDetail.value = module.detail || '';
  const catSelect = editModuleCategory;
  for (let opt of catSelect.options) {
    if (opt.value === module.category_id) {
      catSelect.value = module.category_id;
      break;
    }
  }
  editModuleDialog.showModal();
}

async function saveEditModule() {
  const name = editModuleName.value.trim();
  const price = parseFloat(editModulePrice.value);
  const detail = editModuleDetail.value.trim() || null;
  const categoryId = editModuleCategory.value || currentCategories[0]?.id || null;
  if (!name || isNaN(price) || price <= 0) {
    alert('Complete los campos obligatorios.');
    return;
  }
  try {
    await editModule(currentEditingModuleId, name, price, categoryId, detail);
    await loadData();
    renderAll();
    editModuleDialog.close();
    currentEditingModuleId = null;
  } catch (error) {
    console.error('Error al editar módulo:', error);
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
//  PORTAFOLIOS - IMPLEMENTACIÓN COMPLETA
// ============================================================

function openPortfoliosDialog() {
  renderPortfoliosModal();
  portfoliosDialog.showModal();
}

function closePortfoliosDialog() {
  portfoliosDialog.close();
}

function renderPortfoliosModal() {
  if (!portfoliosListModal) return;
  portfoliosListModal.innerHTML = '';

  if (!currentPortfolios || currentPortfolios.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.textContent = 'No hay portafolios. Agrega uno.';
    emptyMsg.style.color = 'var(--color-text-secondary)';
    emptyMsg.style.textAlign = 'center';
    portfoliosListModal.appendChild(emptyMsg);
  } else {
    currentPortfolios.forEach(pf => {
      const item = document.createElement('div');
      item.className = 'portfolio-item-modal';
      item.dataset.id = pf.id;

      // Nombre del portafolio (enlace)
      const nameLink = document.createElement('a');
      nameLink.href = pf.link;
      nameLink.target = '_blank';
      nameLink.textContent = pf.name;
      nameLink.style.color = 'var(--color-primary)';
      nameLink.style.fontWeight = '600';
      nameLink.style.display = 'block';
      nameLink.style.marginBottom = '4px';

      // Botones de acción
      const actions = document.createElement('div');
      actions.className = 'pf-actions-modal';

      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-secondary';
      editBtn.textContent = 'Editar';
      editBtn.style.marginRight = '8px';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startEditPortfolio(pf.id);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger';
      deleteBtn.textContent = 'Eliminar';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onDeletePortfolio(pf.id);
      });

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      // Formulario de edición (oculto)
      const editForm = document.createElement('div');
      editForm.className = 'pf-edit-form';
      editForm.style.display = 'none';
      editForm.dataset.id = pf.id;

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = pf.name;
      nameInput.placeholder = 'Nombre';

      const linkInput = document.createElement('input');
      linkInput.type = 'url';
      linkInput.value = pf.link;
      linkInput.placeholder = 'Enlace (URL)';

      const saveEditBtn = document.createElement('button');
      saveEditBtn.className = 'btn btn-primary';
      saveEditBtn.textContent = 'Guardar';
      saveEditBtn.addEventListener('click', () => {
        const newName = nameInput.value.trim();
        const newLink = linkInput.value.trim();
        if (!newName || !newLink) {
          alert('Nombre y enlace son obligatorios.');
          return;
        }
        onEditPortfolio(pf.id, newName, newLink);
      });

      const cancelEditBtn = document.createElement('button');
      cancelEditBtn.className = 'btn btn-secondary';
      cancelEditBtn.textContent = 'Cancelar';
      cancelEditBtn.addEventListener('click', () => {
        editForm.style.display = 'none';
        actions.style.display = 'flex';
      });

      editForm.appendChild(nameInput);
      editForm.appendChild(linkInput);
      editForm.appendChild(saveEditBtn);
      editForm.appendChild(cancelEditBtn);

      item.appendChild(nameLink);
      item.appendChild(actions);
      item.appendChild(editForm);
      portfoliosListModal.appendChild(item);
    });
  }

  // Botón para agregar nuevo portafolio
  const addContainer = document.createElement('div');
  addContainer.className = 'add-portfolio-container';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary';
  addBtn.textContent = '+ Agregar portafolio';
  addBtn.addEventListener('click', () => {
    const name = prompt('Nombre del portafolio:');
    if (!name) return;
    const link = prompt('Enlace (URL):');
    if (!link) return;
    onAddPortfolio(name, link);
  });
  addContainer.appendChild(addBtn);
  portfoliosListModal.appendChild(addContainer);
}

// Funciones de acciones de portafolios
function startEditPortfolio(id) {
  const item = document.querySelector(`.portfolio-item-modal[data-id="${id}"]`);
  if (!item) return;
  const actions = item.querySelector('.pf-actions-modal');
  const editForm = item.querySelector('.pf-edit-form');
  if (actions) actions.style.display = 'none';
  if (editForm) editForm.style.display = 'flex';
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
  if (!confirm('¿Eliminar este portafolio?')) return;
  try {
    await deletePortfolio(id);
    currentPortfolios = await getPortfolios();
    renderPortfoliosModal();
  } catch (error) {
    console.error('Error al eliminar portafolio:', error);
    alert('Error al eliminar portafolio.');
  }
}

// Funciones auxiliares para menú contextual (no usadas en este modal, pero las dejamos vacías)
function togglePortfolioActions(id) {
  // No se usa en esta implementación
}

function closePortfolioActions() {
  // No se usa en esta implementación
}

function handlePortfolioAction(action, id) {
  // No se usa en esta implementación
}

// ============================================================
//  TASAS
// ============================================================
function openRatesDialog() {
  const rates = getCurrentRates();
  if (rates) {
    rateUsdInput.value = rates.USD * 1000; // mostramos por 1000 COP
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
  closeRatesDialog();
  alert('Tasas guardadas correctamente.');
}

function onResetRates() {
  if (confirm('¿Restablecer tasas a la API?')) {
    localStorage.removeItem('actols_manual_rates');
    fetchExchangeRates(true);
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
    const selectedModules = getSelectedModules(Array.from(currentCheckedIds), currentModules);
    await generateQuotePDF(clientName, productName, selectedModules, currentCurrency, totalCOP);
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
//  INICIO
// ============================================================
if (localStorage.getItem('auth') === 'true') {
  initApp();
}
