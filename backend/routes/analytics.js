// routes/analytics.js - Analytics and Insights Routes
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/kpis', async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    let dateFilter = '';
    const params = [userId];

    if (startDate && endDate) {
      dateFilter = 'AND transaction_date BETWEEN $2 AND $3';
      params.push(startDate, endDate);
    }

    const totalsResult = await query(
      `SELECT 
        SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN transaction_type = 'expense' THEN ABS(amount) ELSE 0 END) as total_expenses,
        COUNT(*) as transaction_count,
        AVG(ABS(amount)) as avg_transaction
       FROM transactions
       WHERE user_id = $1 ${dateFilter}`,
      params
    );

    const totals = totalsResult.rows[0];
    const netSavings = totals.total_income - totals.total_expenses;
    const savingsRate = totals.total_income > 0 ? (netSavings / totals.total_income) * 100 : 0;

    const categoriesResult = await query(
      `SELECT category, SUM(ABS(amount)) as total
       FROM transactions
       WHERE user_id = $1 AND transaction_type = 'expense' ${dateFilter}
       GROUP BY category
       ORDER BY total DESC
       LIMIT 5`,
      params
    );

    const trendResult = await query(
      `SELECT 
        DATE_TRUNC('month', transaction_date) as month,
        SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN transaction_type = 'expense' THEN ABS(amount) ELSE 0 END) as expenses
       FROM transactions
       WHERE user_id = $1 ${dateFilter}
       GROUP BY DATE_TRUNC('month', transaction_date)
       ORDER BY month DESC
       LIMIT 12`,
      params
    );

    res.json({
      kpis: {
        totalIncome: parseFloat(totals.total_income) || 0,
        totalExpenses: parseFloat(totals.total_expenses) || 0,
        netSavings: parseFloat(netSavings) || 0,
        savingsRate: parseFloat(savingsRate) || 0,
        transactionCount: parseInt(totals.transaction_count) || 0,
        avgTransaction: parseFloat(totals.avg_transaction) || 0
      },
      topCategories: categoriesResult.rows,
      monthlyTrend: trendResult.rows
    });
  } catch (error) {
    console.error('Get KPIs error:', error);
    res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
});

router.get('/spending-by-category', async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    let dateFilter = '';
    const params = [userId];

    if (startDate && endDate) {
      dateFilter = 'AND transaction_date BETWEEN $2 AND $3';
      params.push(startDate, endDate);
    }

    const result = await query(
      `SELECT 
        category,
        SUM(ABS(amount)) as total,
        COUNT(*) as count,
        AVG(ABS(amount)) as average
       FROM transactions
       WHERE user_id = $1 AND transaction_type = 'expense' ${dateFilter}
       GROUP BY category
       ORDER BY total DESC`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get spending by category error:', error);
    res.status(500).json({ error: 'Failed to fetch category data' });
  }
});

router.get('/monthly-comparison', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT 
        DATE_TRUNC('month', transaction_date) as month,
        transaction_type,
        category,
        SUM(ABS(amount)) as total
       FROM transactions
       WHERE user_id = $1
       GROUP BY DATE_TRUNC('month', transaction_date), transaction_type, category
       ORDER BY month DESC, total DESC
       LIMIT 100`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get monthly comparison error:', error);
    res.status(500).json({ error: 'Failed to fetch monthly data' });
  }
});

router.get('/trends', async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'month' } = req.query;

    const truncFunction = {
      'day': 'day',
      'week': 'week',
      'month': 'month',
      'year': 'year'
    }[period] || 'month';

    const result = await query(
      `SELECT 
        DATE_TRUNC($2, transaction_date) as period,
        SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN transaction_type = 'expense' THEN ABS(amount) ELSE 0 END) as expenses,
        COUNT(*) as transaction_count
       FROM transactions
       WHERE user_id = $1
       GROUP BY DATE_TRUNC($2, transaction_date)
       ORDER BY period DESC
       LIMIT 24`,
      [userId, truncFunction]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get trends error:', error);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

router.get('/insights', async (req, res) => {
  try {
    const userId = req.user.id;
    const insights = [];

    const avgSpendingResult = await query(
      `SELECT AVG(monthly_total) as avg_monthly_spending
       FROM (
         SELECT DATE_TRUNC('month', transaction_date) as month,
                SUM(ABS(amount)) as monthly_total
         FROM transactions
         WHERE user_id = $1 AND transaction_type = 'expense'
         GROUP BY DATE_TRUNC('month', transaction_date)
       ) monthly_totals`,
      [userId]
    );

    const currentMonthResult = await query(
      `SELECT SUM(ABS(amount)) as current_month_spending
       FROM transactions
       WHERE user_id = $1 
       AND transaction_type = 'expense'
       AND DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE)`,
      [userId]
    );

    const avgMonthly = parseFloat(avgSpendingResult.rows[0]?.avg_monthly_spending) || 0;
    const currentMonth = parseFloat(currentMonthResult.rows[0]?.current_month_spending) || 0;

    if (currentMonth > avgMonthly * 1.2) {
      insights.push({
        type: 'warning',
        title: 'Higher Than Average Spending',
        message: `You're spending ${((currentMonth / avgMonthly - 1) * 100).toFixed(0)}% more this month compared to your average.`,
        impact: 'high'
      });
    }

    const topCategoryResult = await query(
      `SELECT category, SUM(ABS(amount)) as total
       FROM transactions
       WHERE user_id = $1 AND transaction_type = 'expense'
       AND DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE)
       GROUP BY category
       ORDER BY total DESC
       LIMIT 1`,
      [userId]
    );

    if (topCategoryResult.rows.length > 0) {
      const topCategory = topCategoryResult.rows[0];
      insights.push({
        type: 'info',
        title: 'Top Spending Category',
        message: `${topCategory.category} is your largest expense this month at $${parseFloat(topCategory.total).toFixed(2)}.`,
        impact: 'medium'
      });
    }

    const savingsResult = await query(
      `SELECT 
        SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN transaction_type = 'expense' THEN ABS(amount) ELSE 0 END) as expenses
       FROM transactions
       WHERE user_id = $1
       AND DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE)`,
      [userId]
    );

    const income = parseFloat(savingsResult.rows[0]?.income) || 0;
    const expenses = parseFloat(savingsResult.rows[0]?.expenses) || 0;
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

    if (savingsRate < 10 && income > 0) {
      insights.push({
        type: 'warning',
        title: 'Low Savings Rate',
        message: `Your savings rate is ${savingsRate.toFixed(1)}%. Financial experts recommend saving at least 20% of income.`,
        impact: 'high'
      });
    } else if (savingsRate >= 20) {
      insights.push({
        type: 'success',
        title: 'Great Savings!',
        message: `You're saving ${savingsRate.toFixed(1)}% of your income. Keep up the excellent work!`,
        impact: 'positive'
      });
    }

    res.json(insights);
  } catch (error) {
    console.error('Get insights error:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

router.get('/export', async (req, res) => {
  try {
    const userId = req.user.id;
    const { format = 'json', startDate, endDate } = req.query;

    let dateFilter = '';
    const params = [userId];

    if (startDate && endDate) {
      dateFilter = 'AND transaction_date BETWEEN $2 AND $3';
      params.push(startDate, endDate);
    }

    const result = await query(
      `SELECT 
        transaction_date,
        description,
        amount,
        category,
        transaction_type,
        payment_method,
        merchant
       FROM transactions
       WHERE user_id = $1 ${dateFilter}
       ORDER BY transaction_date DESC`,
      params
    );

    if (format === 'csv') {
      const headers = Object.keys(result.rows[0] || {}).join(',');
      const rows = result.rows.map(row => Object.values(row).join(',')).join('\n');
      const csv = `${headers}\n${rows}`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
      res.send(csv);
    } else {
      res.json(result.rows);
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

module.exports = router;