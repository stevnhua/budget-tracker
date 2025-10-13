import React, { useState, useEffect } from 'react';
import { Upload, DollarSign, TrendingUp, TrendingDown, PieChart, Calendar, Download, Settings, LogOut, User, Plus, Trash2, Filter, X, Eye, EyeOff, Menu, Home, BarChart3, Target, CreditCard, Search, Edit2, Check } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Papa from 'papaparse';

const API_BASE_URL = 'http://localhost:5000/api';

const BudgetTracker = () => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [authView, setAuthView] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // App State
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

  // UI State
  const [loading, setLoading] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      fetchUserProfile();
    }
  }, []);

  // Fetch data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadDashboardData();
    }
  }, [isAuthenticated]);

  // API Helper
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
      // Token expired, try refresh
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

  // Authentication Functions
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

  // Data Loading Functions
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [transactionsData, kpisData, insightsData] = await Promise.all([
        apiCall('/transactions?limit=1000'),
        apiCall('/analytics/kpis'),
        apiCall('/analytics/insights')
      ]);

      setTransactions(transactionsData.transactions);
      setFilteredTransactions(transactionsData.transactions);
      setKpis(kpisData.kpis);
      setMonthlyData(kpisData.monthlyTrend);
      setInsights(insightsData);

      // Calculate categories
      const catGroups = {};
      transactionsData.transactions.forEach(t => {
        if (!catGroups[t.category]) {
          catGroups[t.category] = 0;
        }
        catGroups[t.category] += Math.abs(t.amount);
      });
      setCategories(catGroups);
    } catch (error) {
      showNotification('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Transaction Functions
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

  const normalizeTransactions = (data, filename) => {
    return data.map((row) => {
      const cleanRow = {};
      Object.keys(row).forEach(key => {
        cleanRow[key.trim()] = row[key];
      });

      const date = cleanRow.Date || cleanRow.date || cleanRow['Transaction Date'] || 
                   cleanRow.Timestamp || new Date().toISOString().split('T')[0];
      
      const description = cleanRow.Description || cleanRow.description || 
                         cleanRow.Merchant || cleanRow.merchant || 
                         cleanRow.Name || cleanRow.Memo || 'Unknown';
      
      let amount = parseFloat(
        cleanRow.Amount || cleanRow.amount || 
        cleanRow.Debit || cleanRow.Credit || 
        cleanRow.Value || cleanRow.Total || 0
      );

      // Handle debit/credit columns
      if (cleanRow.Debit && !cleanRow.Credit) {
        amount = -Math.abs(amount);
      } else if (cleanRow.Credit && !cleanRow.Debit) {
        amount = Math.abs(amount);
      }

      const category = cleanRow.Category || cleanRow.category || 
                      cleanRow.Type || cleanRow.type || 
                      categorizeTransaction(description, amount);

      return {
        transactionDate: date,
        description,
        amount,
        category,
        transactionType: amount >= 0 ? 'income' : 'expense',
        merchant: cleanRow.Merchant || cleanRow.merchant || null
      };
    });
  };

  const categorizeTransaction = (description, amount) => {
    const desc = description.toLowerCase();
    if (amount >= 0) return 'Income';
    if (desc.includes('grocery') || desc.includes('food') || desc.includes('restaurant')) return 'Food';
    if (desc.includes('gas') || desc.includes('transport') || desc.includes('uber')) return 'Transportation';
    if (desc.includes('rent') || desc.includes('mortgage') || desc.includes('utilities')) return 'Housing';
    if (desc.includes('entertainment') || desc.includes('netflix') || desc.includes('spotify')) return 'Entertainment';
    if (desc.includes('health') || desc.includes('medical') || desc.includes('pharmacy')) return 'Healthcare';
    if (desc.includes('shopping') || desc.includes('amazon') || desc.includes('store')) return 'Shopping';
    return 'Other';
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
      setLoading(true);
      await apiCall('/transactions', 'POST', {
        transactionDate: formData.get('date'),
        description: formData.get('description'),
        amount: parseFloat(formData.get('amount')),
        category: formData.get('category'),
        transactionType: parseFloat(formData.get('amount')) >= 0 ? 'income' : 'expense',
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

  // Filter transactions
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

  // Notification
  const showNotification = (message, type) => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
  };

  // Chart Data
  const getCategoryData = () => {
    return Object.entries(categories).map(([name, value]) => ({
      name,
      value: Math.abs(value)
    })).slice(0, 8);
  };

  // Auth View
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <DollarSign size={32} className="text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Budget Tracker</h1>
            <p className="text-gray-600 mt-2">Smart budgeting for Canadians</p>
          </div>

          {authView === 'login' ? (
            <form onSubmit={handleLogin}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {authLoading ? 'Logging in...' : 'Log In'}
                </button>
              </div>
              <p className="text-center mt-6 text-gray-600">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => setAuthView('register')}
                  className="text-blue-600 font-semibold hover:underline"
                >
                  Sign up
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <input
                    type="password"
                    name="password"
                    required
                    minLength={8}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Min. 8 characters"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {authLoading ? 'Creating account...' : 'Create Account'}
                </button>
              </div>
              <p className="text-center mt-6 text-gray-600">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setAuthView('login')}
                  className="text-blue-600 font-semibold hover:underline"
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

  // Main App View
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notification */}
      {notification.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white font-semibold animate-slide-in`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
              >
                <Menu size={24} />
              </button>
              <DollarSign size={32} className="text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">Budget Tracker</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="hidden sm:inline text-sm text-gray-600">
                {user?.first_name} {user?.last_name}
              </span>
              <span className="hidden sm:inline px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                {user?.subscription_tier?.toUpperCase()}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut size={18} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex max-w-7xl mx-auto">
        {/* Sidebar */}
        <aside className={`${showMobileMenu ? 'block' : 'hidden'} lg:block w-64 bg-white shadow-sm min-h-screen`}>
          <nav className="p-4 space-y-2">
            <button
              onClick={() => { setCurrentView('dashboard'); setShowMobileMenu(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                currentView === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Home size={20} />
              <span className="font-medium">Dashboard</span>
            </button>
            <button
              onClick={() => { setCurrentView('transactions'); setShowMobileMenu(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                currentView === 'transactions' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <CreditCard size={20} />
              <span className="font-medium">Transactions</span>
            </button>
            <button
              onClick={() => { setCurrentView('analytics'); setShowMobileMenu(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                currentView === 'analytics' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <BarChart3 size={20} />
              <span className="font-medium">Analytics</span>
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          )}

          {!loading && currentView === 'dashboard' && (
            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
                  <Upload size={20} />
                  <span className="font-semibold">Import CSV</span>
                  <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                </label>
                <button
                  onClick={() => setShowAddTransaction(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus size={20} />
                  <span className="font-semibold">Add Transaction</span>
                </button>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <TrendingUp size={24} />
                    <DollarSign size={20} className="opacity-75" />
                  </div>
                  <div className="text-3xl font-bold">${kpis.totalIncome.toFixed(2)}</div>
                  <div className="text-green-100 text-sm mt-1">Total Income</div>
                </div>

                <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <TrendingDown size={24} />
                    <DollarSign size={20} className="opacity-75" />
                  </div>
                  <div className="text-3xl font-bold">${kpis.totalExpenses.toFixed(2)}</div>
                  <div className="text-red-100 text-sm mt-1">Total Expenses</div>
                </div>

                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <PieChart size={24} />
                    <DollarSign size={20} className="opacity-75" />
                  </div>
                  <div className="text-3xl font-bold">${kpis.netSavings.toFixed(2)}</div>
                  <div className="text-blue-100 text-sm mt-1">Net Savings</div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Target size={24} />
                    <span className="text-2xl opacity-75">%</span>
                  </div>
                  <div className="text-3xl font-bold">{kpis.savingsRate.toFixed(1)}%</div>
                  <div className="text-purple-100 text-sm mt-1">Savings Rate</div>
                </div>
              </div>

              {/* Insights */}
              {insights.length > 0 && (
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-semibold mb-4">Insights</h3>
                  <div className="space-y-3">
                    {insights.map((insight, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg border-l-4 ${
                          insight.type === 'success' ? 'bg-green-50 border-green-500' :
                          insight.type === 'warning' ? 'bg-yellow-50 border-yellow-500' :
                          'bg-blue-50 border-blue-500'
                        }`}
                      >
                        <div className="font-semibold text-gray-900">{insight.title}</div>
                        <div className="text-sm text-gray-600 mt-1">{insight.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-semibold mb-4">Monthly Trend</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" stroke="#6b7280" />
                      <YAxis stroke="#6b7280" />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }} />
                      <Legend />
                      <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} />
                      <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-semibold mb-4">Spending by Category</h3>
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
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }} />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recent Transactions Preview */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Recent Transactions</h3>
                  <button
                    onClick={() => setCurrentView('transactions')}
                    className="text-blue-600 hover:text-blue-700 text-sm font-semibold"
                  >
                    View All →
                  </button>
                </div>
                <div className="space-y-3">
                  {filteredTransactions.slice(0, 5).map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{t.description}</div>
                        <div className="text-sm text-gray-500">{t.transaction_date} • {t.category}</div>
                      </div>
                      <div className={`text-lg font-semibold ${t.transaction_type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {t.transaction_type === 'income' ? '+' : '-'}${Math.abs(t.amount).toFixed(2)}
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
                <h2 className="text-2xl font-bold text-gray-900">Transactions</h2>
                <button
                  onClick={() => setShowAddTransaction(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus size={20} />
                  Add Transaction
                </button>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Filter size={20} className="text-gray-600" />
                  <h3 className="font-semibold">Filters</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Search</label>
                    <div className="relative">
                      <Search size={18} className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search transactions..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">End Date</label>
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Category</label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All Categories</option>
                      {Object.keys(categories).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {(dateRange.start || dateRange.end || selectedCategory !== 'all' || searchTerm) && (
                  <button
                    onClick={() => {
                      setDateRange({ start: '', end: '' });
                      setSelectedCategory('all');
                      setSearchTerm('');
                    }}
                    className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              {/* Transactions Table */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Date</th>
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Description</th>
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Category</th>
                        <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">Amount</th>
                        <th className="text-center py-4 px-6 text-sm font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center py-12 text-gray-500">
                            No transactions found. Upload a CSV or add transactions manually.
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
                                    className="px-2 py-1 border border-gray-300 rounded"
                                    onChange={(e) => setEditingTransaction({...editingTransaction, transaction_date: e.target.value})}
                                  />
                                </td>
                                <td className="py-4 px-6">
                                  <input
                                    type="text"
                                    defaultValue={t.description}
                                    className="w-full px-2 py-1 border border-gray-300 rounded"
                                    onChange={(e) => setEditingTransaction({...editingTransaction, description: e.target.value})}
                                  />
                                </td>
                                <td className="py-4 px-6">
                                  <select
                                    defaultValue={t.category}
                                    className="px-2 py-1 border border-gray-300 rounded"
                                    onChange={(e) => setEditingTransaction({...editingTransaction, category: e.target.value})}
                                  >
                                    {Object.keys(categories).map(cat => (
                                      <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-4 px-6 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    defaultValue={t.amount}
                                    className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                                    onChange={(e) => setEditingTransaction({...editingTransaction, amount: parseFloat(e.target.value)})}
                                  />
                                </td>
                                <td className="py-4 px-6">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => handleUpdateTransaction(t.id, editingTransaction)}
                                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                    >
                                      <Check size={18} />
                                    </button>
                                    <button
                                      onClick={() => setEditingTransaction(null)}
                                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                    >
                                      <X size={18} />
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-4 px-6 text-gray-900">{t.transaction_date}</td>
                                <td className="py-4 px-6">
                                  <div className="font-medium text-gray-900">{t.description}</div>
                                  {t.merchant && <div className="text-sm text-gray-500">{t.merchant}</div>}
                                </td>
                                <td className="py-4 px-6">
                                  <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                                    {t.category}
                                  </span>
                                </td>
                                <td className={`py-4 px-6 text-right font-semibold ${
                                  t.transaction_type === 'income' ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {t.transaction_type === 'income' ? '+' : '-'}${Math.abs(t.amount).toFixed(2)}
                                </td>
                                <td className="py-4 px-6">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => setEditingTransaction(t)}
                                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                      <Edit2 size={18} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTransaction(t.id)}
                                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
              <h2 className="text-2xl font-bold text-gray-900">Analytics & Insights</h2>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="text-sm text-gray-600 mb-2">Total Transactions</div>
                  <div className="text-3xl font-bold text-gray-900">{kpis.transactionCount}</div>
                  <div className="text-sm text-gray-500 mt-2">All time</div>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="text-sm text-gray-600 mb-2">Average Transaction</div>
                  <div className="text-3xl font-bold text-gray-900">${kpis.avgTransaction.toFixed(2)}</div>
                  <div className="text-sm text-gray-500 mt-2">Per transaction</div>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="text-sm text-gray-600 mb-2">Active Categories</div>
                  <div className="text-3xl font-bold text-gray-900">{Object.keys(categories).length}</div>
                  <div className="text-sm text-gray-500 mt-2">Categories used</div>
                </div>
              </div>

              {/* Category Breakdown Table */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4">Spending Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Category</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">% of Total</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Visual</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {Object.entries(categories)
                        .sort((a, b) => b[1] - a[1])
                        .map(([category, amount]) => {
                          const percentage = (amount / Object.values(categories).reduce((a, b) => a + b, 0)) * 100;
                          return (
                            <tr key={category} className="hover:bg-gray-50">
                              <td className="py-3 px-4 font-medium text-gray-900">{category}</td>
                              <td className="py-3 px-4 text-right font-semibold text-gray-900">
                                ${Math.abs(amount).toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-right text-gray-600">
                                {percentage.toFixed(1)}%
                              </td>
                              <td className="py-3 px-4">
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Monthly Trend Chart */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4">Income vs Expenses Over Time</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }} />
                    <Legend />
                    <Bar dataKey="income" fill="#10b981" name="Income" />
                    <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add Transaction Modal */}
      {showAddTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Add Transaction</h3>
              <button
                onClick={() => setShowAddTransaction(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  name="date"
                  required
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <input
                  type="text"
                  name="description"
                  required
                  placeholder="e.g., Grocery shopping"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  required
                  placeholder="Negative for expenses, positive for income"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Use negative (-) for expenses, positive (+) for income</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  name="category"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select category</option>
                  <option value="Food">Food</option>
                  <option value="Transportation">Transportation</option>
                  <option value="Housing">Housing</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Income">Income</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
                <textarea
                  name="notes"
                  rows="3"
                  placeholder="Additional notes..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                ></textarea>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddTransaction(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  Add Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetTracker;