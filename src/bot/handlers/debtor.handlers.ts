// src/bot/handlers/debtor.handlers.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma.service';
import { Context, Markup } from 'telegraf';
import { SessionData } from '../states/session.data';

@Injectable()
export class DebtorHandler {
  constructor(private readonly prisma: PrismaService) {}
  // 📋 Asosiy menyu
  async showMenu(ctx: Context, session: SessionData) {
    session.state = 'debtor_menu';
    await ctx.reply(
      '📋 Asosiy menyu:\nQuyidagilardan birini tanlang 👇',
      Markup.keyboard([
        ['📜 Mening qarzlarim', '💸 To‘lov tarixi'],
        ['💰 To‘lash', '📞 Aloqa'],
        ['👤 Profil'],
      ]).resize(),
    );
  }

  // 🔹 Foydalanuvchi tanlovini boshqarish
  async handleText(ctx: Context, session: SessionData): Promise<void> {
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = ctx.message.text;

    switch (text) {
      case '📜 Mening qarzlarim':
        await this.showDebts(ctx, session);
        break;
      case '💸 To‘lov tarixi':
        await this.showPayments(ctx, session);
        break;
      case '💰 To‘lash':
        await this.showDebtsForPayment(ctx, session);
        break;
      // SHU YERDAN QOLGANLARINI QO'SHING---------------------------------------------------------------------------------------------------------
      case '📞 Aloqa':
        await ctx.reply('📞 Aloqa uchun: +998 99 123 45 67');
        break;
      case '👤 Profil':
        await this.showProfile(ctx, session);
        break;
      default:
        await ctx.reply('⚠️ Menyudan birini tanlang.');
    }
  }

  // 💰 Qarzdorliklar
  private async showDebts(ctx: Context, session: SessionData) {
    const debts = await this.prisma.debt.findMany({
      where: { debtor: { phone: session.phone } },
      orderBy: { createdAt: 'desc' },
    });

    if (!debts.length) {
      return ctx.reply('✅ Sizda hozircha qarz yo‘q!');
    }

    const list = debts
      .map(
        (d, i) =>
          `${i + 1}. 💰 ${d.amount} so‘m — ${d.status === 'PAID' ? '✅ To‘langan' : '❌ To‘lanmagan'}\n📝 Izoh: ${
            d.note ?? 'Yo‘q'
          }`,
      )
      .join('\n\n');

    await ctx.reply(`📜 Sizning qarzlaringiz:\n\n${list}`);
  }

  // 💸 To‘lov tarixi
  private async showPayments(ctx: Context, session: SessionData) {
    const payments = await this.prisma.payment.findMany({
      where: { debt: { debtor: { phone: session.phone } } },
      orderBy: { createdAt: 'desc' },
    });

    if (!payments.length) {
      return ctx.reply('💸 Siz hali hech qanday to‘lov qilmagansiz.');
    }

    const list = payments
      .map(
        (p, i) =>
          `${i + 1}. 💰 ${p.amount} so‘m — 📅 ${p.createdAt.toLocaleDateString()}`,
      )
      .join('\n');

    await ctx.reply(`💸 Sizning to‘lovlaringiz:\n\n${list}`);
  }

  // 👤 Profil
  private async showProfile(ctx: Context, session: SessionData) {
    const debtor = await this.prisma.debtor.findFirst({
      where: { phone: session.phone },
    });

    if (!debtor) return ctx.reply('❌ Profil topilmadi.');

    await ctx.reply(
      `👤 Profil ma'lumotlari:\n\n` +
        `Ism: ${debtor.name}\n` +
        `📞 Telefon: ${debtor.phone}\n` +
        `🏠 Manzil: ${debtor.address ?? 'Ko‘rsatilmagan'}\n` +
        `🔒 Parol: ${debtor.password ? '••••••' : 'Belgilanmagan'}\n` +
        `🕒 Ro‘yxatdan o‘tgan sana: ${debtor.createdAt.toLocaleDateString()}`,
    );
  }

  private async showDebtsForPayment(ctx: Context, session: SessionData) {
    const debtor = await this.prisma.debtor.findFirst({
      where: { phone: session.phone },
    });

    if (!debtor) return ctx.reply('❌ Qarzdor topilmadi.');

    const debts = await this.prisma.debt.findMany({
      where: { debtorId: debtor.id, status: 'UNPAID' },
      orderBy: { createdAt: 'desc' },
    });

    if (!debts.length) {
      return ctx.reply('✅ Sizda to‘lanishi kerak bo‘lgan qarz yo‘q!');
    }

    const buttons = debts.map((d) => [
      {
        text: `💰 ${d.amount} so'm — ${d.note ?? 'Izoh yo‘q'}`,
        callback_data: `payDebt:${d.id}`,
      },
    ]);

    await ctx.reply('📋 Qarzlaringizni tanlang:', {
      reply_markup: { inline_keyboard: buttons },
    });
  }

  // 🔹 Callback - qarzni tanlaganda
  async handleCallbackQuery(ctx: any, session: SessionData) {
    const data = ctx.callbackQuery.data;

    if (data.startsWith('payDebt:')) {
      const debtId = data.split(':')[1];
      session.tempDebtId = debtId;
      session.state = 'debtor_enter_payment';

      const debt = await this.prisma.debt.findUnique({ where: { id: debtId } });

      await ctx.answerCbQuery(
        `💳 ${debt?.amount} so'm qarzni to‘lash uchun summa kiriting`,
      );
      await ctx.reply(
        `💳 Tanlangan qarz: ${debt?.amount} so'm\n📝 Izoh: ${debt?.note ?? 'Yo‘q'}\n\nTo‘lanadigan summani kiriting:`,
      );
    }
  }

  // 🔹 Kiritilgan summani qabul qilish
  async handlePaymentAmount(ctx: Context, session: SessionData): Promise<void> {
    if (session.state !== 'debtor_enter_payment') return;
    if (!ctx.message || !('text' in ctx.message)) return;

    const amount = parseFloat(ctx.message.text);
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('❌ Iltimos, to‘g‘ri summani kiriting.');
      return;
    }

    if (!session.tempDebtId) return;

    const debt = await this.prisma.debt.findUnique({
      where: { id: session.tempDebtId },
    });

    if (!debt) {
      await ctx.reply('❌ Qarz topilmadi.');
      return;
    }

    // ✅ Endi TypeScriptga debt null emasligini bildirayapmiz
    await this.prisma.payment.create({
      data: {
        debtId: debt.id,
        amount,
        approved: false,
      },
    });

    if (amount >= debt.amount) {
      await this.prisma.debt.update({
        where: { id: debt.id },
        data: { status: 'PAID' },
      });
    }

    await ctx.reply(
      `⚠️ Siz ${amount} so'm to‘landingiz. Qarzni SHOP_OWNER tasdiqlagandan keyin yopiladi.`,
    );

    session.tempDebtId = undefined;
    session.state = 'debtor_menu';
    await this.showMenu(ctx, session);
  }
}
