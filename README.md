# 🏠 Apartment Management System

A full-stack web application for managing boarding houses / rental rooms (phòng trọ), built to help landlords track rooms, tenants, contracts, utility readings, and monthly billing — including automatic PDF invoice generation and email delivery.

## Overview

Many small-scale landlords in Vietnam still manage their rental properties with spreadsheets or notebooks, which makes tracking multiple houses, tenants, and monthly electricity/water bills error-prone and time-consuming. This project digitizes that workflow with a REST API backend and a React single-page frontend, covering the full lifecycle from onboarding a tenant to generating and emailing a monthly bill.

## Features

- **Authentication** — JWT-based login/registration with bcrypt password hashing (`python-jose` + `bcrypt`), role support (owner/staff), and route-level protection applied globally via FastAPI dependencies.
- **Multi-house management** — Group rooms under different houses/properties, each with its own theme color for quick visual identification.
- **Room management** — Track room number, area, base rent, furniture list, water-meter availability, and occupancy status (vacant / occupied / inactive).
- **Tenant & contract management** — Store tenant profiles and link them to rental contracts with rent, deposit, tenant/vehicle counts, and temporary residence registration status. Contracts support active/ended/terminated states with an end-reason log.
- **Utility tracking** — Monthly electricity/water meter readings per room, with time-versioned utility rates (`effective_from`) so historical bills always use the price that was active at the time.
- **Automated bill generation** — Calculates electricity, water, service, and additional fees from meter readings and the applicable rate, with safeguards against duplicate bills for the same contract/month and support for rooms without a personal water meter (flat-rate billing).
- **Bill editing** — Correct meter readings and fees on a pending bill, with amounts automatically recalculated.
- **PDF invoices & email delivery** — Generates a bill PDF (WeasyPrint) from an HTML template and emails it directly to the tenant.
- **Incident reporting** — Log and track maintenance/incident reports per room through received → in-progress → completed states.
- **Guided bill creation UX** — The bill generation modal auto-advances to the correct billing month, pre-fills meter readings from the previous period, and requires a review/confirmation step before committing — designed for landlords who are not very tech-savvy.

## Tech Stack

**Backend**
- Python, FastAPI
- PostgreSQL, SQLAlchemy (ORM), Alembic (migrations)
- Pydantic v2 (validation, including custom Vietnamese phone number rules)
- JWT auth via `python-jose`, password hashing via `bcrypt`
- WeasyPrint (PDF generation), Jinja2 (HTML bill templates)

**Frontend**
- React 19 (Vite)
- React Router v6
- Tailwind CSS v4
- Axios (with interceptors for auth tokens)

## Architecture

```
apartment-management-system/
├── backend/
│   ├── app/
│   │   ├── core/          # config, database session, security (JWT/bcrypt), auth dependencies
│   │   ├── models/        # SQLAlchemy models: User, House, Room, Tenant, Contract,
│   │   │                  # UtilityReading, UtilityRate, Bill, Incident
│   │   ├── schemas/       # Pydantic request/response schemas
│   │   ├── routers/       # FastAPI routers: auth, rooms, tenants, contracts,
│   │   │                  # utilities, utility rates, bills, houses, incidents
│   │   ├── services/      # PDF generation (WeasyPrint) and email delivery
│   │   └── templates/     # Jinja2 HTML template for bill PDFs
│   └── alembic/           # Database migrations
└── frontend/
    └── src/
        ├── pages/         # Dashboard, Rooms, Tenants, Bills, Incidents, Login, Register
        ├── components/    # Modals & drawers for rooms, tenants, contracts, bills, incidents
        └── api/            # Axios client with interceptors
```

### Database schema

Eight core tables model the domain: `users`, `houses`, `rooms`, `tenants`, `contracts`, `utility_readings`, `utility_rates`, and `bills`, plus an `incidents` table for maintenance tracking. Key design decisions:

- **Time-versioned utility rates** — `utility_rates.effective_from` lets the system look up the correct price for any past billing month instead of always using the current price, so historical bills stay accurate even after a price change.
- **Rent snapshot on contracts** — `contracts.monthly_rent` is stored separately from `rooms.base_rent`, since a room's listed price can change after a contract is signed.
- **Uniqueness guards** — Composite unique constraints prevent duplicate utility readings (`room_id` + `billing_month`) and duplicate bills (`contract_id` + `billing_month`).

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configure your database connection and secret key
cp .env.example .env       # then edit with your DATABASE_URL, SECRET_KEY, etc.

# Run migrations
alembic upgrade head

# Start the API server
uvicorn app.main:app --reload
```
The API will be available at `http://localhost:8000` (interactive docs at `/docs`).

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
The app will be available at `http://localhost:5173`.

## Key Engineering Highlights

- Designed a normalized relational schema across 8 tables with careful handling of point-in-time pricing lookups for billing accuracy.
- Implemented JWT authentication manually with `python-jose` and `bcrypt` after encountering version conflicts with `passlib`, including a dummy-hash comparison on login to mitigate user-enumeration timing attacks.
- Built a bill generation pipeline that reconciles meter readings, historical utility rates, and contract terms, with explicit handling for rooms billed on a flat water rate versus metered consumption.
- Iterated the frontend UX around real end users (non-technical, older landlords), adding guardrails like auto-advancing billing periods, pre-filled readings, and a mandatory review step before committing a bill.

## Status

This project is under active development as a personal/family tool for managing rental properties, with an initial focus on core room, tenant, contract, and billing workflows.

## License

This project is for educational and personal use.
