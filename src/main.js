// ============================================================
//  main.js - Con autenticación por contraseña (1998)
//  + Portafolios con menú contextual
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
let openContextMenuId = null; // ID del portafolio cuyo menú está abierto

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

  // Cerrar menú contextual al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (openContextMenuId) {
      const menu = document.querySelector(`.pf-context-menu[data-id="${openContextMenuId}"]`);
      const button = document.querySelector(`.pf-button[data-id="${openContextMenuId}"]`);
      if (menu && !menu.contains(e.target) && button && !button.contains(e.target)) {
        closeContextMenu();
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
//  PORTAFOLIOS - CON MENÚ CONTEXTUAL Y FORMULARIO
// ============================================================

function openPortfoliosDialog() {
  renderPortfoliosModal();
  portfoliosDialog.showModal();
}

function closePortfoliosDialog() {
  closeContextMenu(); // cerrar menú si estaba abierto
  portfoliosDialog.close();
}

function renderPortfoliosModal() {
  if (!portfoliosListModal) return;
  portfoliosListModal.innerHTML = '';

  // --- Lista de portafolios como botones ---
  if (!currentPortfolios || currentPortfolios.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.textContent = 'No hay portafolios. Agrega uno.';
    emptyMsg.style.color = 'var(--color-text-secondary)';
    emptyMsg.style.textAlign = 'center';
    portfoliosListModal.appendChild(emptyMsg);
  } else {
    currentPortfolios.forEach(pf => {
      const wrapper = document.createElement('div');
      wrapper.style.position = 'relative';
      wrapper.style.marginBottom = '8px';

      // Botón principal
      const btn = document.createElement('button');
      btn.className = 'pf-button';
      btn.dataset.id = pf.id;
      btn.textContent = pf.name;
      btn.style.width = '100%';
      btn.style.padding = '10px 12px';
      btn.style.background = 'var(--color-bg-surface)';
      btn.style.border = '1px solid var(--color-border)';
      btn.style.borderRadius = 'var(--radius-sm)';
      btn.style.color = 'var(--color-text-primary)';
      btn.style.fontSize = 'var(--text-body)';
      btn.style.fontWeight = '500';
      btn.style.cursor = 'pointer';
      btn.style.transition = 'all 0.2s ease';
      btn.style.textAlign = 'left';

      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'var(--color-primary-muted)';
        btn.style.borderColor = 'var(--color-primary)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'var(--color-bg-surface)';
        btn.style.borderColor = 'var(--color-border)';
      });

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleContextMenu(pf.id);
      });

      // Menú contextual
      const menu = document.createElement('div');
      menu.className = 'pf-context-menu';
      menu.dataset.id = pf.id;
      menu.style.display = 'none';
      menu.style.position = 'absolute';
      menu.style.top = 'calc(100% + 4px)';
      menu.style.left = '0';
      menu.style.right = '0';
      menu.style.background = 'var(--color-bg-surface)';
      menu.style.border = '1px solid var(--color-border)';
      menu.style.borderRadius = 'var(--radius-sm)';
      menu.style.boxShadow = 'var(--shadow-floating)';
      menu.style.zIndex = '1000';
      menu.style.padding = '4px 0';
      menu.style.minWidth = '180px';

      const options = [
        { label: '📋 Copiar enlace', action: () => copyLink(pf.link) },
        { label: '🔗 Abrir enlace', action: () => openLink(pf.link) },
        { label: '✏️ Editar', action: () => startEditPortfolio(pf.id) },
        { label: '🗑️ Borrar', action: () => onDeletePortfolio(pf.id), danger: true }
      ];

      options.forEach(opt => {
        const item = document.createElement('button');
        item.textContent = opt.label;
        item.style.display = 'block';
        item.style.width = '100%';
        item.style.padding = '8px 12px';
        item.style.background = 'transparent';
        item.style.border = 'none';
        item.style.textAlign = 'left';
        item.style.fontSize = 'var(--text-small)';
        item.style.color = opt.danger ? 'var(--color-danger)' : 'var(--color-text-primary)';
        item.style.cursor = 'pointer';
        item.style.transition = 'background 0.15s ease';
        item.addEventListener('mouseenter', () => {
          item.style.background = 'var(--color-primary-muted)';
        });
        item.addEventListener('mouseleave', () => {
          item.style.background = 'transparent';
        });
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          opt.action();
          closeContextMenu();
        });
        menu.appendChild(item);
      });

      wrapper.appendChild(btn);
      wrapper.appendChild(menu);
      portfoliosListModal.appendChild(wrapper);
    });
  }

  // --- Formulario para agregar ---
  const addForm = document.createElement('div');
  addForm.style.marginTop = '16px';
  addForm.style.paddingTop = '16px';
  addForm.style.borderTop = '1px solid var(--color-border)';

  const form = document.createElement('form');
  form.id = 'add-portfolio-form';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Nombre del portafolio';
  nameInput.required = true;
  nameInput.style.width = '100%';
  nameInput.style.padding = '8px 12px';
  nameInput.style.marginBottom = '8px';
  nameInput.style.border = '1px solid var(--color-border)';
  nameInput.style.borderRadius = 'var(--radius-sm)';
  nameInput.style.background = 'var(--color-bg-main)';
  nameInput.style.color = 'var(--color-text-primary)';
  nameInput.style.fontSize = 'var(--text-body)';

  const linkInput = document.createElement('input');
  linkInput.type = 'url';
  linkInput.placeholder = 'Enlace (URL)';
  linkInput.required = true;
  linkInput.style.width = '100%';
  linkInput.style.padding = '8px 12px';
  linkInput.style.marginBottom = '8px';
  linkInput.style.border = '1px solid var(--color-border)';
  linkInput.style.borderRadius = 'var(--radius-sm)';
  linkInput.style.background = 'var(--color-bg-main)';
  linkInput.style.color = 'var(--color-text-primary)';
  linkInput.style.fontSize = 'var(--text-body)';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'btn btn-primary';
  submitBtn.textContent = 'Agregar portafolio';
  submitBtn.style.width = '100%';

  form.appendChild(nameInput);
  form.appendChild(linkInput);
  form.appendChild(submitBtn);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const link = linkInput.value.trim();
    if (!name || !link) {
      alert('Nombre y enlace son obligatorios.');
      return;
    }
    await onAddPortfolio(name, link);
    nameInput.value = '';
    linkInput.value = '';
    // Re-renderizar
    renderPortfoliosModal();
  });

  addForm.appendChild(form);
  portfoliosListModal.appendChild(addForm);
}

// Funciones auxiliares del menú contextual
function toggleContextMenu(id) {
  if (openContextMenuId === id) {
    closeContextMenu();
    return;
  }
  closeContextMenu(); // cerrar cualquier otro abierto
  const menu = document.querySelector(`.pf-context-menu[data-id="${id}"]`);
  if (menu) {
    menu.style.display = 'block';
    openContextMenuId = id;
  }
}

function closeContextMenu() {
  if (openContextMenuId) {
    const menu = document.querySelector(`.pf-context-menu[data-id="${openContextMenuId}"]`);
    if (menu) menu.style.display = 'none';
    openContextMenuId = null;
  }
}

function copyLink(link) {
  navigator.clipboard.writeText(link).then(() => {
    alert('Enlace copiado al portapapeles');
  }).catch(() => {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = link;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    alert('Enlace copiado al portapapeles');
  });
}

function openLink(link) {
  window.open(link, '_blank');
}

function startEditPortfolio(id) {
  const portfolio = currentPortfolios.find(p => p.id === id);
  if (!portfolio) return;
  const newName = prompt('Nuevo nombre:', portfolio.name);
  if (newName === null || newName.trim() === '') return;
  const newLink = prompt('Nuevo enlace:', portfolio.link);
  if (newLink === null || newLink.trim() === '') return;
  onEditPortfolio(id, newName.trim(), newLink.trim());
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

// ============================================================
//  TASAS
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
