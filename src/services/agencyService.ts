import {durableStorage} from "./durableStorage";
import {
  AgencyApplication,
  FinancialTransaction,
  DepositReceipt,
  SupplyRequest,
  DealerCatalogItem,
  SmsLog,
  TicketMessage,
} from '../types';

const APPLICATIONS_KEY = 'hyper_sanat_agency_applications_v1';
const SMS_LOGS_KEY = 'hyper_sanat_sms_logs_v1';
const RECEIPTS_KEY = 'hyper_sanat_deposit_receipts_v1';
const SUPPLY_KEY = 'hyper_sanat_supply_requests_v1';
const MESSAGES_KEY = 'hyper_sanat_dealer_messages_v1';

// Seed initial applications
const INITIAL_APPLICATIONS: AgencyApplication[] = [];

// Seed initial SMS Logs
const INITIAL_SMS_LOGS: SmsLog[] = [];

// Financial transactions seed for dealer
const INITIAL_FINANCIAL_TRANSACTIONS: FinancialTransaction[] = [];

// Seed deposit receipts
const INITIAL_DEPOSIT_RECEIPTS: DepositReceipt[] = [];

// Seed supply requests
const INITIAL_SUPPLY_REQUESTS: SupplyRequest[] = [];

// Seed dealer messages
const INITIAL_DEALER_MESSAGES: TicketMessage[] = [];

// Catalog downloads
const DEALER_CATALOGS: DealerCatalogItem[] = [
  {
    id: 'cat-1',
    title: 'کاتالوگ جامع مهندسی تسمه‌های صنعتی SWR آلمان (ویرایش ۲۰۲۴)',
    category: 'کاتالوگ فنی',
    fileSize: '۱۴.۲ مگابایت',
    format: 'PDF',
    updatedAt: 'شهریور ۱۴۰۳',
    downloadCount: 342,
  },
  {
    id: 'cat-2',
    title: 'لیست قیمت رسمی پخش و عمده‌فروشی بازرگانی اطلس (فایل اکسل فرمول‌دار)',
    category: 'لیست قیمت همکار',
    fileSize: '۲.۸ مگابایت',
    format: 'XLSX',
    updatedAt: 'هفته جاری',
    downloadCount: 890,
  },
  {
    id: 'cat-3',
    title: 'دیتاشیت تحمل حرارتی و جدول انحنای غلتک‌های سرامیکی کوره AT-751',
    category: 'راهنمای کوره کاشی',
    fileSize: '۴.۱ مگابایت',
    format: 'PDF',
    updatedAt: 'مرداد ۱۴۰۳',
    downloadCount: 195,
  },
  {
    id: 'cat-4',
    title: 'فرم رسمی تفاهم‌نامه عاملیت فروش و سهمیه‌بندی فصلی (مهر و امضا)',
    category: 'اسناد حقوقی',
    fileSize: '۱.۵ مگابایت',
    format: 'PDF',
    updatedAt: 'تیر ۱۴۰۳',
    downloadCount: 120,
  },
  {
    id: 'cat-5',
    title: 'پکیج لوگوها و بنرهای تبلیغاتی برندهای انحصاری FORZA و SWR با وضوح بالا',
    category: 'مواد بازاریابی فروشگاه',
    fileSize: '۲۸.۵ مگابایت',
    format: 'ZIP',
    updatedAt: 'خرداد ۱۴۰۳',
    downloadCount: 260,
  },
];

export const agencyService = {
  // --- Applications ---
  getApplications(): AgencyApplication[] {
    try {
      const stored = durableStorage.getItem(APPLICATIONS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    durableStorage.setItem(APPLICATIONS_KEY, JSON.stringify(INITIAL_APPLICATIONS));
    return INITIAL_APPLICATIONS;
  },

  saveApplications(apps: AgencyApplication[]): void {
    try {
      durableStorage.setItem(APPLICATIONS_KEY, JSON.stringify(apps));
    } catch {
      // ignore
    }
  },

  getApplicationByTracking(code: string): AgencyApplication | undefined {
    const apps = this.getApplications();
    const clean = code.trim().toUpperCase();
    return apps.find(a => a.trackingCode.toUpperCase() === clean);
  },

  getApplicationByPhone(phone: string): AgencyApplication | undefined {
    const apps = this.getApplications();
    const clean = phone.trim();
    return apps.find(a => a.phone === clean);
  },

  submitApplication(data: Omit<AgencyApplication, 'id' | 'trackingCode' | 'status' | 'submittedAt'>): AgencyApplication {
    const apps = this.getApplications();
    const randomCode = 'AGY-' + Math.floor(10000 + Math.random() * 90000);
    const newApp: AgencyApplication = {
      ...data,
      id: 'app-' + Date.now(),
      trackingCode: randomCode,
      status: 'pending',
      submittedAt: new Date().toLocaleDateString('fa-IR'),
    };

    apps.unshift(newApp);
    this.saveApplications(apps);

    // Create confirmation SMS log
    this.addSmsLog({
      recipientPhone: data.phone,
      template: 'agency_submitted',
      message: `بازرگانی تسمه اطلس: درخواست عاملیت شما با کد رهگیری ${randomCode} ثبت گردید. کارشناسان ما ظرف ۲۴ ساعت آینده بررسی خواهند کرد.`,
    });

    return newApp;
  },

  approveApplication(
    id: string,
    options?: {
      username?: string;
      password?: string;
      initialCreditLimit?: number;
      agencyCode?: string;
    }
  ): { app: AgencyApplication; credentials: { username: string; password: string; agencyCode: string } } | undefined {
    const apps = this.getApplications();
    const app = apps.find(a => a.id === id);
    if (!app) return undefined;

    const generatedCode = options?.agencyCode || 'DLR-' + Math.floor(10000 + Math.random() * 90000);
    const username = options?.username || app.phone.trim();
    const password = options?.password || ('Atlas@' + Math.floor(1000 + Math.random() * 9000));
    const creditLimit = options?.initialCreditLimit || 250000000;

    app.status = 'approved';
    app.reviewedAt = new Date().toLocaleDateString('fa-IR');
    delete app.rejectionReason;
    this.saveApplications(apps);

    // Provision Zero-Data Dedicated Dealer Profile
    const dealerAccount = {
      id: 'dealer-' + app.id,
      agencyCode: generatedCode,
      username: username,
      password: password,
      managerName: app.managerName,
      companyName: app.companyName,
      phone: app.phone,
      creditLimit: creditLimit,
      usedCredit: 0,
      availableCredit: creditLimit,
      openInvoicesCount: 0,
      activeOrdersCount: 0,
      approvedAt: app.reviewedAt,
      isFreshZeroData: true,
    };

    try {
      const dealersKey = 'hyper_sanat_approved_dealers_v1';
      const stored = durableStorage.getItem(dealersKey);
      const list = stored ? JSON.parse(stored) : [];
      const filtered = list.filter((d: any) => d.phone !== app.phone);
      filtered.push(dealerAccount);
      durableStorage.setItem(dealersKey, JSON.stringify(filtered));

      // Also register into users store so login recognizes dealer role
      const usersKey = 'hyper_sanat_registered_users_v2';
      const usersStored = durableStorage.getItem(usersKey);
      const userList = usersStored ? JSON.parse(usersStored) : [];
      const userIdx = userList.findIndex((u: any) => u.phone === app.phone);
      const dealerUserData = {
        id: 'user-dealer-' + app.id,
        fullName: app.managerName,
        companyName: app.companyName,
        phone: app.phone,
        password: password,
        role: 'dealer',
        clubTier: 'gold',
        clubPoints: 0,
        approvedB2B: true,
        agencyCode: generatedCode,
        creditLimit: creditLimit,
        city: app.city,
        province: app.province,
        createdAt: app.reviewedAt,
      };
      if (userIdx >= 0) {
        userList[userIdx] = { ...userList[userIdx], ...dealerUserData };
      } else {
        userList.push(dealerUserData);
      }
      durableStorage.setItem(usersKey, JSON.stringify(userList));
    } catch {
      // ignore
    }

    // Create approval SMS with Username & Password
    this.addSmsLog({
      recipientPhone: app.phone,
      template: 'agency_approved',
      message: `همکار گرامی جناب ${app.managerName}؛ عاملیت شما در شرکت صنعت پیش (بازرگانی اطلس یزد) تأیید گردید. پرتال نمایندگی شما با سقف اعتبار ${new Intl.NumberFormat('fa-IR').format(creditLimit)} تومان فعال شد.\nنام کاربری: ${username}\nرمز عبور: ${password}\nکد عاملیت: ${generatedCode}`,
    });

    return {
      app,
      credentials: {
        username,
        password,
        agencyCode: generatedCode,
      },
    };
  },

  rejectApplication(id: string, reason: string): AgencyApplication | undefined {
    const apps = this.getApplications();
    const app = apps.find(a => a.id === id);
    if (!app) return undefined;

    app.status = 'rejected';
    app.rejectionReason = reason;
    app.reviewedAt = new Date().toLocaleDateString('fa-IR');
    this.saveApplications(apps);

    // Create rejection SMS
    this.addSmsLog({
      recipientPhone: app.phone,
      template: 'agency_rejected',
      message: `متقاضی محترم جناب ${app.managerName}؛ درخواست عاملیت شما به دلیل «${reason}» تأیید نشد. جهت بررسی مجدد تماس حاصل فرمایید.`,
    });

    return app;
  },

  // --- SMS Logs ---
  getSmsLogs(): SmsLog[] {
    try {
      const stored = durableStorage.getItem(SMS_LOGS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    durableStorage.setItem(SMS_LOGS_KEY, JSON.stringify(INITIAL_SMS_LOGS));
    return INITIAL_SMS_LOGS;
  },

  addSmsLog(params: {
    recipientPhone: string;
    template: SmsLog['template'];
    message: string;
  }): SmsLog {
    const logs = this.getSmsLogs();
    const now = new Date();
    const timeStr = `${now.toLocaleDateString('fa-IR')} - ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const newLog: SmsLog = {
      id: 'sms-' + Date.now(),
      recipientPhone: params.recipientPhone,
      template: params.template,
      message: params.message,
      status: 'delivered',
      sentAt: timeStr,
    };
    logs.unshift(newLog);
    try {
      durableStorage.setItem(SMS_LOGS_KEY, JSON.stringify(logs));
    } catch {
      // ignore
    }
    return newLog;
  },

  // --- Financial Statement ---
  getFinancialTransactions(): FinancialTransaction[] {
    return INITIAL_FINANCIAL_TRANSACTIONS;
  },

  getFinancialOverview() {
    const creditLimit = 200000000; // سقف اعتبار مصوب ۲۰۰ میلیون تومان
    const currentDebt = 40000000;  // مانده بدهی جاری ۴۰ میلیون تومان
    const availableCredit = creditLimit - currentDebt; // ۱۶۰ میلیون اعتبار آزاد
    const pendingCheques = 40000000; // چک‌های در جریان وصول
    return {
      creditLimit,
      currentDebt,
      availableCredit,
      pendingCheques,
      lastPaymentDate: '۱۴۰۳/۰۶/۱۹',
      settlementRating: 'عالی (رتبه A+)',
    };
  },

  getDepositReceipts(): DepositReceipt[] {
    try {
      const stored = durableStorage.getItem(RECEIPTS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return INITIAL_DEPOSIT_RECEIPTS;
  },

  submitDepositReceipt(data: Omit<DepositReceipt, 'id' | 'status' | 'submittedAt'>): DepositReceipt {
    const receipts = this.getDepositReceipts();
    const now = new Date();
    const timeStr = `${now.toLocaleDateString('fa-IR')} - ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const newReceipt: DepositReceipt = {
      ...data,
      id: 'rec-' + Date.now(),
      status: 'pending',
      submittedAt: timeStr,
    };
    receipts.unshift(newReceipt);
    try {
      durableStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipts));
    } catch {
      // ignore
    }

    this.addSmsLog({
      recipientPhone: '',
      template: 'deposit_received',
      message: `رسید واریز شما به مبلغ ${data.amount.toLocaleString('fa-IR')} تومان ثبت شد و پس از بررسی حسابداری تأیید می‌شود.`,
    });

    return newReceipt;
  },

  // --- Supply Requests ---
  getSupplyRequests(): SupplyRequest[] {
    try {
      const stored = durableStorage.getItem(SUPPLY_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return INITIAL_SUPPLY_REQUESTS;
  },

  submitSupplyRequest(data: Omit<SupplyRequest, 'id' | 'requestNumber' | 'status' | 'submittedAt'>): SupplyRequest {
    const requests = this.getSupplyRequests();
    const randomNum = 'SUP-1403-' + Math.floor(100 + Math.random() * 900);
    const newReq: SupplyRequest = {
      ...data,
      id: 'sup-' + Date.now(),
      requestNumber: randomNum,
      status: 'pending',
      submittedAt: new Date().toLocaleDateString('fa-IR'),
    };
    requests.unshift(newReq);
    try {
      durableStorage.setItem(SUPPLY_KEY, JSON.stringify(requests));
    } catch {
      // ignore
    }
    return newReq;
  },

  // --- Dealer Internal Messages ---
  getDealerMessages(): TicketMessage[] {
    try {
      const stored = durableStorage.getItem(MESSAGES_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return INITIAL_DEALER_MESSAGES;
  },

  sendDealerMessage(text: string, senderName: string): TicketMessage {
    const messages = this.getDealerMessages();
    const now = new Date();
    const timeStr = `${now.toLocaleDateString('fa-IR')} - ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const newMsg: TicketMessage = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      senderName: senderName || 'نماینده پخش',
      message: text.trim(),
      timestamp: timeStr,
    };
    messages.push(newMsg);
    try {
      durableStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
    } catch {
      // ignore
    }
    return newMsg;
  },

  // --- Catalogs ---
  getCatalogs(): DealerCatalogItem[] {
    return DEALER_CATALOGS;
  },
};
