import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

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

  public token = signal<string | null>(null);
  public activeOperator = signal<string>('UNAUTHORIZED');
  public clearanceRole = signal<string>('GUEST');

  public totalNetworkTraffic = signal<number>(142850);
  public isAttackActive = signal<boolean>(false);
  public globalShieldEngaged = signal<boolean>(false);

  public nodes = signal<SystemNode[]>([]);
  public auditLogs = signal<AuditLog[]>([]);

  public globalBandwidthAverage = computed(() => {
    const activeNodes = this.nodes().filter((n) => n.status !== 'ISOLATED');
    if (activeNodes.length === 0) return 0;
    const total = activeNodes.reduce((acc, curr) => acc + curr.bandwidthUsage, 0);
    return Math.round(total / activeNodes.length);
  });

  private currentTab = signal<string>('matrix');
  public activeTab = this.currentTab.asReadonly();

  constructor() {
    this.syncSystemState();
    setInterval(() => this.executeMetricsHeartbeat(), 3500);
  }

  // src/app/services/api.ts

  public syncSystemState(): void {
    if (!this.token()) return;

    // Change '/nodes' to '/metrics/nodes'
    this.http.get<SystemNode[]>(`${this.baseUrl}/metrics/nodes`).subscribe({
      next: (data) => this.nodes.set(data),
      error: (err) => console.error('Failed to sync system cluster infrastructure:', err),
    });

    // Change '/logs' to '/metrics/logs'
    this.http.get<AuditLog[]>(`${this.baseUrl}/metrics/logs`).subscribe({
      next: (data) => this.auditLogs.set(data),
      error: (err) => console.error('Failed to retrieve active log cache:', err),
    });
  }

  public executeHandshake(operatorId: string, passkey: string): boolean {
    if (!operatorId || !passkey) return false;

    this.http
      .post<any>(`${this.baseUrl}/auth/login`, {
        username: operatorId,
        password: passkey,
      })
      .subscribe({
        next: (response) => {
          this.token.set(response.access_token);
          this.clearanceRole.set(operatorId === 'shayan' ? 'Admin' : 'User');
          this.activeOperator.set(operatorId);
          this.syncSystemState();
        },
        error: (err) => {
          console.error('Cryptographic handshake rejected by authentication gate:', err);
        },
      });

    return true;
  }

  public terminateSession(): void {
    this.token.set(null);
    this.activeOperator.set('UNAUTHORIZED');
    this.clearanceRole.set('GUEST');
    this.globalShieldEngaged.set(false);
    this.isAttackActive.set(false);
    this.nodes.set([]);
    this.auditLogs.set([]);
  }

  public setTab(tabName: string): void {
    this.currentTab.set(tabName);
  }

  public toggleNodeStatus(nodeId: string, instruction: 'THROTTLE' | 'ISOLATE' | 'RESTORE'): void {
    if (this.clearanceRole() !== 'Admin') return;

    this.http
      .post<SystemNode[]>(`${this.baseUrl}/nodes/${nodeId}/status`, { instruction })
      .subscribe({
        next: (updatedNodes) => this.nodes.set(updatedNodes),
        error: (err) => console.error('Core routing instruction rejected by backend node:', err),
      });
  }

  public provisionNewNode(
    nodeName: string,
    architectureType: 'consumer' | 'enterprise' | 'secure',
  ): void {
    if (this.clearanceRole() !== 'Admin' || !nodeName || !nodeName.trim()) return;

    this.http
      .post<SystemNode[]>(`${this.baseUrl}/nodes/provision`, {
        name: nodeName,
        type: architectureType,
      })
      .subscribe({
        next: (updatedNodes) => {
          this.nodes.set(updatedNodes);
          this.setTab('matrix');
        },
        error: (err) => console.error('Infrastructure provisioning failed:', err),
      });
  }

  public engageCounterMeasureShield(): void {
    if (this.clearanceRole() !== 'Admin') return;

    this.http
      .post<{ nodes: SystemNode[]; shieldActive: boolean }>(`${this.baseUrl}/system/shield`, {})
      .subscribe({
        next: (response) => {
          this.globalShieldEngaged.set(response.shieldActive);
          this.isAttackActive.set(false);
          this.nodes.set(response.nodes);
        },
        error: (err) => console.error('Failed to dispatch counter-measure arrays:', err),
      });
  }

  public injectBreachSimulation(): void {
    if (this.clearanceRole() !== 'Admin') return;

    this.http
      .post<{
        nodes: SystemNode[];
        attackActive: boolean;
      }>(`${this.baseUrl}/system/breach-test`, {})
      .subscribe({
        next: (response) => {
          this.globalShieldEngaged.set(false);
          this.isAttackActive.set(response.attackActive);
          this.nodes.set(response.nodes);
        },
        error: (err) => console.error('Failed to safely trigger diagnostic firewall exploit:', err),
      });
  }

  private executeMetricsHeartbeat(): void {
    if (!this.token()) return;
    this.totalNetworkTraffic.update((v) => v + Math.floor(Math.random() * 45) - 20);
  }
}
