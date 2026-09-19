export type EventType = 'workshop' | 'webinar' | 'conference' | 'meetup' | 'competition';

export interface Event {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  description: string | null;
  eventType: EventType;
  startDate: Date;
  endDate: Date | null;
  location: EventLocation | null;
  isVirtual: boolean;
  maxAttendees: number | null;
  price: number | null;
  thumbnailUrl: string | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
  attendees?: EventAttendee[];
}

export interface EventLocation {
  venue?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

export interface EventAttendee {
  id: string;
  eventId: string;
  userId: string;
  status: 'registered' | 'attended' | 'cancelled' | 'waitlisted';
  registeredAt: Date;
}
