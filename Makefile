.PHONY: dev frontend backend test install install-frontend install-backend lint

install: install-frontend install-backend

install-frontend:
	npm install

install-backend:
	python -m pip install -r backend/requirements.txt

frontend:
	npm run dev

backend:
	cd backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev:
	npx --yes concurrently -k -n backend,frontend -c blue,cyan "cd backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000" "npm run dev"

test:
	cd backend && python -m pytest -q
	npm run typecheck

lint:
	npm run lint
	cd backend && python -m ruff check .
