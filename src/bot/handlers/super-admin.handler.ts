import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Context, Markup, Context as TelegrafContext } from 'telegraf';
import { PrismaService } from '../../core/prisma.service';
import { SessionData } from '../states/session.data';

@Injectable()
export class SuperAdminHandler {
  constructor(private prisma: PrismaService) {}

  // 🔹 Asosiy menyu
  async showMenu(ctx: Context, session: SessionData) {
    session.state = 'super_admin_menu';
    await ctx.reply(
      'Asosiy menyudan birini tanlang:',
      Markup.keyboard([
        ['📊 Statistika', '➕ Add Shop Owner'],
        ['⚙️ Sozlamalar', '🔍 Search Owner'],
        ['👤 Profil'],
      ])
        .resize()
        .persistent(),
    );
  }

  // 🔹 Menyudan tanlash
  async handleMenu(ctx: Context, session: SessionData) {
    if (session.state !== 'super_admin_menu') return;

    if (!ctx.message || !('text' in ctx.message)) return;
    const text = (ctx.message as { text: string }).text.trim();

    switch (text) {
      case '📊 Statistika':
        await this.showStatistics(ctx);
        break;

      case '➕ Add Shop Owner':
        session.state = 'adding_owner_name';
        session.newOwnerName = undefined;
        session.newOwnerPhone = undefined;
        session.newOwnerPassword = undefined;
        session.newOwnerShop = undefined;
        session.newOwnerShopAddress = undefined;

        await ctx.reply(
          'Yangi shop owner ismini kiriting:',
          Markup.keyboard([['❌ Bekor qilish']]).resize(),
        );
        break;

      case '⚙️ Sozlamalar':
        session.state = 'updating_own_info';
        await ctx.reply(
          'Qaysi maydonni o‘zgartirmoqchisiz?',
          Markup.keyboard([
            ['👤 Ism', '📞 Telefon', '🔑 Parol'],
            ['❌ Bekor qilish'],
          ]).resize(),
        );
        break;

      case '👤 Profil':
        await this.showProfile(ctx, session);
        break;

      case '🔍 Search Owner':
        session.state = 'search_owner';
        await ctx.reply(
          'Qidirish uchun Shop Owner ismi yoki telefon raqamini kiriting:',
          Markup.keyboard([['❌ Bekor qilish']]).resize(),
        );
        break;

      default:
        await ctx.reply('Iltimos, menyudan tugma tanlang.');
    }
  }

  async handleText(ctx: TelegrafContext, session: SessionData): Promise<void> {
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = ctx.message.text.trim();

    switch (session.state) {
      case 'super_admin_menu':
        return this.handleMenu(ctx, session);

      case 'adding_owner_name':
      case 'adding_owner_phone':
      case 'adding_owner_password':
      case 'adding_owner_shop':
      case 'adding_owner_shop_address':
        return this.handleAddOwner(ctx, session);

      case 'updating_own_info':
        if (text === '❌ Bekor qilish') {
          session.state = 'super_admin_menu';
          return this.showMenu(ctx, session);
        }
        if (text === '👤 Ism') {
          session.state = 'updating_own_name';
          await ctx.reply('Yangi ismingizni kiriting:');
        }
        if (text === '📞 Telefon') {
          session.state = 'updating_own_phone';
          await ctx.reply(
            'Yangi telefon raqamingizni kiriting (+998XXXXXXXXX):',
          );
        }
        if (text === '🔑 Parol') {
          session.state = 'updating_own_password';
          await ctx.reply('Yangi parolni kiriting:');
        }
        break;

      case 'updating_own_name':
        await this.prisma.user.update({
          where: { phone: session.phone },
          data: { name: text },
        });
        session.state = 'super_admin_menu';
        await ctx.reply(`✅ Ismingiz "${text}" ga o‘zgartirildi`);
        return this.showMenu(ctx, session);

      case 'updating_own_phone':
        let phone = text.startsWith('0') ? '+998' + text.slice(1) : text;
        if (!phone.startsWith('+')) phone = '+' + phone;
        if (!/^\+998\d{9}$/.test(phone)) {
          await ctx.reply('❌ Telefon noto‘g‘ri formatda. Qayta kiriting.');
        }
        await this.prisma.user.update({
          where: { phone: session.phone },
          data: { phone },
        });
        session.phone = phone;
        session.state = 'super_admin_menu';
        await ctx.reply(`✅ Telefon raqamingiz o‘zgartirildi: ${phone}`);
        return this.showMenu(ctx, session);

      case 'updating_own_password':
        const hashed = await bcrypt.hash(text, 10);
        await this.prisma.user.update({
          where: { phone: session.phone },
          data: { password: hashed },
        });
        session.state = 'super_admin_menu';
        await ctx.reply('✅ Parolingiz yangilandi');
        return this.showMenu(ctx, session);
    }
  }
  // 🔹 Shop Owner qo‘shish jarayoni
  async handleAddOwner(ctx: Context, session: SessionData) {
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = (ctx.message as { text: string }).text.trim();

    if (!text) return;

    if (text === '❌ Bekor qilish') {
      await this.showMenu(ctx, session);
      return;
    }

    switch (session.state) {
      case 'adding_owner_name':
        session.newOwnerName = text;
        session.state = 'adding_owner_phone';
        await ctx.reply(
          'Telefon raqamini kiriting. Format:\n+998XXXXXXXXX (O‘zbekiston) yoki +7XXXXXXXXXX (Rossiya)',
          Markup.keyboard([['❌ Bekor qilish']]).resize(),
        );
        break;

      case 'adding_owner_phone':
        let phone = text;

        if (phone.startsWith('0')) phone = '+998' + phone.slice(1);
        if (!phone.startsWith('+')) phone = '+' + phone;

        if (!/^\+998\d{9}$/.test(phone) && !/^\+7\d{10}$/.test(phone)) {
          await ctx.reply(
            '❌ Telefon raqam noto‘g‘ri formatda.\n+998XXXXXXXXX yoki +7XXXXXXXXXX',
          );
          return;
        }

        const exists = await this.prisma.user.findFirst({ where: { phone } });
        if (exists) {
          await ctx.reply(
            '❌ Bu raqam allaqachon mavjud. Boshqa raqam kiriting.',
          );
          return;
        }

        session.newOwnerPhone = phone;
        session.state = 'adding_owner_password';
        await ctx.reply(
          'Shop owner uchun parol kiriting:',
          Markup.keyboard([['❌ Bekor qilish']]).resize(),
        );
        break;

      case 'adding_owner_password':
        session.newOwnerPassword = text;
        session.state = 'adding_owner_shop';
        await ctx.reply(
          'Shop ownerning dokon nomini kiriting:',
          Markup.keyboard([['❌ Bekor qilish']]).resize(),
        );
        break;

      case 'adding_owner_shop':
        session.newOwnerShop = text;
        session.state = 'adding_owner_shop_address';
        await ctx.reply(
          'Dokon manzilini kiriting:',
          Markup.keyboard([['❌ Bekor qilish']]).resize(),
        );
        break;

      case 'adding_owner_shop_address':
        session.newOwnerShopAddress = text || '';

        const shop = await this.prisma.shop.create({
          data: {
            name: session.newOwnerShop ?? '',
            address: session.newOwnerShopAddress,
          },
        });

        await this.prisma.user.create({
          data: {
            name: session.newOwnerName ?? '',
            phone: session.newOwnerPhone ?? '',
            password: await bcrypt.hash(session.newOwnerPassword ?? '', 10),
            role: 'SHOP_OWNER',
            shopId: shop.id,
            telegramId: null,
          },
        });

        await ctx.reply(
          `✅ Yangi shop owner "${session.newOwnerName}" va dokoni "${shop.name}" qo‘shildi.`,
        );

        await this.showMenu(ctx, session);
        break;
    }
  }

  // 🔹 Statistika
  async showStatistics(ctx: Context, page = 1) {
    const pageSize = 5;
    const skip = (page - 1) * pageSize;

    const owners = await this.prisma.user.findMany({
      where: { role: 'SHOP_OWNER' },
      include: { shop: true, debts: true },
      skip,
      take: pageSize,
      orderBy: { name: 'asc' },
    });

    if (!owners.length) {
      await ctx.reply('❌ Hozircha hech qanday shop owner mavjud emas.');
      return;
    }

    let message = `📊 Shop Ownerlar statistikasi (sahifa ${page}):\n\n`;

    for (const owner of owners) {
      const totalDebt = owner.debts?.reduce((sum, d) => sum + d.amount, 0) ?? 0;
      message += `👤 Ism: ${owner.name}\n📞 Tel: ${owner.phone}\n🏬 Dokon: ${owner.shop?.name ?? '-'}\n🕒 Ro‘yxatdan o‘tgan: ${owner.createdAt.toLocaleString()}\n💰 Umumiy qarz: ${totalDebt}\n\n`;
    }

    const totalOwners = await this.prisma.user.count({
      where: { role: 'SHOP_OWNER' },
    });
    const totalPages = Math.ceil(totalOwners / pageSize);

    const buttons: any[] = [];
    if (page > 1)
      buttons.push(
        Markup.button.callback('⬅️ Orqaga', `stats_page_${page - 1}`),
      );
    if (page < totalPages)
      buttons.push(
        Markup.button.callback('➡️ Keyingi', `stats_page_${page + 1}`),
      );

    await ctx.reply(
      message,
      buttons.length ? Markup.inlineKeyboard([buttons]) : undefined,
    );
  }

  // 🔹 Profil
  async showProfile(ctx: Context, session: SessionData) {
    if (!session.phone) {
      await ctx.reply(
        '❌ Profil ma’lumotlarini ko‘rish uchun avval login qiling.',
      );
      return;
    }

    const user = await this.prisma.user.findFirst({
      where: { phone: session.phone },
    });
    if (!user) {
      await ctx.reply('❌ Foydalanuvchi topilmadi.');
      return;
    }

    const message = `👤 Ism: ${user.name}\n📞 Telefon: ${user.phone}\n🛡️ Roli: ${user.role}\n🕒 Ro‘yxatdan o‘tgan: ${user.createdAt.toLocaleString()}`;
    await ctx.reply(message);
  }

  // 🔹 Search Owner
  async handleSearchOwner(ctx: Context, session: SessionData) {
    if (session.state !== 'search_owner') return;

    if (!ctx.message || !('text' in ctx.message)) return;
    const text = (ctx.message as { text: string }).text.trim();

    if (!text) return;

    if (text === '❌ Bekor qilish') {
      session.state = 'super_admin_menu';
      await this.showMenu(ctx, session);
      return;
    }

    const owners = await this.prisma.user.findMany({
      where: {
        role: 'SHOP_OWNER',
        OR: [
          { name: { contains: text, mode: 'insensitive' } },
          { phone: { contains: text } },
        ],
      },
      include: { shop: true, debts: true },
    });

    if (!owners.length) {
      await ctx.reply('❌ Hech qanday mos keladigan Shop Owner topilmadi.');
      return;
    }

    for (const owner of owners) {
      const totalDebt = owner.debts?.reduce((sum, d) => sum + d.amount, 0) ?? 0;
      const message = `👤 Ism: ${owner.name}\n📞 Tel: ${owner.phone}\n🏬 Dokon: ${owner.shop?.name ?? '-'}\n💰 Umumiy qarz: ${totalDebt}`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('🗑 Delete', `delete_owner_${owner.id}`),
          Markup.button.callback('✏️ Update', `update_owner_${owner.id}`),
        ],
      ]);

      await ctx.reply(message, keyboard);
    }

    await ctx.reply(
      'Qidiruvni bekor qilish uchun:',
      Markup.keyboard([['❌ Bekor qilish']]).resize(),
    );
  }

  // 🔹 Callback query (Delete / Update / Update Field)
  async handleCallbackQuery(ctx: any, session: SessionData) {
    const data = ctx.callbackQuery?.data;
    if (!data) return;

    // Delete owner
    if (data.startsWith('delete_owner_')) {
      const ownerId = data.replace('delete_owner_', '');
      await this.prisma.user.delete({ where: { id: ownerId } });
      await ctx.answerCbQuery('✅ Owner o‘chirildi');
      await ctx.editMessageReplyMarkup(undefined); // inline tugmalarni olib tashlash
      return;
    }

    // Update owner start
    if (data.startsWith('update_owner_')) {
      const ownerId = data.replace('update_owner_', '');
      session.tempOwnerId = ownerId;
      session.state = 'updating_owner_field';
      await ctx.answerCbQuery('✏️ Yangilash jarayoni boshlandi');
      await ctx.reply(
        'Yangilamoqchi bo‘lgan maydonni tanlang:',
        Markup.inlineKeyboard([
          [Markup.button.callback('👤 Ism', 'update_field_name')],
          [Markup.button.callback('📞 Telefon', 'update_field_phone')],
          [Markup.button.callback('🏬 Dokon', 'update_field_shop')],
          [Markup.button.callback('❌ Bekor qilish', 'update_field_cancel')],
        ]),
      );
      return;
    }

    // Update field selection
    if (data.startsWith('update_field_')) {
      if (!session.tempOwnerId) {
        await ctx.answerCbQuery('❌ Owner tanlanmagan');
        return;
      }

      const field = data.replace('update_field_', '');
      if (field === 'cancel') {
        session.state = 'super_admin_menu';
        session.tempOwnerId = undefined;
        session.updateField = undefined;
        await ctx.answerCbQuery('❌ Yangilash bekor qilindi');
        return;
      }

      session.updateField = field; // name, phone, shop
      session.state = 'updating_owner_field';
      await ctx.answerCbQuery(`✏️ ${field} yangilash uchun matn kiriting`);
    }
  }

  // 🔹 Saqlash (update_field)
  async saveOwnerField(ctx: Context, session: SessionData) {
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = (ctx.message as { text: string }).text.trim();

    if (!session.tempOwnerId || !session.updateField) return;

    const ownerId = session.tempOwnerId;
    const field = session.updateField;

    if (field === 'shop') {
      let shop = await this.prisma.shop.findFirst({ where: { name: text } });
      if (!shop) shop = await this.prisma.shop.create({ data: { name: text } });
      await this.prisma.user.update({
        where: { id: ownerId },
        data: { shopId: shop.id },
      });
    } else {
      await this.prisma.user.update({
        where: { id: ownerId },
        data: { [field]: text },
      });
    }

    await ctx.reply('✅ Owner ma’lumotlari yangilandi');

    session.state = 'super_admin_menu';
    session.tempOwnerId = undefined;
    session.updateField = undefined;

    await this.showMenu(ctx, session);
  }
}
