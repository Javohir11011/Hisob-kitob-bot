// src/bot/bot.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/core/prisma.service';
import { Context, Telegraf } from 'telegraf';
import LocalSession from 'telegraf-session-local';
import { AuthHandler } from './handlers/auth.handlers';
import { DebtorLoginHandler } from './handlers/debtor-login.handlers';
import { DebtorHandler } from './handlers/debtor.handlers';
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
    private debtorLoginHandler: DebtorLoginHandler,
    private debtorHandler: DebtorHandler,
    private shopOwnerHandler: ShopOwnerHandler,
    private superAdminHandler: SuperAdminHandler,
  ) {
    const token = this.config.get<string>('BOT_TOKEN');
    if (!token) throw new Error('❌ BOT_TOKEN .env faylida topilmadi!');

    this.bot = new Telegraf(token);

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

    this.bot.command('login_debtor', async (ctx) => {
      try {
        const session = ctx.session as SessionData;
        await this.debtorLoginHandler.startLogin(ctx, session);
      } catch (err) {
        console.error('❌ Debtor login error:', err);
      }
    });

    // --- TEXT HANDLER ---
    this.bot.on(['text'], async (ctx) => {
      const session = ctx.session as SessionData;
      if (!ctx.message || !('text' in ctx.message)) return;
      const text = ctx.message.text.trim();

      try {
        // 🔹 1️⃣ DEBTOR login steps
        if (
          ['debtor_login_password', 'debtor_login_phone'].includes(
            session.state ?? '',
          )
        ) {
          if (session.state === 'debtor_login_password')
            return this.debtorLoginHandler.handlePassword(ctx, session);
          if (session.state === 'debtor_login_phone')
            return this.debtorLoginHandler.handlePhone(ctx, session);
        }

        // 🔹 2️⃣ DEBTOR main menu
        if (session.role === 'DEBTOR') {
          const debtorMenuStates = ['debtor_menu', 'debtor_main_menu'];
          if (debtorMenuStates.includes(session.state ?? '')) {
            return this.debtorHandler.handleText(ctx, session);
          }
        }

        // 🔹 3️⃣ Normal user login steps (SHOP_OWNER / SUPER_ADMIN)
        if (
          ['awaiting_password', 'awaiting_phone'].includes(session.state ?? '')
        ) {
          if (session.state === 'awaiting_password')
            return this.authHandler.handlePassword({ ctx, session });
          if (session.state === 'awaiting_phone')
            return this.authHandler.handleContact(ctx, session);
        }

        // 🔹 4️⃣ Super Admin states
        const superAdminStates = [
          'super_admin_menu',
          'adding_owner_name',
          'adding_owner_phone',
          'adding_owner_password',
          'adding_owner_shop',
          'adding_owner_shop_address',
          'updating_owner_field',
          'search_owner',
        ];

        if (superAdminStates.includes(session.state ?? ''))
          return this.superAdminHandler.handleText(ctx, session);

        // 🔹 5️⃣ Shop Owner / Helper states
        if (['SHOP_OWNER', 'SHOP_HELPER'].includes(session.role ?? '')) {
          const shopStates = [
            'shop_owner_menu',
            'shop_owner_profile',
            'adding_helper_name',
            'adding_helper_phone',
            'adding_helper_password',
            'adding_debtor_name',
            'adding_debtor_phone',
            'adding_debtor_address',
            'adding_debt_amount',
            'adding_debt_note',
            'debtor_menu',
            'searching_debtor',
            'search_debtor_for_debt',
          ];

          if (shopStates.includes(session.state ?? ''))
            return this.shopOwnerHandler.handleText(ctx, session);
        }

        // 🔹 6️⃣ Agar session.state aniqlanmagan bo‘lsa → role bo‘yicha menu
        if (!session.phone) return;

        const user = await this.prisma.user.findFirst({
          where: { phone: session.phone },
        });
        if (!user) return;

        session.role = user.role as SessionData['role'];

        if (user.role === 'SUPER_ADMIN') {
          session.state = 'super_admin_menu';
          await this.superAdminHandler.showMenu(ctx, session);
        } else if (['SHOP_OWNER', 'SHOP_HELPER'].includes(user.role)) {
          session.state = 'shop_owner_menu';
          await this.shopOwnerHandler.showMenu(ctx, session);
        }
      } catch (err) {
        console.error('❌ text handler error:', err);
      }
    });

    // --- CONTACT HANDLER ---
    this.bot.on('contact', async (ctx) => {
      try {
        const session = ctx.session as SessionData;

        // Agar DEBTOR login state bo‘lsa
        if (session.state === 'debtor_login_phone')
          return this.debtorLoginHandler.handlePhone(ctx, session);

        // Agar user login state bo‘lsa
        if (session.state === 'awaiting_phone')
          return this.authHandler.handleContact(ctx, session);
      } catch (err) {
        console.error('❌ contact error:', err);
      }
    });

    // --- CALLBACK QUERY ---
    this.bot.on('callback_query', async (ctx: any) => {
      try {
        const session = ctx.session as SessionData;
        // Shop owner callback
        await this.shopOwnerHandler.handleCallbackQuery(ctx, session);
        // Super admin callback
        await this.superAdminHandler.handleCallbackQuery(ctx, session);
      } catch (err) {
        console.error('❌ callback_query error:', err);
      }
    });

    this.bot.action(/all_debts_(.+)/, async (ctx) => {
      const debtorId = ctx.match[1];
      await this.shopOwnerHandler.showAllDebts(ctx, debtorId);
      await ctx.answerCbQuery();
    });

    // Update
    // this.bot.action(/update_debtor_(.+)/, async (ctx) => {
    //   const debtorId = ctx.match[1];
    //   await this.shopOwnerHandler.startEditDebtor(ctx, debtorId, ctx.session);
    //   await ctx.answerCbQuery();
    // });

    // Delete
    this.bot.action(/delete_debtor_(.+)/, async (ctx) => {
      const debtorId = ctx.match[1];
      await this.shopOwnerHandler.deleteDebtor(ctx, debtorId);
      await ctx.answerCbQuery();
    });
  }
}
