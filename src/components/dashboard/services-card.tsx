"use client";

import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/states";
import { ApiTable } from "@/components/apis/api-table";
import { useAppState } from "@/hooks/use-app-state";

export function ServicesCard() {
  const { services } = useAppState();
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-base">Services</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">Live usage across all monitored APIs</p>
        </div>
        <Link href="/apis" className="flex items-center gap-1 text-xs font-medium text-info hover:underline">
          View all <ArrowRight className="size-3" />
        </Link>
      </CardHeader>
      {services.length === 0
        ? <EmptyState icon={Layers} title="No APIs connected yet." description="Add a service to start monitoring." />
        : <ApiTable services={services} />}
    </Card>
  );
}
