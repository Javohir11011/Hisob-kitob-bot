import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../core/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async login(username?: string, password?: string, phone?: string) {
    // 1️⃣ Username validation
    if (!username) {
      throw new BadRequestException('Username kiriting');
    }

    // 2️⃣ Password validation
    if (!password) {
      throw new BadRequestException('Password kiriting');
    }

    // 3️⃣ Userni DB dan topish
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) throw new UnauthorizedException("Hali ro'yxatdan o'tmagansiz");

    // 4️⃣ Password tekshirish
    const isValid = await bcrypt.compare(password, user.password || '');
    if (!isValid) throw new UnauthorizedException("Parol noto'g'ri");

    // 5️⃣ Telefon raqami tekshiruvi (optional)
    if (phone && user.phone !== phone) {
      throw new UnauthorizedException('Telefon raqami mos kelmadi');
    }

    // 6️⃣ SUPER_ADMIN tekshiruvi
    if (user.role !== 'SUPER_ADMIN')
      throw new ForbiddenException("Ruxsat yo'q");

    return { message: 'Kirish muvaffaqiyatli', user };
  }
}
