import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/** Longest direct message. Without a cap one request could store an arbitrarily large body. */
export const DM_MAX_LENGTH = 5000;

export class CreateConversationDto {
  @IsUUID()
  peerId!: string;
}

export class SendMessageDto {
  @IsUUID()
  conversationId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(DM_MAX_LENGTH)
  body!: string;
}

export class MarkReadDto {
  @IsUUID()
  conversationId!: string;

  @IsUUID()
  messageId!: string;
}
