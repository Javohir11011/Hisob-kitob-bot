import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../core/prisma.service';
import { BotService } from './bot.service';
import { AuthHandler } from './handlers/auth.handlers';
import { SuperAdminHandler } from './handlers/super-admin.handler';

@Module({
  imports: [ConfigModule],
  providers: [BotService, AuthHandler, SuperAdminHandler, PrismaService],
})
export class BotModule {}
