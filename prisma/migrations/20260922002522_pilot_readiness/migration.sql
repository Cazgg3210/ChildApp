-- CreateEnum
CREATE TYPE "InstitutionVerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFICATION_PENDING', 'VERIFIED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "GuardianInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Institution" ADD COLUMN     "address" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "verificationStatus" "InstitutionVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "GuardianInvitation" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "GuardianRole" NOT NULL DEFAULT 'CO_GUARDIAN',
    "relationshipLabel" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" "GuardianInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedById" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardianInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionGroup" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionGroupMember" (
    "groupId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "InstitutionGroupMember_pkey" PRIMARY KEY ("groupId","memberId")
);

-- CreateTable
CREATE TABLE "InstitutionGroupChild" (
    "groupId" TEXT NOT NULL,
    "childInstitutionId" TEXT NOT NULL,

    CONSTRAINT "InstitutionGroupChild_pkey" PRIMARY KEY ("groupId","childInstitutionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuardianInvitation_tokenHash_key" ON "GuardianInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "GuardianInvitation_childId_status_idx" ON "GuardianInvitation"("childId", "status");

-- CreateIndex
CREATE INDEX "GuardianInvitation_email_status_idx" ON "GuardianInvitation"("email", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionGroup_institutionId_name_key" ON "InstitutionGroup"("institutionId", "name");

-- CreateIndex
CREATE INDEX "InstitutionGroupMember_memberId_idx" ON "InstitutionGroupMember"("memberId");

-- CreateIndex
CREATE INDEX "InstitutionGroupChild_childInstitutionId_idx" ON "InstitutionGroupChild"("childInstitutionId");

-- AddForeignKey
ALTER TABLE "GuardianInvitation" ADD CONSTRAINT "GuardianInvitation_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianInvitation" ADD CONSTRAINT "GuardianInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianInvitation" ADD CONSTRAINT "GuardianInvitation_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionGroup" ADD CONSTRAINT "InstitutionGroup_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionGroupMember" ADD CONSTRAINT "InstitutionGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "InstitutionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionGroupMember" ADD CONSTRAINT "InstitutionGroupMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "InstitutionMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionGroupChild" ADD CONSTRAINT "InstitutionGroupChild_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "InstitutionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionGroupChild" ADD CONSTRAINT "InstitutionGroupChild_childInstitutionId_fkey" FOREIGN KEY ("childInstitutionId") REFERENCES "ChildInstitution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
