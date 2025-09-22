import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Context, Markup } from 'telegraf';
import { PrismaService } from '../../core/prisma.service';
import { SessionData } from '../states/session.data';

@Injectable()
export class SuperAdminHandler {
  constructor(private prisma: PrismaService) {}

  // 🔹 Asosiy menyuni ko'rsatish
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

    const text =
      ctx.message &&
      'text' in ctx.message &&
      typeof ctx.message.text === 'string'
        ? ctx.message.text.trim()
        : undefined;

    console.log('Menu tugmasi:', text);

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
        await ctx.reply('⚙️ Sozlamalar hali tayyor emas.');
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

  // 🔹 Add Owner jarayoni
  async handleAddOwner(ctx: Context, session: SessionData) {
    const text =
      ctx.message &&
      'text' in ctx.message &&
      typeof ctx.message.text === 'string'
        ? ctx.message.text.trim()
        : undefined;

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
          'Telefon raqamini kiriting (+998XXXXXXXXX):',
          Markup.keyboard([['❌ Bekor qilish']]).resize(),
        );
        break;

      case 'adding_owner_phone':
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
          'Dokon manzilini kiriting (agar bo‘lmasa bo‘sh qoldiring):',
          Markup.keyboard([['❌ Bekor qilish']]).resize(),
        );
        break;

      case 'adding_owner_shop_address':
        session.newOwnerShopAddress = text || '';

        // Dokon yaratish
        const shop = await this.prisma.shop.create({
          data: {
            name: session.newOwnerShop ?? '',
            address: session.newOwnerShopAddress,
          },
        });

        // Owner yaratish
        await this.prisma.user.create({
          data: {
            name: session.newOwnerName ?? '',
            phone: session.newOwnerPhone ?? '',
            password: await bcrypt.hash(session.newOwnerPassword ?? '', 10),
            role: 'SHOP_OWNER',
            shopId: shop.id,
          },
        });

        await ctx.reply(
          `Yangi shop owner "${session.newOwnerName}" va dokoni "${shop.name}" qo‘shildi ✅`,
        );

        await this.showMenu(ctx, session);
        break;
    }
  }

  // 🔹 Statistika
  async showStatistics(ctx: Context, page = 1) {
    const pageSize = 10;
    const skip = (page - 1) * pageSize;

    const owners = await this.prisma.user.findMany({
      where: { role: 'SHOP_OWNER' },
      include: { shop: true, debts: true },
      skip,
      take: pageSize,
      orderBy: { name: 'asc' },
    });

    if (!owners.length) {
      await ctx.reply('Hozircha hech qanday shop owner mavjud emas.');
      return;
    }

    let message = `📊 Shop Ownerlar statistikasi (sahifa ${page}):\n\n`;

    for (const owner of owners) {
      const totalDebt = owner.debts?.reduce((sum, d) => sum + d.amount, 0) ?? 0;
      message += `👤 Ism: ${owner.name}\n`;
      message += `📞 Tel: ${owner.phone}\n`;
      message += `🏬 Dokon: ${owner.shop?.name ?? '-'}\n`;
      message += `🕒 Ro‘yxatdan o‘tgan: ${owner.createdAt.toLocaleString()}\n`;
      message += `💰 Umumiy qarz: ${totalDebt}\n\n`;
    }

    const totalOwners = await this.prisma.user.count({
      where: { role: 'SHOP_OWNER' },
    });

    // Tugmalar
    const buttons: Array<Array<ReturnType<typeof Markup.button.callback>>> = [];
    const row: Array<ReturnType<typeof Markup.button.callback>> = [];

    if (page > 1)
      row.push(Markup.button.callback('⬅️ Orqaga', `stats_page_${page - 1}`));
    const totalPages = Math.ceil(totalOwners / pageSize);
    if (page < totalPages)
      row.push(Markup.button.callback('➡️ Keyingi', `stats_page_${page + 1}`));
    if (row.length) buttons.push(row);

    await ctx.reply(
      message,
      buttons.length ? Markup.inlineKeyboard(buttons) : undefined,
    );
  }

  async showProfile(ctx: Context, session: SessionData) {
    if (!session.phone) {
      await ctx.reply(
        'Profil ma’lumotlarini ko‘rish uchun avval login qilishingiz kerak.',
      );
      return;
    }

    // Super adminni telefon raqamiga qarab topamiz
    const user = await this.prisma.user.findFirst({
      where: { phone: session.phone },
    });

    if (!user) {
      await ctx.reply('Foydalanuvchi topilmadi.');
      return;
    }

    // Profil xabarini tayyorlash
    const message = `
👤 Ism: ${user.name}
📞 Telefon: ${user.phone}
🛡️ Roli: ${user.role}
🕒 Ro‘yxatdan o‘tgan: ${user.createdAt.toLocaleString()}
`;

    await ctx.reply(message);
  }

  // /menu komandasi
  async handleMenuCommand(ctx: Context, session: SessionData) {
    await this.showMenu(ctx, session);
  }

  // Search Owner (Delete + Update tugmalar bilan)
  async handleSearchOwner(ctx: Context, session: SessionData) {
    if (session.state !== 'search_owner') return;

    const text =
      ctx.message &&
      'text' in ctx.message &&
      typeof ctx.message.text === 'string'
        ? ctx.message.text.trim()
        : undefined;
    if (!text) return;

    if (text === '❌ Bekor qilish') {
      await this.showMenu(ctx, session);
      session.state = 'super_admin_menu';
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
      await ctx.reply('Hech qanday mos keladigan Shop Owner topilmadi.');
      return;
    }

    for (const owner of owners) {
      const totalDebt = owner.debts?.reduce((sum, d) => sum + d.amount, 0) ?? 0;
      const message = `👤 Ism: ${owner.name ?? '-'}\n📞 Tel: ${owner.phone ?? '-'}\n🏬 Dokon: ${owner.shop?.name ?? '-'}\n💰 Umumiy qarz: ${totalDebt}`;

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

  // Update jarayoni boshlanishi
  async handleUpdateOwner(ctx: Context, session: SessionData, ownerId: string) {
    session.tempOwnerId = ownerId;
    session.state = 'updating_owner';
    await ctx.reply(
      'Yangilamoqchi bo‘lgan maydonni tanlang:',
      Markup.inlineKeyboard([
        [Markup.button.callback('👤 Ism', 'update_field_name')],
        [Markup.button.callback('📞 Telefon', 'update_field_phone')],
        [Markup.button.callback('🏬 Dokon', 'update_field_shop')],
        [Markup.button.callback('❌ Bekor qilish', 'update_cancel')],
      ]),
    );
  }
  
  async saveOwnerField(ctx: Context, session: SessionData) {
    if (!ctx.message || !('text' in ctx.message)) return;
    if (!session.tempOwnerId || !session.updateField) return;

    const text = ctx.message.text.trim();
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

    // ✅ Ma’lumot yangilandi
    await ctx.reply('✅ Owner ma’lumotlari yangilandi');

    // Sessionni tozalaymiz
    session.state = 'super_admin_menu';
    session.tempOwnerId = undefined;
    session.updateField = undefined;

    // Birdaniga super admin menyusini ko‘rsatamiz
    await this.showMenu(ctx, session);
  }
}
