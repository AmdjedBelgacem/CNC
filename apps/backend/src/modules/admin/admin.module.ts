import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminRolesController } from './admin-roles.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminTenantController } from './admin-tenant.controller';
import { AdminFinanceController } from './admin-finance.controller';
import { AdminService } from './admin.service';
import { FinanceService } from './finance.service';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [
    AdminController,
    AdminRolesController,
    AdminAnalyticsController,
    AdminDashboardController,
    AdminTenantController,
    AdminFinanceController,
  ],
  providers: [AdminService, FinanceService],
})
export class AdminModule {}
