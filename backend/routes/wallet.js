const express = require('express');
const { getDb, getBalance } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Ranking público
router.get('/ranking', (req, res) => {
  const db = getDb();
  const sharedDb = require('../../../../shared/users-db').getUsersDb();
  const top = db.prepare(`
    SELECT user_id, COALESCE(SUM(amount),0) as balance
    FROM transactions WHERE amount > 0
    GROUP BY user_id ORDER BY balance DESC LIMIT 20
  `).all();
  const ranking = top.map((row, i) => {
    const user = sharedDb.prepare('SELECT name, instagram FROM users WHERE id=?').get(row.user_id);
    return { position: i+1, name: user?.name || 'Participante', instagram: user?.instagram || null, balance: row.balance };
  });
  res.json({ ranking, updated_at: new Date().toISOString() });
});

// Saldo do usuário autenticado (usado pelos outros sistemas)
router.get('/balance', authMiddleware, (req, res) => {
  res.json({ balance: getBalance(req.user.id), user_id: req.user.id });
});

// Campanhas disponíveis para o usuário (ativas, ainda não coletadas ou allow_multiple)
router.get('/available', authMiddleware, (req, res) => {
  const db = getDb();
  const campaigns = db.prepare(`
    SELECT c.*, sb.name as system_name
    FROM campaigns c
    LEFT JOIN system_budgets sb ON c.system_budget_id = sb.id
    WHERE c.active = 1
      AND (c.budget IS NULL OR c.spent < c.budget)
      AND (
        c.allow_multiple = 1
        OR NOT EXISTS (
          SELECT 1 FROM claims cl
          WHERE cl.campaign_id = c.id AND cl.user_id = ?
        )
      )
    ORDER BY c.created_at DESC
  `).all(req.user.id);

  const sponsors = campaigns.filter(c => !c.action_key).map(c => ({
    id: c.id, name: c.name, description: c.description,
    points: c.points, nfc_token: c.nfc_token,
    remaining: c.budget ? c.budget - c.spent : null,
    type: 'sponsor'
  }));

  const actions = campaigns.filter(c => c.action_key).map(c => ({
    id: c.id, name: c.name, action_key: c.action_key,
    points: c.points, allow_multiple: c.allow_multiple,
    type: 'action'
  }));

  res.json({ sponsors, actions });
});

// Saldo + histórico completo
router.get('/', authMiddleware, (req, res) => {
  const db = getDb();
  const balance = getBalance(req.user.id);
  const transactions = db.prepare(`
    SELECT t.*, c.name as campaign_name
    FROM transactions t
    LEFT JOIN campaigns c ON t.campaign_id = c.id
    WHERE t.user_id = ? ORDER BY t.created_at DESC LIMIT 50
  `).all(req.user.id);
  res.json({ balance, transactions });
});

// Coletar pontos via token NFC — transação atômica com desconto hierárquico
router.post('/claim/:token', authMiddleware, (req, res) => {
  const db = getDb();

  const campaign = db.prepare(`
    SELECT c.*, sb.total_budget as sys_total, sb.used_budget as sys_used
    FROM campaigns c
    LEFT JOIN system_budgets sb ON c.system_budget_id = sb.id
    WHERE c.nfc_token = ? AND c.active = 1
  `).get(req.params.token);

  if (!campaign) return res.status(404).json({ error: 'Ponto não encontrado ou inativo' });

  if (campaign.budget !== null && campaign.spent + campaign.points > campaign.budget)
    return res.status(400).json({ error: 'Este ponto esgotou seu orçamento' });

  if (campaign.system_budget_id && campaign.sys_used + campaign.points > campaign.sys_total)
    return res.status(400).json({ error: 'Sistema sem orçamento disponível' });

  const doTransaction = db.transaction(() => {
    db.prepare('INSERT INTO claims (user_id, campaign_id, points) VALUES (?,?,?)').run(req.user.id, campaign.id, campaign.points);
    db.prepare('INSERT INTO transactions (user_id, amount, type, description, campaign_id) VALUES (?,?,?,?,?)').run(
      req.user.id, campaign.points, 'earn', `Coletado em: ${campaign.name}`, campaign.id
    );
    db.prepare('UPDATE campaigns SET spent = spent + ? WHERE id=?').run(campaign.points, campaign.id);
    if (campaign.system_budget_id) {
      db.prepare('UPDATE system_budgets SET used_budget = used_budget + ? WHERE id=?').run(campaign.points, campaign.system_budget_id);
    }
  });

  try {
    doTransaction();
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Você já coletou este ponto!', already_claimed: true });
    throw err;
  }

  res.json({ success: true, points: campaign.points, balance: getBalance(req.user.id), campaign: campaign.name });
});

// Claim por ação de sistema — chamado pelos backends dos outros sistemas
// Auth: header X-System-Key com a chave compartilhada
const SYSTEM_KEY = process.env.WALLET_SYSTEM_KEY || 'juninas-system-key-2026';

router.post('/action-claim', (req, res) => {
  const key = req.headers['x-system-key'];
  if (key !== SYSTEM_KEY) return res.status(401).json({ error: 'Chave de sistema inválida' });

  const { user_id, action_key } = req.body;
  if (!user_id || !action_key) return res.status(400).json({ error: 'user_id e action_key obrigatórios' });

  const db = getDb();
  const campaign = db.prepare(`
    SELECT c.*, sb.total_budget as sys_total, sb.used_budget as sys_used
    FROM campaigns c
    LEFT JOIN system_budgets sb ON c.system_budget_id = sb.id
    WHERE c.action_key = ? AND c.active = 1
  `).get(action_key);

  if (!campaign) return res.status(404).json({ error: `Campanha de ação '${action_key}' não encontrada ou inativa` });

  if (campaign.budget !== null && campaign.spent + campaign.points > campaign.budget)
    return res.status(400).json({ error: 'Campanha sem orçamento disponível' });

  if (campaign.system_budget_id && campaign.sys_used + campaign.points > campaign.sys_total)
    return res.status(400).json({ error: 'Sistema sem orçamento disponível' });

  const doTransaction = db.transaction(() => {
    // allow_multiple: não exige UNIQUE — cada ação gera um crédito independente
    if (!campaign.allow_multiple) {
      db.prepare('INSERT INTO claims (user_id, campaign_id, points) VALUES (?,?,?)').run(user_id, campaign.id, campaign.points);
    }
    db.prepare('INSERT INTO transactions (user_id, amount, type, description, campaign_id) VALUES (?,?,?,?,?)').run(
      user_id, campaign.points, 'earn', campaign.name, campaign.id
    );
    db.prepare('UPDATE campaigns SET spent = spent + ? WHERE id=?').run(campaign.points, campaign.id);
    if (campaign.system_budget_id) {
      db.prepare('UPDATE system_budgets SET used_budget = used_budget + ? WHERE id=?').run(campaign.points, campaign.system_budget_id);
    }
  });

  try {
    doTransaction();
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(200).json({ success: false, reason: 'already_claimed' });
    throw err;
  }

  res.json({ success: true, points: campaign.points, balance: getBalance(user_id) });
});

module.exports = router;
