import { flushPortalChanges } from '../../services/portalRepository';
import React, { useState } from 'react';
import {
  Users,
  MessageSquare,
  Search,
  CheckCircle,
  Clock,
  Send,
  UserCheck,
  UserPlus,
  X,
  Copy,
  Check,
  Award,
  KeyRound,
} from 'lucide-react';
import { adminService, SupportTicket } from '../../services/adminService';
import { pricingCreditService } from '../../services/pricingCreditService';
import { Customer } from '../../types';
import { formatPrice, toPersianDigits } from '../../utils/formatters';
import { generateBaseUsername } from '../../utils/usernameGenerator';

export const CustomersCrmModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'customers' | 'tickets'>('customers');

  // Customers State (Merged from adminService & pricingCreditService high-volume customers)
  const loadAllCrmCustomers = (): Customer[] => {
    const crm = adminService.getCustomers();
    const leg = pricingCreditService.getAllCustomers();
    const map = new Map<string, Customer>();
    [...crm, ...leg].forEach(c => {
      const key = c.phone || c.id;
      if (!map.has(key)) {
        map.set(key, c);
      } else {
        map.set(key, { ...map.get(key)!, ...c });
      }
    });
    return Array.from(map.values());
  };

  const [customers, setCustomers] = useState<Customer[]>(loadAllCrmCustomers);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedTierFilter, setSelectedTierFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // New High-Volume (/account) Customer Creation Modal State
  const [isAddB2bModalOpen, setIsAddB2bModalOpen] = useState(false);
  const [newB2bFullName, setNewB2bFullName] = useState('');
  const [newB2bCompany, setNewB2bCompany] = useState('');
  const [newB2bUsername, setNewB2bUsername] = useState('');
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [newB2bPhone, setNewB2bPhone] = useState('');
  const [newB2bPassword, setNewB2bPassword] = useState('');
  const [newB2bEconomicCode, setNewB2bEconomicCode] = useState('');
  const [newB2bPriceListCode, setNewB2bPriceListCode] = useState<string>('B');
  const [newB2bTotalPurchases, setNewB2bTotalPurchases] = useState<number>(0);
  const [newB2bCreditLimit, setNewB2bCreditLimit] = useState<number>(0);
  const [newB2bRole, setNewB2bRole] = useState<'wholesale' | 'dealer' | 'factory'>('wholesale');

  // Customer Edit Modal Form
  const [editTier, setEditTier] = useState<Customer['tier']>('colleague');
  const [editUsername, setEditUsername] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editPriceListCode, setEditPriceListCode] = useState('B');
  const [editTotalPurchases, setEditTotalPurchases] = useState<number>(0);
  const [editCreditLimit, setEditCreditLimit] = useState<number>(0);
  const [editDiscountPercent, setEditDiscountPercent] = useState<number>(0);

  // Tickets State
  const [tickets, setTickets] = useState<SupportTicket[]>(() => adminService.getTickets());
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState('all');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const refreshData = () => {
    setCustomers(loadAllCrmCustomers());
    setTickets(adminService.getTickets());
  };

  const handleCreateB2bCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newB2bFullName.trim() || !newB2bPhone.trim()) return;

    const finalUsername =
      newB2bUsername.trim() ||
      generateBaseUsername(newB2bCompany || newB2bFullName) ||
      `vip_${newB2bPhone.trim().slice(-4)}`;

    const clubTierMap: Record<string, 'bronze' | 'silver' | 'gold' | 'platinum'> = {
      C: 'bronze',
      B: 'silver',
      A: 'gold',
      D: 'platinum',
    };

    const created = adminService.createB2bCustomer({
      fullName: newB2bFullName.trim(),
      companyName: newB2bCompany.trim() || 'مجموعه صنعتی همکار',
      username: finalUsername,
      phone: newB2bPhone.trim(),
      password: newB2bPassword.trim() || newB2bPhone.trim(),
      economicCode: newB2bEconomicCode.trim(),
      assignedPriceListCode: newB2bPriceListCode,
      clubTier: clubTierMap[newB2bPriceListCode] || 'silver',
      totalPurchases: Number(newB2bTotalPurchases) || 0,
      creditLimit: Number(newB2bCreditLimit) || 0,
      role: newB2bRole,
      approvedB2B: true,
    });

    pricingCreditService.onboardLegacyCustomer({
      fullName: created.fullName,
      companyName: created.companyName || '',
      phone: created.phone,
      city: created.city || 'یزد',
      assignedPriceListCode: newB2bPriceListCode,
      previousPurchaseVolume: Number(newB2bTotalPurchases) || 0,
      creditLimit: Number(newB2bCreditLimit) || 0,
    });

    try { await flushPortalChanges(); } catch (error: any) { showToast(error.message); return; }
    refreshData();
    setIsAddB2bModalOpen(false);
    setNewB2bFullName('');
    setNewB2bCompany('');
    setNewB2bUsername('');
    setUsernameEdited(false);
    setNewB2bPhone('');
    setNewB2bPassword('');
    setNewB2bEconomicCode('');
    showToast(
      `مشتری خرید بالا «${created.fullName}» با نام کاربری ${finalUsername} و شماره ${created.phone} تعریف شد و به پنل /account دسترسی دارد.`
    );
  };

  const handleToggleB2bAccess = async (customerId: string) => {
    adminService.toggleB2bApproval(customerId);
    try { await flushPortalChanges(); } catch (error: any) { showToast(error.message); return; }
    refreshData();
  };

  // Filter customers
  const filteredCustomers = customers.filter(c => {
    const custName = c.name || c.fullName || '';
    const custCompany = c.company || c.companyName || '';
    const custUsername = c.username || '';
    const custTier =
      c.tier || (c.role === 'dealer' ? 'dealer' : c.role === 'wholesale' ? 'colleague' : 'regular');
    const matchesSearch =
      custName.toLowerCase().includes(customerSearch.toLowerCase()) ||
      custCompany.toLowerCase().includes(customerSearch.toLowerCase()) ||
      custUsername.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.phone && c.phone.includes(customerSearch));
    const matchesTier = selectedTierFilter === 'all' || custTier === selectedTierFilter;
    return matchesSearch && matchesTier;
  });

  // Filter tickets
  const filteredTickets = tickets.filter(t => {
    if (ticketStatusFilter === 'all') return true;
    return t.status === ticketStatusFilter;
  });

  const handleOpenCustomerModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setEditTier(
      customer.tier ||
        (customer.role === 'dealer'
          ? 'dealer'
          : customer.role === 'wholesale'
          ? 'colleague'
          : 'regular')
    );
    setEditUsername(
      customer.username ||
        generateBaseUsername(customer.companyName || customer.company || customer.fullName || '')
    );
    setEditPhone(customer.phone || '');
    setEditPassword(customer.password || customer.phone || '');
    setEditPriceListCode(customer.assignedPriceListCode || 'B');
    setEditTotalPurchases(customer.totalPurchases || customer.totalOrdersAmount || 250000000);
    setEditCreditLimit(customer.creditLimit || 250000000);
    setEditDiscountPercent(customer.discountPercent ?? 0);
  };

  const handleSaveCustomerTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const clubTierMap: Record<string, 'bronze' | 'silver' | 'gold' | 'platinum'> = {
      C: 'bronze',
      B: 'silver',
      A: 'gold',
      D: 'platinum',
    };

    adminService.updateCustomerTier(
      selectedCustomer.id,
      editTier,
      Number(editCreditLimit),
      Number(editDiscountPercent),
      {
        username: editUsername.trim(),
        phone: editPhone.trim(),
        password: editPassword.trim(),
        assignedPriceListCode: editPriceListCode,
        clubTier: clubTierMap[editPriceListCode] || 'silver',
        totalPurchases: Number(editTotalPurchases),
      }
    );

    pricingCreditService.assignCustomerGradeAndPriceList(selectedCustomer.id, {
      priceListCode: editPriceListCode,
      clubTier: clubTierMap[editPriceListCode] || 'silver',
      creditLimit: Number(editCreditLimit),
    });

    try { await flushPortalChanges(); } catch (error: any) { showToast(error.message); return; }
    refreshData();
    setSelectedCustomer(null);
    showToast('اطلاعات ورود، نام کاربری، سطح باشگاه و لیست قیمت مشتری بروزرسانی شد.');
  };

  const handleCopyCredentials = (cust: Customer) => {
    const uname = cust.username || cust.phone;
    const pass = cust.password || cust.phone;
    navigator.clipboard.writeText(`نام کاربری: ${uname} | تلفن: ${cust.phone} | رمز عبور: ${pass}`);
    setCopiedId(cust.id);
    setTimeout(() => setCopiedId(null), 2000);
    showToast(`اطلاعات ورود «${cust.fullName}» کپی شد.`);
  };

  const handleSendTicketReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim()) return;

    adminService.replyToTicket(selectedTicket.id, replyMessage.trim(), 'answered');
    refreshData();
    const updated = adminService.getTickets().find(t => t.id === selectedTicket.id);
    setSelectedTicket(updated || null);
    setReplyMessage('');
  };

  const getClubTierLabel = (cust: Customer) => {
    const code = cust.assignedPriceListCode || 'B';
    if (!cust.approvedB2B && cust.role === 'retail' && !cust.isLegacyCustomer) {
      return 'مشتری عادی (/consumer-dashboard)';
    }
    switch (code) {
      case 'D':
        return 'الماس VIP (لیست D)';
      case 'A':
        return 'طلایی (لیست A)';
      case 'B':
        return 'نقره‌ای (لیست B)';
      case 'C':
        return 'برنزی (لیست C)';
      default:
        return 'نقره‌ای (لیست B)';
    }
  };

  const getTicketStatusBadge = (status: SupportTicket['status']) => {
    switch (status) {
      case 'open':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            باز / بی‌پاسخ
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
            در حال پیگیری
          </span>
        );
      case 'answered':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            پاسخ داده شد
          </span>
        );
      case 'closed':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
            بسته شده
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {toast && (
        <div className="fixed bottom-5 left-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center gap-2 text-xs font-bold">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[#55565A] flex items-center gap-2">
            <Users className="w-6 h-6 text-[#E06518]" />
            <span>مدیریت مشتریان خرید بالا (CRM)، نام کاربری و دسترسی پنل‌ها</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            مشتریانی که در این بخش تعریف می‌شوند با نام کاربری و شماره تلفن ثبت‌شده مستقیماً وارد پنل مشتریان خرید بالا (<span className="font-mono" dir="ltr">/account</span>) می‌شوند و گریدبندی مخصوص آن‌هاست.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddB2bModalOpen(true)}
            className="h-10 px-4 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ تعریف مشتری پنل خرید بالا (/account)</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('customers')}
          className={`py-2 px-4 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'customers'
              ? 'bg-[#55565A] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>مشتریان، نام کاربری و سطح خرید ({toPersianDigits(customers.length)})</span>
        </button>

        <button
          onClick={() => setActiveTab('tickets')}
          className={`py-2 px-4 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'tickets'
              ? 'bg-[#55565A] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>تیکت‌های پشتیبانی ({toPersianDigits(tickets.length)})</span>
        </button>
      </div>

      {/* --- SUBTAB 1: CUSTOMERS CRM --- */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <input
                type="text"
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                placeholder="جستجو با نام شخص، شرکت، نام کاربری یا شماره تلفن..."
                className="w-full h-10 pr-9 pl-3 rounded-xl border border-slate-200 text-xs outline-none focus:border-[#E06518]"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedTierFilter}
                onChange={e => setSelectedTierFilter(e.target.value)}
                className="h-10 px-3 rounded-xl border border-slate-200 text-xs bg-white outline-none focus:border-[#E06518]"
              >
                <option value="all">همه مشتریان</option>
                <option value="colleague">همکار / خرید بالا</option>
                <option value="factory">کارخانجات صنعتی</option>
                <option value="dealer">نماینده رسمی</option>
                <option value="regular">مشتریان عادی ثبت‌نامی</option>
              </select>
            </div>
          </div>

          {/* Customers Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-[#55565A]">
                    <th className="py-3.5 px-4">نام مخاطب / مجموعه</th>
                    <th className="py-3.5 px-4">نام کاربری ورود</th>
                    <th className="py-3.5 px-4">شماره تلفن (ورود)</th>
                    <th className="py-3.5 px-4">سطح باشگاه و لیست قیمت</th>
                    <th className="py-3.5 px-4">پنل مجاز دسترسی</th>
                    <th className="py-3.5 px-4">حجم خرید ثبت‌شده</th>
                    <th className="py-3.5 px-4">سقف اعتبار</th>
                    <th className="py-3.5 px-4 text-center">عملیات CRM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.map(cust => {
                    const isHighVol =
                      Boolean(cust.approvedB2B) ||
                      Boolean(cust.isLegacyCustomer) ||
                      (cust.role && cust.role !== 'retail');
                    const uname =
                      cust.username ||
                      generateBaseUsername(cust.companyName || cust.company || cust.fullName || '');

                    return (
                      <tr key={cust.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#55565A]">
                            {cust.name || cust.fullName}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {cust.company || cust.companyName}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-black text-[#E06518]" dir="ltr">
                          {uname}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-700" dir="ltr">
                          {cust.phone}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-800">
                            {getClubTierLabel(cust)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {isHighVol ? (
                            <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>پنل خرید بالا (/account)</span>
                            </span>
                          ) : (
                            <span className="text-slate-600 font-bold text-[11px] flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>پنل مشتریان (/consumer-dashboard)</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                          {formatPrice(cust.totalPurchases || cust.totalOrdersAmount || 0)} ت
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                          {cust.creditLimit ? `${formatPrice(cust.creditLimit)} ت` : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCopyCredentials(cust)}
                              className="py-1.5 px-2.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#E06518] font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                              title="کپی نام کاربری و شماره تلفن برای ورود"
                            >
                              {copiedId === cust.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span>کپی ورود</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenCustomerModal(cust)}
                              className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#55565A] font-bold text-[11px] cursor-pointer"
                            >
                              ویرایش سطح و کاربری
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleB2bAccess(cust.id)}
                              className={`py-1.5 px-2.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer ${
                                isHighVol
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {isHighVol ? 'تغییر به پنل عادی' : 'ارتقا به خرید بالا'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- SUBTAB 2: TICKETS --- */}
      {activeTab === 'tickets' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-600">فهرست تیکت‌ها</h3>
              <select
                value={ticketStatusFilter}
                onChange={e => setTicketStatusFilter(e.target.value)}
                className="h-8 px-2 rounded-lg border border-slate-200 text-xs bg-white outline-none"
              >
                <option value="all">همه</option>
                <option value="open">بی‌پاسخ</option>
                <option value="answered">پاسخ داده شده</option>
                <option value="closed">بسته</option>
              </select>
            </div>

            <div className="space-y-2">
              {filteredTickets.map(t => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTicket(t)}
                  className={`p-4 rounded-2xl border text-right cursor-pointer transition-all ${
                    selectedTicket?.id === t.id
                      ? 'bg-orange-50/70 border-[#E06518] shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] text-slate-400">#{t.id}</span>
                    {getTicketStatusBadge(t.status)}
                  </div>
                  <h4 className="font-bold text-xs text-[#55565A] line-clamp-1">{t.subject}</h4>
                  <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>{t.customerName}</span>
                    <span>{t.createdAt}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
            {selectedTicket ? (
              <>
                <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-black text-sm text-[#55565A]">{selectedTicket.subject}</h3>
                    <div className="text-xs text-slate-400 mt-0.5">
                      ارسال‌کننده: <b className="text-slate-700">{selectedTicket.customerName}</b> ({selectedTicket.phone})
                    </div>
                  </div>
                  {getTicketStatusBadge(selectedTicket.status)}
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {selectedTicket.messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`p-4 rounded-2xl text-xs space-y-1 ${
                        msg.sender === 'admin'
                          ? 'bg-[#55565A] text-white ml-6'
                          : 'bg-slate-50 border border-slate-200 text-slate-800 mr-6'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] opacity-75 font-bold">
                        <span>{msg.sender === 'admin' ? 'کارشناس پشتیبانی اطلس' : selectedTicket.customerName}</span>
                        <span>{msg.timestamp}</span>
                      </div>
                      <p className="leading-relaxed">{msg.text}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSendTicketReply} className="space-y-3 pt-4 border-t border-slate-100">
                  <textarea
                    rows={3}
                    value={replyMessage}
                    onChange={e => setReplyMessage(e.target.value)}
                    placeholder="پاسخ به تیکت مشتری..."
                    className="w-full p-3 rounded-2xl border border-slate-200 text-xs outline-none focus:border-[#E06518]"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="submit"
                      className="py-2.5 px-6 rounded-xl bg-[#55565A] hover:bg-[#1B293E] text-white font-black text-xs flex items-center gap-2 cursor-pointer"
                    >
                      <Send className="w-4 h-4 text-[#E06518]" />
                      <span>ارسال پاسخ</span>
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="py-20 text-center text-slate-400 text-xs">
                جهت مشاهده متن گفتگو، یک تیکت از ستون راست را انتخاب فرمایید.
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- EDIT CUSTOMER CREDENTIALS, TIER & VOLUME MODAL --- */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl border border-slate-200 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-sm text-[#55565A]">
                  ویرایش نام کاربری، سطح باشگاه و حجم خرید: {selectedCustomer.fullName || selectedCustomer.name}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  شرکت: {selectedCustomer.companyName || selectedCustomer.company}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomerTier} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    نام کاربری اختصاصی ورود به /account
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={editUsername}
                    onChange={e => setEditUsername(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 font-mono font-bold outline-none focus:border-[#E06518]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    شماره موبایل ورود
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 font-mono font-bold outline-none focus:border-[#E06518]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">رمز عبور ورود</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={editPassword}
                    onChange={e => setEditPassword(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 font-mono outline-none focus:border-[#E06518]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    سطح باشگاه و لیست قیمت (مخصوص خرید بالا)
                  </label>
                  <select
                    value={editPriceListCode}
                    onChange={e => setEditPriceListCode(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white outline-none focus:border-[#E06518]"
                  >
                    <option value="C">سطح برنزی (لیست قیمت C)</option>
                    <option value="B">سطح نقره‌ای (لیست قیمت B)</option>
                    <option value="A">سطح طلایی (لیست قیمت A)</option>
                    <option value="D">سطح الماس VIP (لیست قیمت D)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    حجم خرید ثبت‌شده (تومان - جهت نمودار میله‌ای)
                  </label>
                  <input
                    type="number"
                    value={editTotalPurchases}
                    onChange={e => setEditTotalPurchases(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 font-mono font-bold outline-none focus:border-[#E06518]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    سقف اعتبار خرید (تومان)
                  </label>
                  <input
                    type="number"
                    value={editCreditLimit}
                    onChange={e => setEditCreditLimit(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 font-mono font-bold outline-none focus:border-[#E06518]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#E06518] text-white text-xs font-black shadow-xs cursor-pointer"
                >
                  ذخیره تغییرات مشتری
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD NEW HIGH-VOLUME (/account) CUSTOMER MODAL --- */}
      {isAddB2bModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl border border-slate-200 shadow-2xl p-6 space-y-5 text-right">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-orange-100 text-[#E06518] flex items-center justify-center font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-[#55565A]">
                    تعریف مشتری جدید پنل خرید بالا (/account)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    با نام کاربری و شماره تلفنی که اینجا ثبت می‌کنید، مشتری مستقیماً وارد پنل /account می‌شود
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddB2bModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateB2bCustomer} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    نام و نام خانوادگی مسئول <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newB2bFullName}
                    onChange={e => setNewB2bFullName(e.target.value)}
                    placeholder="مثلاً مهندس مرتضی دهقانی"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white outline-none focus:border-[#E06518]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    نام شرکت / کارخانه / مجموعه
                  </label>
                  <input
                    type="text"
                    value={newB2bCompany}
                    onChange={e => {
                      setNewB2bCompany(e.target.value);
                      if (!usernameEdited) setNewB2bUsername(generateBaseUsername(e.target.value));
                    }}
                    placeholder="مثلاً کاشی ستاره میبد"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white outline-none focus:border-[#E06518]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    نام کاربری ورود <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={newB2bUsername}
                    onChange={e => { setUsernameEdited(true); setNewB2bUsername(e.target.value); }}
                    placeholder="setareh_meybod"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 font-mono text-left bg-white outline-none focus:border-[#E06518]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    شماره تلفن همراه <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    dir="ltr"
                    value={newB2bPhone}
                    onChange={e => {
                      setNewB2bPhone(e.target.value);
                    }}
                    placeholder="09131514455"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 font-mono text-left bg-white outline-none focus:border-[#E06518]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">رمز عبور ورود</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={newB2bPassword}
                    onChange={e => setNewB2bPassword(e.target.value)}
                    placeholder="پیش‌فرض: شماره موبایل"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 font-mono text-left bg-white outline-none focus:border-[#E06518]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    سطح باشگاه و لیست قیمت
                  </label>
                  <select
                    value={newB2bPriceListCode}
                    onChange={e => setNewB2bPriceListCode(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white outline-none focus:border-[#E06518]"
                  >
                    <option value="C">سطح برنزی (لیست C)</option>
                    <option value="B">سطح نقره‌ای (لیست B)</option>
                    <option value="A">سطح طلایی (لیست A)</option>
                    <option value="D">سطح الماس VIP (لیست D)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    حجم خرید ثبت‌شده (تومان)
                  </label>
                  <input
                    type="number"
                    value={newB2bTotalPurchases}
                    onChange={e => setNewB2bTotalPurchases(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 font-mono font-bold outline-none focus:border-[#E06518]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    سقف اعتبار خرید (تومان)
                  </label>
                  <input
                    type="number"
                    value={newB2bCreditLimit}
                    onChange={e => setNewB2bCreditLimit(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 font-mono font-bold outline-none focus:border-[#E06518]"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-[11px] text-emerald-800 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                  <span>دسترسی انحصاری به پنل خرید بالا (/account)</span>
                </div>
                <p>
                  این مشتری می‌تواند با نام کاربری (<strong className="font-mono">{newB2bUsername || '...'}</strong>) یا شماره موبایل (<strong className="font-mono">{newB2bPhone || '...'}</strong>) وارد سایت شود و مستقیماً به پنل <strong className="font-mono">/account</strong> هدایت می‌گردد.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddB2bModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>ثبت مشتری و فعال‌سازی پنل /account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
