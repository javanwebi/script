import {durableStorage} from "./durableStorage";
export interface ClientLogo {
  id: string;
  name: string;
  englishName?: string;
  logo: string; // Image URL or base64 data URI
  industry: string;
  website?: string;
  isActive: boolean;
  order: number;
  since?: string;
  notes?: string;
  createdAt: string;
}

const STORAGE_KEY = 'atlas_clients_logos_v3_moshtari';
const EVENT_NAME = 'atlas_clients_updated';

import { MOSHTARI_CLIENTS } from '../assets/moshtariAssets';

// Default Iranian industrial clients using uploaded images from /src/assets/moshtari
export const DEFAULT_CLIENTS: ClientLogo[] = MOSHTARI_CLIENTS.map((item, idx) => ({
  id: item.id,
  name: item.name,
  englishName: item.industry,
  industry: item.industry || 'صنایع گوناگون',
  logo: item.logo,
  isActive: true,
  order: idx + 1,
  createdAt: new Date().toISOString(),
}));

class ClientService {
  private getStorage(): ClientLogo[] {
    try {
      // During first paint PostgreSQL has not hydrated yet. Showing bundled
      // customer logos must never trigger an implicit database write.
      const data = durableStorage.getExistingItem(STORAGE_KEY);
      if (data === null) return DEFAULT_CLIENTS;
      const parsed: unknown = JSON.parse(data);
      // An empty database projection is not a configured customer list.
      // Keep the bundled logos visible without silently writing them to PostgreSQL.
      // To intentionally hide all logos, admins may disable every entry.
      if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_CLIENTS;
      return parsed
        .filter((entry): entry is Record<string, unknown> =>
          Boolean(entry && typeof entry === 'object' && !Array.isArray(entry) &&
            typeof entry.id === 'string' && typeof entry.logo === 'string'))
        .map((entry, index) => ({
          ...entry,
          // Adopted PostgreSQL rows expose active/sortOrder, while the admin
          // interface uses isActive/order. Read both for older saved records.
          isActive: typeof entry.isActive === 'boolean' ? entry.isActive :
            (typeof entry.active === 'boolean' ? entry.active : true),
          order: Number.isFinite(Number(entry.order ?? entry.sortOrder)) ?
            Number(entry.order ?? entry.sortOrder) : index + 1,
        })) as ClientLogo[];
    } catch {
      return DEFAULT_CLIENTS;
    }
  }

  private saveStorage(clients: ClientLogo[]): void {
    try {
      durableStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(EVENT_NAME));
      }
    } catch (e) {
      console.error('Failed to save clients in localStorage', e);
    }
  }

  /**
   * Get all clients (sorted by order)
   */
  public getAllClients(): ClientLogo[] {
    const clients = this.getStorage();
    return [...clients].sort((a, b) => a.order - b.order);
  }

  /**
   * Get active clients for homepage carousel
   */
  public getActiveClients(): ClientLogo[] {
    return this.getAllClients().filter(c => c.isActive);
  }

  /**
   * Add a new client
   */
  public addClient(client: Omit<ClientLogo, 'id' | 'createdAt'>): ClientLogo {
    const clients = this.getStorage();
    const newClient: ClientLogo = {
      ...client,
      id: `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    clients.push(newClient);
    this.saveStorage(clients);
    return newClient;
  }

  /**
   * Update an existing client
   */
  public updateClient(id: string, updates: Partial<ClientLogo>): ClientLogo | null {
    const clients = this.getStorage();
    const index = clients.findIndex(c => c.id === id);
    if (index === -1) return null;

    clients[index] = { ...clients[index], ...updates };
    this.saveStorage(clients);
    return clients[index];
  }

  /**
   * Delete a client
   */
  public deleteClient(id: string): boolean {
    const clients = this.getStorage();
    const filtered = clients.filter(c => c.id !== id);
    if (filtered.length === clients.length) return false;

    this.saveStorage(filtered);
    return true;
  }

  /**
   * Reorder clients
   */
  public reorderClients(orderedIds: string[]): void {
    const clients = this.getStorage();
    const clientMap = new Map(clients.map(c => [c.id, c]));

    const reordered: ClientLogo[] = [];
    orderedIds.forEach((id, index) => {
      const c = clientMap.get(id);
      if (c) {
        reordered.push({ ...c, order: index + 1 });
        clientMap.delete(id);
      }
    });

    // Append any remaining clients
    clientMap.forEach(c => {
      reordered.push({ ...c, order: reordered.length + 1 });
    });

    this.saveStorage(reordered);
  }

  /**
   * Reset to default industrial clients
   */
  public resetToDefaults(): ClientLogo[] {
    this.saveStorage(DEFAULT_CLIENTS);
    return DEFAULT_CLIENTS;
  }

  /**
   * Subscribe to client updates
   */
  public subscribe(callback: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    window.addEventListener(EVENT_NAME, callback);
    // /api/runtime can hydrate after the first render; refresh both the
    // public strip and the admin list when authoritative data arrives.
    window.addEventListener('sanat-durable-hydrated', callback);
    return () => {
      window.removeEventListener(EVENT_NAME, callback);
      window.removeEventListener('sanat-durable-hydrated', callback);
    };
  }
}

export const clientService = new ClientService();
