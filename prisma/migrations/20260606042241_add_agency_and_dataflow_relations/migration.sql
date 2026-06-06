-- DropIndex
DROP INDEX "idx_harmonization_rules_unique";

-- DropIndex
DROP INDEX "idx_indicator_dataset_metadata_unique";

-- DropIndex
DROP INDEX "idx_regional_definitions_unique";

-- DropIndex
DROP INDEX "idx_regional_weights_unique";

-- AlterTable
ALTER TABLE "dataflows" ADD COLUMN     "parent_code" VARCHAR;

-- AlterTable
ALTER TABLE "datasets" ADD COLUMN     "agency_code" VARCHAR NOT NULL DEFAULT 'ERDI';

-- AlterTable
ALTER TABLE "observations" ADD COLUMN     "agency_code" VARCHAR NOT NULL DEFAULT 'ERDI';

-- CreateTable
CREATE TABLE "agencies" (
    "id" UUID NOT NULL,
    "code" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- Insert default agency
INSERT INTO "agencies" ("id", "code", "name", "description", "updated_at")
VALUES ('a3b2c1d0-e4f5-5678-abcd-ef0123456789', 'ERDI', 'ERDI Statistical Platform', 'ERDI agency', CURRENT_TIMESTAMP);


-- CreateTable
CREATE TABLE "dataflow_indicators" (
    "dataflow_code" VARCHAR NOT NULL,
    "dataset_code" VARCHAR NOT NULL,
    "indicator_code" VARCHAR NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dataflow_indicators_pkey" PRIMARY KEY ("dataset_code","dataflow_code","indicator_code")
);

-- CreateIndex
CREATE UNIQUE INDEX "agencies_code_key" ON "agencies"("code");

-- CreateIndex
CREATE INDEX "observations_agency_code_idx" ON "observations"("agency_code");

-- AddForeignKey
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_agency_code_fkey" FOREIGN KEY ("agency_code") REFERENCES "agencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataflows" ADD CONSTRAINT "dataflows_dataset_code_parent_code_fkey" FOREIGN KEY ("dataset_code", "parent_code") REFERENCES "dataflows"("dataset_code", "code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_agency_code_fkey" FOREIGN KEY ("agency_code") REFERENCES "agencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataflow_indicators" ADD CONSTRAINT "dataflow_indicators_dataset_code_dataflow_code_fkey" FOREIGN KEY ("dataset_code", "dataflow_code") REFERENCES "dataflows"("dataset_code", "code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataflow_indicators" ADD CONSTRAINT "dataflow_indicators_indicator_code_fkey" FOREIGN KEY ("indicator_code") REFERENCES "indicators"("code") ON DELETE CASCADE ON UPDATE CASCADE;
