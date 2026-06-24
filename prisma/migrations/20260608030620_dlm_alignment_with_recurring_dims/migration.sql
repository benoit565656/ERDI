/*
  Warnings:

  - You are about to drop the column `is_active` on the `code_lists` table. All the data in the column will be lost.
  - You are about to drop the column `is_active` on the `dataflows` table. All the data in the column will be lost.
  - You are about to drop the column `is_active` on the `datasets` table. All the data in the column will be lost.
  - You are about to drop the column `is_active` on the `indicators` table. All the data in the column will be lost.
  - You are about to drop the `dataflow_constraint_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `dataflow_constraints` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `sort_order` on table `code_list_items` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sort_order` on table `dataflows` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "LifeCycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ConstraintScopeType" AS ENUM ('DATASET', 'DATAFLOW', 'INDICATOR', 'DATAFLOW_INDICATOR');

-- CreateEnum
CREATE TYPE "ConstraintRuleType" AS ENUM ('ALLOWED', 'FORBIDDEN', 'REQUIRED');

-- DropForeignKey
ALTER TABLE "dataflow_constraint_items" DROP CONSTRAINT "dataflow_constraint_items_concept_code_fkey";

-- DropForeignKey
ALTER TABLE "dataflow_constraint_items" DROP CONSTRAINT "dataflow_constraint_items_constraint_id_fkey";

-- DropForeignKey
ALTER TABLE "dataflow_constraints" DROP CONSTRAINT "dataflow_constraints_dataset_code_dataflow_code_fkey";

-- DropForeignKey
ALTER TABLE "dataflow_constraints" DROP CONSTRAINT "dataflow_constraints_dataset_code_fkey";

-- AlterTable
ALTER TABLE "agencies" ADD COLUMN     "contact_email" VARCHAR,
ADD COLUMN     "status" "LifeCycleStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "website" VARCHAR;

-- AlterTable
ALTER TABLE "code_list_items" ALTER COLUMN "sort_order" SET NOT NULL,
ALTER COLUMN "sort_order" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "code_lists" DROP COLUMN "is_active",
ADD COLUMN     "agency_code" VARCHAR NOT NULL DEFAULT 'ERDI',
ADD COLUMN     "is_hierarchical" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "related_concept_code" VARCHAR,
ADD COLUMN     "status" "LifeCycleStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "version" VARCHAR;

-- AlterTable
ALTER TABLE "concept_schemes" ADD COLUMN     "status" "LifeCycleStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "concepts" ADD COLUMN     "data_type" VARCHAR,
ADD COLUMN     "default_role" VARCHAR,
ADD COLUMN     "is_coded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "LifeCycleStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "dataflow_indicators" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_main_dataflow" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_secondary_dataflow" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "dataflows" DROP COLUMN "is_active",
ADD COLUMN     "status" "LifeCycleStatus" NOT NULL DEFAULT 'ACTIVE',
ALTER COLUMN "sort_order" SET NOT NULL,
ALTER COLUMN "sort_order" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "datasets" DROP COLUMN "is_active",
ADD COLUMN     "default_frequency" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "LifeCycleStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "dsd_components" ADD COLUMN     "default_value" VARCHAR;

-- AlterTable
ALTER TABLE "dsds" ADD COLUMN     "status" "LifeCycleStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "import_validation_messages" ADD COLUMN     "observation_hash" VARCHAR,
ALTER COLUMN "row_number" DROP NOT NULL;

-- AlterTable
ALTER TABLE "indicators" DROP COLUMN "is_active",
ADD COLUMN     "category" VARCHAR,
ADD COLUMN     "default_freq_code" VARCHAR,
ADD COLUMN     "default_unit_code" VARCHAR,
ADD COLUMN     "default_unit_mult_code" VARCHAR,
ADD COLUMN     "definition" TEXT,
ADD COLUMN     "methodology" TEXT,
ADD COLUMN     "short_name" VARCHAR,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "status" "LifeCycleStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "observations" ADD COLUMN     "adjustment_code" VARCHAR,
ADD COLUMN     "age_code" VARCHAR,
ADD COLUMN     "counterpart_area_code" VARCHAR,
ADD COLUMN     "currency_code" VARCHAR,
ADD COLUMN     "occupation_code" VARCHAR,
ADD COLUMN     "ownership_code" VARCHAR,
ADD COLUMN     "price_base_code" VARCHAR,
ADD COLUMN     "region_code" VARCHAR,
ADD COLUMN     "sector_code" VARCHAR,
ADD COLUMN     "sex_code" VARCHAR,
ADD COLUMN     "size_class_code" VARCHAR;

-- DropTable
DROP TABLE "dataflow_constraint_items";

-- DropTable
DROP TABLE "dataflow_constraints";

-- CreateTable
CREATE TABLE "constraints" (
    "id" UUID NOT NULL,
    "scope_type" "ConstraintScopeType" NOT NULL,
    "dataset_code" VARCHAR NOT NULL,
    "dataflow_code" VARCHAR,
    "indicator_code" VARCHAR,
    "name" VARCHAR NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "constraints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "constraint_items" (
    "id" UUID NOT NULL,
    "constraint_id" UUID NOT NULL,
    "concept_code" VARCHAR NOT NULL,
    "rule_type" "ConstraintRuleType" NOT NULL,
    "code_value" VARCHAR,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "constraint_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "code_lists" ADD CONSTRAINT "code_lists_agency_code_fkey" FOREIGN KEY ("agency_code") REFERENCES "agencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constraints" ADD CONSTRAINT "constraints_dataset_code_fkey" FOREIGN KEY ("dataset_code") REFERENCES "datasets"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constraints" ADD CONSTRAINT "constraints_dataset_code_dataflow_code_fkey" FOREIGN KEY ("dataset_code", "dataflow_code") REFERENCES "dataflows"("dataset_code", "code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constraints" ADD CONSTRAINT "constraints_indicator_code_fkey" FOREIGN KEY ("indicator_code") REFERENCES "indicators"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constraint_items" ADD CONSTRAINT "constraint_items_constraint_id_fkey" FOREIGN KEY ("constraint_id") REFERENCES "constraints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constraint_items" ADD CONSTRAINT "constraint_items_concept_code_fkey" FOREIGN KEY ("concept_code") REFERENCES "concepts"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
