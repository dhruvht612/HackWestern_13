.PHONY: dev frontend backend test install install-frontend install-backend lint

install: install-frontend install-backend

install-frontend:
	npm install

install-backend:
	uv sync --project backend --locked --all-groups

frontend:
	npm run dev

backend:
	cd backend && uv run --locked fastapi dev --host 0.0.0.0 --port 8000

dev:
	npx --yes concurrently -k -n backend,frontend -c blue,cyan "cd backend && uv run --locked fastapi dev --host 0.0.0.0 --port 8000" "npm run dev"

test:
	uv run --project backend --locked pytest -q
	npm run typecheck

lint:
	npm run lint
	uv run --project backend --locked ruff check backend
