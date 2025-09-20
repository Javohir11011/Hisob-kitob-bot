import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Context, Markup } from 'telegraf';
import { PrismaService } from '../../core/prisma.service';
import { SessionData } from '../states/session.data';
import { loginPhoneKeyboard } from '../utils/keyboard';

@Injectable()
export class AuthHandler {
  constructor(private readonly prisma: PrismaService) {}

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
    await ctx.reply('Kirish uchun /login yozing.');
  }

  // /login komandasi
  async login(ctx: Context, session: SessionData) {
    session.state = 'awaiting_password';
    await ctx.reply('Iltimos, parolingizni kiriting:', Markup.removeKeyboard());
  }

  async handlePassword({
    ctx,
    session,
  }: {
    ctx: Context;
    session: SessionData;
  }) {
    if (!ctx.message || !('text' in ctx.message)) return;
    session.password = ctx.message.text.trim();
    session.state = 'awaiting_phone';
    await ctx.reply(
      'Endi telefon raqamingizni yuboring:',
      loginPhoneKeyboard(),
    );
  }

  // Kontaktni qabul qilish (telefon raqam)
  async handleContact(ctx: Context, session: SessionData) {
    if (!ctx.message) return;

    // Faqat phone kutilayotgan state da ishlaydi
    if (session.state !== 'awaiting_phone') return;

    let phone: string | undefined;

    if ('contact' in ctx.message) {
      phone = ctx.message.contact.phone_number.replace(/\s+/g, '');
      console.log('Kontakt orqali:', phone);
    } else if ('text' in ctx.message && typeof ctx.message.text === 'string') {
      phone = ctx.message.text.replace(/\s+/g, '');
      console.log('Matn orqali:', phone);
    }

    if (!phone) return;

    if (phone.startsWith('0')) phone = '+998' + phone.slice(1);
    if (!phone.startsWith('+')) phone = '+' + phone;

    const password = session.password?.trim();
    session.phone = phone;
    session.state = undefined;

    const user = await this.prisma.user.findFirst({ where: { phone } });
    if (!user) {
      await ctx.reply(
        'Telefon raqam topilmadi. /login bilan qayta urinib ko‘ring.',
        Markup.removeKeyboard(),
      );
      return;
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      await ctx.reply(
        'Parol noto‘g‘ri. /login bilan qayta urinib ko‘ring.',
        Markup.removeKeyboard(),
      );
      return;
    }

    await ctx.reply(
      `Salom ${user.name || 'Foydalanuvchi'}, siz muvaffaqiyatli login qildingiz!`,
      Markup.removeKeyboard(),
    );

    await ctx.reply(
      'Asosiy menyudan birini tanlang:',
      Markup.keyboard([
        ['📊 Statistika', '➕ Add Shop Owner'],
        ['⚙️ Sozlamalar', '🔍 Search Owner'],
        ['👤 Profil', 'Remove Owner'],
      ])
        .resize()
        .persistent(),
    );
  }
}
