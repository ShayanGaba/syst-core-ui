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

  // Core Identity State Signals
  public token = signal<string | null>(localStorage.getItem('token'));
  public activeOperator = signal<string>(localStorage.getItem('operator') || 'UNAUTHORIZED');
  public clearanceRole = signal<string>(localStorage.getItem('role') || 'GUEST');

  // Interface Navigation Tab State
  public activeTab = signal<string>('matrix');

  // Network Telemetry Channels
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

  // Layout Tab Interface Engine Controls
  public setTab(tabName: string) {
    this.activeTab.set(tabName);
  }

  // Authentication Handshake Channel Router
  public executeHandshake(usernameInput: string, passwordInput: string) {
    this.http
      .post<any>(`${this.baseUrl}/auth/login`, { username: usernameInput, password: passwordInput })
      .subscribe({
        next: (res) => {
          const token = res.token || res.accessToken;
          const operator = res.operator || res.username || usernameInput;
          const role = res.role || res.clearance || 'USER';

          if (token) {
            this.handleLoginSuccess(token, operator, role);
          }
        },
        error: (err) => console.error('System authentication breach failed:', err),
      });
  }

  // Continuous Telemetry Stream Synchronization
  public startLiveTelemetrySync() {
    if (this.syncInterval) clearInterval(this.syncInterval);

    this.syncTelemetryData();

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

    this.http.get<SystemNode[]>(`${this.baseUrl}/metrics/nodes`, this.getHeaders()).subscribe({
      next: (data) => this.nodes.set(data),
      error: (err) => console.error('Node telemetry pipeline broken:', err),
    });

    this.http.get<any[]>(`${this.baseUrl}/metrics/logs`, this.getHeaders()).subscribe({
      next: (data) => {
        const parsedLogs: AuditLog[] = data.map((log) => ({
          timestamp: log.timestamp || log.createdAt || new Date().toISOString(),
          scope: log.scope || log.tenantId || 'GLOBAL_SYSTEM',
          event: log.event || log.action,
          severity: log.severity === 'WARN' ? 'WARN' : log.severity || 'INFO',
        }));
        this.auditLogs.set(parsedLogs);
      },
      error: (err) => console.error('Ledger terminal logging stream disconnected:', err),
    });
  }

  // Mutation and Control Methods
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

  public provisionNewNode(name: string, type: 'consumer' | 'enterprise' | 'secure') {
    return this.http
      .post<
        SystemNode[]
      >(`${this.baseUrl}/metrics/nodes/provision`, { name, type }, this.getHeaders())
      .subscribe({
        next: (updatedNodes) => {
          this.nodes.set(updatedNodes);
          this.syncTelemetryData();
        },
        error: (err) => console.error('Cloud deployment generation drop:', err),
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

  public handleLoginSuccess(token: string, operator: string, role: string) {
    localStorage.setItem('token', token);
    localStorage.setItem('operator', operator);
    localStorage.setItem('role', role);

    this.token.set(token);
    this.activeOperator.set(operator);
    this.clearanceRole.set(role);

    this.startLiveTelemetrySync();
  }

  public terminateSession() {
    localStorage.clear();
    this.token.set(null);
    this.activeOperator.set('UNAUTHORIZED');
    this.clearanceRole.set('GUEST');
    this.nodes.set([]);
    this.auditLogs.set([]);
    this.stopLiveTelemetrySync();
  }
}
