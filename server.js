import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

let db;

async function initDb() {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

  const dbPath = path.join(dataDir, 'modules.db');
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Tabla categorías (sin cambios)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    )
  `);

  // Tabla módulos con soporte multi-idioma
  // Verificar si la tabla existe y tiene la estructura antigua
  const tableInfo = await db.all(`PRAGMA table_info(modules)`);
  const hasDescription = tableInfo.some(col => col.name === 'description');
  const hasDetail = tableInfo.some(col => col.name === 'detail');

  if (!hasDescription && !hasDetail) {
    // Tabla nueva: crear directamente
    await db.exec(`
      CREATE TABLE IF NOT EXISTS modules (
        id TEXT PRIMARY KEY,
        description_es TEXT NOT NULL,
        description_fr TEXT NOT NULL,
        description_en TEXT NOT NULL,
        detail_es TEXT,
        detail_fr TEXT,
        detail_en TEXT,
        price INTEGER NOT NULL,
        category_id TEXT REFERENCES categories(id),
        sort_order INTEGER DEFAULT 0
      )
    `);
    console.log('📦 Tabla modules creada con multi-idioma');
  } else {
    // Migración: añadir nuevas columnas
    console.log('🔄 Migrando tabla modules a multi-idioma...');
    try {
      await db.exec(`ALTER TABLE modules ADD COLUMN description_es TEXT`);
      await db.exec(`ALTER TABLE modules ADD COLUMN description_fr TEXT`);
      await db.exec(`ALTER TABLE modules ADD COLUMN description_en TEXT`);
      await db.exec(`ALTER TABLE modules ADD COLUMN detail_es TEXT`);
      await db.exec(`ALTER TABLE modules ADD COLUMN detail_fr TEXT`);
      await db.exec(`ALTER TABLE modules ADD COLUMN detail_en TEXT`);
      
      // Copiar datos existentes a description_es (asumiendo que están en español)
      await db.exec(`UPDATE modules SET description_es = description, detail_es = detail`);
      // Para fr y en, si no hay datos, dejamos vacío o copiamos también
      await db.exec(`UPDATE modules SET description_fr = description, description_en = description`);
      await db.exec(`UPDATE modules SET detail_fr = detail, detail_en = detail`);
      
      console.log('✅ Migración completada');
    } catch (e) {
      console.error('❌ Error en migración:', e);
    }
  }

  // Cargar categorías por defecto si no hay
  const catCount = await db.get('SELECT COUNT(*) as count FROM categories');
  if (catCount.count === 0) {
    const defaultCats = [
      { id: 'cat-1', name: 'General', sort_order: 0 },
      { id: 'cat-2', name: 'Consultoría', sort_order: 1 },
      { id: 'cat-3', name: 'Implementación', sort_order: 2 },
      { id: 'cat-4', name: 'Capacitación', sort_order: 3 },
      { id: 'cat-5', name: 'Soporte', sort_order: 4 }
    ];
    for (const c of defaultCats) {
      await db.run('INSERT INTO categories (id, name, sort_order) VALUES (?, ?, ?)', [c.id, c.name, c.sort_order]);
    }
    console.log('📂 Categorías por defecto creadas');
  }

  // Cargar módulos por defecto si no hay
  const modCount = await db.get('SELECT COUNT(*) as count FROM modules');
  if (modCount.count === 0) {
    const defaultModules = [
      {
        id: 'mod-1',
        description_es: 'Costo base de operación',
        description_fr: 'Coût de base d\'exploitation',
        description_en: 'Basic operating cost',
        detail_es: 'Costo fijo mensual por operación base.',
        detail_fr: 'Coût fixe mensuel pour l\'exploitation de base.',
        detail_en: 'Monthly fixed cost for base operation.',
        price: 600000
      },
      {
        id: 'mod-2',
        description_es: 'Servicio de consultoría básica',
        description_fr: 'Service de conseil de base',
        description_en: 'Basic consulting service',
        detail_es: 'Asesoría inicial y diagnóstico.',
        detail_fr: 'Conseil initial et diagnostic.',
        detail_en: 'Initial advice and diagnosis.',
        price: 350000
      },
      {
        id: 'mod-3',
        description_es: 'Implementación de software',
        description_fr: 'Mise en œuvre logicielle',
        description_en: 'Software implementation',
        detail_es: 'Instalación y configuración del sistema.',
        detail_fr: 'Installation et configuration du système.',
        detail_en: 'System installation and configuration.',
        price: 1200000
      }
    ];
    const firstCat = await db.get('SELECT id FROM categories ORDER BY sort_order LIMIT 1');
    if (firstCat) {
      for (let i = 0; i < defaultModules.length; i++) {
        const m = defaultModules[i];
        await db.run(
          `INSERT INTO modules 
           (id, description_es, description_fr, description_en, detail_es, detail_fr, detail_en, price, category_id, sort_order) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [m.id, m.description_es, m.description_fr, m.description_en, 
           m.detail_es, m.detail_fr, m.detail_en, 
           m.price, firstCat.id, i]
        );
      }
      console.log('📦 Módulos por defecto cargados');
    }
  }

  console.log('✅ Base de datos lista');
}

// ---- Rutas para categorías (sin cambios) ----
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await db.all('SELECT * FROM categories ORDER BY sort_order');
    res.json(categories);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

app.post('/api/categories', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const id = `cat-${Date.now()}`;
    const maxOrder = await db.get('SELECT MAX(sort_order) as max FROM categories');
    const order = (maxOrder?.max ?? -1) + 1;
    await db.run('INSERT INTO categories (id, name, sort_order) VALUES (?, ?, ?)', [id, name, order]);
    const newCat = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
    res.status(201).json(newCat);
  } catch (e) {
    res.status(500).json({ error: 'Error al crear categoría' });
  }
});

app.put('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const result = await db.run('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
    const updated = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar categoría' });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const defaultCat = await db.get('SELECT id FROM categories ORDER BY sort_order LIMIT 1');
    if (defaultCat) {
      await db.run('UPDATE modules SET category_id = ? WHERE category_id = ?', [defaultCat.id, id]);
    }
    await db.run('DELETE FROM categories WHERE id = ?', [id]);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar categoría' });
  }
});

app.patch('/api/categories/reorder', async (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Se requiere un arreglo de items' });
  }
  try {
    for (const item of items) {
      await db.run('UPDATE categories SET sort_order = ? WHERE id = ?', [item.sort_order, item.id]);
    }
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al reordenar categorías' });
  }
});

// ---- Rutas para módulos (multi-idioma) ----
app.get('/api/modules', async (req, res) => {
  try {
    const modules = await db.all(`
      SELECT m.*, c.name as category_name 
      FROM modules m 
      LEFT JOIN categories c ON m.category_id = c.id 
      ORDER BY c.sort_order, m.sort_order
    `);
    res.json(modules);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener módulos' });
  }
});

app.post('/api/modules', async (req, res) => {
  const { 
    description_es, description_fr, description_en,
    detail_es, detail_fr, detail_en,
    price, category_id 
  } = req.body;
  if (!description_es || !description_fr || !description_en || price === undefined) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  try {
    const id = `mod-${Date.now()}`;
    let catId = category_id;
    if (!catId) {
      const firstCat = await db.get('SELECT id FROM categories ORDER BY sort_order LIMIT 1');
      catId = firstCat?.id || null;
    }
    const maxOrder = await db.get('SELECT MAX(sort_order) as max FROM modules WHERE category_id = ?', [catId]);
    const order = (maxOrder?.max ?? -1) + 1;

    await db.run(
      `INSERT INTO modules 
       (id, description_es, description_fr, description_en, detail_es, detail_fr, detail_en, price, category_id, sort_order) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, description_es, description_fr, description_en, 
       detail_es || null, detail_fr || null, detail_en || null, 
       price, catId, order]
    );
    const newModule = await db.get('SELECT * FROM modules WHERE id = ?', [id]);
    res.status(201).json(newModule);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al agregar módulo' });
  }
});

app.put('/api/modules/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    description_es, description_fr, description_en,
    detail_es, detail_fr, detail_en,
    price, category_id 
  } = req.body;
  if (!description_es || !description_fr || !description_en || price === undefined) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  try {
    await db.run(
      `UPDATE modules SET 
        description_es = ?, description_fr = ?, description_en = ?,
        detail_es = ?, detail_fr = ?, detail_en = ?,
        price = ?, category_id = ?
       WHERE id = ?`,
      [description_es, description_fr, description_en,
       detail_es || null, detail_fr || null, detail_en || null,
       price, category_id, id]
    );
    const updated = await db.get('SELECT * FROM modules WHERE id = ?', [id]);
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar módulo' });
  }
});

app.delete('/api/modules/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.run('DELETE FROM modules WHERE id = ?', [id]);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar módulo' });
  }
});

app.patch('/api/modules/reorder', async (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Se requiere un arreglo de items' });
  }
  try {
    for (const item of items) {
      await db.run('UPDATE modules SET category_id = ?, sort_order = ? WHERE id = ?', [item.category_id, item.sort_order, item.id]);
    }
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al reordenar módulos' });
  }
});

// ---- Rutas para portafolios (sin cambios) ----
app.get('/api/portfolios', async (req, res) => {
  try {
    const portfolios = await db.all('SELECT * FROM portfolios ORDER BY sort_order');
    res.json(portfolios);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener portafolios' });
  }
});

app.post('/api/portfolios', async (req, res) => {
  const { name, link } = req.body;
  if (!name || !link) return res.status(400).json({ error: 'Nombre y enlace requeridos' });
  try {
    const id = `pf-${Date.now()}`;
    const maxOrder = await db.get('SELECT MAX(sort_order) as max FROM portfolios');
    const order = (maxOrder?.max ?? -1) + 1;
    await db.run('INSERT INTO portfolios (id, name, link, sort_order) VALUES (?, ?, ?, ?)', [id, name, link, order]);
    const newPf = await db.get('SELECT * FROM portfolios WHERE id = ?', [id]);
    res.status(201).json(newPf);
  } catch (e) {
    res.status(500).json({ error: 'Error al crear portafolio' });
  }
});

app.put('/api/portfolios/:id', async (req, res) => {
  const { id } = req.params;
  const { name, link } = req.body;
  if (!name || !link) return res.status(400).json({ error: 'Nombre y enlace requeridos' });
  try {
    await db.run('UPDATE portfolios SET name = ?, link = ? WHERE id = ?', [name, link, id]);
    const updated = await db.get('SELECT * FROM portfolios WHERE id = ?', [id]);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar portafolio' });
  }
});

app.delete('/api/portfolios/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.run('DELETE FROM portfolios WHERE id = ?', [id]);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar portafolio' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

await initDb();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
