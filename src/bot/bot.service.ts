// src/bot/bot.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';
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

    // --- TEXT HANDLER ---
    this.bot.on('text', async (ctx) => {
      const session = ctx.session as SessionData;
      if (!ctx.message || !('text' in ctx.message)) return;

      const text = ctx.message.text.trim();

      try {
        // Login state
        if (
          ['awaiting_password', 'awaiting_phone'].includes(session.state ?? '')
        ) {
          if (session.state === 'awaiting_password') {
            return this.authHandler.handlePassword({ ctx, session });
          } else {
            return this.authHandler.handleContact(ctx, session);
          }
        }

        // Super admin states
        const superAdminStates = [
          'adding_owner_name',
          'adding_owner_phone',
          'adding_owner_password',
          'adding_owner_shop',
          'adding_owner_shop_address',
          'updating_owner_field',
          'search_owner',
          'super_admin_menu',
        ];

        if (superAdminStates.includes(session.state ?? '')) {
          switch (session.state) {
            case 'adding_owner_name':
            case 'adding_owner_phone':
            case 'adding_owner_password':
            case 'adding_owner_shop':
            case 'adding_owner_shop_address':
              if (text === '❌ Bekor qilish') {
                session.state = 'super_admin_menu';
                return this.superAdminHandler.showMenu(ctx, session);
              }
              return this.superAdminHandler.handleAddOwner(ctx, session);

            case 'search_owner':
              if (text === '❌ Bekor qilish') {
                session.state = 'super_admin_menu';
                return this.superAdminHandler.showMenu(ctx, session);
              }
              return this.superAdminHandler.handleSearchOwner(ctx, session);

            case 'super_admin_menu':
              return this.superAdminHandler.handleMenu(ctx, session);

            case 'updating_owner_field':
              return this.superAdminHandler.saveOwnerField(ctx, session);
          }
        }

        // Shop Owner / Helper states
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
            'search_debtor_for_debt',
          ];

          if (shopStates.includes(session.state ?? '')) {
            switch (session.state) {
              case 'shop_owner_menu':
              case 'shop_owner_profile':
              case 'adding_helper_name':
              case 'adding_helper_phone':
              case 'adding_helper_password':
              case 'adding_debtor_name':
              case 'adding_debtor_phone':
              case 'adding_debtor_address':
              case 'adding_debt_amount':
              case 'adding_debt_note':
                return this.shopOwnerHandler.handleText(ctx, session);

              case 'search_debtor_for_debt':
                return this.shopOwnerHandler.handleSearchAndSelectDebtor(
                  ctx,
                  session,
                );
            }
          }
        }

        // Agar session.state aniqlanmagan bo‘lsa → role bo‘yicha menu
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
        await this.authHandler.handleContact(ctx, ctx.session as SessionData);
      } catch (err) {
        console.error('❌ contact error:', err);
      }
    });

    // --- CALLBACK QUERY ---
    this.bot.on('callback_query', async (ctx: any) => {
      try {
        const session = ctx.session as SessionData;

        // 1️⃣ Shop Owner callback
        await this.shopOwnerHandler.handleCallbackQuery(ctx, session);

        // 2️⃣ Super Admin callback
        await this.superAdminHandler.handleCallbackQuery(ctx, session);
      } catch (err) {
        console.error('❌ callback_query error:', err);
      }
    });
    // --- INLINE ACTIONS (addDebt) ---
    this.bot.action(/addDebt:(.+)/, async (ctx: any) => {
      try {
        const session = ctx.session as SessionData;
        const debtorId = ctx.match[1];
        session.tempDebtorId = debtorId;
        session.state = 'adding_debt_amount';

        const debtor = await this.prisma.debtor.findUnique({
          where: { id: debtorId },
        });
        await ctx.answerCbQuery(`Qarz summasini kiriting ${debtor?.name}`);
        await ctx.reply(
          `👤 Qarzdor tanlandi:\n\nIsm: ${debtor?.name}\n📞 ${debtor?.phone ?? 'yo‘q'}\n🏠 ${debtor?.address ?? 'yo‘q'}\n\n💰 Endi qarz summasini kiriting:`,
          {
            reply_markup: {
              keyboard: [['❌ Bekor qilish']],
              resize_keyboard: true,
            },
          },
        );
      } catch (err) {
        console.error('❌ addDebt action error:', err);
      }
    });

    // TEXT + VOICE birlashtirish
    this.bot.on(['text', 'voice', 'audio'], async (ctx) => {
      const session = ctx.session as SessionData;
      if (session.state !== 'adding_debt_amount') return;
      if (!ctx.message) return;

      const message = ctx.message as
        | { text: string }
        | { voice: { file_id: string } }
        | { audio: { file_id: string } };

      if ('text' in message) {
        await this.handleDebtAmountVoice(ctx, session, message.text);
      } else if ('voice' in message) {
        await this.handleDebtAmountVoice(ctx, session, message.voice.file_id);
      } else if ('audio' in message) {
        await this.handleDebtAmountVoice(ctx, session, message.audio.file_id);
      }
    });
  }

  // handleDebtAmount funksiyasi (ovozi + text)
  private async handleDebtAmountVoice(
    ctx: Context,
    session: SessionData,
    fileId: string,
  ) {
    try {
      // 1️⃣ Ovoz faylini olish
      const fileLink = await ctx.telegram.getFileLink(fileId);
      const filePath = path.join(__dirname, `temp_${Date.now()}.ogg`);
      const response = await fetch(fileLink.href);
      const arrayBuffer = await response.arrayBuffer();
      fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

      // 2️⃣ Ovoz → wav
      const wavPath = filePath.replace('.ogg', '.wav');
      await new Promise((resolve, reject) => {
        exec(`ffmpeg -i ${filePath} -ar 16000 -ac 1 ${wavPath}`, (err) =>
          err ? reject(err) : resolve(true),
        );
      });

      // 3️⃣ Whisper transkriptsiya
      const txtPath = wavPath.replace('.wav', '.txt');
      await new Promise((resolve, reject) => {
        exec(`./main -m ggml-small.bin -f ${wavPath} -otxt`, (err) =>
          err ? reject(err) : resolve(true),
        );
      });

      const text = fs.readFileSync(txtPath, 'utf-8');

      // 4️⃣ Fayllarni tozalash
      fs.unlinkSync(filePath);
      fs.unlinkSync(wavPath);
      fs.unlinkSync(txtPath);

      // 5️⃣ Matndan summani ajratish
      const amountMatch = text.match(/(\d+(\.\d+)?)/);
      if (!amountMatch) {
        await ctx.reply(
          '❌ Summani aniqlay olmadim. Iltimos, qayta urinib ko‘ring.',
        );
        return;
      }

      const amount = parseFloat(amountMatch[1]);

      // 6️⃣ Summani foydalanuvchiga ko‘rsatish
      await ctx.reply(`🔢 Siz kiritgan summa: ${amount} so'm`);

      // 7️⃣ Minimum 1000 so‘m tekshiruvi
      if (amount < 1000) {
        await ctx.reply(
          '❌ Qarz summasi kamida 1000 so‘m bo‘lishi kerak. Iltimos, qayta kiriting.',
        );
        session.state = 'adding_debt_amount'; // yana urinishi uchun state
        return;
      }

      // 8️⃣ DB ga qo‘shish
      if (!session.tempDebtorId || !session.shopId) return;

      await this.prisma.debt.create({
        data: {
          debtorId: session.tempDebtorId,
          amount,
          note: text,
          userId: session.userId,
        },
      });

      await ctx.reply(`✅ Qarz muvaffaqiyatli qo‘shildi: ${amount} so'm`);

      session.state = 'shop_owner_menu';
      await this.shopOwnerHandler.showMenu(ctx, session);
    } catch (err) {
      console.error('❌ handleDebtAmountVoice error:', err);
      await ctx.reply('❌ Xatolik yuz berdi, iltimos qayta urinib ko‘ring.');
    }
  }
}
