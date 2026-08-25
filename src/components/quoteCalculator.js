// quoteCalculator.js
export function calculateTotal(checkedIds, modules) {
  let total = 0;
  checkedIds.forEach(id => {
    const mod = modules.find(m => m.id === id);
    if (mod) total += mod.price;
  });
  return total;
}

export function getSelectedModules(checkedIds, modules) {
  return checkedIds.map(id => modules.find(m => m.id === id)).filter(Boolean);
}
