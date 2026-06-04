
import { TriagePriority, TriageSeverity, TriageResult } from './qaValidationTriage';

export type SLAStatus = "on_track" | "at_risk" | "overdue" | "resolved";

export interface SLARecord {
  slaId?: string;
  triageId: string;
  priority: TriagePriority;
  severity: TriageSeverity;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  acknowledgeDueAt: Date;
  resolveDueAt: Date;
  isAcknowledgeOverdue: boolean;
  isResolveOverdue: boolean;
  slaStatus: SLAStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * [PetLog v1.2.2 Triage SLA / Response Time Tracking]
 * 우선순위에 따른 인지 및 해결 기한을 관리합니다.
 */
export function calculateSLA(triage: TriageResult): SLARecord {
  const createdAt = triage.createdAt;
  let ackHours = 72;
  let resHours = 336;

  switch (triage.priority) {
    case "p0": ackHours = 2; resHours = 24; break;
    case "p1": ackHours = 8; resHours = 72; break;
    case "p2": ackHours = 24; resHours = 168; break;
    case "p3": ackHours = 72; resHours = 336; break;
  }

  const ackDue = new Date(createdAt.getTime() + ackHours * 60 * 60 * 1000);
  const resDue = new Date(createdAt.getTime() + resHours * 60 * 60 * 1000);

  return {
    triageId: triage.triageId || "unknown",
    priority: triage.priority,
    severity: triage.severity,
    acknowledgeDueAt: ackDue,
    resolveDueAt: resDue,
    isAcknowledgeOverdue: new Date() > ackDue && !triage.assignedTo,
    isResolveOverdue: new Date() > resDue && triage.status !== "resolved",
    slaStatus: "on_track",
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

export function getSLADisplayStatus(sla: SLARecord): { label: string, color: string } {
  if (sla.isResolveOverdue || sla.isAcknowledgeOverdue) {
    return { label: "OVERDUE", color: "text-red-500" };
  }
  const now = new Date();
  const timeLeft = sla.resolveDueAt.getTime() - now.getTime();
  if (timeLeft < 4 * 60 * 60 * 1000) { // 4시간 미만
    return { label: "AT RISK", color: "text-orange-500" };
  }
  return { label: "ON TRACK", color: "text-green-500" };
}
