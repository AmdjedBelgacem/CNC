import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminRolesController } from './admin-roles.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminTenantController } from './admin-tenant.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [AdminController, AdminRolesController, AdminAnalyticsController, AdminDashboardController, AdminTenantController],
  providers: [AdminService],
})
export class AdminModule {}
