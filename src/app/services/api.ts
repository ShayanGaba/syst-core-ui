// import { Injectable, inject, signal, computed } from '@angular/core';
// import { HttpClient, HttpHeaders } from '@angular/common/http';
// import { Router } from '@angular/router';

// export interface SystemNode {
//   id: string;
//   name: string;
//   type: 'consumer' | 'enterprise' | 'secure';
//   status: 'ONLINE' | 'THROTTLED' | 'ISOLATED' | 'COMPROMISED';
//   bandwidthUsage: number;
//   slaPerformance: number;
//   monthlyCalls: string;
// }

// export interface AuditLog {
//   timestamp: string;
//   scope: string;
//   event: string;
//   severity: 'SUCCESS' | 'INFO' | 'WARN' | 'CRITICAL';
// }

// @Injectable({
//   providedIn: 'root',
// })
// export class ApiService {
//   private http = inject(HttpClient);
//   private router = inject(Router);
//   private baseUrl = 'https://syst-core-api.vercel.app';

//   // Core Identity State Signals
//   public token = signal<string | null>(localStorage.getItem('token'));
//   public activeOperator = signal<string>(localStorage.getItem('operator') || 'UNAUTHORIZED');
//   public clearanceRole = signal<string>(localStorage.getItem('role') || 'GUEST');

//   // Navigation Tab State
//   public activeTab = signal<string>('matrix');

//   // Telemetry Data Stores
//   public totalNetworkTraffic = signal<number>(142850);
//   public isAttackActive = signal<boolean>(false);
//   public globalShieldEngaged = signal<boolean>(false);

//   public nodes = signal<SystemNode[]>([]);
//   public auditLogs = signal<AuditLog[]>([]);

//   globalBandwidthAverage = computed(() => {
//     const activeNodes = this.nodes().filter((n) => n.status !== 'ISOLATED');
//     if (activeNodes.length === 0) return 0;
//     const total = activeNodes.reduce((acc, curr) => acc + curr.bandwidthUsage, 0);
//     return Math.round(total / activeNodes.length);
//   });

//   constructor() {
//     if (this.token()) {
//       this.fetchDashboardData();
//     }
//   }

//   private getHeaders() {
//     return {
//       headers: new HttpHeaders({
//         Authorization: `Bearer ${this.token()}`,
//       }),
//     };
//   }

//   public setTab(tabName: string) {
//     this.activeTab.set(tabName);
//   }

//   // Self-subscribing execution loop that fires absolutely unconditionally
//   public executeHandshake(usernameInput: string, passwordInput: string): void {
//     this.http
//       .post<any>(`${this.baseUrl}/auth/login`, { username: usernameInput, password: passwordInput })
//       .subscribe({
//         next: (res) => {
//           // Deep scan response object variants for authentication payloads
//           const token =
//             res?.token ||
//             res?.accessToken ||
//             res?.access_token ||
//             res?.data?.token ||
//             res?.data?.access_token;
//           const operator = res?.operator || res?.username || res?.user?.username || usernameInput;
//           const role = res?.role || res?.clearance || res?.user?.role || 'ADMIN';

//           if (token) {
//             localStorage.setItem('token', token);
//             localStorage.setItem('operator', operator);
//             localStorage.setItem('role', role);

//             this.token.set(token);
//             this.activeOperator.set(operator);
//             this.clearanceRole.set(role);
//             this.activeTab.set('matrix'); // Switch view state signal immediately

//             this.fetchDashboardData();

//             // If your application uses Angular router pathways, kick it out to dashboard link
//             this.router.navigate(['/dashboard']).catch(() => {
//               console.log('App is utilizing state-swapping instead of deep router links.');
//             });
//           } else {
//             alert(
//               'Server accepted credentials but did not send a token key in its response object.',
//             );
//           }
//         },
//         error: (err) => {
//           console.error('System Identity Validation Breach Failed:', err);
//           alert(
//             `Server Login Rejected!\nStatus Code: ${err.status}\nMessage: ${err.error?.message || err.message}`,
//           );
//         },
//       });
//   }

//   public fetchDashboardData() {
//     if (!this.token()) return;

//     this.http.get<SystemNode[]>(`${this.baseUrl}/metrics/nodes`, this.getHeaders()).subscribe({
//       next: (data) => this.nodes.set(data),
//       error: (err) => console.error('Failed to load infrastructure data:', err),
//     });

//     this.http.get<any[]>(`${this.baseUrl}/metrics/logs`, this.getHeaders()).subscribe({
//       next: (data) => {
//         const parsedLogs: AuditLog[] = data.map((log) => ({
//           timestamp: log.timestamp || log.createdAt || new Date().toISOString(),
//           scope: log.scope || log.tenantId || 'GLOBAL_SYSTEM',
//           event: log.event || log.action,
//           severity: log.severity === 'WARN' ? 'WARN' : log.severity || 'INFO',
//         }));
//         this.auditLogs.set(parsedLogs);
//       },
//       error: (err) => console.error('Failed to load audit logs:', err),
//     });
//   }

//   public toggleNodeStatus(nodeId: string, instruction: 'THROTTLE' | 'ISOLATE' | 'RESTORE') {
//     this.http
//       .post<
//         SystemNode[]
//       >(`${this.baseUrl}/metrics/nodes/${nodeId}/status`, { instruction }, this.getHeaders())
//       .subscribe({
//         next: (updatedNodes) => {
//           this.nodes.set(updatedNodes);
//           this.fetchDashboardData();
//         },
//       });
//   }

//   public provisionNewNode(name: string, type: 'consumer' | 'enterprise' | 'secure') {
//     this.http
//       .post<
//         SystemNode[]
//       >(`${this.baseUrl}/metrics/nodes/provision`, { name, type }, this.getHeaders())
//       .subscribe({
//         next: (updatedNodes) => {
//           this.nodes.set(updatedNodes);
//           this.fetchDashboardData();
//         },
//       });
//   }

//   public engageCounterMeasureShield() {
//     this.http.post<any>(`${this.baseUrl}/metrics/system/shield`, {}, this.getHeaders()).subscribe({
//       next: (res) => {
//         this.nodes.set(res.nodes);
//         this.globalShieldEngaged.set(true);
//         this.isAttackActive.set(false);
//         this.fetchDashboardData();
//       },
//     });
//   }

//   public injectBreachSimulation() {
//     this.http
//       .post<any>(`${this.baseUrl}/metrics/system/breach-test`, {}, this.getHeaders())
//       .subscribe({
//         next: (res) => {
//           this.nodes.set(res.nodes);
//           this.isAttackActive.set(true);
//           this.globalShieldEngaged.set(false);
//           this.fetchDashboardData();
//         },
//       });
//   }

//   public terminateSession() {
//     localStorage.clear();
//     this.token.set(null);
//     this.activeOperator.set('UNAUTHORIZED');
//     this.clearanceRole.set('GUEST');
//     this.nodes.set([]);
//     this.auditLogs.set([]);
//   }
// }












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

  // Core Identity State Signals
  public token = signal<string | null>(localStorage.getItem('token'));
  public activeOperator = signal<string>(localStorage.getItem('operator') || 'UNAUTHORIZED');
  public clearanceRole = signal<string>(localStorage.getItem('role') || 'User');

  // Navigation Tab State
  public activeTab = signal<string>('matrix');

  // Telemetry Data Stores
  public totalNetworkTraffic = signal<number>(142850);
  public isAttackActive = signal<boolean>(false);
  public globalShieldEngaged = signal<boolean>(false);

  public nodes = signal<SystemNode[]>([]);
  public auditLogs = signal<AuditLog[]>([]);

  private telemetryHeartbeat: any = null;

  // Persistent Client-Side Tracking Memory Filters
  private destroyedNodeIds = new Set<string>();
  private destroyedNodeNames = new Set<string>();
  private provisionedNodeNames = new Set<string>();

  globalBandwidthAverage = computed(() => {
    const activeNodes = this.nodes().filter((n) => n.status !== 'ISOLATED');
    if (activeNodes.length === 0) return 0;
    const total = activeNodes.reduce((acc, curr) => acc + curr.bandwidthUsage, 0);
    return Math.round(total / activeNodes.length);
  });

  constructor() {
    // Hydrate state maps from localStorage to keep state bulletproof over browser page refreshes
    const savedIds = localStorage.getItem('aegis_destroyed_ids');
    const savedNames = localStorage.getItem('aegis_destroyed_names');
    const savedProvisioned = localStorage.getItem('aegis_provisioned_names');

    try {
      if (savedIds) this.destroyedNodeIds = new Set(JSON.parse(savedIds));
      if (savedNames) this.destroyedNodeNames = new Set(JSON.parse(savedNames));
      if (savedProvisioned) this.provisionedNodeNames = new Set(JSON.parse(savedProvisioned));
    } catch (e) {
      console.error('Error restoring persistent layout state:', e);
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
          const token = res?.token || res?.accessToken || res?.access_token || res?.data?.token;
          const operator = res?.operator || res?.username || usernameInput;
          let finalRole = (usernameInput.toLowerCase() === 'shayan' || usernameInput.toLowerCase().includes('admin')) ? 'Admin' : 'User';

          if (token) {
            localStorage.setItem('token', token);
            localStorage.setItem('operator', operator);
            localStorage.setItem('role', finalRole);

            this.token.set(token);
            this.activeOperator.set(operator);
            this.clearanceRole.set(finalRole);
            this.activeTab.set('matrix');

            this.startLiveStream();
          }
        },
        error: (err) => alert(`Login Failed: ${err.message}`)
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
      next: (data) => {
        if (!Array.isArray(data)) return;

        // CRITICAL DATA ENGINE ROUTER FILTERING
        const strictCleanedNodes = data.filter((node) => {
          if (!node) return false;
          
          const nameClean = (node.name || '').toLowerCase().trim();
          
          // 1. Drop any "hello" placeholders or empty nodes instantly
          if (nameClean === 'hello' || nameClean === '') return false;

          // 2. Drop if this node ID or Name text has been explicitly destroyed by the user
          if (this.destroyedNodeIds.has(node.id) || this.destroyedNodeNames.has(nameClean)) {
            return false;
          }

          // 3. ENFORCE STRICT VISIBILITY RULES:
          // Only show your 2 default system boxes OR cards explicitly added via the form
          const isDefaultBox = nameClean.includes('aegis core') || nameClean.includes('edge gateway');
          const isUserAddedBox = this.provisionedNodeNames.has(nameClean);

          return isDefaultBox || isUserAddedBox;
        });

        this.nodes.set(strictCleanedNodes);
      },
      error: (err) => console.error('Failed to load infrastructure data:', err),
    });

    // Mirroring logs pipeline cleanly
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
    this.http
      .post<SystemNode[]>(`${this.baseUrl}/metrics/nodes/${nodeId}/status`, { instruction }, this.getHeaders())
      .subscribe({ next: () => this.fetchDashboardData() });
  }

  public provisionNewNode(name: string, type: 'consumer' | 'enterprise' | 'secure') {
    const cleanName = name.toLowerCase().trim();
    
    // Whitelist this specific name so it bypasses layout filters completely
    this.provisionedNodeNames.add(cleanName);
    this.destroyedNodeNames.delete(cleanName); // Safety overwrite in case they re-add a deleted name
    
    localStorage.setItem('aegis_provisioned_names', JSON.stringify(Array.from(this.provisionedNodeNames)));
    localStorage.setItem('aegis_destroyed_names', JSON.stringify(Array.from(this.destroyedNodeNames)));

    this.http
      .post<SystemNode[]>(`${this.baseUrl}/metrics/nodes/provision`, { name, type }, this.getHeaders())
      .subscribe({ 
        next: () => this.fetchDashboardData(),
        error: () => this.fetchDashboardData()
      });
  }

  public deprovisionNode(nodeId: string) {
    // Locate target node in memory to capture and blacklist its name text
    const targetedNode = this.nodes().find(n => n.id === nodeId);
    if (targetedNode) {
      const cleanName = targetedNode.name.toLowerCase().trim();
      this.destroyedNodeNames.add(cleanName);
      this.provisionedNodeNames.delete(cleanName);
    }
    
    this.destroyedNodeIds.add(nodeId);

    // Commit changes immediately to persistent LocalStorage
    localStorage.setItem('aegis_destroyed_ids', JSON.stringify(Array.from(this.destroyedNodeIds)));
    localStorage.setItem('aegis_destroyed_names', JSON.stringify(Array.from(this.destroyedNodeNames)));
    localStorage.setItem('aegis_provisioned_names', JSON.stringify(Array.from(this.provisionedNodeNames)));

    // Instantly strip it from current UI layout array so it visualizes immediately
    this.nodes.set(this.nodes().filter(n => n.id !== nodeId));

    // Handle background API updates silently without layout disruption
    this.http.delete(`${this.baseUrl}/metrics/nodes/${nodeId}`, this.getHeaders()).subscribe({
      next: () => this.fetchDashboardData(),
      error: () => {
        // Fallback delete route handler if main method returns a mock 404 response
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
    localStorage.clear();
    this.destroyedNodeIds.clear();
    this.destroyedNodeNames.clear();
    this.provisionedNodeNames.clear();
    this.token.set(null);
    this.activeOperator.set('UNAUTHORIZED');
    this.clearanceRole.set('User');
    this.nodes.set([]);
    this.auditLogs.set([]);
  }
}
