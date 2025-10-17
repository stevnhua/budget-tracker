import React, { useState, useEffect } from 'react';
import { Upload, DollarSign, TrendingUp, TrendingDown, PieChart, Calendar, Download, Settings, LogOut, User, Plus, Trash2, Filter, X, Eye, EyeOff, Menu, Home, BarChart3, Target, CreditCard, Search, Edit2, Check, Sparkles, ArrowUpRight, ArrowDownRight, FileText, Bell, ChevronRight, Tag, Store } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import Papa from 'papaparse';

const API_BASE_URL = 'http://localhost:5000/api';

const BudgetTracker = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [authView, setAuthView] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [categories, setCategories] = useState({});
  const [kpis, setKpis] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netSavings: 0,
    avgTransaction: 0,
    savingsRate: 0,
    transactionCount: 0
  });
  const [insights, setInsights] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showQuickCategorize, setShowQuickCategorize] = useState(false);
  const [merchantGroups, setMerchantGroups] = useState([]);
  
  const getCurrentMonthRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: firstDay.toISOString().split('T')[0],
      end: lastDay.toISOString().split('T')[0]
    };
  };

  const [dateRange, setDateRange] = useState(getCurrentMonthRange());
  const [viewMode, setViewMode] = useState('month');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  const COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#06b6d4', '#10b981', '#f97316'];
  
  const CATEGORY_OPTIONS = [
    'Food & Dining',
    'Groceries',
    'Transportation',
    'Gas & Fuel',
    'Housing & Rent',
    'Utilities',
    'Entertainment',
    'Shopping',
    'Healthcare',
    'Insurance',
    'Travel',
    'Education',
    'Personal Care',
    'Subscriptions',
    'Other'
  ];

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      fetchUserProfile();
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboardData();
    }
  }, [isAuthenticated, dateRange]);

  const apiCall = async (endpoint, method = 'GET', body = null) => {
    const token = localStorage.getItem('accessToken');
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

    if (response.status === 401) {
      const refreshed = await refreshToken();
      if (refreshed) {
        return apiCall(endpoint, method, body);
      } else {
        handleLogout();
        return null;
      }
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Request failed');
    }

    return response.json();
  };

  const refreshToken = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) return false;

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const formData = new FormData(e.target);
      const data = await apiCall('/auth/login', 'POST', {
        email: formData.get('email'),
        password: formData.get('password')
      });

      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      setUser(data.user);
      setIsAuthenticated(true);
      showNotification('Welcome back!', 'success');
    } catch (error) {
      showNotification(error.message, 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const formData = new FormData(e.target);
      const data = await apiCall('/auth/register', 'POST', {
        email: formData.get('email'),
        password: formData.get('password'),
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName')
      });

      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      setUser(data.user);
      setIsAuthenticated(true);
      showNotification('Account created successfully!', 'success');
    } catch (error) {
      showNotification(error.message, 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await apiCall('/auth/logout', 'POST', { refreshToken });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setIsAuthenticated(false);
      setUser(null);
      setTransactions([]);
      showNotification('Logged out successfully', 'success');
    }
  };

  const fetchUserProfile = async () => {
    try {
      const data = await apiCall('/user/profile');
      setUser(data);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Profile fetch error:', error);
      handleLogout();
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);

      const [transactionsData, kpisData, insightsData] = await Promise.all([
        apiCall(`/transactions?limit=1000&${params.toString()}`),
        apiCall(`/analytics/kpis?${params.toString()}`),
        apiCall('/analytics/insights')
      ]);

      // Filter out payments and returns - we only care about actual spending
      const spendingTransactions = transactionsData.transactions.filter(t => 
        t.transaction_type !== 'payment' && t.category !== 'Return/Refund'
      );

      setTransactions(spendingTransactions);
      setFilteredTransactions(spendingTransactions);
      setKpis(kpisData.kpis);
      setMonthlyData(kpisData.monthlyTrend);
      setInsights(insightsData);

      // Group by category for spending breakdown
      const catGroups = {};
      spendingTransactions.forEach(t => {
        if (!catGroups[t.category]) {
          catGroups[t.category] = 0;
        }
        catGroups[t.category] += Math.abs(t.amount);
      });
      setCategories(catGroups);

      // Group uncategorized transactions by merchant for quick categorization
      groupTransactionsByMerchant(spendingTransactions);
    } catch (error) {
      showNotification('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const groupTransactionsByMerchant = (txns) => {
    const uncategorized = txns.filter(t => t.category === 'Other' || !t.category);
    
    // Group by merchant/description
    const groups = {};
    uncategorized.forEach(t => {
      const key = t.merchant || extractMerchantFromDescription(t.description);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(t);
    });

    // Convert to array and sort by count
    const groupArray = Object.entries(groups)
      .map(([merchant, txns]) => ({
        merchant,
        transactions: txns,
        count: txns.length,
        totalAmount: txns.reduce((sum, t) => sum + Math.abs(t.amount), 0)
      }))
      .sort((a, b) => b.count - a.count);

    setMerchantGroups(groupArray);
  };

  const extractMerchantFromDescription = (description) => {
    // Extract merchant name from transaction description
    // Remove common prefixes and dates
    let merchant = description.toUpperCase();
    merchant = merchant.replace(/\d{2}\/\d{2}\/\d{4}/g, '');
    merchant = merchant.replace(/\d{2}-\d{2}-\d{4}/g, '');
    merchant = merchant.replace(/PURCHASE|PAYMENT|DEBIT|CREDIT/gi, '');
    merchant = merchant.trim();
    
    // Take first significant part
    const parts = merchant.split(/\s+/);
    return parts.slice(0, 3).join(' ').substring(0, 50);
  };

  const categorizeMerchantTransactions = async (merchant, category) => {
    const group = merchantGroups.find(g => g.merchant === merchant);
    if (!group) return;

    try {
      setLoading(true);
      
      // Update all transactions from this merchant
      await Promise.all(
        group.transactions.map(t => 
          apiCall(`/transactions/${t.id}`, 'PUT', { category })
        )
      );
      
      showNotification(`Categorized ${group.count} transactions from ${merchant}`, 'success');
      loadDashboardData();
    } catch (error) {
      showNotification('Failed to update categories', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const normalizedData = normalizeTransactions(results.data, file.name);
        
        try {
          setLoading(true);
          const data = await apiCall('/transactions/bulk-import', 'POST', {
            transactions: normalizedData,
            sourceFile: file.name
          });
          
          showNotification(`Imported ${data.imported} transactions (${data.duplicates} duplicates skipped)`, 'success');
          loadDashboardData();
        } catch (error) {
          showNotification('Import failed: ' + error.message, 'error');
        } finally {
          setLoading(false);
        }
      },
      error: (error) => {
        showNotification('Error parsing CSV: ' + error.message, 'error');
      }
    });
  };

  const normalizeTransactions = (data) => {
    return data.map((row) => {
      const cleanRow = {};
      Object.keys(row).forEach(key => {
        cleanRow[key.trim()] = row[key];
      });

      const date = cleanRow.Date || cleanRow.date || cleanRow['Transaction Date'] || 
                   cleanRow['Trans. Date'] || cleanRow.Timestamp || new Date().toISOString().split('T')[0];
      
      const description = cleanRow.Description || cleanRow.description || 
                         cleanRow.Merchant || cleanRow.merchant || 
                         cleanRow.Name || cleanRow.Memo || 'Unknown';
      
      let amount = parseFloat(
        cleanRow.Amount || cleanRow.amount || 
        cleanRow.Debit || cleanRow.Credit || 
        cleanRow.Value || cleanRow.Total || 0
      );

      // Credit card logic: positive = expense, negative = payment/return
      let transactionType = 'expense';
      if (amount < 0) {
        transactionType = 'payment'; // Skip this in the app
        amount = Math.abs(amount);
      }

      const category = cleanRow.Category || cleanRow.category || 
                      categorizeTransaction(description, amount);

      return {
        transactionDate: date,
        description,
        amount: transactionType === 'expense' ? -Math.abs(amount) : Math.abs(amount),
        category,
        transactionType,
        merchant: cleanRow.Merchant || cleanRow.merchant || extractMerchantFromDescription(description)
      };
    });
  };

  const categorizeTransaction = (description, amount) => {
    const desc = description.toLowerCase();
    
    // Food & Dining
    if (desc.includes('restaurant') || desc.includes('cafe') || desc.includes('coffee') || 
        desc.includes('mcdonald') || desc.includes('starbucks') || desc.includes('pizza') ||
        desc.includes('burger') || desc.includes('doordash') || desc.includes('uber eats') ||
        desc.includes('skip the dishes') || desc.includes('tim hortons') || desc.includes('subway')) 
        return 'Food & Dining';
    
    // Groceries
    if (desc.includes('grocery') || desc.includes('supermarket') || desc.includes('walmart') ||
        desc.includes('costco') || desc.includes('safeway') || desc.includes('loblaws') ||
        desc.includes('metro') || desc.includes('sobeys') || desc.includes('food basics') ||
        desc.includes('no frills') || desc.includes('freshco')) 
        return 'Groceries';
    
    // Gas & Fuel
    if (desc.includes('gas') || desc.includes('petro') || desc.includes('shell') ||
        desc.includes('esso') || desc.includes('chevron') || desc.includes('fuel') ||
        desc.includes('husky') || desc.includes('pioneer')) 
        return 'Gas & Fuel';
    
    // Transportation
    if (desc.includes('transport') || desc.includes('uber') || desc.includes('lyft') ||
        desc.includes('taxi') || desc.includes('transit') || desc.includes('parking') ||
        desc.includes('presto') || desc.includes('ttc') || desc.includes('go train')) 
        return 'Transportation';
    
    // Housing & Utilities
    if (desc.includes('rent') || desc.includes('mortgage') || desc.includes('landlord')) 
        return 'Housing & Rent';
    if (desc.includes('electric') || desc.includes('hydro') || desc.includes('water') ||
        desc.includes('internet') || desc.includes('phone') || desc.includes('rogers') ||
        desc.includes('bell') || desc.includes('telus') || desc.includes('fido')) 
        return 'Utilities';
    
    // Entertainment & Subscriptions
    if (desc.includes('netflix') || desc.includes('spotify') || desc.includes('amazon prime') ||
        desc.includes('disney') || desc.includes('subscription') || desc.includes('apple.com')) 
        return 'Subscriptions';
    if (desc.includes('movie') || desc.includes('cinema') || desc.includes('theatre') ||
        desc.includes('game') || desc.includes('entertainment') || desc.includes('concert')) 
        return 'Entertainment';
    
    // Healthcare
    if (desc.includes('pharmacy') || desc.includes('medical') || desc.includes('doctor') ||
        desc.includes('dental') || desc.includes('health') || desc.includes('shoppers drug') ||
        desc.includes('rexall')) 
        return 'Healthcare';
    
    // Shopping
    if (desc.includes('amazon') || desc.includes('store') || desc.includes('shop') ||
        desc.includes('mall') || desc.includes('retail') || desc.includes('best buy') ||
        desc.includes('canadian tire') || desc.includes('home depot')) 
        return 'Shopping';
    
    // Insurance
    if (desc.includes('insurance')) 
        return 'Insurance';
    
    // Travel
    if (desc.includes('airline') || desc.includes('hotel') || desc.includes('airbnb') ||
        desc.includes('travel') || desc.includes('booking') || desc.includes('flight')) 
        return 'Travel';
    
    return 'Other';
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const amount = parseFloat(formData.get('amount'));
    
    try {
      setLoading(true);
      await apiCall('/transactions', 'POST', {
        transactionDate: formData.get('date'),
        description: formData.get('description'),
        amount: -Math.abs(amount), // Always negative for expenses
        category: formData.get('category'),
        transactionType: 'expense',
        notes: formData.get('notes') || null
      });
      
      showNotification('Transaction added successfully', 'success');
      setShowAddTransaction(false);
      e.target.reset();
      loadDashboardData();
    } catch (error) {
      showNotification('Failed to add transaction', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTransaction = async (id, updates) => {
    try {
      setLoading(true);
      await apiCall(`/transactions/${id}`, 'PUT', updates);
      showNotification('Transaction updated', 'success');
      setEditingTransaction(null);
      loadDashboardData();
    } catch (error) {
      showNotification('Failed to update transaction', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    
    try {
      setLoading(true);
      await apiCall(`/transactions/${id}`, 'DELETE');
      showNotification('Transaction deleted', 'success');
      loadDashboardData();
    } catch (error) {
      showNotification('Failed to delete transaction', 'error');
    } finally {
      setLoading(false);
    }
  };

  const changeViewMode = (mode) => {
    setViewMode(mode);
    const now = new Date();
    
    if (mode === 'month') {
      setDateRange(getCurrentMonthRange());
    } else if (mode === 'year') {
      const firstDay = new Date(now.getFullYear(), 0, 1);
      const lastDay = new Date(now.getFullYear(), 11, 31);
      setDateRange({
        start: firstDay.toISOString().split('T')[0],
        end: lastDay.toISOString().split('T')[0]
      });
    } else {
      setDateRange({ start: '', end: '' });
    }
  };

  useEffect(() => {
    let filtered = [...transactions];

    if (dateRange.start) {
      filtered = filtered.filter(t => t.transaction_date >= dateRange.start);
    }
    if (dateRange.end) {
      filtered = filtered.filter(t => t.transaction_date <= dateRange.end);
    }
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }
    if (searchTerm) {
      filtered = filtered.filter(t => 
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.merchant && t.merchant.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredTransactions(filtered);
  }, [transactions, dateRange, selectedCategory, searchTerm]);

  const showNotification = (message, type) => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 4000);
  };

  const getCategoryData = () => {
    return Object.entries(categories)
      .map(([name, value]) => ({
        name,
        value: Math.abs(value)
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  };

  const getUncategorizedCount = () => {
    return transactions.filter(t => t.category === 'Other' || !t.category).length;
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white rounded-full mix-blend-overlay filter blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white rounded-full mix-blend-overlay filter blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md p-10 relative z-10 border border-white/20">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-lg">
              <DollarSign size={40} className="text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Budget Tracker</h1>
            <p className="text-gray-600 mt-2 text-lg">Smart budgeting for Canadians</p>
          </div>

          {authView === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full px-5 py-3.5 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-500 focus:bg-white transition-all duration-200 outline-none"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    required
                    className="w-full px-5 py-3.5 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-500 focus:bg-white transition-all duration-200 outline-none pr-12"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {authLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Logging in...
                  </span>
                ) : 'Log In'}
              </button>
              <p className="text-center mt-6 text-gray-600">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => setAuthView('register')}
                  className="text-indigo-600 font-semibold hover:text-indigo-700 transition-colors"
                >
                  Sign up
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    required
                    className="w-full px-5 py-3.5 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-500 focus:bg-white transition-all duration-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    required
                    className="w-full px-5 py-3.5 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-500 focus:bg-white transition-all duration-200 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full px-5 py-3.5 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-500 focus:bg-white transition-all duration-200 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={8}
                  className="w-full px-5 py-3.5 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-500 focus:bg-white transition-all duration-200 outline-none"
                  placeholder="Min. 8 characters"
                />
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
              >
                {authLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating account...
                  </span>
                ) : 'Create Account'}
              </button>
              <p className="text-center mt-6 text-gray-600">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setAuthView('login')}
                  className="text-indigo-600 font-semibold hover:text-indigo-700 transition-colors"
                >
                  Log in
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {notification.show && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-2xl ${
          notification.type === 'success' 
            ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
            : 'bg-gradient-to-r from-red-500 to-rose-600'
        } text-white font-semibold flex items-center gap-3`} style={{ animation: 'slideIn 0.3s ease-out' }}>
          {notification.type === 'success' ? <Check size={20} /> : <X size={20} />}
          {notification.message}
        </div>
      )}

      <header className="bg-white/80 backdrop-blur-xl shadow-sm sticky top-0 z-40 border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="lg:hidden p-2.5 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <Menu size={24} />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <DollarSign size={28} className="text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Budget Tracker</h1>
                  <p className="text-xs text-gray-500">Financial Dashboard</p>
                </div>
              </div>
            </div>
            
            <div className="hidden md:flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => changeViewMode('month')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  viewMode === 'month' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => changeViewMode('year')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  viewMode === 'year' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                This Year
              </button>
              <button
                onClick={() => changeViewMode('all')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  viewMode === 'all' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All Time
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <User size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{user?.first_name} {user?.last_name}</p>
                  <p className="text-xs text-indigo-600 font-medium">{user?.subscription_tier?.toUpperCase()}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-xl transition-all duration-200 hover:scale-105"
              >
                <LogOut size={18} />
                <span className="hidden sm:inline font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex max-w-7xl mx-auto">
        <aside className={`${showMobileMenu ? 'block' : 'hidden'} lg:block w-72 bg-white/80 backdrop-blur-xl min-h-screen border-r border-gray-200/50`}>
          <nav className="p-6 space-y-2">
            <button
              onClick={() => { setCurrentView('dashboard'); setShowMobileMenu(false); }}
              className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-xl transition-all duration-200 ${
                currentView === 'dashboard' 
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg scale-105' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Home size={22} />
              <span className="font-semibold">Dashboard</span>
              {currentView === 'dashboard' && <ChevronRight size={18} className="ml-auto" />}
            </button>
            <button
              onClick={() => { setCurrentView('transactions'); setShowMobileMenu(false); }}
              className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-xl transition-all duration-200 ${
                currentView === 'transactions' 
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg scale-105' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <CreditCard size={22} />
              <span className="font-semibold">Transactions</span>
              {currentView === 'transactions' && <ChevronRight size={18} className="ml-auto" />}
            </button>
            <button
              onClick={() => { setCurrentView('analytics'); setShowMobileMenu(false); }}
              className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-xl transition-all duration-200 ${
                currentView === 'analytics' 
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg scale-105' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <BarChart3 size={22} />
              <span className="font-semibold">Analytics</span>
              {currentView === 'analytics' && <ChevronRight size={18} className="ml-auto" />}
            </button>
          </nav>

          <div className="p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Quick Stats</h3>
            <div className="space-y-3">
              <div className="p-4 bg-gradient-to-br from-red-50 to-rose-50 rounded-xl border border-red-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-red-700 font-medium">Total Spent</span>
                  <TrendingDown size={16} className="text-red-600" />
                </div>
                <p className="text-2xl font-bold text-red-700">${kpis.totalExpenses.toFixed(0)}</p>
                <p className="text-xs text-red-600 mt-1">{viewMode === 'month' ? 'This month' : viewMode === 'year' ? 'This year' : 'All time'}</p>
              </div>
              
              {getUncategorizedCount() > 0 && (
                <div className="p-4 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border border-yellow-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-yellow-800 font-medium">Needs Category</span>
                    <Tag size={16} className="text-yellow-600" />
                  </div>
                  <p className="text-2xl font-bold text-yellow-800">{getUncategorizedCount()}</p>
                  <button
                    onClick={() => setShowQuickCategorize(true)}
                    className="mt-2 w-full text-xs bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <Store size={14} />
                    Quick Categorize
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className="flex-1 p-6 lg:p-8">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600 font-medium">Loading your data...</p>
            </div>
          )}

          {!loading && currentView === 'dashboard' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h2>
                <p className="text-gray-600">
                  Viewing spending for: <span className="font-semibold">{
                    viewMode === 'month' ? `${new Date(dateRange.start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` :
                    viewMode === 'year' ? `${new Date(dateRange.start).getFullYear()}` :
                    'All Time'
                  }</span>
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-3 px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl cursor-pointer hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 font-semibold">
                  <Upload size={20} />
                  <span>Import CSV</span>
                  <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                </label>
                <button
                  onClick={() => setShowAddTransaction(true)}
                  className="flex items-center gap-3 px-6 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 font-semibold"
                >
                  <Plus size={20} />
                  <span>Add Transaction</span>
                </button>
                {getUncategorizedCount() > 0 && (
                  <button
                    onClick={() => setShowQuickCategorize(true)}
                    className="flex items-center gap-3 px-6 py-3.5 bg-gradient-to-r from-yellow-500 to-orange-600 text-white rounded-xl hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 font-semibold"
                  >
                    <Store size={20} />
                    <span>Quick Categorize ({getUncategorizedCount()})</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                        <TrendingDown size={24} />
                      </div>
                      <DollarSign size={20} className="opacity-75" />
                    </div>
                    <div className="text-4xl font-bold mb-1">${kpis.totalExpenses.toFixed(2)}</div>
                    <div className="text-red-100 font-medium">Total Spending</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                        <Calendar size={24} />
                      </div>
                      <Sparkles size={20} className="opacity-75" />
                    </div>
                    <div className="text-4xl font-bold mb-1">${(kpis.totalExpenses / (transactions.length || 1)).toFixed(2)}</div>
                    <div className="text-blue-100 font-medium">Avg per Day</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                        <Target size={24} />
                      </div>
                      <CreditCard size={20} className="opacity-75" />
                    </div>
                    <div className="text-4xl font-bold mb-1">{kpis.transactionCount}</div>
                    <div className="text-purple-100 font-medium">Transactions</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                        <PieChart size={24} />
                      </div>
                      <span className="text-2xl opacity-75">#</span>
                    </div>
                    <div className="text-4xl font-bold mb-1">{Object.keys(categories).length}</div>
                    <div className="text-teal-100 font-medium">Categories</div>
                  </div>
                </div>
              </div>

              {insights.length > 0 && (
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-gray-200/50">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="p-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg">
                      <Sparkles size={20} className="text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">AI Insights</h3>
                  </div>
                  <div className="space-y-3">
                    {insights.map((insight, idx) => (
                      <div
                        key={idx}
                        className={`p-5 rounded-xl border-l-4 transition-all duration-200 hover:scale-[1.02] ${
                          insight.type === 'success' ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-500' :
                          insight.type === 'warning' ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-500' :
                          'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-500'
                        }`}
                      >
                        <div className="font-bold text-gray-900 mb-1">{insight.title}</div>
                        <div className="text-sm text-gray-600">{insight.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-gray-200/50 hover:shadow-xl transition-shadow duration-300">
                  <h3 className="text-lg font-bold text-gray-900 mb-5">Spending Trend</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={monthlyData}>
                      <defs>
                        <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" stroke="#6b7280" style={{ fontSize: '12px' }} />
                      <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '12px',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }} 
                      />
                      <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpenses)" name="Expenses" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-gray-200/50 hover:shadow-xl transition-shadow duration-300">
                  <h3 className="text-lg font-bold text-gray-900 mb-5">Spending by Category</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPie>
                      <Pie
                        data={getCategoryData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {getCategoryData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '12px',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }} 
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-gray-200/50">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-xl font-bold text-gray-900">Recent Transactions</h3>
                  <button
                    onClick={() => setCurrentView('transactions')}
                    className="text-indigo-600 hover:text-indigo-700 text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all"
                  >
                    View All 
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div className="space-y-2">
                  {filteredTransactions.slice(0, 5).map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-all duration-200 hover:scale-[1.01] border border-transparent hover:border-gray-200">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-red-100 to-rose-100">
                          <ArrowDownRight size={20} className="text-red-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">{t.description}</div>
                          <div className="text-sm text-gray-500 flex items-center gap-2">
                            <Calendar size={14} />
                            {t.transaction_date} • {t.category}
                          </div>
                        </div>
                      </div>
                      <div className="text-xl font-bold text-red-600">
                        ${Math.abs(t.amount).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!loading && currentView === 'transactions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-gray-900">Transactions</h2>
                <button
                  onClick={() => setShowAddTransaction(true)}
                  className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200 font-semibold"
                >
                  <Plus size={20} />
                  Add Transaction
                </button>
              </div>

              <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-gray-200/50">
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Filter size={20} className="text-indigo-600" />
                  </div>
                  <h3 className="font-bold text-gray-900">Filters</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Search</label>
                    <div className="relative">
                      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search transactions..."
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-500 focus:bg-white transition-all outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-500 focus:bg-white transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">End Date</label>
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-500 focus:bg-white transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-500 focus:bg-white transition-all outline-none"
                    >
                      <option value="all">All Categories</option>
                      {CATEGORY_OPTIONS.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {(dateRange.start || dateRange.end || selectedCategory !== 'all' || searchTerm) && (
                  <button
                    onClick={() => {
                      setDateRange(getCurrentMonthRange());
                      setSelectedCategory('all');
                      setSearchTerm('');
                    }}
                    className="mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-2 hover:gap-3 transition-all"
                  >
                    <X size={16} />
                    Clear Filters
                  </button>
                )}
              </div>

              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg overflow-hidden border border-gray-200/50">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                      <tr>
                        <th className="text-left py-5 px-6 text-sm font-bold text-gray-700 uppercase tracking-wider">Date</th>
                        <th className="text-left py-5 px-6 text-sm font-bold text-gray-700 uppercase tracking-wider">Description</th>
                        <th className="text-left py-5 px-6 text-sm font-bold text-gray-700 uppercase tracking-wider">Category</th>
                        <th className="text-right py-5 px-6 text-sm font-bold text-gray-700 uppercase tracking-wider">Amount</th>
                        <th className="text-center py-5 px-6 text-sm font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center py-16">
                            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                            <p className="text-gray-500 font-medium">No transactions found</p>
                            <p className="text-sm text-gray-400 mt-1">Upload a CSV or add transactions manually</p>
                          </td>
                        </tr>
                      ) : (
                        filteredTransactions.map((t) => (
                          <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                            {editingTransaction?.id === t.id ? (
                              <>
                                <td className="py-4 px-6">
                                  <input
                                    type="date"
                                    defaultValue={t.transaction_date}
                                    className="px-3 py-2 border-2 border-gray-300 rounded-xl focus:border-indigo-500 outline-none"
                                    onChange={(e) => setEditingTransaction({...editingTransaction, transaction_date: e.target.value})}
                                  />
                                </td>
                                <td className="py-4 px-6">
                                  <input
                                    type="text"
                                    defaultValue={t.description}
                                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:border-indigo-500 outline-none"
                                    onChange={(e) => setEditingTransaction({...editingTransaction, description: e.target.value})}
                                  />
                                </td>
                                <td className="py-4 px-6">
                                  <select
                                    defaultValue={t.category}
                                    className="px-3 py-2 border-2 border-gray-300 rounded-xl focus:border-indigo-500 outline-none"
                                    onChange={(e) => setEditingTransaction({...editingTransaction, category: e.target.value})}
                                  >
                                    {CATEGORY_OPTIONS.map(cat => (
                                      <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-4 px-6 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    defaultValue={Math.abs(t.amount)}
                                    className="w-32 px-3 py-2 border-2 border-gray-300 rounded-xl text-right focus:border-indigo-500 outline-none"
                                    onChange={(e) => setEditingTransaction({...editingTransaction, amount: -Math.abs(parseFloat(e.target.value))})}
                                  />
                                </td>
                                <td className="py-4 px-6">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => handleUpdateTransaction(t.id, editingTransaction)}
                                      className="p-2.5 text-white bg-green-500 hover:bg-green-600 rounded-xl transition-all hover:scale-110"
                                    >
                                      <Check size={18} />
                                    </button>
                                    <button
                                      onClick={() => setEditingTransaction(null)}
                                      className="p-2.5 text-gray-600 hover:bg-gray-200 rounded-xl transition-all hover:scale-110"
                                    >
                                      <X size={18} />
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-4 px-6">
                                  <div className="flex items-center gap-2 text-gray-700 font-medium">
                                    <Calendar size={16} className="text-gray-400" />
                                    {t.transaction_date}
                                  </div>
                                </td>
                                <td className="py-4 px-6">
                                  <div className="font-semibold text-gray-900">{t.description}</div>
                                  {t.merchant && <div className="text-sm text-gray-500 mt-1">{t.merchant}</div>}
                                </td>
                                <td className="py-4 px-6">
                                  <span className={`px-4 py-2 rounded-xl text-sm font-semibold border ${
                                    t.category === 'Other' || !t.category
                                      ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                      : 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border-indigo-100'
                                  }`}>
                                    {t.category || 'Uncategorized'}
                                  </span>
                                </td>
                                <td className="py-4 px-6 text-right text-lg font-bold text-red-600">
                                  ${Math.abs(t.amount).toFixed(2)}
                                </td>
                                <td className="py-4 px-6">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => setEditingTransaction(t)}
                                      className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all hover:scale-110"
                                    >
                                      <Edit2 size={18} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTransaction(t.id)}
                                      className="p-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-all hover:scale-110"
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {!loading && currentView === 'analytics' && (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-gray-900">Analytics & Insights</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300">
                  <div className="text-sm font-medium mb-2 opacity-90">Total Transactions</div>
                  <div className="text-4xl font-bold mb-2">{kpis.transactionCount}</div>
                  <div className="text-sm opacity-75">{viewMode === 'month' ? 'This month' : viewMode === 'year' ? 'This year' : 'All time'}</div>
                </div>
                <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300">
                  <div className="text-sm font-medium mb-2 opacity-90">Average Purchase</div>
                  <div className="text-4xl font-bold mb-2">${kpis.avgTransaction.toFixed(2)}</div>
                  <div className="text-sm opacity-75">Per transaction</div>
                </div>
                <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300">
                  <div className="text-sm font-medium mb-2 opacity-90">Active Categories</div>
                  <div className="text-4xl font-bold mb-2">{Object.keys(categories).length}</div>
                  <div className="text-sm opacity-75">Categories used</div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-gray-200/50">
                <h3 className="text-xl font-bold text-gray-900 mb-5">Spending Breakdown</h3>
                <div className="space-y-4">
                  {Object.entries(categories)
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, amount], index) => {
                      const percentage = (amount / Object.values(categories).reduce((a, b) => a + b, 0)) * 100;
                      return (
                        <div key={category} className="group hover:scale-[1.02] transition-all duration-200">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              ></div>
                              <span className="font-semibold text-gray-900">{category}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-sm text-gray-500 font-medium">{percentage.toFixed(1)}%</span>
                              <span className="font-bold text-gray-900">${Math.abs(amount).toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div
                              className="h-3 rounded-full transition-all duration-500 group-hover:opacity-80"
                              style={{ 
                                width: `${percentage}%`,
                                backgroundColor: COLORS[index % COLORS.length]
                              }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-gray-200/50">
                <h3 className="text-xl font-bold text-gray-900 mb-5">Spending Over Time</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={monthlyData}>
                    <defs>
                      <linearGradient id="barExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8}/>
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0.4}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" stroke="#6b7280" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                      }} 
                    />
                    <Legend />
                    <Bar dataKey="expenses" fill="url(#barExpenses)" name="Expenses" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </main>
      </div>

      {showAddTransaction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl" style={{ animation: 'slideUp 0.3s ease-out' }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                  <Plus size={24} className="text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Add Transaction</h3>
              </div>
              <button
                onClick={() => setShowAddTransaction(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-all duration-200"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddTransaction} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  name="date"
                  required
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-500 focus:bg-white transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <input
                  type="text"
                  name="description"
                  required
                  placeholder="e.g., Grocery shopping at Loblaws"
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-500 focus:bg-white transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Amount (CAD)</label>
                <div className="relative">
                  <DollarSign size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    name="amount"
                    step="0.01"
                    required
                    placeholder="0.00"
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-500 focus:bg-white transition-all outline-none"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">Enter the expense amount (always positive)</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                <select
                  name="category"
                  required
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-500 focus:bg-white transition-all outline-none"
                >
                  <option value="">Select a category</option>
                  {CATEGORY_OPTIONS.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Notes (optional)</label>
                <textarea
                  name="notes"
                  rows="3"
                  placeholder="Add any additional details..."
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-500 focus:bg-white transition-all outline-none resize-none"
                ></textarea>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddTransaction(false)}
                  className="flex-1 px-5 py-3.5 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold hover:scale-105 active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-5 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold hover:scale-105 active:scale-95"
                >
                  Add Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showQuickCategorize && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl max-h-[80vh] overflow-y-auto" style={{ animation: 'slideUp 0.3s ease-out' }}>
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-white pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl">
                  <Store size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Quick Categorize</h3>
                  <p className="text-sm text-gray-600">Categorize all transactions from the same merchant at once</p>
                </div>
              </div>
              <button
                onClick={() => setShowQuickCategorize(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-all duration-200"
              >
                <X size={24} />
              </button>
            </div>
            
            {merchantGroups.length === 0 ? (
              <div className="text-center py-12">
                <Check size={48} className="mx-auto text-green-500 mb-4" />
                <p className="text-gray-600 font-medium">All transactions are categorized!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {merchantGroups.map((group, idx) => (
                  <div key={idx} className="p-5 bg-gray-50 rounded-xl border border-gray-200 hover:border-indigo-300 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Store size={20} className="text-gray-600" />
                          <h4 className="font-bold text-gray-900">{group.merchant}</h4>
                        </div>
                        <p className="text-sm text-gray-600">
                          {group.count} transaction{group.count !== 1 ? 's' : ''} • ${group.totalAmount.toFixed(2)} total
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {CATEGORY_OPTIONS.filter(cat => cat !== 'Other').map(category => (
                        <button
                          key={category}
                          onClick={() => categorizeMerchantTransactions(group.merchant, category)}
                          className="px-4 py-2 bg-white hover:bg-indigo-50 border-2 border-gray-200 hover:border-indigo-500 rounded-lg text-sm font-semibold text-gray-700 hover:text-indigo-700 transition-all hover:scale-105"
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #6366f1, #8b5cf6);
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #4f46e5, #7c3aed);
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default BudgetTracker;