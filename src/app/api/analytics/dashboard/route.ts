import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const totalSessions = await prisma.session.count();
    const sessions = await prisma.session.findMany({
      select: {
        startedAt: true,
        lastActiveAt: true,
        isBounce: true
      }
    });

    let totalSeconds = 0;
    let bounceCount = 0;

    for (const s of sessions) {
      if (s.isBounce) bounceCount++;
      const diff = (new Date(s.lastActiveAt).getTime() - new Date(s.startedAt).getTime()) / 1000;
      if (diff > 0) {
         totalSeconds += diff;
      }
    }

    const averageSessionSeconds = totalSessions > 0 ? Math.round(totalSeconds / totalSessions) : 0;
    const abandonmentRate = totalSessions > 0 ? Math.round((bounceCount / totalSessions) * 100) : 0;

    const resetSetting = await prisma.systemSetting.findUnique({
      where: { key: "analyticsResetDate" }
    });
    
    let leadFilter: Record<string, unknown> = {};
    if (resetSetting?.value) {
       leadFilter = { createdAt: { gte: new Date(resetSetting.value) } };
    }

    const totalDownloads = await prisma.lead.count({ where: leadFilter });
    
    // Ošetriť nulové delenie
    const conversionRate = totalSessions > 0 ? ((totalDownloads / totalSessions) * 100).toFixed(1) : "0";

    // Populárne (agregácia)
    const events = await prisma.telemetryEvent.findMany({
      select: { eventType: true, eventData: true }
    });

    const popularCounters: Record<string, Record<string, number>> = {
      BRICK_SELECT: {},
      JOINT_SELECT: {},
      BOND_SELECT: {}
    };

    for (const e of events) {
      if (popularCounters[e.eventType]) {
         let value = e.eventData;
         try {
           const parsed = JSON.parse(e.eventData);
           if (parsed.value) value = parsed.value;
         } catch(err) {
           // fallback na string
         }
         
         if (!popularCounters[e.eventType][value]) {
            popularCounters[e.eventType][value] = 0;
         }
         popularCounters[e.eventType][value]++;
      }
    }

    const mapToSortedArray = (obj: Record<string, number>) => {
      return Object.entries(obj)
        .map(([name, sessionViews]) => ({ name, sessionViews, totalScore: sessionViews }))
        .sort((a, b) => b.sessionViews - a.sessionViews);
    };

    const popular = {
      bricks: mapToSortedArray(popularCounters['BRICK_SELECT']),
      joints: mapToSortedArray(popularCounters['JOINT_SELECT']),
      bonds: mapToSortedArray(popularCounters['BOND_SELECT'])
    };

    return successResponse({
      summary: {
        totalSessions,
        averageSessionSeconds,
        abandonmentRate,
        totalDownloads,
        conversionRate,
      },
      popular
    });

  } catch (err) {
    console.error("[analytics dashboard] Failed to fetch dashboard data:", err);
    return errorResponse("DB_ERROR", "Failed to fetch dashboard data", 500);
  }
}
