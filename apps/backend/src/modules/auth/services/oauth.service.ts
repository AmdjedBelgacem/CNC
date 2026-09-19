import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { DrizzleService } from '../../../database/drizzle.service';
import { oauthAccounts } from '../../../database/schema/auth';
import { users } from '../../../database/schema/users';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class OAuthService {
  constructor(private drizzle: DrizzleService) {}

  async findAccount(provider: string, providerAccountId: string) {
    return this.drizzle.db.query.oauthAccounts.findFirst({
      where: and(
        eq(oauthAccounts.provider, provider),
        eq(oauthAccounts.providerAccountId, providerAccountId),
      ),
      with: { user: true },
    });
  }

  async findAccountsByUser(userId: string) {
    return this.drizzle.db.query.oauthAccounts.findMany({
      where: eq(oauthAccounts.userId, userId),
    });
  }

  async linkAccount(params: {
    userId: string;
    provider: string;
    providerAccountId: string;
    providerEmail?: string;
    avatarUrl?: string;
  }) {
    const existing = await this.findAccount(params.provider, params.providerAccountId);
    if (existing) {
      if (existing.userId !== params.userId) {
        throw new ConflictException('This social account is already linked to another user');
      }
      return existing;
    }

    const [account] = await this.drizzle.db.insert(oauthAccounts).values({
      userId: params.userId,
      provider: params.provider,
      providerAccountId: params.providerAccountId,
      providerEmail: params.providerEmail || null,
      avatarUrl: params.avatarUrl || null,
    }).returning();

    return account;
  }

  async unlinkAccount(userId: string, provider: string) {
    const accounts = await this.findAccountsByUser(userId);
    const user = await this.drizzle.db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) throw new NotFoundException('User not found');

    const hasPassword = !!user.passwordHash;
    if (!hasPassword && accounts.length <= 1) {
      throw new ConflictException(
        'Cannot unlink your only login method. Set a password first.',
      );
    }

    await this.drizzle.db
      .delete(oauthAccounts)
      .where(and(
        eq(oauthAccounts.userId, userId),
        eq(oauthAccounts.provider, provider),
      ));
  }
}
