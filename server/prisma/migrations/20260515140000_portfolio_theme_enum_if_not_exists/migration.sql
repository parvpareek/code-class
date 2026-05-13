-- Re-apply safely when a database missed the earlier enum migration (PostgreSQL 15+).
-- See: https://www.postgresql.org/docs/current/sql-altertype.html
ALTER TYPE "PortfolioTheme" ADD VALUE IF NOT EXISTS 'VOID';
ALTER TYPE "PortfolioTheme" ADD VALUE IF NOT EXISTS 'PAPER';
ALTER TYPE "PortfolioTheme" ADD VALUE IF NOT EXISTS 'EMBER';
ALTER TYPE "PortfolioTheme" ADD VALUE IF NOT EXISTS 'FROST';
ALTER TYPE "PortfolioTheme" ADD VALUE IF NOT EXISTS 'GLACIER';
ALTER TYPE "PortfolioTheme" ADD VALUE IF NOT EXISTS 'PAAN';
