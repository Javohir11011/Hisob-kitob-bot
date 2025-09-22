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
    | 'adding_debt_name'
    | 'adding_debt_amount'
    | 'paying_debt_name'
    | 'paying_debt_amount'
    | 'adding_debtor_name'
    | 'adding_debtor_phone';
  tempOwnerId?: string;
  updateField?: 'name' | 'phone' | 'shop';
  password?: string;
  phone?: string;
  user?: any;
  newOwnerName?: string;
  newOwnerPhone?: string;
  newOwnerPassword?: string;
  newOwnerShop?: string;
  newOwnerShopAddress?: string;

  // 🔹 Helper uchun yangi maydonlar
  newHelperName?: string;
  newHelperPhone?: string;
  newHelperPassword?: string;
  userId: string;
  tempDebtName?: string;
  newDebtorName?: string;
  newDebtorPhone?: string;
};
