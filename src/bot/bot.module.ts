import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { session } from 'telegraf';
import { PrismaService } from '../core/prisma.service';
import { BotService } from './bot.service';
import { BotUpdate } from './bot.update';
import { AuthHandler } from './handlers/auth.handlers';
import { ShopOwnerHandler } from './handlers/shop-owner.handlers';
import { SuperAdminHandler } from './handlers/super-admin.handler';

@Module({
  imports: [ConfigModule],
  providers: [
    BotService,
    AuthHandler,
    SuperAdminHandler,
    ShopOwnerHandler,
    PrismaService,
  ],
})
export class BotModule {}
