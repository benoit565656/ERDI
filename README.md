# ERDI SDMX Database Schema & Setup

This repository contains the SDMX-inspired database schema, Prisma models, migrations, and seeding scripts for the ERDI data management platform.

The database is built on PostgreSQL, utilizing Prisma ORM for schema definition, typescript compilation, and migration orchestration.

## Database Architecture Overview

The database contains **47 tables** structured into several modules:
1. **Organizational & Ownership Normalization:** `departments`, `divisions` (ownership of datasets).
2. **SDMX Structure Definitions:** `dsds`, `dsd_components`, `concept_schemes`, `concepts` (capturing SDMX CSV models).
3. **Thematic Classification:** `themes`, `indicator_theme_mapping` (many-to-many theme hierarchy support).
4. **Dataflows & Constraints:** `dataflows` (main/secondary layers), `dataflow_constraints`, `dataflow_constraint_items` (constraints on allowed dimension values).
5. **Shortcut & Cache Tables:** `indicators`, `economies` (synced automatically from the main global code lists).
6. **Observations & Attributes:** `observations` (with dynamic custom dimensions, attributes, workflow/publishing states, and cache columns for harmonization values).
7. **Future Aggregation Placeholders:** `calculated_indicators`, `aggregation_rules`, `indicator_formulas`, `regional_definitions`, `regional_weights`.

### Custom Constraints & Indexes
- **Partial Unique Index (`idx_unique_published_observation`):** Enforces that only **one published observation value** exists for any unique combination of dimensions (represented by `observation_hash`) at any time, while allowing draft versions and audit history to coexist.
- **NULLS NOT DISTINCT Unique Indexes:** Enforces composite unique constraints where null values are present on tables like `indicator_dataset_metadata`, `indicator_dataflow_mapping`, `harmonization_rules`, `currency_exchange_rates`, `regional_definitions`, and `regional_weights`.

---

## Local Setup & Execution Guide

Because the system was configured portably without system-wide administrative privileges, the database runs in user-space under the `./scratch/` folder.

### 1. Prerequisites
- **Node.js:** v24.16.0 or higher
- **npm:** 11.13.0 or higher

### 2. Starting the Portable PostgreSQL Server
If the database server is not running, start it using the portable binary command:
```powershell
# In PowerShell:
./scratch/pgsql/bin/pg_ctl.exe -D ./scratch/db_data -l ./scratch/db_logfile start
```
Or run `postgres.exe` directly in a foreground shell:
```powershell
./scratch/pgsql/bin/postgres.exe -D ./scratch/db_data
```

To stop the database:
```powershell
./scratch/pgsql/bin/pg_ctl.exe -D ./scratch/db_data stop
```

*Note: The database runs on port `5432` with user `postgres` and trust authentication.*

### 3. Deploying Schema Migrations
To apply the database schema, custom indexes, and foreign keys:
```bash
npx prisma migrate deploy
```

### 4. Seeding the Database
To populate all code lists, concept schemes, DSD components, dataflows, themes, synced shortcut tables, and load a sample of 100 observations:
```bash
npx prisma db seed
```
This runs `prisma/seed.ts` using `ts-node`.

### 5. Verification Commands
To check database row counts and confirm successful seeding:
```bash
node scratch/check_db.js
```
This script queries all 47 models and prints their row counts.

---

## Technical Specifications & Configuration
- **Prisma Schema:** [schema.prisma](file:///c:/Projects/ERDI%20DATA/prisma/schema.prisma)
- **Database Connection:** Configured in [.env](file:///c:/Projects/ERDI%20DATA/.env)
- **Seeding Source Folders:** 
  - `output/` (DSDs, concept schemes, dataflows)
  - `output_codelists/` (global code lists)
  - `output_obs/` (observations CSVs)
