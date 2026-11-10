import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { BILLING_PROVIDER } from '../src/billing/billing.tokens.js';

/**
 * Provider selection is a boot-time decision, so testing it means compiling a
 * second `AppModule`. That second module owns its own TypeORM `DataSource`, and
 * closing it shuts that connection down. Kept in its own file, the second app is
 * the only app in the process; in a suite that already has a running app it
 * closes the connection out from under the tests that follow.
 */
describe('billing provider selection (e2e)', () => {
  it('boots in production on the stub when BILLING_PROVIDER is not set', async () => {
    // Payments are bypassed for now: production must start without any Stripe
    // keys and fall back to the stub instead of refusing to boot.
    //
    // `NODE_ENV` and `JWT_SECRET` are set on the environment before the module
    // is compiled, because provider factories run during compilation: setting
    // them afterwards would test nothing.
    const previousNodeEnv = process.env.NODE_ENV;
    const previousSecret = process.env.JWT_SECRET;
    const previousProvider = process.env.BILLING_PROVIDER;
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET =
      previousSecret?.trim() || 'production-boot-test-secret';
    delete process.env.BILLING_PROVIDER;

    try {
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      try {
        expect(moduleRef.get(BILLING_PROVIDER).name).toBe('stub');
      } finally {
        await moduleRef.close();
      }
    } finally {
      if (previousProvider === undefined) delete process.env.BILLING_PROVIDER;
      else process.env.BILLING_PROVIDER = previousProvider;

      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;

      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    }
  });
});
