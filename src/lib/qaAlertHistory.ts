
import { db } from './firebase';
import { collection, addDoc, query, where, getDocs, orderBy, limit, serverTimestamp, updateDoc, doc } from 'firebase/firestore';

export type AlertLevel = "stable" | "caution" | "needs_review" | "critical";
export type AlertStatus = "open" | "acknowledged" | "resolved";

export interface QAAlert {
  alertId?: string;
  level: AlertLevel;
  reason: string;
  relatedMetric: string;
  triggeredAt: any;
  resolvedAt?: any;
  status: AlertStatus;
  acknowledgedBy?: string;
  resolutionNote?: string;
}

/**
 * [PetLog v1.1.2 Alert History & Resolution Workflow]
 */
export async function recordAlert(alert: Omit<QAAlert, 'triggeredAt' | 'status'>): Promise<void> {
  try {
    const q = query(
      collection(db, 'qa_alerts'),
      where('relatedMetric', '==', alert.relatedMetric),
      where('status', '==', 'open'),
      orderBy('triggeredAt', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    
    // Cooldown logic: Don't create if an open alert for the same metric exists
    if (!snap.empty) {
      console.log(`[Alert Cooldown] Open alert for ${alert.relatedMetric} already exists.`);
      return;
    }

    await addDoc(collection(db, 'qa_alerts'), {
      ...alert,
      triggeredAt: serverTimestamp(),
      status: 'open'
    });
  } catch (e) {
    console.error('Failed to record alert:', e);
  }
}

export async function getRecentAlerts(count: number = 10): Promise<QAAlert[]> {
  const q = query(collection(db, 'qa_alerts'), orderBy('triggeredAt', 'desc'), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ alertId: d.id, ...d.data() } as QAAlert));
}

export async function updateAlertStatus(alertId: string, status: AlertStatus, note?: string, user?: string): Promise<void> {
  const alertRef = doc(db, 'qa_alerts', alertId);
  const updateData: any = { status };
  if (status === 'resolved') updateData.resolvedAt = serverTimestamp();
  if (note) updateData.resolutionNote = note;
  if (user) updateData.acknowledgedBy = user;
  
  await updateDoc(alertRef, updateData);
}
