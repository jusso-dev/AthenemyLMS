import { BadgePercent, Boxes, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentAppUser } from "@/lib/auth";
import { databaseIsConfigured, fallbackNotice } from "@/lib/dashboard-data";
import { canManageOrganization } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";
import { SetupMessage } from "@/lib/setup-message";
import { formatPrice } from "@/lib/utils";

export default async function CommercePage() {
  const hasDatabase = databaseIsConfigured();
  const user = await getCurrentAppUser();
  const memberships =
    hasDatabase && user
      ? await prisma.organizationMembership.findMany({
          where: { userId: user.id },
          include: {
            organization: {
              include: {
                bundles: {
                  include: { items: true },
                  orderBy: { updatedAt: "desc" },
                },
                coupons: { orderBy: { updatedAt: "desc" } },
              },
            },
          },
        })
      : [];
  const primary = memberships.find((membership) =>
    canManageOrganization(user, membership),
  )?.organization;

  return (
    <div className="space-y-8">
      {!hasDatabase ? <SetupMessage {...fallbackNotice()} /> : null}
      <PageHeader
        title="Commerce"
        description="Bundles, coupons, subscription-ready pricing records, and checkout foundations."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <Boxes className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm text-muted-foreground">
              Bundles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {primary?.bundles.length ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <BadgePercent className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm text-muted-foreground">
              Coupons
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {primary?.coupons.length ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm text-muted-foreground">
              Checkout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="success">Stripe ready</Badge>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Bundles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!primary ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Organisation admin access is required to manage commerce.
            </p>
          ) : null}
          {primary?.bundles.length === 0 ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              No bundles have been created yet.
            </p>
          ) : null}
          {primary?.bundles.map((bundle) => (
            <div key={bundle.id} className="rounded-md border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{bundle.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {bundle.items.length} courses ·{" "}
                    {formatPrice(bundle.priceCents, bundle.currency)}
                  </p>
                </div>
                <Badge
                  variant={
                    bundle.status === "PUBLISHED" ? "success" : "outline"
                  }
                >
                  {bundle.status}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Coupons</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {primary?.coupons.length === 0 ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              No coupons have been created yet.
            </p>
          ) : null}
          {primary?.coupons.map((coupon) => (
            <div
              key={coupon.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div>
                <p className="font-medium">{coupon.code}</p>
                <p className="text-sm text-muted-foreground">
                  {coupon.discountType === "PERCENT"
                    ? `${coupon.percentOff ?? 0}% off`
                    : `${formatPrice(coupon.amountOffCents ?? 0, coupon.currency)} off`}
                </p>
              </div>
              <Badge variant={coupon.active ? "success" : "outline"}>
                {coupon.active ? "Active" : "Inactive"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
