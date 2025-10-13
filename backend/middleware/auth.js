// middleware/auth.js - JWT Authentication Middleware
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await query(
      'SELECT id, email, subscription_tier, is_active FROM users WHERE id = $1 AND deleted_at IS NULL',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      subscriptionTier: user.subscription_tier
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

const requireSubscription = (requiredTier) => {
  const tierHierarchy = {
    'free': 0,
    'premium': 1,
    'enterprise': 2
  };

  return async (req, res, next) => {
    const userTier = req.user.subscriptionTier;
    
    if (tierHierarchy[userTier] < tierHierarchy[requiredTier]) {
      return res.status(403).json({ 
        error: 'Subscription upgrade required',
        requiredTier,
        currentTier: userTier
      });
    }
    
    next();
  };
};

const checkFeatureLimit = (feature) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const tier = req.user.subscriptionTier;

      const planResult = await query(
        'SELECT features FROM subscription_plans WHERE name = $1',
        [tier]
      );

      if (planResult.rows.length === 0) {
        return res.status(500).json({ error: 'Invalid subscription plan' });
      }

      const limits = planResult.rows[0].features;

      if (feature === 'transactions') {
        const countResult = await query(
          'SELECT COUNT(*) as count FROM transactions WHERE user_id = $1',
          [userId]
        );
        
        const currentCount = parseInt(countResult.rows[0].count);
        const maxTransactions = limits.max_transactions;

        if (maxTransactions && currentCount >= maxTransactions) {
          return res.status(403).json({ 
            error: 'Transaction limit reached',
            limit: maxTransactions,
            current: currentCount
          });
        }
      }

      next();
    } catch (error) {
      console.error('Feature limit check error:', error);
      return res.status(500).json({ error: 'Failed to check feature limits' });
    }
  };
};

module.exports = {
  authenticateToken,
  requireSubscription,
  checkFeatureLimit
};