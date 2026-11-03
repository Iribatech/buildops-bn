import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module.js';
import { UserModule } from '../user/user.module.js';
import { getSecret } from '../common/env.js';
import { RealtimeGateway } from './realtime.gateway.js';

@Module({
  imports: [
    AuthModule,
    UserModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: getSecret(config, 'JWT_SECRET', 'fallback-secret'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
