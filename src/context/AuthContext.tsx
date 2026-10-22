import {durableStorage} from "../services/durableStorage";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Customer, UserRole, PriceTiers, Address, RegisterPayload, AuthResponse, AuthCredentials } from '../types';
import { AuthService } from '../services/authService';
import { clearPortalCache, hydratePortal, portalRequest } from '../services/portalRepository';

interface AuthContextType {
  currentUser: Customer | null;
  authLoading: boolean;
  activeRole: UserRole;
  priceLayer: keyof PriceTiers;
  roleTitle: string;
  isDealer?: boolean;
  isAuthModalOpen: boolean;
  authModalInitialView: 'login' | 'register';
  welcomeMessage: string | null;
  latestCredentials: AuthCredentials | null;
  openAuthModal: (redirectPath?: string, initialView?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  clearWelcomeMessage: () => void;
  setLatestCredentials: (creds: AuthCredentials | null) => void;
  registerUser: (payload: RegisterPayload) => Promise<AuthResponse>;
  loginWithPassword: (identifier: string, password: string) => Promise<AuthResponse>;
  saveOnboardingStep1: (brands: string[]) => Promise<boolean>;
  saveOnboardingStep2: (businessType: string) => Promise<boolean>;
  loginAs: (role: UserRole) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  addClubPoints: (pts: number) => void;
  updateProfile: (data: Partial<Customer>) => void;
  activateDealerRole: () => void;
  // Address CRUD
  addAddress: (address: Omit<Address, 'id'>) => Address;
  updateAddress: (id: string, address: Partial<Address>) => void;
  deleteAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
  getUserAddresses: () => Address[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'hyper_sanat_auth_state_v2';
const USERS_STORAGE_KEY = 'hyper_sanat_registered_users_v2';
const CREDS_STORAGE_KEY = 'hyper_sanat_latest_credentials_v2';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Customer | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    const sync = () => hydratePortal().catch(() => { if (mounted) setCurrentUser(null); }).finally(() => { if (mounted) setAuthLoading(false); });
    const sessionUpdated = (event: Event) => { if (mounted) setCurrentUser((event as CustomEvent).detail.user || null); };
    window.addEventListener('atlas-session-updated', sessionUpdated);
    window.addEventListener('focus', sync);
    void sync();
    return () => { mounted = false; window.removeEventListener('atlas-session-updated', sessionUpdated); window.removeEventListener('focus', sync); };
  }, []);

  const [activeRole, setActiveRole] = useState<UserRole>(() => {
    return currentUser ? currentUser.role : 'guest';
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalInitialView, setAuthModalInitialView] = useState<'login' | 'register'>('login');
  const [redirectOnLogin, setRedirectOnLogin] = useState<string | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
  const [latestCredentials, setLatestCredentialsState] = useState<AuthCredentials | null>(() => {
    try {
      const saved = sessionStorage.getItem(CREDS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setLatestCredentials = (creds: AuthCredentials | null) => {
    setLatestCredentialsState(creds);
    try {
      if (creds) {
        sessionStorage.setItem(CREDS_STORAGE_KEY, JSON.stringify(creds));
      } else {
        sessionStorage.removeItem(CREDS_STORAGE_KEY);
      }
    } catch {}
  };

  useEffect(() => {
    try {
      if (currentUser) {
        durableStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser));
        setActiveRole(currentUser.role);
      } else {
        durableStorage.removeItem(STORAGE_KEY);
        setActiveRole('guest');
      }
    } catch {
      // ignore
    }
  }, [currentUser]);

  const openAuthModal = (redirectPath?: string, initialView?: 'login' | 'register') => {
    if (redirectPath) {setRedirectOnLogin(redirectPath);try{sessionStorage.setItem('sanat_access_destination',redirectPath);}catch{}}
    if (initialView) setAuthModalInitialView(initialView);
    else setAuthModalInitialView('login');
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setRedirectOnLogin(null);
  };

  const clearWelcomeMessage = () => {
    setWelcomeMessage(null);
  };

  /**
   * Register User with Full Flow
   */
  const registerUser = async (payload: RegisterPayload): Promise<AuthResponse> => {
    const result = await AuthService.register(payload);
    if (result.success && result.user) {
      const userWithAddr: Customer = {
        ...result.user,
        addresses: result.user.addresses && result.user.addresses.length > 0 ? result.user.addresses : [],
      };
      setCurrentUser(userWithAddr);
      setActiveRole(userWithAddr.role);
      if (result.credentials) {
        setLatestCredentials(result.credentials);
      }
      setWelcomeMessage(`خوش آمدید، ${userWithAddr.fullName}! حساب کاربری شما با موفقیت ایجاد گردید.`);
    }
    return result;
  };

  /**
   * Login with Identifier & Password
   */
  const loginWithPassword = async (identifier: string, password: string): Promise<AuthResponse> => {
    const result = await AuthService.login(identifier, password);
    if (result.success && result.user) {
      const userWithAddr: Customer = {
        ...result.user,
        addresses: result.user.addresses && result.user.addresses.length > 0 ? result.user.addresses : [],
      };
      setCurrentUser(userWithAddr);
      setActiveRole(userWithAddr.role);
      setWelcomeMessage(`خوش آمدید، ${userWithAddr.fullName}`);
    }
    return result;
  };

  /**
   * Save Onboarding Step 1 (Favorite Brands)
   */
  const saveOnboardingStep1 = async (brands: string[]): Promise<boolean> => {
    if (!currentUser) return false;
    const res = await AuthService.saveOnboardingStep1(currentUser.id, brands);
    if (res.success && res.user) {
      setCurrentUser(prev => prev ? { ...prev, ...res.user, favoriteBrands: brands } : null);
      return true;
    }
    return false;
  };

  /**
   * Save Onboarding Step 2 (Business Type & Complete)
   */
  const saveOnboardingStep2 = async (businessType: string): Promise<boolean> => {
    if (!currentUser) return false;
    const res = await AuthService.saveOnboardingStep2(currentUser.id, businessType);
    if (res.success && res.user) {
      setCurrentUser(prev => prev ? { ...prev, ...res.user, businessType, onboardingCompleted: true } : null);
      setLatestCredentials(null);
      return true;
    }
    return false;
  };

  // OTP requires a real SMS verification provider. Never authenticate by phone alone.
  const loginAs = (role: UserRole) => { if (role === 'guest') logout(); };

  const logout = () => {
    void portalRequest({ action: 'logout' });
    clearPortalCache();
    setCurrentUser(null);
    setActiveRole('guest');
    setLatestCredentials(null);
    durableStorage.removeItem(STORAGE_KEY);
  };

  const switchRole = (role: UserRole) => {
    loginAs(role);
  };

  const addClubPoints = (_pts: number) => { /* Purchase totals and club levels are server controlled. */ };
  const updateProfile = (data: Partial<Customer>) => {
    if (!currentUser) return;
    void AuthService.updateProfile(data).then(result => {
      if (result.success && result.user) setCurrentUser(result.user);
    });
  };
  const activateDealerRole = () => { setWelcomeMessage('دسترسی حساب توسط مدیریت و پس از بررسی درخواست شما فعال می‌شود.'); };

  const getUserAddresses = (): Address[] => {
    if (currentUser?.addresses && currentUser.addresses.length > 0) {
      return currentUser.addresses;
    }
    return [];
  };

  const addAddress = (addressData: Omit<Address, 'id'>): Address => {
    const newAddr: Address = {
      ...addressData,
      id: 'addr-' + Date.now(),
      isDefault: addressData.isDefault ?? false,
    };

    if (currentUser) {
      const currentList = getUserAddresses();
      const updatedList: Address[] = newAddr.isDefault
        ? [...currentList.map(a => ({ ...a, isDefault: false })), newAddr]
        : [...currentList, newAddr];
      updateProfile({ addresses: updatedList });
    }
    return newAddr;
  };

  const updateAddress = (id: string, addressData: Partial<Address>) => {
    if (!currentUser) return;
    const currentList = getUserAddresses();
    let updatedList = currentList.map(a => (a.id === id ? { ...a, ...addressData } : a));
    if (addressData.isDefault) {
      updatedList = updatedList.map(a => ({ ...a, isDefault: a.id === id }));
    }
    updateProfile({ addresses: updatedList });
  };

  const deleteAddress = (id: string) => {
    if (!currentUser) return;
    const currentList = getUserAddresses();
    const updatedList = currentList.filter(a => a.id !== id);
    if (updatedList.length > 0 && !updatedList.some(a => a.isDefault)) {
      updatedList[0].isDefault = true;
    }
    updateProfile({ addresses: updatedList });
  };

  const setDefaultAddress = (id: string) => {
    if (!currentUser) return;
    const currentList = getUserAddresses();
    const updatedList = currentList.map(a => ({ ...a, isDefault: a.id === id }));
    updateProfile({ addresses: updatedList });
  };

  let priceLayer: keyof PriceTiers = 'retail';
  if (activeRole === 'wholesale') priceLayer = 'wholesale';
  else if (activeRole === 'dealer') priceLayer = 'dealer';
  else if (activeRole === 'admin') priceLayer = 'dealer';
  else priceLayer = 'retail';

  const roleTitles: Record<UserRole, string> = {
    guest: 'مشتری عزیز (استعلام قیمت)',
    retail: 'مشتری گرامی بازرگانی اطلس',
    wholesale: 'مشتری صنعتی و همکار معتبر',
    dealer: 'نمایندگی رسمی و شبکه پخش اطلس',
    admin: 'مدیر ارشد سامانه بازرگانی اطلس',
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        authLoading,
        activeRole,
        priceLayer,
        roleTitle: roleTitles[activeRole],
        isDealer: activeRole === 'dealer',
        isAuthModalOpen,
        authModalInitialView,
        welcomeMessage,
        latestCredentials,
        openAuthModal,
        closeAuthModal,
        clearWelcomeMessage,
        setLatestCredentials,
        registerUser,
        loginWithPassword,
        saveOnboardingStep1,
        saveOnboardingStep2,
        loginAs,
        logout,
        switchRole,
        addClubPoints,
        updateProfile,
        activateDealerRole,
        addAddress,
        updateAddress,
        deleteAddress,
        setDefaultAddress,
        getUserAddresses,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
