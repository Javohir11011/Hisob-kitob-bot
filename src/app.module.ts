import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotModule } from './bot/bot.module';
import { CoreModule } from './core/core.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), CoreModule, BotModule],
})
export class AppModule {}
