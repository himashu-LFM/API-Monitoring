"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppState } from "@/hooks/use-app-state";
import { RenewalList } from "@/components/renewals/renewal-list";

export function UpcomingRenewals() {
  const { services } = useAppState();
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Upcoming renewals</CardTitle>
        <Link href="/renewals" className="flex items-center gap-1 text-xs font-medium text-info hover:underline">
          View all <ArrowRight className="size-3" />
        </Link>
      </CardHeader>
      <CardContent>
        <RenewalList services={services} limit={4} />
      </CardContent>
    </Card>
  );
}
