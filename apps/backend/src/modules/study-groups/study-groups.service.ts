import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { studyGroups } from '../../database/schema/social';
import { eq, desc } from 'drizzle-orm';

@Injectable()
export class StudyGroupsService {
  constructor(private drizzle: DrizzleService) {}

  async findAll(academy?: string) {
    if (academy) {
      return this.drizzle.db.select().from(studyGroups).where(eq(studyGroups.academy, academy)).orderBy(desc(studyGroups.memberCount));
    }
    return this.drizzle.db.select().from(studyGroups).orderBy(desc(studyGroups.memberCount));
  }

  async create(data: any, hostId: string) {
    const [group] = await this.drizzle.db.insert(studyGroups).values({
      hostId,
      name: data.name,
      description: data.description,
      academy: data.academy,
      address: data.address,
      city: data.city,
      state: data.state,
      lat: data.lat,
      lng: data.lng,
      meetingSchedule: data.meetingSchedule,
      maxMembers: data.maxMembers || 20,
      coverUrl: data.coverUrl,
    }).returning();
    return group;
  }
}
