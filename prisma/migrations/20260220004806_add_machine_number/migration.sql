-- DropIndex
DROP INDEX "Booking_startTime_endTime_idx";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "machineNumber" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "Booking_machineNumber_startTime_endTime_idx" ON "Booking"("machineNumber", "startTime", "endTime");
