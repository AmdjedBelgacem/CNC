export interface Post {
  id: string;
  tenantId: string | null;
  userId: string;
  content: string;
  mediaUrls: string[] | null;
  tags: string[] | null;
  isPublic: boolean;
  likeCount: number;
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
  likes?: PostLike[];
  comments?: Comment[];
}

export interface PostLike {
  postId: string;
  userId: string;
  createdAt: Date;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

export interface RepairShop {
  id: string;
  name: string;
  description: string | null;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  specialties: string[];
  rating: number | null;
  isVerified: boolean;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  location: { lat: number; lng: number; city: string; state: string } | null;
  memberCount: number;
  isPublic: boolean;
}
