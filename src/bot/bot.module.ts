import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../core/prisma.service';
import { BotService } from './bot.service';

@Module({
  imports: [ConfigModule],
  providers: [BotService, PrismaService],
})
export class BotModule {}
