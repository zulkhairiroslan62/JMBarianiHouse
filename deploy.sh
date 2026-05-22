#!/bin/bash
set -e
echo "========================================="
echo "  JM Bariani HQ v2 - Deployment Script  "
echo "========================================="
if [ ! -f .env ]; then
    echo "No .env file found. Copying from .env.example..."
    cp .env.example .env
    echo "Please edit .env with your actual credentials before continuing."
    exit 1
fi
export $(grep -v '^#' .env | xargs)
echo ""
echo "Building Docker images..."
docker compose build --no-cache
echo ""
echo "Starting services..."
docker compose up -d
echo ""
echo "Waiting for database to be ready..."
sleep 5
echo ""
echo "Running database migrations..."
docker compose exec backend alembic upgrade head
echo ""
echo "Seeding initial data..."
docker compose exec backend python -m app.seed
echo ""
echo "========================================="
echo "  Deployment Complete!"
echo "========================================="
echo ""
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo ""
echo "  Default Login:"
echo "  Owner: owner@jmbariani.com / owner123"
echo "  Admin: admin@jmbariani.com / admin123"
echo "========================================="
