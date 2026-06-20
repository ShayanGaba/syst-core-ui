import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

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

  // Navigation Tab State
  public activeTab = signal<string>('matrix');

  // Telemetry Data Stores
  public totalNetworkTraffic = signal<number>(142850);
  public isAttackActive = signal<boolean>(false);
  public globalShieldEngaged = signal<boolean>(false);

  public nodes = signal<SystemNode[]>([]);
  public auditLogs = signal<AuditLog[]>([]);

  globalBandwidthAverage = computed(() => {
    const activeNodes = this.nodes().filter((n) => n.status !== 'ISOLATED');
    if (activeNodes.length === 0) return 0;
    const total = activeNodes.reduce((acc, curr) => acc + curr.bandwidthUsage, 0);
    return Math.round(total / activeNodes.length);
  });

  constructor() {
    if (this.token()) {
      this.fetchDashboardData();
    }
  }

  private getHeaders() {
    return {
      headers: new HttpHeaders({
        Authorization: `Bearer ${this.token()}`,
      }),
    };
  }

  public setTab(tabName: string) {
    this.activeTab.set(tabName);
  }

  // Heavy-duty login handler that checks all possible token properties
  public executeHandshake(usernameInput: string, passwordInput: string): Observable<any> {
    return this.http
      .post<any>(`${this.baseUrl}/auth/login`, { username: usernameInput, password: passwordInput })
      .pipe(
        tap((res) => {
          // Checks every single common variant (including standard NestJS access_token)
          const token =
            res?.token ||
            res?.accessToken ||
            res?.access_token ||
            res?.data?.token ||
            res?.data?.access_token;
          const operator = res?.operator || res?.username || res?.user?.username || usernameInput;
          const role = res?.role || res?.clearance || res?.user?.role || 'ADMIN';

          if (token) {
            localStorage.setItem('token', token);
            localStorage.setItem('operator', operator);
            localStorage.setItem('role', role);

            this.token.set(token);
            this.activeOperator.set(operator);
            this.clearanceRole.set(role);

            this.fetchDashboardData();
          } else {
            console.error(
              'Authentication responded successfully, but no valid token key was detected in payload:',
              res,
            );
          }
        }),
      );
  }

  public fetchDashboardData() {
    if (!this.token()) return;

    this.http.get<SystemNode[]>(`${this.baseUrl}/metrics/nodes`, this.getHeaders()).subscribe({
      next: (data) => this.nodes.set(data),
      error: (err) => console.error('Failed to load infrastructure data:', err),
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
      error: (err) => console.error('Failed to load audit logs:', err),
    });
  }

  public toggleNodeStatus(
    nodeId: string,
    instruction: 'THROTTLE' | 'ISOLATE' | 'RESTORE',
  ): Observable<SystemNode[]> {
    return this.http
      .post<
        SystemNode[]
      >(`${this.baseUrl}/metrics/nodes/${nodeId}/status`, { instruction }, this.getHeaders())
      .pipe(
        tap((updatedNodes) => {
          this.nodes.set(updatedNodes);
          this.fetchDashboardData();
        }),
      );
  }

  public provisionNewNode(
    name: string,
    type: 'consumer' | 'enterprise' | 'secure',
  ): Observable<SystemNode[]> {
    return this.http
      .post<
        SystemNode[]
      >(`${this.baseUrl}/metrics/nodes/provision`, { name, type }, this.getHeaders())
      .pipe(
        tap((updatedNodes) => {
          this.nodes.set(updatedNodes);
          this.fetchDashboardData();
        }),
      );
  }

  public engageCounterMeasureShield(): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/metrics/system/shield`, {}, this.getHeaders()).pipe(
      tap((res) => {
        this.nodes.set(res.nodes);
        this.globalShieldEngaged.set(true);
        this.isAttackActive.set(false);
        this.fetchDashboardData();
      }),
    );
  }

  public injectBreachSimulation(): Observable<any> {
    return this.http
      .post<any>(`${this.baseUrl}/metrics/system/breach-test`, {}, this.getHeaders())
      .pipe(
        tap((res) => {
          this.nodes.set(res.nodes);
          this.isAttackActive.set(true);
          this.globalShieldEngaged.set(false);
          this.fetchDashboardData();
        }),
      );
  }

  public terminateSession() {
    localStorage.clear();
    this.token.set(null);
    this.activeOperator.set('UNAUTHORIZED');
    this.clearanceRole.set('GUEST');
    this.nodes.set([]);
    this.auditLogs.set([]);
  }
}
