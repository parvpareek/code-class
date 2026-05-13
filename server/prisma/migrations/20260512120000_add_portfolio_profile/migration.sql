-- CreateEnum
CREATE TYPE "PortfolioTheme" AS ENUM ('MINIMAL', 'MONOCHROME', 'TERMINAL', 'GLASS', 'HACKER');

-- CreateTable
CREATE TABLE "PortfolioProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "theme" "PortfolioTheme" NOT NULL DEFAULT 'MINIMAL',
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioProfile_userId_key" ON "PortfolioProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioProfile_slug_key" ON "PortfolioProfile"("slug");

-- CreateIndex
CREATE INDEX "PortfolioProfile_slug_idx" ON "PortfolioProfile"("slug");

-- CreateIndex
CREATE INDEX "PortfolioProfile_published_idx" ON "PortfolioProfile"("published");

-- AddForeignKey
ALTER TABLE "PortfolioProfile" ADD CONSTRAINT "PortfolioProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
