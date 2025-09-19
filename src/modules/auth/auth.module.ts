// src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module'; // PrismaService import qilinadi
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [CoreModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
