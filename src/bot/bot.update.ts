import { Command, Ctx, Update } from 'nestjs-telegraf';
import { SuperAdminHandler } from './handlers/super-admin.handler';
import { SessionData } from './states/session.data';

@Update()
export class BotUpdate {
  constructor(private readonly superAdminHandler: SuperAdminHandler) {}

  @Command('menyu')
  async showMenu(@Ctx() ctx: any) {
    const session: SessionData = ctx.session;
    await this.superAdminHandler.showMenu(ctx, session);
  }
}
