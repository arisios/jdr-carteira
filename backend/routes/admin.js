const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../database/db');
const { adminMiddleware, masterMiddleware } = require('../middleware/auth');
const router = express.Router();

// ── System Budgets (master only) ──────────────────────────────────────────────

router.get('/systems', adminMiddleware, (req, res) => {
  const db = getDb();
  const systems = db.prepare(`
    SELECT s.*,
      (s.total_budget - s.used_budget) as available_budget,
      COUNT(c.id) as campaign_count,
      COALESCE(SUM(CASE WHEN c.budget IS NOT NULL THEN c.budget ELSE 0 END), 0) as allocated_budget
    FROM system_budgets s
    LEFT JOIN campaigns c ON c.system_budget_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at ASC
  `).all();
  res.json({ systems });
});

router.post('/systems', adminMiddleware, (req, res) => {
  const { name, total_budget } = req.body;
  if (!name?.trim() || !total_budget) return res.status(400).json({ error: 'Nome e orçamento obrigatórios' });
  const db = getDb();
  const result = db.prepare('INSERT INTO system_budgets (name, total_budget, created_by_admin_id) VALUES (?, ?, ?)').run(
    name.trim(), parseInt(total_budget), req.user.id
  );
  res.status(201).json({ system: db.prepare('SELECT * FROM system_budgets WHERE id=?').get(result.lastInsertRowid) });
});

router.patch('/systems/:id', adminMiddleware, (req, res) => {
  const db = getDb();
  const sys = db.prepare('SELECT * FROM system_budgets WHERE id=?').get(parseInt(req.params.id));
  if (!sys) return res.status(404).json({ error: 'Sistema não encontrado' });
  const { name, total_budget } = req.body;
  if (total_budget && parseInt(total_budget) < sys.used_budget)
    return res.status(400).json({ error: `Orçamento não pode ser menor que o já usado (${sys.used_budget})` });
  db.prepare('UPDATE system_budgets SET name=?, total_budget=? WHERE id=?').run(
    name ?? sys.name, total_budget ? parseInt(total_budget) : sys.total_budget, sys.id
  );
  res.json({ system: db.prepare('SELECT * FROM system_budgets WHERE id=?').get(sys.id) });
});

router.delete('/systems/:id', adminMiddleware, (req, res) => {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as c FROM campaigns WHERE system_budget_id=?').get(parseInt(req.params.id)).c;
  if (count > 0) return res.status(400).json({ error: 'Exclua todas as campanhas deste sistema antes' });
  db.prepare('DELETE FROM system_budgets WHERE id=?').run(parseInt(req.params.id));
  res.json({ success: true });
});

// ── Stats ─────────────────────────────────────────────────────────────────────

router.get('/stats', adminMiddleware, (req, res) => {
  const db = getDb();
  const totalUsers   = db.prepare('SELECT COUNT(DISTINCT user_id) as c FROM transactions').get().c;
  const totalEmitted = db.prepare("SELECT COALESCE(SUM(amount),0) as c FROM transactions WHERE type='earn'").get().c;
  const totalClaims  = db.prepare('SELECT COUNT(*) as c FROM claims').get().c;
  const campaigns    = db.prepare(`
    SELECT c.*, sb.name as system_name,
      CASE WHEN c.budget IS NOT NULL THEN c.budget - c.spent ELSE NULL END as remaining,
      COUNT(cl.id) as claim_count
    FROM campaigns c
    LEFT JOIN system_budgets sb ON c.system_budget_id = sb.id
    LEFT JOIN claims cl ON cl.campaign_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all();
  const topUsers     = db.prepare('SELECT user_id, COALESCE(SUM(amount),0) as balance FROM transactions GROUP BY user_id ORDER BY balance DESC LIMIT 10').all();
  const recentClaims = db.prepare(`
    SELECT cl.*, c.name as campaign_name, c.points
    FROM claims cl JOIN campaigns c ON cl.campaign_id = c.id
    ORDER BY cl.created_at DESC LIMIT 20
  `).all();
  const systems      = db.prepare(`
    SELECT s.*, (s.total_budget - s.used_budget) as available_budget
    FROM system_budgets s ORDER BY s.created_at ASC
  `).all();
  res.json({ totalUsers, totalEmitted, totalClaims, campaigns, topUsers, recentClaims, systems });
});

// ── Campaigns ─────────────────────────────────────────────────────────────────

router.post('/campaigns', adminMiddleware, (req, res) => {
  const { name, description, points, budget, system_budget_id, action_key, allow_multiple } = req.body;
  if (!name?.trim() || !points) return res.status(400).json({ error: 'Nome e pontos obrigatórios' });

  const db = getDb();

  if (system_budget_id) {
    const sys = db.prepare('SELECT * FROM system_budgets WHERE id=?').get(parseInt(system_budget_id));
    if (!sys) return res.status(404).json({ error: 'Sistema não encontrado' });
    if (budget) {
      const available = sys.total_budget - sys.used_budget;
      if (parseInt(budget) > available)
        return res.status(400).json({ error: `Orçamento excede o disponível no sistema (${available} moedas)` });
    }
  }

  if (action_key?.trim()) {
    const exists = db.prepare('SELECT id FROM campaigns WHERE action_key=?').get(action_key.trim());
    if (exists) return res.status(400).json({ error: `action_key '${action_key}' já existe` });
  }

  const nfc_token = crypto.randomBytes(16).toString('hex');
  const result = db.prepare(
    'INSERT INTO campaigns (name, description, nfc_token, points, budget, system_budget_id, action_key, allow_multiple) VALUES (?,?,?,?,?,?,?,?)'
  ).run(
    name.trim(), description?.trim() || null, nfc_token, parseInt(points),
    budget ? parseInt(budget) : null,
    system_budget_id ? parseInt(system_budget_id) : null,
    action_key?.trim() || null,
    allow_multiple ? 1 : 0
  );

  const campaign = db.prepare(`
    SELECT c.*, sb.name as system_name FROM campaigns c
    LEFT JOIN system_budgets sb ON c.system_budget_id = sb.id
    WHERE c.id=?
  `).get(result.lastInsertRowid);
  res.status(201).json({ campaign });
});

router.patch('/campaigns/:id', adminMiddleware, (req, res) => {
  const db = getDb();
  const camp = db.prepare('SELECT * FROM campaigns WHERE id=?').get(parseInt(req.params.id));
  if (!camp) return res.status(404).json({ error: 'Campanha não encontrada' });
  const { name, description, points, budget, active, system_budget_id } = req.body;
  db.prepare('UPDATE campaigns SET name=?, description=?, points=?, budget=?, active=?, system_budget_id=? WHERE id=?').run(
    name ?? camp.name,
    description ?? camp.description,
    points ?? camp.points,
    budget !== undefined ? (budget === null ? null : parseInt(budget)) : camp.budget,
    active !== undefined ? (active ? 1 : 0) : camp.active,
    system_budget_id !== undefined ? (system_budget_id === null ? null : parseInt(system_budget_id)) : camp.system_budget_id,
    camp.id
  );
  res.json({ campaign: db.prepare('SELECT * FROM campaigns WHERE id=?').get(camp.id) });
});

router.delete('/campaigns/:id', adminMiddleware, (req, res) => {
  const db = getDb();
  const camp = db.prepare('SELECT * FROM campaigns WHERE id=?').get(parseInt(req.params.id));
  if (!camp) return res.status(404).json({ error: 'Campanha não encontrada' });
  db.prepare('DELETE FROM claims WHERE campaign_id=?').run(camp.id);
  db.prepare('DELETE FROM campaigns WHERE id=?').run(camp.id);
  res.json({ success: true });
});

// ── Emissão manual ────────────────────────────────────────────────────────────

router.post('/emit', adminMiddleware, (req, res) => {
  const { user_id, amount, description } = req.body;
  if (!user_id || !amount) return res.status(400).json({ error: 'user_id e amount obrigatórios' });
  const db = getDb();
  db.prepare('INSERT INTO transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)').run(
    user_id, parseInt(amount), amount > 0 ? 'earn' : 'deduct', description || 'Emissão manual pelo admin'
  );
  res.json({ success: true });
});

module.exports = router;
