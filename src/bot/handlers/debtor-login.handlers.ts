import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Context, Markup } from 'telegraf';
import { PrismaService } from '../../core/prisma.service';
import { SessionData } from '../states/session.data';
import { DebtorHandler } from './debtor.handlers';

@Injectable()
export class DebtorLoginHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly debtorHandler: DebtorHandler,
  ) {}

  // 1️⃣ Loginni boshlash
  async startLogin(ctx: Context, session: SessionData) {
    session.state = 'debtor_login_password';
    await ctx.reply(
      '🔐 Iltimos, parolingizni kiriting:',
      Markup.removeKeyboard(),
    );
  }

  // 2️⃣ Parol qabul qilish
  async handlePassword(ctx: Context, session: SessionData) {
    if (!ctx.message || !('text' in ctx.message)) return;

    session.debtorPassword = ctx.message.text.trim();
    session.state = 'debtor_login_phone';

    await ctx.reply(
      '📱 Endi telefon raqamingizni yuboring:',
      Markup.keyboard([
        Markup.button.contactRequest('📲 Telefonni yuborish'),
      ]).resize(),
    );
  }

  // 3️⃣ Telefon qabul qilish (text yoki contact tugma)
  async handlePhone(ctx: Context, session: SessionData) {
    if (!ctx.message || session.state !== 'debtor_login_phone') return;

    const msg: any = ctx.message;
    let rawPhone: string | undefined;

    // contact tugmasidan kelgan telefon
    if (msg.contact?.phone_number) {
      rawPhone = msg.contact.phone_number;
    }
    // text orqali kelgan telefon
    else if (typeof msg.text === 'string') {
      rawPhone = msg.text;
    }

    if (!rawPhone) {
      await ctx.reply('❌ Iltimos, telefon raqamingizni yuboring.');
      return;
    }

    // normalizatsiya
    let phone = rawPhone.replace(/\s+/g, '');
    if (phone.startsWith('0')) phone = '+998' + phone.slice(1);
    else if (!phone.startsWith('+')) phone = '+' + phone;

    if (!/^\+998\d{9}$/.test(phone) && !/^\+7\d{10}$/.test(phone)) {
      await ctx.reply('❌ Telefon raqam formati noto‘g‘ri.');
      return;
    }
    const debtor = await this.prisma.debtor.findFirst({ where: { phone } });
    if (!debtor) {
      await ctx.reply('❌ Bunday telefon raqam topilmadi.');
      return;
    }

    // Parolni tekshirish
    const passwordMatch = await bcrypt.compare(
      session.debtorPassword || '',
      debtor.password || '',
    );
    if (!passwordMatch) {
      await ctx.reply(
        '❌ Parol noto‘g‘ri. /login_debtor bilan qayta urinib ko‘ring.',
      );
      return;
    }

    // Telegram IDni saqlash
    await this.prisma.debtor.update({
      where: { id: debtor.id },
      data: { telegramId: String(ctx.from?.id) },
    });

    // muvaffaqiyatli login
    session.role = 'DEBTOR';
    session.debtorId = debtor.id;
    session.state = 'debtor_menu';

    // Asosiy DEBTOR menyusi
    await this.debtorHandler.showMenu(ctx, session);
  }
}
