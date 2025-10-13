# 💰 Budget Tracker

Full-stack budget tracking application for Canadians with CSV import, analytics, and real-time insights.

![Budget Tracker](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 🌟 Features

- 🔐 **Secure Authentication** - JWT-based user authentication with refresh tokens
- 📊 **Interactive Dashboard** - Real-time KPIs and financial metrics
- 📁 **Smart CSV Import** - Automatically parse transactions from multiple bank formats
- 📈 **Advanced Analytics** - Monthly trends, category breakdowns, and spending insights
- 💳 **Transaction Management** - Add, edit, delete, and filter transactions
- 🎯 **Budget Tracking** - Set budgets and track spending goals
- 💡 **AI Insights** - Get personalized spending recommendations
- 📱 **Responsive Design** - Works seamlessly on desktop, tablet, and mobile
- 🇨🇦 **Built for Canadians** - CAD currency, Canadian categories, timezone support

## 🛠️ Tech Stack

**Frontend:**
- React 18
- Recharts for visualizations
- Tailwind CSS for styling
- Lucide React for icons
- Papa Parse for CSV handling

**Backend:**
- Node.js + Express
- PostgreSQL database
- JWT authentication
- bcrypt for password hashing
- Input validation & rate limiting

**DevOps:**
- Docker & Docker Compose
- Multi-container architecture
- Health checks & auto-restart

## 🚀 Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed
- Git (optional)

### Installation

1. **Clone the repository:**
```bash
   git clone https://github.com/YOUR_USERNAME/budget-tracker.git
   cd budget-tracker