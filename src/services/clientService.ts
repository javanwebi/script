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
      const data = durableStorage.getItem(STORAGE_KEY);
      if (!data) {
        this.saveStorage(DEFAULT_CLIENTS);
        return DEFAULT_CLIENTS;
      }
      return JSON.parse(data);
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
    return () => window.removeEventListener(EVENT_NAME, callback);
  }
}

export const clientService = new ClientService();
