-- DropIndex
DROP INDEX "invoices_company_id_number_key";

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "numbering_next_advance" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "invoices_company_id_type_number_key" ON "invoices"("company_id", "type", "number");

