import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Context, Markup, Telegraf } from 'telegraf';
import LocalSession from 'telegraf-session-local';
import { PrismaService } from '../core/prisma.service';

type SessionData = {
  state?:
    | 'awaiting_password'
    | 'awaiting_phone'
    | 'super_admin_menu'
    | 'adding_owner_name'
    | 'adding_owner_phone'
    | 'adding_owner_password';
  password?: string;
  phone?: string;
  newOwnerName?: string;
  newOwnerPhone?: string;
  newOwnerPassword?: string;
};

@Injectable()
export class BotService implements OnModuleInit {
  private bot: Telegraf<Context>;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const token = this.configService.get<string>('BOT_TOKEN');
    if (!token) throw new Error('Bot token topilmadi .env faylida');

    this.bot = new Telegraf(token);
    const localSession = new LocalSession({ database: 'session_db.json' });
    this.bot.use(localSession.middleware());
  }

  onModuleInit() {
    this.setupCommands();
    this.bot.launch();
    console.log('Bot ishga tushdi ✅');
  }

  private async showSuperAdminMenu(ctx: Context, session: SessionData) {
    session.state = 'super_admin_menu';
    await ctx.reply(
      'Super admin paneliga qaytdingiz. Tugmalarni tanlang:',
      Markup.keyboard([
        ['➕ Add Shop Owner', '📋 Shop Owners List'],
        ['📊 Umumiy Hisobot', '🔑 Update Password'],
      ])
        .oneTime()
        .resize(),
    );
  }

  private setupCommands() {
    // /start komandasi
    this.bot.start(async (ctx) => {
      await ctx.reply(
        'Assalomu alaykum 👋 Qarzingizni boshqarish botiga xush kelibsiz.',
      );
      await ctx.reply('Kirish uchun /login yozing.');
    });

    // /login komandasi
    this.bot.command('login', async (ctx) => {
      const session = ctx.session as SessionData;
      session.state = 'awaiting_password';
      await ctx.reply(
        'Iltimos, parolingizni kiriting:',
        Markup.removeKeyboard(),
      );
    });

    // --- Text handler ---
    this.bot.on('text', async (ctx) => {
      const session = ctx.session as SessionData;
      if (!session.state) return;

      // LOGIN JARAYONI
      if (session.state === 'awaiting_password') {
        session.password = ctx.message.text.trim();
        session.state = 'awaiting_phone';
        await ctx.reply(
          'Endi telefon raqamingizni yuboring:',
          Markup.keyboard([
            Markup.button.contactRequest('📱 Telefon raqamni yuborish'),
          ])
            .oneTime()
            .resize(),
        );
        return;
      }

      // SUPER ADMIN MENU
      if (session.state === 'super_admin_menu') {
        const text = ctx.message.text;

        if (text === '➕ Add Shop Owner') {
          session.state = 'adding_owner_name';
          await ctx.reply(
            'Yangi shop owner ismini kiriting:',
            Markup.keyboard([['❌ Bekor qilish']])
              .oneTime()
              .resize(),
          );
          return;
        }

        if (text === '📋 Shop Owners List') {
          const owners = await this.prisma.user.findMany({
            where: { role: 'SHOP_OWNER' },
          });
          if (owners.length === 0) {
            await ctx.reply('Hozircha shop ownerlar mavjud emas.');
            return;
          }
          let replyText = 'Shop ownerlar ro‘yxati:\n\n';
          owners.forEach((o, idx) => {
            replyText += `${idx + 1}. ${o.username || o.phone} - ${o.phone}\n`;
          });
          await ctx.reply(replyText);
          return;
        }

        if (text === '📊 Umumiy Hisobot') {
          const owners = await this.prisma.user.findMany({
            where: { role: 'SHOP_OWNER' },
          });
          if (owners.length === 0) {
            await ctx.reply('Hozircha hisobot mavjud emas.');
            return;
          }
          let report = 'Umumiy hisobot:\n\n';
          for (const owner of owners) {
            const clients = await this.prisma.user.findMany({
              where: { shopId: owner.id },
              include: { debts: true },
            });
            const totalDebt = clients.reduce(
              (sum, client) =>
                sum + client.debts.reduce((s, debt) => s + debt.amount, 0),
              0,
            );
            report += `${owner.username || owner.phone}: ${totalDebt} so‘m\n`;
          }
          await ctx.reply(report);
          return;
        }
      }

      // --- ADD SHOP OWNER PROCESS ---
      if (session.state === 'adding_owner_name') {
        if (ctx.message.text === '❌ Bekor qilish')
          return await this.showSuperAdminMenu(ctx, session);

        session.newOwnerName = ctx.message.text.trim();
        session.state = 'adding_owner_phone';
        await ctx.reply(
          'Shop owner telefon raqamini kiriting (+998XXXXXXXXX):',
          Markup.keyboard([['❌ Bekor qilish']])
            .oneTime()
            .resize(),
        );
        return;
      }

      if (session.state === 'adding_owner_phone') {
        if (ctx.message.text === '❌ Bekor qilish')
          return await this.showSuperAdminMenu(ctx, session);

        let phone = ctx.message.text.trim();
        if (phone.startsWith('0')) phone = '+998' + phone.slice(1);
        if (!phone.startsWith('+')) phone = '+' + phone;

        if (!/^\+998\d{9}$/.test(phone)) {
          await ctx.reply(
            'Telefon raqam noto‘g‘ri formatda. Iltimos +998XXXXXXXXX formatida kiriting:',
          );
          return;
        }

        const existing = await this.prisma.user.findFirst({ where: { phone } });
        if (existing) {
          await ctx.reply(
            'Bu telefon raqam allaqachon mavjud. Iltimos boshqa raqam kiriting:',
          );
          return;
        }

        session.newOwnerPhone = phone;
        session.state = 'adding_owner_password';
        await ctx.reply(
          'Shop owner uchun parol kiriting:',
          Markup.keyboard([['❌ Bekor qilish']])
            .oneTime()
            .resize(),
        );
        return;
      }

      if (session.state === 'adding_owner_password') {
        if (ctx.message.text === '❌ Bekor qilish')
          return await this.showSuperAdminMenu(ctx, session);

        session.newOwnerPassword = ctx.message.text.trim();

        await this.prisma.user.create({
          data: {
            username: session.newOwnerName,
            phone: session.newOwnerPhone,
            password: await bcrypt.hash(session.newOwnerPassword, 10),
            role: 'SHOP_OWNER',
          },
        });

        await ctx.reply(
          `Yangi shop owner "${session.newOwnerName}" qo‘shildi ✅`,
        );
        await this.showSuperAdminMenu(ctx, session);
        return;
      }
    });

    // --- Contact orqali LOGIN telefon ---
    this.bot.on('contact', async (ctx) => {
      const session = ctx.session as SessionData;
      if (session.state !== 'awaiting_phone') return;

      let phone = ctx.message.contact.phone_number.replace(/\s+/g, '');
      if (phone.startsWith('0')) phone = '+998' + phone.slice(1);
      if (!phone.startsWith('+')) phone = '+' + phone;

      const password = session.password?.trim();
      session.phone = phone;
      session.state = undefined;

      const user = await this.prisma.user.findFirst({ where: { phone } });
      if (!user) {
        await ctx.reply(
          'Telefon raqam topilmadi. /login bilan qayta urinib ko‘ring.',
          Markup.removeKeyboard(),
        );
        return;
      }

      const isPasswordCorrect = await bcrypt.compare(password, user.password);
      if (!isPasswordCorrect) {
        await ctx.reply(
          'Parol noto‘g‘ri. /login bilan qayta urinib ko‘ring.',
          Markup.removeKeyboard(),
        );
        return;
      }

      await ctx.reply(
        `Salom ${user.username || 'Foydalanuvchi'}, siz muvaffaqiyatli login qildingiz!`,
        Markup.removeKeyboard(),
      );

      if (user.role === 'SUPER_ADMIN') {
        await this.showSuperAdminMenu(ctx, session);
      }
    });
  }
}
