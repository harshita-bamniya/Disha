.PHONY: up down build logs shell-backend shell-db migrate reset-db

# Start all services
up:
	docker compose up -d

# Start with logs attached
up-watch:
	docker compose up

# Stop all services
down:
	docker compose down

# Rebuild images
build:
	docker compose build

# Rebuild and start
rebuild:
	docker compose down && docker compose build && docker compose up -d

# Follow logs (all services)
logs:
	docker compose logs -f

# Follow backend logs only
logs-backend:
	docker compose logs -f backend

# Shell into backend container
shell-backend:
	docker compose exec backend bash

# Shell into postgres
shell-db:
	docker compose exec postgres psql -U disha -d disha_db

# Run alembic migrations
migrate:
	docker compose exec backend alembic upgrade head

# Create a new migration
migration:
	docker compose exec backend alembic revision --autogenerate -m "$(name)"

# Full reset (WARNING: destroys all data)
reset-db:
	docker compose down -v && docker compose up -d

# Run backend tests
test-backend:
	docker compose exec backend pytest tests/ -v

# Check backend health
health:
	curl -s http://localhost:8000/health | python -m json.tool
