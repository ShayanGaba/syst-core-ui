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

  globalBandwidthAverage = computed(() => {
    const activeNodes = this.nodes().filter((n) => n.status !== 'ISOLATED');
    if (activeNodes.length === 0) return 0;
    const total = activeNodes.reduce((acc, curr) => acc + curr.bandwidthUsage, 0);
    return Math.round(total / activeNodes.length);
  });

  constructor() {
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
    this.http.post<any>(`${this.baseUrl}/auth/login`, { username: usernameInput, password: passwordInput })
      .subscribe({
        next: (res) => {
          const token = res?.token || res?.accessToken || res?.access_token || res?.data?.token || res?.data?.access_token;
          const operator = res?.operator || res?.username || res?.user?.username || usernameInput;
          
          let detectedRole = res?.role || res?.roles || res?.clearance || res?.user?.role || res?.user?.roles || res?.data?.role;
          if (Array.isArray(detectedRole)) {
            detectedRole = detectedRole[0];
          }
          
          // 🟢 THE FIX: Strictly align casing to exactly match 'Admin' or 'User' for template expressions
          let finalRole = 'User';
          if (detectedRole) {
            const normalized = String(detectedRole).toLowerCase();
            if (normalized === 'admin') finalRole = 'Admin';
            else if (normalized === 'user') finalRole = 'User';
            else finalRole = String(detectedRole);
          } else {
            // Implicit fallback matching username directly
            finalRole = (usernameInput.toLowerCase() === 'shayan' || usernameInput.toLowerCase().includes('admin')) ? 'Admin' : 'User';
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
            alert('Server accepted credentials but did not send a token key in its response object.');
          }
        },
        error: (err) => {
          console.error('System Identity Validation Breach Failed:', err);
          alert(`Server Login Rejected!\nStatus Code: ${err.status}\nMessage: ${err.error?.message || err.message}`);
        }
      });
  }

  public startLiveStream() {
    this.stopLiveStream();
    this.fetchDashboardData();
    
    this.telemetryHeartbeat = setInterval(() => {
      this.fetchDashboardData();
    }, 3000);
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
      next: (data) => this.nodes.set(data),
      error: (err) => console.error('Failed to load infrastructure data:', err)
    });

    this.http.get<any[]>(`${this.baseUrl}/metrics/logs`, this.getHeaders()).subscribe({
      next: (data) => {
        const parsedLogs: AuditLog[] = data.map(log => ({
          timestamp: log.timestamp || log.createdAt || new Date().toISOString(),
          scope: log.scope || log.tenantId || 'GLOBAL_SYSTEM',
          event: log.event || log.action,
          severity: log.severity === 'WARN' ? 'WARN' : log.severity || 'INFO'
        }));
        this.auditLogs.set(parsedLogs);
      },
      error: (err) => console.error('Failed to load audit logs:', err)
    });
  }

  public toggleNodeStatus(nodeId: string, instruction: 'THROTTLE' | 'ISOLATE' | 'RESTORE') {
    this.http.post<SystemNode[]>(`${this.baseUrl}/metrics/nodes/${nodeId}/status`, { instruction }, this.getHeaders()).subscribe({
      next: (updatedNodes) => {
        this.nodes.set(updatedNodes);
        this.fetchDashboardData();
      }
    });
  }

  public provisionNewNode(name: string, type: 'consumer' | 'enterprise' | 'secure') {
    this.http.post<SystemNode[]>(`${this.baseUrl}/metrics/nodes/provision`, { name, type }, this.getHeaders()).subscribe({
      next: (updatedNodes) => {
        this.nodes.set(updatedNodes);
        this.fetchDashboardData();
      }
    });
  }

  public engageCounterMeasureShield() {
    this.http.post<any>(`${this.baseUrl}/metrics/system/shield`, {}, this.getHeaders()).subscribe({
      next: (res) => {
        this.nodes.set(res.nodes);
        this.globalShieldEngaged.set(true);
        this.isAttackActive.set(false);
        this.fetchDashboardData();
      }
    });
  }

  public injectBreachSimulation() {
    this.http.post<any>(`${this.baseUrl}/metrics/system/breach-test`, {}, this.getHeaders()).subscribe({
      next: (res) => {
        this.nodes.set(res.nodes);
        this.isAttackActive.set(true);
        this.globalShieldEngaged.set(false);
        this.fetchDashboardData();
      }
    });
  }

  public terminateSession() {
    this.stopLiveStream();
    localStorage.clear();
    this.token.set(null);
    this.activeOperator.set('UNAUTHORIZED');
    this.clearanceRole.set('User');
    this.nodes.set([]);
    this.auditLogs.set([]);
  }
}