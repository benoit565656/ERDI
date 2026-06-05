-- CreateEnum
CREATE TYPE "DataflowLevel" AS ENUM ('MAIN', 'SECONDARY');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'VALIDATED', 'APPROVED', 'PUBLISHED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED', 'VALIDATING', 'VALIDATED', 'PARTIALLY_IMPORTED', 'IMPORTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('CODE_LIST', 'OBSERVATIONS', 'DATAFLOWS', 'DSD', 'CONCEPTS');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('ERROR', 'WARNING');

-- CreateEnum
CREATE TYPE "ComponentType" AS ENUM ('DIMENSION', 'TIME_DIMENSION', 'MEASURE', 'ATTRIBUTE', 'METADATA');

-- CreateEnum
CREATE TYPE "ConceptType" AS ENUM ('DIMENSION', 'ATTRIBUTE', 'MEASURE', 'METADATA');

-- CreateEnum
CREATE TYPE "AttachmentLevel" AS ENUM ('OBSERVATION', 'SERIES', 'DATASET');

-- CreateEnum
CREATE TYPE "PageType" AS ENUM ('INDICATOR', 'ECONOMY', 'DATAFLOW');

-- CreateEnum
CREATE TYPE "VisualizationType" AS ENUM ('TABLE', 'LINE_CHART', 'BAR_CHART', 'MAP');

-- CreateEnum
CREATE TYPE "ConversionMethod" AS ENUM ('MULTIPLIER_ONLY', 'CURRENCY_CONVERSION', 'WARNING_ONLY', 'NONE');

-- CreateEnum
CREATE TYPE "EconomyType" AS ENUM ('COUNTRY', 'REGION', 'SUBREGION', 'GROUP');

-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'STATUS_CHANGE', 'PUBLISH', 'UNPUBLISH');

-- CreateEnum
CREATE TYPE "AggregationMethod" AS ENUM ('SUM', 'AVERAGE', 'WEIGHTED_AVERAGE');

-- CreateEnum
CREATE TYPE "ValueType" AS ENUM ('REPORTED', 'CALCULATED', 'AGGREGATED');

-- CreateEnum
CREATE TYPE "WeightType" AS ENUM ('GDP', 'POPULATION', 'TRADE', 'CUSTOM');

-- CreateTable
CREATE TABLE "datasets" (
    "id" UUID NOT NULL,
    "code" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "description" TEXT,
    "division_code" VARCHAR NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsds" (
    "id" UUID NOT NULL,
    "code" VARCHAR NOT NULL,
    "agency" VARCHAR NOT NULL,
    "version" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "description" TEXT,
    "urn" VARCHAR,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "dsds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsd_components" (
    "id" UUID NOT NULL,
    "dsd_code" VARCHAR NOT NULL,
    "component_code" VARCHAR NOT NULL,
    "component_type" "ComponentType" NOT NULL,
    "concept_code" VARCHAR NOT NULL,
    "code_list_code" VARCHAR,
    "position" INTEGER,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "attachment_level" "AttachmentLevel",
    "text_type" VARCHAR,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "dsd_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concept_schemes" (
    "id" UUID NOT NULL,
    "code" VARCHAR NOT NULL,
    "agency" VARCHAR NOT NULL,
    "version" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "description" TEXT,
    "urn" VARCHAR,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "concept_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concepts" (
    "id" UUID NOT NULL,
    "concept_scheme_code" VARCHAR NOT NULL,
    "code" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "description" TEXT,
    "code_list_code" VARCHAR,
    "concept_type" "ConceptType",
    "urn" VARCHAR,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dataflows" (
    "id" UUID NOT NULL,
    "code" VARCHAR NOT NULL,
    "dataset_code" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "description" TEXT,
    "dataflow_level" "DataflowLevel" NOT NULL,
    "main_dataflow_code" VARCHAR,
    "dsd_code" VARCHAR,
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "dataflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_lists" (
    "id" UUID NOT NULL,
    "code" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "description" TEXT,
    "dataset_code" VARCHAR,
    "is_global" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "code_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_list_items" (
    "id" UUID NOT NULL,
    "code_list_code" VARCHAR NOT NULL,
    "item_code" VARCHAR NOT NULL,
    "item_name" VARCHAR NOT NULL,
    "description" TEXT,
    "parent_item_code" VARCHAR,
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" VARCHAR,
    "valid_to" VARCHAR,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "code_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicators" (
    "id" UUID NOT NULL,
    "code" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "description" TEXT,
    "theme_code" VARCHAR,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicator_dataset_metadata" (
    "id" UUID NOT NULL,
    "dataset_code" VARCHAR NOT NULL,
    "indicator_code" VARCHAR NOT NULL,
    "division_code" VARCHAR,
    "name" VARCHAR,
    "description" TEXT,
    "source_notes" TEXT,
    "methodology" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "indicator_dataset_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "economies" (
    "id" UUID NOT NULL,
    "code" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "description" TEXT,
    "parent_code" VARCHAR,
    "sort_order" INTEGER,
    "economy_type" "EconomyType",
    "iso2_code" CHAR(2),
    "iso3_code" CHAR(3),
    "currency_code" VARCHAR,
    "region_code" VARCHAR,
    "subregion_code" VARCHAR,
    "display_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "economies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "id" UUID NOT NULL,
    "code" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "symbol" VARCHAR,
    "decimal_places" INTEGER NOT NULL DEFAULT 2,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "themes" (
    "id" UUID NOT NULL,
    "code" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "description" TEXT,
    "parent_code" VARCHAR,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicator_theme_mapping" (
    "id" UUID NOT NULL,
    "indicator_code" VARCHAR NOT NULL,
    "theme_code" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indicator_theme_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dataset_dimensions" (
    "id" UUID NOT NULL,
    "dataset_code" VARCHAR NOT NULL,
    "concept_code" VARCHAR NOT NULL,
    "code_list_code" VARCHAR,
    "position" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dataset_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dataset_attributes" (
    "id" UUID NOT NULL,
    "dataset_code" VARCHAR NOT NULL,
    "concept_code" VARCHAR NOT NULL,
    "code_list_code" VARCHAR,
    "is_required" BOOLEAN NOT NULL,
    "attachment_level" "AttachmentLevel" NOT NULL,
    "default_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dataset_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dataflow_dimensions" (
    "id" UUID NOT NULL,
    "dataflow_code" VARCHAR NOT NULL,
    "dataset_code" VARCHAR NOT NULL,
    "concept_code" VARCHAR NOT NULL,
    "code_list_code" VARCHAR,
    "position" INTEGER,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "dataflow_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dataflow_attributes" (
    "id" UUID NOT NULL,
    "dataflow_code" VARCHAR NOT NULL,
    "dataset_code" VARCHAR NOT NULL,
    "concept_code" VARCHAR NOT NULL,
    "code_list_code" VARCHAR,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "attachment_level" "AttachmentLevel" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "default_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "dataflow_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicator_dataflow_mapping" (
    "id" UUID NOT NULL,
    "dataset_code" VARCHAR NOT NULL,
    "indicator_code" VARCHAR NOT NULL,
    "main_dataflow_code" VARCHAR NOT NULL,
    "secondary_dataflow_code" VARCHAR,
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "indicator_dataflow_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observations" (
    "id" UUID NOT NULL,
    "dataset_code" VARCHAR NOT NULL,
    "main_dataflow_code" VARCHAR NOT NULL,
    "secondary_dataflow_code" VARCHAR,
    "indicator_code" VARCHAR NOT NULL,
    "economy_code" VARCHAR NOT NULL,
    "period" VARCHAR NOT NULL,
    "freq_code" VARCHAR NOT NULL,
    "obs_value" DECIMAL(28,10),
    "unit_code" VARCHAR,
    "unit_mult_code" VARCHAR,
    "decimals_code" VARCHAR,
    "obs_status_code" VARCHAR,
    "ref_year" VARCHAR,
    "base_year" VARCHAR,
    "data_source" TEXT,
    "methodology" TEXT,
    "footnote" TEXT,
    "division_code" VARCHAR,
    "workflow_status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "import_batch_id" UUID,
    "source_file_name" VARCHAR,
    "observation_hash" VARCHAR NOT NULL,
    "value_type" "ValueType" NOT NULL DEFAULT 'REPORTED',
    "harmonized_value" DECIMAL(28,10),
    "harmonized_unit_code" VARCHAR,
    "harmonized_multiplier_code" VARCHAR,
    "created_by" VARCHAR,
    "updated_by" VARCHAR,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observation_extra_dimensions" (
    "id" UUID NOT NULL,
    "observation_id" UUID NOT NULL,
    "concept_code" VARCHAR NOT NULL,
    "code_value" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "observation_extra_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observation_attributes" (
    "id" UUID NOT NULL,
    "observation_id" UUID NOT NULL,
    "concept_code" VARCHAR NOT NULL,
    "value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "observation_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observation_history" (
    "id" UUID NOT NULL,
    "observation_id" UUID NOT NULL,
    "change_type" "ChangeType" NOT NULL,
    "field_name" VARCHAR,
    "old_value" TEXT,
    "new_value" TEXT,
    "reason" TEXT,
    "source_file_name" VARCHAR,
    "import_batch_id" UUID,
    "changed_by" VARCHAR,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observation_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" UUID NOT NULL,
    "dataset_code" VARCHAR,
    "import_type" "ImportType" NOT NULL,
    "file_name" VARCHAR NOT NULL,
    "file_hash" VARCHAR,
    "status" "ImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "invalid_rows" INTEGER NOT NULL DEFAULT 0,
    "warning_rows" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by" VARCHAR,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_validation_messages" (
    "id" UUID NOT NULL,
    "import_batch_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "severity" "Severity" NOT NULL,
    "field_name" VARCHAR,
    "message" TEXT NOT NULL,
    "raw_row" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_validation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dataflow_constraints" (
    "id" UUID NOT NULL,
    "dataset_code" VARCHAR NOT NULL,
    "dataflow_code" VARCHAR NOT NULL,
    "constraint_name" VARCHAR NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "dataflow_constraints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dataflow_constraint_items" (
    "id" UUID NOT NULL,
    "constraint_id" UUID NOT NULL,
    "concept_code" VARCHAR NOT NULL,
    "allowed_code_value" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dataflow_constraint_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "common_units" (
    "id" UUID NOT NULL,
    "code" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "description" TEXT,
    "unit_type" VARCHAR,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "common_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "common_multipliers" (
    "id" UUID NOT NULL,
    "code" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "factor" DECIMAL(28,10) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "common_multipliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currency_exchange_rates" (
    "id" UUID NOT NULL,
    "source_currency_code" VARCHAR NOT NULL,
    "target_currency_code" VARCHAR NOT NULL,
    "period" VARCHAR NOT NULL,
    "freq_code" VARCHAR NOT NULL,
    "exchange_rate" DECIMAL(28,10) NOT NULL,
    "source" VARCHAR,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currency_exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "harmonization_rules" (
    "id" UUID NOT NULL,
    "dataset_code" VARCHAR NOT NULL,
    "dataflow_code" VARCHAR,
    "indicator_code" VARCHAR NOT NULL,
    "rule_name" VARCHAR NOT NULL,
    "target_unit_code" VARCHAR,
    "target_multiplier_code" VARCHAR,
    "conversion_method" "ConversionMethod" NOT NULL,
    "exchange_rate_source" VARCHAR,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "harmonization_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "harmonization_rule_items" (
    "id" UUID NOT NULL,
    "harmonization_rule_id" UUID NOT NULL,
    "economy_code" VARCHAR,
    "source_unit_code" VARCHAR,
    "source_multiplier_code" VARCHAR,
    "target_unit_code" VARCHAR,
    "target_multiplier_code" VARCHAR,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "harmonization_rule_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_configs" (
    "id" UUID NOT NULL,
    "page_type" "PageType" NOT NULL,
    "slug" VARCHAR NOT NULL,
    "title" VARCHAR NOT NULL,
    "description" TEXT,
    "dataset_code" VARCHAR NOT NULL,
    "default_view" VARCHAR,
    "use_harmonized_values" BOOLEAN NOT NULL DEFAULT false,
    "target_unit_code" VARCHAR,
    "target_multiplier_code" VARCHAR,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "page_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_config_dataflows" (
    "id" UUID NOT NULL,
    "page_config_id" UUID NOT NULL,
    "dataflow_code" VARCHAR NOT NULL,
    "sort_order" INTEGER,
    "dataflowId" UUID,

    CONSTRAINT "page_config_dataflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_config_indicators" (
    "id" UUID NOT NULL,
    "page_config_id" UUID NOT NULL,
    "indicator_code" VARCHAR NOT NULL,
    "sort_order" INTEGER,

    CONSTRAINT "page_config_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_config_economies" (
    "id" UUID NOT NULL,
    "page_config_id" UUID NOT NULL,
    "economy_code" VARCHAR NOT NULL,
    "sort_order" INTEGER,
    "economyId" UUID,

    CONSTRAINT "page_config_economies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_config_periods" (
    "id" UUID NOT NULL,
    "page_config_id" UUID NOT NULL,
    "period" VARCHAR NOT NULL,
    "sort_order" INTEGER,

    CONSTRAINT "page_config_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_config_visualizations" (
    "id" UUID NOT NULL,
    "page_config_id" UUID NOT NULL,
    "visualization_type" "VisualizationType" NOT NULL,
    "title" VARCHAR,
    "config_json" JSONB,
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "page_config_visualizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "email" VARCHAR NOT NULL,
    "name" VARCHAR,
    "password_hash" VARCHAR,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_email" VARCHAR,
    "action" VARCHAR NOT NULL,
    "entity_type" VARCHAR NOT NULL,
    "entity_id" VARCHAR,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" VARCHAR,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculated_indicators" (
    "id" UUID NOT NULL,
    "indicator_code" VARCHAR NOT NULL,
    "formula_expression" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "calculated_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aggregation_rules" (
    "id" UUID NOT NULL,
    "dataset_code" VARCHAR NOT NULL,
    "indicator_code" VARCHAR NOT NULL,
    "aggregation_method" "AggregationMethod" NOT NULL,
    "weight_indicator_code" VARCHAR,
    "target_economy_type" "EconomyType" NOT NULL,
    "min_coverage_pct" DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "aggregation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicator_formulas" (
    "id" UUID NOT NULL,
    "calculated_indicator_id" UUID NOT NULL,
    "source_indicator_code" VARCHAR NOT NULL,
    "coefficient" DECIMAL(10,5) NOT NULL DEFAULT 1.0,
    "operator" VARCHAR NOT NULL DEFAULT '+',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indicator_formulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regional_definitions" (
    "id" UUID NOT NULL,
    "group_economy_code" VARCHAR NOT NULL,
    "member_economy_code" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regional_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regional_weights" (
    "id" UUID NOT NULL,
    "dataset_code" VARCHAR NOT NULL,
    "group_economy_code" VARCHAR NOT NULL,
    "member_economy_code" VARCHAR NOT NULL,
    "year" VARCHAR NOT NULL,
    "weight_value" DECIMAL(28,10) NOT NULL,
    "weight_type" "WeightType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regional_weights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "datasets_code_key" ON "datasets"("code");

-- CreateIndex
CREATE UNIQUE INDEX "dsds_code_key" ON "dsds"("code");

-- CreateIndex
CREATE UNIQUE INDEX "dsd_components_dsd_code_component_code_key" ON "dsd_components"("dsd_code", "component_code");

-- CreateIndex
CREATE UNIQUE INDEX "concept_schemes_code_key" ON "concept_schemes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "concepts_code_key" ON "concepts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "dataflows_dataset_code_code_key" ON "dataflows"("dataset_code", "code");

-- CreateIndex
CREATE UNIQUE INDEX "code_lists_code_key" ON "code_lists"("code");

-- CreateIndex
CREATE UNIQUE INDEX "code_list_items_code_list_code_item_code_key" ON "code_list_items"("code_list_code", "item_code");

-- CreateIndex
CREATE UNIQUE INDEX "indicators_code_key" ON "indicators"("code");

-- CreateIndex
CREATE UNIQUE INDEX "economies_code_key" ON "economies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "themes_code_key" ON "themes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "indicator_theme_mapping_indicator_code_theme_code_key" ON "indicator_theme_mapping"("indicator_code", "theme_code");

-- CreateIndex
CREATE UNIQUE INDEX "dataset_dimensions_dataset_code_concept_code_key" ON "dataset_dimensions"("dataset_code", "concept_code");

-- CreateIndex
CREATE UNIQUE INDEX "dataset_attributes_dataset_code_concept_code_key" ON "dataset_attributes"("dataset_code", "concept_code");

-- CreateIndex
CREATE UNIQUE INDEX "dataflow_dimensions_dataset_code_dataflow_code_concept_code_key" ON "dataflow_dimensions"("dataset_code", "dataflow_code", "concept_code");

-- CreateIndex
CREATE UNIQUE INDEX "dataflow_attributes_dataset_code_dataflow_code_concept_code_key" ON "dataflow_attributes"("dataset_code", "dataflow_code", "concept_code");

-- CreateIndex
CREATE UNIQUE INDEX "indicator_dataflow_mapping_dataset_code_indicator_code_main_key" ON "indicator_dataflow_mapping"("dataset_code", "indicator_code", "main_dataflow_code", "secondary_dataflow_code") NULLS NOT DISTINCT;

-- CreateIndex
CREATE INDEX "observations_dataset_code_idx" ON "observations"("dataset_code");

-- CreateIndex
CREATE INDEX "observations_main_dataflow_code_idx" ON "observations"("main_dataflow_code");

-- CreateIndex
CREATE INDEX "observations_secondary_dataflow_code_idx" ON "observations"("secondary_dataflow_code");

-- CreateIndex
CREATE INDEX "observations_indicator_code_idx" ON "observations"("indicator_code");

-- CreateIndex
CREATE INDEX "observations_economy_code_idx" ON "observations"("economy_code");

-- CreateIndex
CREATE INDEX "observations_period_idx" ON "observations"("period");

-- CreateIndex
CREATE INDEX "observations_freq_code_idx" ON "observations"("freq_code");

-- CreateIndex
CREATE INDEX "observations_workflow_status_idx" ON "observations"("workflow_status");

-- CreateIndex
CREATE INDEX "observations_is_published_idx" ON "observations"("is_published");

-- CreateIndex
CREATE INDEX "observations_deleted_at_idx" ON "observations"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "observation_extra_dimensions_observation_id_concept_code_key" ON "observation_extra_dimensions"("observation_id", "concept_code");

-- CreateIndex
CREATE UNIQUE INDEX "observation_attributes_observation_id_concept_code_key" ON "observation_attributes"("observation_id", "concept_code");

-- CreateIndex
CREATE UNIQUE INDEX "common_units_code_key" ON "common_units"("code");

-- CreateIndex
CREATE UNIQUE INDEX "common_multipliers_code_key" ON "common_multipliers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "currency_exchange_rates_source_currency_code_target_currenc_key" ON "currency_exchange_rates"("source_currency_code", "target_currency_code", "period", "freq_code");

-- CreateIndex
CREATE UNIQUE INDEX "page_configs_slug_key" ON "page_configs"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "page_config_dataflows_page_config_id_dataflow_code_key" ON "page_config_dataflows"("page_config_id", "dataflow_code");

-- CreateIndex
CREATE UNIQUE INDEX "page_config_indicators_page_config_id_indicator_code_key" ON "page_config_indicators"("page_config_id", "indicator_code");

-- CreateIndex
CREATE UNIQUE INDEX "page_config_economies_page_config_id_economy_code_key" ON "page_config_economies"("page_config_id", "economy_code");

-- CreateIndex
CREATE UNIQUE INDEX "page_config_periods_page_config_id_period_key" ON "page_config_periods"("page_config_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "calculated_indicators_indicator_code_key" ON "calculated_indicators"("indicator_code");

-- AddForeignKey
ALTER TABLE "dsd_components" ADD CONSTRAINT "dsd_components_dsd_code_fkey" FOREIGN KEY ("dsd_code") REFERENCES "dsds"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsd_components" ADD CONSTRAINT "dsd_components_concept_code_fkey" FOREIGN KEY ("concept_code") REFERENCES "concepts"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsd_components" ADD CONSTRAINT "dsd_components_code_list_code_fkey" FOREIGN KEY ("code_list_code") REFERENCES "code_lists"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_concept_scheme_code_fkey" FOREIGN KEY ("concept_scheme_code") REFERENCES "concept_schemes"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_code_list_code_fkey" FOREIGN KEY ("code_list_code") REFERENCES "code_lists"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataflows" ADD CONSTRAINT "dataflows_dataset_code_fkey" FOREIGN KEY ("dataset_code") REFERENCES "datasets"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataflows" ADD CONSTRAINT "dataflows_dsd_code_fkey" FOREIGN KEY ("dsd_code") REFERENCES "dsds"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataflows" ADD CONSTRAINT "dataflows_dataset_code_main_dataflow_code_fkey" FOREIGN KEY ("dataset_code", "main_dataflow_code") REFERENCES "dataflows"("dataset_code", "code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_lists" ADD CONSTRAINT "code_lists_dataset_code_fkey" FOREIGN KEY ("dataset_code") REFERENCES "datasets"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_list_items" ADD CONSTRAINT "code_list_items_code_list_code_fkey" FOREIGN KEY ("code_list_code") REFERENCES "code_lists"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_list_items" ADD CONSTRAINT "code_list_items_code_list_code_parent_item_code_fkey" FOREIGN KEY ("code_list_code", "parent_item_code") REFERENCES "code_list_items"("code_list_code", "item_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_dataset_metadata" ADD CONSTRAINT "indicator_dataset_metadata_dataset_code_fkey" FOREIGN KEY ("dataset_code") REFERENCES "datasets"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_dataset_metadata" ADD CONSTRAINT "indicator_dataset_metadata_indicator_code_fkey" FOREIGN KEY ("indicator_code") REFERENCES "indicators"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "economies" ADD CONSTRAINT "economies_parent_code_fkey" FOREIGN KEY ("parent_code") REFERENCES "economies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "economies" ADD CONSTRAINT "economies_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "themes" ADD CONSTRAINT "themes_parent_code_fkey" FOREIGN KEY ("parent_code") REFERENCES "themes"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_theme_mapping" ADD CONSTRAINT "indicator_theme_mapping_indicator_code_fkey" FOREIGN KEY ("indicator_code") REFERENCES "indicators"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_theme_mapping" ADD CONSTRAINT "indicator_theme_mapping_theme_code_fkey" FOREIGN KEY ("theme_code") REFERENCES "themes"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataset_dimensions" ADD CONSTRAINT "dataset_dimensions_dataset_code_fkey" FOREIGN KEY ("dataset_code") REFERENCES "datasets"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataset_dimensions" ADD CONSTRAINT "dataset_dimensions_concept_code_fkey" FOREIGN KEY ("concept_code") REFERENCES "concepts"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataset_dimensions" ADD CONSTRAINT "dataset_dimensions_code_list_code_fkey" FOREIGN KEY ("code_list_code") REFERENCES "code_lists"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataset_attributes" ADD CONSTRAINT "dataset_attributes_dataset_code_fkey" FOREIGN KEY ("dataset_code") REFERENCES "datasets"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataset_attributes" ADD CONSTRAINT "dataset_attributes_concept_code_fkey" FOREIGN KEY ("concept_code") REFERENCES "concepts"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataset_attributes" ADD CONSTRAINT "dataset_attributes_code_list_code_fkey" FOREIGN KEY ("code_list_code") REFERENCES "code_lists"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataflow_dimensions" ADD CONSTRAINT "dataflow_dimensions_dataset_code_dataflow_code_fkey" FOREIGN KEY ("dataset_code", "dataflow_code") REFERENCES "dataflows"("dataset_code", "code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataflow_dimensions" ADD CONSTRAINT "dataflow_dimensions_concept_code_fkey" FOREIGN KEY ("concept_code") REFERENCES "concepts"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataflow_dimensions" ADD CONSTRAINT "dataflow_dimensions_code_list_code_fkey" FOREIGN KEY ("code_list_code") REFERENCES "code_lists"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataflow_attributes" ADD CONSTRAINT "dataflow_attributes_dataset_code_dataflow_code_fkey" FOREIGN KEY ("dataset_code", "dataflow_code") REFERENCES "dataflows"("dataset_code", "code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataflow_attributes" ADD CONSTRAINT "dataflow_attributes_concept_code_fkey" FOREIGN KEY ("concept_code") REFERENCES "concepts"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataflow_attributes" ADD CONSTRAINT "dataflow_attributes_code_list_code_fkey" FOREIGN KEY ("code_list_code") REFERENCES "code_lists"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_dataflow_mapping" ADD CONSTRAINT "indicator_dataflow_mapping_dataset_code_fkey" FOREIGN KEY ("dataset_code") REFERENCES "datasets"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_dataflow_mapping" ADD CONSTRAINT "indicator_dataflow_mapping_indicator_code_fkey" FOREIGN KEY ("indicator_code") REFERENCES "indicators"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_dataflow_mapping" ADD CONSTRAINT "indicator_dataflow_mapping_dataset_code_main_dataflow_code_fkey" FOREIGN KEY ("dataset_code", "main_dataflow_code") REFERENCES "dataflows"("dataset_code", "code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_dataflow_mapping" ADD CONSTRAINT "indicator_dataflow_mapping_dataset_code_secondary_dataflow_fkey" FOREIGN KEY ("dataset_code", "secondary_dataflow_code") REFERENCES "dataflows"("dataset_code", "code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_dataset_code_fkey" FOREIGN KEY ("dataset_code") REFERENCES "datasets"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_indicator_code_fkey" FOREIGN KEY ("indicator_code") REFERENCES "indicators"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_economy_code_fkey" FOREIGN KEY ("economy_code") REFERENCES "economies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_dataset_code_main_dataflow_code_fkey" FOREIGN KEY ("dataset_code", "main_dataflow_code") REFERENCES "dataflows"("dataset_code", "code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_dataset_code_secondary_dataflow_code_fkey" FOREIGN KEY ("dataset_code", "secondary_dataflow_code") REFERENCES "dataflows"("dataset_code", "code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_unit_code_fkey" FOREIGN KEY ("unit_code") REFERENCES "common_units"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_harmonized_unit_code_fkey" FOREIGN KEY ("harmonized_unit_code") REFERENCES "common_units"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_unit_mult_code_fkey" FOREIGN KEY ("unit_mult_code") REFERENCES "common_multipliers"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_harmonized_multiplier_code_fkey" FOREIGN KEY ("harmonized_multiplier_code") REFERENCES "common_multipliers"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation_extra_dimensions" ADD CONSTRAINT "observation_extra_dimensions_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation_extra_dimensions" ADD CONSTRAINT "observation_extra_dimensions_concept_code_fkey" FOREIGN KEY ("concept_code") REFERENCES "concepts"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation_attributes" ADD CONSTRAINT "observation_attributes_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation_attributes" ADD CONSTRAINT "observation_attributes_concept_code_fkey" FOREIGN KEY ("concept_code") REFERENCES "concepts"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation_history" ADD CONSTRAINT "observation_history_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation_history" ADD CONSTRAINT "observation_history_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_dataset_code_fkey" FOREIGN KEY ("dataset_code") REFERENCES "datasets"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_validation_messages" ADD CONSTRAINT "import_validation_messages_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataflow_constraints" ADD CONSTRAINT "dataflow_constraints_dataset_code_fkey" FOREIGN KEY ("dataset_code") REFERENCES "datasets"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataflow_constraints" ADD CONSTRAINT "dataflow_constraints_dataset_code_dataflow_code_fkey" FOREIGN KEY ("dataset_code", "dataflow_code") REFERENCES "dataflows"("dataset_code", "code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataflow_constraint_items" ADD CONSTRAINT "dataflow_constraint_items_constraint_id_fkey" FOREIGN KEY ("constraint_id") REFERENCES "dataflow_constraints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataflow_constraint_items" ADD CONSTRAINT "dataflow_constraint_items_concept_code_fkey" FOREIGN KEY ("concept_code") REFERENCES "concepts"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "currency_exchange_rates" ADD CONSTRAINT "currency_exchange_rates_source_currency_code_fkey" FOREIGN KEY ("source_currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "currency_exchange_rates" ADD CONSTRAINT "currency_exchange_rates_target_currency_code_fkey" FOREIGN KEY ("target_currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harmonization_rules" ADD CONSTRAINT "harmonization_rules_dataset_code_fkey" FOREIGN KEY ("dataset_code") REFERENCES "datasets"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harmonization_rules" ADD CONSTRAINT "harmonization_rules_indicator_code_fkey" FOREIGN KEY ("indicator_code") REFERENCES "indicators"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harmonization_rules" ADD CONSTRAINT "harmonization_rules_target_unit_code_fkey" FOREIGN KEY ("target_unit_code") REFERENCES "common_units"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harmonization_rules" ADD CONSTRAINT "harmonization_rules_target_multiplier_code_fkey" FOREIGN KEY ("target_multiplier_code") REFERENCES "common_multipliers"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harmonization_rules" ADD CONSTRAINT "harmonization_rules_dataset_code_dataflow_code_fkey" FOREIGN KEY ("dataset_code", "dataflow_code") REFERENCES "dataflows"("dataset_code", "code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harmonization_rule_items" ADD CONSTRAINT "harmonization_rule_items_harmonization_rule_id_fkey" FOREIGN KEY ("harmonization_rule_id") REFERENCES "harmonization_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harmonization_rule_items" ADD CONSTRAINT "harmonization_rule_items_economy_code_fkey" FOREIGN KEY ("economy_code") REFERENCES "economies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harmonization_rule_items" ADD CONSTRAINT "harmonization_rule_items_source_unit_code_fkey" FOREIGN KEY ("source_unit_code") REFERENCES "common_units"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harmonization_rule_items" ADD CONSTRAINT "harmonization_rule_items_target_unit_code_fkey" FOREIGN KEY ("target_unit_code") REFERENCES "common_units"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harmonization_rule_items" ADD CONSTRAINT "harmonization_rule_items_source_multiplier_code_fkey" FOREIGN KEY ("source_multiplier_code") REFERENCES "common_multipliers"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harmonization_rule_items" ADD CONSTRAINT "harmonization_rule_items_target_multiplier_code_fkey" FOREIGN KEY ("target_multiplier_code") REFERENCES "common_multipliers"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_configs" ADD CONSTRAINT "page_configs_dataset_code_fkey" FOREIGN KEY ("dataset_code") REFERENCES "datasets"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_configs" ADD CONSTRAINT "page_configs_target_unit_code_fkey" FOREIGN KEY ("target_unit_code") REFERENCES "common_units"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_configs" ADD CONSTRAINT "page_configs_target_multiplier_code_fkey" FOREIGN KEY ("target_multiplier_code") REFERENCES "common_multipliers"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_config_dataflows" ADD CONSTRAINT "page_config_dataflows_page_config_id_fkey" FOREIGN KEY ("page_config_id") REFERENCES "page_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_config_dataflows" ADD CONSTRAINT "page_config_dataflows_dataflowId_fkey" FOREIGN KEY ("dataflowId") REFERENCES "dataflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_config_indicators" ADD CONSTRAINT "page_config_indicators_page_config_id_fkey" FOREIGN KEY ("page_config_id") REFERENCES "page_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_config_economies" ADD CONSTRAINT "page_config_economies_page_config_id_fkey" FOREIGN KEY ("page_config_id") REFERENCES "page_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_config_economies" ADD CONSTRAINT "page_config_economies_economyId_fkey" FOREIGN KEY ("economyId") REFERENCES "economies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_config_periods" ADD CONSTRAINT "page_config_periods_page_config_id_fkey" FOREIGN KEY ("page_config_id") REFERENCES "page_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_config_visualizations" ADD CONSTRAINT "page_config_visualizations_page_config_id_fkey" FOREIGN KEY ("page_config_id") REFERENCES "page_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculated_indicators" ADD CONSTRAINT "calculated_indicators_indicator_code_fkey" FOREIGN KEY ("indicator_code") REFERENCES "indicators"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aggregation_rules" ADD CONSTRAINT "aggregation_rules_dataset_code_fkey" FOREIGN KEY ("dataset_code") REFERENCES "datasets"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aggregation_rules" ADD CONSTRAINT "aggregation_rules_indicator_code_fkey" FOREIGN KEY ("indicator_code") REFERENCES "indicators"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aggregation_rules" ADD CONSTRAINT "aggregation_rules_weight_indicator_code_fkey" FOREIGN KEY ("weight_indicator_code") REFERENCES "indicators"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_formulas" ADD CONSTRAINT "indicator_formulas_calculated_indicator_id_fkey" FOREIGN KEY ("calculated_indicator_id") REFERENCES "calculated_indicators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_formulas" ADD CONSTRAINT "indicator_formulas_source_indicator_code_fkey" FOREIGN KEY ("source_indicator_code") REFERENCES "indicators"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regional_definitions" ADD CONSTRAINT "regional_definitions_group_economy_code_fkey" FOREIGN KEY ("group_economy_code") REFERENCES "economies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regional_definitions" ADD CONSTRAINT "regional_definitions_member_economy_code_fkey" FOREIGN KEY ("member_economy_code") REFERENCES "economies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regional_weights" ADD CONSTRAINT "regional_weights_dataset_code_fkey" FOREIGN KEY ("dataset_code") REFERENCES "datasets"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regional_weights" ADD CONSTRAINT "regional_weights_group_economy_code_fkey" FOREIGN KEY ("group_economy_code") REFERENCES "economies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regional_weights" ADD CONSTRAINT "regional_weights_member_economy_code_fkey" FOREIGN KEY ("member_economy_code") REFERENCES "economies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Custom Unique Indexes
-- 1. Partial unique index on published observations (only one published observation per observation_hash)
CREATE UNIQUE INDEX "idx_unique_published_observation" ON "observations"("observation_hash") WHERE is_published = true;

-- 2. Indicator Dataset Metadata Unique Index with NULLS NOT DISTINCT
CREATE UNIQUE INDEX "idx_indicator_dataset_metadata_unique" ON "indicator_dataset_metadata"("dataset_code", "indicator_code", "division_code") NULLS NOT DISTINCT;

-- 3. Harmonization Rules Unique Index with NULLS NOT DISTINCT
CREATE UNIQUE INDEX "idx_harmonization_rules_unique" ON "harmonization_rules"("dataset_code", "dataflow_code", "indicator_code") NULLS NOT DISTINCT;

-- 4. Regional Definitions Unique Index with NULLS NOT DISTINCT
CREATE UNIQUE INDEX "idx_regional_definitions_unique" ON "regional_definitions"("group_economy_code", "member_economy_code") NULLS NOT DISTINCT;

-- 5. Regional Weights Unique Index with NULLS NOT DISTINCT
CREATE UNIQUE INDEX "idx_regional_weights_unique" ON "regional_weights"("dataset_code", "group_economy_code", "member_economy_code", "year", "weight_type") NULLS NOT DISTINCT;
