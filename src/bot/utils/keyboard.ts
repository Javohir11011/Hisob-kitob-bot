import { Markup } from 'telegraf';

export const cancelKeyboard: () => ReturnType<typeof Markup.keyboard> = () =>
  Markup.keyboard([['❌ Bekor qilish']])
    .oneTime()
    .resize();

export const superAdminKeyboard: () => ReturnType<
  typeof Markup.keyboard
> = () =>
  Markup.keyboard([
    ['➕ Add Shop Owner', '📋 Shop Owners List'],
    ['📊 Umumiy Hisobot', '🔑 Update Password'],
  ])
    .oneTime()
    .resize();

export const loginPhoneKeyboard: () => ReturnType<
  typeof Markup.keyboard
> = () =>
  Markup.keyboard([
    [Markup.button.contactRequest('📱 Telefon raqamni yuborish')],
  ])
    .oneTime()
    .resize();
