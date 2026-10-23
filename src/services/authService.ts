import {durableStorage} from "./durableStorage";
import { Customer, RegisterPayload, AuthResponse } from "../types";
import { portalRequest, hydratePortal } from "./portalRepository";

export class AuthService {
  static async register(payload: RegisterPayload): Promise<AuthResponse> {
    try {
      const data = await portalRequest({ action: "register", payload });
      await hydratePortal();
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }
  static async login(
    identifier: string,
    password?: string,
  ): Promise<AuthResponse> {
    try {
      const data = await portalRequest({
        action: "login",
        identifier,
        password,
      });
      await hydratePortal();
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }
  static async saveOnboardingStep1(_userId: string, favoriteBrands: string[]) {
    return this.updateProfile({ favoriteBrands });
  }
  static async saveOnboardingStep2(_userId: string, businessType: string) {
    return this.updateProfile({ businessType, onboardingCompleted: true });
  }
  static async updateProfile(
    payload: Partial<Customer>,
  ): Promise<{ success: boolean; user?: Customer; message?: string }> {
    try {
      const data = await portalRequest({ action: "profile", payload });
      // The profile endpoint returns its committed user. Avoid an expensive
      // redundant full-portal GET after each onboarding save.
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }
  static getCurrentUser(): Customer | null {
    try {
      return JSON.parse(
        durableStorage.getItem("hyper_sanat_auth_state_v2") || "null",
      );
    } catch {
      return null;
    }
  }
  static persistUser(user: Customer | null) {
    if (user)
      durableStorage.setItem("hyper_sanat_auth_state_v2", JSON.stringify(user));
    else durableStorage.removeItem("hyper_sanat_auth_state_v2");
  }
  static getLocalRegisteredUsers(): Customer[] {
    return [];
  }
}
