import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Context, Markup } from 'telegraf';
import { PrismaService } from '../../core/prisma.service';
import { SessionData } from '../states/session.data';

@Injectable()
export class ShopOwnerHandler {
  constructor(private readonly prisma: PrismaService) {}

  // 🔹 Asosiy menyuni ko'rsatish
  async showMenu(ctx: Context, session: SessionData) {
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

  // 🔹 Profilni ko‘rsatish
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
      await ctx.reply('Foydalanuvchi topilmadi.');
      return;
    }

    const message = `
👤 Ism: ${user.name}
📞 Telefon: ${user.phone}
🏬 Dokon: ${user.shop?.name ?? '-'}
🕒 Ro‘yxatdan o‘tgan: ${user.createdAt.toLocaleString()}
    `;
    await ctx.reply(message, Markup.keyboard([['❌ Bekor qilish']]).resize());
    session.state = 'shop_owner_profile';
  }

  // 🔹 Asosiy text handler
  async handleText(ctx: Context, session: SessionData): Promise<void> {
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = ctx.message.text.trim();

    switch (session.state) {
      case 'shop_owner_menu':
        if (text === '➕ Qarzdor qo‘shish')
          return this.startAddDebtor(ctx, session);
        if (text === '➕ Qarz qo‘shish') return this.addDebt(ctx, session);
        if (text === '📋 Qarzdorlar') return this.showDebtors(ctx, session);
        if (text === '👤 Profil') return this.showProfile(ctx, session);
        if (text === '➕ Add Helper') return this.startAddHelper(ctx, session);
        break;

      case 'shop_owner_profile':
        if (text === '❌ Bekor qilish') return this.showMenu(ctx, session);
        break;

      case 'adding_helper_name':
      case 'adding_helper_phone':
      case 'adding_helper_password':
        return this.handleAddHelper(ctx, session);
    }
  }

  // 🔹 Add Helper boshlash
  async startAddHelper(ctx: Context, session: SessionData) {
    session.state = 'adding_helper_name';
    session.newHelperName = undefined;
    session.newHelperPhone = undefined;
    session.newHelperPassword = undefined;
    await ctx.reply(
      'Yangi Helper ismini kiriting:',
      Markup.keyboard([['❌ Bekor qilish']]).resize(),
    );
  }

  // 🔹 Add Helper jarayoni
  async handleAddHelper(ctx: Context, session: SessionData): Promise<void> {
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = ctx.message.text.trim();

    // 🔹 Bekor qilish
    if (text === '❌ Bekor qilish') {
      await this.showMenu(ctx, session);
      return;
    }

    switch (session.state) {
      case 'adding_helper_name':
        session.newHelperName = text;
        session.state = 'adding_helper_phone';
        await ctx.reply('Helper telefon raqamini kiriting (+998XXXXXXXXX):');
        break;

      case 'adding_helper_phone':
        let phone = text;
        if (phone.startsWith('0')) phone = '+998' + phone.slice(1);
        if (!phone.startsWith('+')) phone = '+' + phone;

        if (!/^\+998\d{9}$/.test(phone)) {
          await ctx.reply(
            'Telefon raqam noto‘g‘ri formatda. +998XXXXXXXXX formatida kiriting:',
          );
          return;
        }

        const exists = await this.prisma.user.findFirst({ where: { phone } });
        if (exists) {
          await ctx.reply('Bu raqam allaqachon mavjud. Boshqa raqam kiriting:');
          return;
        }

        session.newHelperPhone = phone;
        session.state = 'adding_helper_password';
        await ctx.reply('Helper uchun parol kiriting:');
        break;

      case 'adding_helper_password':
        session.newHelperPassword = text;

        const shopOwner = await this.prisma.user.findFirst({
          where: { phone: session.phone },
        });

        if (!shopOwner || !shopOwner.shopId) {
          await ctx.reply('Sizning shopingiz topilmadi.');
          session.state = 'shop_owner_menu';
          await this.showMenu(ctx, session);
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

        session.state = 'shop_owner_menu';
        await ctx.reply(`Yangi Helper "${session.newHelperName}" qo‘shildi ✅`);
        await this.showMenu(ctx, session);
        break;
    }
  }

  // // 🔹 Qarz qo‘shishni boshlash
  async addDebt(ctx: Context, session: SessionData) {
    session.state = 'adding_debt_name';
    session.tempOwnerId = undefined;
    await ctx.reply(
      'Qarzdorning ismi yoki telefon raqamini kiriting:',
      Markup.keyboard([['❌ Bekor qilish']]).resize(),
    );
  }

  // // 🔹 Qarz qo‘shish davom ettirish
  // async handleAddDebt(ctx: Context, session: SessionData) {
  //   if (!ctx.message || !('text' in ctx.message)) return;
  //   const text = ctx.message.text.trim();

  //   // 🔹 Bekor qilish
  //   if (text === '❌ Bekor qilish') {
  //     await this.showMenu(ctx, session);
  //     return;
  //   }

  //   switch (session.state) {
  //     case 'adding_debt_name':
  //       let phone: string | null = null;

  //       // agar raqam kiritsa
  //       if (/^\+?\d{9,15}$/.test(text)) {
  //         phone = text.startsWith('+') ? text : '+' + text;
  //       }

  //       // qarzdorni topamiz yoki yaratamiz
  //       let debtor = await this.prisma.user.findFirst({
  //         where: phone ? { phone } : { name: text },
  //       });

  //       if (!debtor) {
  //         debtor = await this.prisma.user.create({
  //           data: {
  //             name: phone ? '' : text,
  //             phone: phone ?? '',
  //           },
  //         });
  //       }

  //       session.tempOwnerId = debtor.id;
  //       session.state = 'adding_debt_amount';
  //       await ctx.reply(
  //         'Qarzdorlik summasini kiriting (so‘mda):',
  //         Markup.keyboard([['❌ Bekor qilish']]).resize(),
  //       );
  //       break;

  //     case 'adding_debt_amount':
  //       const amount = parseInt(text, 10);
  //       if (isNaN(amount) || amount <= 0) {
  //         await ctx.reply('Iltimos, to‘g‘ri summa kiriting:');
  //         return;
  //       }

  //       await this.prisma.debt.create({
  //         data: {
  //           amount,
  //           note: 'Qarzdorlik qo‘shildi',
  //           userId: session.tempOwnerId!,
  //         },
  //       });

  //       await ctx.reply(`✅ Qarz muvaffaqiyatli qo‘shildi: ${amount} so‘m`);
  //       session.state = 'shop_owner_menu';
  //       await this.showMenu(ctx, session);
  //       break;
  //   }
  // }

  // 🔹 Qarz yopish (misol)
  async payDebt(ctx: Context, session: SessionData) {
    await ctx.reply('Qarz yopish funksiyasi tayyorlanmoqda...');
    session.state = 'shop_owner_menu';
  }

  // src/bot/handlers/shop-owner.handlers.ts

  async showDebtors(ctx: Context, session: SessionData) {
    const debtors = await this.prisma.debt.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' }, // oxirgilari tepada chiqadi
    });

    if (debtors.length === 0) {
      await ctx.reply('📭 Hozircha qarzdorlar yo‘q.');
      return;
    }

    let message = '📋 Qarzdorlar ro‘yxati:\n\n';
    debtors.forEach((d, i) => {
      message += `   🛒 Nima olgan: ${d.note}\n`;
      message += `   💰 Qarzdorlik: ${d.amount} so‘m\n\n`;
    });

    await ctx.reply(message);
  }

  // 🔹 Qarzdor qo‘shishni boshlash
  async startAddDebtor(ctx: Context, session: SessionData) {
    session.state = 'adding_debtor_name';
    session.newDebtorName = undefined;
    session.newDebtorPhone = undefined;

    await ctx.reply(
      'Yangi qarzdor ismini kiriting:',
      Markup.keyboard([['❌ Bekor qilish']]).resize(),
    );
  }

  // 🔹 Qarzdor qo‘shish jarayoni
  async handleAddDebtor(ctx: Context, session: SessionData) {
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = ctx.message.text.trim();

    if (text === '❌ Bekor qilish') {
      session.state = 'shop_owner_menu';
      return this.showMenu(ctx, session);
    }

    switch (session.state) {
      case 'adding_debtor_name':
        session.newDebtorName = text;
        session.state = 'adding_debtor_phone';
        await ctx.reply('Qarzdor telefon raqamini kiriting (+998XXXXXXXXX):');
        break;

      case 'adding_debtor_phone':
        let phone = text;
        if (phone.startsWith('0')) phone = '+998' + phone.slice(1);
        if (!phone.startsWith('+')) phone = '+' + phone;

        if (!/^\+998\d{9}$/.test(phone)) {
          await ctx.reply(
            '❌ Telefon noto‘g‘ri formatda. +998XXXXXXXXX ko‘rinishda kiriting:',
          );
          return;
        }

        // Qarzdorni DB ga yozamiz
        const shopOwner = await this.prisma.user.findFirst({
          where: { phone: session.phone },
        });
        if (!shopOwner?.shopId) {
          await ctx.reply('❌ Sizning shopingiz topilmadi');
          return this.showMenu(ctx, session);
        }

        await this.prisma.debtor.create({
          data: {
            name: session.newDebtorName ?? '',
            phone,
            shopId: shopOwner.shopId,
          },
        });

        await ctx.reply(`✅ Qarzdor "${session.newDebtorName}" qo‘shildi`);
        session.state = 'shop_owner_menu';
        await this.showMenu(ctx, session);
        break;
    }
  }
}
