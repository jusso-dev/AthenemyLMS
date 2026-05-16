-- CreateEnum
CREATE TYPE "PortalStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "PortalPageType" AS ENUM ('HOME', 'CATALOG', 'COURSE_TEMPLATE', 'AFTER_LOGIN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PortalBlockType" AS ENUM ('HERO', 'FEATURED_COURSES', 'COURSE_CATALOG', 'RICH_TEXT', 'IMAGE_TEXT', 'INSTRUCTOR_PROFILE', 'TESTIMONIALS', 'FAQ', 'CTA', 'PRICING', 'LOGIN_SIGNUP', 'RESUME_LEARNING', 'REQUIRED_WORK', 'COURSE_COLLECTION');

-- CreateTable
CREATE TABLE "OrganizationPortal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "PortalStatus" NOT NULL DEFAULT 'DRAFT',
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#1e3a8a',
    "accentColor" TEXT NOT NULL DEFAULT '#0f766e',
    "fontFamily" TEXT NOT NULL DEFAULT 'sans',
    "buttonStyle" TEXT NOT NULL DEFAULT 'rounded',
    "navLinks" JSONB,
    "footerLinks" JSONB,
    "publishedTheme" JSONB,
    "customDomain" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationPortal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalPage" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "type" "PortalPageType" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "status" "PortalStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedTitle" TEXT,
    "publishedSeoTitle" TEXT,
    "publishedSeoDescription" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PortalPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalBlock" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "type" "PortalBlockType" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL,
    "publishedConfig" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PortalBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationPortal_organizationId_key" ON "OrganizationPortal"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationPortal_status_idx" ON "OrganizationPortal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PortalPage_portalId_type_key" ON "PortalPage"("portalId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "PortalPage_portalId_slug_key" ON "PortalPage"("portalId", "slug");

-- CreateIndex
CREATE INDEX "PortalPage_type_status_idx" ON "PortalPage"("type", "status");

-- CreateIndex
CREATE INDEX "PortalBlock_pageId_position_idx" ON "PortalBlock"("pageId", "position");

-- CreateIndex
CREATE INDEX "PortalBlock_type_idx" ON "PortalBlock"("type");

-- AddForeignKey
ALTER TABLE "OrganizationPortal" ADD CONSTRAINT "OrganizationPortal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalPage" ADD CONSTRAINT "PortalPage_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "OrganizationPortal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalBlock" ADD CONSTRAINT "PortalBlock_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "PortalPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
