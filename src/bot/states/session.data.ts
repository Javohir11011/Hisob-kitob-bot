export type SessionData = {
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

    // 🔹 Debtor (qarzdorlar bilan ishlash)
    | 'adding_debtor_name'
    | 'adding_debtor_phone'
    | 'adding_debtor_address'
    | 'search_debtor_for_debt'

    // 🔹 Debt (qarzlar bilan ishlash)
    | 'adding_debt_name'
    | 'adding_debt_amount'
    | 'adding_debt_note'
    | 'paying_debt_name'
    | 'paying_debt_amount';

  // --- General session data ---
  tempOwnerId?: string;
  updateField?: 'name' | 'phone' | 'shop';
  password?: string;
  phone?: string;
  user?: any;
  userId: string;
  debtorId?: string; // qarzdor tanlanganda

  // --- Owner qo‘shish ---
  newOwnerName?: string;
  newOwnerPhone?: string;
  newOwnerPassword?: string;
  newOwnerShop?: string;
  newOwnerShopAddress?: string;

  // --- Helper qo‘shish ---
  newHelperName?: string;
  newHelperPhone?: string;
  newHelperPassword?: string;

  // --- Debtor qo‘shish ---
  newDebtorName?: string;
  newDebtorPhone?: string;
  newDebtorAddress?: string;
  tempDebtorId?: string;

  // --- Debt qo‘shish ---
  tempDebtName?: string; // Qarzdorning ismi / tanlangan nomi
  tempDebtAmount?: number; // Summani vaqtincha saqlash
  tempDebtNote?: string; // Izohni vaqtincha saqlash
  newDebtTitle?: string; // Agar nom berilsa
};
