import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Context, Markup } from 'telegraf';
import { PrismaService } from '../../core/prisma.service';
import { SessionData } from '../states/session.data';

@Injectable()
export class ShopOwnerHandler {
  constructor(private readonly prisma: PrismaService) {}

  /* -----------------------
     ASOSIY MENU
     ----------------------- */
  async showMenu(ctx: Context, session: SessionData): Promise<void> {
    session.state = 'shop_owner_menu';
    await ctx.reply(
      'Asosiy menyudan birini tanlang:',
      Markup.keyboard([
        ['📋 Qarzdorlar', '➕ Qarzdor qo‘shish'],
        ['➕ Qarz qo‘shish', '💰 Qarz yopish'],
        ['👤 Profil', '➕ Add Helper'],
      ])
        .resize()
        .persistent(),
    );
  }

  /* -----------------------
   PROFIL
   ----------------------- */
  async showProfile(ctx: Context, session: SessionData): Promise<void> {
    if (!session.phone) {
      await ctx.reply('Login qilishingiz kerak.');
      return;
    }

    const user = await this.prisma.user.findFirst({
      where: { phone: session.phone },
      include: { shop: true },
    });
    if (!user) {
      await ctx.reply('❌ Foydalanuvchi topilmadi.');
      return;
    }

    const message = `
👤 Ism: ${user.name}
📞 Telefon: ${user.phone}
🏬 Dokon: ${user.shop?.name ?? '-'}
🕒 Ro‘yxatdan: ${user.createdAt.toLocaleString()}
  `;
    await ctx.reply(message, Markup.keyboard([['⬅️ Orqaga qaytish']]).resize());
    session.state = 'shop_owner_profile';
  }

  /* -----------------------
     TEXT HANDLER
     ----------------------- */
  async handleText(ctx: Context, session: SessionData): Promise<void> {
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = ctx.message.text.trim();

    switch (session.state) {
      /* --- Asosiy menyu --- */
      case 'shop_owner_menu':
        if (text === '➕ Qarzdor qo‘shish') {
          return this.startAddDebtor(ctx, session);
        }
        if (text === '➕ Qarz qo‘shish') {
          return this.startAddDebtSearch(ctx, session);
        }
        if (text === '👤 Profil') {
          return this.showProfile(ctx, session);
        }
        if (text === '📋 Qarzdorlar') {
          return this.showDebtors(ctx, session);
        }
        break;

      /* --- Profil --- */
      case 'shop_owner_profile':
        if (text === '⬅️ Orqaga qaytish') {
          return this.showMenu(ctx, session);
        }
        break;

      /* --- Qarzdor qo‘shish --- */
      case 'adding_debtor_name':
      case 'adding_debtor_phone':
      case 'adding_debtor_address':
        return this.handleAddDebtor(ctx, session);

      /* --- Qarz qo‘shish --- */
      case 'search_debtor_for_debt':
        return this.handleSearchDebtorForDebt(ctx, session);
      case 'adding_debt_amount':
      case 'adding_debt_note':
        return this.handleAddDebtAmountAndNote(ctx, session);

      /* --- Helper qo‘shish --- */
      case 'adding_helper_name':
      case 'adding_helper_phone':
      case 'adding_helper_password':
        return this.handleAddHelper(ctx, session);

      /* --- Default (hech narsa qilmaydi) --- */
      default:
        return;
    }
  }

  /* -----------------------
     HELPER QO‘SHISH
     ----------------------- */
  async startAddHelper(ctx: Context, session: SessionData): Promise<void> {
    session.state = 'adding_helper_name';
    await ctx.reply(
      'Yangi Helper ismini kiriting:',
      Markup.keyboard([['❌ Bekor qilish']]).resize(),
    );
  }

  async handleAddHelper(ctx: Context, session: SessionData): Promise<void> {
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = ctx.message.text.trim();
    if (text === '❌ Bekor qilish') return this.showMenu(ctx, session);

    switch (session.state) {
      case 'adding_helper_name':
        session.newHelperName = text;
        session.state = 'adding_helper_phone';
        await ctx.reply('Helper telefon raqamini kiriting (+998XXXXXXXXX):');
        return;

      case 'adding_helper_phone':
        let phone = text;
        if (phone.startsWith('0')) phone = '+998' + phone.slice(1);
        if (!phone.startsWith('+')) phone = '+' + phone;
        if (!/^\+998\d{9}$/.test(phone)) {
          await ctx.reply('❌ Telefon noto‘g‘ri formatda.');
          return;
        }
        session.newHelperPhone = phone;
        session.state = 'adding_helper_password';
        await ctx.reply('Helper uchun parol kiriting:');
        return;

      case 'adding_helper_password':
        session.newHelperPassword = text;
        const shopOwner = await this.prisma.user.findFirst({
          where: { phone: session.phone },
        });
        if (!shopOwner?.shopId) {
          await ctx.reply('❌ Sizning shopingiz topilmadi.');
          return;
        }
        await this.prisma.user.create({
          data: {
            name: session.newHelperName ?? '',
            phone: session.newHelperPhone ?? '',
            password: await bcrypt.hash(session.newHelperPassword ?? '', 10),
            role: 'SHOP_HELPER',
            shopId: shopOwner.shopId,
          },
        });
        await ctx.reply(`✅ Helper "${session.newHelperName}" qo‘shildi`);
        return this.showMenu(ctx, session);
    }
  }

  /* -----------------------
     QARZDOR CRUD
     ----------------------- */
  async startAddDebtor(ctx: Context, session: SessionData): Promise<void> {
    session.state = 'adding_debtor_name';
    await ctx.reply(
      'Yangi qarzdor ismini kiriting:',
      Markup.keyboard([['❌ Bekor qilish']]).resize(),
    );
  }

  async handleAddDebtor(ctx: Context, session: SessionData): Promise<void> {
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = ctx.message.text.trim();
    if (text === '❌ Bekor qilish') return this.showMenu(ctx, session);

    switch (session.state) {
      case 'adding_debtor_name':
        session.newDebtorName = text;
        session.state = 'adding_debtor_phone';
        await ctx.reply(
          '📞 Qarzdor telefon raqamini kiriting (+998XXXXXXXXX):',
        );
        return;

      case 'adding_debtor_phone':
        let phone = text;
        if (phone.startsWith('0')) phone = '+998' + phone.slice(1);
        if (!phone.startsWith('+')) phone = '+' + phone;
        if (!/^\+998\d{9}$/.test(phone)) {
          await ctx.reply('❌ Telefon noto‘g‘ri formatda.');
          return;
        }
        session.newDebtorPhone = phone;
        session.state = 'adding_debtor_address';
        await ctx.reply(
          '🏠 Qarzdor manzilini kiriting (bo‘sh qoldirsa bo‘ladi):',
        );
        return;

      case 'adding_debtor_address':
        session.newDebtorAddress = text;
        const shopOwner = await this.prisma.user.findFirst({
          where: { phone: session.phone },
        });
        if (!shopOwner?.shopId) {
          await ctx.reply('❌ Sizning shopingiz topilmadi.');
          return;
        }
        await this.prisma.debtor.create({
          data: {
            name: session.newDebtorName ?? '',
            phone: session.newDebtorPhone ?? '',
            address: session.newDebtorAddress ?? '',
            shopId: shopOwner.shopId,
          },
        });
        await ctx.reply(`✅ Qarzdor "${session.newDebtorName}" qo‘shildi`);
        await this.showMenu(ctx, session);
    }
  }

  async showDebtors(ctx: Context, session: SessionData): Promise<void> {
    const shopOwner = await this.prisma.user.findFirst({
      where: { phone: session.phone },
    });
    if (!shopOwner?.shopId) {
      await ctx.reply('❌ Sizning shopingiz topilmadi.');
      return;
    }

    const debtors = await this.prisma.debtor.findMany({
      where: { shopId: shopOwner.shopId },
      select: { debts: true, createdAt: true, name: true, phone: true },
    });
    if (debtors.length === 0) {
      await ctx.reply('📭 Hozircha qarzdorlar yo‘q.');
      return;
    }

    let list = '📋 Qarzdorlar:\n\n';

    debtors.forEach((d, i) => {
      const totalDebt = d.debts.reduce((sum, debt) => sum + debt.amount, 0); // ✅ umumiy qarz hisoblash
      const createdAt = d.createdAt
        ? new Date(d.createdAt).toLocaleDateString('uz-UZ', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : '❌ Sana yo‘q';

      list += `${i + 1}. 🧾 ${d.name}\n`;
      list += `   ☎️ ${d.phone ?? 'yo‘q'}\n`;
      list += `   💰 Umumiy qarz: ${totalDebt.toLocaleString()} so‘m\n`;
      list += `   📅 Qo‘shilgan: ${createdAt}\n\n`;
    });
    await ctx.reply(list);
  }

  /* -----------------------
   QARZ QO‘SHISH BOSHLASH
   ----------------------- */
  async startAddDebtSearch(ctx: Context, session: SessionData): Promise<void> {
    session.state = 'search_debtor_for_debt';
    await ctx.reply(
      '🔎 Qarzdorning ismi yoki telefon raqamini kiriting:',
      Markup.keyboard([['❌ Bekor qilish']]).resize(), // menyu o‘rniga faqat Bekor qilish
    );
  }
  async handleSearchDebtorForDebt(ctx: Context, session: SessionData) {
    const text = (ctx.message as any)?.text?.trim() ?? '';

    if (!text) return;

    const shopOwner = await this.prisma.user.findFirst({
      where: { phone: session.phone },
    });
    if (!shopOwner?.shopId) {
      await ctx.reply('❌ Sizning shopingiz topilmadi.');
      session.state = 'shop_owner_menu';
      return;
    }

    // 🔎 Qidirish: ism yoki telefon raqam bo‘yicha
    const debtors = await this.prisma.debtor.findMany({
      where: {
        shopId: shopOwner.shopId,
        OR: [
          { name: { contains: text, mode: 'insensitive' } },
          { phone: { contains: text } },
        ],
      },
    });

    if (debtors.length === 0) {
      await ctx.reply('❌ Qarzdor topilmadi. Avval qarzdor qo‘shing.');
      session.state = 'shop_owner_menu';
      return;
    }

    // Agar bitta qarzdor topilsa → to‘g‘ridan-to‘g‘ri qarz qo‘shishga o‘tkazamiz
    if (debtors.length === 1) {
      const d = debtors[0];
      session.tempDebtorId = d.id;
      session.state = 'adding_debt_amount';

      await ctx.reply(
        `👤 Qarzdor topildi:\n\nIsm: ${d.name}\n📞 ${d.phone ?? 'yo‘q'}\n🏠 ${d.address ?? 'yo‘q'}\n\n💰 Endi qarz summasini kiriting:`,
        {
          reply_markup: {
            keyboard: [['❌ Bekor qilish']],
            resize_keyboard: true,
          },
        },
      );
      return;
    }

    // Agar ko‘p bo‘lsa → foydalanuvchiga tanlash uchun knopkalar chiqaramiz
    const buttons = debtors.map((d) => [
      {
        text: `${d.name} (${d.phone ?? '☎️ yo‘q'})`,
        callback_data: `select_debtor_${d.id}`,
      },
    ]);

    await ctx.reply(
      `👥 ${debtors.length} ta qarzdor topildi. Birini tanlang:`,
      {
        reply_markup: {
          inline_keyboard: buttons,
        },
      },
    );
  }

  async showFoundDebtor(ctx: Context, debtor: any): Promise<void> {
    await ctx.reply(
      `👤 Qarzdor topildi:\n\nIsm: *${debtor.name}*\n📞 ${debtor.phone ?? '-'}\n🏠 ${debtor.address ?? '-'}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '📋 Qarzlarini ko‘rish',
                callback_data: `showDebts:${debtor.id}`,
              },
            ],
            [
              {
                text: '➕ Yangi qarz qo‘shish',
                callback_data: `addDebt:${debtor.id}`,
              },
            ],
            [
              {
                text: '✏️ Qarzdorni tahrirlash',
                callback_data: `editDebtor:${debtor.id}`,
              },
            ],
            [
              {
                text: '🗑 Qarzdorni o‘chirish',
                callback_data: `deleteDebtor:${debtor.id}`,
              },
            ],
          ],
        },
      },
    );
  }

  async startAddDebtAmount(
    ctx: Context,
    session: SessionData,
    debtorId: string,
  ): Promise<void> {
    session.tempDebtorId = debtorId;
    session.state = 'adding_debt_amount';
    await ctx.reply(
      '💰 Qarz summasini kiriting:',
      Markup.keyboard([['❌ Bekor qilish']]).resize(),
    );
  }

  async handleAddDebtAmountAndNote(
    ctx: Context,
    session: SessionData,
  ): Promise<void> {
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = ctx.message.text.trim();

    if (text === '❌ Bekor qilish') {
      session.state = 'shop_owner_menu';
      return this.showMenu(ctx, session);
    }

    if (session.state === 'adding_debt_amount') {
      const amount = parseInt(text, 10);
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply('❌ To‘g‘ri summa kiriting.');
        return;
      }
      session.tempDebtAmount = amount;
      session.state = 'adding_debt_note';
      await ctx.reply('📌 Nima olganini yozing (izoh), yoki "-" ni yozing:');
      return;
    }

    if (session.state === 'adding_debt_note') {
      const note = text === '-' ? '' : text;

      await this.prisma.debt.create({
        data: {
          amount: session.tempDebtAmount ?? 0,
          note,
          debtorId: session.tempDebtorId ?? '',
        },
      });

      await ctx.reply(
        `✅ Qarzdorga ${session.tempDebtAmount} so‘m qo‘shildi.\n📌 ${note || '(izoh yo‘q)'}`,
      );

      session.state = 'shop_owner_menu';
      return this.showDebtorDebts(ctx, session, session.tempDebtorId ?? '');
    }
  }

  /* -----------------------
   SHOW DEBTOR DEBTS
   ----------------------- */
  async showDebtorDebts(
    ctx: Context,
    session: SessionData,
    debtorId: string,
  ): Promise<void> {
    const debtor = await this.prisma.debtor.findUnique({
      where: { id: debtorId },
      include: { debts: { orderBy: { createdAt: 'desc' } } },
    });
    if (!debtor) {
      await ctx.reply('❌ Qarzdor topilmadi.');
      return;
    }

    let text = `📋 ${debtor.name} qarzlari:\n\n`;
    if (debtor.debts.length === 0) {
      text += '❌ Hozircha qarzlari yo‘q.';
    } else {
      debtor.debts.forEach((d, i) => {
        text += `${i + 1}. ${d.note || 'Izohsiz'} - ${d.amount} so‘m\n🕒 ${d.createdAt.toLocaleString()}\n\n`;
      });
    }

    await ctx.reply(text, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '➕ Yangi qarz qo‘shish',
              callback_data: `addDebt:${debtor.id}`,
            },
          ],
          [{ text: '↩️ Orqaga', callback_data: 'backToDebtors' }],
        ],
      },
    });
  }

  async deleteDebtor(ctx: Context, debtorId: string): Promise<void> {
    await this.prisma.debtor.delete({ where: { id: debtorId } });
    await ctx.reply('✅ Qarzdor o‘chirildi.');
  }

  /* -----------------------
   INLINE CALLBACK HANDLER
   ----------------------- */
  async handleCallback(ctx: Context, session: SessionData): Promise<void> {
    if (!('data' in ctx.callbackQuery!)) return;
    const data = ctx.callbackQuery?.data;

    if (!data) return;

    // ➕ Qarz qo‘shish
    if (data.startsWith('addDebt:')) {
      const debtorId = data.split(':')[1];
      await this.startAddDebtAmount(ctx, session, debtorId);
      return;
    }

    // 📋 Qarzdor qarzlarini ko‘rish
    if (data.startsWith('showDebts:')) {
      const debtorId = data.split(':')[1];
      await this.showDebtorDebts(ctx, session, debtorId);
      return;
    }

    // ✏️ Qarzdorni tahrirlash (hozircha placeholder)
    if (data.startsWith('editDebtor:')) {
      await ctx.reply('✏️ Tahrirlash funksiyasi hali tayyor emas.');
      return;
    }

    // 🗑 Qarzdorni o‘chirish
    if (data.startsWith('deleteDebtor:')) {
      const debtorId = data.split(':')[1];
      await this.deleteDebtor(ctx, debtorId);
      return;
    }

    // ↩️ Orqaga
    if (data === 'backToDebtors') {
      await this.showDebtors(ctx, session);
      return;
    }
  }
}
