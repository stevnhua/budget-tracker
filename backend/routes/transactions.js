// routes/transactions.js - Transaction Management Routes
const express = require('express');
const router = express.Router();
const { query, getClient } = require('../config/database');
const { authenticateToken, checkFeatureLimit } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// All routes require authentication
router.use(authenticateToken);

// Get all transactions for user with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 50,
      startDate,
      endDate,
      category,
      type,
      search,
      sortBy = 'transaction_date',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const params = [userId];
    let paramCount = 1;
    
    let whereClause = 'WHERE user_id = $1';

    if (startDate) {
      paramCount++;
      whereClause += ` AND transaction_date >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      whereClause += ` AND transaction_date <= $${paramCount}`;
      params.push(endDate);
    }

    if (category) {
      paramCount++;
      whereClause += ` AND category = $${paramCount}`;
      params.push(category);
    }

    if (type) {
      paramCount++;
      whereClause += ` AND transaction_type = $${paramCount}`;
      params.push(type);
    }

    if (search) {
      paramCount++;
      whereClause += ` AND (description ILIKE ${paramCount} OR merchant ILIKE ${paramCount})`;
      params.push(`%${search}%`);
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM transactions ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // Get transactions
    const allowedSortFields = ['transaction_date', 'amount', 'category', 'created_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'transaction_date';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    params.push(limit, offset);
    const result = await query(
      `SELECT id, transaction_date, description, amount, category, transaction_type,
              payment_method, merchant, notes, tags, is_recurring, created_at
       FROM transactions
       ${whereClause}
       ORDER BY ${sortField} ${order}
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      params
    );

    res.json({
      transactions: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Get single transaction
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await query(
      `SELECT * FROM transactions WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

// Create single transaction
router.post('/', 
  checkFeatureLimit('transactions'),
  [
    body('transactionDate').isISO8601().withMessage('Valid date required'),
    body('description').trim().notEmpty().withMessage('Description required'),
    body('amount').isNumeric().withMessage('Valid amount required'),
    body('category').trim().notEmpty().withMessage('Category required'),
    body('transactionType').isIn(['income', 'expense']).withMessage('Type must be income or expense')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.id;
      const {
        transactionDate,
        description,
        amount,
        category,
        transactionType,
        paymentMethod,
        merchant,
        notes,
        tags,
        isRecurring,
        recurringFrequency
      } = req.body;

      const result = await query(
        `INSERT INTO transactions 
         (user_id, transaction_date, description, amount, category, transaction_type,
          payment_method, merchant, notes, tags, is_recurring, recurring_frequency)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [userId, transactionDate, description, amount, category, transactionType,
         paymentMethod || null, merchant || null, notes || null, tags || null,
         isRecurring || false, recurringFrequency || null]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Create transaction error:', error);
      res.status(500).json({ error: 'Failed to create transaction' });
    }
  }
);

// Bulk import transactions
router.post('/bulk-import', checkFeatureLimit('transactions'), async (req, res) => {
  const client = await getClient();
  
  try {
    const userId = req.user.id;
    const { transactions, sourceFile } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'Transactions array required' });
    }

    await client.query('BEGIN');

    const insertedTransactions = [];
    let duplicateCount = 0;

    for (const txn of transactions) {
      // Check for duplicate (same date, amount, description)
      const duplicateCheck = await client.query(
        `SELECT id FROM transactions 
         WHERE user_id = $1 AND transaction_date = $2 AND amount = $3 AND description = $4`,
        [userId, txn.transactionDate, txn.amount, txn.description]
      );

      if (duplicateCheck.rows.length > 0) {
        duplicateCount++;
        continue;
      }

      const result = await client.query(
        `INSERT INTO transactions 
         (user_id, transaction_date, description, amount, category, transaction_type,
          payment_method, merchant, source_file, imported_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
         RETURNING id, transaction_date, description, amount, category`,
        [
          userId,
          txn.transactionDate,
          txn.description,
          txn.amount,
          txn.category,
          txn.transactionType,
          txn.paymentMethod || null,
          txn.merchant || null,
          sourceFile || null
        ]
      );

      insertedTransactions.push(result.rows[0]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      imported: insertedTransactions.length,
      duplicates: duplicateCount,
      total: transactions.length,
      transactions: insertedTransactions
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Bulk import error:', error);
    res.status(500).json({ error: 'Failed to import transactions' });
  } finally {
    client.release();
  }
});

// Update transaction
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      transactionDate,
      description,
      amount,
      category,
      transactionType,
      paymentMethod,
      merchant,
      notes,
      tags
    } = req.body;

    const result = await query(
      `UPDATE transactions
       SET transaction_date = COALESCE($1, transaction_date),
           description = COALESCE($2, description),
           amount = COALESCE($3, amount),
           category = COALESCE($4, category),
           transaction_type = COALESCE($5, transaction_type),
           payment_method = COALESCE($6, payment_method),
           merchant = COALESCE($7, merchant),
           notes = COALESCE($8, notes),
           tags = COALESCE($9, tags)
       WHERE id = $10 AND user_id = $11
       RETURNING *`,
      [transactionDate, description, amount, category, transactionType,
       paymentMethod, merchant, notes, tags, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// Delete transaction
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await query(
      'DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// Bulk delete transactions
router.post('/bulk-delete', async (req, res) => {
  try {
    const userId = req.user.id;
    const { transactionIds } = req.body;

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.status(400).json({ error: 'Transaction IDs array required' });
    }

    const result = await query(
      'DELETE FROM transactions WHERE user_id = $1 AND id = ANY($2) RETURNING id',
      [userId, transactionIds]
    );

    res.json({
      deleted: result.rows.length,
      message: `${result.rows.length} transactions deleted`
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to delete transactions' });
  }
});

// Get unique categories for user
router.get('/meta/categories', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT DISTINCT category, transaction_type 
       FROM transactions 
       WHERE user_id = $1 
       ORDER BY category`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

module.exports = router;