import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Module({
  providers: [PrismaService],
  exports: [PrismaService], // 👈 Juda muhim! Boshqa modullar uni ishlatishi uchun
})
export class CoreModule {}
