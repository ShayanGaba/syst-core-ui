import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

export interface SystemNode {
  id: string;
  name: string;
  type: 'consumer' | 'enterprise' | 'secure';
  status: 'ONLINE' | 'THROTTLED' | 'ISOLATED' | 'COMPROMISED';
  bandwidthUsage: number;
  slaPerformance: number;
  monthlyCalls: string;
}

export interface AuditLog {
  timestamp: string;
  scope: string;
  event: string;
  severity: 'SUCCESS' | 'INFO' | 'WARN' | 'CRITICAL';
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = 'https://syst-core-api.vercel.app';

  // State Management Signals
  public token = signal<string | null>(localStorage.getItem('token'));
  public activeOperator = signal<string>(localStorage.getItem('operator') || 'UNAUTHORIZED');
  public clearanceRole = signal<string>(localStorage.getItem('role') || 'GUEST');

  public totalNetworkTraffic = signal<number>(142850);
  public isAttackActive = signal<boolean>(false);
  public globalShieldEngaged = signal<boolean>(false);

  public nodes = signal<SystemNode[]>([]);
  public auditLogs = signal<AuditLog[]>([]);

  private syncInterval: any = null;

  globalBandwidthAverage = computed(() => {
    const activeNodes = this.nodes().filter((n) => n.status !== 'ISOLATED');
    if (activeNodes.length === 0) return 0;
    const total = activeNodes.reduce((acc, curr) => acc + curr.bandwidthUsage, 0);
    return Math.round(total / activeNodes.length);
  });

  constructor() {
    // If a session already exists on boot, fire up the telemetry sync engines immediately
    if (this.token()) {
      this.startLiveTelemetrySync();
    }
  }

  private getHeaders() {
    return {
      headers: new HttpHeaders({
        Authorization: `Bearer ${this.token()}`,
      }),
    };
  }

  // Starts real-time automated background polling for terminal logs and infrastructure health
  public startLiveTelemetrySync() {
    if (this.syncInterval) clearInterval(this.syncInterval);

    // Fetch immediately on activation
    this.syncTelemetryData();

    // Continuously pull updates every 2000ms (2 seconds) to keep the terminal updating live
    this.syncInterval = setInterval(() => {
      this.syncTelemetryData();
    }, 2000);
  }

  public stopLiveTelemetrySync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private syncTelemetryData() {
    if (!this.token()) return;

    // Direct background stream for infrastructure nodes
    this.http.get<SystemNode[]>(`${this.baseUrl}/metrics/nodes`, this.getHeaders()).subscribe({
      next: (data) => this.nodes.set(data),
      error: (err) => console.error('Telemetry node sync drop:', err),
    });

    // Direct background stream for the live command line terminal feed
    this.http.get<any[]>(`${this.baseUrl}/metrics/logs`, this.getHeaders()).subscribe({
      next: (data) => {
        const parsedLogs: AuditLog[] = data.map((log) => ({
          timestamp: log.timestamp,
          scope: log.scope,
          event: log.event,
          severity: log.severity === 'WARN' ? 'WARN' : log.severity,
        }));
        this.auditLogs.set(parsedLogs);
      },
      error: (err) => console.error('Terminal feed log sync drop:', err),
    });
  }

  // Mutation commands - automatically triggers an immediate sync refresh upon completion
  public toggleNodeStatus(nodeId: string, instruction: 'THROTTLE' | 'ISOLATE' | 'RESTORE') {
    return this.http
      .post<
        SystemNode[]
      >(`${this.baseUrl}/metrics/nodes/${nodeId}/status`, { instruction }, this.getHeaders())
      .subscribe({
        next: (updatedNodes) => {
          this.nodes.set(updatedNodes);
          this.syncTelemetryData();
        },
      });
  }

  public engageCounterMeasureShield() {
    return this.http
      .post<any>(`${this.baseUrl}/metrics/system/shield`, {}, this.getHeaders())
      .subscribe({
        next: (res) => {
          this.nodes.set(res.nodes);
          this.globalShieldEngaged.set(true);
          this.isAttackActive.set(false);
          this.syncTelemetryData();
        },
      });
  }

  public injectBreachSimulation() {
    return this.http
      .post<any>(`${this.baseUrl}/metrics/system/breach-test`, {}, this.getHeaders())
      .subscribe({
        next: (res) => {
          this.nodes.set(res.nodes);
          this.isAttackActive.set(true);
          this.globalShieldEngaged.set(false);
          this.syncTelemetryData();
        },
      });
  }

  // Authentication interface controllers
  public handleLoginSuccess(token: string, operator: string, role: string) {
    localStorage.setItem('token', token);
    localStorage.setItem('operator', operator);
    localStorage.setItem('role', role);

    this.token.set(token);
    this.activeOperator.set(operator);
    this.clearanceRole.set(role);

    this.startLiveTelemetrySync();
  }

  public disconnectSession() {
    localStorage.clear();
    this.token.set(null);
    this.activeOperator.set('UNAUTHORIZED');
    this.clearanceRole.set('GUEST');
    this.nodes.set([]);
    this.auditLogs.set([]);
    this.stopLiveTelemetrySync();
  }
}
