// src/bot/bot.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/core/prisma.service';
import { Context, Telegraf } from 'telegraf';
import LocalSession from 'telegraf-session-local';
import { AuthHandler } from './handlers/auth.handlers';
import { ShopOwnerHandler } from './handlers/shop-owner.handlers';
import { SuperAdminHandler } from './handlers/super-admin.handler';
import { SessionData } from './states/session.data';

@Injectable()
export class BotService implements OnModuleInit {
  private bot: Telegraf<Context>;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private authHandler: AuthHandler,
    private superAdminHandler: SuperAdminHandler,
    private shopOwnerHandler: ShopOwnerHandler,
  ) {
    const token = this.config.get<string>('BOT_TOKEN');
    if (!token) throw new Error('❌ BOT_TOKEN .env faylida topilmadi!');

    this.bot = new Telegraf(token);

    // 🔹 Local session
    const localSession = new LocalSession<SessionData>({
      database: 'session_db.json',
      property: 'session',
      storage: LocalSession.storageFileAsync,
    });
    this.bot.use(localSession.middleware());
  }

  onModuleInit() {
    this.setupCommands();
    this.bot.launch();
    console.log('✅ Bot ishga tushdi');

    // Graceful shutdown
    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }

  private setupCommands() {
    // --- START ---
    this.bot.start(async (ctx) => {
      try {
        await this.authHandler.start(ctx);
      } catch (err) {
        console.error('❌ start error:', err);
      }
    });

    // --- LOGIN ---
    this.bot.command('login', async (ctx) => {
      try {
        await this.authHandler.login(ctx, ctx.session as SessionData);
      } catch (err) {
        console.error('❌ login error:', err);
      }
    });

    // --- TEXT HANDLER ---
    this.bot.on('text', async (ctx) => {
      const session = ctx.session as SessionData;
      const text = 'text' in ctx.message ? ctx.message.text.trim() : undefined;
      if (!text) return;

      try {
        switch (session.state) {
          // 🔹 Login steps
          case 'awaiting_password':
            return this.authHandler.handlePassword({ ctx, session });
          case 'awaiting_phone':
            return this.authHandler.handleContact(ctx, session);

          // 🔹 Add owner / Update owner states
          case 'adding_owner_name':
          case 'adding_owner_phone':
          case 'adding_owner_password':
          case 'adding_owner_shop':
          case 'adding_owner_shop_address':
          case 'updating_owner_field':
            if (text === '❌ Bekor qilish') {
              session.state = 'super_admin_menu';
              await this.superAdminHandler.showMenu(ctx, session);
              return;
            }
            return this.superAdminHandler.handleAddOwner(ctx, session);

          // 🔹 Search owner
          case 'search_owner':
            if (text === '❌ Bekor qilish') {
              session.state = 'super_admin_menu';
              await this.superAdminHandler.showMenu(ctx, session);
              return;
            }
            return this.superAdminHandler.handleSearchOwner(ctx, session);

          // 🔹 Super Admin menu
          case 'super_admin_menu':
            return this.superAdminHandler.handleMenu(ctx, session);

          // 🔹 Shop Owner states
          case 'shop_owner_menu':
          case 'shop_owner_profile':
          case 'adding_helper_name':
          case 'adding_helper_phone':
          case 'adding_helper_password':
          case 'adding_debt_name':
          case 'adding_debt_amount':
          case 'paying_debt_name':
          case 'paying_debt_amount':
            return this.shopOwnerHandler.handleText(ctx, session);

          // 🔹 Debtor qo‘shish states
          case 'adding_debtor_name':
          case 'adding_debtor_phone':
          case 'adding_debtor_address':
            return this.shopOwnerHandler.handleAddDebtor(ctx, session);

          // 🔹 Qarz qo‘shish states (❌ SENDA YO‘Q EDI)
          case 'search_debtor_for_debt':
            return this.shopOwnerHandler.handleSearchDebtorForDebt(
              ctx,
              session,
            );
          case 'adding_debt_note':
            return this.shopOwnerHandler.handleAddDebtAmountAndNote(
              ctx,
              session,
            );

          default:
            // Agar state aniqlanmagan bo‘lsa → roli bo‘yicha menyu
            if (!session.phone) return;
            const user = await this.prisma.user.findFirst({
              where: { phone: session.phone },
            });
            if (!user) return;

            if (user.role === 'SUPER_ADMIN') {
              session.state = 'super_admin_menu';
              await this.superAdminHandler.showMenu(ctx, session);
            } else if (user.role === 'SHOP_OWNER') {
              session.state = 'shop_owner_menu';
              await this.shopOwnerHandler.showMenu(ctx, session);
            }
            break;
        }
      } catch (err) {
        console.error('❌ text handler error:', err);
      }
    });

    // --- CONTACT HANDLER ---
    this.bot.on('contact', async (ctx) => {
      try {
        await this.authHandler.handleContact(ctx, ctx.session as SessionData);
      } catch (err) {
        console.error('❌ contact error:', err);
      }
    });

    // --- SUPER ADMIN ACTIONS ---
    this.bot.action(/stats_page_(\d+)/, async (ctx: any) => {
      try {
        const page = parseInt(ctx.match[1], 10);
        await this.superAdminHandler.showStatistics(ctx, page);
      } catch (err) {
        console.error('❌ stats_page error:', err);
      }
    });

    this.bot.action(/delete_owner_(.+)/, async (ctx: any) => {
      try {
        const ownerId = ctx.match[1];
        if (!ownerId) return ctx.answerCbQuery('Owner topilmadi ❌');

        const owner = await this.prisma.user.findUnique({
          where: { id: ownerId },
        });
        if (!owner) return ctx.answerCbQuery('Owner topilmadi ❌');

        await this.prisma.user.delete({ where: { id: ownerId } });
        await ctx.editMessageText(`✅ ${owner.name} o‘chirildi`);
        await ctx.answerCbQuery('Owner muvaffaqiyatli o‘chirildi ✅');
      } catch (err) {
        console.error('❌ delete_owner error:', err);
      }
    });

    this.bot.action(/update_owner_(.+)/, async (ctx: any) => {
      try {
        const ownerId = ctx.match[1];
        const session = ctx.session as SessionData;
        await this.superAdminHandler.handleUpdateOwner(ctx, session, ownerId);
      } catch (err) {
        console.error('❌ update_owner error:', err);
      }
    });

    this.bot.action(/update_field_(.+)/, async (ctx: any) => {
      try {
        const session = ctx.session as SessionData;
        const fieldMap = { name: 'name', phone: 'phone', shop: 'shop' };
        const fieldKey = ctx.match[1];
        session.updateField = fieldMap[fieldKey] as 'name' | 'phone' | 'shop';
        session.state = 'updating_owner_field';
        await ctx.reply('Yangi qiymatni kiriting:');
      } catch (err) {
        console.error('❌ update_field error:', err);
      }
    });

    this.bot.action(/update_cancel/, async (ctx: any) => {
      try {
        const session = ctx.session as SessionData;
        session.state = 'super_admin_menu';
        session.tempOwnerId = undefined;
        session.updateField = undefined;
        await ctx.answerCbQuery('Bekor qilindi ❌');
        await this.superAdminHandler.showMenu(ctx, session);
      } catch (err) {
        console.error('❌ update_cancel error:', err);
      }
    });
    this.bot.action(/select_debtor_(.+)/, async (ctx: any) => {
      const debtorId = ctx.match[1];
      const session = ctx.session as SessionData;

      session.tempDebtorId = debtorId;
      session.state = 'adding_debt_amount';

      const debtor = await this.prisma.debtor.findUnique({
        where: { id: debtorId },
      });

      await ctx.editMessageText(
        `👤 Qarzdor tanlandi:\n\nIsm: ${debtor?.name}\n📞 ${debtor?.phone ?? 'yo‘q'}\n🏠 ${debtor?.address ?? 'yo‘q'}\n\n💰 Endi qarz summasini kiriting:`,
      );

      await ctx.reply('💰 Qarz summasini kiriting:', {
        reply_markup: {
          keyboard: [['❌ Bekor qilish']],
          resize_keyboard: true,
        },
      });
    });
  }
}
