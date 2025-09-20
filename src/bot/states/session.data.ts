// export type SessionData = {
//   state?:
//     | 'awaiting_password'
//     | 'awaiting_phone'
//     | 'super_admin_menu'
//     | 'adding_owner_name'
//     | 'adding_owner_phone'
//     | 'adding_owner_password'
//     | 'adding_owner_shop'
//     | 'adding_owner_shop_address'
//     | 'search_owner'
//     | 'updating_owner'
//     | 'updating_owner_field';
//   password?: string;
//   phone?: string;
//   user?: any;
//   newOwnerName?: string;
//   newOwnerPhone?: string;
//   newOwnerPassword?: string;
//   newOwnerShop?: string;
//   newOwnerShopAddress?: string;

//   // ⬇️ Yangi maydonlar update jarayoni uchun
//   tempOwnerId?: string; // tanlangan owner id
//   updateField?: 'name' | 'phone' | 'shop'; // qaysi maydonni update qilmoqchisiz
// };

export type SessionData = {
  state?:
    | 'awaiting_password'
    | 'awaiting_phone'
    | 'super_admin_menu'
    | 'adding_owner_name'
    | 'adding_owner_phone'
    | 'adding_owner_password'
    | 'adding_owner_shop'
    | 'adding_owner_shop_address'
    | 'search_owner'
    | 'updating_owner'
    | 'updating_owner_field';
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
};
