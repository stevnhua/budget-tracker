// routes/user.js - User Account Management Routes
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

router.use(authenticateToken);

// Get user profile
router.get('/profile', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT id, email, first_name, last_name, phone, currency, timezone,
              subscription_tier, subscription_status, subscription_ends_at,
              email_verified, created_at, last_login
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', 
  [
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('phone').optional().trim(),
    body('currency').optional().isLength({ min: 3, max: 3 }),
    body('timezone').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.id;
      const { firstName, lastName, phone, currency, timezone } = req.body;

      const result = await query(
        `UPDATE users
         SET first_name = COALESCE($1, first_name),
             last_name = COALESCE($2, last_name),
             phone = COALESCE($3, phone),
             currency = COALESCE($4, currency),
             timezone = COALESCE($5, timezone)
         WHERE id = $6
         RETURNING id, email, first_name, last_name, phone, currency, timezone`,
        [firstName, lastName, phone, currency, timezone, userId]
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

// Change password
router.put('/password',
  [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      // Get current password hash
      const userResult = await query(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);

      if (!isValid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [newPasswordHash, userId]
      );

      // Log password change
      await query(
        `INSERT INTO audit_log (user_id, action)
         VALUES ($1, $2)`,
        [userId, 'password_changed']
      );

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }
);

// Get user statistics
router.get('/statistics', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get transaction count
    const transactionResult = await query(
      'SELECT COUNT(*) as count FROM transactions WHERE user_id = $1',
      [userId]
    );

    // Get budget count
    const budgetResult = await query(
      'SELECT COUNT(*) as count FROM budgets WHERE user_id = $1 AND is_active = TRUE',
      [userId]
    );

    // Get goal count
    const goalResult = await query(
      'SELECT COUNT(*) as count FROM goals WHERE user_id = $1 AND status = $2',
      [userId, 'active']
    );

    // Get date range of transactions
    const dateRangeResult = await query(
      `SELECT MIN(transaction_date) as first_transaction, 
              MAX(transaction_date) as last_transaction
       FROM transactions WHERE user_id = $1`,
      [userId]
    );

    res.json({
      transactionCount: parseInt(transactionResult.rows[0].count),
      activeBudgets: parseInt(budgetResult.rows[0].count),
      activeGoals: parseInt(goalResult.rows[0].count),
      firstTransaction: dateRangeResult.rows[0].first_transaction,
      lastTransaction: dateRangeResult.rows[0].last_transaction
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get subscription info
router.get('/subscription', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT u.subscription_tier, u.subscription_status, u.subscription_ends_at,
              sp.display_name, sp.price_monthly, sp.price_yearly, sp.features
       FROM users u
       JOIN subscription_plans sp ON u.subscription_tier = sp.name
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Upgrade subscription (placeholder - integrate with payment processor)
router.post('/subscription/upgrade',
  [body('plan').isIn(['premium', 'enterprise']).withMessage('Invalid plan')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.id;
      const { plan } = req.body;

      // TODO: Integrate with Stripe/payment processor
      // For now, just update the subscription tier

      await query(
        `UPDATE users
         SET subscription_tier = $1,
             subscription_status = 'active',
             subscription_ends_at = CURRENT_TIMESTAMP + INTERVAL '1 month'
         WHERE id = $2`,
        [plan, userId]
      );

      // Log subscription upgrade
      await query(
        `INSERT INTO audit_log (user_id, action, metadata)
         VALUES ($1, $2, $3)`,
        [userId, 'subscription_upgraded', JSON.stringify({ new_plan: plan })]
      );

      res.json({ 
        message: 'Subscription upgraded successfully',
        plan
      });
    } catch (error) {
      console.error('Upgrade subscription error:', error);
      res.status(500).json({ error: 'Failed to upgrade subscription' });
    }
  }
);

// Delete account
router.delete('/account', 
  [body('password').notEmpty().withMessage('Password required for account deletion')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.id;
      const { password } = req.body;

      // Verify password
      const userResult = await query(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const isValid = await bcrypt.compare(password, userResult.rows[0].password_hash);

      if (!isValid) {
        return res.status(401).json({ error: 'Incorrect password' });
      }

      // Soft delete (mark as deleted)
      await query(
        'UPDATE users SET deleted_at = CURRENT_TIMESTAMP, is_active = FALSE WHERE id = $1',
        [userId]
      );

      // Revoke all refresh tokens
      await query(
        'UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1',
        [userId]
      );

      // Log account deletion
      await query(
        `INSERT INTO audit_log (user_id, action)
         VALUES ($1, $2)`,
        [userId, 'account_deleted']
      );

      res.json({ message: 'Account deleted successfully' });
    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({ error: 'Failed to delete account' });
    }
  }
);

// Get activity log
router.get('/activity', async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT action, ip_address, user_agent, metadata, created_at
       FROM audit_log
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) FROM audit_log WHERE user_id = $1',
      [userId]
    );

    res.json({
      activities: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

module.exports = router;