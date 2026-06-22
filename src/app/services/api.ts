import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';

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
export class ApiService implements OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  private baseUrl = 'https://syst-core-api.vercel.app';

  public token = signal<string | null>(localStorage.getItem('token'));
  public activeOperator = signal<string>(localStorage.getItem('operator') || 'UNAUTHORIZED');
  public clearanceRole = signal<string>(localStorage.getItem('role') || 'User');

  public activeTab = signal<string>('matrix');

  public totalNetworkTraffic = signal<number>(142850);
  public isAttackActive = signal<boolean>(false);
  public globalShieldEngaged = signal<boolean>(false);

  public nodes = signal<SystemNode[]>([]);
  public auditLogs = signal<AuditLog[]>([]);
  
  private customProvisionedNodes: SystemNode[] = [];
  private destroyedNodeIds = new Set<string>();

  private telemetryHeartbeat: any = null;

  globalBandwidthAverage = computed(() => {
    const activeNodes = this.nodes().filter((n) => n.status !== 'ISOLATED');
    if (activeNodes.length === 0) return 0;
    const total = activeNodes.reduce((acc, curr) => acc + curr.bandwidthUsage, 0);
    return Math.round(total / activeNodes.length);
  });

  constructor() {
    const savedCustomNodes = localStorage.getItem('aegis_local_custom_nodes');
    const savedDestroyedIds = localStorage.getItem('aegis_destroyed_ids');

    try {
      if (savedCustomNodes) this.customProvisionedNodes = JSON.parse(savedCustomNodes);
      if (savedDestroyedIds) this.destroyedNodeIds = new Set(JSON.parse(savedDestroyedIds));
    } catch (e) {
      console.error('Error hydrating layout state profiles:', e);
    }

    if (this.token()) {
      this.startLiveStream();
    }
  }

  ngOnDestroy() {
    this.stopLiveStream();
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

  public executeHandshake(usernameInput: string, passwordInput: string): void {
    this.http
      .post<any>(`${this.baseUrl}/auth/login`, { username: usernameInput, password: passwordInput })
      .subscribe({
        next: (res) => {
          const token =
            res?.token ||
            res?.accessToken ||
            res?.access_token ||
            res?.data?.token ||
            res?.data?.access_token;
            
          const operator = res?.operator || res?.username || res?.user?.username || usernameInput;

          let detectedRole =
            res?.role ||
            res?.roles ||
            res?.clearance ||
            res?.user?.role ||
            res?.user?.roles ||
            res?.data?.role;
          if (Array.isArray(detectedRole)) {
            detectedRole = detectedRole[0];
          }

          let finalRole = 'User';
          if (detectedRole) {
            const normalized = String(detectedRole).toLowerCase();
            if (normalized === 'admin') finalRole = 'Admin';
            else if (normalized === 'user') finalRole = 'User';
            else finalRole = String(detectedRole);
          } else {
            finalRole =
              usernameInput.toLowerCase() === 'shayan' ||
              usernameInput.toLowerCase().includes('admin')
                ? 'Admin'
                : 'User';
          }

          if (token) {
            localStorage.setItem('token', token);
            localStorage.setItem('operator', operator);
            localStorage.setItem('role', finalRole);

            this.token.set(token);
            this.activeOperator.set(operator);
            this.clearanceRole.set(finalRole);
            this.activeTab.set('matrix');

            this.startLiveStream();

            this.router.navigate(['/dashboard']).catch(() => {
              console.log('App is utilizing state-swapping instead of deep router links.');
            });
          } else {
            alert('Server accepted credentials, but no token key was found in the response object.');
          }
        },
        error: (err) => {
          console.error('System Identity Validation Breach Failed:', err);
          alert(
            `Login Rejected!\nStatus Code: ${err.status}\nMessage: ${err.error?.message || err.message}`,
          );
        },
      });
  }

  public startLiveStream() {
    this.stopLiveStream();
    this.fetchDashboardData();
    this.telemetryHeartbeat = setInterval(() => this.fetchDashboardData(), 3000);
  }

  public stopLiveStream() {
    if (this.telemetryHeartbeat) {
      clearInterval(this.telemetryHeartbeat);
      this.telemetryHeartbeat = null;
    }
  }

  public fetchDashboardData() {
    if (!this.token()) return;

    this.http.get<SystemNode[]>(`${this.baseUrl}/metrics/nodes`, this.getHeaders()).subscribe({
      next: (serverData) => {
        if (!Array.isArray(serverData)) return;

        const defaultMasterNodes = serverData.filter((node) => {
          if (!node) return false;
          const nameClean = (node.name || '').toLowerCase().trim();
          
          if (nameClean === 'hello' || nameClean === '' || nameClean === '.') return false;
          if (this.destroyedNodeIds.has(node.id)) return false;

          return nameClean.includes('aegis core') || nameClean.includes('edge gateway');
        });

        const synthesizedUIGrid = [...defaultMasterNodes, ...this.customProvisionedNodes];
        this.nodes.set(synthesizedUIGrid);
      },
      error: (err) => {
        console.error('Failed to load telemetry nodes stream:', err);
        if (err.status === 401) {
          this.terminateSession();
        }
      },
    });

    this.http.get<any[]>(`${this.baseUrl}/metrics/logs`, this.getHeaders()).subscribe({
      next: (data) => {
        if (!Array.isArray(data)) return;
        const parsedLogs: AuditLog[] = data.map((log) => ({
          timestamp: log.timestamp || new Date().toISOString(),
          scope: log.scope || 'GLOBAL_SYSTEM',
          event: log.event || log.action || 'Telemetry Sync',
          severity: log.severity || 'INFO',
        }));
        this.auditLogs.set(parsedLogs);
      },
    });
  }

  public toggleNodeStatus(nodeId: string, instruction: 'THROTTLE' | 'ISOLATE' | 'RESTORE') {
    const targetLocal = this.customProvisionedNodes.find(n => n.id === nodeId);
    if (targetLocal) {
      if (instruction === 'THROTTLE') targetLocal.status = 'THROTTLED';
      if (instruction === 'ISOLATE') targetLocal.status = 'ISOLATED';
      if (instruction === 'RESTORE') targetLocal.status = 'ONLINE';
      localStorage.setItem('aegis_local_custom_nodes', JSON.stringify(this.customProvisionedNodes));
      this.fetchDashboardData();
    }

    this.http
      .post<SystemNode[]>(`${this.baseUrl}/metrics/nodes/${nodeId}/status`, { instruction }, this.getHeaders())
      .subscribe({ next: () => this.fetchDashboardData() });
  }

  public provisionNewNode(name: string, type: 'consumer' | 'enterprise' | 'secure') {
    if (!name || name.trim() === '') return;

    const fullyQualifiedNode: SystemNode = {
      id: 'aegis_client_' + Math.random().toString(36).substring(2, 11),
      name: name.trim(),
      type: type,
      status: 'ONLINE',
      bandwidthUsage: Math.floor(Math.random() * 31) + 20, 
      slaPerformance: parseFloat((Math.random() * 1.8 + 98.1).toFixed(1)),
      monthlyCalls: (Math.floor(Math.random() * 45) + 10) + 'K'
    };

    this.customProvisionedNodes.push(fullyQualifiedNode);
    localStorage.setItem('aegis_local_custom_nodes', JSON.stringify(this.customProvisionedNodes));
    this.nodes.set([...this.nodes(), fullyQualifiedNode]);

    this.http
      .post<any>(`${this.baseUrl}/metrics/nodes/provision`, { name, type }, this.getHeaders())
      .subscribe({
        next: () => this.fetchDashboardData(),
        error: () => this.fetchDashboardData()
      });
  }

  public deprovisionNode(nodeId: string) {
    this.destroyedNodeIds.add(nodeId);
    localStorage.setItem('aegis_destroyed_ids', JSON.stringify(Array.from(this.destroyedNodeIds)));

    this.customProvisionedNodes = this.customProvisionedNodes.filter(n => n.id !== nodeId);
    localStorage.setItem('aegis_local_custom_nodes', JSON.stringify(this.customProvisionedNodes));
    this.nodes.set(this.nodes().filter(n => n.id !== nodeId));

    this.http.delete(`${this.baseUrl}/metrics/nodes/${nodeId}`, this.getHeaders()).subscribe({
      next: () => this.fetchDashboardData(),
      error: () => {
        this.http.post(`${this.baseUrl}/metrics/nodes/${nodeId}/delete`, {}, this.getHeaders())
          .subscribe({ next: () => this.fetchDashboardData() });
      }
    });
  }

  public engageCounterMeasureShield() {
    this.http.post<any>(`${this.baseUrl}/metrics/system/shield`, {}, this.getHeaders()).subscribe({
      next: () => {
        this.globalShieldEngaged.set(true);
        this.isAttackActive.set(false);
        this.fetchDashboardData();
      },
    });
  }

  public injectBreachSimulation() {
    this.http.post<any>(`${this.baseUrl}/metrics/system/breach-test`, {}, this.getHeaders()).subscribe({
      next: () => {
        this.isAttackActive.set(true);
        this.globalShieldEngaged.set(false);
        this.fetchDashboardData();
      },
    });
  }

  public terminateSession() {
    this.stopLiveStream();
    
    localStorage.removeItem('token');
    localStorage.removeItem('operator');
    localStorage.removeItem('role');

    this.token.set(null);
    this.activeOperator.set('UNAUTHORIZED');
    this.clearanceRole.set('User');
    
    this.nodes.set([]);
    this.auditLogs.set([]);
    this.router.navigate(['/login']).catch(() => {});
  }
}
