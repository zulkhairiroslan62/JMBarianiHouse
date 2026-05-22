# JM Bariani HQ v2

**Complete Restaurant/F&B Business Intelligence System**

Production-ready full-stack application for managing restaurant operations with AI-powered OCR, inventory management, sales analytics, and real-time business intelligence.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11 + FastAPI + SQLAlchemy |
| Database | PostgreSQL 15 |
| Frontend | React 18 + Vite + TailwindCSS + Recharts |
| AI | Anthropic Claude API (claude-sonnet-4-20250514) |
| Auth | JWT (JSON Web Tokens) |
| Deploy | Docker Compose |

## Modules

1. **Authentication** - JWT login, role-based (owner/admin), 3-5 users
2. **Invoice & Receipt Management** - Upload PDF/JPG/PNG, Claude AI OCR, duplicate detection, confirm → auto-update inventory
3. **Inventory Management** - Auto stock updates, categories (basah/kering/minuman/lain-lain), weighted avg cost, reorder alerts
4. **Sales Integration (AcePOS)** - CSV/Excel upload, auto-fetch, suspicious transaction detection (5 patterns)
5. **AI Smart Monitoring** - 7-day analysis, bilingual insights (BM+EN), 6-hour cache
6. **Interactive Dashboard** - Owner view (KPIs, charts, AI insights) + Admin view (stock RAG, reorder, pending)
7. **Report Generation** - PDF/Excel with AI executive summary
8. **WhatsApp Alerts & Query** - Push alerts + natural language queries

## Quick Start

```bash
cp .env.example .env   # Edit with your credentials
chmod +x deploy.sh
./deploy.sh
```

**Access:** Frontend http://localhost:3000 | Backend http://localhost:8000 | Docs http://localhost:8000/docs


## Environment Variables

Required: `POSTGRES_PASSWORD`, `SECRET_KEY`
Optional: `ANTHROPIC_API_KEY`, `WHATSAPP_TOKEN`, `ACEPOS_USERNAME`

## Development

```bash
# Backend
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload

# Frontend
cd frontend && npm install && npm run dev
```
