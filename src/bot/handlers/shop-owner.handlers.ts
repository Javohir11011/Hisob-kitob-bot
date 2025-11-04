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
        ['👤 Profil'],
        // '➕ Add Helper',
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
      /* 🔸 Asosiy menyu */
      case 'shop_owner_menu':
        if (text === '➕ Qarzdor qo‘shish')
          return this.startAddDebtor(ctx, session);

        if (text === '➕ Qarz qo‘shish')
          return this.startAddDebtSearch(ctx, session);

        if (text === '👤 Profil') return this.showProfile(ctx, session);

        if (text === '📋 Qarzdorlar') return this.showDebtors(ctx, session);

        if (text === '💰 Qarz yopish')
          // await this.showPayDebtorMenu(ctx, session); // ✅ Yangi funksiya qo‘shamiz

          break;

      /* 🔸 Profil menyu */
      case 'shop_owner_profile':
        if (text === '⬅️ Orqaga qaytish') return this.showMenu(ctx, session);
        break;

      /* 🔸 Qarzdor qo‘shish */
      case 'adding_debtor_name':
      case 'adding_debtor_phone':
      case 'adding_debtor_password':
      case 'adding_debtor_address':
        return this.handleAddDebtor(ctx, session);

      /* 🔸 Qarz qo‘shish */
      case 'adding_debt_amount':
      case 'adding_debt_note':
        return this.handleAddDebtAmountAndNote(ctx, session);

      /* 🔸 Helper qo‘shish */
      case 'adding_helper_name':
      case 'adding_helper_phone':
      case 'adding_helper_password':
        return this.handleAddHelper(ctx, session);

      /* 🔸 Qarzdorlar menyusi (Qidirish / Orqaga) */
      case 'debtor_menu':
        if (text === '🔍 Qidirish') {
          return this.startSearchDebtor(ctx, session);
        }
        if (text === '↩️ Orqaga') {
          session.state = 'shop_owner_menu';
          return this.showMenu(ctx, session);
        }
        break;

      /* 🔸 Qidiruv holati */
      case 'searching_debtor':
        if (text === '↩️ Orqaga') {
          session.state = 'debtor_menu';
          return this.showDebtors(ctx, session);
        }
        return this.handleSearchDebtor(ctx, session);

      /* 🔸 Qarzdorni tahrirlash */
      case 'editing_debtor_name':
      case 'editing_debtor_phone':
        return this.handleEditDebtor(ctx, session);

      /* 🔸 Qarzni yopish (miqdor kiritilgandan keyin) */
      case 'paying_debt':
        const debtorId = session.tempDebtorId;
        if (!debtorId) {
          await ctx.reply('❌ Qarzdor aniqlanmadi.');
          session.state = 'debtor_menu';
          return;
        }

        let amount = parseInt(text.replace(/\s+/g, ''), 10);
        if (isNaN(amount) || amount <= 0) {
          await ctx.reply('❌ Iltimos, to‘lash uchun to‘g‘ri summa kiriting.');
          return;
        }

        const debtor = await this.prisma.debtor.findUnique({
          where: { id: debtorId },
          include: { debts: true },
        });

        if (!debtor) {
          await ctx.reply('❌ Qarzdor topilmadi.');
          session.state = 'debtor_menu';
          return;
        }

        const totalDebt = debtor.debts.reduce((sum, d) => sum + d.amount, 0);
        if (amount > totalDebt) amount = totalDebt;

        let remaining = amount;
        for (const debt of debtor.debts) {
          if (remaining <= 0) break;
          const pay = Math.min(debt.amount, remaining);
          await this.prisma.debt.update({
            where: { id: debt.id },
            data: { amount: debt.amount - pay },
          });
          remaining -= pay;
        }

        await ctx.reply(
          `✅ ${debtor.name} qarzidan ${amount.toLocaleString()} so‘m yopildi.`,
        );
        session.state = 'debtor_menu';
        await this.showDebtors(ctx, session);
        return;

      default:
        session.state = 'shop_owner_menu';
        return this.showMenu(ctx, session);
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
      '🧾 Yangi qarzdor ismini kiriting:',
      Markup.keyboard([['❌ Bekor qilish']]).resize(),
    );
  }

  async handleAddDebtor(ctx: Context, session: SessionData) {
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = ctx.message.text.trim();

    if (text === '❌ Bekor qilish') {
      session.state = 'shop_owner_menu';
      session.newDebtorName = undefined;
      session.newDebtorPhone = undefined;
      session.newDebtorAddress = undefined;
      session.newDebtorPassword = undefined;
      await ctx.reply('❌ Qarzdor qo‘shish bekor qilindi.');
      return;
    }

    switch (session.state) {
      case 'adding_debtor_name':
        session.newDebtorName = text;
        session.state = 'adding_debtor_phone';
        console.log('📝 State changed to adding_debtor_phone');
        await ctx.reply(
          '📞 Qarzdor telefon raqamini kiriting (+998XXXXXXXXX yoki +7XXXXXXXXXX):',
        );
        break;

      case 'adding_debtor_phone':
        session.newDebtorPhone = text;
        session.state = 'adding_debtor_address';
        console.log('📝 State changed to adding_debtor_address');
        await ctx.reply('🏠 Qarzdor manzilini kiriting:');
        break;

      case 'adding_debtor_address':
        session.newDebtorAddress = text;
        session.state = 'adding_debtor_password';
        console.log('📝 State changed to adding_debtor_password');
        await ctx.reply('🔑 Qarzdor uchun parol kiriting (kamida 4 belgidan):');
        break;

      case 'adding_debtor_password':
        session.newDebtorPassword = text;

        console.log('➡️ Collected info:', {
          name: session.newDebtorName,
          phone: session.newDebtorPhone,
          address: session.newDebtorAddress,
          password: session.newDebtorPassword,
        });

        // Shop ownerni topamiz
        const user = await this.prisma.user.findFirst({
          where: { phone: session.phone },
        });

        if (!user?.shopId) {
          await ctx.reply(
            '❌ Do‘kon topilmadi! Iltimos, telefon raqamingizni tekshiring.',
          );
          session.state = 'shop_owner_menu';
          return;
        }

        // Debtor yaratish
        await this.prisma.debtor.create({
          data: {
            name: session.newDebtorName!,
            phone: session.newDebtorPhone!,
            address: session.newDebtorAddress,
            password: session.newDebtorPassword!,
            shop: { connect: { id: user.shopId } },
          },
        });

        console.log('✅ Debtor created:', session.newDebtorName);

        // Sessionni tozalaymiz
        session.state = 'shop_owner_menu';
        session.newDebtorName = undefined;
        session.newDebtorPhone = undefined;
        session.newDebtorAddress = undefined;
        session.newDebtorPassword = undefined;

        await ctx.reply(
          '✅ Qarzdor muvaffaqiyatli qo‘shildi!',
          Markup.keyboard([
            ['➕ Qarzdor qo‘shish'],
            ['📋 Qarzdorlar ro‘yxati'],
            ['🔙 Orqaga'],
          ]).resize(),
        );
        break;

      default:
        console.log('❌ Unknown state:', session.state);
        await ctx.reply('❌ Iltimos, menyudan tanlang.');
        break;
    }
  }

  /* -----------------------
   QARZDOR CRUD + SEARCH
----------------------- */
  async showDebtors(ctx: Context, session: SessionData): Promise<void> {
    try {
      const shopOwner = await this.prisma.user.findFirst({
        where: { phone: session.phone },
      });

      if (!shopOwner?.shopId) {
        await ctx.reply('❌ Sizning shopingiz topilmadi.');
        return;
      }

      const debtors = await this.prisma.debtor.findMany({
        where: { shopId: shopOwner.shopId },
        include: { debts: true },
      });

      // 🔹 STATE avval yoziladi — bu juda muhim
      session.state = 'debtor_menu';

      if (debtors.length === 0) {
        await ctx.reply(
          '📭 Hozircha qarzdorlar yo‘q.',
          Markup.keyboard([['↩️ Orqaga']]).resize(),
        );
        return;
      }

      let list = '📋 <b>Qarzdorlar ro‘yxati:</b>\n\n';
      debtors.forEach((d, i) => {
        const totalDebt = d.debts.reduce((sum, debt) => sum + debt.amount, 0);
        const createdAt = new Date(d.createdAt).toLocaleDateString('uz-UZ', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        list += `<b>${i + 1}. ${d.name}</b>\n📞 ${d.phone}\n💰 ${totalDebt.toLocaleString()} so‘m\n📅 ${createdAt}\n\n`;
      });

      await ctx.replyWithHTML(
        list,
        Markup.keyboard([['🔍 Qidirish'], ['↩️ Orqaga']]).resize(),
      );
    } catch (error) {
      console.error('❌ showDebtors error:', error);
      await ctx.reply('⚠️ Qarzdorlarni yuklashda xatolik yuz berdi.');
    }
  }

  /* 🔍 Qidirishni boshlash */
  async startSearchDebtor(ctx: Context, session: SessionData): Promise<void> {
    session.state = 'searching_debtor';

    await ctx.reply(
      '🔍 Qidirilayotgan qarzdor ismi yoki telefon raqamini kiriting:',
      Markup.keyboard([['↩️ Orqaga']]).resize(),
    );
  }

  /* 🔍 Qidiruvni bajarish */
  async handleSearchDebtor(ctx: Context, session: SessionData): Promise<void> {
    if (!ctx.message || !('text' in ctx.message)) return;
    const query = ctx.message.text.trim();
    if (!query) return;

    const shopOwner = await this.prisma.user.findFirst({
      where: { phone: session.phone },
    });

    if (!shopOwner?.shopId) {
      await ctx.reply('❌ Sizning shopingiz topilmadi.');
      return;
    }

    const results = await this.prisma.debtor.findMany({
      where: {
        shopId: shopOwner.shopId,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
        ],
      },
      include: { debts: true },
    });

    if (results.length === 0) {
      await ctx.reply('❌ Hech narsa topilmadi.');
      return;
    }

    for (const d of results) {
      const totalDebt = d.debts.reduce((sum, debt) => sum + debt.amount, 0);

      await ctx.replyWithHTML(
        `👤 <b>${d.name}</b>\n📞 ${d.phone}\n💰 <b>${totalDebt.toLocaleString()}</b> so‘m`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('💰 All debts', `all_debts_${d.id}`),
            Markup.button.callback('✏️ Update', `update_debtor_${d.id}`),
            Markup.button.callback('🗑 Delete', `delete_debtor_${d.id}`),
          ],
        ]),
      );
    }

    session.state = 'debtor_menu';
  }

  /* 🧾 Qarzdorni tanlash */
  async selectedDebtorAction(ctx: Context, debtorId: string): Promise<void> {
    const debtor = await this.prisma.debtor.findUnique({
      where: { id: debtorId },
    });
    if (!debtor) {
      await ctx.reply('❌ Qarzdor topilmadi.');
      return;
    }

    await ctx.replyWithHTML(
      `🧾 <b>${debtor.name}</b>\n☎️ ${debtor.phone}\n🏠 ${
        debtor.address ?? 'Manzil yo‘q'
      }`,
      Markup.inlineKeyboard([
        // [Markup.button.callback('✏️ Tahrirlash', `editdeb_${debtor.id}`)],
        [Markup.button.callback('🗑 O‘chirish', `deldeb_${debtor.id}`)],
        [Markup.button.callback('↩️ Orqaga', 'back_to_debtors')],
      ]),
    );
  }

  /* ✏️ Tahrirlashni boshlash */
  async startEditDebtor(
    ctx: Context,
    debtorId: string,
    session: SessionData,
  ): Promise<void> {
    const debtor = await this.prisma.debtor.findUnique({
      where: { id: debtorId },
      include: { debts: true },
    });

    if (!debtor) {
      await ctx.reply('❌ Qarzdor topilmadi.');
      return;
    }

    session.tempDebtorId = debtorId;
    session.state = 'editing_debtor';

    await ctx.reply(
      `✏️ Tahrirlash uchun birini tanlang:\n\n👤 Ism: ${debtor.name}\n📞 Telefon: ${debtor.phone}\n💰 Jami qarz: ${debtor.debts
        .reduce((sum, d) => sum + d.amount, 0)
        .toLocaleString()} so‘m`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '📝 Ismni o‘zgartirish',
            `edit_name_${debtorId}`,
          ),
          Markup.button.callback(
            '📞 Raqamni o‘zgartirish',
            `edit_phone_${debtorId}`,
          ),
        ],
        [Markup.button.callback('💰 Qarz qo‘shish', `addDebt:${debtorId}`)],
        // [Markup.button.callback('↩️ Orqaga', 'back_to_search')],
      ]),
    );
  }

  async handleEditDebtor(ctx: Context, session: SessionData): Promise<void> {
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = ctx.message.text.trim();

    const debtorId = session.tempDebtorId;
    if (!debtorId) {
      await ctx.reply('❌ Qarzdor aniqlanmadi.');
      return;
    }

    const updateData: any = {};
    if (session.state === 'editing_debtor_name') {
      updateData.name = text;
    } else if (session.state === 'editing_debtor_phone') {
      updateData.phone = text;
    }

    await this.prisma.debtor.update({
      where: { id: debtorId },
      data: updateData,
    });

    await ctx.reply('✅ Ma’lumot yangilandi.');
    session.state = 'debtor_menu';
    await this.showDebtors(ctx, session);
  }

  async showAllDebts(ctx: Context, debtorId: string) {
    const debtor = await this.prisma.debtor.findUnique({
      where: { id: debtorId },
      include: { debts: true },
    });

    if (!debtor) {
      await ctx.reply('❌ Qarzdor topilmadi.');
      return;
    }

    if (debtor.debts.length === 0) {
      await ctx.reply(`💰 ${debtor.name} da hech qanday qarz yozuvi yo‘q.`);
      return;
    }

    let message = `📋 <b>${debtor.name}</b> — barcha qarzlar:\n\n`;
    for (const debt of debtor.debts) {
      message += `📅 ${debt.createdAt.toLocaleDateString('uz-UZ')}\n💰 ${debt.amount.toLocaleString()} so‘m\n📝 ${debt.note ?? '—'}\n\n`;
    }

    await ctx.replyWithHTML(
      message,
      Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Orqaga', `update_debtor_${debtor.id}`)],
      ]),
    );
  }

  async deleteDebtor(ctx: Context, debtorId: string) {
    try {
      await this.prisma.debt.deleteMany({ where: { debtorId } });
      await this.prisma.debtor.delete({ where: { id: debtorId } });

      await ctx.reply(
        '🗑 Qarzdor va uning barcha qarz yozuvlari o‘chirildi.✅',
      );
    } catch (err) {
      console.error('❌ deleteDebtor error:', err);
      await ctx.reply('⚠️ Qarzdorni o‘chirishda xatolik yuz berdi.');
    }
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

  // async handleCallbackQuery(ctx: any, session: SessionData) {
  //   const callbackQuery = ctx.callbackQuery;
  //   if (!callbackQuery || !('data' in callbackQuery)) return;
  //   const data = callbackQuery.data;

  //   if (!data) return;

  //   // 🔹 Qarzdorga qarz qo‘shish
  //   if (data.startsWith('addDebt:')) {
  //     const debtorId = data.split(':')[1];
  //     session.tempDebtorId = debtorId;
  //     session.state = 'adding_debt_amount';
  //     await ctx.answerCbQuery('💰 Qarz summasini kiriting');
  //     await ctx.reply('💰 Qarz summasini kiriting:');
  //     return;
  //   }

  //   // 🔹 Qarzdorni qarzini YOPISH
  //   if (data.startsWith('payDebt:')) {
  //     const debtorId = data.split(':')[1];
  //     session.tempDebtorId = debtorId;

  //     const debtor = await this.prisma.debtor.findUnique({
  //       where: { id: debtorId },
  //       include: { debts: true },
  //     });

  //     if (!debtor) {
  //       await ctx.reply('❌ Qarzdor topilmadi.');
  //       return;
  //     }

  //     if (debtor.debts.length === 0) {
  //       await ctx.reply('💰 Bu qarzdorning qarzi yo‘q.');
  //       return;
  //     }

  //     // Har bir qarz yozuvi tugmalar bilan
  //     const inlineButtons = debtor.debts.map((d) => [
  //       {
  //         text: `${d.amount.toLocaleString()} so‘m (${d.createdAt.toLocaleDateString('uz-UZ')})`,
  //         callback_data: `paySingleDebt:${d.id}`,
  //       },
  //     ]);

  //     session.state = 'awaiting_single_debt_payment';

  //     await ctx.reply(`💰 ${debtor.name} qarzlarini tanlang:`, {
  //       reply_markup: { inline_keyboard: inlineButtons },
  //     });
  //     await ctx.answerCbQuery();
  //   }

  //   // 🔹 Barcha qarzlarni ko‘rsatish
  //   if (data.startsWith('all_debts_')) {
  //     const debtorId = data.split('_')[2];
  //     await this.showAllDebts(ctx, debtorId);
  //     await ctx.answerCbQuery();
  //     return;
  //   }

  //   // 🔹 Ismni tahrirlash
  //   if (data.startsWith('edit_name_')) {
  //     const debtorId = data.split('_')[2];
  //     const debtor = await this.prisma.debtor.findUnique({
  //       where: { id: debtorId },
  //     });
  //     if (!debtor) {
  //       await ctx.reply('❌ Qarzdor topilmadi.');
  //       return;
  //     }
  //     session.tempDebtorId = debtorId;
  //     session.state = 'editing_debtor_name';
  //     await ctx.answerCbQuery();
  //     await ctx.reply(`📝 Yangi ismni kiriting (hozirgi: ${debtor.name}):`);
  //     return;
  //   }

  //   // 🔹 Telefon raqamini tahrirlash
  //   if (data.startsWith('edit_phone_')) {
  //     const debtorId = data.split('_')[2];
  //     const debtor = await this.prisma.debtor.findUnique({
  //       where: { id: debtorId },
  //     });
  //     if (!debtor) {
  //       await ctx.reply('❌ Qarzdor topilmadi.');
  //       return;
  //     }
  //     session.tempDebtorId = debtorId;
  //     session.state = 'editing_debtor_phone';
  //     await ctx.answerCbQuery();
  //     await ctx.reply(
  //       `📞 Yangi telefon raqamni kiriting (hozirgi: ${debtor.phone}):`,
  //     );
  //     return;
  //   }

  //   // 🔹 Qarzdorni o‘chirish
  //   if (data.startsWith('delete_debtor_')) {
  //     const debtorId = data.split('_')[2];
  //     await this.deleteDebtor(ctx, debtorId);
  //     await ctx.answerCbQuery();
  //     return;
  //   }

  //   // 🔹 Orqaga qaytish
  //   if (data === 'back_to_search') {
  //     session.state = 'debtor_menu';
  //     await this.showDebtors(ctx, session);
  //     await ctx.answerCbQuery();
  //     return;
  //   }
  //   // 🔹 Qarz yopish
  //   if (data.startsWith('payDebt:')) {
  //     const debtorId = data.split(':')[1];
  //     session.tempDebtorId = debtorId;

  //     // Debtorni topish
  //     const debtor = await this.prisma.debtor.findUnique({
  //       where: { id: debtorId },
  //       include: { debts: true },
  //     });

  //     if (!debtor) {
  //       await ctx.reply('❌ Qarzdor topilmadi.');
  //       return;
  //     }

  //     const totalDebt = debtor.debts.reduce((sum, d) => sum + d.amount, 0);
  //     if (totalDebt === 0) {
  //       await ctx.reply('💰 Bu qarzdorning qarzi yo‘q.');
  //       return;
  //     }

  //     session.state = 'paying_debt';
  //     await ctx.answerCbQuery();
  //     await ctx.reply(
  //       `💰 ${debtor.name} jami qarzi: ${totalDebt.toLocaleString()} so‘m\n` +
  //         '📌 Qancha to‘laysiz? (summani son bilan kiriting):',
  //     );
  //     return;
  //   }
  // }

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

  /* -----------------------
     QARZ YOPISH (bosqichma-bosqich)
  ----------------------- */
  async handleCallbackQuery(ctx: any, session: SessionData) {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;
    const data = callbackQuery.data;
    if (!data) return;

    /* ---------------------
     QARZLAR BO‘YICHA CALLBACKLAR
  --------------------- */

    // 🔹 Qarzdorga qarz qo‘shish
    if (data.startsWith('addDebt:')) {
      const debtorId = data.split(':')[1];
      session.tempDebtorId = debtorId;
      session.state = 'adding_debt_amount';
      await ctx.answerCbQuery('💰 Qarz summasini kiriting');
      await ctx.reply('💰 Qarz summasini kiriting:');
      return;
    }

    // 🔹 Qarzdorni o‘chirish
    if (data.startsWith('delete_debtor_')) {
      const debtorId = data.split('_')[2];
      await this.deleteDebtor(ctx, debtorId);
      await ctx.answerCbQuery();
      return;
    }

    // 🔹 Ismni tahrirlash
    if (data.startsWith('edit_name_')) {
      const debtorId = data.split('_')[2];
      const debtor = await this.prisma.debtor.findUnique({
        where: { id: debtorId },
      });
      if (!debtor) return ctx.reply('❌ Qarzdor topilmadi.');
      session.tempDebtorId = debtorId;
      session.state = 'editing_debtor_name';
      await ctx.answerCbQuery();
      await ctx.reply(`📝 Yangi ismni kiriting (hozirgi: ${debtor.name}):`);
      return;
    }

    // 🔹 Telefonni tahrirlash
    if (data.startsWith('edit_phone_')) {
      const debtorId = data.split('_')[2];
      const debtor = await this.prisma.debtor.findUnique({
        where: { id: debtorId },
      });
      if (!debtor) return ctx.reply('❌ Qarzdor topilmadi.');
      session.tempDebtorId = debtorId;
      session.state = 'editing_debtor_phone';
      await ctx.answerCbQuery();
      await ctx.reply(
        `📞 Yangi telefon raqamni kiriting (hozirgi: ${debtor.phone}):`,
      );
      return;
    }

    // 🔹 Barcha qarzlarni ko‘rish
    if (data.startsWith('all_debts_')) {
      const debtorId = data.split('_')[2];
      await this.showAllDebts(ctx, debtorId);
      await ctx.answerCbQuery();
      return;
    }

    // 🔹 Qarzdor qarzini yopish menyusi
    if (data.startsWith('payDebt:')) {
      const debtorId = data.split(':')[1];
      session.tempDebtorId = debtorId;

      const debtor = await this.prisma.debtor.findUnique({
        where: { id: debtorId },
        include: { debts: true },
      });

      if (!debtor) return ctx.reply('❌ Qarzdor topilmadi.');
      if (debtor.debts.length === 0)
        return ctx.reply('💰 Bu qarzdorning qarzi yo‘q.');

      const inlineButtons = debtor.debts.map((d) => [
        {
          text: `${d.amount.toLocaleString()} so‘m (${d.createdAt.toLocaleDateString('uz-UZ')})`,
          callback_data: `paySingleDebt:${d.id}`,
        },
      ]);

      inlineButtons.push([
        {
          text: '💰 Hammasini yopish',
          callback_data: `payAllDebt:${debtorId}`,
        },
      ]);

      session.state = 'awaiting_single_debt_payment';

      await ctx.reply(`💰 ${debtor.name} qarzlaridan birini tanlang:`, {
        reply_markup: { inline_keyboard: inlineButtons },
      });

      await ctx.answerCbQuery();
      return;
    }

    // 🔹 Bitta qarzni yopish
    if (data.startsWith('paySingleDebt:')) {
      const debtId = data.split(':')[1];
      const debt = await this.prisma.debt.findUnique({
        where: { id: debtId },
        include: { debtor: true },
      });

      if (!debt) return ctx.reply('❌ Qarz topilmadi.');

      await this.prisma.debt.delete({ where: { id: debtId } });
      await ctx.reply(
        `✅ ${debt.debtor.name}ning ${debt.amount.toLocaleString()} so‘mlik qarzi yopildi.`,
      );
      await ctx.answerCbQuery();
      return;
    }

    // 🔹 Barcha qarzlarni yopish
    if (data.startsWith('payAllDebt:')) {
      const debtorId = data.split(':')[1];
      const debtor = await this.prisma.debtor.findUnique({
        where: { id: debtorId },
        include: { debts: true },
      });
      if (!debtor) return ctx.reply('❌ Qarzdor topilmadi.');

      const total = debtor.debts.reduce((sum, d) => sum + d.amount, 0);
      await this.prisma.debt.deleteMany({ where: { debtorId } });

      await ctx.reply(
        `✅ ${debtor.name}ning barcha ${total.toLocaleString()} so‘mlik qarzi yopildi.`,
      );
      await ctx.answerCbQuery();
      return;
    }

    // 🔹 Orqaga qaytish
    if (data === 'back_to_search') {
      session.state = 'debtor_menu';
      await this.showDebtors(ctx, session);
      await ctx.answerCbQuery();
      return;
    }
  }

  // async showPayDebtorMenu(ctx: Context, session: SessionData) {
  //   const debtors = await this.prisma.debtor.findMany({
  //     where: { ownerId: session.userId },
  //     include: { debts: true },
  //   });

  //   if (debtors.length === 0) {
  //     return ctx.reply('🕳 Qarzdorlar topilmadi.');
  //   }

  //   let list = '💰 Qarzini yopmoqchi bo‘lgan qarzdorni tanlang:\n\n';
  //   const buttons = [];

  //   for (const debtor of debtors) {
  //     const totalDebt = debtor.debts.reduce((sum, d) => sum + d.amount, 0);
  //     if (totalDebt > 0) {
  //       list += `👤 ${debtor.name}\n📞 ${debtor.phone}\n💰 ${totalDebt.toLocaleString()} so‘m\n\n`;
  //       buttons.push([
  //         { text: debtor.name, callback_data: `payDebt:${debtor.id}` },
  //       ]);
  //     }
  //   }

  //   if (buttons.length === 0) return ctx.reply('✅ Hamma qarzlar yopilgan.');

  //   buttons.push([{ text: '↩️ Orqaga', callback_data: 'back_to_search' }]);

  //   session.state = 'debtor_menu';
  //   await ctx.reply(list, { reply_markup: { inline_keyboard: buttons } });
  // }
}
