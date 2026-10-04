import { Global, Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '../../config/config.service';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { AuditService } from './services/audit.service';
import { TotpService } from './services/totp.service';
import { OAuthService } from './services/oauth.service';
import { EmailVerificationService } from './services/email-verification.service';
import { LockoutService } from './services/lockout.service';
import { EmailService } from './services/email.service';
import { CsrfService } from './services/csrf.service';
import { KeyManagementService } from './services/key-management.service';
import { UserPreferencesService } from './services/user-preferences.service';
import { UploadService } from './services/upload.service';
import { CookieService } from './services/cookie.service';
import { RedisService } from './services/redis.service';
import { ProfileController } from './profile.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SupabaseTokenVerifier } from './supabase-token.verifier';
import { SupabaseAuthClient } from './supabase-auth.client';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { GoogleStrategy } from './strategies/google.strategy';
import { GithubStrategy } from './strategies/github.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { TenantScopeGuard } from './guards/tenant-scope.guard';
import { OptionalAuthGuard } from './guards/optional-auth.guard';
import { CsrfGuard } from './guards/csrf.guard';
import { RbacModule } from '../rbac/rbac.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SearchModule } from '../search/search.module';

@Global()
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get('JWT_ACCESS_EXPIRY') as any },
      }),
    }),
    RbacModule,
    forwardRef(() => NotificationsModule),
    SearchModule,
  ],
  controllers: [AuthController, ProfileController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    AuditService,
    TotpService,
    OAuthService,
    EmailVerificationService,
    LockoutService,
    EmailService,
    CsrfService,
    KeyManagementService,
    UserPreferencesService,
    UploadService,
    CookieService,
    RedisService,
    JwtStrategy,
    SupabaseTokenVerifier,
    SupabaseAuthClient,
    SupabaseAuthGuard,
    GoogleStrategy,
    GithubStrategy,
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
    TenantScopeGuard,
    OptionalAuthGuard,
    CsrfGuard,
  ],
  exports: [
    // Exported so the JwtAuthGuard instances registered in other modules (admin
    // controllers and their feature modules) can resolve the Supabase fallback.
    // Without these, Supabase tokens work on auth routes but 401 on /admin/*.
    SupabaseTokenVerifier,
    SupabaseAuthClient,
    SupabaseAuthGuard,
    AuthService,
    PasswordService,
    TokenService,
    AuditService,
    TotpService,
    OAuthService,
    EmailService,
    CsrfService,
    KeyManagementService,
    CookieService,
    RedisService,
    UploadService,
    UserPreferencesService,
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
    TenantScopeGuard,
    OptionalAuthGuard,
    CsrfGuard,
  ],
})
export class AuthModule {}
