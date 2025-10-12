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
      case 'shop_owner_menu':
        if (text === '➕ Qarzdor qo‘shish')
          return this.startAddDebtor(ctx, session);
        if (text === '➕ Qarz qo‘shish')
          return this.startAddDebtSearch(ctx, session);
        if (text === '👤 Profil') return this.showProfile(ctx, session);
        if (text === '📋 Qarzdorlar') return this.showDebtors(ctx, session);
        if (text === '➕ Add Helper') return this.startAddHelper(ctx, session);
        break;

      case 'shop_owner_profile':
        if (text === '⬅️ Orqaga qaytish') return this.showMenu(ctx, session);
        break;

      case 'adding_debtor_name':
      case 'adding_debtor_phone':
      case 'adding_debtor_address':
        return this.handleAddDebtor(ctx, session);

      case 'adding_debt_amount':
      case 'adding_debt_note':
        return this.handleAddDebtAmountAndNote(ctx, session);

      case 'adding_helper_name':
      case 'adding_helper_phone':
      case 'adding_helper_password':
        return this.handleAddHelper(ctx, session);

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
      const totalDebt = d.debts.reduce((sum, debt) => sum + debt.amount, 0);
      const createdAt = d.createdAt
        ? new Date(d.createdAt).toLocaleDateString('uz-UZ', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : '❌ Sana yo‘q';

      list += `${i + 1}. 🧾 ${d.name}\n   ☎️ ${d.phone ?? 'yo‘q'}\n   💰 Umumiy qarz: ${totalDebt.toLocaleString()} so‘m\n   📅 Qo‘shilgan: ${createdAt}\n\n`;
    });

    await ctx.reply(list);
  }

  /* -----------------------
     QARZ QO‘SHISH (inline tugmalar bilan)
  ----------------------- */
  async startAddDebtSearch(ctx: Context, session: SessionData): Promise<void> {
    session.state = 'search_debtor_for_debt';
    await ctx.reply(
      '🔎 Qarzdorning ismi yoki telefon raqamini kiriting:',
      Markup.keyboard([['❌ Bekor qilish']]).resize(),
    );
  }

  async handleCallbackQuery(ctx: Context, session: SessionData) {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;

    const data = callbackQuery.data;
    if (!data) return;

    if (data.startsWith('addDebt:')) {
      const debtorId = data.split(':')[1];
      session.tempDebtorId = debtorId;
      session.state = 'adding_debt_amount';

      await ctx.answerCbQuery('Qarz summasini kiriting'); // Bu tugma bosilganini foydalanuvchiga bildiradi
      await ctx.reply('💰 Qarz summasini kiriting:'); // EditMessageText o‘rniga oddiy reply ishlatish
    }
  }

  async handleSearchAndSelectDebtor(ctx: Context, session: SessionData) {
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = ctx.message.text.trim();

    if (text === '❌ Bekor qilish') {
      session.state = 'shop_owner_menu';
      await this.showMenu(ctx, session);
      return;
    }

    const shopOwner = await this.prisma.user.findFirst({
      where: { phone: session.phone },
    });
    if (!shopOwner?.shopId) {
      await ctx.reply('❌ Sizning shopingiz topilmadi.');
      session.state = 'shop_owner_menu';
      await this.showMenu(ctx, session);
      return;
    }

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
      await this.showMenu(ctx, session);
      return;
    }

    // Inline tugmalar bilan
    const inlineButtons = debtors.map((d) => [
      {
        text: `${d.name} (${d.phone ?? 'yo‘q'})`,
        callback_data: `addDebt:${d.id}`,
      },
    ]);
    await ctx.reply('👥 Qarzdor topildi, tanlang:', {
      reply_markup: { inline_keyboard: inlineButtons },
    });

    session.state = 'awaiting_debtor_selection';
  }

  async handleAddDebtAmountAndNote(
    ctx: Context,
    session: SessionData,
  ): Promise<void> {
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = ctx.message.text.trim();

    if (text === '❌ Bekor qilish') {
      session.state = 'shop_owner_menu';
      await this.showMenu(ctx, session);
      return;
    }

    if (session.state === 'adding_debt_amount') {
      const amount = parseInt(text, 10);
      if (isNaN(amount) || amount <= 1000) {
        await ctx.reply('1000 somdan kamm summa kiritib bo‘lmaydi.');
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
      await this.showMenu(ctx, session);
    }
  }
}
