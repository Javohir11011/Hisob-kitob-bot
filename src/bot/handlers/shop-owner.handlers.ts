import { Injectable } from '@nestjs/common';
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
  // async handleText(ctx: Context, session: SessionData): Promise<void> {
  //   if (!ctx.message || !('text' in ctx.message)) return;
  //   const text = ctx.message.text.trim();

  //   console.log('📩', text, '| State:', session.state);

  //   switch (session.state) {
  //     /* 🔸 Asosiy menyu */
  //     case 'shop_owner_menu':
  //       if (text === '➕ Qarzdor qo‘shish')
  //         return this.startAddDebtor(ctx, session);

  //       if (text === '➕ Qarz qo‘shish')
  //         return this.startAddDebtSearch(ctx, session);

  //       if (text === '👤 Profil') return this.showProfile(ctx, session);

  //       if (text === '📋 Qarzdorlar') return this.showDebtors(ctx, session);

  //       if (text === '💰 Qarz yopish')
  //         await this.showPayDebtorMenu(ctx, session);
  //       return;

  //     /* 🔸 Profil menyu */
  //     case 'shop_owner_profile':
  //       if (text === '⬅️ Orqaga qaytish') return this.showMenu(ctx, session);
  //       break;

  //     /* 🔸 Qarzdor qo‘shish */
  //     case 'adding_debtor_name':
  //     case 'adding_debtor_phone':
  //     case 'adding_debtor_password':
  //     case 'adding_debtor_address':
  //       return this.handleAddDebtor(ctx, session);

  //     /* 🔸 Qarz qo‘shish */
  //     case 'adding_debt_amount':
  //     case 'adding_debt_note':
  //       await this.handleAddDebtAmountAndNote(ctx, session);
  //       return;
  //     case 'search_debtor_for_debt':
  //       return this.handleSearchAndSelectDebtor(ctx, session);

  //     /* 🔸 Helper qo‘shish */
  //     // case 'adding_helper_name':
  //     // case 'adding_helper_phone':
  //     // case 'adding_helper_password':
  //     // return this.handleAddHelper(ctx, session);

  //     /* 🔸 Qarzdorlar menyusi (Qidirish / Orqaga) */
  //     case 'debtor_menu':
  //       if (text === '🔍 Qidirish') {
  //         return this.startSearchDebtor(ctx, session);
  //       }
  //       if (text === '↩️ Orqaga') {
  //         session.state = 'shop_owner_menu';
  //         return this.showMenu(ctx, session);
  //       }
  //       break;

  //     /* 🔸 Qidiruv holati */
  //     case 'searching_debtor':
  //       if (text === '↩️ Orqaga') {
  //         session.state = 'debtor_menu';
  //         return this.showDebtors(ctx, session);
  //       }
  //       return this.handleSearchDebtor(ctx, session);

  //     /* 🔸 Qarzdorni tahrirlash */
  //     case 'editing_debtor_name':
  //     case 'editing_debtor_phone':
  //       return this.handleEditDebtor(ctx, session);

  //     /* 🔸 Qarzni yopish (miqdor kiritilgandan keyin) */
  //     case 'paying_debt':
  //       return this.handleDebtPayment(ctx, session);

  //     default:
  //       session.state = 'shop_owner_menu';
  //       return this.showMenu(ctx, session);
  //   }
  // }

  async handleText(ctx: Context, session: SessionData): Promise<void> {
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = ctx.message.text.trim();

    // 🔒 Add Debtor flow
    if (session.state?.startsWith('adding_debtor_')) {
      return this.handleAddDebtor(ctx, session);
    }

    // 🔒 Add Debt flow
    if (
      session.state === 'adding_debt_amount' ||
      session.state === 'adding_debt_note' ||
      session.state === 'search_debtor_for_debt' ||
      session.state === 'awaiting_debtor_selection'
    ) {
      if (session.state === 'search_debtor_for_debt') {
        return this.handleSearchAndSelectDebtor(ctx, session);
      }
      if (
        session.state === 'adding_debt_amount' ||
        session.state === 'adding_debt_note'
      ) {
        return this.handleAddDebtAmountAndNote(ctx, session);
      }
      return;
    }

    // 🔒 Pay Debt flow
    if (session.state === 'paying_debt') {
      return this.handleDebtPayment(ctx, session);
    }

    // 🔁 Main state switch
    switch (session.state) {
      case 'shop_owner_menu':
        if (text === '➕ Qarzdor qo‘shish')
          return this.startAddDebtor(ctx, session);
        if (text === '➕ Qarz qo‘shish')
          return this.startAddDebtSearch(ctx, session);
        if (text === '👤 Profil') return this.showProfile(ctx, session);
        if (text === '📋 Qarzdorlar') return this.showDebtors(ctx, session);
        if (text === '💰 Qarz yopish')
          return this.showPayDebtorMenu(ctx, session);
        return;

      case 'shop_owner_profile':
        if (text === '⬅️ Orqaga qaytish') return this.showMenu(ctx, session);
        return;

      case 'debtor_menu':
        if (text === '🔍 Qidirish') return this.startSearchDebtor(ctx, session);
        if (text === '↩️ Orqaga') return this.showMenu(ctx, session);
        return;

      case 'searching_debtor':
        if (text === '↩️ Orqaga') return this.showDebtors(ctx, session);
        return this.handleSearchDebtor(ctx, session);

      case 'editing_debtor_name':
      case 'editing_debtor_phone':
        return this.handleEditDebtor(ctx, session);

      default:
        session.state = 'shop_owner_menu';
        return this.showMenu(ctx, session);
    }
  }

  /* -----------------------
   QARZDOR CRUD + SEARCH
----------------------- */
  async startAddDebtor(ctx: Context, session: SessionData): Promise<void> {
    session.state = 'adding_debtor_name';
    await ctx.reply(
      '🧾 Yangi qarzdor ismini kiriting:',
      Markup.keyboard([['❌ Bekor qilish']]).resize(),
    );
  }

  // async handleAddDebtor(ctx: Context, session: SessionData) {
  //   if (!ctx.message || !('text' in ctx.message)) return;
  //   const text = ctx.message.text.trim();
  //   if (!text) return;

  //   // ❌ Bekor qilish
  //   if (text === '❌ Bekor qilish') {
  //     session.state = 'shop_owner_menu';
  //     session.newDebtorName = undefined;
  //     session.newDebtorPhone = undefined;
  //     session.newDebtorAddress = undefined;
  //     session.newDebtorPassword = undefined;

  //     await ctx.reply('❌ Qarzdor qo‘shish bekor qilindi.');
  //     await this.showMenu(ctx, session);
  //     return;
  //   }

  //   switch (session.state) {
  //     case 'adding_debtor_name':
  //       session.newDebtorName = text;
  //       session.state = 'adding_debtor_phone';
  //       await ctx.reply(
  //         '📞 Qarzdor telefon raqamini kiriting (+998XXXXXXXXX yoki +7XXXXXXXXXX):',
  //         Markup.keyboard([['❌ Bekor qilish']]).resize(),
  //       );
  //       break;

  //     case 'adding_debtor_phone':
  //       let phone = text;
  //       if (phone.startsWith('0')) phone = '+998' + phone.slice(1);
  //       if (!phone.startsWith('+')) phone = '+' + phone;

  //       if (!/^\+998\d{9}$/.test(phone) && !/^\+7\d{10}$/.test(phone)) {
  //         await ctx.reply(
  //           '❌ Telefon raqam noto‘g‘ri formatda. Iltimos, +998XXXXXXXXX yoki +7XXXXXXXXXX kiriting.',
  //         );
  //         return;
  //       }

  //       const exists = await this.prisma.debtor.findFirst({ where: { phone } });
  //       if (exists) {
  //         await ctx.reply(
  //           '❌ Bu raqam allaqachon mavjud. Boshqa raqam kiriting.',
  //         );
  //         return;
  //       }

  //       session.newDebtorPhone = phone;
  //       session.state = 'adding_debtor_address';
  //       await ctx.reply(
  //         '🏠 Qarzdor manzilini kiriting:',
  //         Markup.keyboard([['❌ Bekor qilish']]).resize(),
  //       );
  //       break;

  //     case 'adding_debtor_address':
  //       session.newDebtorAddress = text;
  //       session.state = 'adding_debtor_password';
  //       await ctx.reply(
  //         '🔑 Qarzdor uchun parol kiriting (kamida 4 belgidan):',
  //         Markup.keyboard([['❌ Bekor qilish']]).resize(),
  //       );
  //       break;

  //     case 'adding_debtor_password':
  //       if (text.length < 4) {
  //         await ctx.reply('❌ Parol kamida 4 belgidan iborat bo‘lishi kerak.');
  //         return;
  //       }

  //       session.newDebtorPassword = text;

  //       const shop = await this.prisma.shop.findFirst({
  //         where: { users: { some: { phone: session.phone } } },
  //       });

  //       if (!shop) {
  //         await ctx.reply('❌ Sizga tegishli shop topilmadi.');
  //         await this.resetDebtorSession(session);
  //         return this.showMenu(ctx, session);
  //       }

  //       const newDebtor = await this.prisma.debtor.create({
  //         data: {
  //           name: session.newDebtorName!,
  //           phone: session.newDebtorPhone!,
  //           address: session.newDebtorAddress!,
  //           password: session.newDebtorPassword!,
  //           shopId: shop.id,
  //         },
  //       });

  //       // ✅ SUCCESS XABAR (ALOHIDA)
  //       await ctx.reply(
  //         `✅ Qarzdor muvaffaqiyatli qo‘shildi!\n\n👤 ${newDebtor.name}\n📞 ${newDebtor.phone}`,
  //       );

  //       // 🧹 SESSION TOZALASH
  //       await this.resetDebtorSession(session);

  //       // 📋 ASOSIY MENYU
  //       return this.showMenu(ctx, session);
  //   }
  // }

  async handleAddDebtor(ctx: Context, session: SessionData): Promise<void> {
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = ctx.message.text.trim();

    // ❌ Bekor qilish tugmasi
    if (text === '❌ Bekor qilish') {
      await ctx.reply('❌ Qarzdor qo‘shish bekor qilindi.');
      await this.resetDebtorSession(session);
      return this.showMenu(ctx, session);
    }

    switch (session.state) {
      case 'adding_debtor_name':
        session.newDebtorName = text;
        session.state = 'adding_debtor_phone';
        await ctx.reply(
          '📞 Qarzdor telefon raqamini kiriting (+998XXXXXXXXX yoki +7XXXXXXXXXX):',
          Markup.keyboard([['❌ Bekor qilish']]).resize(),
        );
        break;

      case 'adding_debtor_phone':
        let phone = text;
        if (phone.startsWith('0')) phone = '+998' + phone.slice(1);
        if (!phone.startsWith('+')) phone = '+' + phone;

        if (!/^\+998\d{9}$/.test(phone) && !/^\+7\d{10}$/.test(phone)) {
          await ctx.reply(
            '❌ Telefon raqam noto‘g‘ri formatda. Iltimos, +998XXXXXXXXX yoki +7XXXXXXXXXX kiriting.',
          );
          return;
        }

        const exists = await this.prisma.debtor.findFirst({ where: { phone } });
        if (exists) {
          await ctx.reply(
            '❌ Bu raqam allaqachon mavjud. Boshqa raqam kiriting.',
          );
          return;
        }

        session.newDebtorPhone = phone;
        session.state = 'adding_debtor_address';
        await ctx.reply(
          '🏠 Qarzdor manzilini kiriting:',
          Markup.keyboard([['❌ Bekor qilish']]).resize(),
        );
        break;

      case 'adding_debtor_address':
        session.newDebtorAddress = text;
        session.state = 'adding_debtor_password';
        await ctx.reply(
          '🔑 Qarzdor uchun parol kiriting (kamida 4 belgidan):',
          Markup.keyboard([['❌ Bekor qilish']]).resize(),
        );
        break;

      case 'adding_debtor_password':
        if (text.length < 4) {
          await ctx.reply('❌ Parol kamida 4 belgidan iborat bo‘lishi kerak.');
          return;
        }
        session.newDebtorPassword = text;

        // Owner shopini topamiz
        const owner = await this.prisma.user.findFirst({
          where: { phone: session.phone },
        });

        if (!owner?.shopId) {
          await ctx.reply('❌ Sizga tegishli shop topilmadi.');
          await this.resetDebtorSession(session);
          return this.showMenu(ctx, session);
        }

        // Debtor yaratish
        const password = session.newDebtorPassword?.trim();
        if (!password || password.length < 4) {
          await ctx.reply('❌ Parol noto‘g‘ri. Qayta kiriting.');
          session.state = 'adding_debtor_password';
          return;
        }

        const debtor = await this.prisma.debtor.create({
          data: {
            name: session.newDebtorName!,
            phone: session.newDebtorPhone!,
            address: session.newDebtorAddress!,
            password, // 🔹 endi hamisha string
            shopId: owner.shopId,
          },
        });

        await ctx.reply(
          `✅ Yangi qarzdor "${debtor.name}" qo‘shildi!\n📞 ${debtor.phone}`,
        );

        await this.resetDebtorSession(session);
        return this.showMenu(ctx, session);

      default:
        session.state = 'shop_owner_menu';
        return this.showMenu(ctx, session);
    }
  }

  // ----------------------
  // Sessionni tozalash
  // ----------------------
  private async resetDebtorSession(session: SessionData) {
    session.state = 'shop_owner_menu';
    session.newDebtorName = undefined;
    session.newDebtorPhone = undefined;
    session.newDebtorAddress = undefined;
    session.newDebtorPassword = undefined;
  }

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

      // 🔹 STATE avval yoziladi
      session.state = 'debtor_menu';

      if (debtors.length === 0) {
        await ctx.reply(
          '📭 Hozircha qarzdorlar yo‘q.',
          Markup.keyboard([['↩️ Orqaga']]).resize(),
        );
        return;
      }

      let list = '📋 <b>Qarzdorlar ro‘yxati:</b>\n\n';
      let totalShopDebt = 0;

      debtors.forEach((d, i) => {
        const totalDebt = d.debts.reduce((sum, debt) => sum + debt.amount, 0);
        totalShopDebt += totalDebt;

        const createdAt = new Date(d.createdAt).toLocaleDateString('uz-UZ', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        list += `<b>${i + 1}. ${d.name}</b>\n📞 ${d.phone}\n💰 ${totalDebt.toLocaleString()} so‘m\n📅 ${createdAt}\n\n`;
      });

      // 🔹 Oxirida do‘kon bo‘yicha umumiy qarz
      list += `💰 <b>Do‘kon bo‘yicha umumiy qarz:</b> ${totalShopDebt.toLocaleString()} so‘m`;

      await ctx.replyWithHTML(
        list,
        Markup.keyboard([['🔍 Qidirish'], ['↩️ Orqaga']]).resize(),
      );
    } catch (error) {
      console.error(error);
      await ctx.reply('⚠️ Qarzdorlarni yuklashda xatolik yuz berdi.');
    }
  }

  async startSearchDebtor(ctx: Context, session: SessionData) {
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
        [Markup.button.callback('✏️ Tahrirlash', `editdeb_${debtor.id}`)],
        [Markup.button.callback('🗑 O‘chirish', `deldeb_${debtor.id}`)],
        [Markup.button.callback('↩️ Orqaga', 'back_to_debtors')],
      ]),
    );
  }

  // /* ✏️ Tahrirlashni boshlash */
  async startEditDebtor(ctx: Context, debtorId: string, session: SessionData) {
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
        [Markup.button.callback('🗑 Delete', `delete_debtor_${debtorId}`)],
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
        Markup.keyboard([['📋 Qarzdorlar'], ['↩️ Orqaga']]).resize(),
      );

      const session = ctx.session as SessionData;
      if (session.role === 'SHOP_OWNER') {
        await this.showDebtors(ctx, session);
      }
    } catch (err) {
      console.error('❌ deleteDebtor error:', err);
      await ctx.reply('⚠️ Qarzdorni o‘chirishda xatolik yuz berdi.');
    }
  }
  /* -----------------------
   QARZ QO‘SHISH (bosqichma-bosqich)
----------------------- */
  // 1️⃣ Qarz qo‘shish boshi: qarzdor qidirish
  async startAddDebtSearch(ctx: Context, session: SessionData) {
    session.state = 'search_debtor_for_debt';
    await ctx.reply(
      '🔎 Qarzdorning ismi yoki telefon raqamini kiriting:',
      Markup.keyboard([['❌ Bekor qilish']]).resize(),
    );
  }

  async handleSearchAndSelectDebtor(ctx: Context, session: SessionData) {
    if (!ctx.message || !('text' in ctx.message)) return;
    if (session.state !== 'search_debtor_for_debt') return;
    const query = ctx.message.text.trim();
    if (!query) return;

    const text = ctx.message.text.trim();

    if (text === '❌ Bekor qilish') {
      session.state = 'shop_owner_menu';
      return this.showMenu(ctx, session);
    }

    const shopOwner = await this.prisma.user.findFirst({
      where: { phone: session.phone },
    });
    if (!shopOwner?.shopId) {
      await ctx.reply('❌ Sizning shopingiz topilmadi.');
      session.state = 'shop_owner_menu';
      return this.showMenu(ctx, session);
    }

    const debtors = await this.prisma.debtor.findMany({
      where: {
        shopId: shopOwner.shopId,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
        ],
      },
    });

    if (!debtors.length) {
      await ctx.reply('❌ Qarzdor topilmadi. Avval qarzdor qo‘shing.');
      session.state = 'shop_owner_menu';
      return this.showMenu(ctx, session);
    }

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

  async handleDebtorSelection(
    ctx: Context,
    session: SessionData,
    debtorId: string,
  ) {
    session.tempDebtorId = debtorId;
    session.state = 'adding_debt_amount';
    await ctx.reply('💰 Qarz summasini kiriting');
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
      const amount = parseInt(text.replace(/\s+/g, ''), 10);
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply('❌ Iltimos, to‘g‘ri summa kiriting.');
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
          debtorId: session.tempDebtorId!,
        },
      });

      await ctx.reply(
        `✅ Qarzdorga ${session.tempDebtAmount?.toLocaleString()} so‘m qo‘shildi.\n📌 ${note || '(izoh yo‘q)'}`,
      );

      session.state = 'shop_owner_menu';
      await this.showMenu(ctx, session);
      return;
    }
  }

  /* -----------------------
   QARZ YOPISH (bosqichma-bosqich)
----------------------- */
  async handleCallbackQuery(ctx: any, session: SessionData) {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;
    const data = callbackQuery.data;
    console.log('🟢 Callback:', data, '| State:', session.state);

    if (!data) return;

    if (data.startsWith('addDebt:')) {
      const debtorId = data.split(':')[1];
      session.tempDebtorId = debtorId;
      session.state = 'adding_debt_amount';

      await ctx.answerCbQuery('💰 Qarz summasini kiriting');
      await ctx.reply('💰 Qarz summasini kiriting:');
      return;
    }

    // 🔹 Qarzdor qarzini yopish (hammasi yoki bitta)
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

      if (!debt) {
        await ctx.reply('❌ Qarz topilmadi.');
        return;
      }

      // 🔹 Session ma'lumotlarini saqlaymiz
      session.tempDebtId = debtId;
      session.tempDebtorId = debt.debtor.id; // 🔹 Shu qator muhim!
      session.state = 'paying_debt';

      await ctx.answerCbQuery();
      await ctx.reply(
        `💰 ${debt.debtor.name}ning ${debt.amount.toLocaleString()} so‘mlik qarzidan qancha to‘laysiz?`,
      );

      console.log(
        '➡️ [DEBUG] session.state:',
        session.state,
        ' debtId:',
        session.tempDebtId,
        ' debtorId:',
        session.tempDebtorId, // 🔹 debug uchun
      );
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

    if (data.startsWith('paySingleDebt:')) {
      const debtId = data.split(':')[1];
      const debt = await this.prisma.debt.findUnique({
        where: { id: debtId },
        include: { debtor: true },
      });

      if (!debt) {
        await ctx.reply('❌ Qarz topilmadi.');
        return;
      }

      session.tempDebtId = debt.id;
      session.tempDebtorId = debt.debtor.id;
      session.state = 'paying_debt'; // 👈 Bu muhim!
      await ctx.reply(
        `💰 ${debt.debtor.name}ning ${debt.amount.toLocaleString()} so‘mlik qarzidan qancha to‘laysiz?`,
      );
      return;
    }
  }

  // bu yangi funksiya keyin ishlaytamiz !!!
  // async handleCallbackQuery(ctx: any, session: SessionData) {
  //   const data = ctx.callbackQuery?.data;
  //   if (!data) return;

  //   // 🔹 Add Debt selection
  //   if (data.startsWith('addDebt:')) {
  //     const debtorId = data.split(':')[1];
  //     session.tempDebtorId = debtorId;
  //     session.state = 'adding_debt_amount';
  //     await ctx.answerCbQuery('💰 Qarz summasini kiriting');
  //     await ctx.reply('💰 Qarz summasini kiriting:');
  //     return;
  //   }

  //   // 🔹 Pay Debt
  //   if (data.startsWith('payDebt:')) {
  //     const debtorId = data.split(':')[1];
  //     session.tempDebtorId = debtorId;

  //     const debtor = await this.prisma.debtor.findUnique({
  //       where: { id: debtorId },
  //       include: { debts: true },
  //     });

  //     if (!debtor || debtor.debts.length === 0) {
  //       await ctx.reply('💰 Bu qarzdorning qarzi yo‘q.');
  //       return;
  //     }

  //     const buttons = debtor.debts.map((d) => [
  //       {
  //         text: `${d.amount.toLocaleString()} so‘m (${d.createdAt.toLocaleDateString()})`,
  //         callback_data: `paySingleDebt:${d.id}`,
  //       },
  //     ]);

  //     buttons.push([
  //       {
  //         text: '💰 Hammasini yopish',
  //         callback_data: `payAllDebt:${debtorId}`,
  //       },
  //     ]);

  //     session.state = 'awaiting_single_debt_payment';
  //     await ctx.reply(`💰 ${debtor.name} qarzlaridan birini tanlang:`, {
  //       reply_markup: { inline_keyboard: buttons },
  //     });
  //     await ctx.answerCbQuery();
  //     return;
  //   }

  //   if (data.startsWith('paySingleDebt:')) {
  //     const debtId = data.split(':')[1];
  //     const debt = await this.prisma.debt.findUnique({
  //       where: { id: debtId },
  //       include: { debtor: true },
  //     });
  //     if (!debt) return ctx.reply('❌ Qarz topilmadi.');

  //     session.tempDebtId = debt.id;
  //     session.tempDebtorId = debt.debtor.id;
  //     session.state = 'paying_debt';
  //     await ctx.reply(
  //       `💰 ${debt.debtor.name}ning ${debt.amount.toLocaleString()} so‘mlik qarzidan qancha to‘laysiz?`,
  //     );
  //     await ctx.answerCbQuery();
  //     return;
  //   }

  //   if (data.startsWith('payAllDebt:')) {
  //     const debtorId = data.split(':')[1];
  //     const debtor = await this.prisma.debtor.findUnique({
  //       where: { id: debtorId },
  //       include: { debts: true },
  //     });
  //     if (!debtor) return ctx.reply('❌ Qarzdor topilmadi.');

  //     const total = debtor.debts.reduce((sum, d) => sum + d.amount, 0);
  //     await this.prisma.debt.deleteMany({ where: { debtorId } });

  //     await ctx.reply(
  //       `✅ ${debtor.name}ning barcha ${total.toLocaleString()} so‘mlik qarzi yopildi.`,
  //     );
  //     await ctx.answerCbQuery();
  //     session.state = 'shop_owner_menu';
  //     return this.showMenu(ctx, session);
  //   }
  // }

  async showPayDebtorMenu(ctx: Context, session: SessionData): Promise<void> {
    const shopOwner = await this.prisma.user.findFirst({
      where: { phone: session.phone },
    });

    if (!shopOwner?.shopId) {
      await ctx.reply('❌ Sizning shopingiz topilmadi.');
      session.state = 'shop_owner_menu';
      return this.showMenu(ctx, session);
    }

    const debtors = await this.prisma.debtor.findMany({
      where: { shopId: shopOwner.shopId },
      include: { debts: true },
    });

    if (debtors.length === 0) {
      await ctx.reply('💰 Hozircha qarzdorlar yo‘q.');
      session.state = 'debtor_menu';
      return;
    }

    const inlineButtons = debtors.map((d) => [
      {
        text: `${d.name} (${d.debts.reduce((s, debt) => s + debt.amount, 0).toLocaleString()} so‘m)`,
        callback_data: `payDebt:${d.id}`,
      },
    ]);

    session.state = 'awaiting_debtor_selection';

    await ctx.reply('👥 Qarzdorni tanlang:', {
      reply_markup: { inline_keyboard: inlineButtons },
    });
  }

  // async handleDebtPayment(ctx: Context, session: SessionData) {
  //   if (!ctx.message || !('text' in ctx.message)) return;
  //   if (session.state !== 'paying_debt') return; // 🔹 qo‘shimcha xavfsizlik

  //   const text = ctx.message.text.trim();
  //   const debtorId = session.tempDebtorId;
  //   if (!debtorId) return;

  //   const amount = parseInt(text.replace(/\s+/g, ''), 10);
  //   if (isNaN(amount) || amount <= 0) {
  //     await ctx.reply('❌ Iltimos, to‘g‘ri summa kiriting.');
  //     return;
  //   }

  //   const debts = await this.prisma.debt.findMany({
  //     where: { debtorId },
  //     orderBy: { createdAt: 'asc' },
  //   });

  //   if (debts.length === 0) {
  //     await ctx.reply('❌ Bu qarzdorning qarzi yo‘q.');
  //     session.state = 'shop_owner_menu';
  //     return this.showMenu(ctx, session);
  //   }

  //   let remaining = amount;
  //   for (const debt of debts) {
  //     if (remaining <= 0) break;

  //     const pay = Math.min(remaining, debt.amount);
  //     const newAmount = debt.amount - pay;

  //     if (newAmount > 0) {
  //       await this.prisma.debt.update({
  //         where: { id: debt.id },
  //         data: { amount: newAmount },
  //       });
  //     } else {
  //       await this.prisma.debt.delete({ where: { id: debt.id } });
  //     }

  //     remaining -= pay;
  //   }

  //   const debtor = await this.prisma.debtor.findUnique({
  //     where: { id: debtorId },
  //     include: { debts: true },
  //   });

  //   const totalLeft = debtor?.debts.reduce((sum, d) => sum + d.amount, 0) ?? 0;

  //   await ctx.reply(
  //     `✅ ${amount - remaining} so‘m to‘landi.\nQolgan qarz: ${totalLeft.toLocaleString()} so‘m`,
  //   );

  //   session.state = 'shop_owner_menu'; // 🔹 faqat to‘lov bajarilgandan keyin
  //   return this.showMenu(ctx, session);
  // }

  async handleDebtPayment(ctx: Context, session: SessionData): Promise<void> {
    if (!ctx.message || !('text' in ctx.message)) return;
    if (session.state !== 'paying_debt') return;

    const text = ctx.message.text.trim();
    const debtId = session.tempDebtId;
    if (!debtId) {
      await ctx.reply('❌ Qarz aniqlanmadi.');
      return;
    }

    const amount = parseInt(text.replace(/\s+/g, ''), 10);
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('❌ Iltimos, to‘g‘ri summa kiriting.');
      return;
    }

    const debt = await this.prisma.debt.findUnique({ where: { id: debtId } });
    if (!debt) {
      await ctx.reply('❌ Qarz topilmadi.');
      return;
    }
    if (amount >= debt.amount) {
      // To‘liq yopish
      await this.prisma.debt.delete({ where: { id: debtId } });
      await ctx.reply(
        `✅ ${debt.amount.toLocaleString()} so‘m to‘landi. Qarz yopildi.`,
      );
    } else {
      // Qisman yopish
      await this.prisma.debt.update({
        where: { id: debtId },
        data: { amount: debt.amount - amount },
      });
      await ctx.reply(
        `✅ ${amount.toLocaleString()} so‘m to‘landi. Qolgan qarz: ${(debt.amount - amount).toLocaleString()} so‘m`,
      );
    }

    session.state = 'shop_owner_menu';
    session.tempDebtId = undefined;
    session.tempDebtorId = undefined;
    return this.showMenu(ctx, session);
  }

  /* -----------------------OXIRIDA FAQAT SINGLE PAYMENT QOLDI
----------------------- */
}
