-- Offline payment rails. NEFT/IMPS/RTGS is not NET_BANKING (a bank's online
-- checkout via a gateway) and a cheque is not CASH; both appear on invoices
-- and in accounting, so they get their own values rather than a near-enough one.

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'BANK_TRANSFER';

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'CHEQUE';
