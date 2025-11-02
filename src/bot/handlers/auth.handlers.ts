import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Context, Markup } from 'telegraf';
import { PrismaService } from '../../core/prisma.service';
import { SessionData } from '../states/session.data';
import { loginPhoneKeyboard } from '../utils/keyboard';
import { ShopOwnerHandler } from './shop-owner.handlers';
import { SuperAdminHandler } from './super-admin.handler';

@Injectable()
export class AuthHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shopOwnerHandler: ShopOwnerHandler,
    private readonly superAdminHandler: SuperAdminHandler,
  ) {}

  // /start komandasi
  async start(ctx: Context) {
    if ('text' in (ctx.message ?? {})) {
      console.log('Start command keldi:', (ctx.message as any).text);
    } else {
      console.log('Start command keldi, lekin bu text emas:', ctx.message);
    }

    await ctx.reply(
      'Assalomu alaykum 👋 Qarzingizni boshqarish botiga xush kelibsiz.',
    );
    await ctx.reply(
      'Kirish uchun /login yozing\nYoki qarzdor sifatida kirish uchun /login_debtor yozing',
    );
  }

  // /login komandasi
  async login(ctx: Context, session: SessionData) {
    session.state = 'awaiting_password';
    await ctx.reply('Iltimos, parolingizni kiriting:', Markup.removeKeyboard());
  }

  // Parolni qabul qilish
  async handlePassword({
    ctx,
    session,
  }: {
    ctx: Context;
    session: SessionData;
  }): Promise<void> {
    if (!ctx.message || !('text' in ctx.message)) return;
    session.password = ctx.message.text.trim();
    session.state = 'awaiting_phone';
    await ctx.reply(
      'Endi telefon raqamingizni yuboring:',
      loginPhoneKeyboard(),
    );
  }

  // Kontakt yoki text orqali telefon raqamini qabul qilish
  async handleContact(ctx: Context, session: SessionData): Promise<void> {
    if (!ctx.message || session.state !== 'awaiting_phone') return;

    let phone: string | undefined;

    if ('contact' in ctx.message) {
      phone = ctx.message.contact.phone_number.replace(/\s+/g, '');
    } else if ('text' in ctx.message && typeof ctx.message.text === 'string') {
      phone = ctx.message.text.replace(/\s+/g, '');
    }

    if (!phone) return;

    // Telefon formatlash: +998 va +7 qo‘llash
    if (phone.startsWith('0')) {
      // O'zbek raqami
      phone = '+998' + phone.slice(1);
    } else if (!phone.startsWith('+')) {
      phone = '+' + phone;
    }

    // Faqat +998 va +7 raqamlarni qabul qilamiz
    if (!/^\+998\d{9}$/.test(phone) && !/^\+7\d{10}$/.test(phone)) {
      await ctx.reply(
        '❌ Telefon noto‘g‘ri formatda. Iltimos +998XXXXXXXXX yoki +7XXXXXXXXXX shaklida kiriting.',
      );
      return;
    }

    const password = session.password?.trim();
    session.phone = phone;

    // Foydalanuvchini bazadan topish
    const user = await this.prisma.user.findFirst({ where: { phone } });
    if (!user) {
      await ctx.reply(
        'Telefon raqam topilmadi. /login bilan qayta urinib ko‘ring.',
        Markup.removeKeyboard(),
      );
      return;
    }

    // Parolni tekshirish
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      await ctx.reply(
        'Parol noto‘g‘ri. /login bilan qayta urinib ko‘ring.',
        Markup.removeKeyboard(),
      );
      return;
    }

    // Login muvaffaqiyatli
    await ctx.reply(
      `Salom ${user.name || 'Foydalanuvchi'}, siz muvaffaqiyatli login qildingiz!`,
      Markup.removeKeyboard(),
    );

    // sessionga role berish
    session.role = user.role as SessionData['role'];

    if (!session.role) {
      await ctx.reply('Roli aniqlanmadi. Admin bilan bog‘laning.');
      return;
    }

    // Rolega qarab menyu ochish
    if (session.role === 'SUPER_ADMIN') {
      session.state = 'super_admin_menu';
      await this.superAdminHandler.showMenu(ctx, session);
    } else if (['SHOP_OWNER', 'SHOP_HELPER'].includes(session.role)) {
      session.state = 'shop_owner_menu';
      await this.shopOwnerHandler.showMenu(ctx, session);
    }
  }
}
