import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/core/prisma.service';
import { Context, Telegraf } from 'telegraf';
import LocalSession from 'telegraf-session-local';
import { AuthHandler } from './handlers/auth.handlers';
import { SuperAdminHandler } from './handlers/super-admin.handler';
import { SessionData } from './states/session.data';

@Injectable()
export class BotService implements OnModuleInit {
  private bot: Telegraf<Context>;

  constructor(
    private config: ConfigService,
    private authHandler: AuthHandler,
    private superAdminHandler: SuperAdminHandler,
    private prisma: PrismaService,
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
  }

  private setupCommands() {
    // --- START ---
    this.bot.start((ctx) => this.authHandler.start(ctx));

    // --- LOGIN ---
    this.bot.command('login', (ctx) =>
      this.authHandler.login(ctx, ctx.session as SessionData),
    );

    // --- TEXT HANDLER (Barcha state lar) ---
    this.bot.on('text', async (ctx) => {
      const session = ctx.session as SessionData;
      const text =
        ctx.message &&
        'text' in ctx.message &&
        typeof ctx.message.text === 'string'
          ? ctx.message.text.trim()
          : undefined;
      if (!text) return;

      switch (session.state) {
        case 'awaiting_password':
          return this.authHandler.handlePassword({ ctx, session });
        case 'awaiting_phone':
          return this.authHandler.handleContact(ctx, session);
        case 'search_owner':
          return this.superAdminHandler.handleSearchOwner(ctx, session);
        case 'super_admin_menu':
          return this.superAdminHandler.handleMenu(ctx, session);
        case 'adding_owner_name':
        case 'adding_owner_phone':
        case 'adding_owner_password':
        case 'adding_owner_shop':
        case 'adding_owner_shop_address':
          return this.superAdminHandler.handleAddOwner(ctx, session);
        case 'updating_owner_field':
          return this.superAdminHandler.saveOwnerField(ctx, session);
        default:
          return this.superAdminHandler.showMenu(ctx, session);
      }
    });

    // --- CONTACT HANDLER ---
    this.bot.on('contact', (ctx) =>
      this.authHandler.handleContact(ctx, ctx.session as SessionData),
    );

    // --- Statistika sahifa toggle ---
    this.bot.action(/stats_page_(\d+)/, async (ctx: any) => {
      const page = parseInt(ctx.match[1], 10);
      await this.superAdminHandler.showStatistics(ctx, page);
    });

    // --- Delete Owner ---
    this.bot.action(/delete_owner_(.+)/, async (ctx: any) => {
      const ownerId = ctx.match[1];
      if (!ownerId) return ctx.answerCbQuery('Owner topilmadi ❌');

      const owner = await this.prisma.user.findUnique({
        where: { id: ownerId },
      });
      if (!owner) return ctx.answerCbQuery('Owner topilmadi ❌');

      await this.prisma.user.delete({ where: { id: ownerId } });
      await ctx.editMessageText(`✅ ${owner.name} o‘chirildi`);
      await ctx.answerCbQuery('Owner muvaffaqiyatli o‘chirildi ✅');
    });

    // --- Update Owner ---
    this.bot.action(/update_owner_(.+)/, async (ctx: any) => {
      const ownerId = ctx.match[1];
      const session = ctx.session as SessionData;
      await this.superAdminHandler.handleUpdateOwner(ctx, session, ownerId);
    });

    // --- Update Field Tanlash ---
    this.bot.action(/update_field_(.+)/, async (ctx: any) => {
      const session = ctx.session as SessionData;
      const fieldMap = { name: 'name', phone: 'phone', shop: 'shop' };
      const fieldKey = ctx.match[1];
      session.updateField = fieldMap[fieldKey] as 'name' | 'phone' | 'shop';
      session.state = 'updating_owner_field';
      await ctx.reply('Yangi qiymatni kiriting:');
    });

    // Inline tugmalar action handler
    this.bot.action(/update_cancel/, async (ctx: any) => {
      const session = ctx.session as SessionData;
      // Sessionni tozalash
      session.state = 'super_admin_menu';
      session.tempOwnerId = undefined;
      session.updateField = undefined;

      await ctx.answerCbQuery('Bekor qilindi ❌'); // tugma bosilganini bildirish
      // Asosiy menyuni ko‘rsatish
      await this.superAdminHandler.showMenu(ctx, session);
    });
  }
}
