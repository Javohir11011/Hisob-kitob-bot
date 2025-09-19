import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { password?: string; phone?: string }) {
    const { password, phone } = body;
    return this.authService.login(password, phone);
  }
}
