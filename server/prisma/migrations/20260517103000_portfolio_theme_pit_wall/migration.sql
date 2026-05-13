-- Signature open-wheel telemetry theme (replaces experimental NIGHT_CIRCUIT label in DB rows).
ALTER TYPE "PortfolioTheme" ADD VALUE IF NOT EXISTS 'PIT_WALL';

UPDATE "PortfolioProfile" SET theme = 'PIT_WALL' WHERE theme::text = 'NIGHT_CIRCUIT';
