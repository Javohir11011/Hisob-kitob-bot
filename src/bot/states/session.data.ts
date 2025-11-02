// types/session.ts
export type SessionData = {
  // 🔹 Hozirgi session holati
  state?:
    | 'awaiting_password'
    | 'awaiting_phone'
    | 'super_admin_menu'
    | 'shop_owner_menu'
    | 'adding_owner_name'
    | 'adding_owner_phone'
    | 'adding_owner_password'
    | 'adding_owner_shop'
    | 'adding_owner_shop_address'
    | 'search_owner'
    | 'updating_owner'
    | 'updating_owner_field'
    | 'adding_helper_name'
    | 'adding_helper_phone'
    | 'adding_helper_password'
    | 'shop_owner_profile'
    | 'updating_own_info'
    | 'updating_own_name'
    | 'updating_own_phone'
    | 'updating_own_password'
    | 'searching_debtor'
    | 'editing_debtor_name'
    | 'editing_debtor_phone'
    | 'debtor_menu'
    | 'editing_debtor'
    | 'paying_debt'
    | 'awaiting_debtor_for_payment'
    | 'awaiting_single_debt_payment'

    // 🔹 Debtor (qarzdorlar bilan ishlash)
    | 'adding_debtor_name'
    | 'adding_debtor_phone'
    | 'adding_debtor_address'
    | 'search_debtor_for_debt'
    | 'selecting_debtor'
    | 'adding_debtor_initial_debt'

    // 🔹 Debt (qarzlar bilan ishlash)
    | 'adding_debt_name'
    | 'adding_debt_amount'
    | 'adding_debt_note'
    | 'paying_debt_name'
    | 'paying_debt_amount'
    | 'updating_debt'
    | 'editing_debt'
    | 'awaiting_debtor_selection'
    | 'adding_debtor_password';

  // --- General session data ---
  userId: string;
  phone?: string;
  password?: string;
  user?: any;
  role?: 'SUPER_ADMIN' | 'SHOP_OWNER' | 'SHOP_HELPER'; // user roli

  tempOwnerId?: string; // Owner qo‘shishda vaqtinchalik
  updateField?: 'name' | 'phone' | 'shop';

  debtorId?: string; // Tanlangan qarzdor id
  tempDebtorId?: string; // Vaqtinchalik qarzdor id
  editingDebtId?: string; // Tahrirlash uchun qarz id
  tempDebtorList?: Array<{
    id: string;
    name: string;
    phone?: string;
    address?: string | null;
  }>;

  // --- Owner qo‘shish ---
  newOwnerName?: string;
  newOwnerPhone?: string;
  newOwnerPassword?: string;
  newOwnerShop?: string;
  newOwnerShopAddress?: string;
  editingDebtorId?: string;

  // --- Helper qo‘shish ---
  newHelperName?: string;
  newHelperPhone?: string;
  newHelperPassword?: string;

  // --- Debtor qo‘shish ---
  newDebtorName?: string;
  newDebtorPhone?: string;
  newDebtorAddress?: string;
  newDebtorPassword?: string;

  // --- Debt qo‘shish ---
  tempDebtName?: string; // Qarzdor nomi
  tempDebtAmount?: number;
  tempDebtNote?: string;
  newDebtTitle?: string;

  shopId?: string; // Hozirgi shop id
};
