import type { ServiceStatus } from "@/lib/types";
import { Adapter, env } from "./base";
import zyte from "./zyte";
import google from "./google";
import hootsuite from "./hootsuite";
import decodo from "./decodo";

// Order controls dashboard display order.
export const ADAPTERS: Adapter[] = [zyte, google, hootsuite, decodo];

export async function getAllStatuses(): Promise<ServiceStatus[]> {
  return Promise.all(
    ADAPTERS.map(async (a): Promise<ServiceStatus> => {
      let result;
      try {
        result = await a.getUsage();
      } catch (e) {
        result = {
          usage: null, limit: null, usageTracked: true,
          status: "error" as const, message: (e as Error).message,
        };
      }
      return {
        id: a.id,
        name: a.name,
        provider: a.provider,
        color: a.color,
        unit: a.unit,
        renewalISO: env(`${a.id.toUpperCase()}_RENEWAL`) ?? null,
        ...result,
      };
    })
  );
}
